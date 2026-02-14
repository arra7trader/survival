import ccxt from 'ccxt';

let exchangeInstance = null;

function getExchange() {
    if (exchangeInstance) return exchangeInstance;

    const apiKey = process.env.BINANCE_API_KEY;
    const secret = process.env.BINANCE_SECRET;

    if (!apiKey || !secret) {
        return null;
    }

    exchangeInstance = new ccxt.binance({
        apiKey,
        secret,
        enableRateLimit: true,
        options: {
            defaultType: 'spot',
            adjustForTimeDifference: true,
        },
    });

    return exchangeInstance;
}

// Fetch OHLCV candles
export async function fetchCandles(symbol = 'BTC/USDT', timeframe = '5m', limit = 100) {
    const exchange = getExchange();
    if (!exchange) return getMockCandles();

    try {
        const candles = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        return candles.map(c => ({
            timestamp: c[0],
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5],
        }));
    } catch (err) {
        console.error('fetchCandles error:', err.message);
        return getMockCandles();
    }
}

// Fetch current ticker (price)
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
    } catch (err) {
        console.error('fetchTicker error:', err.message);
        return getMockTicker(symbol);
    }
}

// Get account balance
export async function fetchBalance() {
    const exchange = getExchange();
    if (!exchange) return { total: 20, free: 20, used: 0, assets: { USDT: { free: 20, used: 0 } } };

    try {
        const balance = await exchange.fetchBalance();
        const total = balance.total?.USDT || 0;
        const free = balance.free?.USDT || 0;
        const used = balance.used?.USDT || 0;

        const assets = {};
        for (const [currency, amounts] of Object.entries(balance.total || {})) {
            if (amounts > 0) {
                assets[currency] = {
                    free: balance.free?.[currency] || 0,
                    used: balance.used?.[currency] || 0,
                    total: amounts,
                };
            }
        }

        return { total, free, used, assets };
    } catch (err) {
        console.error('fetchBalance error:', err.message);
        return { total: 0, free: 0, used: 0, assets: {} };
    }
}

// Place a market order
export async function placeOrder(symbol, side, amount) {
    const exchange = getExchange();
    if (!exchange) {
        console.log(`[MOCK] ${side} ${amount} ${symbol}`);
        return { id: 'mock-' + Date.now(), symbol, side, amount, price: 0, status: 'mock' };
    }

    try {
        const order = await exchange.createMarketOrder(symbol, side, amount);
        return {
            id: order.id,
            symbol: order.symbol,
            side: order.side,
            amount: order.filled || order.amount,
            price: order.average || order.price,
            cost: order.cost,
            status: order.status,
        };
    } catch (err) {
        console.error('placeOrder error:', err.message);
        throw err;
    }
}

// Close a position (sell what we bought)
export async function closePosition(symbol, side, amount) {
    const closeSide = side === 'buy' ? 'sell' : 'buy';
    return placeOrder(symbol, closeSide, amount);
}

// Check if exchange is connected
export async function isExchangeConnected() {
    const exchange = getExchange();
    if (!exchange) return false;

    try {
        await exchange.fetchBalance();
        return true;
    } catch {
        return false;
    }
}

// Mock data for development (no API keys)
function getMockCandles() {
    const now = Date.now();
    const candles = [];
    let price = 95000 + Math.random() * 2000;

    for (let i = 99; i >= 0; i--) {
        const open = price;
        const change = (Math.random() - 0.48) * 200;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 100;
        const low = Math.min(open, close) - Math.random() * 100;
        const volume = 50 + Math.random() * 200;

        candles.push({
            timestamp: now - i * 5 * 60 * 1000,
            open, high, low, close, volume,
        });
        price = close;
    }
    return candles;
}

function getMockTicker(symbol) {
    const base = symbol.includes('BTC') ? 95000 + Math.random() * 3000 : 3200 + Math.random() * 100;
    return {
        symbol,
        last: base,
        bid: base - 1,
        ask: base + 1,
        high: base * 1.02,
        low: base * 0.98,
        volume: 1000 + Math.random() * 5000,
        change: (Math.random() - 0.5) * 4,
        timestamp: Date.now(),
    };
}
