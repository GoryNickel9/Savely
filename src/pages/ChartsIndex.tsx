import MainLayout from '@/components/layout/MainLayout';
import { Link } from 'react-router';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ChartsIndex() {
  const { t } = useTranslation();

  const chartOptions = [
    {
      title: t('Analisi Entrate e Uscite'),
      description: t('Visualizza l\'andamento cumulativo del bilancio nel tempo'),
      icon: ArrowLeftRight,
      href: '/charts/income-expense',
      color: 'bg-primary'
    },
    {
      title: t('Analisi Uscite'),
      description: t('Visualizza la distribuzione delle spese per categoria'),
      icon: TrendingDown,
      href: '/charts/expense',
      color: 'bg-destructive'
    },
    {
      title: t('Analisi Entrate'),
      description: t('Visualizza la distribuzione delle entrate per categoria'),
      icon: TrendingUp,
      href: '/charts/income',
      color: 'bg-success'
    }
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('Grafici')}</h1>
          <p className="text-muted-foreground">{t('Scegli il tipo di analisi da visualizzare')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {chartOptions.map((option) => (
            <Link
              key={option.href}
              to={option.href}
              className="glass rounded-xl p-6 hover:shadow-lg transition-all duration-200 group cursor-pointer"
            >
              <div className={`${option.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <option.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{option.title}</h3>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
