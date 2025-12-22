import { useState } from 'react';
import type { Player, Region } from '../types';

interface TeamBuilderProps {
  teamName: string;
  starters: Player[];
  subs: Player[];
  onAddPlayer: (player: Player, asSub: boolean) => void;
  onRemovePlayer: (playerId: string) => void;
  onReorderPlayers: (starters: Player[], subs: Player[]) => void;
  color: 'blue' | 'red';
  selectedRegions: Region[];
  showMultipleRegions: boolean;
}

export default function TeamBuilder({
  teamName,
  starters,
  subs,
  onAddPlayer,
  onRemovePlayer,
  onReorderPlayers,
  color,
  selectedRegions,
  showMultipleRegions
}: TeamBuilderProps) {
  const [gameName, setGameName] = useState('');
  const [tagLine, setTagLine] = useState('');
  const [addAsSub, setAddAsSub] = useState(false);
  const [draggedFrom, setDraggedFrom] = useState<{ type: 'starter' | 'sub', index: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ type: 'starter' | 'sub', index: number } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Use the first selected region (or default to EUW1 if somehow empty)
    const region = selectedRegions[0] || 'EUW1';

    const newPlayer: Player = {
      id: `${gameName}-${tagLine}-${Date.now()}`,
      riotId: {
        gameName,
        tagLine,
        region
      }
    };

    onAddPlayer(newPlayer, addAsSub);
    setGameName('');
    setTagLine('');
  };

  const handleDragStart = (type: 'starter' | 'sub', index: number) => {
    setDraggedFrom({ type, index });
  };

  const handleDragOver = (e: React.DragEvent, type: 'starter' | 'sub', index: number) => {
    e.preventDefault();
    if (!draggedFrom) return;

    // Only update if different from current
    if (dragOverTarget?.type !== type || dragOverTarget?.index !== index) {
      setDragOverTarget({ type, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedFrom(null);
    setDragOverTarget(null);
  };

  const handleDrop = (type: 'starter' | 'sub', dropIndex: number) => {
    if (!draggedFrom) return;

    const newStarters = [...starters];
    const newSubs = [...subs];

    let draggedPlayer: Player;

    // Remove from source
    if (draggedFrom.type === 'starter') {
      [draggedPlayer] = newStarters.splice(draggedFrom.index, 1);
    } else {
      [draggedPlayer] = newSubs.splice(draggedFrom.index, 1);
    }

    // Add to destination
    if (type === 'starter') {
      newStarters.splice(dropIndex, 0, draggedPlayer);
    } else {
      newSubs.splice(dropIndex, 0, draggedPlayer);
    }

    onReorderPlayers(newStarters, newSubs);
    setDraggedFrom(null);
    setDragOverTarget(null);
  };

  // Calculate preview positions
  const getPreviewPlayers = (type: 'starter' | 'sub') => {
    const players = type === 'starter' ? starters : subs;

    if (!draggedFrom || !dragOverTarget || dragOverTarget.type !== type) {
      return players;
    }

    const result = [...players];

    // If dragging from same list
    if (draggedFrom.type === type) {
      const [draggedPlayer] = result.splice(draggedFrom.index, 1);
      result.splice(dragOverTarget.index, 0, draggedPlayer);
    } else {
      // If dragging from different list
      const draggedPlayer = draggedFrom.type === 'starter'
        ? starters[draggedFrom.index]
        : subs[draggedFrom.index];
      result.splice(dragOverTarget.index, 0, draggedPlayer);
    }

    return result;
  };

  const colorClasses = color === 'blue'
    ? 'border-blue-500 text-blue-400'
    : 'border-red-500 text-red-400';

  const toggleButtonColor = color === 'blue'
    ? 'bg-blue-600'
    : 'bg-red-600';

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className={`text-2xl font-semibold mb-4 ${colorClasses}`}>
        {teamName}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-3 mb-4">
        {/* Toggle Button */}
        <div className="flex gap-2 p-1 bg-gray-700 rounded-lg">
          <button
            type="button"
            onClick={() => setAddAsSub(false)}
            className={`flex-1 py-2 px-3 rounded transition-all duration-200 ${
              !addAsSub
                ? `${toggleButtonColor} text-white shadow-lg animate-shuffle`
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Player
          </button>
          <button
            type="button"
            onClick={() => setAddAsSub(true)}
            className={`flex-1 py-2 px-3 rounded transition-all duration-200 ${
              addAsSub
                ? `${toggleButtonColor} text-white shadow-lg animate-shuffle`
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Substitute
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Game Name
            </label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Player123"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tag
            </label>
            <input
              type="text"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value)}
              placeholder="EUW"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className={`w-full py-2 px-4 ${
            color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
          } text-white font-semibold rounded transition-colors`}
        >
          {addAsSub ? 'Add as Substitute' : 'Add as Player'}
        </button>
      </form>

      {(starters.length > 0 || subs.length > 0 || draggedFrom) && (
        <div className="space-y-3">
          {/* Players */}
          {(starters.length > 0 || subs.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Players ({starters.length}/5)
              </h3>
              {starters.length > 0 ? (
                <div className="space-y-2">
                  {getPreviewPlayers('starter').map((player, index) => {
                    const isBeingDragged = draggedFrom?.type === 'starter' &&
                      starters[draggedFrom.index]?.id === player.id;
                    const isPreview = draggedFrom && dragOverTarget?.type === 'starter' &&
                      draggedFrom.type !== 'starter' && dragOverTarget.index === index;
                    const originalIndex = starters.findIndex(p => p.id === player.id);

                    if (originalIndex === -1 && !isPreview) {
                      return null;
                    }

                    return (
                      <div
                        key={`${player.id}-${index}`}
                        draggable={!isPreview}
                        onDragStart={() => {
                          if (originalIndex >= 0) {
                            handleDragStart('starter', originalIndex);
                          }
                        }}
                        onDragOver={(e) => handleDragOver(e, 'starter', index)}
                        onDragEnd={handleDragEnd}
                        onDrop={() => handleDrop('starter', index)}
                        className={`flex items-center justify-between bg-gray-700 px-3 py-2 rounded transition-all duration-200 ${
                          isBeingDragged
                            ? 'opacity-30 scale-95'
                            : isPreview
                              ? 'opacity-60 border-2 border-dashed border-blue-400'
                              : 'cursor-move hover:bg-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">⋮⋮</span>
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                          <span className="text-white font-medium">
                            {player.riotId.gameName}#{player.riotId.tagLine}
                          </span>
                          {showMultipleRegions && (
                            <span className="text-gray-400 text-sm">
                              ({player.riotId.region})
                            </span>
                          )}
                        </div>
                        {!isPreview && (
                          <button
                            onClick={() => onRemovePlayer(player.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(e, 'starter', 0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop('starter', 0);
                  }}
                  className="flex items-center justify-center border-2 border-dashed bg-gray-700/30 border-gray-500 px-3 py-8 rounded transition-all duration-200 hover:border-blue-400 hover:bg-gray-700/50"
                >
                  <span className="text-gray-500 text-4xl">+</span>
                </div>
              )}
            </div>
          )}

          {/* Substitutes */}
          {(subs.length > 0 || starters.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Substitutes ({subs.length})
              </h3>
              {subs.length > 0 ? (
                <div className="space-y-2">
                  {getPreviewPlayers('sub').map((player, index) => {
                    const isBeingDragged = draggedFrom?.type === 'sub' &&
                      subs[draggedFrom.index]?.id === player.id;
                    const isPreview = draggedFrom && dragOverTarget?.type === 'sub' &&
                      draggedFrom.type !== 'sub' && dragOverTarget.index === index;
                    const originalIndex = subs.findIndex(p => p.id === player.id);

                    if (originalIndex === -1 && !isPreview) {
                      return null;
                    }

                    return (
                      <div
                        key={`${player.id}-${index}`}
                        draggable={!isPreview}
                        onDragStart={() => {
                          if (originalIndex >= 0) {
                            handleDragStart('sub', originalIndex);
                          }
                        }}
                        onDragOver={(e) => handleDragOver(e, 'sub', index)}
                        onDragEnd={handleDragEnd}
                        onDrop={() => handleDrop('sub', index)}
                        className={`flex items-center justify-between bg-gray-700/50 px-3 py-2 rounded border border-gray-600 transition-all duration-200 ${
                          isBeingDragged
                            ? 'opacity-30 scale-95'
                            : isPreview
                              ? 'opacity-60 border-2 border-dashed border-yellow-400'
                              : 'cursor-move hover:bg-gray-600/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">⋮⋮</span>
                          <span className="text-xs text-yellow-500">SUB</span>
                          <span className="text-white font-medium">
                            {player.riotId.gameName}#{player.riotId.tagLine}
                          </span>
                          {showMultipleRegions && (
                            <span className="text-gray-400 text-sm">
                              ({player.riotId.region})
                            </span>
                          )}
                        </div>
                        {!isPreview && (
                          <button
                            onClick={() => onRemovePlayer(player.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(e, 'sub', 0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop('sub', 0);
                  }}
                  className="flex items-center justify-center border-2 border-dashed bg-gray-700/30 border-gray-500 px-3 py-8 rounded transition-all duration-200 hover:border-yellow-400 hover:bg-gray-700/50"
                >
                  <span className="text-gray-500 text-4xl">+</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {starters.length === 0 && subs.length === 0 && !draggedFrom && (
        <p className="text-gray-400 text-sm text-center">
          No players added yet
        </p>
      )}
    </div>
  );
}
