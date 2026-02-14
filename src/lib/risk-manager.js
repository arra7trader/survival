import { getSetting, dbAll, dbGet } from './db.js';

// Check if a new trade is allowed by risk rules
export async function checkRiskRules(balance, action) {
    const maxPositionPct = parseFloat(await getSetting('max_position_pct') || '30');
    const maxDailyLossPct = parseFloat(await getSetting('max_daily_loss_pct') || '5');
    const maxOpenPositions = parseInt(await getSetting('max_open_positions') || '2');
    const emergencyFloor = parseFloat(await getSetting('emergency_floor') || '10');
    const tradingEnabled = (await getSetting('trading_enabled')) !== 'false';

    const issues = [];

    if (!tradingEnabled) {
        issues.push('Trading is disabled');
        return { allowed: false, issues, positionSize: 0 };
    }

    if (balance.free < emergencyFloor) {
        issues.push(`Balance ($${balance.free.toFixed(2)}) below emergency floor ($${emergencyFloor})`);
        return { allowed: false, issues, positionSize: 0 };
    }

    const openTrades = await dbAll("SELECT * FROM trades WHERE status = 'open'");
    if (openTrades.length >= maxOpenPositions) {
        issues.push(`Max open positions reached (${openTrades.length}/${maxOpenPositions})`);
        return { allowed: false, issues, positionSize: 0 };
    }

    const todayStart = new Date().toISOString().split('T')[0];
    const todayLosses = await dbGet(
        `SELECT COALESCE(SUM(pnl), 0) as total_loss FROM trades WHERE pnl < 0 AND closed_at >= ? AND status = 'closed'`,
        [todayStart]
    );
    const initialBudget = parseFloat(await getSetting('initial_budget') || '20');
    const dailyLossLimit = initialBudget * (maxDailyLossPct / 100);
    const dailyLoss = Math.abs(todayLosses?.total_loss || 0);

    if (dailyLoss >= dailyLossLimit) {
        issues.push(`Daily loss limit reached ($${dailyLoss.toFixed(2)} / $${dailyLossLimit.toFixed(2)})`);
        return { allowed: false, issues, positionSize: 0 };
    }

    const maxPositionValue = balance.free * (maxPositionPct / 100);
    const positionSize = Math.min(maxPositionValue, balance.free - emergencyFloor);

    if (positionSize < 1) {
        issues.push('Position size too small (< $1)');
        return { allowed: false, issues, positionSize: 0 };
    }

    return {
        allowed: true,
        issues: [],
        positionSize: Math.floor(positionSize * 100) / 100,
        stopLossPct: parseFloat(await getSetting('stop_loss_pct') || '2'),
        takeProfitPct: parseFloat(await getSetting('take_profit_pct') || '4'),
    };
}

export function calculateSLTP(entryPrice, side, stopLossPct, takeProfitPct) {
    if (side === 'buy') {
        return {
            stopLoss: entryPrice * (1 - stopLossPct / 100),
            takeProfit: entryPrice * (1 + takeProfitPct / 100),
        };
    } else {
        return {
            stopLoss: entryPrice * (1 + stopLossPct / 100),
            takeProfit: entryPrice * (1 - takeProfitPct / 100),
        };
    }
}

export async function checkOpenTrades(currentPrices) {
    const openTrades = await dbAll("SELECT * FROM trades WHERE status = 'open'");
    const results = [];

    for (const trade of openTrades) {
        const price = currentPrices[trade.symbol];
        if (!price) continue;

        let shouldClose = false;
        let reason = '';

        if (trade.side === 'buy') {
            if (price <= trade.stop_loss) { shouldClose = true; reason = 'Stop Loss hit'; }
            if (price >= trade.take_profit) { shouldClose = true; reason = 'Take Profit hit'; }
        } else {
            if (price >= trade.stop_loss) { shouldClose = true; reason = 'Stop Loss hit'; }
            if (price <= trade.take_profit) { shouldClose = true; reason = 'Take Profit hit'; }
        }

        if (shouldClose) {
            const pnl = trade.side === 'buy'
                ? (price - trade.entry_price) * trade.quantity
                : (trade.entry_price - price) * trade.quantity;
            const pnlPct = (pnl / (trade.entry_price * trade.quantity)) * 100;
            results.push({ trade, exitPrice: price, pnl, pnlPct, reason });
        }
    }

    return results;
}

// Self-healing: retry an async operation with backoff
export async function withRetry(fn, label = 'operation', maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            console.error(`[RETRY] ${label} attempt ${attempt}/${maxRetries} failed: ${err.message}`);
            if (attempt === maxRetries) throw err;
            await new Promise(r => setTimeout(r, attempt * 2000)); // 2s, 4s, 6s
        }
    }
}
