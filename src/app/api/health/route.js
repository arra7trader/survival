import { NextResponse } from 'next/server';
import { isExchangeConnected, fetchBalance } from '@/lib/exchange';
import { dbRun, dbAll, dbGet } from '@/lib/db';

export async function GET() {
    try {
        const exchangeOk = await isExchangeConnected();
        const aiOk = !!process.env.GROQ_API_KEY;
        const balance = await fetchBalance();
        const openTrades = await dbAll("SELECT * FROM trades WHERE status = 'open'");
        const totalTrades = await dbGet("SELECT COUNT(*) as count FROM trades");
        const recentHealth = await dbAll("SELECT * FROM health_logs ORDER BY created_at DESC LIMIT 10");

        const status = exchangeOk ? (balance.total < 10 ? 'warning' : 'healthy') : 'critical';
        const message = !exchangeOk ? 'Exchange not connected (no API keys)'
            : balance.total < 10 ? `Low balance: $${balance.total.toFixed(2)}`
                : `Running. Balance: $${balance.total.toFixed(2)}, ${openTrades.length} open positions`;

        await dbRun(
            `INSERT INTO health_logs (status, exchange_connected, ai_connected, balance, message) VALUES (?, ?, ?, ?, ?)`,
            [status, exchangeOk ? 1 : 0, aiOk ? 1 : 0, balance.total, message]
        );

        return NextResponse.json({
            status,
            exchange: { connected: exchangeOk, balance: balance.total },
            ai: { connected: aiOk, provider: 'Groq' },
            trading: {
                openPositions: openTrades.length,
                totalTrades: totalTrades?.count || 0,
                balance: balance.total,
                freeBalance: balance.free,
            },
            message,
            history: recentHealth,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        return NextResponse.json({ error: err.message, status: 'error' }, { status: 500 });
    }
}
