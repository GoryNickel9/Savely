import TcgCollectionPage from '@/components/tcg/TcgCollectionPage';

export default function TcgYugioh() {
  return (
    <TcgCollectionPage
      category="yugioh"
      title="Yu-Gi-Oh!"
      subtitle="Collezione carte Yu-Gi-Oh!"
      addCardTitle="Aggiungi carta Yu-Gi-Oh!"
      addDialogMaxWidth="max-w-4xl"
      searchPlaceholder="es. Dark Magician, Blue-Eyes..."
      // Yugioh: niente collector number, niente filtro testuale su set
      showCollectorNumber={false}
      filterByTextOrSet={false}
    />
  );
}
