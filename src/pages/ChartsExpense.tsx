import MainLayout from '@/components/layout/MainLayout';
import CategoryAnalysisChart from '@/components/charts/CategoryAnalysisChart';

export default function ChartsExpense() {
  return (
    <MainLayout>
      <CategoryAnalysisChart
        type="expense"
        title="Analisi Uscite"
        subtitle="Distribuzione delle spese per categoria"
        totalLabel="Totale Uscite"
        totalColorClass="text-destructive"
      />
    </MainLayout>
  );
}
