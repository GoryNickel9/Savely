import { describe, expect, it } from 'vitest';
import { validateImportFile } from './importFileSecurity';

function makeFile(name: string, size: number): File {
  return {
    name,
    size,
  } as File;
}

describe('import file security', () => {
  it('accepts supported import file extensions within the size limit', () => {
    expect(validateImportFile(makeFile('movimenti.csv', 1024))).toMatchObject({
      extension: 'csv',
    });
  });

  it('rejects unsupported extensions', () => {
    expect(() => validateImportFile(makeFile('payload.html', 1024))).toThrow(
      'Formato file non supportato'
    );
  });

  it('rejects files larger than 5 MB', () => {
    expect(() => validateImportFile(makeFile('movimenti.csv', 5 * 1024 * 1024 + 1))).toThrow(
      'File troppo grande'
    );
  });
});
