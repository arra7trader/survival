import { NextResponse } from 'next/server';
import { fetchCandles, fetchTicker, fetchBalance, placeOrder, closePosition } from '@/lib/exchange';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeMarket } from '@/lib/ai-analyzer';
import { makeDecision } from '@/lib/strategy';
import { checkRiskRules, calculateSLTP, checkOpenTrades, withRetry } from '@/lib/risk-manager';
import { dbRun, dbGet, getSetting } from '@/lib/db';
import { runSelfOptimizer } from '@/lib/self-optimizer';
import { syncWithExchange } from '@/lib/sync';

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
    // (Sync via syncWithExchange already refreshed the DB with real positions)
    const openTrades = await dbGet("SELECT symbol FROM trades WHERE status = 'open'");
    // If we have an open trade for a symbol, skip analyzing it for BUY, only check EXIT.

    // We iterate pairs but stop if time runs out
    const startTime = Date.now();

    for (const symbol of pairs) {
        if (Date.now() - startTime > 8000) break; // Stop if nearing 10s limit

        try {
            // Self-healing: wrap fetch
            const candles = await withRetry(() => fetchCandles(symbol, '5m', 100), `fetch candles ${symbol}`);
            const ticker = await withRetry(() => fetchTicker(symbol), `fetch ticker ${symbol}`);
            const balance = await withRetry(() => fetchBalance(), 'fetch balance');
            const indicators = calculateIndicators(candles);

            // AI analysis (fallback if fails)
            let aiAnalysis;
            try {
                aiAnalysis = await analyzeMarket(symbol, indicators, candles);
            } catch {
                aiAnalysis = { direction: 'neutral', confidence: 0.5, reasoning: 'AI offline', patterns: [] };
            }

            // Check if we already have this position
            const existingTrade = await dbGet("SELECT * FROM trades WHERE symbol = ? AND status = 'open'", [symbol]);

            if (existingTrade) {
                // MANAGE EXIT (SL/TP)
                // In stateless mode, we might not have 'stop_loss' stored accurately if we just synced.
                // So we rely on current global settings or dynamic calculation.
                // For now, simple check: is PnL < -2% or > +4%?

                // Calculate PnL
                const pnlPct = existingTrade.entry_price
                    ? ((ticker.last - existingTrade.entry_price) / existingTrade.entry_price) * 100
                    : 0;

                const sl = parseFloat(await getSetting('stop_loss_pct') || '2');
                const tp = parseFloat(await getSetting('take_profit_pct') || '4');

                if (pnlPct <= -sl || pnlPct >= tp) {
                    await closePosition(symbol, 'buy', existingTrade.quantity);
                    await dbRun("UPDATE trades SET status = 'closed', closed_at = datetime('now') WHERE id = ?", [existingTrade.id]);
                    results.push({ symbol, action: 'closed', pnl: pnlPct });
                }
            } else {
                // LOOK FOR ENTRY
                const decision = await makeDecision(indicators, aiAnalysis);

                if (decision.action === 'buy') {
                    const riskCheck = await checkRiskRules(balance, decision.action);
                    if (riskCheck.allowed) {
                        const quantity = riskCheck.positionSize / ticker.last;
                        // Precision handling (simplified)
                        const roundedQty = parseFloat(quantity.toPrecision(4));

                        if (roundedQty > 0) {
                            await placeOrder(symbol, 'buy', roundedQty);
                            await dbRun("INSERT INTO trades (symbol, side, entry_price, quantity, status) VALUES (?, 'buy', ?, ?, 'open')",
                                [symbol, ticker.last, roundedQty]);
                            results.push({ symbol, action: 'buy', price: ticker.last });
                        }
                    }
                }
            }

        } catch (err) {
            results.push({ symbol, error: err.message });
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
