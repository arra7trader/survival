'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TradesPage() {
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetch('/api/trading/history')
            .then(r => r.json())
            .then(d => { setTrades(d.trades || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = filter === 'all' ? trades
        : filter === 'win' ? trades.filter(t => t.pnl > 0)
            : filter === 'loss' ? trades.filter(t => t.pnl < 0)
                : trades.filter(t => t.status === 'open');

    const totalPnl = trades.filter(t => t.status === 'closed').reduce((s, t) => s + (t.pnl || 0), 0);
    const winCount = trades.filter(t => t.pnl > 0).length;
    const lossCount = trades.filter(t => t.pnl < 0).length;

    return (
        <>
            <nav className="navbar">
                <div className="container">
                    <Link href="/" className="navbar-brand">
                        <span className="status-dot green"></span>
                        SURVIVAL MODE
                    </Link>
                    <ul className="nav-links">
                        <li><Link href="/">Dashboard</Link></li>
                        <li><Link href="/trades" className="active">Trades</Link></li>
                        <li><Link href="/analysis">Analysis</Link></li>
                        <li><Link href="/settings">Settings</Link></li>
                    </ul>
                </div>
            </nav>

            <div className="page">
                <div className="page-header">
                    <h1>Trade History</h1>
                    <p>All executed trades with P&L tracking</p>
                </div>

                <div className="grid-4" style={{ marginBottom: 16 }}>
                    <div className="card stat-card">
                        <div className="stat-label">Total Trades</div>
                        <div className="stat-value">{trades.length}</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-label">Total P&L</div>
                        <div className={`stat-value ${totalPnl >= 0 ? 'green' : 'red'}`}>${totalPnl.toFixed(2)}</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-label">Wins</div>
                        <div className="stat-value green">{winCount}</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-label">Losses</div>
                        <div className="stat-value red">{lossCount}</div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span>Trades ({filtered.length})</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {['all', 'open', 'win', 'loss'].map(f => (
                                <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Symbol</th>
                                    <th>Side</th>
                                    <th>Entry</th>
                                    <th>Exit</th>
                                    <th>Qty</th>
                                    <th>SL / TP</th>
                                    <th>P&L</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No trades found</td></tr>
                                ) : filtered.map(t => (
                                    <tr key={t.id}>
                                        <td style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem' }}>
                                            {t.opened_at ? new Date(t.opened_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                                        <td><span className={`badge ${t.side === 'buy' ? 'badge-green' : 'badge-red'}`}>{t.side?.toUpperCase()}</span></td>
                                        <td>${t.entry_price?.toFixed(2)}</td>
                                        <td>{t.exit_price ? `$${t.exit_price.toFixed(2)}` : '—'}</td>
                                        <td>{t.quantity?.toFixed(5)}</td>
                                        <td style={{ fontSize: '0.7rem' }}>${t.stop_loss?.toFixed(0)} / ${t.take_profit?.toFixed(0)}</td>
                                        <td className={t.pnl >= 0 ? 'td-green' : 'td-red'} style={{ fontWeight: 700 }}>
                                            {t.status === 'open' ? '—' : `${t.pnl >= 0 ? '+' : ''}$${t.pnl?.toFixed(2)}`}
                                        </td>
                                        <td>
                                            <span className={`badge ${t.status === 'open' ? 'badge-cyan' : t.pnl >= 0 ? 'badge-green' : 'badge-red'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
