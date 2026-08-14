import i18n from '@/i18n';

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = new Set(['csv']);

export interface ImportFileValidationResult {
  extension: string;
  maxSizeBytes: number;
}

export function validateImportFile(file: File): ImportFileValidationResult {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_IMPORT_EXTENSIONS.has(extension)) {
    throw new Error(i18n.t('Formato file non supportato. Usa CSV.'));
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(i18n.t('File troppo grande. Il limite massimo e 5 MB.'));
  }

  return {
    extension,
    maxSizeBytes: MAX_IMPORT_FILE_SIZE_BYTES,
  };
}
