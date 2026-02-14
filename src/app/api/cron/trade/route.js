import { NextResponse } from 'next/server';
import { fetchCandles, fetchTicker, fetchBalance, placeOrder, closePosition } from '@/lib/exchange';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeMarket } from '@/lib/ai-analyzer';
import { makeDecision } from '@/lib/strategy';
import { checkRiskRules, calculateSLTP, checkOpenTrades, withRetry } from '@/lib/risk-manager';
import { dbRun, dbGet, dbAll, getSetting } from '@/lib/db';
import { runSelfOptimizer } from '@/lib/self-optimizer';
import { syncWithExchange } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // 10s timeout for Hobby plan (avoid hard kill)

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 0. SYNC WITH REALITY (Stateless)
    await syncWithExchange();

    // 1. CHECK GUARDRAILS
    const tradingEnabled = (await getSetting('trading_enabled')) !== 'false';
    if (!tradingEnabled) {
        return NextResponse.json({ message: 'Trading disabled — AI is paused', timestamp: new Date().toISOString() });
    }

    const pairsStr = await getSetting('trading_pairs') || 'BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT,DOGE/USDT';
    const pairs = pairsStr.split(',').map(s => s.trim()).filter(Boolean);
    const results = [];

    // 2. CHECK EXISTING OPEN POSITIONS
    const openTrades = await dbGet("SELECT symbol FROM trades WHERE status = 'open'");
    const openSymbols = openTrades ? [openTrades.symbol] : []; // Assuming dbGet returns one row or null? Wait, dbGet returns first row. 
    // Actually dbAll for multiple. Let's fix that.
    const allOpen = await dbAll("SELECT symbol FROM trades WHERE status = 'open'");
    const openSymbolList = allOpen.map(t => t.symbol);

    // 3. SELECT HUNT CANDIDATES (Random 1)
    const shuffledPairs = pairs.sort(() => 0.5 - Math.random()).slice(0, 1);

    // 4. FETCH PRICES (Only for Open Positions + Hunt Candidates)
    const targetSymbols = [...new Set([...openSymbolList, ...shuffledPairs])];

    const prices = {};
    for (const symbol of targetSymbols) {
        try {
            const ticker = await fetchTicker(symbol);
            prices[symbol] = ticker.last;
        } catch (e) { console.error(`Price fetch failed for ${symbol}`, e); }
    }

    // 3. MANAGE OPEN POSITIONS (Profit Ladder & Trailing Stops)
    // This function inside risk-manager now handles the "Ratchet" logic (locking profits)
    const closedTrades = await checkOpenTrades(prices);

    for (const hit of closedTrades) {
        // Execute the close on Exchange
        await closePosition(hit.trade.symbol, 'sell', hit.trade.quantity);

        // Update DB
        await dbRun("UPDATE trades SET status = 'closed', exit_price = ?, pnl = ?, closed_at = datetime('now') WHERE id = ?",
            [hit.exitPrice, hit.pnl, hit.trade.id]);

        results.push({ symbol: hit.trade.symbol, action: 'closed', pnl: hit.pnlPct, reason: hit.reason });
    }

    // 5. HUNT FOR NEW TRADES (Predator Mode)
    // Vercel Hobby Limit: 10s. Strict.
    // Solution: We already picked 1 random coin in step 3.

    const startTime = Date.now();
    for (const symbol of shuffledPairs) {
        if (Date.now() - startTime > 8000) break; // Time limit

        // Skip if we already have a position
        const existing = await dbGet("SELECT id FROM trades WHERE symbol = ? AND status = 'open'", [symbol]);
        if (existing) continue;

        try {
            const candles = await fetchCandles(symbol, '5m', 30);
            const indicators = calculateIndicators(candles);

            // Inject 24h High/Volume for Breakout Strategy
            indicators.price = prices[symbol];
            // indicators.high24h... need to fetch if not in candles (candles cover 500m usually)

            let aiAnalysis = { direction: 'neutral', confidence: 0.5 };
            try { aiAnalysis = await analyzeMarket(symbol, indicators, candles); } catch { }

            const decision = await makeDecision(indicators, aiAnalysis);

            if (decision.action === 'buy') {
                // ... (Existing Risk Check & Buy Logic) ...
                const risk = await checkRiskRules(await fetchBalance(), 'buy'); // Fetch balance fresh? Or pass cached?
                // For safety, fetch fresh balance for sizing
                const balance = await fetchBalance();

                if (risk.allowed && balance.free >= 6) {
                    const qty = (risk.positionSize / prices[symbol]).toPrecision(5);

                    await placeOrder(symbol, 'buy', qty);
                    await dbRun("INSERT INTO trades (symbol, side, entry_price, quantity, status) VALUES (?, 'buy', ?, ?, 'open')",
                        [symbol, prices[symbol], qty]);
                    results.push({ symbol, action: 'buy', price: prices[symbol], reason: decision.reason });
                }
            }

        } catch (err) {
            console.error(`Error processing ${symbol}:`, err);
        }
    }

    // 3. OPTIMIZER (Run if we have data)
    // runSelfOptimizer(); // Optional in stateless mode

    return NextResponse.json({
        message: 'Cycle complete',
        results,
        timestamp: new Date().toISOString(),
    });
}
