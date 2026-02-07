import { useEffect, useState } from 'react';
import axios from 'axios';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './styles/App.css';
import { PriceChart } from './components/PriceChart';

interface DashboardStats {
    totalEquity: number;
    availableBalance: number;
    openPositions: number;
    dailyPnl: number;
    winRate: string;
    tradingMode: string;
}

interface Trade {
    id: number;
    symbol: string;
    side: string;
    entry_price: string;
    exit_price: string | null;
    quantity: string;
    stop_loss: string;
    take_profit: string;
    realized_pnl: string | null;
    realized_pnl_percent: string | null;
    status: string;
    opened_at: string;
    closed_at: string | null;
    ai_analysis: string | null;
}

interface Signal {
    id: number;
    symbol: string;
    direction: string;
    entry_min: string | null;
    entry_max: string | null;
    stop_loss: string | null;
    take_profit_1: string | null;
    max_risk_percent: string | null;
    rationale: string[];
    generated_at: string;
    ai_confidence: number | null;
    ai_comment: string | null;
}

function App() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [openTrades, setOpenPositions] = useState<Trade[]>([]);
    const [closedTrades, setClosedHistory] = useState<Trade[]>([]);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [allSymbols] = useState([
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
        'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'WIFUSDT', 'BONKUSDT', 'FETUSDT'
    ]);
    const [chartData, setChartData] = useState<Record<string, any[]>>({});
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [marketBrief, setMarketBrief] = useState<string>('');

    useEffect(() => {
        if (import.meta.env.VITE_API_URL) {
            axios.defaults.baseURL = import.meta.env.VITE_API_URL;
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchBrief();
        const interval = setInterval(fetchData, 10000); // Poll other data every 10s

        // WebSocket setup for real-time prices
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.hostname === 'localhost' ? 'localhost:3001' : window.location.host;
        const ws = new WebSocket(`${wsProtocol}//${wsHost}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'PRICE_UPDATE') {
                updateRealtimePrice(data.symbol, data.price);
            }
        };

        ws.onopen = () => console.log('WebSocket Connected');
        ws.onclose = () => console.log('WebSocket Disconnected');

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    const fetchBrief = async () => {
        try {
            const res = await axios.get('/api/market-brief');
            setMarketBrief(res.data.brief);
        } catch (e) {
            console.error(e);
        }
    };

    const updateRealtimePrice = (symbol: string, price: string) => {
        setChartData(prev => {
            const currentData = prev[symbol];
            if (!currentData || currentData.length === 0) return prev;

            const lastCandle = currentData[currentData.length - 1];
            const newPrice = parseFloat(price);

            // Update last candle
            const updatedCandle = {
                ...lastCandle,
                close: newPrice,
                high: Math.max(lastCandle.high, newPrice),
                low: Math.min(lastCandle.low, newPrice),
            };

            const newData = [...currentData.slice(0, -1), updatedCandle];
            return { ...prev, [symbol]: newData };
        });
    };

    const fetchData = async () => {
        try {
            const [statsRes, openRes, closedRes, signalsRes] = await Promise.all([
                axios.get('/api/dashboard/stats'),
                axios.get('/api/trades?status=OPEN'),
                axios.get('/api/trades?status=CLOSED'),
                axios.get('/api/signals?limit=15'),
            ]);

            // Fetch klines for all symbols
            const klinePromises = allSymbols.map(s => axios.get(`/api/klines/${s}?limit=100`));
            const klineResponses = await Promise.all(klinePromises);

            const newChartData: Record<string, any[]> = {};
            allSymbols.forEach((s, i) => {
                newChartData[s] = klineResponses[i].data;
            });

            setStats(statsRes.data);
            setOpenPositions(openRes.data);
            setClosedHistory(closedRes.data);
            setSignals(signalsRes.data);
            setChartData(newChartData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    const handleScanNow = async () => {
        setScanning(true);
        try {
            await axios.post('/api/trading/start');
            setTimeout(fetchData, 2000); // Wait for cycle to complete
        } catch (error) {
            console.error('Error triggering scan:', error);
        } finally {
            setScanning(false);
        }
    };

    if (loading) {
        return (
            <div className="app">
                <div className="loading">
                    <div className="pulse">Loading...</div>
                </div>
            </div>
        );
    }

    const content = (signOut?: () => void) => (
        <div className="app">
            <header className="header">
                <h1 className="logo">
                    <span className="logo-icon">₿</span> Binance Trader
                </h1>
                <div className="header-badge">
                    {signOut && (
                        <button
                            className="badge warning"
                            onClick={signOut}
                            style={{ cursor: 'pointer', border: 'none', marginRight: '10px' }}
                        >
                            Sign Out
                        </button>
                    )}
                    <button
                        className={`badge ${scanning ? 'loading' : 'success'}`}
                        onClick={handleScanNow}
                        disabled={scanning}
                        style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}
                    >
                        {scanning ? 'SCANNING...' : 'SCAN NOW'}
                    </button>
                    <span className={`badge ${stats?.tradingMode === 'paper' ? 'warning' : 'success'}`}>
                        {stats?.tradingMode?.toUpperCase()} MODE
                    </span>
                </div>
            </header>

            <main className="main-content">
                        {/* AI Market Brief */}
                        {marketBrief && (
                            <div className="glass-card fade-in" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                                <div className="stat-label" style={{ marginBottom: '10px' }}>🤖 AI Market Intelligence</div>
                                <p style={{ fontSize: '16px', lineHeight: '1.6' }}>{marketBrief}</p>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="stats-grid">
                            <div className="stat-card fade-in">
                                <div className="stat-label">Total Equity</div>
                                <div className="stat-value">${stats?.totalEquity.toFixed(2)}</div>
                            </div>

                            <div className="stat-card fade-in">
                                <div className="stat-label">Available Balance</div>
                                <div className="stat-value">${stats?.availableBalance.toFixed(2)}</div>
                            </div>

                            <div className="stat-card fade-in">
                                <div className="stat-label">Daily P&L</div>
                                <div className={`stat-value ${stats && stats.dailyPnl >= 0 ? 'profit' : 'loss'}`}>
                                    ${stats?.dailyPnl.toFixed(2)}
                                </div>
                            </div>

                            <div className="stat-card fade-in">
                                <div className="stat-label">Win Rate</div>
                                <div className="stat-value">{stats?.winRate}%</div>
                            </div>

                            <div className="stat-card fade-in">
                                <div className="stat-label">Open Positions</div>
                                <div className="stat-value">{stats?.openPositions}</div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <section className="section">
                            <h2 className="section-title">Market Analysis</h2>
                            <div className="charts-container" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                                gap: '20px'
                            }}>
                                {allSymbols.map(symbol => (
                                    chartData[symbol] && <PriceChart key={symbol} symbol={symbol} data={chartData[symbol]} />
                                ))}
                            </div>
                        </section>

                        {/* Recent Signals */}
                        <section className="section">
                            <h2 className="section-title">Recent Signals</h2>
                            <div className="signals-grid">
                                {signals.map((signal) => (
                                    <div key={signal.id} className="glass-card signal-card fade-in">
                                        <div className="signal-header">
                                            <h3 className="signal-symbol">{signal.symbol}</h3>
                                            <span className={`badge ${signal.direction === 'LONG' ? 'success' : (signal.direction === 'SHORT' ? 'danger' : 'neutral')}`}>
                                                {signal.direction}
                                            </span>
                                        </div>

                                        {signal.ai_confidence && (
                                            <div className="signal-details" style={{ borderLeft: `4px solid ${signal.ai_confidence > 75 ? 'var(--profit-green)' : 'var(--warning-yellow)'}` }}>
                                                <div className="signal-row">
                                                    <span className="text-muted">🤖 AI Confidence:</span>
                                                    <span className={signal.ai_confidence > 75 ? 'text-profit' : 'text-warning'}>{signal.ai_confidence}%</span>
                                                </div>
                                                <div className="text-secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                                                    "{signal.ai_comment}"
                                                </div>
                                            </div>
                                        )}

                                        {signal.direction === 'LONG' && (
                                            <div className="signal-details">
                                                <div className="signal-row">
                                                    <span className="text-muted">Entry:</span>
                                                    <span>${parseFloat(signal.entry_max || '0').toFixed(2)}</span>
                                                </div>
                                                <div className="signal-row">
                                                    <span className="text-muted">Stop Loss:</span>
                                                    <span className="text-loss">${parseFloat(signal.stop_loss || '0').toFixed(2)}</span>
                                                </div>
                                                <div className="signal-row">
                                                    <span className="text-muted">Take Profit:</span>
                                                    <span className="text-profit">${parseFloat(signal.take_profit_1 || '0').toFixed(2)}</span>
                                                </div>
                                                <div className="signal-row">
                                                    <span className="text-muted">Max Risk:</span>
                                                    <span>{signal.max_risk_percent}%</span>
                                                </div>
                                            </div>
                                        )}

                                        {signal.direction === 'SHORT' && (
                                            <div className="signal-details">
                                                <div className="signal-row">
                                                    <span className="text-muted">Entry:</span>
                                                    <span>${parseFloat(signal.entry_min || '0').toFixed(2)}</span>
                                                </div>
                                                <div className="signal-row">
                                                    <span className="text-muted">Stop Loss:</span>
                                                    <span className="text-profit">${parseFloat(signal.stop_loss || '0').toFixed(2)}</span>
                                                </div>
                                                <div className="signal-row">
                                                    <span className="text-muted">Take Profit:</span>
                                                    <span className="text-loss">${parseFloat(signal.take_profit_1 || '0').toFixed(2)}</span>
                                                </div>
                                                <div className="signal-row">
                                                    <span className="text-muted">Max Risk:</span>
                                                    <span>{signal.max_risk_percent}%</span>
                                                </div>
                                            </div>
                                        )}


                                        <div className="signal-rationale">
                                            <div className="text-muted" style={{ fontSize: '12px', marginBottom: '8px' }}>Rationale:</div>
                                            <ul style={{ paddingLeft: '20px', fontSize: '13px' }}>
                                                {(typeof signal.rationale === 'string' ? JSON.parse(signal.rationale) : signal.rationale).map((reason: string, i: number) => (
                                                    <li key={i} className="text-secondary">{reason}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="signal-time text-muted">
                                            {new Date(signal.generated_at).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Open Positions */}
                        <section className="section">
                            <h2 className="section-title">Open Positions</h2>
                            {openTrades.length === 0 ? (
                                <div className="glass-card">
                                    <p className="text-muted">No open positions</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="glass-table">
                                        <thead>
                                            <tr>
                                                <th>Symbol</th>
                                                <th>Side</th>
                                                <th>Entry Price</th>
                                                <th>Quantity</th>
                                                <th>Stop Loss</th>
                                                <th>Take Profit</th>
                                                <th>Opened At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {openTrades.map((trade) => (
                                                <tr key={trade.id}>
                                                    <td><strong>{trade.symbol}</strong></td>
                                                    <td>
                                                        <span className={`badge ${trade.side === 'BUY' ? 'success' : 'danger'}`}>
                                                            {trade.side}
                                                        </span>
                                                    </td>
                                                    <td>${parseFloat(trade.entry_price).toFixed(2)}</td>
                                                    <td>{parseFloat(trade.quantity).toFixed(6)}</td>
                                                    <td className={trade.side === 'BUY' ? 'text-loss' : 'text-profit'}>${parseFloat(trade.stop_loss).toFixed(2)}</td>
                                                    <td className={trade.side === 'BUY' ? 'text-profit' : 'text-loss'}>${parseFloat(trade.take_profit).toFixed(2)}</td>
                                                    <td className="text-muted">{new Date(trade.opened_at).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        {/* Trade History */}
                        <section className="section">
                            <h2 className="section-title">Trade History</h2>
                            {closedTrades.length === 0 ? (
                                <div className="glass-card">
                                    <p className="text-muted">No trade history yet</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="glass-table">
                                        <thead>
                                            <tr>
                                                <th>Symbol</th>
                                                <th>Entry/Exit</th>
                                                <th>PnL ($ / %)</th>
                                                <th>AI Analysis</th>
                                                <th>Status</th>
                                                <th>Closed At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {closedTrades.map((trade) => (
                                                <tr key={trade.id}>
                                                    <td><strong>{trade.symbol}</strong></td>
                                                    <td>
                                                        <div>${parseFloat(trade.entry_price).toFixed(2)}</div>
                                                        <div className="text-muted" style={{ fontSize: '14px' }}>${parseFloat(trade.exit_price || '0').toFixed(2)}</div>
                                                    </td>
                                                    <td>
                                                        <div className={parseFloat(trade.realized_pnl || '0') >= 0 ? 'text-profit' : 'text-loss'}>
                                                            {parseFloat(trade.realized_pnl || '0') >= 0 ? '+' : ''}${parseFloat(trade.realized_pnl || '0').toFixed(2)}
                                                        </div>
                                                        <div className={parseFloat(trade.realized_pnl_percent || '0') >= 0 ? 'text-profit' : 'text-loss'} style={{ fontSize: '12px' }}>
                                                            {parseFloat(trade.realized_pnl_percent || '0') >= 0 ? '+' : ''}{parseFloat(trade.realized_pnl_percent || '0').toFixed(2)}%
                                                        </div>
                                                    </td>
                                                    <td style={{ maxWidth: '300px', fontSize: '13px' }}>
                                                        {trade.ai_analysis || <span className="text-muted">No analysis</span>}
                                                    </td>
                                                    <td>
                                                        <span className="badge neutral">{trade.status}</span>
                                                    </td>
                                                    <td className="text-muted">{new Date(trade.closed_at || '').toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </main>
                </div>
    );

    return (
        <Authenticator>
            {({ signOut }) => content(signOut)}
        </Authenticator>
    );
}

export default App;
