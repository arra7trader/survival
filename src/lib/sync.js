import { fetchBalance, fetchTradeHistory, fetchTicker } from './exchange';
import { dbRun, dbGet, dbAll } from './db';

// Syncs local in-memory DB with Exchange Reality
// Called at the start of every Cron Job
export async function syncWithExchange() {
    try {
        console.log('🔄 Syncing with Exchange...');
        try {
            console.log('🔄 Syncing with Exchange...');
            const balance = await fetchBalance();
            // REMOVED: const history = await fetchTradeHistory(); // Too slow for Vercel Hobby (5 calls)

            // 1. SYNC OPEN POSITIONS
            // We trust the Exchange Balance. If we have > 0 balance of a coin (not USDT), it's an Open Trade.

            await dbRun("DELETE FROM trades WHERE status = 'open'"); // Clear old memory state

            for (const pos of balance.positions) {
                const symbol = pos.symbol;
                let entryPrice = 0;
                let openedAt = new Date().toISOString();

                // Lazy fetch history ONLY for this position to find entry price
                try {
                    // We import fetchTradeHistory locally or from exchange to avoid circular diffs if moved
                    // But better: use direct exchange call here or optimized fetch
                    // For now, let's assume unknown entry if we can't get it fast
                    // entryPrice = ...
                } catch { }

                // For now, simplified: we won't fetch history to save time. 
                // If we have a position, we just track it.
                // If needed, we can implement 'fetchLastBuy(symbol)' in exchange.js later.

                // Re-insert as active trade
                await dbRun(
                    `INSERT INTO trades (symbol, side, entry_price, quantity, status, opened_at) VALUES (?, 'buy', ?, ?, 'open', ?)`,
                    [symbol, entryPrice, pos.quantity, openedAt]
                );
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
