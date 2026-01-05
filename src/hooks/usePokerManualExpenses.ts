import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface PokerManualExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export function usePokerManualExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<PokerManualExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    fetchExpenses();
  }, [user?.id]);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('poker_manual_expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Errore nel caricamento delle spese manuali:', error);
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (name: string, amount: number) => {
    try {
      const { data, error } = await supabase
        .from('poker_manual_expenses')
        .insert({
          user_id: user.id,
          name,
          amount
        })
        .select()
        .single();

      if (error) throw error;
      setExpenses([...expenses, data]);
      return data;
    } catch (error) {
      console.error('Errore nell\'aggiunta della spesa:', error);
      throw error;
    }
  };

  const updateExpense = async (id: string, amount: number) => {
    try {
      const { data, error } = await supabase
        .from('poker_manual_expenses')
        .update({ amount })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setExpenses(expenses.map(exp => exp.id === id ? data : exp));
      return data;
    } catch (error) {
      console.error('Errore nell\'aggiornamento della spesa:', error);
      throw error;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('poker_manual_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setExpenses(expenses.filter(exp => exp.id !== id));
    } catch (error) {
      console.error('Errore nell\'eliminazione della spesa:', error);
      throw error;
    }
  };

  return { expenses, loading, addExpense, updateExpense, deleteExpense };
}