import { EMA, RSI, MACD, BollingerBands, SMA } from 'technicalindicators';

// Calculate all technical indicators from OHLCV candles
export function calculateIndicators(candles) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // EMA 9 & 21
    const ema9 = EMA.calculate({ period: 9, values: closes });
    const ema21 = EMA.calculate({ period: 21, values: closes });

    // RSI 14
    const rsi = RSI.calculate({ period: 14, values: closes });

    // MACD (12, 26, 9)
    const macd = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    });

    // Bollinger Bands (20, 2)
    const bb = BollingerBands.calculate({
        period: 20,
        values: closes,
        stdDev: 2,
    });

    // Volume SMA
    const volumeSMA = SMA.calculate({ period: 20, values: volumes });

    const currentPrice = closes[closes.length - 1];
    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    const prevEma9 = ema9[ema9.length - 2];
    const prevEma21 = ema21[ema21.length - 2];
    const currentRSI = rsi[rsi.length - 1];
    const currentMACD = macd[macd.length - 1];
    const prevMACD = macd[macd.length - 2];
    const currentBB = bb[bb.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumeSMA[volumeSMA.length - 1];

    return {
        price: currentPrice,
        ema9: currentEma9,
        ema21: currentEma21,
        rsi: currentRSI,
        macd: {
            macd: currentMACD?.MACD,
            signal: currentMACD?.signal,
            histogram: currentMACD?.histogram,
            prevHistogram: prevMACD?.histogram,
        },
        bb: {
            upper: currentBB?.upper,
            middle: currentBB?.middle,
            lower: currentBB?.lower,
        },
        volume: {
            current: currentVolume,
            average: avgVolume,
            ratio: avgVolume > 0 ? currentVolume / avgVolume : 1,
        },
        // Pre-calculated signals
        signals: generateSignals({
            currentPrice, currentEma9, currentEma21, prevEma9, prevEma21,
            currentRSI, currentMACD, prevMACD, currentBB, currentVolume, avgVolume,
        }),
    };
}

// Generate individual indicator signals
function generateSignals({ currentPrice, currentEma9, currentEma21, prevEma9, prevEma21, currentRSI, currentMACD, prevMACD, currentBB, currentVolume, avgVolume }) {
    const signals = [];

    // 1. EMA Crossover Signal
    const emaBullishCross = prevEma9 <= prevEma21 && currentEma9 > currentEma21;
    const emaBearishCross = prevEma9 >= prevEma21 && currentEma9 < currentEma21;
    const emaTrend = currentEma9 > currentEma21 ? 'bullish' : 'bearish';

    signals.push({
        name: 'EMA Cross (9/21)',
        direction: emaBullishCross ? 'buy' : emaBearishCross ? 'sell' : emaTrend === 'bullish' ? 'buy' : 'sell',
        strength: emaBullishCross || emaBearishCross ? 1.0 : 0.6,
        detail: emaBullishCross ? 'Bullish crossover' : emaBearishCross ? 'Bearish crossover' : `Trend: ${emaTrend}`,
    });

    // 2. RSI Signal
    let rsiDirection = 'neutral';
    let rsiStrength = 0.5;
    if (currentRSI < 30) { rsiDirection = 'buy'; rsiStrength = 1.0; }
    else if (currentRSI < 40) { rsiDirection = 'buy'; rsiStrength = 0.7; }
    else if (currentRSI > 70) { rsiDirection = 'sell'; rsiStrength = 1.0; }
    else if (currentRSI > 60) { rsiDirection = 'sell'; rsiStrength = 0.7; }
    else { rsiDirection = 'neutral'; }

    signals.push({
        name: 'RSI (14)',
        direction: rsiDirection,
        strength: rsiStrength,
        detail: `RSI: ${currentRSI?.toFixed(1)} ${rsiDirection === 'buy' ? '(oversold)' : rsiDirection === 'sell' ? '(overbought)' : '(neutral)'}`,
    });

    // 3. MACD Signal
    const macdCross = prevMACD && currentMACD;
    let macdDirection = 'neutral';
    let macdStrength = 0.5;

    if (macdCross) {
        const bullishMACD = prevMACD.histogram <= 0 && currentMACD.histogram > 0;
        const bearishMACD = prevMACD.histogram >= 0 && currentMACD.histogram < 0;

        if (bullishMACD) { macdDirection = 'buy'; macdStrength = 1.0; }
        else if (bearishMACD) { macdDirection = 'sell'; macdStrength = 1.0; }
        else if (currentMACD.histogram > 0) { macdDirection = 'buy'; macdStrength = 0.6; }
        else { macdDirection = 'sell'; macdStrength = 0.6; }
    }

    signals.push({
        name: 'MACD',
        direction: macdDirection,
        strength: macdStrength,
        detail: `Histogram: ${currentMACD?.histogram?.toFixed(2)} ${macdDirection === 'buy' ? '↑' : macdDirection === 'sell' ? '↓' : '→'}`,
    });

    // 4. Bollinger Bands Signal
    let bbDirection = 'neutral';
    let bbStrength = 0.5;

    if (currentBB) {
        const bbWidth = currentBB.upper - currentBB.lower;
        const pricePosition = (currentPrice - currentBB.lower) / bbWidth;

        if (pricePosition < 0.1) { bbDirection = 'buy'; bbStrength = 1.0; }
        else if (pricePosition < 0.3) { bbDirection = 'buy'; bbStrength = 0.7; }
        else if (pricePosition > 0.9) { bbDirection = 'sell'; bbStrength = 1.0; }
        else if (pricePosition > 0.7) { bbDirection = 'sell'; bbStrength = 0.7; }
    }

    signals.push({
        name: 'Bollinger Bands',
        direction: bbDirection,
        strength: bbStrength,
        detail: `Price at ${currentBB ? ((currentPrice - currentBB.lower) / (currentBB.upper - currentBB.lower) * 100).toFixed(0) : '?'}% of band`,
    });

    // 5. Volume Signal
    const volRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const volDirection = volRatio > 1.5 ? (emaTrend === 'bullish' ? 'buy' : 'sell') : 'neutral';
    const volStrength = Math.min(volRatio / 2, 1);

    signals.push({
        name: 'Volume',
        direction: volDirection,
        strength: volStrength,
        detail: `${volRatio.toFixed(1)}x avg volume ${volRatio > 1.5 ? '(high)' : volRatio < 0.5 ? '(low)' : '(normal)'}`,
    });

    return signals;
}
