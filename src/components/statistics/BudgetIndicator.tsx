import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface BudgetIndicatorProps {
  budget: number | null;
  value: number;
  budgetPercentage: number | null;
  isOverBudget: boolean;
  variant?: 'badge' | 'progress' | 'icon';
}

export function BudgetIndicator({ 
  budget, 
  value, 
  budgetPercentage, 
  isOverBudget,
  variant = 'badge' 
}: BudgetIndicatorProps) {
  if (budget === null) {
    return <span className="text-muted-foreground text-sm">Nessun budget</span>;
  }

  if (variant === 'badge') {
    return (
      <Badge 
        variant={isOverBudget ? 'destructive' : 'default'}
        className="flex items-center gap-1"
      >
        {isOverBudget ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <CheckCircle2 className="w-3 h-3" />
        )}
        {budgetPercentage?.toFixed(0)}%
      </Badge>
    );
  }

  if (variant === 'progress') {
    const percentage = Math.min(budgetPercentage || 0, 100);
    return (
      <div className="space-y-1">
        <Progress 
          value={percentage} 
          className={isOverBudget ? 'bg-destructive/20' : ''}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>€{value.toFixed(2)}</span>
          <span>€{budget.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <div className="flex items-center gap-2">
        {isOverBudget ? (
          <AlertTriangle className="w-5 h-5 text-destructive" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        )}
        <span className="text-sm">
          {budgetPercentage?.toFixed(0)}% del budget
        </span>
      </div>
    );
  }

  return null;
}