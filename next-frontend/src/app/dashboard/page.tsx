"use client";

import { useEffect, useState } from "react";
import {
  fetchClosedTrades,
  fetchDashboardStats,
  fetchMarketBrief,
  fetchOpenTrades,
  fetchSignals,
  fetchKlines,
  startTrading,
  stopTrading,
  fetchTradingConfig,
  updateTradingConfig,
  closeTrade,
} from "@/lib/api";
import { PriceChart } from "@/components/PriceChart";

interface DashboardStats {
  totalEquity: number;
  availableBalance: number;
  openPositions: number;
  dailyPnl: number;
  winRate: string;
  tradingMode: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  stop_loss: number;
  take_profit: number;
  realized_pnl: number | null;
  realized_pnl_percent: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  ai_analysis: string | null;
}

interface Signal {
  id: string;
  symbol: string;
  direction: string;
  entry_min: number | null;
  entry_max: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  max_risk_percent: number | null;
  rationale: string[];
  generated_at: string;
  ai_confidence: number | null;
  ai_comment: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [openTrades, setOpenPositions] = useState<Trade[]>([]);
  const [closedTrades, setClosedHistory] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [chartData, setChartData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [tradingConfig, setTradingConfig] = useState<{ cadence: string; enabled: boolean } | null>(null);
  const [marketBrief, setMarketBrief] = useState<string>("");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTCUSDT");

  useEffect(() => {
    loadData();
    
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, openRes, closedRes, signalsRes, configRes, briefRes] = await Promise.all([
        fetchDashboardStats(),
        fetchOpenTrades(),
        fetchClosedTrades(),
        fetchSignals(),
        fetchTradingConfig(),
        fetchMarketBrief()
      ]);

      setStats(statsRes.data);
      setOpenPositions(openRes.data || []);
      setClosedHistory(closedRes.data || []);
      setSignals(signalsRes.data?.slice(0, 10) || []);
      setTradingConfig(configRes.data);
      setMarketBrief(briefRes.data?.brief || "");
      
      if (!chartData[selectedSymbol]) {
        const klinesRes = await fetchKlines(selectedSymbol);
        setChartData(prev => ({ ...prev, [selectedSymbol]: klinesRes.data || [] }));
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (next: { cadence?: string; enabled?: boolean }) => {
    try {
      const res = await updateTradingConfig(next as any);
      if (res.data) {
        setTradingConfig({
          cadence: res.data.cadence,
          enabled: res.data.enabled
        });
        
        if (next.enabled === true) {
          await startTrading();
        } else if (next.enabled === false) {
          await stopTrading();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    if (!confirm("Are you sure you want to close this position?")) return;
    try {
      await closeTrade(tradeId);
      const [openRes, closedRes, statsRes] = await Promise.all([
        fetchOpenTrades(),
        fetchClosedTrades(),
        fetchDashboardStats()
      ]);
      setOpenPositions(openRes.data || []);
      setClosedHistory(closedRes.data || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Failed to close trade:', e);
      alert('Failed to close trade. See console for details.');
    }
  };

  const handleSymbolChange = async (symbol: string) => {
    setSelectedSymbol(symbol);
    if (!chartData[symbol]) {
      const klinesRes = await fetchKlines(symbol);
      setChartData(prev => ({ ...prev, [symbol]: klinesRes.data || [] }));
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="main-content">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <div className="loading">Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="main-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Equity</span>
            <span className="stat-value">${stats?.totalEquity?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Available Balance</span>
            <span className="stat-value">${stats?.availableBalance?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Open Positions</span>
            <span className="stat-value">{stats?.openPositions || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Daily P&L</span>
            <span className={`stat-value ${(stats?.dailyPnl || 0) >= 0 ? "profit" : "loss"}`}>
              ${stats?.dailyPnl?.toFixed(2) || "0.00"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Win Rate</span>
            <span className="stat-value">{stats?.winRate || "0"}%</span>
          </div>
        </div>

        {/* Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Chart:</span>
            <select
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
            >
              {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'PEPEUSDT', 'DOGEUSDT', 'SHIBUSDT', 'WIFUSDT', 'BONKUSDT', 'FETUSDT'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Cadence:</span>
            <select
              className="cadence-select"
              value={tradingConfig?.cadence || "STANDARD_1M"}
              onChange={(e) => updateConfig({ cadence: e.target.value })}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '14px', cursor: 'pointer' }}
            >
              <option value="FAST_5S">5 Seconds</option>
              <option value="STANDARD_1M">1 Minute</option>
              <option value="SLOW_10M">10 Minutes</option>
            </select>
            <button
              className={`engine-btn ${tradingConfig?.enabled ? "on" : "off"}`}
              onClick={() => updateConfig({ enabled: !(tradingConfig?.enabled ?? true) })}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >
              {tradingConfig?.enabled ? "● Engine ON" : "○ Engine OFF"}
            </button>
          </div>
        </div>

        {/* AI Market Brief */}
        {marketBrief && (
          <div className="ai-brief fade-in">
            <div className="ai-brief-label">🤖 AI Market Intelligence</div>
            <div className="ai-brief-text">{marketBrief}</div>
          </div>
        )}

        {/* Charts Section */}
        <div className="charts-grid">
          <div className="chart-card" style={{ minHeight: '400px' }}>
            <div className="chart-header">
              <span className="chart-title">{selectedSymbol} Price Chart</span>
              <div className="chart-legend">
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: "#10B981" }}></span>
                  Price
                </span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: "#2962FF" }}></span>
                  EMA 20
                </span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ background: "#FF6D00" }}></span>
                  EMA 50
                </span>
              </div>
            </div>
            <div style={{ height: '320px', width: '100%' }}>
              <PriceChart
                symbol={selectedSymbol}
                data={chartData[selectedSymbol] || []}
              />
            </div>
          </div>
          
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Quick Stats</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Trading Mode</span>
                <span className="badge" style={{ background: 'var(--accent-primary)', color: 'white' }}>{stats?.tradingMode || 'paper'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Signals</span>
                <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{signals.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Trades</span>
                <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{openTrades.length + closedTrades.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Closed Trades</span>
                <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{closedTrades.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signals Section */}
        {signals.length > 0 && (
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Recent Signals</h2>
            </div>
            <div className="signals-grid">
              {signals.map((signal) => (
                <div key={signal.id} className="signal-card fade-in">
                  <div className="signal-header">
                    <span className="signal-symbol">{signal.symbol}</span>
                    <span className={`signal-direction ${signal.direction?.toLowerCase()}`}>
                      {signal.direction}
                    </span>
                  </div>
                  <div className="signal-details">
                    <div className="signal-detail">
                      <span className="signal-detail-label">Entry Range</span>
                      <span className="signal-detail-value">
                        ${signal.entry_min?.toFixed(4)} - ${signal.entry_max?.toFixed(4)}
                      </span>
                    </div>
                    <div className="signal-detail">
                      <span className="signal-detail-label">Stop Loss</span>
                      <span className="signal-detail-value" style={{ color: 'var(--accent-danger)' }}>
                        ${signal.stop_loss?.toFixed(4)}
                      </span>
                    </div>
                    <div className="signal-detail">
                      <span className="signal-detail-label">Take Profit</span>
                      <span className="signal-detail-value" style={{ color: 'var(--accent-success)' }}>
                        ${signal.take_profit_1?.toFixed(4)}
                      </span>
                    </div>
                    <div className="signal-detail">
                      <span className="signal-detail-label">Risk</span>
                      <span className="signal-detail-value">{signal.max_risk_percent}%</span>
                    </div>
                  </div>
                  {signal.ai_confidence !== null && (
                    <div className="signal-confidence">
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '60px' }}>AI Confidence</span>
                      <div className="confidence-bar">
                        <div className="confidence-fill" style={{ width: `${signal.ai_confidence}%` }}></div>
                      </div>
                      <span className="confidence-value">{signal.ai_confidence}%</span>
                    </div>
                  )}
                  <div className="signal-rationale">
                    {signal.rationale?.[0] || "No rationale available"}
                  </div>
                  <div className="signal-time">
                    {new Date(signal.generated_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Open Positions */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Open Positions</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{openTrades.length} positions</span>
          </div>
          <div className="table-container">
            {openTrades.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Entry Price</th>
                    <th>Quantity</th>
                    <th>Stop Loss</th>
                    <th>Take Profit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="symbol-cell">{trade.symbol}</td>
                      <td className={`side-cell ${trade.side?.toLowerCase()}`}>{trade.side}</td>
                      <td>${trade.entry_price.toFixed(4)}</td>
                      <td>{trade.quantity.toFixed(2)}</td>
                      <td style={{ color: 'var(--accent-danger)' }}>${trade.stop_loss.toFixed(4)}</td>
                      <td style={{ color: 'var(--accent-success)' }}>${trade.take_profit.toFixed(4)}</td>
                      <td>
                        <span className="badge warning">OPEN</span>
                      </td>
                      <td>
                        <button
                          className="action-btn close"
                          onClick={() => handleCloseTrade(trade.id)}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No open positions
              </div>
            )}
          </div>
        </section>

        {/* Trade History */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Trade History</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{closedTrades.length} closed</span>
          </div>
          <div className="table-container">
            {closedTrades.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Side</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Quantity</th>
                    <th>P&L</th>
                    <th>P&L %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="symbol-cell">{trade.symbol}</td>
                      <td className={`side-cell ${trade.side?.toLowerCase()}`}>{trade.side}</td>
                      <td>${trade.entry_price.toFixed(4)}</td>
                      <td>${trade.exit_price?.toFixed(4) || "N/A"}</td>
                      <td>{trade.quantity.toFixed(2)}</td>
                      <td className={`pnl-cell ${(trade.realized_pnl || 0) >= 0 ? "profit" : "loss"}`}>
                        ${trade.realized_pnl?.toFixed(2) || "0.00"}
                      </td>
                      <td className={`pnl-cell ${(trade.realized_pnl_percent || 0) >= 0 ? "profit" : "loss"}`}>
                        {trade.realized_pnl_percent?.toFixed(2) || "0.00"}%
                      </td>
                      <td>
                        <span className="badge success">CLOSED</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No closed trades yet
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
