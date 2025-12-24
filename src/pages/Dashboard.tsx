import { useState, useEffect, useRef, useMemo } from 'react';
import type { Player, Region } from '../types';
import TeamBuilder from '../components/TeamBuilder';
import { useNavbar } from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { riotApi } from '../services/riotApi';
import { championService } from '../services/championService';

const ALL_REGIONS: Region[] = [
  'EUW1', 'EUN1', 'NA1', 'KR', 'BR1', 'JP1',
  'LA1', 'LA2', 'OC1', 'TR1', 'RU', 'PH2',
  'SG2', 'TH2', 'TW2', 'VN2'
];

// Format region name for display (convert API codes to user-facing tags)
const formatRegionName = (region: Region): string => {
  const regionMap: Record<Region, string> = {
    'EUW1': 'EUW',
    'EUN1': 'EUNE',
    'NA1': 'NA',
    'BR1': 'BR',
    'JP1': 'JP',
    'KR': 'KR',
    'LA1': 'LAN',
    'LA2': 'LAS',
    'OC1': 'OCE',
    'TR1': 'TR',
    'RU': 'RU',
    'PH2': 'PH',
    'SG2': 'SG',
    'TH2': 'TH',
    'TW2': 'TW',
    'VN2': 'VN'
  };
  return regionMap[region] || region;
};

interface ChampionData {
  championId: number;
  championName: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
  masteryPoints?: number;
  masteryLevel?: number;
}

interface PlayerChampionAnalysis {
  player: Player;
  champions: ChampionData[];
  isLoading: boolean;
  error?: string;
  totalMatchesCached?: number;
  isLoadingMore?: boolean;
  hasMoreMatches?: boolean;
}

