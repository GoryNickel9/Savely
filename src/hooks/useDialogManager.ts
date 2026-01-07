import { useState, useCallback } from 'react';

interface UseDialogManagerOptions<T> {
  initialData?: T;
  onOpen?: () => void;
  onClose?: () => void;
}

interface UseDialogManagerReturn<T> {
  open: boolean;
  editingItem: T | null;
  openCreate: () => void;
  openEdit: (item: T) => void;
  close: () => void;
  isOpen: boolean;
}

export function useDialogManager<T extends Record<string, any>>(
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
    isOpen: open
  };
}
