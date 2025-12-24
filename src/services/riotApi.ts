import type { Region } from '../types';
import { supabase } from '../lib/supabase';

// Riot API Types
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface RiotSummoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface RiotMatch {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation: number;
    gameDuration: number;
    gameMode: string;
    participants: RiotMatchParticipant[];
  };
}

export interface RiotMatchParticipant {
  puuid: string;
  championName: string;
  championId: number;
  teamPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  totalMinionsKilled: number;
  goldEarned: number;
}

export interface ChampionMastery {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
  championPointsSinceLastLevel: number;
  championPointsUntilNextLevel: number;
  tokensEarned: number;
}

// Region routing values for Riot API
const REGION_ROUTING: Record<Region, { platform: string; regional: string }> = {
  'EUW1': { platform: 'euw1', regional: 'europe' },
  'EUN1': { platform: 'eun1', regional: 'europe' },
  'NA1': { platform: 'na1', regional: 'americas' },
  'BR1': { platform: 'br1', regional: 'americas' },
  'LA1': { platform: 'la1', regional: 'americas' },
  'LA2': { platform: 'la2', regional: 'americas' },
  'KR': { platform: 'kr', regional: 'asia' },
  'JP1': { platform: 'jp1', regional: 'asia' },
  'OC1': { platform: 'oc1', regional: 'sea' },
  'PH2': { platform: 'ph2', regional: 'sea' },
  'SG2': { platform: 'sg2', regional: 'sea' },
  'TH2': { platform: 'th2', regional: 'sea' },
  'TW2': { platform: 'tw2', regional: 'sea' },
  'VN2': { platform: 'vn2', regional: 'sea' },
  'TR1': { platform: 'tr1', regional: 'europe' },
  'RU': { platform: 'ru', regional: 'europe' },
};

const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

if (!RIOT_API_KEY) {
  console.warn('Riot API key not found in environment variables');
}

class RiotApiService {
  private baseHeaders = {
    'X-Riot-Token': RIOT_API_KEY || '',
  };

  private requestQueue: Promise<unknown>[] = [];
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 200; // Minimum interval between requests in ms

