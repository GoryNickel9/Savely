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
  const date = new Date(currentDate);
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

  return date.toISOString().split('T')[0];
}

// @ts-ignore
Deno.serve(async (_req: Request) => {
  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    const { data: dueExpenses, error: fetchError } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('is_active', true)
      .lte('next_due_date', today)
      .is('deleted_at', null);

    if (fetchError) {
      console.error('Error fetching due expenses:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!dueExpenses || dueExpenses.length === 0) {
      console.log('No due recurring expenses today.');
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processed = 0;

    for (const expense of dueExpenses as RecurringExpense[]) {
      const dueDate = new Date(expense.next_due_date);
      const month = dueDate.getMonth() + 1;
      const year = dueDate.getFullYear();
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-32`;

      // Idempotency: skip if a transaction already exists for this expense in this month
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', expense.user_id)
        .eq('description', expense.name)
        .gte('date', monthStart)
        .lt('date', monthEnd)
        .is('deleted_at', null)
        .maybeSingle();

      if (!existing) {
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
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), { status: 500 });
  }
});
