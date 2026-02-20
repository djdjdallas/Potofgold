-- TrendForge Database Schema
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- 1. keyword_buckets: groups of search terms with engagement thresholds
create table if not exists keyword_buckets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  keywords text[] not null default '{}',
  min_likes int not null default 500,
  active boolean not null default true,
  created_at timestamp with time zone default now()
);

-- 2. raw_posts: tweets fetched from X API
create table if not exists raw_posts (
  id uuid primary key default uuid_generate_v4(),
  x_post_id text unique not null,
  content text not null,
  author_handle text not null,
  likes int not null default 0,
  reposts int not null default 0,
  views int not null default 0,
  posted_at timestamp with time zone,
  bucket_id uuid references keyword_buckets(id) on delete set null,
  fetched_at timestamp with time zone default now()
);

-- 3. analyzed_ideas: Claude's analysis of each post
create table if not exists analyzed_ideas (
  id uuid primary key default uuid_generate_v4(),
  raw_post_id uuid references raw_posts(id) on delete cascade,
  capability_used text,
  emotional_hook text,
  adjacent_opportunities text[] default '{}',
  build_difficulty int check (build_difficulty between 1 and 5),
  earliness_score int check (earliness_score between 1 and 10),
  earliness_reasoning text,
  recommended_mvp text,
  analyzed_at timestamp with time zone default now(),
  included_in_digest boolean not null default false
);

-- Indexes for common queries
create index if not exists idx_raw_posts_bucket on raw_posts(bucket_id);
create index if not exists idx_raw_posts_posted_at on raw_posts(posted_at desc);
create index if not exists idx_analyzed_ideas_earliness on analyzed_ideas(earliness_score desc);
create index if not exists idx_analyzed_ideas_digest on analyzed_ideas(included_in_digest);
create index if not exists idx_analyzed_ideas_analyzed_at on analyzed_ideas(analyzed_at desc);

-- Seed some default keyword buckets
insert into keyword_buckets (name, keywords, min_likes, active) values
  ('AI demos', ARRAY['AI demo', 'built with AI', 'AI prototype', 'GPT demo', 'Claude demo'], 500, true),
  ('Shipped products', ARRAY['just shipped', 'just launched', 'side project', 'built in public', 'weekend project'], 500, true),
  ('Creative tech', ARRAY['creative coding', 'generative art', 'cool experiment', 'tech experiment', 'open source'], 300, true),
  ('API launches', ARRAY['new API', 'API launch', 'developer tool', 'devtool launch', 'SDK release'], 200, true);
