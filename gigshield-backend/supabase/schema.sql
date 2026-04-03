-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- WORKERS
-- ─────────────────────────────────────────
create table workers (
  id              uuid primary key default uuid_generate_v4(),
  phone           text unique not null,
  name            text,
  partner_id      text unique,               -- Zepto/Blinkit partner ID
  platform        text check (platform in ('zepto', 'blinkit')),
  zone            text not null,             -- e.g. 'Koramangala'
  pin_code        text,
  avg_active_hrs  numeric(4,2) default 8.0,  -- hours per day
  avg_weekly_earn numeric(10,2) default 4000,
  account_age_wk  integer default 0,         -- weeks since registration
  fcm_token       text,                      -- for push notifications
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- POLICIES
-- ─────────────────────────────────────────
create table policies (
  id                uuid primary key default uuid_generate_v4(),
  worker_id         uuid references workers(id) on delete cascade,
  plan              text check (plan in ('basic', 'standard', 'pro')) not null,
  base_premium      numeric(6,2) not null,    -- ₹49, ₹79, or ₹99
  multiplier        numeric(5,4) default 1.0, -- from XGBoost model
  final_premium     numeric(6,2) not null,    -- base × multiplier
  max_weekly_payout numeric(8,2) not null,    -- ₹500, ₹900, or ₹1400
  max_coverage_hrs  integer not null,         -- 8, 15, or 22
  status            text check (status in ('active', 'expired', 'cancelled')) default 'active',
  start_date        date not null default current_date,
  end_date          date not null,            -- always start_date + 7 days
  auto_renew        boolean default true,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- TRIGGER EVENTS
-- (every time a parametric trigger fires, log it here)
-- ─────────────────────────────────────────
create table trigger_events (
  id               uuid primary key default uuid_generate_v4(),
  trigger_type     text check (trigger_type in (
                     'heavy_rainfall', 'severe_aqi', 'extreme_heat',
                     'platform_outage', 'local_curfew'
                   )) not null,
  zone             text not null,
  reading_value    numeric(10,2),             -- e.g. 18.5 mm/hr or AQI 320
  reading_unit     text,                      -- 'mm/hr', 'AQI', '°C', etc.
  threshold_value  numeric(10,2),             -- e.g. 15 for rainfall
  disruption_start timestamptz not null,
  disruption_end   timestamptz,               -- null if still active
  is_active        boolean default true,
  data_source      text,                      -- 'openweathermap', 'openaq', etc.
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────
-- CLAIMS
-- ─────────────────────────────────────────
create table claims (
  id                  uuid primary key default uuid_generate_v4(),
  claim_number        text unique not null,   -- e.g. GS-2024-0412
  worker_id           uuid references workers(id) on delete cascade,
  policy_id           uuid references policies(id),
  trigger_event_id    uuid references trigger_events(id),
  trigger_type        text not null,
  zone                text not null,
  disruption_start    timestamptz not null,
  disruption_end      timestamptz,
  disruption_hours    numeric(6,2),           -- calculated when disruption ends
  hourly_rate         numeric(8,2),           -- worker avg weekly earn / avg active hrs
  payout_amount       numeric(8,2),           -- disruption_hours × hourly_rate, capped
  fraud_score         integer default 0,      -- 0–100 from ML fraud model
  status              text check (status in (
                        'pending', 'verifying', 'approved',
                        'soft_hold', 'manual_review', 'rejected', 'paid'
                      )) default 'pending',
  rejection_reason    text,
  upi_id              text,                   -- worker's UPI for payout
  payout_reference    text,                   -- Razorpay transfer ID
  paid_at             timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─────────────────────────────────────────
-- FRAUD FLAGS
-- (detailed fraud signal log per claim)
-- ─────────────────────────────────────────
create table fraud_flags (
  id              uuid primary key default uuid_generate_v4(),
  claim_id        uuid references claims(id) on delete cascade,
  worker_id       uuid references workers(id),
  signal_type     text not null,             -- e.g. 'mock_location', 'zone_mismatch'
  signal_value    numeric(6,2),              -- score contribution
  description     text,
  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────
-- PAYOUTS
-- ─────────────────────────────────────────
create table payouts (
  id               uuid primary key default uuid_generate_v4(),
  claim_id         uuid references claims(id),
  worker_id        uuid references workers(id),
  amount           numeric(8,2) not null,
  upi_id           text not null,
  razorpay_id      text,
  status           text check (status in ('initiated', 'success', 'failed')) default 'initiated',
  initiated_at     timestamptz default now(),
  completed_at     timestamptz
);

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
create index idx_policies_worker_id on policies(worker_id);
create index idx_claims_worker_id on claims(worker_id);
create index idx_claims_status on claims(status);
create index idx_trigger_events_zone on trigger_events(zone);
create index idx_trigger_events_active on trigger_events(is_active);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Workers can only see their own data
-- ─────────────────────────────────────────
alter table workers enable row level security;
alter table policies enable row level security;
alter table claims enable row level security;
alter table payouts enable row level security;

-- Workers read their own row only
create policy "worker_read_own" on workers
  for select using (auth.uid()::text = id::text);

-- Workers read their own policies
create policy "worker_read_own_policies" on policies
  for select using (
    worker_id in (
      select id from workers where auth.uid()::text = id::text
    )
  );

-- Workers read their own claims
create policy "worker_read_own_claims" on claims
  for select using (
    worker_id in (
      select id from workers where auth.uid()::text = id::text
    )
  );

-- Service role bypasses RLS (for backend operations)
-- This is automatic for SUPABASE_SERVICE_ROLE_KEY
