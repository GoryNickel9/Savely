import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CoupleConnectionRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CoupleConnection {
  id: string;
  user_a: string;
  user_b: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouplePairStatus {
  myCode: string | null;
  connection: CoupleConnection | null;
  sentRequests: CoupleConnectionRequest[];
  receivedRequests: CoupleConnectionRequest[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useCouplePairStatus() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const queryClient = useQueryClient();
  const enabled = !!user && !!permissions?.couple_expenses;

  // ------------------------------------------------------------------
  // Query
  // ------------------------------------------------------------------
  const { data, isLoading } = useQuery({
    queryKey: ['couple_status', user?.id],
    queryFn: async (): Promise<CouplePairStatus> => {
      const [profileRes, connectionRes, sentRes, receivedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('couple_code')
          .eq('user_id', user!.id)
          .single(),
        supabase
          .from('couple_connections')
          .select('*')
          .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
          .is('revoked_at', null)
          .maybeSingle(),
        supabase
          .from('couple_connection_requests')
          .select('*')
          .eq('sender_id', user!.id)
          .eq('status', 'pending'),
        supabase
          .from('couple_connection_requests')
          .select('*')
          .eq('receiver_id', user!.id)
          .eq('status', 'pending'),
      ]);

      return {
        myCode: (profileRes.data as { couple_code?: string } | null)?.couple_code ?? null,
        connection: (connectionRes.data as CoupleConnection | null) ?? null,
        sentRequests: (sentRes.data as CoupleConnectionRequest[]) ?? [],
        receivedRequests: (receivedRes.data as CoupleConnectionRequest[]) ?? [],
      };
    },
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['couple_status'] });

  // ------------------------------------------------------------------
  // Send request: look up partner by couple_code, then insert request
  // ------------------------------------------------------------------
  const sendRequest = useMutation({
    mutationFn: async (partnerCode: string) => {
      // Point-lookup via SECURITY DEFINER RPC (anti-enumeration)
      const { data: receiverId, error: rpcError } = await supabase.rpc(
        'find_user_by_couple_code',
        { p_code: partnerCode.trim().toUpperCase() }
      );
      if (rpcError) throw rpcError;
      if (!receiverId) throw new Error('Nessun utente trovato con questo codice.');

      if (receiverId === user!.id) {
        throw new Error('Non puoi inviare una richiesta a te stesso.');
      }

      const { error } = await supabase
        .from('couple_connection_requests')
        .insert({ sender_id: user!.id, receiver_id: receiverId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Cancel request (sender → 'cancelled')
  // ------------------------------------------------------------------
  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('couple_connection_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('sender_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Reject request (receiver → 'rejected')
  // ------------------------------------------------------------------
  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('couple_connection_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .eq('receiver_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Accept request (via SECURITY DEFINER RPC — atomically creates connection)
  // ------------------------------------------------------------------
  const acceptRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('accept_couple_request', {
        p_request_id: requestId,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // ------------------------------------------------------------------
  // Revoke connection (soft-revoke: set revoked_at)
  // ------------------------------------------------------------------
  const revokeConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('couple_connections')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', connectionId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    isLoading,
    myCode: data?.myCode ?? null,
    connection: data?.connection ?? null,
    sentRequests: data?.sentRequests ?? [],
    receivedRequests: data?.receivedRequests ?? [],
    sendRequest,
    cancelRequest,
    rejectRequest,
    acceptRequest,
    revokeConnection,
  };
}
