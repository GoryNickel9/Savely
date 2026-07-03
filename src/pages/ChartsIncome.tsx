import MainLayout from '@/components/layout/MainLayout';
import CategoryAnalysisChart from '@/components/charts/CategoryAnalysisChart';

export default function ChartsIncome() {
  return (
    <MainLayout>
      <CategoryAnalysisChart
        type="income"
        title="Analisi Entrate"
        subtitle="Distribuzione delle entrate per categoria"
        totalLabel="Totale Entrate"
        totalColorClass="text-success"
      />
    </MainLayout>
  );
}
