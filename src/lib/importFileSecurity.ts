const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = new Set(['csv']);

export interface ImportFileValidationResult {
  extension: string;
  maxSizeBytes: number;
}

export function validateImportFile(file: File): ImportFileValidationResult {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_IMPORT_EXTENSIONS.has(extension)) {
    throw new Error('Formato file non supportato. Usa CSV.');
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error('File troppo grande. Il limite massimo e 5 MB.');
  }

  return {
    extension,
    maxSizeBytes: MAX_IMPORT_FILE_SIZE_BYTES,
  };
}
