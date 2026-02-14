import { getSetting } from './db.js';

// Main decision engine: combines technical signals + AI analysis
export async function makeDecision(indicators, aiAnalysis) {
    const minConfluence = parseInt(await getSetting('min_confluence') || '3');
    const signals = indicators.signals || [];

    // Count buy/sell votes
    let buyVotes = 0;
    let sellVotes = 0;
    let totalStrength = 0;
    let buyStrength = 0;
    let sellStrength = 0;

    for (const signal of signals) {
        if (signal.direction === 'buy') {
            buyVotes++;
            buyStrength += signal.strength;
        } else if (signal.direction === 'sell') {
            sellVotes++;
            sellStrength += signal.strength;
        }
        totalStrength += signal.strength;
    }

    // AI vote (counts as 1 vote but with higher weight)
    if (aiAnalysis.direction === 'buy') {
        buyVotes++;
        buyStrength += aiAnalysis.confidence;
    } else if (aiAnalysis.direction === 'sell') {
        sellVotes++;
        sellStrength += aiAnalysis.confidence;
    }

    const totalVotes = signals.length + 1; // +1 for AI

    // Decision logic
    let action = 'hold';
    let confidence = 0;
    let reason = '';

    if (buyVotes >= minConfluence && buyVotes > sellVotes) {
        action = 'buy';
        confidence = buyStrength / (buyVotes || 1);
        reason = `${buyVotes}/${totalVotes} indicators bullish (strength: ${(confidence * 100).toFixed(0)}%)`;
    } else if (sellVotes >= minConfluence && sellVotes > buyVotes) {
        action = 'sell';
        confidence = sellStrength / (sellVotes || 1);
        reason = `${sellVotes}/${totalVotes} indicators bearish (strength: ${(confidence * 100).toFixed(0)}%)`;
    } else {
        action = 'hold';
        confidence = 0;
        reason = `Insufficient confluence: ${buyVotes} buy, ${sellVotes} sell (need ${minConfluence})`;
    }

    return {
        action,
        confidence,
        reason,
        votes: { buy: buyVotes, sell: sellVotes, neutral: totalVotes - buyVotes - sellVotes, total: totalVotes },
        indicatorDetails: signals.map(s => ({
            name: s.name,
            direction: s.direction,
            strength: s.strength,
            detail: s.detail,
        })),
        aiAnalysis: {
            direction: aiAnalysis.direction,
            confidence: aiAnalysis.confidence,
            reasoning: aiAnalysis.reasoning,
            patterns: aiAnalysis.patterns,
        },
    };
}
