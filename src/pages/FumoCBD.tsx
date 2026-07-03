import FumoCrudPage from '@/components/fumo/FumoCrudPage';

// CBD: quantita' in grammi, data di acquisto mappata su data_arrivo del base.
// Le colonne extra della tabella annuale sono Grammi Totali e Costo al Grammo.
export default function FumoCBD() {
  return (
    <FumoCrudPage
      tableName="cbd"
      title="CBD"
      subtitle="Traccia le spese per prodotti CBD"
      quantityLabel="Grammi"
      quantityColumnHeader="Grammi"
      quantityPerDayColumnHeader="Grammi/d"
      deleteToast="CBD eliminato!"
      dateArrivoField="data_acquisto"
      filterByCurrentYear={false}
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
