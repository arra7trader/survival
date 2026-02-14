import { NextResponse } from 'next/server';
import { dbAll } from '@/lib/db';
import { fetchBalance } from '@/lib/exchange';

export async function GET() {
    try {
        // Stateless Mode: 
        // We rely on current exchange balance + trade history to reconstruct the curve.

        // 1. Get Current Total Balance
        let currentBalance = 0;
        try {
            const bal = await fetchBalance();
            currentBalance = bal.total;
        } catch {
            currentBalance = 0; // If offline
        }

        // 2. Get Trade History (PnL)
        // In stateless mode, 'trades' table is populated by sync.js from Exchange History.
        // However, sync.js mainly syncs OPEN positions. 
        // We need to fetch CLOSED trades from DB (if optimizer ran) or just show what we have.

        // For the chart, we can only map what we know.
        // If the DB is empty (fresh start), chart is flat.

        const trades = await dbAll(
            "SELECT pnl, closed_at FROM trades WHERE status = 'closed' ORDER BY closed_at ASC LIMIT 500"
        );

        // 3. Reconstruct 'Start' Balance
        // Start = Current - Sum(PnL)
        const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        // If current is 0 (offline), default to 0. 
        // If current is > 0, calculate start.
        let startBalance = currentBalance > 0 ? (currentBalance - totalPnL) : (totalPnL > 0 ? 0 : 20);
        // Fallback to 20 only if we really have no idea (offline and no trades), but better to use 0 or '?'
        if (currentBalance === 0 && trades.length === 0) startBalance = 0;

        // Build Curve
        let runningBalance = startBalance;
        const equityCurve = [{ balance: runningBalance, time: null, label: 'Start' }];

        for (const trade of trades) {
            runningBalance += (trade.pnl || 0);
            equityCurve.push({
                balance: Math.round(runningBalance * 100) / 100,
                time: trade.closed_at,
                label: new Date(trade.closed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            });
        }

        // If we have current balance but no trades, show point.
        if (equityCurve.length === 1 && currentBalance > 0) {
            equityCurve[0].balance = currentBalance;
        }

        // Snapshots (historical logs if any)
        const snapshots = await dbAll(
            'SELECT total_balance, created_at FROM portfolio_snapshots ORDER BY created_at ASC LIMIT 500'
        );

        return NextResponse.json({
            equityCurve,
            snapshots: snapshots.map(s => ({
                balance: s.total_balance,
                time: s.created_at,
            })),
            currentBalance,
            initialBalance: startBalance,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
