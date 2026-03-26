create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text check (role in ('admin', 'organizer', 'shopkeeper', 'user')) default 'user',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can update own profile"
  on public.profiles for update
using (auth.uid() = user_id);

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();
