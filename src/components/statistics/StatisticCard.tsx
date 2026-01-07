import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { StatisticResult } from '@/hooks/useStatistics';

interface StatisticCardProps {
  statistic: StatisticResult;
  onClick: () => void;
}

export function StatisticCard({ statistic, onClick }: StatisticCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {statistic.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold">
              €{statistic.value.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statistic.period}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {statistic.description}
        </p>
      </CardContent>
    </Card>
  );
}