import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CurrencyCode, Category } from '@/lib/types';

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringExpense {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Settimanale',
  biweekly: 'Bisettimanale',
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
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] });
    },
  });

  // Process due recurring expenses and create transactions
  const processDueExpenses = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
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
        const dueDate = new Date(expense.next_due_date);
        const month = dueDate.getMonth() + 1; // JavaScript months are 0-indexed
        const year = dueDate.getFullYear();
        
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user!.id)
          .eq('description', `[Ricorrente] ${expense.name}`)
          .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
          .lt('date', `${year}-${String(month).padStart(2, '0')}-32`)
          .maybeSingle();

        if (!existing) {
          // Create transaction
          await supabase
            .from('transactions')
            .insert({
              user_id: user!.id,
              type: 'expense',
              amount: expense.amount,
              currency: expense.currency,
              category_id: expense.category_id,
              description: `[Ricorrente] ${expense.name}`,
              date: expense.next_due_date,
            });
          processed++;
        }

        // Calculate next due date
        const nextDate = calculateNextDueDate(expense.next_due_date, expense.frequency as RecurringFrequency);
        
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

function calculateNextDueDate(currentDate: string, frequency: RecurringFrequency): string {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split('T')[0];
}
