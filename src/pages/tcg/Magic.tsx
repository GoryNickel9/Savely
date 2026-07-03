import TcgCollectionPage from '@/components/tcg/TcgCollectionPage';

export default function TcgMagic() {
  return (
    <TcgCollectionPage
      category="magic"
      title="Magic: The Gathering"
      subtitle="Collezione carte Magic"
      addCardTitle="Aggiungi carta Magic"
      addDialogMaxWidth="max-w-4xl"
      searchPlaceholder="es. Black Lotus, Ragavan..."
      normalizeSetCodeToUpper
      filterByTextOrSet
      showCollectorNumber
    />
  );
}
