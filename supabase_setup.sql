-- ====================================
-- Supabase Match Caching Setup
-- ====================================
-- Run this SQL in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste and Run
-- ====================================

-- Create table for caching individual matches
CREATE TABLE IF NOT EXISTS cached_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  puuid text NOT NULL,
  region text NOT NULL,
  champion_id integer NOT NULL,
  champion_name text NOT NULL,
  kills integer NOT NULL,
  deaths integer NOT NULL,
  assists integer NOT NULL,
  win boolean NOT NULL,
  game_date timestamp NOT NULL,
  fetched_at timestamp NOT NULL DEFAULT now(),
  queue_id integer NOT NULL,

  CONSTRAINT unique_match_player UNIQUE(match_id, puuid)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_puuid_region ON cached_matches(puuid, region);
CREATE INDEX IF NOT EXISTS idx_puuid_game_date ON cached_matches(puuid, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_match_id ON cached_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_fetched_at ON cached_matches(fetched_at);

-- Create table to track player info and enable PUUID lookup by name
CREATE TABLE IF NOT EXISTS player_cache_meta (
  puuid text PRIMARY KEY,
  game_name text NOT NULL,
  tag_line text NOT NULL,
  region text NOT NULL,
  summoner_level integer,
  last_fetch_at timestamp NOT NULL DEFAULT now(),
  total_matches_cached integer NOT NULL DEFAULT 0,
  is_fetching boolean NOT NULL DEFAULT false,
  UNIQUE(game_name, tag_line, region)
);

-- Index for looking up PUUID by name
CREATE INDEX IF NOT EXISTS idx_player_name_region ON player_cache_meta(game_name, tag_line, region);

-- Function to cleanup old matches (run this manually or schedule it)
CREATE OR REPLACE FUNCTION cleanup_old_matches()
RETURNS void AS $$
BEGIN
  DELETE FROM cached_matches
  WHERE fetched_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE cached_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_cache_meta ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth needs)
-- For now, allowing all operations since this is match data that's public via Riot API
DROP POLICY IF EXISTS "Allow all operations on cached_matches" ON cached_matches;
CREATE POLICY "Allow all operations on cached_matches" ON cached_matches
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on player_cache_meta" ON player_cache_meta;
CREATE POLICY "Allow all operations on player_cache_meta" ON player_cache_meta
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================
-- Setup Complete!
-- ====================================
-- Your caching tables are now ready.
-- The app will automatically cache matches as users search for players.
-- ====================================
