import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** Il colore usa la percentuale reale; Progress limita soltanto la larghezza. */
export default function BudgetProgress({ value, className }: { value: number; className?: string }) {
  return (
    <Progress
      value={value}
      className={cn(
        value >= 100 ? '[&>div]:bg-destructive' : value >= 75 ? '[&>div]:bg-warning' : '[&>div]:bg-success',
        className,
      )}
    />
  );
}
