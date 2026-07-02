import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CurrencyCode, Category } from '@/lib/types';

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringExpense {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  week_interval?: number;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  category?: Category;
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Ogni X settimane',
  monthly: 'Mensile',
  quarterly: 'Trimestrale',
  yearly: 'Annuale',
};

export function useRecurringExpenses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: recurringExpenses = [], isLoading } = useQuery({
    queryKey: ['recurring_expenses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('next_due_date', { ascending: true });
      
      if (error) throw error;
      return data as RecurringExpense[];
    },
    enabled: !!user,
  });

  const createRecurringExpense = useMutation({
    mutationFn: async (expense: {
      name: string;
      amount: number;
      currency?: CurrencyCode;
      category_id?: string;
      frequency: RecurringFrequency;
      week_interval?: number;
      next_due_date: string;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({
          ...expense,
          user_id: user!.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    },
  });

  const updateRecurringExpense = useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      amount?: number;
      currency?: CurrencyCode;
      category_id?: string;
      frequency?: RecurringFrequency;
      week_interval?: number;
      next_due_date?: string;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    },
  });

  const deleteRecurringExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_expenses')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id)
        .eq('user_id', user!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    },
  });

  // Process due recurring expenses and create transactions
  const processDueExpenses = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Get all active recurring expenses due today or before
      const { data: dueExpenses, error: fetchError } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('is_active', true)
        .lte('next_due_date', today);
      
      if (fetchError) throw fetchError;
      if (!dueExpenses || dueExpenses.length === 0) return { processed: 0 };

      let processed = 0;

      for (const expense of dueExpenses) {
        // Check if transaction already exists for this month
        const dueDate = new Date(expense.next_due_date + 'T00:00:00');
        const month = dueDate.getMonth() + 1; // JavaScript months are 0-indexed
        const year = dueDate.getFullYear();
        const nextMonth = month % 12 + 1;
        const nextYear = month === 12 ? year + 1 : year;

        const { data: existing, error: existError } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user!.id)
          .eq('description', expense.name)
          .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
          .lt('date', `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`)
          .is('deleted_at', null)
          .maybeSingle();

        if (existError) {
          console.error('Idempotency check failed:', existError);
        }

        if (!existing && !existError) {
          // Create transaction
          await supabase
            .from('transactions')
            .insert({
              user_id: user!.id,
              type: 'expense',
              amount: expense.amount,
              currency: expense.currency,
              category_id: expense.category_id,
              description: expense.name,
              date: expense.next_due_date,
            });
          processed++;
        }

        // Calculate next due date
        const nextDate = calculateNextDueDate(expense.next_due_date, expense.frequency as RecurringFrequency, expense.week_interval);
        
        await supabase
          .from('recurring_expenses')
          .update({ next_due_date: nextDate })
          .eq('id', expense.id);
      }

      return { processed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  return {
    recurringExpenses,
    isLoading,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    processDueExpenses,
  };
}

function calculateNextDueDate(currentDate: string, frequency: RecurringFrequency, weekInterval: number = 1): string {
  const date = new Date(currentDate + 'T00:00:00');
  const originalDay = date.getDate();
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + (7 * weekInterval));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      // Correggi overflow: se il giorno è cambiato, significa che siamo andati oltre il mese
      if (date.getDate() !== originalDay) {
        date.setDate(0); // Ultimo giorno del mese precedente
      }
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      // Correggi overflow
      if (date.getDate() !== originalDay) {
        date.setDate(0);
      }
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      // Correggi overflow (es. 29 febbraio in anno non bisestile)
      if (date.getDate() !== originalDay) {
        date.setDate(0);
      }
      break;
  }
  
  // Formatta come YYYY-MM-DD in local time (evita lo shift UTC di toISOString)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
