-- Bảng nguồn tin
create table if not exists sources (
  id bigint generated always as identity primary key,
  name text not null unique,
  base_url text not null,
  source_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bài viết thô đã lấy về
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  source_id bigint not null references sources(id),
  url text not null unique,
  title text not null,
  published_at timestamptz,
  scraped_at timestamptz not null default now(),
  raw_text text,
  clean_text text,
  author_name text,
  article_type text,
  is_promotional boolean not null default false,
  keep_article boolean not null default true,
  importance_score int,
  importance_level text,
  status text not null default 'new'
);

-- Kết quả tóm tắt chuẩn hoá
create table if not exists article_summaries (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references articles(id) on delete cascade,
  summary_short text,
  what_it_really_says text,
  why_it_matters text,
  easy_explanation text,
  key_takeaway text,
  caution_note text,
  conclusion_text text,
  table_json jsonb,
  diagram_json jsonb,
  output_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bản tin sáng theo ngày
create table if not exists daily_digests (
  id uuid primary key default gen_random_uuid(),
  digest_date date not null unique,
  title text not null,
  intro_text text,
  digest_json jsonb,
  created_at timestamptz not null default now()
);

-- Liên kết bài nào nằm trong bản tin ngày nào
create table if not exists digest_articles (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid not null references daily_digests(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  rank_order int not null default 0,
  unique (digest_id, article_id)
);

-- Chat hỏi lại trên từng bài
create table if not exists article_chat_messages (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message_text text not null,
  created_at timestamptz not null default now()
);

-- Dữ liệu khởi tạo 2 nguồn tin
insert into sources (name, base_url, source_type)
values
  ('VnEconomy', 'https://vneconomy.vn/', 'rss'),
  ('Nghien cuu Quoc te', 'https://nghiencuuquocte.org/', 'web')
on conflict (name) do nothing;
