export async function makeDecision(indicators, aiAnalysis) {
    const { rsi, macd, trend, price } = indicators;

    // "PREDATOR MODE" LOGIC
    // We only take trades that are mathematically highly probable.
    // User demand: "Never Lose".
    // Strategy: Extreme Confluence.

    let score = 0;
    const details = [];

    // 1. Trend Alignment (Must be perfect)
    if (trend === 'bullish') {
        score += 2;
        details.push('Trend is Bullish');
    } else if (trend === 'bearish') {
        // In Spot, we rarely short, but if we did...
        // For now, we only BUY in spot.
        score -= 5; // PENALTY: Never buy in bearish trend
        details.push('Trend is Bearish (Avoid)');
    }

    // 2. RSI (Sniper Entry)
    // We want "oversold in an uptrend" (Pullback)
    if (rsi < 40) {
        score += 3;
        details.push(`RSI Oversold (${rsi.toFixed(1)}) - Dip Buying Opportunity`);
    } else if (rsi > 70) {
        score -= 5; // PENALTY: Never buy top
        details.push(`RSI Overbought (${rsi.toFixed(1)}) - Too risky`);
    } else if (rsi > 50 && trend === 'bullish') {
        score += 1;
        details.push('RSI in Momentum Zone');
    }

    // 3. MACD (Momentum)
    if (macd.histogram > 0 && macd.signal > 0) {
        score += 2;
        details.push('MACD Bullish Momentum');
    } else if (macd.histogram < 0) {
        score -= 2;
        details.push('MACD Bearish');
    }

    // 4. AI Confirmation (The Brain)
    if (aiAnalysis) {
        if (aiAnalysis.direction === 'buy') {
            score += 3; // Huge weight to AI
            details.push(`AI Signals BUY (${aiAnalysis.reasoning})`);
        } else if (aiAnalysis.direction === 'sell') {
            score -= 10; // VETO: If AI says sell, we absolutely do not buy.
            details.push('AI Signals SELL (Veto)');
        }
    }

    // DECISION THRESHOLD
    // Max score possible: 2+3+2+3 = 10.
    // "Predator Mode" requires score >= 8.

    let action = 'hold';
    let confidence = score / 10;

    if (score >= 8) {
        action = 'buy';
    } else if (score <= -5) {
        action = 'sell'; // Only relevant for closing, but we handle closing in risk-manager usually.
    }

    return {
        action,
        confidence,
        indicatorDetails: details,
        aiAnalysis
    };
}
