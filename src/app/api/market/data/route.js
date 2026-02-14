import { NextResponse } from 'next/server';
import { fetchCandles, fetchTicker } from '@/lib/exchange';
import { calculateIndicators } from '@/lib/indicators';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol') || 'BTC/USDT';

        const candles = await fetchCandles(symbol, '5m', 100);
        const ticker = await fetchTicker(symbol);
        const indicators = calculateIndicators(candles);

        return NextResponse.json({
            symbol,
            ticker,
            indicators: {
                price: indicators.price,
                ema9: indicators.ema9,
                ema21: indicators.ema21,
                rsi: indicators.rsi,
                macd: indicators.macd,
                bb: indicators.bb,
                volume: indicators.volume,
            },
            signals: indicators.signals,
            candles: candles.slice(-20),
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
