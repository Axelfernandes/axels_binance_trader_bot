import api from './apiClient';

export const fetchOpenTrades = () => api.get('/api/trades?status=OPEN');

export const fetchClosedTrades = () => api.get('/api/trades?status=CLOSED');

export const fetchSignals = () => api.get('/api/signals');

export const fetchTradingConfig = () => api.get('/api/trading/config');

export const updateTradingConfig = (payload: { cadence?: 'FAST_5S' | 'STANDARD_1M' | 'SLOW_10M'; enabled?: boolean }) =>
  api.post('/api/trading/config', payload);

export const fetchDashboardStats = () => api.get('/api/dashboard/stats');

export const fetchMarketBrief = () => api.get('/api/market-brief');

export const fetchKlines = (symbol: string, limit = 100) => 
  api.get('/api/klines/' + symbol + '?limit=' + limit);

export const startTrading = () => api.post('/api/trading/start');

export const stopTrading = () => api.post('/api/trading/stop');

export const closeTrade = (tradeId: string) => api.post('/api/trades/' + tradeId + '/close');
