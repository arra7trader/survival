import { getSetting } from './db.js';

// Strategy: "The Predator" (Hybrid: Dip Sniper + Breakout Chaser)
export async function makeDecision(indicators, aiAnalysis) {
    const minConfluence = parseInt(await getSetting('min_confluence') || '4');
    const signals = indicators.signals || [];
    const { rsi, macd, trend, price, volume, high24h } = indicators;

    let score = 0;
    const details = [];

    // --- STRATEGY 1: DIP SNIPER (Buy Low) ---
    if (rsi < 40 && trend === 'bullish') {
        score += 3;
        details.push(`Dip Sniper: RSI Oversold (${rsi.toFixed(1)}) in Uptrend`);
    }

    // --- STRATEGY 2: BREAKOUT CHASER (Buy High, Sell Higher) ---
    // User wants "Maximum Profit". The biggest moves happen at breakouts.
    // Check if price is near 24h High and Volume is spiking.
    const isNearHigh = price >= (high24h || price) * 0.98;
    const isVolumeSpike = volume > (indicators.avgVolume || volume) * 1.5;

    if (isNearHigh && isVolumeSpike && trend === 'bullish') {
        score += 4; // High conviction
        details.push('Breakout Chaser: Price near High + Volume Spike! (Momentum)');
    } else if (trend === 'bullish' && macd.histogram > 0) {
        score += 1;
        details.push('Trend Follower: Bullish Momentum');
    }

    // --- CONFIRMATIONS ---
    if (aiAnalysis) {
        if (aiAnalysis.direction === 'buy') {
            score += 3;
            details.push(`AI Confirm: ${aiAnalysis.reasoning}`);
        } else if (aiAnalysis.direction === 'sell') {
            score -= 10; // VETO
            details.push('AI Veto: Bearish Sentiment');
        }
    }

    // --- DECISION ---
    // Threshold: 7/10 for Buy (Aggressive but Calculated)
    let action = 'hold';
    let confidence = score / 10;

    if (score >= 7) {
        action = 'buy';
    }

    return {
        action,
        confidence: Math.min(confidence, 1), // Cap at 100%
        reason: details.join(' + '),
        indicatorDetails: details,
        aiAnalysis
    };
}
