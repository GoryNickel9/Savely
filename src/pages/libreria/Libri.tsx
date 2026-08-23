import LibraryPage from '@/components/libreria/LibraryPage';
import { searchGoogleBooks } from '@/lib/googleBooks';

export default function LibreriaLibri() {
  return (
    <LibraryPage
      category="libri"
      searchBooks={searchGoogleBooks}
      labels={{
        pageTitle: 'Libri',
        pageSubtitle: 'La tua collezione di libri',
        addButton: 'Aggiungi Libro',
        searchPlaceholder: 'Es. Il Nome della Rosa',
        addedToast: 'Libro aggiunto!',
        updatedToast: 'Libro aggiornato!',
        removedToast: 'Libro rimosso',
        emptyList: 'Nessun libro aggiunto. Inizia aggiungendo il primo!',
      }}
    />
  );
}
