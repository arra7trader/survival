import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'survival.db');
let dbInstance = null;

async function getDb() {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        dbInstance = new SQL.Database(buffer);
    } else {
        dbInstance = new SQL.Database();
    }

    initTables(dbInstance);
    return dbInstance;
}

function saveDb(db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, buffer);
}

function initTables(db) {
    db.run(`CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    type TEXT DEFAULT 'market',
    entry_price REAL,
    exit_price REAL,
    quantity REAL,
    stop_loss REAL,
    take_profit REAL,
    pnl REAL DEFAULT 0,
    pnl_percent REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    signals TEXT,
    ai_analysis TEXT,
    confidence REAL DEFAULT 0,
    opened_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL,
    confidence REAL DEFAULT 0,
    indicators TEXT,
    ai_reasoning TEXT,
    action_taken TEXT DEFAULT 'hold',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_balance REAL,
    available_balance REAL,
    unrealized_pnl REAL DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    win_rate REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS health_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT DEFAULT 'healthy',
    exchange_connected INTEGER DEFAULT 0,
    ai_connected INTEGER DEFAULT 0,
    balance REAL DEFAULT 0,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

    // Default settings
    const defaults = {
        max_position_pct: '30',
        stop_loss_pct: '2',
        take_profit_pct: '4',
        max_daily_loss_pct: '5',
        max_open_positions: '2',
        min_confluence: '3',
        emergency_floor: '10',
        trading_pairs: 'BTC/USDT,ETH/USDT',
        trading_enabled: 'true',
        initial_budget: '20'
    };

    for (const [key, value] of Object.entries(defaults)) {
        const existing = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
        if (existing.length === 0) {
            db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
        }
    }

    saveDb(db);
}

export async function dbRun(sql, params = []) {
    const db = await getDb();
    db.run(sql, params);
    saveDb(db);
}

export async function dbGet(sql, params = []) {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let row = null;
    if (stmt.step()) {
        row = stmt.getAsObject();
    }
    stmt.free();
    return row;
}

export async function dbAll(sql, params = []) {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

export async function getSetting(key) {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value || null;
}

export async function setSetting(key, value) {
    await dbRun(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`, [key, String(value)]);
}
