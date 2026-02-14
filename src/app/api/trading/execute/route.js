import { NextResponse } from 'next/server';
import { fetchCandles, fetchTicker, fetchBalance, placeOrder, closePosition } from '@/lib/exchange';
import { calculateIndicators } from '@/lib/indicators';
import { analyzeMarket } from '@/lib/ai-analyzer';
import { makeDecision } from '@/lib/strategy';
import { checkRiskRules, calculateSLTP, checkOpenTrades } from '@/lib/risk-manager';
import { dbRun, dbAll } from '@/lib/db';

export async function POST(request) {
    try {
        const { symbol = 'BTC/USDT' } = await request.json().catch(() => ({}));

        // Step 1: Fetch market data
        const candles = await fetchCandles(symbol, '5m', 100);
        const ticker = await fetchTicker(symbol);
        const balance = await fetchBalance();

        // Step 2: Calculate technical indicators
        const indicators = calculateIndicators(candles);

        // Step 3: AI market analysis
        const aiAnalysis = await analyzeMarket(symbol, indicators, candles);

        // Step 4: Check open trades for SL/TP
        const currentPrices = { [symbol]: ticker.last };
        const tradesHit = await checkOpenTrades(currentPrices);

        // Close trades that hit SL/TP
        for (const hit of tradesHit) {
            try {
                await closePosition(hit.trade.symbol, hit.trade.side, hit.trade.quantity);
            } catch { }
            await dbRun(
                `UPDATE trades SET status = 'closed', exit_price = ?, pnl = ?, pnl_percent = ?, closed_at = datetime('now') WHERE id = ?`,
                [hit.exitPrice, hit.pnl, hit.pnlPct, hit.trade.id]
            );
        }

        // Step 5: Make trading decision
        const decision = await makeDecision(indicators, aiAnalysis);

        // Step 6: Execute if action
        let trade = null;
        if (decision.action === 'buy' || decision.action === 'sell') {
            const riskCheck = await checkRiskRules(balance, decision.action);

            if (riskCheck.allowed) {
                const quantity = riskCheck.positionSize / ticker.last;
                const roundedQty = Math.floor(quantity * 100000) / 100000;

                if (roundedQty > 0) {
                    try {
                        const order = await placeOrder(symbol, decision.action, roundedQty);
                        const entryPrice = order.price || ticker.last;
                        const { stopLoss, takeProfit } = calculateSLTP(entryPrice, decision.action, riskCheck.stopLossPct, riskCheck.takeProfitPct);

                        await dbRun(
                            `INSERT INTO trades (symbol, side, entry_price, quantity, stop_loss, take_profit, signals, ai_analysis, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [symbol, decision.action, entryPrice, roundedQty, stopLoss, takeProfit, JSON.stringify(decision.indicatorDetails), JSON.stringify(decision.aiAnalysis), decision.confidence]
                        );

                        trade = { symbol, side: decision.action, price: entryPrice, quantity: roundedQty, stopLoss, takeProfit };
                    } catch (err) {
                        decision.reason += ` | Order failed: ${err.message}`;
                    }
                }
            } else {
                decision.reason += ` | Risk blocked: ${riskCheck.issues.join(', ')}`;
            }
        }

        // Save signal log
        await dbRun(
            `INSERT INTO signals (symbol, direction, confidence, indicators, ai_reasoning, action_taken) VALUES (?, ?, ?, ?, ?, ?)`,
            [symbol, decision.action, decision.confidence, JSON.stringify(decision.indicatorDetails), decision.aiAnalysis.reasoning, trade ? `${decision.action} executed` : decision.action]
        );

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            symbol,
            price: ticker.last,
            decision,
            trade,
            closedTrades: tradesHit.length,
            balance: { total: balance.total, free: balance.free },
        });
    } catch (err) {
        console.error('Trade execution error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
