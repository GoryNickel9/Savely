import FumoCrudPage from '@/components/fumo/FumoCrudPage';

// THC: come CBD (grammi) ma mostra solo i record dell'anno corrente in tabella.
export default function FumoTHC() {
  return (
    <FumoCrudPage
      tableName="thc"
      title="THC"
      subtitle="Traccia le spese per prodotti THC"
      quantityLabel="Grammi"
      quantityColumnHeader="Grammi"
      quantityPerDayColumnHeader="Grammi/d"
      deleteToast="THC eliminato!"
      dateArrivoField="data_acquisto"
      filterByCurrentYear
      yearlyExtraColumns={[
        {
          key: 'grammiTotali',
          header: 'Grammi Totali',
          render: (stat) => `${stat.extraTotal.toFixed(2)}g`,
        },
        {
          key: 'costoAlGrammo',
          header: 'Costo al Grammo',
          render: (stat) => `${stat.extraTotal > 0 ? (stat.costoTotale / stat.extraTotal).toFixed(2) : '0.00'}`,
        },
      ]}
    />
  );
}
