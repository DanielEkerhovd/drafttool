-- Drop the old player_cache_meta table and recreate with new columns
DROP TABLE IF EXISTS player_cache_meta CASCADE;

-- Create table to track player info and enable PUUID lookup by name
CREATE TABLE player_cache_meta (
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
CREATE INDEX idx_player_name_region ON player_cache_meta(game_name, tag_line, region);

-- Enable Row Level Security
ALTER TABLE player_cache_meta ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
DROP POLICY IF EXISTS "Allow all operations on player_cache_meta" ON player_cache_meta;
CREATE POLICY "Allow all operations on player_cache_meta" ON player_cache_meta
  FOR ALL USING (true) WITH CHECK (true);
