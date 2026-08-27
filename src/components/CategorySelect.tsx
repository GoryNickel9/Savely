import { useState } from 'react';
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
}: CategorySelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const filteredCategories = filterType === 'all'
    ? categories
    : categories.filter(c => c.type === filterType);

  const selectedCategory = categories.find(c => c.id === value);
  const isAllSelected = showAllOption && value === allOptionValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
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
        </Button>
      </PopoverTrigger>
      {/* disablePortal resta necessario dentro le Dialog modali (focus trap),
          quindi si evita il clipping mantenendo la lista dentro lo spazio
          visibile della finestra: max-height proporzionato al viewport. */}
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0"
        align="start"
        disablePortal
      >
        <Command>
          <CommandInput placeholder={t('Cerca categoria...')} />
          <CommandList className="max-h-[min(45vh,300px)]">
            <CommandEmpty>{t('Nessuna categoria trovata.')}</CommandEmpty>
            <CommandGroup>
              {showAllOption && (
                <CommandItem
                  value={t(allOptionLabel)}
                  onSelect={() => {
                    onValueChange(allOptionValue);
                    setOpen(false);
                  }}
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
                  onSelect={() => {
                    onValueChange(category.id);
                    setOpen(false);
                  }}
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
