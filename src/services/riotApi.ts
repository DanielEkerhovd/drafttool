import type { Region } from '../types';

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

    const response = await fetch(url, {
      headers: this.baseHeaders,
    });

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

    const response = await fetch(url, {
      headers: this.baseHeaders,
    });

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
    startTime?: number
  ): Promise<string[]> {
    const routing = REGION_ROUTING[region];
    const params = new URLSearchParams({
      count: count.toString(),
      ...(startTime && { startTime: Math.floor(startTime / 1000).toString() }),
    });

    const url = `https://${routing.regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`;

    const response = await fetch(url, {
      headers: this.baseHeaders,
    });

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

    const response = await fetch(url, {
      headers: this.baseHeaders,
    });

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
      // Step 1: Get PUUID from Riot ID
      const account = await this.getAccountByRiotId(gameName, tagLine, region);

      // Step 2: Get summoner data from PUUID
      const summoner = await this.getSummonerByPuuid(account.puuid, region);

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
   * Fetch recent matches for a player
   */
  async fetchPlayerMatches(
    puuid: string,
    region: Region,
    count: number = 20,
    startTime?: number
  ): Promise<RiotMatch[]> {
    try {
      // Step 1: Get match IDs
      const matchIds = await this.getMatchIdsByPuuid(puuid, region, count, startTime);

      // Step 2: Fetch all match details in parallel
      const matches = await Promise.all(
        matchIds.map((matchId) => this.getMatchById(matchId, region))
      );

      return matches;
    } catch (error) {
      console.error(`Failed to fetch matches for PUUID ${puuid}:`, error);
      throw error;
    }
  }
}

export const riotApi = new RiotApiService();
