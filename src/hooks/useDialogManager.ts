import { useState, useCallback } from 'react';

/**
 * Opzioni per configurare il gestore di dialog
 */
interface UseDialogManagerOptions<T> {
  initialData?: T;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Valori restituiti dal hook useDialogManager
 */
interface UseDialogManagerReturn<T> {
  open: boolean;
  editingItem: T | null;
  openCreate: () => void;
  openEdit: (item: T) => void;
  close: () => void;
}

/**
 * Hook personalizzato per gestire lo stato dei dialog/modal
 *
 * @template T - Tipo di dati dell'item gestito dal dialog
 * @param options - Opzioni di configurazione
 * @returns Oggetto con metodi e stato per gestire il dialog
 *
 * @example
 * ```tsx
 * const { open, editingItem, openCreate, openEdit, close } = useDialogManager<User>();
 * ```
 */
export function useDialogManager<T extends { id?: string }>(
  options?: UseDialogManagerOptions<T>
): UseDialogManagerReturn<T> {
  const { initialData, onOpen, onClose } = options || {};
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(initialData || null);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setOpen(true);
    onOpen?.();
  }, [onOpen]);

  const openEdit = useCallback((item: T) => {
    setEditingItem(item);
    setOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    setEditingItem(null);
    setOpen(false);
    onClose?.();
  }, [onClose]);

  return {
    open,
    editingItem,
    openCreate,
    openEdit,
    close,
  };
}
