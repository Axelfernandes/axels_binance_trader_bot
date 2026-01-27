import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';

interface PriceChartProps {
    symbol: string;
    data: any[];
}

export const PriceChart = ({ symbol, data }: PriceChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 400,
            layout: {
                background: { color: 'transparent' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        const ema20Series = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            title: 'EMA 20',
        });

        const ema50Series = chart.addLineSeries({
            color: '#FF6D00',
            lineWidth: 2,
            title: 'EMA 50',
        });

        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;
        ema20SeriesRef.current = ema20Series;
        ema50SeriesRef.current = ema50Series;

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    useEffect(() => {
        if (!candlestickSeriesRef.current || !data || data.length === 0) return;

        const formattedData: CandlestickData[] = data.map((d) => ({
            time: (new Date(d.openTime).getTime() / 1000) as any,
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close),
        }));

        candlestickSeriesRef.current.setData(formattedData);

        // Calculate EMA
        const calculateEMA = (period: number, prices: number[]) => {
            const k = 2 / (period + 1);
            let ema = prices[0];
            const emaData: number[] = [ema];
            for (let i = 1; i < prices.length; i++) {
                ema = prices[i] * k + ema * (1 - k);
                emaData.push(ema);
            }
            return emaData;
        };

        const closes = formattedData.map((d) => d.close);
        const ema20 = calculateEMA(20, closes);
        const ema50 = calculateEMA(50, closes);

        const ema20Data: LineData[] = formattedData.map((d, i) => ({
            time: d.time,
            value: ema20[i],
        }));

        const ema50Data: LineData[] = formattedData.map((d, i) => ({
            time: d.time,
            value: ema50[i],
        }));

        ema20SeriesRef.current?.setData(ema20Data);
        ema50SeriesRef.current?.setData(ema50Data);

        chartRef.current?.timeScale().fitContent();
    }, [data]);

    return (
        <div className="glass-card" style={{ padding: '20px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>{symbol} Price Chart</h3>
                <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
                    <span style={{ color: '#2962FF' }}>● EMA 20</span>
                    <span style={{ color: '#FF6D00' }}>● EMA 50</span>
                </div>
            </div>
            <div ref={chartContainerRef} />
        </div>
    );
};
