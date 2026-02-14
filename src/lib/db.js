import initSqlJs from 'sql.js';

let dbInstance = null;

// IN-MEMORY DATABASE (Stateless)
// Re-initialized cleanly on every serverless function cold start.
// This prevents read-only filesystem errors on Vercel.
// We rely on 'sync.js' to populate it from Exchange Data at runtime.

export async function getDb() {
    if (dbInstance) return dbInstance;

    // Initialize SQL.js in memory
    const SQL = await initSqlJs();
    dbInstance = new SQL.Database(); // No file buffer = in-memory only

    initTables(dbInstance);
    return dbInstance;
}

function saveDb(db) {
    // No-op for in-memory DB. 
    // We cannot save to disk on Vercel.
}

function initTables(db) {
    db.run(`CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
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
    value TEXT
  )`);

    // Default settings
    const defaults = {
        max_position_pct: '30',
        stop_loss_pct: '2',
        take_profit_pct: '4',
        min_confluence: '3',
        emergency_floor: '10',
        trading_pairs: 'BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT,DOGE/USDT',
        trading_enabled: 'true',
        initial_budget: '20'
    };

    for (const [key, value] of Object.entries(defaults)) {
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    }
}

export async function dbRun(sql, params = []) {
    const db = await getDb();
    db.run(sql, params);
}

export async function dbGet(sql, params = []) {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let row = null;
    if (stmt.step()) row = stmt.getAsObject();
    stmt.free();
    return row;
}

export async function dbAll(sql, params = []) {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

export async function getSetting(key) {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
    return row?.value || null;
}

export async function setSetting(key, value) {
    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(value)]);
}
