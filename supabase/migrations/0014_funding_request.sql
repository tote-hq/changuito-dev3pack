-- One funding link. The shopper app inserts the row. The pay app reads it
-- and fills the ramp columns when the payer opens the link.
--
-- RLS on, no policies. The workers connect with the service role, which
-- bypasses RLS. The anon key cannot read a cart total.

create table funding_request (
  id             uuid        primary key,
  wallet         text        not null,
  amount_ars     numeric     not null,
  concept        text        not null,
  expires_at     timestamptz not null,
  ramp_order_id  text,
  ramp_link      text,
  quoted_usdc    numeric,
  status         text        not null default 'open',
  created_at     timestamptz not null default now()
);

alter table funding_request enable row level security;
