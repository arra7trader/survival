'use client';
import { useState, useEffect } from 'react';

export default function DebugPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const addLog = (msg, data = null) => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, data }]);
    };

    useEffect(() => {
        async function runDiagnostics() {
            addLog('Starting Diagnostics...');

            // 1. Check Health
            try {
                addLog('Fetching /api/health...');
                const health = await fetch('/api/health').then(r => r.json());
                addLog('Health Response:', health);
            } catch (e) {
                addLog('Health Failed:', e.toString());
            }

            // 2. Check Trading Status
            try {
                addLog('Fetching /api/trading/status...');
                const status = await fetch('/api/trading/status').then(r => r.json());
                addLog('Trading Status:', status);
            } catch (e) {
                addLog('Trading Status Failed:', e.toString());
            }

            // 3. Check Debug Balance (The Source of Truth)
            try {
                addLog('Fetching /api/debug/balance...');
                const debugParams = { cache: 'no-store' }; // Force fresh
                const balance = await fetch('/api/debug/balance', debugParams).then(r => r.json());
                addLog('Debug Balance Response (RAW BITGET):', balance);
            } catch (e) {
                addLog('Debug Balance Failed:', e.toString());
            }

            setLoading(false);
        }

        runDiagnostics();
    }, []);

    return (
        <div style={{ padding: 20, fontFamily: 'monospace', background: '#000', color: '#0f0', minHeight: '100vh' }}>
            <h1>🕵️‍♂️ SYSTEM DIAGNOSTICS</h1>
            <p>Give this screenshot to the developer if something is red.</p>
            <hr style={{ borderColor: '#333' }} />

            {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 16, borderBottom: '1px solid #111', paddingBottom: 8 }}>
                    <span style={{ color: '#666' }}>[{log.time}]</span>{' '}
                    <strong style={{ color: '#fff' }}>{log.msg}</strong>
                    {log.data && (
                        <pre style={{
                            background: '#111', color: '#bbb', padding: 10, marginTop: 4,
                            borderRadius: 4, overflowX: 'auto', fontSize: '0.8rem'
                        }}>
                            {JSON.stringify(log.data, null, 2)}
                        </pre>
                    )}
                </div>
            ))}

            {loading && <div>Running tests...</div>}
        </div>
    );
}
