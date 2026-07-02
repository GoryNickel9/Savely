// @ts-ignore - Deno is available in Supabase Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface RecurringExpense {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  week_interval: number | null;
  next_due_date: string;
  is_active: boolean;
}

function calculateNextDueDate(currentDate: string, frequency: RecurringFrequency, weekInterval = 1): string {
  const date = new Date(currentDate + 'T00:00:00');
  const originalDay = date.getDate();

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7 * weekInterval);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      if (date.getDate() !== originalDay) date.setDate(0);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      if (date.getDate() !== originalDay) date.setDate(0);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      if (date.getDate() !== originalDay) date.setDate(0);
      break;
  }

  // Format as YYYY-MM-DD in local time (avoid UTC shift from toISOString)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * S-3: verifica l'header x-cron-secret contro il valore in cron_config.
 * Endpoint non più richiamabile anonimamente (impedisce abuso/DoS).
 */
async function isCronAuthorized(supabase: any, req: Request): Promise<boolean> {
  const provided = req.headers.get('x-cron-secret');
  if (!provided) return false;
  const { data } = await supabase
    .from('cron_config')
    .select('value')
    .eq('key', 'cron_secret')
    .maybeSingle();
  const expected = data?.value;
  // Rifiuta il placeholder: forza l'operatore a impostare un secret reale
  return !!expected
    && expected !== 'CHANGE_ME_GENERATE_A_RANDOM_SECRET'
    && provided === expected;
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // S-3: richiede il secret cron
    if (!(await isCronAuthorized(supabase, req))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { data: dueExpenses, error: fetchError } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('is_active', true)
      .lte('next_due_date', todayStr)
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Error fetching due expenses:', fetchError);
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
    }

    if (!dueExpenses || dueExpenses.length === 0) {
      console.log('No due recurring expenses today.');
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processed = 0;

    for (const expense of dueExpenses as RecurringExpense[]) {
        const dueDate = new Date(expense.next_due_date + 'T00:00:00');
        const month = dueDate.getMonth() + 1;
        const year = dueDate.getFullYear();
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        // Primo giorno del MESE SUCCESSIVO (timezone-safe, niente date invalide)
        const nextMonth = month % 12 + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

        // Idempotency: skip if a transaction already exists for this expense in this month
        const { data: existing, error: existError } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', expense.user_id)
          .eq('description', expense.name)
          .gte('date', monthStart)
          .lt('date', monthEnd)
          .is('deleted_at', null)
          .maybeSingle();

        if (existError) {
          console.error(`Idempotency check failed for "${expense.name}":`, existError);
        }

        if (!existing && !existError) {
        const { error: insertError } = await supabase.from('transactions').insert({
          user_id: expense.user_id,
          type: 'expense',
          amount: expense.amount,
          currency: expense.currency,
          category_id: expense.category_id,
          description: expense.name,
          date: expense.next_due_date,
        });

        if (insertError) {
          console.error(`Failed to insert transaction for expense "${expense.name}":`, insertError);
          continue;
        }
        processed++;
        console.log(`✓ Created transaction for "${expense.name}" (${expense.next_due_date})`);
      }

      // Advance next_due_date regardless (handles catch-up if cron was down)
      const nextDate = calculateNextDueDate(
        expense.next_due_date,
        expense.frequency,
        expense.week_interval ?? 1,
      );

      await supabase
        .from('recurring_expenses')
        .update({ next_due_date: nextDate })
        .eq('id', expense.id);
    }

    console.log(`Recurring expenses processed: ${processed}/${dueExpenses.length}`);
    return new Response(JSON.stringify({ processed, total: dueExpenses.length }), { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
