import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface PokerNextCut {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  deal: number;
  profit_loss: number;
  created_at: string;
  updated_at: string;
}

export function usePokerNextCut() {
  const { user } = useAuth();
  const [nextCut, setNextCut] = useState<PokerNextCut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setNextCut(null);
      setLoading(false);
      return;
    }

    fetchNextCut();
  }, [user?.id]);

  const fetchNextCut = async () => {
    try {
      const { data, error } = await supabase
        .from('poker_next_cut')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;
      
      // Se non esiste un record, creane uno di default
      if (!data || data.length === 0) {
        const { data: newRecord, error: insertError } = await supabase
          .from('poker_next_cut')
          .insert({
            user_id: user.id,
            name: 'Next Cut',
            amount: 0,
            deal: 0.55,
            profit_loss: 1804.87
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setNextCut(newRecord);
      } else {
        setNextCut(data[0]);
      }
    } catch (error) {
      console.error('Errore nel caricamento del Next Cut:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDeal = async (deal: number) => {
    if (!nextCut) return;

    try {
      const { data, error } = await supabase
        .from('poker_next_cut')
        .update({ deal })
        .eq('id', nextCut.id)
        .select()
        .single();

      if (error) throw error;
      setNextCut(data);
      return data;
    } catch (error) {
      console.error('Errore nell\'aggiornamento del deal:', error);
      throw error;
    }
  };

  const updateProfitLoss = async (profitLoss: number) => {
    if (!nextCut) return;

    try {
      const { data, error } = await supabase
        .from('poker_next_cut')
        .update({ profit_loss: profitLoss })
        .eq('id', nextCut.id)
        .select()
        .single();

      if (error) throw error;
      setNextCut(data);
      return data;
    } catch (error) {
      console.error('Errore nell\'aggiornamento del profit/loss:', error);
      throw error;
    }
  };

  const updateAmount = async (amount: number) => {
    if (!nextCut) return;

    try {
      const { data, error } = await supabase
        .from('poker_next_cut')
        .update({ amount })
        .eq('id', nextCut.id)
        .select()
        .single();

      if (error) throw error;
      setNextCut(data);
      return data;
    } catch (error) {
      console.error('Errore nell\'aggiornamento dell\'amount:', error);
      throw error;
    }
  };

  return { nextCut, loading, updateDeal, updateProfitLoss, updateAmount };
}