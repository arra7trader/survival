// AI Market Analyzer using Groq (Free)
export async function analyzeMarket(symbol, indicators, recentCandles) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return {
            direction: 'neutral',
            confidence: 0.5,
            reasoning: 'AI analysis unavailable (no API key). Using technical indicators only.',
            patterns: [],
        };
    }

    const last5 = recentCandles.slice(-5);
    const priceChange = ((last5[4]?.close - last5[0]?.open) / last5[0]?.open * 100).toFixed(2);

    const prompt = `You are an expert crypto trader. Analyze this market data and give a trading signal.

Symbol: ${symbol}
Current Price: $${indicators.price?.toFixed(2)}
Price Change (last 25min): ${priceChange}%

Technical Indicators:
- EMA 9: ${indicators.ema9?.toFixed(2)} | EMA 21: ${indicators.ema21?.toFixed(2)} | Trend: ${indicators.ema9 > indicators.ema21 ? 'BULLISH' : 'BEARISH'}
- RSI (14): ${indicators.rsi?.toFixed(1)}
- MACD Histogram: ${indicators.macd?.histogram?.toFixed(4)} ${indicators.macd?.histogram > 0 ? '(positive)' : '(negative)'}
- Bollinger: Upper=${indicators.bb?.upper?.toFixed(2)}, Mid=${indicators.bb?.middle?.toFixed(2)}, Lower=${indicators.bb?.lower?.toFixed(2)}
- Volume: ${indicators.volume?.ratio?.toFixed(1)}x average

Recent 5 Candles (5m):
${last5.map(c => `O:${c.open.toFixed(0)} H:${c.high.toFixed(0)} L:${c.low.toFixed(0)} C:${c.close.toFixed(0)} V:${c.volume.toFixed(0)}`).join('\n')}

Respond in this exact JSON format only, no other text:
{"direction":"buy|sell|hold","confidence":0.0-1.0,"reasoning":"one sentence explanation","patterns":["pattern1","pattern2"]}`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a professional crypto trading analyst. Always respond with valid JSON only.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 200,
            }),
        });

        if (!res.ok) {
            throw new Error(`Groq API error: ${res.status}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                direction: parsed.direction || 'hold',
                confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
                reasoning: parsed.reasoning || 'No reasoning provided',
                patterns: parsed.patterns || [],
            };
        }

        return { direction: 'hold', confidence: 0.5, reasoning: 'Could not parse AI response', patterns: [] };
    } catch (err) {
        console.error('AI analysis error:', err.message);
        return {
            direction: 'neutral',
            confidence: 0.5,
            reasoning: `AI error: ${err.message}. Falling back to indicators only.`,
            patterns: [],
        };
    }
}
