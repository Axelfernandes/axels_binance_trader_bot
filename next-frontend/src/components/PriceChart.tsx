"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  CandlestickSeries,
  LineSeries,
} from "lightweight-charts";

interface PriceChartProps {
  symbol: string;
  data: any[];
}

export const PriceChart = ({ symbol, data }: PriceChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: "#6B7280",
      },
      grid: {
        vertLines: { color: "#E5E7EB" },
        horzLines: { color: "#E5E7EB" },
      },
      rightPriceScale: {
        borderColor: "#E5E7EB",
      },
      timeScale: {
        borderColor: "#E5E7EB",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#EF4444",
      borderVisible: false,
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: "#2962FF",
      lineWidth: 2,
      title: "EMA 20",
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#FF6D00",
      lineWidth: 2,
      title: "EMA 50",
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

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
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
    <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
  );
};
