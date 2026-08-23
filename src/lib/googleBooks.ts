/** Tipi e helper per la ricerca Google Books API (libreria). */

export interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

export function dedupeBooks(items: GoogleBook[]): GoogleBook[] {
  const seen = new Set<string>();
  return items.filter((b) => {
    if (!b.volumeInfo) return false;
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

export function getBookYear(book: GoogleBook): number | undefined {
  const d = book.volumeInfo.publishedDate;
  if (!d) return undefined;
  const y = Number.parseInt(d.substring(0, 4), 10);
  return Number.isNaN(y) ? undefined : y;
}

/** Ricerca libri generica (pagina Libri). */
export async function searchGoogleBooks(q: string): Promise<GoogleBook[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}&langRestrict=it&maxResults=20&orderBy=relevance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Errore nella ricerca');
  const json = await res.json();
  return dedupeBooks((json.items ?? []) as GoogleBook[]);
}

/** Ricerca fumetti: prima con subject:fumetti in italiano, poi senza restrizioni. */
export async function searchFumetti(q: string): Promise<GoogleBook[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}+subject:fumetti&langRestrict=it&maxResults=20&orderBy=relevance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Errore nella ricerca');
  const json = await res.json();
  if (json.items?.length) return dedupeBooks(json.items as GoogleBook[]);
  // Fallback: no language/subject restriction
  const fallback = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}&maxResults=20&orderBy=relevance`);
  const fallbackJson = await fallback.json();
  return dedupeBooks((fallbackJson.items ?? []) as GoogleBook[]);
}
