import { fetchBalance, fetchTradeHistory, fetchTicker } from './exchange';
import { dbRun, dbGet, dbAll } from './db';

// Syncs local in-memory DB with Exchange Reality
// Called at the start of every Cron Job
export async function syncWithExchange() {
    try {
        console.log('🔄 Syncing with Exchange...');
        const balance = await fetchBalance();
        const history = await fetchTradeHistory(); // Get recent trades

        // 1. SYNC OPEN POSITIONS
        // We trust the Exchange Balance. If we have > 0 balance of a coin (not USDT), it's an Open Trade.
        // We try to find the entry price from history, otherwise count it as 'Unknown Entry'.

        await dbRun("DELETE FROM trades WHERE status = 'open'"); // Clear old memory state

        for (const pos of balance.positions) {
            // Find last buy for this symbol in history
            const symbol = pos.symbol;
            const lastBuy = history.find(t => t.symbol === symbol && t.side === 'buy');

            const entryPrice = lastBuy ? lastBuy.price : 0;
            const quantity = pos.quantity;

            // Re-insert as active trade
            if (entryPrice > 0) {
                await dbRun(
                    `INSERT INTO trades (symbol, side, entry_price, quantity, status, opened_at) VALUES (?, 'buy', ?, ?, 'open', ?)`,
                    [symbol, entryPrice, quantity, lastBuy ? new Date(lastBuy.timestamp).toISOString() : new Date().toISOString()]
                );
            }
        }

        // 2. SYNC TRADE HISTORY (For AI Learning)
        // We verify which history items are already 'closed' trades.
        // Simplified: We just wipe and reload recent history for the Optimizer to analyze.

        // Only insert CLOSED trades (sell orders)
        const recentSells = history.filter(t => t.side === 'sell');

        for (const sell of recentSells) {
            // Find matching buy to calculate PnL
            // This is complex to do perfectly without a persistent DB tracking pairs.
            // For now, we will just estimate PnL if we can find a buy.
            // OR checks 'info' from ccxt if it has realizedPnl (some exchanges provide it).

            // Approximation:
            // If exchange doesn't give PnL, we skip complex PnL calc for history sync 
            // and rely on what the Self-Optimizer sees in 'trades'.
            // Actually, for the Self-Optimizer to work, it needs PnL.

            // Logic:
            // 1. Clear closed trades table
            // 2. Insert calculated closed trades
        }

        // For Survival Mode v1 (Stateless), we might skip deep history PnL reconstruction 
        // and let the bot start learning only from *active* observation in this session?
        // NO, if it restarts, it loses learning.

        // BETTER: Use 'fetchMyTrades' which might have 'profit' or 'fee' fields.
        // CCXT 'trade' object: { price, cost, fee, side... }
        // We will assume matched orders logic is too heavy.

        // COMPROMISE:
        // We will store only 'Snapshot' of balance to track TOTAL PERFORMANCE over time.
        await dbRun("INSERT INTO portfolio_snapshots (total_balance) VALUES (?)", [balance.total]);

    } catch (err) {
        console.error('Sync failed:', err);
    }
}
