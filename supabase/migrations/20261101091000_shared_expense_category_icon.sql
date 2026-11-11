-- Expose only the source icon, retaining the existing active-connection checks.
-- Appending a column keeps existing view readers compatible.
create or replace view public.shared_expenses_view as
select
  se.id,
  se.connection_id,
  se.original_tx_id,
  se.created_by,
  se.couple_category_name,
  se.split_mode,
  se.partner_amount,
  se.split_percentage,
  se.created_at,
  se.updated_at,
  t.amount as total_amount,
  case when se.split_mode = 'custom' then se.partner_amount
    else round(t.amount / 2.0, 2) end as partner_share_amount,
  case when se.split_mode = 'custom' then round(t.amount - se.partner_amount, 2)
    else round(t.amount / 2.0, 2) end as creator_share_amount,
  case when se.split_mode = 'custom' then se.partner_amount
    else round(t.amount / 2.0, 2) end as my_share_amount,
  t.currency::text as currency,
  t.exchange_rate_eur,
  t.description,
  t.date,
  t.deleted_at as tx_deleted_at,
  c.icon as category_icon
from public.shared_expenses se
join public.transactions t on t.id = se.original_tx_id
left join public.categories c on c.id = t.category_id
  and c.user_id = t.user_id and c.deleted_at is null
where public.is_couple_expenses_enabled()
  and public.is_in_connection(se.connection_id);
