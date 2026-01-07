import { useMemo } from 'react';
import { PortfolioAsset } from '@/lib/types';

interface PriceHistoryPoint {
  asset_id: string;
  price: number;
  recorded_at: string;
}

interface UsePortfolioPerformanceOptions {
  openAssets: PortfolioAsset[];
  priceHistory: PriceHistoryPoint[];
}

export interface PerformanceDataPoint {
  date: string;
  dateLabel: string;
  invested: number;
  current: number;
  profit: number;
}

export function usePortfolioPerformance({
  openAssets,
  priceHistory
}: UsePortfolioPerformanceOptions): PerformanceDataPoint[] {
  return useMemo(() => {
    if (openAssets.length === 0 || priceHistory.length === 0) {
      return [];
    }

    // Raggruppa price history per data
    const priceHistoryByDate = new Map<string, Map<string, number>>();
    priceHistory.forEach(ph => {
      if (!priceHistoryByDate.has(ph.recorded_at)) {
        priceHistoryByDate.set(ph.recorded_at, new Map());
      }
      priceHistoryByDate.get(ph.recorded_at)!.set(ph.asset_id, ph.price);
    });

    // Ottieni tutte le date uniche ordinate
    const allDates = Array.from(priceHistoryByDate.keys()).sort();

    // Crea mappa degli asset per ID
    const assetsById = new Map<string, PortfolioAsset>();
    openAssets.forEach(asset => {
      assetsById.set(asset.id, asset);
    });

    // Calcola performance per ogni data
    const performanceData: PerformanceDataPoint[] = allDates.map(date => {
      let invested = 0;
      let current = 0;

      assetsById.forEach((asset) => {
        const priceMap = priceHistoryByDate.get(date);
        const price = priceMap?.get(asset.id);
        
        if (price !== undefined) {
          invested += asset.quantity * asset.purchase_price;
          current += price * asset.quantity;
        }
      });

      return {
        date,
        dateLabel: new Date(date).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        invested,
        current,
        profit: current - invested
      };
    });

    return performanceData;
  }, [openAssets, priceHistory]);
}
