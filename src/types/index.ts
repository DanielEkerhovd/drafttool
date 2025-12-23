// Riot API Types
export type Region =
  | 'EUW1' | 'EUN1' | 'NA1' | 'KR' | 'BR1' | 'JP1'
  | 'LA1' | 'LA2' | 'OC1' | 'TR1' | 'RU' | 'PH2'
  | 'SG2' | 'TH2' | 'TW2' | 'VN2';

export interface RiotID {
  gameName: string;
  tagLine: string;
  region: Region;
}

export interface Player {
  id: string;
  riotId: RiotID;
  puuid?: string;
  summonerId?: string;
  summonerLevel?: number;
  profileIconId?: number;
  isLoading?: boolean;
  error?: string;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  side: 'own' | 'enemy';
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

export interface ChampionStats {
  championId: number;
  championName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  mastery?: ChampionMastery;
  role?: string;
}

export interface PlayerStats {
  player: Player;
  champions: ChampionStats[];
  mostPlayed: ChampionStats[];
}

export interface TeamAnalysis {
  team: Team;
  playerStats: PlayerStats[];
  topChampions: ChampionStats[];
}

export interface ContestedPick {
  championId: number;
  championName: string;
  ownTeamPlayers: string[];
  enemyTeamPlayers: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisSession {
  id: string;
  coachId: string;
  ownTeam: Team;
  enemyTeam: Team;
  createdAt: string;
  updatedAt: string;
  timeRange: TimeRange;
}

export type TimeRange = '1month' | '3months' | '6months' | '1year' | 'all';

export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  days: number | null;
}
