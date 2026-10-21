-- ============================================================
-- «Разгрузка» — схема базы Supabase
-- ------------------------------------------------------------
-- Как применить:
-- 1. Создайте проект на supabase.com (бесплатный тариф).
-- 2. В левом меню откройте SQL Editor → New query.
-- 3. Вставьте весь этот файл и нажмите Run.
-- 4. Затем откройте seed.sql и выполните его так же —
--    он заполнит тексты и цены.
--
-- Файл можно запускать повторно: он не создаёт дубликаты.
-- ============================================================

-- ---------- Таблицы ----------

create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  alt text not null default '',
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service text not null default 'unknown',
  preferred_time text not null default '',
  comment text not null default '',
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists gallery_sort_order_idx on public.gallery (sort_order);
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);

-- ---------- Автообновление updated_at ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_content_updated_at on public.site_content;
create trigger site_content_updated_at
before update on public.site_content
for each row execute function public.set_updated_at();

-- ---------- Права на таблицы ----------

grant usage on schema public to anon, authenticated;

grant select on public.site_content to anon;
grant select on public.gallery to anon;
grant insert on public.bookings to anon;

grant select, insert, update, delete on public.site_content to authenticated;
grant select, insert, update, delete on public.gallery to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;

-- ---------- Защита строк (RLS) ----------

alter table public.site_content enable row level security;
alter table public.gallery enable row level security;
alter table public.bookings enable row level security;

-- Тексты: читают все, меняет только вошедший администратор
drop policy if exists "content public read" on public.site_content;
create policy "content public read"
on public.site_content for select
to anon, authenticated
using (true);

drop policy if exists "content admin write" on public.site_content;
create policy "content admin write"
on public.site_content for all
to authenticated
using (true)
with check (true);

-- Галерея: читают все, меняет только администратор
drop policy if exists "gallery public read" on public.gallery;
create policy "gallery public read"
on public.gallery for select
to anon, authenticated
using (true);

drop policy if exists "gallery admin write" on public.gallery;
create policy "gallery admin write"
on public.gallery for all
to authenticated
using (true)
with check (true);

-- Заявки: создать может любой посетитель,
-- читать, менять и удалять — только администратор
drop policy if exists "bookings public insert" on public.bookings;
create policy "bookings public insert"
on public.bookings for insert
to anon, authenticated
with check (status = 'new');

drop policy if exists "bookings admin read" on public.bookings;
create policy "bookings admin read"
on public.bookings for select
to authenticated
using (true);

drop policy if exists "bookings admin update" on public.bookings;
create policy "bookings admin update"
on public.bookings for update
to authenticated
using (true)
with check (true);

drop policy if exists "bookings admin delete" on public.bookings;
create policy "bookings admin delete"
on public.bookings for delete
to authenticated
using (true);

-- ---------- Хранилище фотографий ----------

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

drop policy if exists "gallery files public read" on storage.objects;
create policy "gallery files public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'gallery');

drop policy if exists "gallery files admin insert" on storage.objects;
create policy "gallery files admin insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'gallery');

drop policy if exists "gallery files admin update" on storage.objects;
create policy "gallery files admin update"
on storage.objects for update
to authenticated
using (bucket_id = 'gallery')
with check (bucket_id = 'gallery');

drop policy if exists "gallery files admin delete" on storage.objects;
create policy "gallery files admin delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'gallery');

-- ============================================================
-- Готово. Дальше:
-- 1. Authentication → Users → Add user — создайте себя
--    (e-mail и пароль). Это единственный администратор.
-- 2. Authentication → Providers → Email — можно отключить
--    "Confirm email", чтобы вход работал сразу.
-- 3. Project Settings → API — скопируйте Project URL и
--    anon public key в assets/js/config.js.
-- ============================================================
