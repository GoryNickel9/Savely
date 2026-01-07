import MainLayout from '@/components/layout/MainLayout';
import { useStatistics } from '@/hooks/useStatistics';
import { StatisticCard } from '@/components/statistics/StatisticCard';
import { CategoryDetail } from '@/components/statistics/CategoryDetail';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, BarChart3, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  MEAN_CALCULATION_DAYS,
  MEDIAN_CALCULATION_DAYS,
  WINSORIZED_MEAN_CALCULATION_DAYS
} from '@/lib/constants';

type StatisticType = 'mean' | 'median' | 'winsorized';

interface StatisticConfig {
  type: StatisticType;
  name: string;
  days: number;
}

interface StatisticDaysConfig {
  meanMonths: number;
  medianMonths: number;
  winsorizedMonths: number;
  winsorizedPercentile: number;
}

const DAYS_PER_MONTH = 30.41;

export default function StatisticsDeepDive() {
  const [selectedStatistic, setSelectedStatistic] = useState<StatisticConfig | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [config, setConfig] = useState<StatisticDaysConfig>({
    meanMonths: Math.round(MEAN_CALCULATION_DAYS / DAYS_PER_MONTH),
    medianMonths: Math.round(MEDIAN_CALCULATION_DAYS / DAYS_PER_MONTH),
    winsorizedMonths: Math.round(WINSORIZED_MEAN_CALCULATION_DAYS / DAYS_PER_MONTH),
    winsorizedPercentile: 0.10
  });
  const [tempConfig, setTempConfig] = useState<StatisticDaysConfig>({ ...config });

  // Sincronizza tempConfig quando si apre la finestra di dialogo
  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      setTempConfig({ ...config });
    }
  };

  // Converti mesi in giorni
  const meanDays = Math.round(config.meanMonths * DAYS_PER_MONTH);
  const medianDays = Math.round(config.medianMonths * DAYS_PER_MONTH);
  const winsorizedDays = Math.round(config.winsorizedMonths * DAYS_PER_MONTH);

  const { statistics, isLoading, getCategoryStatistics } = useStatistics(
    config.winsorizedPercentile,
    meanDays,
    medianDays,
    winsorizedDays
  );

  const STATISTIC_CONFIGS: StatisticConfig[] = [
    { type: 'mean', name: `Media ultimi ${config.meanMonths} mesi`, days: meanDays },
    { type: 'median', name: `Mediana ultimi ${config.medianMonths} mesi`, days: medianDays },
    { type: 'winsorized', name: `Media winsorizzata (${(config.winsorizedPercentile * 100).toFixed(0)}%)`, days: winsorizedDays },
  ];

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (selectedStatistic) {
    const categoryStatistics = getCategoryStatistics(
      selectedStatistic.type,
      selectedStatistic.days,
      selectedStatistic.type === 'winsorized' ? config.winsorizedPercentile : undefined
    );

    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedStatistic(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-display font-bold">
                {selectedStatistic.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                Dettaglio per categoria
              </p>
            </div>
          </div>

          <CategoryDetail
            categoryStatistics={categoryStatistics}
            statisticName={selectedStatistic.name}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              Statistiche Deep Dive
            </h1>
            <p className="text-muted-foreground mt-1">
              Analisi statistiche avanzate sulle tue spese
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Modifica parametri
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifica parametri</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Mesi per la Media</label>
                  <Input
                    type="number"
                    value={tempConfig.meanMonths}
                    onChange={(e) => setTempConfig({ ...tempConfig, meanMonths: parseInt(e.target.value) || 0 })}
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Mesi per la Mediana</label>
                  <Input
                    type="number"
                    value={tempConfig.medianMonths}
                    onChange={(e) => setTempConfig({ ...tempConfig, medianMonths: parseInt(e.target.value) || 0 })}
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Mesi per la Media Winsorizzata</label>
                  <Input
                    type="number"
                    value={tempConfig.winsorizedMonths}
                    onChange={(e) => setTempConfig({ ...tempConfig, winsorizedMonths: parseInt(e.target.value) || 0 })}
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Percentile per la Media Winsorizzata (0-0.5)</label>
                  <Input
                    type="number"
                    value={tempConfig.winsorizedPercentile}
                    onChange={(e) => setTempConfig({ ...tempConfig, winsorizedPercentile: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="0.5"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Esempio: 0.10 = 10% su entrambi i lati
                  </p>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setConfig(tempConfig);
                      setDialogOpen(false);
                    }}
                  >
                    Salva
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!statistics || statistics.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Nessuna statistica disponibile</p>
            <p className="text-sm mt-2">
              Aggiungi delle transazioni per vedere le statistiche
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {statistics.map((statistic, index) => {
              const config = STATISTIC_CONFIGS[index];
              return (
                <StatisticCard
                  key={statistic.name}
                  statistic={statistic}
                  onClick={() => config && setSelectedStatistic(config)}
                />
              );
            })}
          </div>
        )}

        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-3">Definizioni Statistiche</h3>
          <div className="space-y-3 text-sm">
            <div>
              <strong>Media (Mean):</strong> La media aritmetica è la somma di tutti i valori divisa per il numero di valori.
            </div>
            <div>
              <strong>Mediana (Median):</strong> La mediana è il valore centrale di un insieme di dati ordinati. Se il numero di valori è pari, è la media dei due valori centrali.
            </div>
            <div>
              <strong>Media Winsorizzata (Winsorized Mean):</strong> La media winsorizzata sostituisce i valori estremi con i valori al percentile specificato (10%) prima di calcolare la media. Questo riduce l'influenza degli outlier.
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}