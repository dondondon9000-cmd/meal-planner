create extension if not exists pgcrypto;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login_slug text not null unique,
  passphrase_hash text not null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('human','dog')),
  allergies text[] not null default '{}',
  dietary_needs text[] not null default '{}',
  dislikes text[] not null default '{}',
  notes text,
  sort_order integer not null default 0
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('family','seed','sourced','ai_draft')),
  source_name text,
  source_url text,
  servings numeric not null check (servings > 0),
  prep_minutes integer,
  cook_minutes integer,
  ingredients jsonb not null,
  instructions jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table meal_slots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  meal_date date not null,
  meal_kind text not null check (meal_kind in ('breakfast','lunch','dinner')),
  recipe_id uuid references recipes(id) on delete set null,
  familiar_meal text,
  servings numeric not null check (servings > 0),
  diner_ids uuid[] not null default '{}',
  leftover_from_id uuid references meal_slots(id) on delete set null,
  unique (household_id, meal_date, meal_kind)
);

create table pantry_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  status text not null check (status in ('draft','confirmed','expired')),
  confirmed_items jsonb not null default '[]'::jsonb,
  image_object_keys text[] not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique (household_id, name)
);

create table grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start date not null,
  status text not null default 'active',
  version integer not null default 1,
  unique (household_id, week_start)
);

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references grocery_lists(id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  category text not null,
  store_id uuid references stores(id) on delete set null,
  source_type text not null check (source_type in ('planned_meal','manual','household','pet')),
  checked boolean not null default false,
  needs_review boolean not null default false,
  updated_at timestamptz not null default now()
);

create table item_store_preferences (
  household_id uuid not null references households(id) on delete cascade,
  normalized_item_name text not null,
  store_id uuid not null references stores(id) on delete cascade,
  primary key (household_id, normalized_item_name)
);

create index meal_slots_household_week on meal_slots (household_id, meal_date);
create index grocery_items_list_checked on grocery_items (grocery_list_id, checked);
