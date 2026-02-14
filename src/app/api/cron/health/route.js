import { NextResponse } from 'next/server';
import { isExchangeConnected, fetchBalance } from '@/lib/exchange';
import { dbRun, getSetting, setSetting, dbAll } from '@/lib/db';
import { withRetry } from '@/lib/risk-manager';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let exchangeOk = false;
        let balance = { total: 0, free: 0 };

        // Self-healing: retry exchange check
        try {
            exchangeOk = await withRetry(() => isExchangeConnected(), 'exchange check');
            balance = await withRetry(() => fetchBalance(), 'fetch balance');
        } catch {
            exchangeOk = false;
        }

        const emergencyFloor = parseFloat(await getSetting('emergency_floor') || '10');
        const tradingEnabled = (await getSetting('trading_enabled')) !== 'false';

        // Emergency shutdown check
        if (exchangeOk && balance.total < emergencyFloor && balance.total > 0) {
            await setSetting('trading_enabled', 'false');
            await dbRun(
                `INSERT INTO health_logs (status, exchange_connected, ai_connected, balance, message) VALUES (?, ?, ?, ?, ?)`,
                ['emergency', 1, 1, balance.total, `🚨 EMERGENCY SHUTDOWN: Balance $${balance.total.toFixed(2)} below floor $${emergencyFloor}. Trading disabled to protect remaining capital.`]
            );
            return NextResponse.json({ status: 'emergency', message: 'Trading auto-disabled — protecting capital' });
        }

        // Auto-restart: if balance recovered above floor and was disabled, re-enable
        if (!tradingEnabled && exchangeOk && balance.total >= emergencyFloor * 1.3) {
            await setSetting('trading_enabled', 'true');
            await dbRun(
                `INSERT INTO health_logs (status, exchange_connected, ai_connected, balance, message) VALUES (?, ?, ?, ?, ?)`,
                ['recovered', 1, 1, balance.total, `✅ AUTO-RESTART: Balance recovered to $${balance.total.toFixed(2)}. Trading re-enabled.`]
            );
        }

        // Cleanup old logs
        await dbRun(`DELETE FROM health_logs WHERE id NOT IN (SELECT id FROM health_logs ORDER BY created_at DESC LIMIT 500)`);
        await dbRun(`DELETE FROM signals WHERE id NOT IN (SELECT id FROM signals ORDER BY created_at DESC LIMIT 1000)`);

        // Log health
        const status = !exchangeOk ? 'offline' : (balance.total < emergencyFloor * 1.5 ? 'warning' : 'healthy');
        await dbRun(
            `INSERT INTO health_logs (status, exchange_connected, ai_connected, balance, message) VALUES (?, ?, ?, ?, ?)`,
            [status, exchangeOk ? 1 : 0, process.env.GROQ_API_KEY ? 1 : 0, balance.total,
                exchangeOk ? `💚 Alive. Balance: $${balance.total.toFixed(2)}` : '⚠️ Exchange offline — waiting to reconnect...']
        );

        return NextResponse.json({ status, balance: balance.total, timestamp: new Date().toISOString() });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
