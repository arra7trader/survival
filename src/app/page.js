'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// Simple SVG equity chart
function EquityChart({ data }) {
    if (!data || data.length < 2) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📈</div>
                <p style={{ fontSize: '0.85rem' }}>Chart will appear after trades are executed</p>
                <div style={{ marginTop: 16, height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
                    {[20, 20, 20, 20, 20].map((v, i) => (
                        <div key={i} style={{ width: 40, height: 60, background: 'var(--bg-hover)', borderRadius: '4px 4px 0 0', opacity: 0.3 + i * 0.15 }}></div>
                    ))}
                </div>
                <p style={{ fontSize: '0.7rem', marginTop: 8, color: 'var(--text-muted)' }}>Starting balance: $20.00</p>
            </div>
        );
    }

    const balances = data.map(d => d.balance);
    const min = Math.min(...balances) * 0.98;
    const max = Math.max(...balances) * 1.02;
    const range = max - min || 1;
    const W = 600;
    const H = 200;
    const padX = 0;
    const padY = 10;

    const points = data.map((d, i) => {
        const x = padX + (i / (data.length - 1)) * (W - padX * 2);
        const y = padY + (1 - (d.balance - min) / range) * (H - padY * 2);
        return `${x},${y}`;
    }).join(' ');

    const lastBalance = balances[balances.length - 1];
    const firstBalance = balances[0];
    const isUp = lastBalance >= firstBalance;
    const color = isUp ? '#22c55e' : '#ef4444';
    const gradientId = 'eq-grad';

    // Fill area
    const fillPoints = `${padX},${H - padY} ${points} ${W - padX},${H - padY}`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <polygon points={fillPoints} fill={`url(#${gradientId})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Dot on last point */}
            {data.length > 0 && (() => {
                const lastX = padX + ((data.length - 1) / (data.length - 1)) * (W - padX * 2);
                const lastY = padY + (1 - (lastBalance - min) / range) * (H - padY * 2);
                return <circle cx={lastX} cy={lastY} r="4" fill={color} />;
            })()}
            {/* Start line */}
            {(() => {
                const startY = padY + (1 - (firstBalance - min) / range) * (H - padY * 2);
                return <line x1={padX} y1={startY} x2={W - padX} y2={startY} stroke="var(--border-light)" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />;
            })()}
        </svg>
    );
}

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [health, setHealth] = useState(null);
    const [chart, setChart] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        try {
            const [statusRes, healthRes, chartRes] = await Promise.all([
                fetch('/api/trading/status'),
                fetch('/api/health'),
                fetch('/api/trading/chart'),
            ]);
            setData(await statusRes.json());
            setHealth(await healthRes.json());
            setChart(await chartRes.json());
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 30000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const p = data?.portfolio;
    const stats = p?.stats;
    const balance = p?.balance;
    const totalPnl = parseFloat(stats?.totalPnl || 0);
    const initialBudget = 20;
    const roi = initialBudget > 0 ? ((totalPnl / initialBudget) * 100) : 0;
    const isAlive = health?.status === 'healthy' || health?.status === 'warning';

    return (
        <>
            <nav className="navbar">
                <div className="container">
                    <div className="navbar-brand">
                        <span className={`status-dot ${isAlive ? 'green' : health?.status === 'warning' ? 'amber' : 'red'}`}></span>
                        SURVIVAL MODE
                    </div>
                    <ul className="nav-links">
                        <li><Link href="/" className="active">Home</Link></li>
                        <li><Link href="/trades">History</Link></li>
                        <li><Link href="/analysis">Brain</Link></li>
                        <li><Link href="/settings">System</Link></li>
                    </ul>
                </div>
            </nav>

            <div className="page">
                {/* Hero: Total Earnings */}
                <div style={{
                    textAlign: 'center', padding: '40px 20px 24px',
                    background: 'linear-gradient(180deg, rgba(6,182,212,0.06) 0%, transparent 100%)',
                    borderRadius: 16, marginBottom: 20,
                    border: '1px solid var(--border)',
                }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                        Your Earnings
                    </div>
                    <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '3.5rem', fontWeight: 800,
                        color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                        lineHeight: 1.1,
                    }}>
                        {loading ? '...' : `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: 'var(--text-muted)', marginTop: 8 }}>
                        {loading ? '' : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}% ROI`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12 }}>
                        Started with $20 • {stats?.totalTrades || 0} trades executed
                    </div>
                </div>

                {/* Equity Chart */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <span>💰 Balance History</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)' }}>
                            ${(balance?.total || 20).toFixed(2)}
                        </span>
                    </div>
                    <EquityChart data={chart?.equityCurve || []} />
                    {chart?.equityCurve?.length >= 2 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            <span>{chart.equityCurve[0]?.label || 'Start'}</span>
                            <span>{chart.equityCurve[chart.equityCurve.length - 1]?.label || 'Now'}</span>
                        </div>
                    )}
                </div>

                {/* Key Stats */}
                <div className="grid-4" style={{ marginBottom: 20 }}>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">💰 Balance</div>
                        <div className="stat-value cyan" style={{ fontSize: '1.5rem' }}>
                            {loading ? '...' : `$${(balance?.total || 0).toFixed(2)}`}
                        </div>
                    </div>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">📈 Today</div>
                        <div className={`stat-value ${parseFloat(stats?.todayPnl || 0) >= 0 ? 'green' : 'red'}`} style={{ fontSize: '1.5rem' }}>
                            {loading ? '...' : `${parseFloat(stats?.todayPnl || 0) >= 0 ? '+' : ''}$${stats?.todayPnl || '0.00'}`}
                        </div>
                    </div>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">🏆 Win Rate</div>
                        <div className="stat-value" style={{ fontSize: '1.5rem', color: parseFloat(stats?.winRate || 0) >= 50 ? 'var(--green)' : 'var(--amber)' }}>
                            {loading ? '...' : `${stats?.winRate || '0'}%`}
                        </div>
                        <div className="stat-change">{stats?.winningTrades || 0}W / {stats?.losingTrades || 0}L</div>
                    </div>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">🤖 Status</div>
                        <div style={{
                            fontSize: '1rem', fontWeight: 700, marginTop: 4,
                            color: isAlive ? 'var(--green)' : 'var(--red)',
                        }}>
                            {isAlive ? '● RUNNING' : health?.status === 'offline' ? '○ OFFLINE' : '○ STOPPED'}
                        </div>
                        <div className="stat-change" style={{ color: 'var(--text-muted)' }}>
                            {health?.trading?.openPositions || 0} open trades
                        </div>
                    </div>
                </div>

                {/* Open Positions */}
                {p?.openPositions?.length > 0 && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <span>Live Positions</span>
                            <span className="badge badge-cyan">{p.openPositions.length}</span>
                        </div>
                        {p.openPositions.map(pos => (
                            <div key={pos.id} className={`position-card ${pos.side}`}>
                                <div className="pos-info">
                                    <div className="pos-symbol">
                                        <span className={`badge ${pos.side === 'buy' ? 'badge-green' : 'badge-red'}`}>
                                            {pos.side?.toUpperCase()}
                                        </span>
                                        {' '}{pos.symbol}
                                    </div>
                                    <div className="pos-detail">
                                        Entry: ${pos.entry_price?.toFixed(2)} • Qty: {pos.quantity?.toFixed(5)}
                                    </div>
                                </div>
                                <div className="pos-pnl">
                                    <div className={pos.unrealizedPnl >= 0 ? 'td-green' : 'td-red'} style={{ fontSize: '1.1rem' }}>
                                        {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Recent Activity */}
                <div className="card">
                    <div className="card-header">
                        <span>Recent Activity</span>
                        <Link href="/trades" className="btn btn-ghost btn-sm">See All →</Link>
                    </div>
                    {data?.recentSignals?.length > 0 ? (
                        <div>
                            {data.recentSignals.slice(0, 5).map((sig, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.82rem',
                                }}>
                                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                                        {sig.created_at ? new Date(sig.created_at).toLocaleTimeString() : ''}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{sig.symbol}</span>
                                    <span className={`badge ${sig.direction === 'buy' ? 'badge-green' : sig.direction === 'sell' ? 'badge-red' : 'badge-amber'}`}>
                                        {sig.direction}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flex: 1, marginLeft: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {sig.ai_reasoning || 'Analyzing...'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="icon">🧠</div>
                            <p>AI is warming up. First signals appear after the cron job runs.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
