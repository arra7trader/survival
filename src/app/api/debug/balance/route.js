import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

export async function GET() {
    try {
        const bitgetKey = process.env.BITGET_API_KEY;
        const bitgetSecret = process.env.BITGET_SECRET;
        const bitgetPass = process.env.BITGET_PASSPHRASE;

        if (!bitgetKey) {
            return NextResponse.json({ error: 'No BITGET_API_KEY found in env' });
        }

        const exchange = new ccxt.bitget({
            apiKey: bitgetKey,
            secret: bitgetSecret,
            password: bitgetPass,
            options: { defaultType: 'spot' }
        });

        // Try fetching balance
        const balance = await exchange.fetchBalance();

        return NextResponse.json({
            message: 'Connection Successful',
            totalUSDT: balance.total['USDT'],
            freeUSDT: balance.free['USDT'],
            rawBalance: balance.total // Show all non-zero assets
        });

    } catch (error) {
        return NextResponse.json({
            error: 'Connection Failed',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
