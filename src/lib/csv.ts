export type CsvRow = Record<string, string>;

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

export function parseCsvRows(text: string, delimiter: ',' | ';' = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);

  return rows;
}

export function parseCsvObjects(text: string, delimiter?: ',' | ';'): CsvRow[] {
  const rows = parseCsvRows(text, delimiter);
  const headers = rows[0]?.map(header => header.replace(/^\uFEFF/, '').trim()) ?? [];

  return rows.slice(1).map(row => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });
}

function escapeCsvValue(value: unknown): string {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function serializeCsvRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach(key => keys.add(key));
      return keys;
    }, new Set<string>())
  );

  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map(row => headers.map(header => escapeCsvValue(row[header])).join(',')),
  ];

  return lines.join('\n');
}
