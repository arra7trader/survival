import { NextResponse } from 'next/server';
import { fetchCandles, fetchTicker, fetchBalance, placeOrder, closePosition } from '@/lib/exchange';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeMarket } from '@/lib/ai-analyzer';
import { makeDecision } from '@/lib/strategy';
import { checkRiskRules, calculateSLTP, checkOpenTrades, withRetry } from '@/lib/risk-manager';
import { dbRun, dbGet, getSetting } from '@/lib/db';
import { runSelfOptimizer } from '@/lib/self-optimizer';

export async function GET(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tradingEnabled = (await getSetting('trading_enabled')) !== 'false';
    if (!tradingEnabled) {
        return NextResponse.json({ message: 'Trading disabled — AI is paused', timestamp: new Date().toISOString() });
    }

    const pairsStr = await getSetting('trading_pairs') || 'BTC/USDT,ETH/USDT';
    const pairs = pairsStr.split(',').map(s => s.trim()).filter(Boolean);
    const results = [];

    for (const symbol of pairs) {
        try {
            // Self-healing: wrap each step with retry
            const candles = await withRetry(() => fetchCandles(symbol, '5m', 100), `fetch candles ${symbol}`);
            const ticker = await withRetry(() => fetchTicker(symbol), `fetch ticker ${symbol}`);
            const balance = await withRetry(() => fetchBalance(), 'fetch balance');
            const indicators = calculateIndicators(candles);

            // AI analysis with graceful degradation
            let aiAnalysis;
            try {
                aiAnalysis = await analyzeMarket(symbol, indicators, candles);
            } catch {
                aiAnalysis = { direction: 'neutral', confidence: 0.5, reasoning: 'AI offline — using indicators only', patterns: [] };
            }

            // Check SL/TP on open trades
            const currentPrices = { [symbol]: ticker.last };
            const tradesHit = await checkOpenTrades(currentPrices);
            for (const hit of tradesHit) {
                try { await closePosition(hit.trade.symbol, hit.trade.side, hit.trade.quantity); } catch { }
                await dbRun(
                    `UPDATE trades SET status = 'closed', exit_price = ?, pnl = ?, pnl_percent = ?, closed_at = datetime('now') WHERE id = ?`,
                    [hit.exitPrice, hit.pnl, hit.pnlPct, hit.trade.id]
                );
            }

            // Decision
            const decision = await makeDecision(indicators, aiAnalysis);
            let trade = null;

            if (decision.action === 'buy' || decision.action === 'sell') {
                const riskCheck = await checkRiskRules(balance, decision.action);
                if (riskCheck.allowed) {
                    const quantity = riskCheck.positionSize / ticker.last;
                    const roundedQty = Math.floor(quantity * 100000) / 100000;
                    if (roundedQty > 0) {
                        try {
                            const order = await withRetry(() => placeOrder(symbol, decision.action, roundedQty), `place order ${symbol}`);
                            const entryPrice = order.price || ticker.last;
                            const { stopLoss, takeProfit } = calculateSLTP(entryPrice, decision.action, riskCheck.stopLossPct, riskCheck.takeProfitPct);
                            await dbRun(
                                `INSERT INTO trades (symbol, side, entry_price, quantity, stop_loss, take_profit, signals, ai_analysis, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [symbol, decision.action, entryPrice, roundedQty, stopLoss, takeProfit, JSON.stringify(decision.indicatorDetails), JSON.stringify(decision.aiAnalysis), decision.confidence]
                            );
                            trade = { symbol, side: decision.action, price: entryPrice, quantity: roundedQty };
                        } catch { }
                    }
                }
            }

            // Log signal
            await dbRun(
                `INSERT INTO signals (symbol, direction, confidence, indicators, ai_reasoning, action_taken) VALUES (?, ?, ?, ?, ?, ?)`,
                [symbol, decision.action, decision.confidence, JSON.stringify(decision.indicatorDetails), decision.aiAnalysis?.reasoning, trade ? `${decision.action} executed` : decision.action]
            );

            results.push({ symbol, price: ticker.last, action: decision.action, trade, closedTrades: tradesHit.length });
        } catch (err) {
            results.push({ symbol, error: err.message });
        }
    }

    // Self-optimization: run every 10 closed trades
    try {
        const closedCount = await dbGet("SELECT COUNT(*) as count FROM trades WHERE status = 'closed'");
        const count = closedCount?.count || 0;
        if (count > 0 && count % 10 === 0) {
            const optimLog = await runSelfOptimizer();
            results.push({ optimizer: optimLog });
        }
    } catch { }

    return NextResponse.json({
        message: '🧠 Trade cycle complete',
        results,
        timestamp: new Date().toISOString(),
    });
}
