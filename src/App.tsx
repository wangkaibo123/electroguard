import { Battery, Zap, Crosshair, Shield, Activity, Play, RotateCcw, Pause, Hexagon, Cable, Target, Wrench } from 'lucide-react';
import { useGameLoop } from './game/useGameLoop';
import { TOWER_STATS, TowerType, CANVAS_WIDTH, CANVAS_HEIGHT, PickOption } from './game/types';

const TOWER_ICONS: Record<string, React.ReactNode> = {
  blaster:   <Crosshair size={22} />,
  generator: <Zap size={22} />,
  wall:      <Shield size={22} />,
  shield:    <Hexagon size={22} />,
  battery:   <Battery size={22} />,
  target:    <Target size={22} />,
};

const SIDEBAR_ICONS: Record<string, React.ReactNode> = {
  blaster:   <Crosshair size={16} />,
  generator: <Zap size={16} />,
  wall:      <Shield size={16} />,
  shield:    <Hexagon size={16} />,
  battery:   <Battery size={16} />,
  target:    <Target size={16} />,
};

const getPickColor = (opt: PickOption) => {
  if (opt.kind === 'wire') return '#60a5fa';
  return TOWER_STATS[opt.towerType!]?.color ?? '#6b7280';
};

export default function App() {
  const {
    canvasRef,
    gameState,
    startGame,
    startCustomGame,
    togglePause,
    handlePick,
    selectedTower,
    setSelectedTower,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
  } = useGameLoop();

  const renderTowerButton = (type: TowerType, label: string) => {
    const isCustom = gameState.gameMode === 'custom';
    const count = gameState.towerInventory[type] ?? 0;
    const hasStock = isCustom || count > 0;
    const isSelected = selectedTower === type;

    return (
      <button
        key={type}
        onClick={() => setSelectedTower(isSelected ? null : type)}
        disabled={!hasStock || gameState.status !== 'playing'}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full ${
          isSelected
            ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
            : hasStock
              ? 'border-gray-700 bg-gray-800/80 hover:bg-gray-700 hover:border-gray-500'
              : 'border-gray-800 bg-gray-900/50 opacity-40 cursor-not-allowed'
        }`}
        title={TOWER_STATS[type].description}
      >
        <div className="text-gray-400 shrink-0">{SIDEBAR_ICONS[type]}</div>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-xs font-bold text-gray-200 leading-tight">{label}</span>
          <span className="text-[10px] text-emerald-400 font-mono leading-tight">{isCustom ? '\u221E' : `x${count}`}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="h-screen bg-gray-950 text-gray-100 font-sans flex flex-col overflow-hidden">

      {/* Top Stats Bar */}
      <div className="shrink-0 bg-gray-900/90 border-b border-gray-800 px-4 py-2 flex items-center gap-6">
        <h1 className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 shrink-0">
          ELECTROGUARD
        </h1>

        {gameState.gameMode === 'custom' ? (
          <div className="flex items-center gap-1.5 text-orange-400">
            <Wrench size={14} />
            <span className="text-xs uppercase font-bold">Custom Mode</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-red-400">
            <Activity size={14} />
            <span className="text-xs text-gray-500 uppercase font-bold">Wave</span>
            <span className="text-lg font-mono font-bold ml-1">{gameState.wave || '-'}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-blue-400">
          <Cable size={14} />
          <span className="text-xs text-gray-500 uppercase font-bold">Wires</span>
          <span className="text-lg font-mono font-bold ml-1">{gameState.gameMode === 'custom' ? '\u221E' : gameState.wireInventory}</span>
        </div>

        <div className="flex items-center gap-1.5 text-white">
          <span className="text-xs text-gray-500 uppercase font-bold">Score</span>
          <span className="text-lg font-mono font-bold ml-1">{gameState.score}</span>
        </div>

        {gameState.gameMode !== 'custom' && gameState.status === 'playing' && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0 && (
          <div className="text-blue-300 text-xs font-medium animate-pulse ml-2">
            Next wave in {Math.ceil(5 - gameState.waveTimer)}s
          </div>
        )}

        <div className="ml-auto">
          {(gameState.status === 'playing' || gameState.status === 'paused') && (
            <button
              onClick={togglePause}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              title={gameState.status === 'playing' ? "Pause" : "Resume"}
            >
              {gameState.status === 'playing' ? <Pause size={16} /> : <Play size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Area: Canvas + Build Panel */}
      <div className="flex-1 flex min-h-0">

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center min-w-0 p-2">
          <div className="relative rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.6)] border-2 border-gray-800 bg-gray-900 shrink-0">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              className={`block ${gameState.status === 'playing' ? (selectedTower ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing') : ''}`}
            />

            {/* Menu Overlay */}
            {gameState.status === 'menu' && (
              <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-5xl font-black mb-4 text-white tracking-tight">SYSTEM OFFLINE</h2>
                <p className="text-gray-400 mb-8 max-w-lg text-sm">
                  Place and connect machines to defend the Core. After each wave, choose an upgrade to strengthen your defense. If the Core falls, the system dies.
                </p>
                <button
                  onClick={startGame}
                  className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Play size={20} /> INITIALIZE CORE
                  </span>
                </button>
                <button
                  onClick={startCustomGame}
                  className="group relative px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-3 border border-gray-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Wrench size={20} /> CUSTOM MODE
                  </span>
                </button>
              </div>
            )}

            {/* Pick Overlay (Roguelike 3-choice) */}
            {gameState.status === 'pick' && (
              <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                {gameState.wave > 0 ? (
                  <>
                    <h2 className="text-3xl font-black mb-1 text-emerald-400 tracking-tight">WAVE {gameState.wave} CLEARED</h2>
                    <p className="text-emerald-300/60 text-sm font-mono mb-6">+{gameState.wave * 20} pts</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-black mb-1 text-blue-400 tracking-tight">SYSTEM UPGRADE</h2>
                    <p className="text-gray-400 text-sm mb-6">Choose one upgrade for your defense network</p>
                  </>
                )}

                <div className="flex gap-4">
                  {gameState.pickOptions.map(opt => {
                    const color = getPickColor(opt);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handlePick(opt.id)}
                        className="group w-44 p-5 rounded-xl border-2 border-gray-700 bg-gray-900/95 hover:bg-gray-800/95 transition-all flex flex-col items-center text-center gap-3 hover:scale-105 hover:shadow-lg"
                        style={{ '--pick-color': color } as React.CSSProperties}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: color + '22', color }}
                        >
                          {opt.kind === 'wire' ? <Cable size={22} /> : TOWER_ICONS[opt.towerType!]}
                        </div>
                        <div className="text-sm font-bold text-white">{opt.label}</div>
                        <div className="text-[11px] text-gray-400 leading-snug">{opt.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paused Overlay */}
            {gameState.status === 'paused' && (
              <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-5xl font-black mb-6 text-white tracking-tight">SYSTEM PAUSED</h2>
                <button
                  onClick={togglePause}
                  className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Play size={20} /> RESUME
                  </span>
                </button>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameState.status === 'gameover' && (
              <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-6xl font-black mb-2 text-red-500 tracking-tight">CORE BREACHED</h2>
                <p className="text-red-300/70 text-xl mb-8 font-mono">SYSTEM FAILURE</p>
                {gameState.gameMode !== 'custom' && (
                  <div className="bg-black/50 rounded-xl p-6 mb-8 min-w-[200px]">
                    <div className="text-gray-400 text-sm uppercase tracking-wider mb-2">Final Score</div>
                    <div className="text-4xl font-mono font-bold text-white">{gameState.score}</div>
                    <div className="text-gray-500 text-sm mt-2">Survived {gameState.wave} Waves</div>
                  </div>
                )}
                <button
                  onClick={gameState.gameMode === 'custom' ? startCustomGame : startGame}
                  className="px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <RotateCcw size={20} /> REBOOT SYSTEM
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Build Panel — Inventory based */}
        <div className="shrink-0 w-[140px] bg-gray-900/80 border-l border-gray-800 p-2 flex flex-col gap-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 py-1">
            Inventory
          </div>
          {renderTowerButton('blaster', 'Blaster')}
          {renderTowerButton('generator', 'Generator')}
          {renderTowerButton('wall', 'Wall')}
          {renderTowerButton('shield', 'Shield')}
          {renderTowerButton('battery', 'Battery')}
          {gameState.gameMode === 'custom' && renderTowerButton('target', 'Target')}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900/50 w-full">
            <div className="text-blue-400 shrink-0"><Cable size={16} /></div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs font-bold text-gray-200 leading-tight">Wires</span>
              <span className="text-[10px] text-blue-400 font-mono leading-tight">{gameState.gameMode === 'custom' ? '\u221E' : `x${gameState.wireInventory}`}</span>
            </div>
          </div>

          <div className="mt-auto text-[10px] text-gray-600 px-1 py-2 leading-relaxed">
            <p>Click machine to rotate</p>
            <p>Drag port to wire</p>
          </div>
        </div>
      </div>
    </div>
  );
}
