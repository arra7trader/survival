import { dbAll, dbRun, getSetting } from './db';

// Helper: Retry wrapper
export async function withRetry(fn, operationName, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`${operationName} failed (attempt ${i + 1}/${retries}):`, error.message);
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        }
    }
}

// 1. Position Sizing (Compounding)
export async function checkRiskRules(balance, side) {
    const maxPosPct = parseFloat(await getSetting('max_position_pct') || '40');
    const floor = parseFloat(await getSetting('emergency_floor') || '2');

    if (balance.total < floor) return { allowed: false, reason: 'Emergency Stop' };
    if (side === 'buy' && balance.free < 2) return { allowed: false, reason: 'Insufficient Funds' };

    // Compound: Use Percentage of TOTAL balance (profits included)
    const positionSize = (balance.total * maxPosPct) / 100;
    const minTrade = 6;

    return {
        allowed: balance.free >= minTrade,
        positionSize: Math.max(positionSize, minTrade),
        stopLossPct: parseFloat(await getSetting('stop_loss_pct') || '2'),
        takeProfitPct: parseFloat(await getSetting('take_profit_pct') || '5')
    };
}

export function calculateSLTP(entryPrice, side, slPct, tpPct) {
    return {
        stopLoss: entryPrice * (1 - slPct / 100),
        takeProfit: entryPrice * (1 + tpPct / 100)
    };
}

// 2. DYNAMIC TRAILING STOP (Profit Lock)
// "Ratchet" locking: Never lets profit slide back heavily.
export async function checkOpenTrades(currentPrices) {
    const trades = await dbAll("SELECT * FROM trades WHERE status = 'open'");
    const hits = [];

    for (const trade of trades) {
        const currentPrice = currentPrices[trade.symbol];
        if (!currentPrice) continue;

        const pnlPct = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;

        // --- PROFIT LOCKING LADDER ---
        // 1. Break Even: If > +1%, move SL to Entry + 0.1%
        // 2. Profit Lock 1: If > +3%, move SL to +1.5%
        // 3. Profit Lock 2: If > +5%, move SL to +3%
        // 4. Moonbag: If > +10%, move SL to +8%

        let newSL = trade.stop_loss;
        const entry = trade.entry_price;

        // AGGRESSIVE SCALPING LOGIC
        // Secure even faster. If +0.5% profit, move SL to Break Even.
        // We want to "Free Ride" as soon as possible.
        if (pnlPct > 0.5 && trade.stop_loss < trade.entry_price) {
            newSL = trade.entry_price * 1.001; // Entry + 0.1% (fees)
        } else if (pnlPct >= 10 && trade.stop_loss < entry * 1.08) {
            newSL = entry * 1.08;
        } else if (pnlPct >= 5 && trade.stop_loss < entry * 1.03) {
            newSL = entry * 1.03;
        } else if (pnlPct >= 3 && trade.stop_loss < entry * 1.015) {
            newSL = entry * 1.015;
        } else if (pnlPct >= 1 && trade.stop_loss < entry * 1.001) {
            newSL = entry * 1.001;
        }

        if (newSL > trade.stop_loss) {
            await dbRun("UPDATE trades SET stop_loss = ? WHERE id = ?", [newSL, trade.id]);
            trade.stop_loss = newSL; // Update for check below
        }

        // Check Exit Conditions
        let exit = false;
        let reason = '';

        if (currentPrice <= trade.stop_loss) {
            exit = true;
            reason = 'Stop Loss (Trailing)';
        } else if (currentPrice >= trade.take_profit) {
            exit = true;
            reason = 'Take Profit Target';
        }

        if (exit) {
            const pnl = (currentPrice - trade.entry_price) * trade.quantity;
            hits.push({
                trade,
                exitPrice: currentPrice,
                pnl,
                pnlPct,
                reason
            });
        }
    }
    return hits;
}
