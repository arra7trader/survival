import ccxt from 'ccxt';

let exchangeInstance = null;

function getExchange() {
    if (exchangeInstance) return exchangeInstance;

    // Check which keys are available
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
        console.log('🔌 Connecting to Bitget...');
    } else if (binanceKey && process.env.BINANCE_SECRET) {
        exchangeId = 'binance';
        config.apiKey = binanceKey;
        config.secret = process.env.BINANCE_SECRET;
        console.log('🔌 Connecting to Binance...');
    } else {
        // No keys found — return null so we use mock data
        console.log('⚠️ No API keys found for Binance or Bitget. Using mock data.');
        return null;
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

// ... existing functions (fetchCandles, fetchTicker, etc.) remain the same
// but we need to ensure they use getExchange() correctly

export async function fetchCandles(symbol = 'BTC/USDT', timeframe = '5m', limit = 100) {
    const exchange = getExchange();
    if (!exchange) return getMockCandles();

    try {
        // Bitget uses standard symbol format like BTC/USDT but handle potential differences if needed
        const candles = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        return candles.map(c => ({
            timestamp: c[0],
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5],
        }));
    } catch (error) {
        console.error('Error fetching candles:', error.message);
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
    } catch (error) {
        console.error('Error fetching ticker:', error.message);
        return getMockTicker(symbol);
    }
}

export async function fetchBalance() {
    const exchange = getExchange();
    if (!exchange) return { total: 20, free: 20, used: 0 };

    try {
        const balance = await exchange.fetchBalance();
        return {
            total: balance.total['USDT'] || 0,
            free: balance.free['USDT'] || 0,
            used: balance.used['USDT'] || 0,
        };
    } catch (error) {
        console.error('Error fetching balance:', error.message);
        throw error;
    }
}

export async function placeOrder(symbol, side, quantity, type = 'market') {
    const exchange = getExchange();
    if (!exchange) return { id: 'mock-' + Date.now(), price: 95000, status: 'closed' };

    try {
        const order = await exchange.createOrder(symbol, type, side, quantity);
        return order;
    } catch (error) {
        console.error(`Error placing ${side} order:`, error.message);
        throw error;
    }
}

export async function closePosition(symbol, side, quantity) {
    // If we bought (long), we sell to close. If we sold (short), we buy to close.
    const closeSide = side === 'buy' ? 'sell' : 'buy';
    return placeOrder(symbol, closeSide, quantity, 'market');
}

export async function isExchangeConnected() {
    const exchange = getExchange();
    if (!exchange) return false;
    try {
        // Lightweight check
        await exchange.fetchTime();
        return true;
    } catch {
        return false;
    }
}

// --- MOCK DATA FALLBACKS ---
function getMockCandles() {
    const now = Date.now();
    let price = 97000;
    return Array.from({ length: 100 }, (_, i) => {
        price = price * (1 + (Math.random() - 0.5) * 0.002);
        return {
            timestamp: now - (99 - i) * 300000,
            open: price,
            high: price * 1.001,
            low: price * 0.999,
            close: price * (1 + (Math.random() - 0.5) * 0.001),
            volume: Math.random() * 100 + 50,
        };
    });
}

function getMockTicker(symbol) {
    return {
        symbol,
        last: 97781 + Math.random() * 100,
        bid: 97780,
        ask: 97782,
        high: 99000,
        low: 96000,
        volume: 3500,
        change: 1.5,
        timestamp: Date.now(),
    };
}
