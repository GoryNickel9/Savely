import FumoCrudPage from '@/components/fumo/FumoCrudPage';
import { readArrivo } from '@/lib/fumoCrud';

// Liquido Sigaretta: quantita' in millilitri, tabella filtrata per anno corrente.
// Le colonne extra della tabella annuale sono Millilitri Totali e Media Giornaliera.
export default function FumoLiquidoSigaretta() {
  return (
    <FumoCrudPage
      tableName="liquido_sigaretta"
      title="Liquido Sigaretta"
      subtitle="Traccia il consumo di liquido per sigaretta elettronica"
      quantityLabel="Millilitri"
      quantityColumnHeader="Millilitri"
      quantityPerDayColumnHeader="Millilitri/d"
      deleteToast="Record eliminato"
      dateArrivoField="data_arrivo"
      filterByCurrentYear
      yearlyExtraColumns={[
        {
          key: 'millilitriTotali',
          header: 'Millilitri Totali',
          render: (stat) => `${stat.extraTotal.toFixed(2)}ml`,
        },
        {
          key: 'millilitriMediaGiornalieri',
          header: 'Media Giornaliera',
          // Media giornaliera = ml totali / somma dei giorni di durata dei record dell'anno.
          render: (stat, entries) => {
            const totalGiorni = entries
              .filter((r) => new Date(readArrivo(r, 'data_arrivo')).getFullYear() === stat.anno)
              .reduce((sum, r) => sum + (r.giorni_durata || 0), 0);
            return `${totalGiorni > 0 ? (stat.extraTotal / totalGiorni).toFixed(2) : '0.00'}ml/d`;
          },
        },
      ]}
    />
  );
}
