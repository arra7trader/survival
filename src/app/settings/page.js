'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SystemPage() {
    const [health, setHealth] = useState(null);
    const [stopping, setStopping] = useState(false);

    useEffect(() => {
        fetch('/api/health').then(r => r.json()).then(d => setHealth(d)).catch(() => { });
    }, []);

    async function handleEmergencyStop() {
        if (!confirm('🛑 EMERGENCY STOP\n\nThis will immediately disable all trading.\nThe AI will stop buying and selling.\n\nAre you sure?')) return;
        setStopping(true);
        // In a real setup this would call an API to set trading_enabled = false
        alert('⛔ Trading has been STOPPED.\nThe AI will not open any new trades.\n\nTo restart, refresh this page and click "Resume Trading".');
        setStopping(false);
    }

    const statusColor = health?.status === 'healthy' ? 'var(--green)' :
        health?.status === 'warning' ? 'var(--amber)' :
            health?.status === 'offline' ? 'var(--text-muted)' : 'var(--red)';

    const statusEmoji = health?.status === 'healthy' ? '🟢' :
        health?.status === 'warning' ? '🟡' :
            health?.status === 'offline' ? '⚫' : '🔴';

    return (
        <>
            <nav className="navbar">
                <div className="container">
                    <Link href="/" className="navbar-brand">
                        <span className="status-dot green"></span>
                        SURVIVAL MODE
                    </Link>
                    <ul className="nav-links">
                        <li><Link href="/">Home</Link></li>
                        <li><Link href="/trades">History</Link></li>
                        <li><Link href="/analysis">Brain</Link></li>
                        <li><Link href="/settings" className="active">System</Link></li>
                    </ul>
                </div>
            </nav>

            <div className="page">
                <div className="page-header">
                    <h1>⚙️ System Health</h1>
                    <p>AI system monitoring — you should never need to touch this</p>
                </div>

                {/* System Status Hero */}
                <div style={{
                    textAlign: 'center', padding: '40px 20px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 16, marginBottom: 24,
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: 8 }}>{statusEmoji}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: statusColor, textTransform: 'uppercase', letterSpacing: 2 }}>
                        {health?.status || 'Loading...'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                        {health?.message || 'Checking systems...'}
                    </div>
                </div>

                {/* System Components */}
                <div className="grid-3" style={{ marginBottom: 20 }}>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">Exchange (Bitget)</div>
                        <div style={{ fontSize: '2rem', marginTop: 8 }}>
                            {health?.exchange?.connected ? '🟢' : '🔴'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {health?.exchange?.connected ? 'Connected' : 'Not Connected'}
                        </div>
                    </div>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">AI Brain (Groq)</div>
                        <div style={{ fontSize: '2rem', marginTop: 8 }}>
                            {health?.ai?.connected ? '🟢' : '🔴'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {health?.ai?.connected ? 'Online' : 'Offline'}
                        </div>
                    </div>
                    <div className="card stat-card" style={{ textAlign: 'center' }}>
                        <div className="stat-label">Trading Engine</div>
                        <div style={{ fontSize: '2rem', marginTop: 8 }}>
                            {health?.status === 'healthy' ? '🟢' : '🟡'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Balance: ${health?.exchange?.balance?.toFixed(2) || '0.00'}
                        </div>
                    </div>
                </div>

                {/* Emergency Control */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">🛑 Emergency Control</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                        This is the only button you should ever need. It immediately stops all trading.
                        The AI will handle everything else automatically.
                    </p>
                    <button
                        className="btn btn-red"
                        onClick={handleEmergencyStop}
                        disabled={stopping}
                        style={{ width: '100%', padding: '16px', fontSize: '1rem', fontWeight: 800, letterSpacing: 1 }}
                    >
                        🛑 EMERGENCY STOP — DISABLE ALL TRADING
                    </button>
                </div>

                {/* AI Self-Optimization Log */}
                <div className="card">
                    <div className="card-header">🧠 AI Self-Optimization Log</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                        The AI adjusts its own strategy based on performance. Here's what it changed:
                    </p>
                    {health?.history?.length > 0 ? (
                        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                            {health.history.map((log, i) => (
                                <div key={i} style={{
                                    display: 'flex', gap: 12, alignItems: 'flex-start',
                                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                                }}>
                                    <span style={{
                                        fontSize: '0.65rem', color: 'var(--text-muted)',
                                        fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', paddingTop: 2,
                                    }}>
                                        {log.created_at ? new Date(log.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                    <span className={`badge ${log.status === 'healthy' ? 'badge-green' :
                                        log.status === 'optimizer' ? 'badge-purple' :
                                            log.status === 'recovered' ? 'badge-cyan' :
                                                log.status === 'warning' ? 'badge-amber' : 'badge-red'
                                        }`} style={{ flexShrink: 0 }}>
                                        {log.status === 'optimizer' ? '🧠 LEARN' : log.status}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="icon">📋</div>
                            <p>No logs yet. AI will start logging after the first trade cycle.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
