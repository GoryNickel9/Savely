import MainLayout from '@/components/layout/MainLayout';
import CategoryAnalysisChart from '@/components/charts/CategoryAnalysisChart';
import { useTranslation } from 'react-i18next';

export default function ChartsIncome() {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <CategoryAnalysisChart
        type="income"
        title={t('Analisi Entrate')}
        subtitle={t('Distribuzione delle entrate per categoria')}
        totalLabel={t('Totale Entrate')}
        totalColorClass="text-success"
      />
    </MainLayout>
  );
}
