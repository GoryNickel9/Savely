import TcgCollectionPage from '@/components/tcg/TcgCollectionPage';

export default function TcgPokemon() {
  return (
    <TcgCollectionPage
      category="pokemon"
      title="Pokémon TCG"
      subtitle="Collezione carte Pokémon"
      addCardTitle="Aggiungi carta Pokémon"
      addDialogMaxWidth="max-w-7xl"
      searchPlaceholder="es. Charizard, Pikachu..."
      filterByTextOrSet
      showCollectorNumber
    />
  );
}
