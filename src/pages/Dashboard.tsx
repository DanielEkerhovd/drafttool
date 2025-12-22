import { useState, useEffect, useRef } from 'react';
import type { Player, Region } from '../types';
import TeamBuilder from '../components/TeamBuilder';
import { useAuth } from '../hooks/useAuth';

const ALL_REGIONS: Region[] = [
  'EUW1', 'EUN1', 'NA1', 'KR', 'BR1', 'JP1',
  'LA1', 'LA2', 'OC1', 'TR1', 'RU', 'PH2',
  'SG2', 'TH2', 'TW2', 'VN2'
];

export default function Dashboard() {
  const [ownStarters, setOwnStarters] = useState<Player[]>([]);
  const [ownSubs, setOwnSubs] = useState<Player[]>([]);
  const [enemyStarters, setEnemyStarters] = useState<Player[]>([]);
  const [enemySubs, setEnemySubs] = useState<Player[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>(['EUW1']);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
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

  const handleAddOwnPlayer = (player: Player, asSub: boolean) => {
    if (asSub) {
      setOwnSubs([...ownSubs, player]);
    } else {
      setOwnStarters([...ownStarters, player]);
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

  const handleAddEnemyPlayer = (player: Player, asSub: boolean) => {
    if (asSub) {
      setEnemySubs([...enemySubs, player]);
    } else {
      setEnemyStarters([...enemyStarters, player]);
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

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleRegion = (region: Region) => {
    if (selectedRegions.includes(region)) {
      // Don't allow deselecting the last region
      if (selectedRegions.length > 1) {
        setSelectedRegions(selectedRegions.filter(r => r !== region));
      }
    } else {
      setSelectedRegions([...selectedRegions, region]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
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
                <span>Regions: {selectedRegions.length === 1 ? selectedRegions[0] : `${selectedRegions.length} selected`}</span>
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
                        <span className="text-sm">{region}</span>
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
            teamName="Your Team"
            starters={ownStarters}
            subs={ownSubs}
            onAddPlayer={handleAddOwnPlayer}
            onRemovePlayer={handleRemoveOwnPlayer}
            onReorderPlayers={handleReorderOwnPlayers}
            color="blue"
            selectedRegions={selectedRegions}
            showMultipleRegions={selectedRegions.length > 1}
          />

          <TeamBuilder
            teamName="Enemy Team"
            starters={enemyStarters}
            subs={enemySubs}
            onAddPlayer={handleAddEnemyPlayer}
            onRemovePlayer={handleRemoveEnemyPlayer}
            onReorderPlayers={handleReorderEnemyPlayers}
            color="red"
            selectedRegions={selectedRegions}
            showMultipleRegions={selectedRegions.length > 1}
          />
        </div>

        {/* Statistics Section */}
        {(ownStarters.length + ownSubs.length + enemyStarters.length + enemySubs.length > 0) && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Statistics & Analysis</h2>
            <p className="text-gray-400">
              Ready to fetch statistics for {ownStarters.length + ownSubs.length + enemyStarters.length + enemySubs.length} players
            </p>
            <button className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition-colors">
              Analyze Teams
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
