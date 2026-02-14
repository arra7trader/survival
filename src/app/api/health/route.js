
import { NextResponse } from 'next/server';
import { isExchangeConnected, fetchBalance } from '@/lib/exchange';
import { dbAll, getSetting } from '@/lib/db';

export async function GET() {
    try {
        let exchangeConnected = false;
        let balance = { total: 0, free: 0 };
        let balanceError = null;

        try {
            exchangeConnected = await isExchangeConnected();
            if (exchangeConnected) {
                balance = await fetchBalance();
            }
        } catch (err) {
            console.error('Exchange connection error:', err);
            balanceError = err.message;
        }

        // Check AI connection (Groq) - verify key presence
        const aiConnected = !!process.env.GROQ_API_KEY;

        // Get trading stats
        let openPositions = 0;
        let totalTrades = 0;
        let history = [];

        try {
            const openResult = await dbAll("SELECT count(*) as count FROM trades WHERE status = 'open'");
            openPositions = openResult[0]?.count || 0;

            const totalResult = await dbAll("SELECT count(*) as count FROM trades");
            totalTrades = totalResult[0]?.count || 0;

            history = await dbAll("SELECT * FROM health_logs ORDER BY created_at DESC LIMIT 10");
        } catch (dbErr) {
            console.error('Database error:', dbErr);
        }

        let status = 'critical';
        if (exchangeConnected && aiConnected) status = 'healthy';
        else if (exchangeConnected || aiConnected) status = 'warning';

        if (!exchangeConnected) status = 'offline';

        // Check emergency stop
        try {
            const tradingEnabled = (await getSetting('trading_enabled')) !== 'false';
            if (!tradingEnabled) status = 'stopped';
        } catch { }

        return NextResponse.json({
            status,
            exchange: {
                connected: exchangeConnected,
                balance: balance.total
            },
            ai: {
                connected: aiConnected,
                provider: 'Groq'
            },
            trading: {
                openPositions,
                totalTrades,
                balance: balance.total,
                freeBalance: balance.free
            },
            message: !exchangeConnected
                ? (balanceError ? `Connection Error: ${balanceError}` : 'Exchange not connected (Check API Keys)')
                : 'System operational',
            history,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            status: 'critical',
            error: error.message,
            message: 'System critical error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
