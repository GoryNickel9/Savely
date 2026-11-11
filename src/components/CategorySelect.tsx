import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
}

interface CategorySelectProps {
  categories: Category[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  filterType?: 'expense' | 'income' | 'all';
  showAllOption?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
  /**
   * Renderizza la lista nel flusso del form: la Dialog può espandersi e
   * il campo di ricerca rimane dentro il suo focus trap.
   */
  disablePortal?: boolean;
}

export function CategorySelect({
  categories,
  value,
  onValueChange,
  placeholder = 'Seleziona categoria',
  filterType = 'all',
  showAllOption = false,
  allOptionLabel = 'Tutte le categorie',
  allOptionValue = 'all',
  disablePortal = false,
}: CategorySelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!disablePortal || !open) return;
    // Handle Escape before the modal's document capture listener closes the Dialog.
    const closeList = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !(event.target instanceof Node) || !triggerRef.current?.parentElement?.contains(event.target)) return;
      event.preventDefault(); event.stopPropagation();
      setOpen(false); triggerRef.current.focus();
    };
    window.addEventListener('keydown', closeList, true);
    return () => window.removeEventListener('keydown', closeList, true);
  }, [disablePortal, open]);

  const filteredCategories = filterType === 'all'
    ? categories
    : categories.filter(c => c.type === filterType);

  const selectedCategory = categories.find(c => c.id === value);
  const isAllSelected = showAllOption && value === allOptionValue;

  const selectCategory = (id: string) => {
    onValueChange(id);
    setOpen(false);
    if (disablePortal) triggerRef.current?.focus();
  };
  const trigger = <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={isAllSelected ? t(allOptionLabel) : selectedCategory?.name ?? t(placeholder)}
          aria-haspopup="dialog"
          aria-expanded={open}
          {...(disablePortal ? { 'aria-controls': open ? panelId : undefined } : {})}
          onClick={disablePortal ? () => setOpen(value => !value) : undefined}
          className="w-full justify-between"
        >
          {isAllSelected ? (
            <span>{t(allOptionLabel)}</span>
          ) : selectedCategory ? (
            <span className="flex items-center gap-2">
              <span>{selectedCategory.icon}</span>
              <span>{selectedCategory.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t(placeholder)}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>;
  const content = <Command>
          <CommandInput autoFocus={disablePortal} placeholder={t('Cerca categoria...')} />
          <CommandList className={disablePortal ? 'max-h-[min(35dvh,240px)]' : 'max-h-[min(45vh,300px)]'}>
            <CommandEmpty>{t('Nessuna categoria trovata.')}</CommandEmpty>
            <CommandGroup>
              {showAllOption && (
                <CommandItem
                  value={t(allOptionLabel)}
                  onSelect={() => selectCategory(allOptionValue)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      isAllSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate" title={t(allOptionLabel)}>{t(allOptionLabel)}</span>
                </CommandItem>
              )}
              {filteredCategories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.name}
                  onSelect={() => selectCategory(category.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="mr-2 shrink-0">{category.icon}</span>
                  <span className="truncate" title={category.name}>{category.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>;

  if (disablePortal) return <div className="space-y-1">
    {trigger}
    {open && <div id={panelId} role="dialog" aria-label={t('Categoria')} className="w-full rounded-md border bg-popover text-popover-foreground shadow-md">{content}</div>}
  </div>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
}