export default function Dashboard() {
  const [ownStarters, setOwnStarters] = useState<Player[]>([]);
  const [ownSubs, setOwnSubs] = useState<Player[]>([]);
  const [enemyStarters, setEnemyStarters] = useState<Player[]>([]);
  const [enemySubs, setEnemySubs] = useState<Player[]>([]);
  const [ownTeamName, setOwnTeamName] = useState<string>('Own Team');
  const [enemyTeamName, setEnemyTeamName] = useState<string>('Enemy Team');
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(['EUW1']);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [championAnalysis, setChampionAnalysis] = useState<PlayerChampionAnalysis[]>([]);
  const regionSelectorRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();
  const { isCollapsed } = useNavbar();

  // Load champion data from Data Dragon on mount
  useEffect(() => {
    championService.loadChampions();
  }, []);

  // Close region selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (regionSelectorRef.current && !regionSelectorRef.current.contains(event.target as Node)) {
        setShowRegionSelector(false);
      }
    };

    if (showRegionSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRegionSelector]);

  const handleAddOwnPlayer = async (player: Player, asSub: boolean) => {
    // Check if player already exists in any list
    const allPlayers = [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs];
    const isDuplicate = allPlayers.some(
      p => p.riotId.gameName.toLowerCase() === player.riotId.gameName.toLowerCase() &&
           p.riotId.tagLine.toLowerCase() === player.riotId.tagLine.toLowerCase() &&
           p.riotId.region === player.riotId.region
    );

    if (isDuplicate) {
      setErrorMessage(`${player.riotId.gameName}#${player.riotId.tagLine} is already added to a team.`);
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    // Add player with loading state
    const playerWithLoading = { ...player, isLoading: true };

    if (asSub) {
      setOwnSubs([...ownSubs, playerWithLoading]);
    } else {
      setOwnStarters([...ownStarters, playerWithLoading]);
    }

    // Fetch player data in background
    try {
      const data = await riotApi.fetchPlayerData(
        player.riotId.gameName,
        player.riotId.tagLine,
        player.riotId.region
      );

      // Update player with fetched data
      const updatedPlayer: Player = {
        ...player,
        puuid: data.puuid,
        summonerId: data.summonerId,
        summonerLevel: data.summonerLevel,
        profileIconId: data.profileIconId,
        isLoading: false,
      };

      if (asSub) {
        setOwnSubs(prev => prev.map(p => p.id === player.id ? updatedPlayer : p));
      } else {
        setOwnStarters(prev => prev.map(p => p.id === player.id ? updatedPlayer : p));
      }

      // Auto-fetch match history for this player
      setTimeout(() => fetchMatchHistoryForPlayer(updatedPlayer), 500);
    } catch (error) {
      console.error(`Failed to fetch data for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);

      // Show error on player
      const playerWithError: Player = {
        ...player,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      if (asSub) {
        setOwnSubs(prev => prev.map(p => p.id === player.id ? playerWithError : p));
      } else {
        setOwnStarters(prev => prev.map(p => p.id === player.id ? playerWithError : p));
      }
    }
  };

  const handleRemoveOwnPlayer = (playerId: string) => {
    setOwnStarters(ownStarters.filter(p => p.id !== playerId));
    setOwnSubs(ownSubs.filter(p => p.id !== playerId));
    // Remove stats for this player
    setChampionAnalysis(prev => prev.filter(a => a.player.id !== playerId));
  };

  const handleReorderOwnPlayers = (starters: Player[], subs: Player[]) => {
    setOwnStarters(starters);
    setOwnSubs(subs);
  };

  const handleAddEnemyPlayer = async (player: Player, asSub: boolean) => {
    // Check if player already exists in any list
    const allPlayers = [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs];
    const isDuplicate = allPlayers.some(
      p => p.riotId.gameName.toLowerCase() === player.riotId.gameName.toLowerCase() &&
           p.riotId.tagLine.toLowerCase() === player.riotId.tagLine.toLowerCase() &&
           p.riotId.region === player.riotId.region
    );

    if (isDuplicate) {
      setErrorMessage(`${player.riotId.gameName}#${player.riotId.tagLine} is already added to a team.`);
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    // Add player with loading state
    const playerWithLoading = { ...player, isLoading: true };

    if (asSub) {
      setEnemySubs([...enemySubs, playerWithLoading]);
    } else {
      setEnemyStarters([...enemyStarters, playerWithLoading]);
    }

    // Fetch player data in background
    try {
      const data = await riotApi.fetchPlayerData(
        player.riotId.gameName,
        player.riotId.tagLine,
        player.riotId.region
      );

      // Update player with fetched data
      const updatedPlayer: Player = {
        ...player,
        puuid: data.puuid,
        summonerId: data.summonerId,
        summonerLevel: data.summonerLevel,
        profileIconId: data.profileIconId,
        isLoading: false,
      };

      if (asSub) {
        setEnemySubs(prev => prev.map(p => p.id === player.id ? updatedPlayer : p));
      } else {
        setEnemyStarters(prev => prev.map(p => p.id === player.id ? updatedPlayer : p));
      }

      // Auto-fetch match history for this player
      setTimeout(() => fetchMatchHistoryForPlayer(updatedPlayer), 500);
    } catch (error) {
      console.error(`Failed to fetch data for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);

      // Update player with error
      const playerWithError: Player = {
        ...player,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      if (asSub) {
        setEnemySubs(prev => prev.map(p => p.id === player.id ? playerWithError : p));
      } else {
        setEnemyStarters(prev => prev.map(p => p.id === player.id ? playerWithError : p));
      }
    }
  };

  const handleRemoveEnemyPlayer = (playerId: string) => {
    setEnemyStarters(enemyStarters.filter(p => p.id !== playerId));
    setEnemySubs(enemySubs.filter(p => p.id !== playerId));
    // Remove stats for this player
    setChampionAnalysis(prev => prev.filter(a => a.player.id !== playerId));
  };

  const handleReorderEnemyPlayers = (starters: Player[], subs: Player[]) => {
    setEnemyStarters(starters);
    setEnemySubs(subs);
  };

  const handleUpdateOwnPlayerRegion = (playerId: string, newRegion: Region) => {
    setOwnStarters(ownStarters.map(p =>
      p.id === playerId ? { ...p, riotId: { ...p.riotId, region: newRegion } } : p
    ));
    setOwnSubs(ownSubs.map(p =>
      p.id === playerId ? { ...p, riotId: { ...p.riotId, region: newRegion } } : p
    ));
  };

  const handleUpdateEnemyPlayerRegion = (playerId: string, newRegion: Region) => {
    setEnemyStarters(enemyStarters.map(p =>
      p.id === playerId ? { ...p, riotId: { ...p.riotId, region: newRegion } } : p
    ));
    setEnemySubs(enemySubs.map(p =>
      p.id === playerId ? { ...p, riotId: { ...p.riotId, region: newRegion } } : p
    ));
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleRegion = (region: Region) => {
    if (selectedRegions.includes(region)) {
      // Don't allow deselecting the last region
      if (selectedRegions.length > 1) {
        const newRegions = selectedRegions.filter(r => r !== region);
        setSelectedRegions(newRegions);

        // Update any players using the removed region to use the first remaining region
        const fallbackRegion = newRegions[0];

        setOwnStarters(ownStarters.map(p =>
          p.riotId.region === region ? { ...p, riotId: { ...p.riotId, region: fallbackRegion } } : p
        ));
        setOwnSubs(ownSubs.map(p =>
          p.riotId.region === region ? { ...p, riotId: { ...p.riotId, region: fallbackRegion } } : p
        ));
        setEnemyStarters(enemyStarters.map(p =>
          p.riotId.region === region ? { ...p, riotId: { ...p.riotId, region: fallbackRegion } } : p
        ));
        setEnemySubs(enemySubs.map(p =>
          p.riotId.region === region ? { ...p, riotId: { ...p.riotId, region: fallbackRegion } } : p
        ));
      }
    } else {
      setSelectedRegions([...selectedRegions, region]);
    }
  };

  const handleAnalyzeTeams = async () => {
    setIsAnalyzing(true);

    // Collect all players from both teams that need data (no PUUID or have errors)
    const allPlayers = [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs];
    const playersNeedingData = allPlayers.filter(p => !p.puuid || p.error);

    if (playersNeedingData.length === 0) {
      setIsAnalyzing(false);
      return;
    }

    try {
      // Fetch data for each player that needs it, in parallel
      const playerDataPromises = playersNeedingData.map(async (player) => {
        try {
          const data = await riotApi.fetchPlayerData(
            player.riotId.gameName,
            player.riotId.tagLine,
            player.riotId.region
          );

          return {
            playerId: player.id,
            data,
            error: null,
          };
        } catch (error) {
          console.error(`Failed to fetch data for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);
          return {
            playerId: player.id,
            data: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const results = await Promise.all(playerDataPromises);

      // Update players with fetched data
      const updatePlayers = (players: Player[]) => {
        return players.map((player) => {
          const result = results.find((r) => r.playerId === player.id);
          if (!result) return player;

          if (result.data) {
            return {
              ...player,
              puuid: result.data.puuid,
              summonerId: result.data.summonerId,
              summonerLevel: result.data.summonerLevel,
              profileIconId: result.data.profileIconId,
              isLoading: false,
              error: undefined,
            };
          } else {
            return {
              ...player,
              isLoading: false,
              error: result.error || undefined,
            };
          }
        });
      };

      setOwnStarters(updatePlayers(ownStarters));
      setOwnSubs(updatePlayers(ownSubs));
      setEnemyStarters(updatePlayers(enemyStarters));
      setEnemySubs(updatePlayers(enemySubs));

      console.log('Analysis complete!', results);

      // Now fetch match history for all players with PUUIDs
      await fetchMatchHistory();
    } catch (error) {
      console.error('Failed to analyze teams:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchMatchHistoryForPlayer = async (player: Player) => {
    if (!player.puuid) return;

    // Check if this player is already in the analysis
    const existingIndex = championAnalysis.findIndex(a => a.player.id === player.id);

    if (existingIndex >= 0) {
      // Update existing entry to loading
      setChampionAnalysis(prev => prev.map((a, idx) =>
        idx === existingIndex ? { ...a, isLoading: true, champions: [] } : a
      ));
    } else {
      // Add new entry with loading state
      setChampionAnalysis(prev => [...prev, {
        player,
        champions: [],
        isLoading: true,
      }]);
    }

    try {
      // Season 2025 started January 8, 2025
      const seasonStart = new Date('2025-01-08').getTime();

      // Fetch ranked solo/duo matches with cache-first strategy
      await riotApi.fetchMatchesWithCache(
        player.puuid!,
        player.riotId.region,
        (matches, masteryData, isFromCache) => {
          // Update with current progress
          const championStats = riotApi.analyzeChampionStats(matches, player.puuid!, masteryData);

          setChampionAnalysis(prev => {
            const currentIndex = prev.findIndex(a => a.player.id === player.id);
            if (currentIndex >= 0) {
              return prev.map((a, idx) =>
                idx === currentIndex ? {
                  ...a,
                  champions: championStats,
                  isLoading: !isFromCache, // If from cache, show as complete; otherwise still loading
                  totalMatchesCached: matches.length,
                  hasMoreMatches: matches.length >= 33, // Assume more matches if we got full count
                } : a
              );
            }
            return prev;
          });
        },
        33, // Fetch up to 33 games (199 total / 6 players)
        {
          queue: 420, // Ranked Solo/Duo only
          startTime: seasonStart
        }
      );

      // Mark as complete (in case final update didn't happen)
      setChampionAnalysis(prev => prev.map(a =>
        a.player.id === player.id ? { ...a, isLoading: false, hasMoreMatches: a.totalMatchesCached ? a.totalMatchesCached >= 33 : false } : a
      ));
    } catch (error) {
      console.error(`Failed to fetch matches for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);

      // Check if we already have cached data from the progress callback
      const existingAnalysis = championAnalysis.find(a => a.player.id === player.id);

      // If we have cached data, don't show error - just mark as complete
      if (existingAnalysis && existingAnalysis.champions.length > 0) {
        console.log(`[Dashboard] Using cached data for ${player.riotId.gameName}, ignoring API error`);
        setChampionAnalysis(prev => prev.map(a =>
          a.player.id === player.id ? { ...a, isLoading: false } : a
        ));
        return; // Don't show error if we have cached data
      }

      // No cached data available, show error message
      let errorMessage = 'Failed to fetch match history';
      if (error instanceof Error) {
        if (error.message === 'API_RATE_LIMIT' || error.message.includes('429')) {
          errorMessage = 'API is overloaded. Please wait 2 minutes and try again.';
        } else if (error.message === 'API_UNAVAILABLE') {
          errorMessage = 'Riot API is temporarily unavailable. Try again later.';
        } else if (error.message === 'API_SERVER_ERROR') {
          errorMessage = 'Riot servers are experiencing issues. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }

      const errorAnalysis = {
        player,
        champions: [],
        isLoading: false,
        error: errorMessage,
      };

      setChampionAnalysis(prev => {
        const currentIndex = prev.findIndex(a => a.player.id === player.id);
        if (currentIndex >= 0) {
          return prev.map((a, idx) => idx === currentIndex ? errorAnalysis : a);
        }
        return [...prev.filter(a => a.player.id !== player.id), errorAnalysis];
      });
    }
  };

  const handleLoadMore = async (player: Player) => {
    if (!player.puuid) return;

    const analysis = championAnalysis.find(a => a.player.id === player.id);
    if (!analysis) return;

    // Set loading state
    setChampionAnalysis(prev => prev.map(a =>
      a.player.id === player.id ? { ...a, isLoadingMore: true } : a
    ));

    try {
      const seasonStart = new Date('2025-01-08').getTime();

      const result = await riotApi.loadMoreMatches(
        player.puuid!,
        player.riotId.region,
        33, // Load 33 more matches
        {
          queue: 420,
          startTime: seasonStart
        }
      );

      // Update with all matches
      const championStats = riotApi.analyzeChampionStats(result.matches, player.puuid!, result.masteryData);

      setChampionAnalysis(prev => prev.map(a =>
        a.player.id === player.id ? {
          ...a,
          champions: championStats,
          totalMatchesCached: result.matches.length,
          hasMoreMatches: result.hasMore,
          isLoadingMore: false,
        } : a
      ));
    } catch (error) {
      console.error(`Failed to load more matches for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to load more matches';
      if (error instanceof Error) {
        if (error.message === 'API_RATE_LIMIT' || error.message.includes('429')) {
          errorMessage = 'API is overloaded. Please wait 2 minutes and try again.';
        } else if (error.message === 'API_UNAVAILABLE') {
          errorMessage = 'Riot API is temporarily unavailable. Try again later.';
        } else if (error.message === 'API_SERVER_ERROR') {
          errorMessage = 'Riot servers are experiencing issues. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }

      setChampionAnalysis(prev => prev.map(a =>
        a.player.id === player.id ? {
          ...a,
          isLoadingMore: false,
          error: errorMessage,
        } : a
      ));
    }
  };

  const fetchMatchHistory = async () => {
    const allPlayers = [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs];
    const playersWithData = allPlayers.filter(p => p.puuid);

    if (playersWithData.length === 0) {
      return;
    }

    // Set loading state for all players
    setChampionAnalysis(
      playersWithData.map(player => ({
        player,
        champions: [],
        isLoading: true,
      }))
    );

    // Season 2025 started January 8, 2025
    const seasonStart = new Date('2025-01-08').getTime();

    // Fetch matches for each player in parallel
    const analysisPromises = playersWithData.map(async (player) => {
      try {
        // Fetch ranked matches and mastery data in parallel
        const [matches, masteryData] = await Promise.all([
          riotApi.fetchPlayerMatches(
            player.puuid!,
            player.riotId.region,
            60, // Fetch up to 60 games
            {
              queue: 420, // Ranked Solo/Duo only
              startTime: seasonStart
            }
          ),
          riotApi.getChampionMastery(player.puuid!, player.riotId.region)
        ]);

        const championStats = riotApi.analyzeChampionStats(matches, player.puuid!, masteryData);

        return {
          player,
          champions: championStats,
          isLoading: false,
        };
      } catch (error) {
        console.error(`Failed to fetch matches for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);
        return {
          player,
          champions: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch match history',
        };
      }
    });

    const analysis = await Promise.all(analysisPromises);
    setChampionAnalysis(analysis);
  };

  // Sort championAnalysis to match player order
  const sortedChampionAnalysis = useMemo(() => {
    // Create ordered list of all players
    const allPlayers = [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs];

    // Sort championAnalysis based on player order
    return allPlayers
      .map(player => championAnalysis.find(a => a.player.id === player.id))
      .filter((analysis): analysis is PlayerChampionAnalysis => analysis !== undefined);
  }, [ownStarters, ownSubs, enemyStarters, enemySubs, championAnalysis]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Main Content */}
      <div className={`transition-all duration-300 p-8 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Error Toast */}
        {errorMessage && (
          <div className="fixed top-4 right-4 z-50 animate-slide-in">
            <div className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
              <span className="text-xl">⚠</span>
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="ml-2 text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Team Analysis Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* Region Selector */}
            <div className="relative">
              <button
                onClick={() => setShowRegionSelector(!showRegionSelector)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center gap-2"
              >
                <span>Regions: {selectedRegions.length === 1 ? formatRegionName(selectedRegions[0]) : `${selectedRegions.length} selected`}</span>
                <span className="text-xs">▼</span>
              </button>

              {showRegionSelector && (
                <div ref={regionSelectorRef} className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-3 z-10 max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_REGIONS.map((region) => (
                      <label
                        key={region}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region)}
                          onChange={() => toggleRegion(region)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{formatRegionName(region)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <TeamBuilder
            teamName={ownTeamName}
            starters={ownStarters}
            subs={ownSubs}
            onAddPlayer={handleAddOwnPlayer}
            onRemovePlayer={handleRemoveOwnPlayer}
            onReorderPlayers={handleReorderOwnPlayers}
            onUpdatePlayerRegion={handleUpdateOwnPlayerRegion}
            onTeamNameChange={setOwnTeamName}
            color="blue"
            selectedRegions={selectedRegions}
            showMultipleRegions={selectedRegions.length > 1}
          />

          <TeamBuilder
            teamName={enemyTeamName}
            starters={enemyStarters}
            subs={enemySubs}
            onAddPlayer={handleAddEnemyPlayer}
            onRemovePlayer={handleRemoveEnemyPlayer}
            onReorderPlayers={handleReorderEnemyPlayers}
            onUpdatePlayerRegion={handleUpdateEnemyPlayerRegion}
            onTeamNameChange={setEnemyTeamName}
            color="red"
            selectedRegions={selectedRegions}
            showMultipleRegions={selectedRegions.length > 1}
          />
        </div>

        {/* Statistics Section */}
        {(ownStarters.length + ownSubs.length + enemyStarters.length + enemySubs.length > 0) && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Statistics & Analysis</h2>
            <p className="text-gray-400 mb-4">
              Ready to fetch statistics for {ownStarters.length + ownSubs.length + enemyStarters.length + enemySubs.length} players
            </p>

            {/* Player Status Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-700/50 rounded p-3">
                <div className="text-sm text-gray-400">Players with data</div>
                <div className="text-2xl font-semibold text-green-400">
                  {[...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].filter(p => p.puuid).length}
                </div>
              </div>
              <div className="bg-gray-700/50 rounded p-3">
                <div className="text-sm text-gray-400">Players pending</div>
                <div className="text-2xl font-semibold text-blue-400">
                  {[...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].filter(p => !p.puuid && !p.error).length}
                </div>
              </div>
            </div>

            {/* Error display */}
            {[...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].some(p => p.error) && (
              <div className="bg-red-900/20 border border-red-500 rounded p-3 mb-4">
                <div className="text-sm font-semibold text-red-400 mb-2">Errors fetching player data:</div>
                <ul className="text-sm text-red-300 space-y-1">
                  {[...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs]
                    .filter(p => p.error)
                    .map(p => (
                      <li key={p.id}>
                        {p.riotId.gameName}#{p.riotId.tagLine}: {p.error}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleAnalyzeTeams}
              disabled={isAnalyzing || [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].every(p => p.puuid && !p.error)}
              className={`px-6 py-2 font-semibold rounded transition-colors ${
                isAnalyzing || [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].every(p => p.puuid && !p.error)
                  ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Retrying...
                </span>
              ) : [...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].every(p => p.puuid && !p.error) ? (
                'All Players Loaded ✓'
              ) : (
                `Retry Failed Players (${[...ownStarters, ...ownSubs, ...enemyStarters, ...enemySubs].filter(p => !p.puuid || p.error).length})`
              )}
            </button>
          </div>
        )}

        {/* Champion Analysis Section - TEMPORARY VISUAL SHOWCASE */}
        {sortedChampionAnalysis.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mt-8">
            <h2 className="text-2xl font-semibold mb-4">Champion Pool Analysis (Ranked Solo/Duo - Season 2025)</h2>
            <p className="text-gray-400 text-sm mb-6">Showing up to 60 ranked games from this season, sorted by games → win rate → mastery</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedChampionAnalysis.map((analysis) => (
                <div key={analysis.player.id} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-600">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-400">
                        {analysis.player.riotId.gameName}#{analysis.player.riotId.tagLine}
                      </h3>
                      <p className="text-xs text-gray-400">Level {analysis.player.summonerLevel || '?'}</p>
                    </div>

                    {/* Loading/Load More Section */}
                    <div className="flex items-center gap-3">
                      {/* Initial Loading Spinner */}
                      {analysis.isLoading && (
                        <div className="flex items-center gap-2">
                          {analysis.champions.length > 0 && (
                            <span className="text-xs text-gray-400">Loading...</span>
                          )}
                          <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}

                      {/* Load More Button (when not initially loading) */}
                      {!analysis.isLoading && analysis.champions.length > 0 && (
                        <>
                          {analysis.isLoadingMore ? (
                            <div className="flex items-center gap-2 text-blue-400">
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="text-xs">Loading more...</span>
                            </div>
                          ) : analysis.hasMoreMatches ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <button
                                onClick={() => handleLoadMore(analysis.player)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
                              >
                                Load More
                              </button>
                              <span className="text-[10px] text-gray-400 opacity-60">
                                ({analysis.totalMatchesCached || 0} games analyzed)
                              </span>
                            </div>
                          ) : analysis.totalMatchesCached && analysis.totalMatchesCached > 0 ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="text-gray-400 text-xs">
                                ✓ Up to date
                              </div>
                              <span className="text-[10px] text-gray-500 opacity-60">
                                ({analysis.totalMatchesCached} games analyzed)
                              </span>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {analysis.error && (
                    <div className="text-red-400 text-sm py-2">{analysis.error}</div>
                  )}

                  {!analysis.isLoading && !analysis.error && analysis.champions.length === 0 && (
                    <div className="text-gray-400 text-sm py-2">No recent matches found</div>
                  )}

                  {analysis.champions.length > 0 && (
                    <div className="space-y-2">
                      {analysis.champions.slice(0, 10).map((champ, idx) => (
                        <div key={champ.championId} className="flex items-center justify-between bg-gray-800/50 rounded p-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-gray-500 font-semibold text-sm w-4">#{idx + 1}</div>

                            {/* Champion Icon */}
                            <img
                              src={championService.getChampionIconUrl(champ.championId)}
                              alt={championService.getChampionName(champ.championId)}
                              className="w-10 h-10 rounded-full border-2 border-gray-700"
                              onError={(e) => {
                                // Fallback if image fails to load
                                e.currentTarget.style.display = 'none';
                              }}
                            />

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-white">{championService.getChampionName(champ.championId)}</div>
                                {champ.masteryLevel && champ.masteryLevel >= 4 && (
                                  <div className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                                    champ.masteryLevel === 7 ? 'bg-purple-600/30 text-purple-300' :
                                    champ.masteryLevel === 6 ? 'bg-blue-600/30 text-blue-300' :
                                    champ.masteryLevel === 5 ? 'bg-red-600/30 text-red-300' :
                                    'bg-gray-600/30 text-gray-300'
                                  }`}>
                                    M{champ.masteryLevel}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">
                                {champ.games} {champ.games === 1 ? 'game' : 'games'} • {champ.wins}W {champ.losses}L
                                {champ.kda !== undefined && (
                                  <> • <span className="text-sm font-semibold text-white">{champ.kda.toFixed(2)}</span> <span className="text-[10px] opacity-60">({champ.avgKills.toFixed(1)}/{champ.avgDeaths?.toFixed(1)}/{champ.avgAssists?.toFixed(1)})</span></>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={`text-lg font-bold ${
                            champ.winRate >= 60 ? 'text-green-400' :
                            champ.winRate >= 50 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {champ.winRate}%
                          </div>
                        </div>
                      ))}
                      {analysis.champions.length > 10 && (
                        <div className="text-center text-gray-500 text-sm pt-2">
                          +{analysis.champions.length - 10} more champions
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
