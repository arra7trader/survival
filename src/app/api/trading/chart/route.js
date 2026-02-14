import { NextResponse } from 'next/server';
import { dbAll } from '@/lib/db';

export async function GET() {
    try {
        // Get balance history from portfolio snapshots
        const snapshots = await dbAll(
            'SELECT total_balance, created_at FROM portfolio_snapshots ORDER BY created_at ASC LIMIT 500'
        );

        // Also build from closed trades if snapshots are sparse
        const trades = await dbAll(
            "SELECT pnl, closed_at FROM trades WHERE status = 'closed' ORDER BY closed_at ASC LIMIT 500"
        );

        // Build equity curve from trades
        let balance = 20; // initial budget
        const equityCurve = [{ balance: 20, time: null, label: 'Start' }];

        for (const trade of trades) {
            balance += (trade.pnl || 0);
            equityCurve.push({
                balance: Math.round(balance * 100) / 100,
                time: trade.closed_at,
                label: new Date(trade.closed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            });
        }

        return NextResponse.json({
            equityCurve,
            snapshots: snapshots.map(s => ({
                balance: s.total_balance,
                time: s.created_at,
            })),
            currentBalance: balance,
            initialBalance: 20,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
