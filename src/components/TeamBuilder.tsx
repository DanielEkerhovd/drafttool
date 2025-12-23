import { useState, useEffect, useRef } from "react";
import type { Player, Region } from "../types";

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

interface TeamBuilderProps {
  teamName: string;
  starters: Player[];
  subs: Player[];
  onAddPlayer: (player: Player, asSub: boolean) => void;
  onRemovePlayer: (playerId: string) => void;
  onReorderPlayers: (starters: Player[], subs: Player[]) => void;
  onUpdatePlayerRegion: (playerId: string, newRegion: Region) => void;
  onTeamNameChange: (newName: string) => void;
  color: "blue" | "red";
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
  onUpdatePlayerRegion,
  onTeamNameChange,
  color,
  selectedRegions,
  showMultipleRegions,
}: TeamBuilderProps) {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [addAsSub, setAddAsSub] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(teamName);
  const [selectedRegion, setSelectedRegion] = useState<Region>(selectedRegions[0]);
  const tagLineInputRef = useRef<HTMLInputElement>(null);
  const [draggedFrom, setDraggedFrom] = useState<{
    type: "starter" | "sub";
    index: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    type: "starter" | "sub";
    index: number;
  } | null>(null);

  // Use ref to track drag state immediately without waiting for React re-render
  const draggedFromRef = useRef<{
    type: "starter" | "sub";
    index: number;
  } | null>(null);

  // Automatically switch to Substitute mode when players reach max capacity
  useEffect(() => {
    if (starters.length >= 5 && !addAsSub) {
      setAddAsSub(true);
    }
  }, [starters.length, addAsSub]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent adding as player if already at max capacity (5)
    if (!addAsSub && starters.length >= 5) {
      return;
    }

    const newPlayer: Player = {
      id: `${gameName}-${tagLine}-${Date.now()}`,
      riotId: {
        gameName,
        tagLine,
        region: selectedRegion,
      },
    };

    onAddPlayer(newPlayer, addAsSub);
    setGameName("");
    setTagLine("");
  };

  const handleDragStart = (type: "starter" | "sub", index: number) => {
    const dragData = { type, index };
    draggedFromRef.current = dragData;
    setDraggedFrom(dragData);
  };

  const handleDragOver = (
    e: React.DragEvent,
    type: "starter" | "sub",
    index: number
  ) => {
    e.preventDefault();
    const currentDraggedFrom = draggedFromRef.current;

    // Prevent dropping into starters if already at max capacity (5) and dragging from subs
    if (
      currentDraggedFrom &&
      type === "starter" &&
      currentDraggedFrom.type === "sub" &&
      starters.length >= 5
    ) {
      return;
    }

    // Only update if different from current
    if (dragOverTarget?.type !== type || dragOverTarget?.index !== index) {
      setDragOverTarget({ type, index });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    draggedFromRef.current = null;
    setDraggedFrom(null);
    setDragOverTarget(null);
  };

  const handleDrop = (type: "starter" | "sub", dropIndex: number) => {
    if (!draggedFrom) return;

    // Prevent dropping into starters if already at max capacity (5) and dragging from subs
    if (
      type === "starter" &&
      draggedFrom.type === "sub" &&
      starters.length >= 5
    ) {
      setDraggedFrom(null);
      setDragOverTarget(null);
      return;
    }

    const newStarters = [...starters];
    const newSubs = [...subs];

    let draggedPlayer: Player;

    // Remove from source
    if (draggedFrom.type === "starter") {
      [draggedPlayer] = newStarters.splice(draggedFrom.index, 1);
    } else {
      [draggedPlayer] = newSubs.splice(draggedFrom.index, 1);
    }

    // Add to destination
    if (type === "starter") {
      newStarters.splice(dropIndex, 0, draggedPlayer);
    } else {
      newSubs.splice(dropIndex, 0, draggedPlayer);
    }

    onReorderPlayers(newStarters, newSubs);
    setDraggedFrom(null);
    setDragOverTarget(null);
  };

  // Calculate preview positions
  const getPreviewPlayers = (type: "starter" | "sub") => {
    const players = type === "starter" ? starters : subs;

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
      const draggedPlayer =
        draggedFrom.type === "starter"
          ? starters[draggedFrom.index]
          : subs[draggedFrom.index];
      result.splice(dragOverTarget.index, 0, draggedPlayer);
    }

    return result;
  };

  const colorClasses =
    color === "blue"
      ? "border-blue-500 text-blue-400"
      : "border-red-500 text-red-400";

  const toggleButtonColor = color === "blue" ? "bg-blue-600" : "bg-red-600";

  const handleSaveName = () => {
    onTeamNameChange(editedName);
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditedName(teamName);
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleGameNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Check if user typed '#'
    if (value.includes('#')) {
      // Split on '#' and set the parts
      const parts = value.split('#');
      setGameName(parts[0]);
      if (parts[1] !== undefined) {
        setTagLine(parts[1]);
      }
      // Focus the tagLine input
      tagLineInputRef.current?.focus();
    } else {
      setGameName(value);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        {isEditingName ? (
          <>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`text-2xl font-semibold bg-transparent border-b-2 ${colorClasses} focus:outline-none flex-1`}
              placeholder="Team Name"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <h2 className={`text-2xl font-semibold ${colorClasses}`}>
              {teamName}
            </h2>
            <button
              onClick={() => setIsEditingName(true)}
              className="text-gray-400 hover:text-gray-200 transition-colors ml-2"
              title="Edit team name"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mb-4">
        {/* Toggle Button */}
        <div className="flex gap-2 p-1 bg-gray-700 rounded-lg">
          <button
            type="button"
            onClick={() => setAddAsSub(false)}
            disabled={starters.length >= 5}
            className={`flex-1 py-2 px-3 rounded transition-all duration-200 ${
              !addAsSub
                ? `${toggleButtonColor} text-white shadow-lg animate-shuffle`
                : starters.length >= 5
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Player {starters.length >= 5 && "(Full)"}
          </button>
          <button
            type="button"
            onClick={() => setAddAsSub(true)}
            className={`flex-1 py-2 px-3 rounded transition-all duration-200 ${
              addAsSub
                ? `${toggleButtonColor} text-white shadow-lg animate-shuffle`
                : "text-gray-400 hover:text-white"
            }`}
          >
            Substitute
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Riot ID
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={gameName}
              onChange={handleGameNameChange}
              placeholder="Player"
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <span className="text-gray-400 text-xl font-bold">#</span>
            <input
              ref={tagLineInputRef}
              type="text"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value)}
              placeholder={formatRegionName(selectedRegions[0]) || "EUW"}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {selectedRegions.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Region
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value as Region)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {selectedRegions.map((region) => (
                <option key={region} value={region}>
                  {formatRegionName(region)}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className={`w-full py-2 px-4 ${
            color === "blue"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-red-600 hover:bg-red-700"
          } text-white font-semibold rounded transition-colors`}
        >
          {addAsSub ? "Add as Substitute" : "Add as Player"}
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
                  {getPreviewPlayers("starter").map((player, index) => {
                    const isBeingDragged =
                      draggedFrom?.type === "starter" &&
                      starters[draggedFrom.index]?.id === player.id;
                    const isPreview =
                      draggedFrom &&
                      dragOverTarget?.type === "starter" &&
                      draggedFrom.type !== "starter" &&
                      dragOverTarget.index === index;
                    const originalIndex = starters.findIndex(
                      (p) => p.id === player.id
                    );

                    if (originalIndex === -1 && !isPreview) {
                      return null;
                    }

                    return (
                      <div
                        key={player.id}
                        draggable={!isPreview}
                        onDragStart={() => {
                          if (originalIndex >= 0) {
                            handleDragStart("starter", originalIndex);
                          }
                        }}
                        onDragOver={(e) => handleDragOver(e, "starter", index)}
                        onDragEnd={handleDragEnd}
                        onDrop={() => handleDrop("starter", index)}
                        className={`flex items-center justify-between bg-gray-700 px-3 py-2 rounded transition-all duration-200 ${
                          isBeingDragged
                            ? "opacity-30 scale-95"
                            : isPreview
                            ? "opacity-60 border-2 border-dashed border-blue-400"
                            : "cursor-move hover:bg-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-gray-500">⋮⋮</span>
                          <span className="text-xs text-gray-500">
                            #{index + 1}
                          </span>
                          <span className="text-white font-medium">
                            {player.riotId.gameName}#{player.riotId.tagLine}
                          </span>
                          {player.isLoading && (
                            <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {player.error && (
                            <span className="text-red-400 text-xs" title={player.error}>⚠</span>
                          )}
                          {player.puuid && !player.isLoading && (
                            <span className="text-green-400 text-xs" title={`Level ${player.summonerLevel || '?'}`}>✓</span>
                          )}
                          {showMultipleRegions && (
                            <select
                              value={player.riotId.region}
                              onChange={(e) => onUpdatePlayerRegion(player.id, e.target.value as Region)}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {selectedRegions.map((region) => (
                                <option key={region} value={region}>
                                  {formatRegionName(region)}
                                </option>
                              ))}
                            </select>
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
                    handleDragOver(e, "starter", 0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop("starter", 0);
                  }}
                  className={`flex items-center justify-center border-2 border-dashed rounded transition-all duration-200 ${
                    draggedFrom?.type === "sub"
                      ? "px-3 py-8 bg-gray-700/30 border-gray-500 hover:border-blue-400 hover:bg-gray-700/50"
                      : "px-3 py-0 opacity-0 border-transparent pointer-events-auto"
                  }`}
                >
                  <span
                    className={`text-gray-500 text-4xl ${
                      draggedFrom?.type === "sub" ? "" : "invisible"
                    }`}
                  >
                    +
                  </span>
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
                  {getPreviewPlayers("sub").map((player, index) => {
                    const isBeingDragged =
                      draggedFrom?.type === "sub" &&
                      subs[draggedFrom.index]?.id === player.id;
                    const isPreview =
                      draggedFrom &&
                      dragOverTarget?.type === "sub" &&
                      draggedFrom.type !== "sub" &&
                      dragOverTarget.index === index;
                    const originalIndex = subs.findIndex(
                      (p) => p.id === player.id
                    );

                    if (originalIndex === -1 && !isPreview) {
                      return null;
                    }

                    return (
                      <div
                        key={player.id}
                        draggable={true}
                        onDragStart={() => {
                          if (originalIndex >= 0) {
                            handleDragStart("sub", originalIndex);
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          handleDragOver(e, "sub", index);
                        }}
                        onDragEnd={handleDragEnd}
                        onDrop={() => handleDrop("sub", index)}
                        className={`flex items-center justify-between bg-gray-700/50 px-3 py-2 rounded border border-gray-600 transition-all duration-200 ${
                          isBeingDragged
                            ? "opacity-30 scale-95"
                            : isPreview
                            ? "opacity-60 border-2 border-dashed border-yellow-400"
                            : "cursor-move hover:bg-gray-600/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-gray-500">⋮⋮</span>
                          <span className="text-xs text-yellow-500">SUB</span>
                          <span className="text-white font-medium">
                            {player.riotId.gameName}#{player.riotId.tagLine}
                          </span>
                          {player.isLoading && (
                            <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {player.error && (
                            <span className="text-red-400 text-xs" title={player.error}>⚠</span>
                          )}
                          {player.puuid && !player.isLoading && (
                            <span className="text-green-400 text-xs" title={`Level ${player.summonerLevel || '?'}`}>✓</span>
                          )}
                          {showMultipleRegions && (
                            <select
                              value={player.riotId.region}
                              onChange={(e) => onUpdatePlayerRegion(player.id, e.target.value as Region)}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {selectedRegions.map((region) => (
                                <option key={region} value={region}>
                                  {formatRegionName(region)}
                                </option>
                              ))}
                            </select>
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
                    handleDragOver(e, "sub", 0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop("sub", 0);
                  }}
                  className={`flex items-center justify-center border-2 border-dashed rounded transition-all duration-200 ${
                    draggedFrom?.type === "starter"
                      ? "px-3 py-8 bg-gray-700/30 border-gray-500 hover:border-yellow-400 hover:bg-gray-700/50"
                      : "px-3 py-0 opacity-0 border-transparent pointer-events-auto"
                  }`}
                >
                  <span
                    className={`text-gray-500 text-4xl ${
                      draggedFrom?.type === "starter" ? "" : "invisible"
                    }`}
                  >
                    +
                  </span>
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
