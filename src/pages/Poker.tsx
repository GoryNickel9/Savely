import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Dices, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function Poker() {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{t('Poker')}</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Next Cut */}
          <Link to="/poker/next-cut" className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Dices className="w-5 h-5 text-primary" />
                    {t('Next Cut')}
                  </CardTitle>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('Gestisci e calcola quanto manca per raggiungere il prossimo cut')}
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Guadagno Orario */}
          <Link to="/poker/hourly-earnings" className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    {t('Guadagno Orario')}
                  </CardTitle>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('Traccia il tuo guadagno orario nel poker')}
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Rake Back */}
          <Link to="/poker/rakeback" className="group">
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t('Rake Back')}
                  </CardTitle>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('Traccia la tua rakeback')}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}