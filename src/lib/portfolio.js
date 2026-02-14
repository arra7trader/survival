import { dbAll, dbGet, dbRun } from './db.js';

// Get complete portfolio snapshot
export async function getPortfolio(currentBalance) {
    const openTrades = await dbAll("SELECT * FROM trades WHERE status = 'open' ORDER BY opened_at DESC");
    const allTrades = await dbAll("SELECT * FROM trades WHERE status = 'closed' ORDER BY closed_at DESC");

    const totalTrades = allTrades.length;
    const winningTrades = allTrades.filter(t => t.pnl > 0).length;
    const losingTrades = allTrades.filter(t => t.pnl < 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const totalPnl = allTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = winningTrades > 0
        ? allTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / winningTrades
        : 0;
    const avgLoss = losingTrades > 0
        ? Math.abs(allTrades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / losingTrades)
        : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

    // Today's stats
    const todayStart = new Date().toISOString().split('T')[0];
    const todayTrades = allTrades.filter(t => t.closed_at && t.closed_at >= todayStart);
    const todayPnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
        balance: {
            total: currentBalance?.total || 0,
            free: currentBalance?.free || 0,
            used: currentBalance?.used || 0,
        },
        openPositions: openTrades,
        stats: {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate: winRate.toFixed(1),
            totalPnl: totalPnl.toFixed(2),
            todayPnl: todayPnl.toFixed(2),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            profitFactor: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
        },
    };
}

// Save portfolio snapshot
export async function saveSnapshot(balance, winRate, totalTrades, winningTrades) {
    await dbRun(
        `INSERT INTO portfolio_snapshots (total_balance, available_balance, total_pnl, win_rate, total_trades, winning_trades) VALUES (?, ?, ?, ?, ?, ?)`,
        [balance.total, balance.free, 0, winRate, totalTrades, winningTrades]
    );
}

// Get recent trade history
export async function getTradeHistory(limit = 50) {
    return dbAll(`SELECT * FROM trades ORDER BY created_at DESC LIMIT ?`, [limit]);
}

// Get recent signals
export async function getRecentSignals(limit = 20) {
    return dbAll(`SELECT * FROM signals ORDER BY created_at DESC LIMIT ?`, [limit]);
}
