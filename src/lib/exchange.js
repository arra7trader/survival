import ccxt from 'ccxt';

let exchangeInstance = null;

function getExchange() {
    if (exchangeInstance) return exchangeInstance;

    const binanceKey = process.env.BINANCE_API_KEY;
    const bitgetKey = process.env.BITGET_API_KEY;

    let exchangeId = 'binance';
    let config = {
        enableRateLimit: true,
        options: {
            defaultType: 'spot',
            adjustForTimeDifference: true,
        },
    };

    if (bitgetKey && process.env.BITGET_SECRET && process.env.BITGET_PASSPHRASE) {
        exchangeId = 'bitget';
        config.apiKey = bitgetKey;
        config.secret = process.env.BITGET_SECRET;
        config.password = process.env.BITGET_PASSPHRASE;
        // console.log('🔌 Connecting to Bitget...');
    } else if (binanceKey && process.env.BINANCE_SECRET) {
        exchangeId = 'binance';
        config.apiKey = binanceKey;
        config.secret = process.env.BINANCE_SECRET;
        // console.log('🔌 Connecting to Binance...');
    } else {
        return null; // Mock mode if null
    }

    try {
        const exchangeClass = ccxt[exchangeId];
        exchangeInstance = new exchangeClass(config);
        return exchangeInstance;
    } catch (err) {
        console.error(`Failed to initialize ${exchangeId}:`, err);
        return null;
    }
}

// Ensure connection is active
export async function isExchangeConnected() {
    const exchange = getExchange();
    if (!exchange) return false;
    try {
        await exchange.fetchTime();
        return true;
    } catch {
        return false;
    }
}

export async function fetchCandles(symbol = 'BTC/USDT', timeframe = '5m', limit = 100) {
    const exchange = getExchange();
    if (!exchange) return getMockCandles();
    try {
        const candles = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        return candles.map(c => ({ timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }));
    } catch (error) {
        return getMockCandles();
    }
}

export async function fetchTicker(symbol = 'BTC/USDT') {
    const exchange = getExchange();
    if (!exchange) return getMockTicker(symbol);
    try {
        const ticker = await exchange.fetchTicker(symbol);
        return {
            symbol: ticker.symbol,
            last: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            high: ticker.high,
            low: ticker.low,
            volume: ticker.baseVolume,
            change: ticker.percentage,
            timestamp: ticker.timestamp,
        };
    } catch {
        return getMockTicker(symbol);
    }
}

export async function fetchBalance() {
    const exchange = getExchange();
    if (!exchange) return { total: 20, free: 20, used: 0, positions: [] };

    try {
        const bal = await exchange.fetchBalance();
        const total = bal.total['USDT'] || 0;
        const free = bal.free['USDT'] || 0;
        const used = bal.used['USDT'] || 0;

        // Detect open positions (assets > 0 that are not USDT)
        // This is a rough approximation for Spot markets
        const positions = [];
        if (bal.total) {
            for (const [coin, amount] of Object.entries(bal.total)) {
                if (coin !== 'USDT' && amount > 0) {
                    // Estimate value
                    // Note: This requires fetching ticker for each, which is slow. 
                    // We will skip value calc here or do it lazily.
                    positions.push({ symbol: `${coin}/USDT`, quantity: amount });
                }
            }
        }

        return { total, free, used, positions };
    } catch (error) {
        throw error;
    }
}

// Fetch recent trades to rebuild history
export async function fetchTradeHistory(limit = 50) {
    const exchange = getExchange();
    if (!exchange) return [];

    // In Spot, fetching "all trades" is hard. We usually need to specify symbol.
    // For simplicity, we only check the main pairs we trade.
    // If we don't know them, we might miss some.
    // We'll rely on a default list + current positions.
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT'];
    let allTrades = [];

    for (const symbol of symbols) {
        try {
            const trades = await exchange.fetchMyTrades(symbol, undefined, 10); // last 10 per symbol
            allTrades = allTrades.concat(trades);
        } catch { }
    }

    // Sort by time desc
    return allTrades.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function placeOrder(symbol, side, quantity, type = 'market') {
    const exchange = getExchange();
    if (!exchange) return { id: 'mock-' + Date.now(), price: 95000, status: 'closed' };
    return await exchange.createOrder(symbol, type, side, quantity);
}

export async function closePosition(symbol, side, quantity) {
    const closeSide = side === 'buy' ? 'sell' : 'buy';
    return placeOrder(symbol, closeSide, quantity, 'market');
}

// --- MOCK ---
function getMockCandles() {
    const now = Date.now();
    let price = 97000;
    return Array.from({ length: 100 }, (_, i) => {
        price = price * (1 + (Math.random() - 0.5) * 0.002);
        return { timestamp: now - (99 - i) * 300000, open: price, high: price * 1.001, low: price * 0.999, close: price * (1 + (Math.random() - 0.5) * 0.001), volume: Math.random() * 100 + 50 };
    });
}
function getMockTicker(symbol) {
    return { symbol, last: 97781, bid: 97780, ask: 97782, high: 99000, low: 96000, volume: 3500, change: 1.5, timestamp: Date.now() };
}
