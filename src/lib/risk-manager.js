import { dbAll, dbRun, getSetting } from './db';
import { closePosition } from './exchange';

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

// 1. Check if we can open a new trade
export async function checkRiskRules(balance, side) {
    const maxPosPct = parseFloat(await getSetting('max_position_pct') || '30');
    const floor = parseFloat(await getSetting('emergency_floor') || '2');

    if (balance.total < floor) return { allowed: false, reason: 'Emergency Stop' };
    if (side === 'buy' && balance.free < 2) return { allowed: false, reason: 'Insufficient Funds' };

    const positionSize = (balance.total * maxPosPct) / 100;
    const minTrade = 6; // $6 buffer for $5 limit

    return {
        allowed: balance.free >= minTrade,
        positionSize: Math.max(positionSize, minTrade),
        stopLossPct: parseFloat(await getSetting('stop_loss_pct') || '2'),
        takeProfitPct: parseFloat(await getSetting('take_profit_pct') || '4')
    };
}

export function calculateSLTP(entryPrice, side, slPct, tpPct) {
    return {
        stopLoss: entryPrice * (1 - slPct / 100),
        takeProfit: entryPrice * (1 + tpPct / 100)
    };
}

// 2. MONITOR OPEN TRADES (The "Never Lose" Logic)
export async function checkOpenTrades(currentPrices) {
    const trades = await dbAll("SELECT * FROM trades WHERE status = 'open'");
    const hits = [];

    for (const trade of trades) {
        const currentPrice = currentPrices[trade.symbol];
        if (!currentPrice) continue;

        const pnlPct = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;

        // PREDATOR LOGIC: "Secure the Bag"
        // If profit > 0.8%, move Stop Loss to Break Even (+0.1%)
        // We update the DB 'stop_loss' field dynamically.

        if (pnlPct > 0.8 && trade.stop_loss < trade.entry_price) {
            const newSL = trade.entry_price * 1.001; // Entry + 0.1% (cover fees)
            await dbRun("UPDATE trades SET stop_loss = ? WHERE id = ?", [newSL, trade.id]);
            // Log it? Maybe not needed for performance, but good to know
            console.log(`🔒 Secured profit for ${trade.symbol}: SL moved to Break-Even`);
            trade.stop_loss = newSL; // Update local var for check below
        }

        // Check Exit Conditions
        let exit = false;
        let reason = '';

        if (currentPrice <= trade.stop_loss) {
            exit = true;
            reason = 'Stop Loss Hit';
        } else if (currentPrice >= trade.take_profit) {
            exit = true;
            reason = 'Take Profit Hit';
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
