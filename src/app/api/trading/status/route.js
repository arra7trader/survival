import { NextResponse } from 'next/server';
import { fetchBalance, fetchTicker } from '@/lib/exchange';
import { getPortfolio } from '@/lib/portfolio';
import { getRecentSignals } from '@/lib/portfolio';

export async function GET() {
    try {
        const balance = await fetchBalance();
        const portfolio = await getPortfolio(balance);
        const recentSignals = await getRecentSignals(10);

        // Get current prices for open positions
        for (const pos of portfolio.openPositions) {
            try {
                const ticker = await fetchTicker(pos.symbol);
                pos.currentPrice = ticker.last;
                const pnl = pos.side === 'buy'
                    ? (ticker.last - pos.entry_price) * pos.quantity
                    : (pos.entry_price - ticker.last) * pos.quantity;
                pos.unrealizedPnl = pnl;
                pos.unrealizedPnlPct = (pnl / (pos.entry_price * pos.quantity)) * 100;
            } catch {
                pos.currentPrice = pos.entry_price;
                pos.unrealizedPnl = 0;
                pos.unrealizedPnlPct = 0;
            }
        }

        return NextResponse.json({
            portfolio,
            recentSignals,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
