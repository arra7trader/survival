'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BrainPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [symbol, setSymbol] = useState('BTC/USDT');

    async function fetchAnalysis() {
        setLoading(true);
        try {
            const res = await fetch(`/api/market/analysis?symbol=${encodeURIComponent(symbol)}`);
            setData(await res.json());
        } catch { } finally { setLoading(false); }
    }

    useEffect(() => { fetchAnalysis(); }, [symbol]);

    const a = data?.analysis;
    const decision = a?.decision;
    const ai = a?.ai;
    const signals = a?.signals || [];

    // Translate direction to plain language
    function translateDecision(action) {
        if (action === 'buy') return { text: 'BUYING', emoji: '🟢', desc: 'AI sees a good opportunity to buy' };
        if (action === 'sell') return { text: 'SELLING', emoji: '🔴', desc: 'AI is closing/selling to protect profits' };
        return { text: 'WAITING', emoji: '⏸️', desc: 'AI sees no clear opportunity right now. Protecting your money.' };
    }

    const d = translateDecision(decision?.action);
    const confidence = decision?.confidence || 0;

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
                        <li><Link href="/analysis" className="active">Brain</Link></li>
                        <li><Link href="/settings">System</Link></li>
                    </ul>
                    <div className="nav-right">
                        <select className="select" value={symbol} onChange={e => setSymbol(e.target.value)}>
                            {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOGE/USDT',
                                'SHIB/USDT', 'PEPE/USDT', 'WIF/USDT', 'BONK/USDT', 'LINK/USDT', 'RENDER/USDT', 'FET/USDT',
                                'NEAR/USDT', 'SUI/USDT', 'APT/USDT', 'LTC/USDT', 'BCH/USDT', 'FIL/USDT', 'ARB/USDT', 'OP/USDT',
                                'TIA/USDT', 'INJ/USDT', 'RUNE/USDT', 'DOT/USDT', 'MATIC/USDT', 'UNI/USDT', 'STX/USDT'
                            ].map(pair => (
                                <option key={pair} value={pair}>{pair}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </nav>

            <div className="page">
                <div className="page-header">
                    <h1>🧠 AI Brain Activity</h1>
                    <p>What the AI is thinking right now</p>
                </div>

                {/* Current Decision */}
                <div className={`decision-box ${decision?.action || 'hold'}`} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 4 }}>{d.emoji}</div>
                    <div className={`decision-action ${decision?.action || 'hold'}`}>{d.text}</div>
                    <div className="decision-reason">{d.desc}</div>
                    {decision && (
                        <div style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {decision.votes?.buy || 0} indicators say buy • {decision.votes?.sell || 0} say sell • {decision.votes?.neutral || 0} neutral
                        </div>
                    )}
                </div>

                <div className="grid-2">
                    {/* AI Thinking */}
                    <div className="card">
                        <div className="card-header">
                            <span>🤖 What AI Sees</span>
                            <span className={`badge ${ai?.direction === 'buy' ? 'badge-green' : ai?.direction === 'sell' ? 'badge-red' : 'badge-amber'}`}>
                                {ai?.direction?.toUpperCase() || 'ANALYZING'}
                            </span>
                        </div>

                        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                            <div className="stat-label">Confidence</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                <div style={{ flex: 1, height: 10, background: 'var(--bg-hover)', borderRadius: 5, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 5, transition: 'width 0.5s',
                                        width: `${(ai?.confidence || 0) * 100}%`,
                                        background: (ai?.confidence || 0) > 0.7 ? 'var(--green)' : (ai?.confidence || 0) > 0.4 ? 'var(--amber)' : 'var(--red)',
                                    }}></div>
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem' }}>
                                    {((ai?.confidence || 0) * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>

                        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                            <div className="stat-label">AI's Reasoning</div>
                            <p style={{ marginTop: 8, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                                {ai?.reasoning || 'AI is analyzing the market...'}
                            </p>
                        </div>

                        {ai?.patterns?.length > 0 && (
                            <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
                                <div className="stat-label">Patterns Found</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                    {ai.patterns.map((p, i) => (
                                        <span key={i} className="badge badge-purple">{p}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Indicator Votes */}
                    <div className="card">
                        <div className="card-header">
                            <span>📊 Indicator Votes</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)' }}>
                                ${a?.indicators?.price?.toFixed(2) || '—'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                            Each indicator votes BUY, SELL, or NEUTRAL. AI needs {decision?.votes?.total ? `${Math.ceil(decision.votes.total * 0.5)}}` : '3'} agreements to act.
                        </p>
                        {signals.map((sig, i) => (
                            <div key={i} className="signal-row">
                                <span className="signal-name">{sig.name}</span>
                                <span className={`signal-dir ${sig.direction}`}>
                                    {sig.direction === 'buy' ? '🟢' : sig.direction === 'sell' ? '🔴' : '⚪'} {sig.direction}
                                </span>
                                <div className="signal-bar">
                                    <div className={`signal-bar-fill ${sig.direction}`} style={{ width: `${(sig.strength || 0) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
