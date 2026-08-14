import MainLayout from '@/components/layout/MainLayout';
import CategoryAnalysisChart from '@/components/charts/CategoryAnalysisChart';
import { useTranslation } from 'react-i18next';

export default function ChartsExpense() {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <CategoryAnalysisChart
        type="expense"
        title={t('Analisi Uscite')}
        subtitle={t('Distribuzione delle spese per categoria')}
        totalLabel={t('Totale Uscite')}
        totalColorClass="text-destructive"
      />
    </MainLayout>
  );
}
