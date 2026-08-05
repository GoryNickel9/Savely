import { useState } from 'react';
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
            <span>{allOptionLabel}</span>
          ) : selectedCategory ? (
            <span className="flex items-center gap-2">
              <span>{selectedCategory.icon}</span>
              <span>{selectedCategory.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" disablePortal>
        <Command>
          <CommandInput placeholder="Cerca categoria..." />
          <CommandList>
            <CommandEmpty>Nessuna categoria trovata.</CommandEmpty>
            <CommandGroup>
              {showAllOption && (
                <CommandItem
                  value={allOptionLabel}
                  onSelect={() => {
                    onValueChange(allOptionValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isAllSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{allOptionLabel}</span>
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
                      "mr-2 h-4 w-4",
                      value === category.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="mr-2">{category.icon}</span>
                  <span>{category.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
