import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: ReactNode;
  striped?: boolean;
  hover?: boolean;
}

/**
 * Chiave di riga: usa `id` se presente (string/number), altrimenti l'indice.
 */
function rowKey(item: unknown, index: number): React.Key {
  const id = (item as Record<string, unknown>).id;
  return typeof id === 'string' || typeof id === 'number' ? id : index;
}

/**
 * Valore di cella per le colonne senza `render`: accesso dinamico alla
 * proprietà (la chiave non è esprimibile nel vincolo generico).
 */
function cellText(item: unknown, key: string): ReactNode {
  const value = (item as Record<string, unknown>)[key];
  return value == null ? null : (value as ReactNode);
}

export function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Nessun dato disponibile',
  striped = true,
  hover = true
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`text-left py-3 px-4 font-medium text-sm ${column.headerClassName || ''}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={rowKey(item, index)}
              className={`border-t ${striped && index % 2 === 0 ? 'bg-background' : 'bg-muted/20'} ${hover ? 'hover:bg-muted/30' : ''}`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`py-3 px-4 ${column.className || ''}`}
                >
                  {column.render ? column.render(item, index) : cellText(item, column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
