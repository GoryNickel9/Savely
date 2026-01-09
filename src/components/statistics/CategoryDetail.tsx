import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryStatistic } from '@/hooks/useStatistics';
import { BudgetIndicator } from './BudgetIndicator';

interface CategoryDetailProps {
  categoryStatistics: CategoryStatistic[];
  statisticName: string;
}

export function CategoryDetail({ categoryStatistics, statisticName }: CategoryDetailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dettaglio per categoria - {statisticName}</CardTitle>
      </CardHeader>
      <CardContent>
        {categoryStatistics.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna categoria con budget trovata
          </div>
        ) : (
          <div className="space-y-4">
            {categoryStatistics.map((stat) => (
              <div
                key={stat.categoryId}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${stat.categoryColor}20` }}
                  >
                    {stat.categoryIcon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{stat.categoryName}</div>
                    <div className="text-sm text-muted-foreground">
                      €{stat.value.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <BudgetIndicator
                    budget={stat.budget}
                    value={stat.value}
                    budgetPercentage={stat.budgetPercentage}
                    isOverBudget={stat.isOverBudget}
                    variant="badge"
                  />
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground">Budget</div>
                    <div className="font-medium">€{stat.budget.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}