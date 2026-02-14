import { dbAll, dbGet, getSetting, setSetting, dbRun } from './db.js';

// Self-optimizer: learns from past trades and auto-adjusts parameters
export async function runSelfOptimizer() {
    const log = [];
    const trades = await dbAll("SELECT * FROM trades WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 50");

    if (trades.length < 10) {
        log.push('⏳ Not enough trades yet (need 10). Waiting to learn...');
        await saveOptimizationLog(log);
        return log;
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const winRate = wins.length / trades.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;

    // Current settings
    const currentMinConfluence = parseInt(await getSetting('min_confluence') || '3');
    const currentSL = parseFloat(await getSetting('stop_loss_pct') || '2');
    const currentTP = parseFloat(await getSetting('take_profit_pct') || '4');
    const currentMaxPos = parseFloat(await getSetting('max_position_pct') || '30');

    // 1. ADAPT CONFLUENCE THRESHOLD
    if (winRate < 0.35) {
        // Losing too much → be more selective
        const newConfluence = Math.min(currentMinConfluence + 1, 5);
        if (newConfluence !== currentMinConfluence) {
            await setSetting('min_confluence', String(newConfluence));
            log.push(`🧠 Win rate ${(winRate * 100).toFixed(0)}% too low → Tightened confluence: ${currentMinConfluence} → ${newConfluence}/6 (being more selective)`);
        }
    } else if (winRate > 0.65 && currentMinConfluence > 2) {
        // Winning consistently → can be slightly more aggressive
        const newConfluence = Math.max(currentMinConfluence - 1, 2);
        if (newConfluence !== currentMinConfluence) {
            await setSetting('min_confluence', String(newConfluence));
            log.push(`🧠 Win rate ${(winRate * 100).toFixed(0)}% strong → Loosened confluence: ${currentMinConfluence} → ${newConfluence}/6 (more opportunities)`);
        }
    } else {
        log.push(`✅ Confluence ${currentMinConfluence}/6 is optimal for ${(winRate * 100).toFixed(0)}% win rate`);
    }

    // 2. ADAPT STOP LOSS
    const slHitCount = trades.filter(t => t.pnl < 0 && t.exit_price && Math.abs(t.pnl_percent) >= currentSL * 0.9).length;
    const slHitRate = slHitCount / trades.length;

    if (slHitRate > 0.4) {
        // SL getting hit too often → widen it slightly, reduce position size
        const newSL = Math.min(currentSL + 0.5, 5);
        const newMaxPos = Math.max(currentMaxPos - 5, 15);
        if (newSL !== currentSL) {
            await setSetting('stop_loss_pct', String(newSL));
            await setSetting('max_position_pct', String(newMaxPos));
            log.push(`🛡️ Stop loss hit rate ${(slHitRate * 100).toFixed(0)}% too high → Widened SL: ${currentSL}% → ${newSL}%, reduced position: ${currentMaxPos}% → ${newMaxPos}%`);
        }
    } else {
        log.push(`✅ Stop loss ${currentSL}% working well (${(slHitRate * 100).toFixed(0)}% hit rate)`);
    }

    // 3. ADAPT TAKE PROFIT
    const recentWins = wins.slice(0, 10);
    if (recentWins.length >= 3) {
        const avgWinPct = recentWins.reduce((s, t) => s + Math.abs(t.pnl_percent || 0), 0) / recentWins.length;
        if (avgWinPct < currentTP * 0.5 && currentTP > 2) {
            // Wins are smaller than TP target → lower TP for more frequent wins
            const newTP = Math.max(currentTP - 0.5, 2);
            await setSetting('take_profit_pct', String(newTP));
            log.push(`🎯 Avg win ${avgWinPct.toFixed(1)}% much lower than TP ${currentTP}% → Lowered TP to ${newTP}% for more frequent wins`);
        } else if (avgWinPct > currentTP * 0.9) {
            // Wins consistently hitting TP → can try raising it
            const newTP = Math.min(currentTP + 0.5, 8);
            await setSetting('take_profit_pct', String(newTP));
            log.push(`🎯 Wins consistently reaching TP → Raised TP: ${currentTP}% → ${newTP}% for bigger wins`);
        } else {
            log.push(`✅ Take profit ${currentTP}% is well-calibrated`);
        }
    }

    // 4. PAIR PERFORMANCE ANALYSIS
    const pairStats = {};
    for (const t of trades) {
        if (!pairStats[t.symbol]) pairStats[t.symbol] = { wins: 0, losses: 0, pnl: 0 };
        if (t.pnl > 0) pairStats[t.symbol].wins++;
        else pairStats[t.symbol].losses++;
        pairStats[t.symbol].pnl += t.pnl || 0;
    }

    const currentPairs = (await getSetting('trading_pairs') || 'BTC/USDT,ETH/USDT').split(',').map(s => s.trim());
    for (const [pair, stats] of Object.entries(pairStats)) {
        const pairTotal = stats.wins + stats.losses;
        if (pairTotal >= 5 && stats.pnl < -1) {
            // This pair is consistently losing → remove it
            const newPairs = currentPairs.filter(p => p !== pair);
            if (newPairs.length >= 1) {
                await setSetting('trading_pairs', newPairs.join(','));
                log.push(`❌ ${pair} removed from rotation: ${stats.wins}W/${stats.losses}L, P&L: $${stats.pnl.toFixed(2)} (consistently losing)`);
            }
        } else {
            log.push(`✅ ${pair}: ${stats.wins}W/${stats.losses}L, P&L: $${stats.pnl.toFixed(2)}`);
        }
    }

    // 5. OVERALL HEALTH
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    if (totalPnl < -3) {
        // Losing more than $3 overall → switch to ultra-conservative
        await setSetting('max_position_pct', '15');
        await setSetting('min_confluence', '4');
        log.push(`🚨 Total P&L $${totalPnl.toFixed(2)} — Switching to ultra-conservative mode (15% position, 4/6 confluence)`);
    }

    log.push(`📊 Summary: ${wins.length}W/${losses.length}L | Win rate: ${(winRate * 100).toFixed(0)}% | Avg win: $${avgWin.toFixed(3)} | Avg loss: $${avgLoss.toFixed(3)}`);

    await saveOptimizationLog(log);
    return log;
}

async function saveOptimizationLog(log) {
    await dbRun(
        `INSERT INTO health_logs (status, exchange_connected, ai_connected, balance, message) VALUES (?, ?, ?, ?, ?)`,
        ['optimizer', 1, 1, 0, '🧠 OPTIMIZER: ' + log.join(' | ')]
    );
}
