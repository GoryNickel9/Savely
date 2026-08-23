import LibraryPage from '@/components/libreria/LibraryPage';
import { searchFumetti } from '@/lib/googleBooks';

export default function LibreriaFumetti() {
  return (
    <LibraryPage
      category="fumetti"
      searchBooks={searchFumetti}
      labels={{
        pageTitle: 'Fumetti',
        pageSubtitle: 'La tua collezione di fumetti',
        addButton: 'Aggiungi Fumetto',
        searchPlaceholder: 'Es. Dylan Dog, Tex Willer',
        addedToast: 'Fumetto aggiunto!',
        updatedToast: 'Fumetto aggiornato!',
        removedToast: 'Fumetto rimosso',
        emptyList: 'Nessun fumetto aggiunto. Inizia aggiungendo il primo!',
      }}
    />
  );
}
