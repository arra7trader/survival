import { NextResponse } from 'next/server';
import { fetchCandles } from '@/lib/exchange';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeMarket } from '@/lib/ai-analyzer';
import { makeDecision } from '@/lib/strategy';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol') || 'BTC/USDT';

        const candles = await fetchCandles(symbol, '5m', 100);
        const indicators = calculateIndicators(candles);
        const aiAnalysis = await analyzeMarket(symbol, indicators, candles);
        const decision = await makeDecision(indicators, aiAnalysis);

        return NextResponse.json({
            symbol,
            analysis: {
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
                ai: aiAnalysis,
                decision,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