  /**
   * Rate-limited fetch with retry logic
   */
  private async rateLimitedFetch(url: string, retries = 3): Promise<Response> {
    // Wait for minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    let lastError: Error | null = null;
    let lastStatus: number | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, { headers: this.baseHeaders });
        lastStatus = response.status;

        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
          console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }

    // If we exhausted retries due to 429, throw specific error
    if (lastStatus === 429) {
      throw new Error('API_RATE_LIMIT');
    }

    throw lastError || new Error('Failed after retries');
  }

  /**
   * Fetch account PUUID by Riot ID (gameName#tagLine)
   */
  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    region: Region
  ): Promise<RiotAccount> {
    const routing = REGION_ROUTING[region];
    const url = `https://${routing.regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

    const response = await this.rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Account not found: ${gameName}#${tagLine}`);
      }
      throw new Error(`Failed to fetch account: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch summoner data by PUUID
   */
  async getSummonerByPuuid(
    puuid: string,
    region: Region
  ): Promise<RiotSummoner> {
    const routing = REGION_ROUTING[region];
    const url = `https://${routing.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;

    const response = await this.rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Summoner not found for PUUID: ${puuid}`);
      }
      throw new Error(`Failed to fetch summoner: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch match IDs for a player
   */
  async getMatchIdsByPuuid(
    puuid: string,
    region: Region,
    count: number = 20,
    options?: {
      startTime?: number;
      endTime?: number;
      queue?: number; // 420 = Ranked Solo/Duo, 440 = Ranked Flex
    }
  ): Promise<string[]> {
    const routing = REGION_ROUTING[region];
    const params = new URLSearchParams({
      count: count.toString(),
      ...(options?.startTime && { startTime: Math.floor(options.startTime / 1000).toString() }),
      ...(options?.endTime && { endTime: Math.floor(options.endTime / 1000).toString() }),
      ...(options?.queue && { queue: options.queue.toString() }),
    });

    const url = `https://${routing.regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`;

    const response = await this.rateLimitedFetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch match IDs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch detailed match data
   */
  async getMatchById(matchId: string, region: Region): Promise<RiotMatch> {
    const routing = REGION_ROUTING[region];
    const url = `https://${routing.regional}.api.riotgames.com/lol/match/v5/matches/${matchId}`;

    const response = await this.rateLimitedFetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch match: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Batch fetch player data (PUUID and summoner info)
   */
  async fetchPlayerData(gameName: string, tagLine: string, region: Region) {
    try {
      // Check cache first for PUUID
      const { data: cachedPlayer, error: cacheError } = await supabase
        .from('player_cache_meta')
        .select('*')
        .eq('game_name', gameName.toLowerCase())
        .eq('tag_line', tagLine.toLowerCase())
        .eq('region', region)
        .maybeSingle();

      if (cachedPlayer && !cacheError) {
        console.log(`[PlayerCache] Found cached PUUID for ${gameName}#${tagLine}`);
        return {
          puuid: cachedPlayer.puuid,
          summonerId: '', // We don't cache this
          summonerLevel: cachedPlayer.summoner_level || 0,
          profileIconId: 0, // We don't cache this
        };
      }

      // Not in cache, fetch from API
      console.log(`[PlayerCache] Fetching from API for ${gameName}#${tagLine}`);

      // Step 1: Get PUUID from Riot ID
      const account = await this.getAccountByRiotId(gameName, tagLine, region);

      // Step 2: Get summoner data from PUUID
      const summoner = await this.getSummonerByPuuid(account.puuid, region);

      // Cache the player info for future lookups
      await supabase
        .from('player_cache_meta')
        .upsert({
          puuid: account.puuid,
          game_name: gameName.toLowerCase(),
          tag_line: tagLine.toLowerCase(),
          region: region,
          summoner_level: summoner.summonerLevel,
          last_fetch_at: new Date().toISOString(),
        }, {
          onConflict: 'game_name,tag_line,region'
        });

      console.log(`[PlayerCache] Cached player info for ${gameName}#${tagLine}`);

      return {
        puuid: account.puuid,
        summonerId: summoner.id,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId,
      };
    } catch (error) {
      console.error(`Failed to fetch player data for ${gameName}#${tagLine}:`, error);
      throw error;
    }
  }

  /**
   * Fetch champion mastery data for a player
   */
  async getChampionMastery(
    puuid: string,
    region: Region
  ): Promise<ChampionMastery[]> {
    const routing = REGION_ROUTING[region];
    const url = `https://${routing.platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`;

    const response = await this.rateLimitedFetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch champion mastery: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch recent ranked matches for a player
   */
  async fetchPlayerMatches(
    puuid: string,
    region: Region,
    count: number = 60,
    options?: {
      startTime?: number;
      queue?: number;
    }
  ): Promise<RiotMatch[]> {
    try {
      // Step 1: Get match IDs (filtered by queue and time)
      const matchIds = await this.getMatchIdsByPuuid(puuid, region, count, options);

      // Step 2: Fetch match details in batches to avoid rate limiting
      // Batch size of 3 matches at a time for better speed while staying safe
      const batchSize = 3;
      const matches: RiotMatch[] = [];

      for (let i = 0; i < matchIds.length; i += batchSize) {
        const batch = matchIds.slice(i, i + batchSize);
        const batchMatches = await Promise.all(
          batch.map((matchId) => this.getMatchById(matchId, region))
        );
        matches.push(...batchMatches);
      }

      return matches;
    } catch (error) {
      console.error(`Failed to fetch matches for PUUID ${puuid}:`, error);
      throw error;
    }
  }

  /**
   * Fetch recent ranked matches with progressive updates via callback
   */
  async fetchPlayerMatchesProgressive(
    puuid: string,
    region: Region,
    onProgress: (matches: RiotMatch[], masteryData?: ChampionMastery[]) => void,
    count: number = 60,
    options?: {
      startTime?: number;
      queue?: number;
    }
  ): Promise<{ matches: RiotMatch[]; masteryData: ChampionMastery[] }> {
    try {
      // Start fetching match IDs and mastery data in parallel
      const [matchIds, masteryData] = await Promise.all([
        this.getMatchIdsByPuuid(puuid, region, count, options),
        this.getChampionMastery(puuid, region)
      ]);

      // Fetch match details in batches with progress updates
      const batchSize = 3;
      const matches: RiotMatch[] = [];

      for (let i = 0; i < matchIds.length; i += batchSize) {
        const batch = matchIds.slice(i, i + batchSize);
        const batchMatches = await Promise.all(
          batch.map((matchId) => this.getMatchById(matchId, region))
        );
        matches.push(...batchMatches);

        // Call progress callback after each batch
        onProgress([...matches], masteryData);
      }

      // Cache all fetched matches
      await this.cacheMatches(matches, puuid, region, options?.queue || 420);

      return { matches, masteryData };
    } catch (error) {
      console.error(`Failed to fetch matches for PUUID ${puuid}:`, error);
      throw error;
    }
  }

  /**
   * Analyze champion statistics from match history, optionally merging with mastery data
   */
  analyzeChampionStats(
    matches: RiotMatch[],
    playerPuuid: string,
    masteryData?: ChampionMastery[]
  ) {
    const championMap = new Map<number, {
      championId: number;
      championName: string;
      games: number;
      wins: number;
      losses: number;
      totalKills: number;
      totalDeaths: number;
      totalAssists: number;
      masteryPoints?: number;
      masteryLevel?: number;
    }>();

    matches.forEach(match => {
      const participant = match.info.participants.find(p => p.puuid === playerPuuid);
      if (!participant) return;

      const existing = championMap.get(participant.championId) || {
        championId: participant.championId,
        championName: participant.championName,
        games: 0,
        wins: 0,
        losses: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
      };

      existing.games++;
      existing.totalKills += participant.kills;
      existing.totalDeaths += participant.deaths;
      existing.totalAssists += participant.assists;

      if (participant.win) {
        existing.wins++;
      } else {
        existing.losses++;
      }

      championMap.set(participant.championId, existing);
    });

    // Merge with mastery data if provided
    if (masteryData) {
      masteryData.forEach(mastery => {
        const existing = championMap.get(mastery.championId);
        if (existing) {
          existing.masteryPoints = mastery.championPoints;
          existing.masteryLevel = mastery.championLevel;
        }
      });
    }

    // Convert to array and calculate win rates and KDA
    return Array.from(championMap.values()).map(champ => {
      const avgKills = champ.games > 0 ? champ.totalKills / champ.games : 0;
      const avgDeaths = champ.games > 0 ? champ.totalDeaths / champ.games : 0;
      const avgAssists = champ.games > 0 ? champ.totalAssists / champ.games : 0;
      const kda = avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : avgKills + avgAssists;

      return {
        ...champ,
        winRate: champ.games > 0 ? Math.round((champ.wins / champ.games) * 100) : 0,
        avgKills: Math.round(avgKills * 10) / 10,
        avgDeaths: Math.round(avgDeaths * 10) / 10,
        avgAssists: Math.round(avgAssists * 10) / 10,
        kda: Math.round(kda * 100) / 100,
      };
    }).sort((a, b) => {
      // Sort by: 1. Games played, 2. Win rate, 3. KDA
      if (b.games !== a.games) return b.games - a.games;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.kda - a.kda;
    });
  }

  /**
   * Cache-first match fetching with background refresh
   * 1. Check database for cached matches
   * 2. Return cached data immediately if available
   * 3. Queue background fetch for new matches (only if there are new games)
   */
  async fetchMatchesWithCache(
    puuid: string,
    region: Region,
    onProgress: (matches: RiotMatch[], masteryData?: ChampionMastery[], isFromCache?: boolean) => void,
    requestedCount: number = 60,
    options?: {
      startTime?: number;
      queue?: number;
    }
  ): Promise<{ matches: RiotMatch[]; masteryData: ChampionMastery[] }> {
    try {
      // Step 1: Check if we have cached data (fetch ALL cached matches, up to 200)
      const { data: cachedMatches } = await supabase
        .from('cached_matches')
        .select('*')
        .eq('puuid', puuid)
        .eq('region', region)
        .eq('queue_id', options?.queue || 420)
        .order('game_date', { ascending: false })
        .limit(200); // Fetch all cached matches (up to our 200 max)

      console.log(`[Cache] Found ${cachedMatches?.length || 0} cached matches for ${puuid}`);

      // Step 2: If we have cached data, return it immediately
      if (cachedMatches && cachedMatches.length > 0) {
        const reconstructedMatches = this.reconstructMatchesFromCache(cachedMatches);

        // Try to fetch mastery data, but don't fail if it errors (rate limited)
        let masteryData: ChampionMastery[] = [];
        try {
          masteryData = await this.getChampionMastery(puuid, region);
        } catch (error) {
          console.warn(`[Cache] Failed to fetch mastery data (rate limited?), continuing with cached matches only`);
        }

        // Call progress callback with cached data
        onProgress(reconstructedMatches, masteryData, true);

        // Step 3: Check for new matches in background (don't await, silently fail if rate limited)
        this.refreshCacheInBackground(puuid, region, cachedMatches[0]?.game_date, options, onProgress);

        return { matches: reconstructedMatches, masteryData };
      }

      // Step 4: No cached data, fetch from API (first time lookup)
      console.log(`[Cache] No cached data, fetching from API...`);
      return await this.fetchPlayerMatchesProgressive(puuid, region, onProgress, requestedCount, options);

    } catch (error) {
      console.error(`[Cache] Error in fetchMatchesWithCache:`, error);

      // Try one more time to get cached data in case of transient error
      try {
        const { data: cachedMatches } = await supabase
          .from('cached_matches')
          .select('*')
          .eq('puuid', puuid)
          .eq('region', region)
          .eq('queue_id', options?.queue || 420)
          .order('game_date', { ascending: false })
          .limit(200);

        if (cachedMatches && cachedMatches.length > 0) {
          console.log(`[Cache] Recovered ${cachedMatches.length} cached matches on retry`);
          const reconstructedMatches = this.reconstructMatchesFromCache(cachedMatches);
          onProgress(reconstructedMatches, [], true);
          return { matches: reconstructedMatches, masteryData: [] };
        }
      } catch (retryError) {
        console.error(`[Cache] Failed to recover cached data:`, retryError);
      }

      // Last resort: Try direct API fetch (will throw API_RATE_LIMIT if overloaded)
      return await this.fetchPlayerMatchesProgressive(puuid, region, onProgress, requestedCount, options);
    }
  }

  /**
   * Background refresh - only fetch if there are NEW matches
   */
  private async refreshCacheInBackground(
    puuid: string,
    region: Region,
    mostRecentCachedDate: string | null,
    options?: { startTime?: number; queue?: number },
    onProgress?: (matches: RiotMatch[], masteryData?: ChampionMastery[], isFromCache?: boolean) => void
  ): Promise<void> {
    try {
      // Get the most recent match ID from Riot API (just 1 match to check)
      const recentMatchIds = await this.getMatchIdsByPuuid(puuid, region, 1, options);

      if (recentMatchIds.length === 0) {
        console.log(`[Cache] No matches found for ${puuid}`);
        return;
      }

      const mostRecentMatchId = recentMatchIds[0];

      // Check if this match is already in our cache
      const { data: existingMatch } = await supabase
        .from('cached_matches')
        .select('match_id')
        .eq('match_id', mostRecentMatchId)
        .eq('puuid', puuid)
        .single();

      if (existingMatch) {
        console.log(`[Cache] No new matches for ${puuid}, cache is up to date`);
        return; // No new matches, don't hit the API
      }

      console.log(`[Cache] New matches detected for ${puuid}, fetching up to 33...`);

      // There are new matches! Fetch up to 33 new ones
      const startTime = mostRecentCachedDate
        ? new Date(mostRecentCachedDate).getTime() + 1
        : options?.startTime;

      const newMatchIds = await this.getMatchIdsByPuuid(puuid, region, 33, {
        ...options,
        startTime
      });

      if (newMatchIds.length === 0) {
        console.log(`[Cache] No new matches to fetch`);
        return;
      }

      // Fetch new matches in batches
      const batchSize = 3;
      const newMatches: RiotMatch[] = [];

      for (let i = 0; i < newMatchIds.length; i += batchSize) {
        const batch = newMatchIds.slice(i, i + batchSize);
        const batchMatches = await Promise.all(
          batch.map(id => this.getMatchById(id, region))
        );
        newMatches.push(...batchMatches);
      }

      // Cache the new matches (maintainMatchCap is called inside cacheMatches)
      await this.cacheMatches(newMatches, puuid, region, options?.queue || 420);

      console.log(`[Cache] Cached ${newMatches.length} new matches for ${puuid}`);

      // If callback provided, fetch all cached data and update UI
      if (onProgress) {
        const { data: allCachedMatches } = await supabase
          .from('cached_matches')
          .select('*')
          .eq('puuid', puuid)
          .eq('region', region)
          .eq('queue_id', options?.queue || 420)
          .order('game_date', { ascending: false })
          .limit(200); // Fetch all cached matches

        if (allCachedMatches) {
          const reconstructedMatches = this.reconstructMatchesFromCache(allCachedMatches);
          const masteryData = await this.getChampionMastery(puuid, region);
          onProgress(reconstructedMatches, masteryData, false);
        }
      }

    } catch (error) {
      console.error(`[Cache] Error refreshing cache in background:`, error);
      // Silently fail - we already returned cached data
    }
  }

  /**
   * Maintain rolling window of 200 matches per player
   * Removes oldest matches if we would exceed the cap
   */
  private async maintainMatchCap(
    puuid: string,
    region: Region,
    queueId: number,
    newMatchCount: number
  ): Promise<void> {
    const MAX_MATCHES_PER_PLAYER = 200;

    // Check current match count
    const { count: currentCount } = await supabase
      .from('cached_matches')
      .select('*', { count: 'exact', head: true })
      .eq('puuid', puuid)
      .eq('region', region)
      .eq('queue_id', queueId);

    const totalAfterAdd = (currentCount || 0) + newMatchCount;

    // If adding new matches would exceed 200, remove oldest ones first
    if (totalAfterAdd > MAX_MATCHES_PER_PLAYER) {
      const matchesToRemove = totalAfterAdd - MAX_MATCHES_PER_PLAYER;

      // Get the oldest matches to delete
      const { data: oldestMatches } = await supabase
        .from('cached_matches')
        .select('id')
        .eq('puuid', puuid)
        .eq('region', region)
        .eq('queue_id', queueId)
        .order('game_date', { ascending: true })
        .limit(matchesToRemove);

      if (oldestMatches && oldestMatches.length > 0) {
        const idsToDelete = oldestMatches.map(m => m.id);

        await supabase
          .from('cached_matches')
          .delete()
          .in('id', idsToDelete);

        console.log(`[Cache] Removed ${matchesToRemove} oldest matches to maintain 200 cap`);
      }
    }
  }

  /**
   * Cache matches in Supabase
   */
  private async cacheMatches(
    matches: RiotMatch[],
    puuid: string,
    region: Region,
    queueId: number
  ): Promise<void> {
    const matchRecords = matches.flatMap(match => {
      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (!participant) return [];

      return {
        match_id: match.metadata.matchId,
        puuid,
        region,
        champion_id: participant.championId,
        champion_name: participant.championName,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        win: participant.win,
        game_date: new Date(match.info.gameCreation).toISOString(),
        queue_id: queueId,
      };
    });

    if (matchRecords.length === 0) return;

    // Maintain 200 match cap by removing oldest matches if necessary
    await this.maintainMatchCap(puuid, region, queueId, matchRecords.length);

    const { error } = await supabase
      .from('cached_matches')
      .upsert(matchRecords, {
        onConflict: 'match_id,puuid',
        ignoreDuplicates: true
      });

    if (error) {
      console.error('[Cache] Failed to cache matches:', error);
    } else {
      console.log(`[Cache] Successfully cached ${matchRecords.length} matches`);
    }
  }

  /**
   * Reconstruct RiotMatch objects from cached data
   */
  private reconstructMatchesFromCache(cachedMatches: any[]): RiotMatch[] {
    return cachedMatches.map(cm => ({
      metadata: {
        matchId: cm.match_id,
        participants: [cm.puuid]
      },
      info: {
        gameCreation: new Date(cm.game_date).getTime(),
        gameDuration: 0,
        gameMode: 'RANKED',
        participants: [{
          puuid: cm.puuid,
          championId: cm.champion_id,
          championName: cm.champion_name,
          teamPosition: '',
          kills: cm.kills,
          deaths: cm.deaths,
          assists: cm.assists,
          win: cm.win,
          totalMinionsKilled: 0,
          goldEarned: 0,
        }]
      }
    }));
  }

  /**
   * Load more matches beyond what's currently cached
   * Fetches older matches (before the oldest cached match)
   */
  async loadMoreMatches(
    puuid: string,
    region: Region,
    additionalCount: number = 33,
    options?: {
      startTime?: number;
      endTime?: number;
      queue?: number;
    }
  ): Promise<{ matches: RiotMatch[]; masteryData: ChampionMastery[]; hasMore: boolean }> {
    try {
      const MAX_MATCHES_PER_PLAYER = 200;

      // Check current cached count
      const { count: currentCount } = await supabase
        .from('cached_matches')
        .select('*', { count: 'exact', head: true })
        .eq('puuid', puuid)
        .eq('region', region)
        .eq('queue_id', options?.queue || 420);

      if (currentCount && currentCount >= MAX_MATCHES_PER_PLAYER) {
        // Already at max, return current data
        const masteryData = await this.getChampionMastery(puuid, region);
        const { data: allCached } = await supabase
          .from('cached_matches')
          .select('*')
          .eq('puuid', puuid)
          .eq('region', region)
          .eq('queue_id', options?.queue || 420)
          .order('game_date', { ascending: false });

        const reconstructed = allCached ? this.reconstructMatchesFromCache(allCached) : [];

        return {
          matches: reconstructed,
          masteryData,
          hasMore: false
        };
      }

      // Calculate how many more we can fetch
      const remainingSlots = MAX_MATCHES_PER_PLAYER - (currentCount || 0);
      const fetchCount = Math.min(additionalCount, remainingSlots);

      // Get the oldest cached match to know where to fetch from
      const { data: oldestCached } = await supabase
        .from('cached_matches')
        .select('game_date')
        .eq('puuid', puuid)
        .eq('region', region)
        .eq('queue_id', options?.queue || 420)
        .order('game_date', { ascending: true })
        .limit(1)
        .single();

      // Fetch matches BEFORE the oldest cached match
      const endTime = oldestCached
        ? new Date(oldestCached.game_date).getTime() - 1
        : undefined;

      const matchIds = await this.getMatchIdsByPuuid(puuid, region, fetchCount, {
        ...options,
        endTime // Riot API supports this to fetch older matches
      });

      if (matchIds.length === 0) {
        // No more matches available
        const masteryData = await this.getChampionMastery(puuid, region);

        // Return current cached matches
        const { data: allCached } = await supabase
          .from('cached_matches')
          .select('*')
          .eq('puuid', puuid)
          .eq('region', region)
          .eq('queue_id', options?.queue || 420)
          .order('game_date', { ascending: false });

        const reconstructed = allCached ? this.reconstructMatchesFromCache(allCached) : [];

        return {
          matches: reconstructed,
          masteryData,
          hasMore: false
        };
      }

      // Fetch the older matches in batches
      const batchSize = 3;
      const newMatches: RiotMatch[] = [];

      for (let i = 0; i < matchIds.length; i += batchSize) {
        const batch = matchIds.slice(i, i + batchSize);
        const batchMatches = await Promise.all(
          batch.map(id => this.getMatchById(id, region))
        );
        newMatches.push(...batchMatches);
      }

      // Cache the new older matches
      await this.cacheMatches(newMatches, puuid, region, options?.queue || 420);

      // Fetch all cached matches (old + new)
      const { data: allCached } = await supabase
        .from('cached_matches')
        .select('*')
        .eq('puuid', puuid)
        .eq('region', region)
        .eq('queue_id', options?.queue || 420)
        .order('game_date', { ascending: false });

      const reconstructed = allCached ? this.reconstructMatchesFromCache(allCached) : [];
      const masteryData = await this.getChampionMastery(puuid, region);

      // Check if there might be more matches
      // hasMore is true if: we got the full requested amount AND we haven't hit the 200 cap
      const hasMore = matchIds.length >= fetchCount && reconstructed.length < MAX_MATCHES_PER_PLAYER;

      return {
        matches: reconstructed,
        masteryData,
        hasMore
      };

    } catch (error: any) {
      // Enhanced error handling
      if (error?.status === 429 || error?.message?.includes('429')) {
        throw new Error('API_RATE_LIMIT');
      } else if (error?.status === 503 || error?.message?.includes('503')) {
        throw new Error('API_UNAVAILABLE');
      } else if (error?.status >= 500) {
        throw new Error('API_SERVER_ERROR');
      }

      console.error(`[LoadMore] Error loading more matches:`, error);
      throw error;
    }
  }
}

export const riotApi = new RiotApiService();
