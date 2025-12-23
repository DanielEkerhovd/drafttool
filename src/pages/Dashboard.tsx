import { useState, useEffect, useRef } from 'react';
import type { Player, Region } from '../types';
import TeamBuilder from '../components/TeamBuilder';
import { useAuth } from '../hooks/useAuth';
import { riotApi } from '../services/riotApi';

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
  const regionSelectorRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

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
    } catch (error) {
      console.error(`Failed to fetch data for ${player.riotId.gameName}#${player.riotId.tagLine}:`, error);

      // Update player with error
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
    } catch (error) {
      console.error('Failed to analyze teams:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
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
      </div>
    </div>
  );
}
