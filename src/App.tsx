import { useState } from 'react';
import { Battery, Zap, Crosshair, Activity, Play, RotateCcw, Pause, Hexagon, Cable, Target, Wrench, ChevronRight, ChevronLeft, Flame, Focus, Radio, GitMerge, Globe } from 'lucide-react';
import { useGameLoop } from './game/useGameLoop';
import { TOWER_STATS, TowerType, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, PickOption } from './game/types';
import { t, getLocale, setLocale, Locale } from './game/i18n';

const TowerIcon = ({ type, size = 22 }: { type: string; size?: number }) => {
  const icons: Record<string, React.ComponentType<{ size: number }>> = {
    blaster: Crosshair, gatling: Flame, sniper: Focus, tesla: Radio,
    generator: Zap, shield: Hexagon, battery: Battery, bus: GitMerge, target: Target,
  };
  const Icon = icons[type];
  return Icon ? <Icon size={size} /> : null;
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
    handleCanvasWheel,
    handleCanvasContextMenu,
  } = useGameLoop();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [locale, _setLocale] = useState<Locale>(getLocale());
  const toggleLocale = () => {
    const next: Locale = locale === 'en' ? 'zh' : 'en';
    setLocale(next);
    _setLocale(next);
  };
  const i = t();

  const renderTowerButton = (type: TowerType) => {
    const isCustom = gameState.gameMode === 'custom';
    const count = gameState.towerInventory[type] ?? 0;
    const hasStock = isCustom || count > 0;
    const isSelected = selectedTower === type;
    const label = i.towerName[type] ?? type;

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
        title={i.towerDesc[type] ?? TOWER_STATS[type].description}
      >
        <div className="text-gray-400 shrink-0"><TowerIcon type={type} size={16} /></div>
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
            <span className="text-xs uppercase font-bold">{i.customMode}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-red-400">
            <Activity size={14} />
            <span className="text-xs text-gray-500 uppercase font-bold">{i.wave}</span>
            <span className="text-lg font-mono font-bold ml-1">{gameState.wave || '-'}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-blue-400">
          <Cable size={14} />
          <span className="text-xs text-gray-500 uppercase font-bold">{i.wires}</span>
          <span className="text-lg font-mono font-bold ml-1">{gameState.gameMode === 'custom' ? '\u221E' : gameState.wireInventory}</span>
        </div>

        <div className="flex items-center gap-1.5 text-white">
          <span className="text-xs text-gray-500 uppercase font-bold">{i.score}</span>
          <span className="text-lg font-mono font-bold ml-1">{gameState.score}</span>
        </div>

        {gameState.gameMode !== 'custom' && gameState.status === 'playing' && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0 && (
          <div className="text-blue-300 text-xs font-medium animate-pulse ml-2">
            {i.nextWaveIn(Math.ceil(5 - gameState.waveTimer))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleLocale}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
            title="EN / 中文"
          >
            <Globe size={14} />
            {locale === 'en' ? '中文' : 'EN'}
          </button>
          {(gameState.status === 'playing' || gameState.status === 'paused') && (
            <button
              onClick={togglePause}
              className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              title={gameState.status === 'playing' ? i.pause : i.resume}
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
              width={VIEWPORT_WIDTH}
              height={VIEWPORT_HEIGHT}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              onWheel={handleCanvasWheel}
              onContextMenu={handleCanvasContextMenu}
              className={`block ${gameState.status === 'playing' ? (selectedTower ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing') : ''}`}
            />

            {/* Menu Overlay */}
            {gameState.status === 'menu' && (
              <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-5xl font-black mb-4 text-white tracking-tight">{i.systemOffline}</h2>
                <p className="text-gray-400 mb-8 max-w-lg text-sm">
                  {i.menuDescription}
                </p>
                <button
                  onClick={startGame}
                  className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Play size={20} /> {i.initializeCore}
                  </span>
                </button>
                <button
                  onClick={startCustomGame}
                  className="group relative px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-3 border border-gray-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Wrench size={20} /> {i.customMode}
                  </span>
                </button>
              </div>
            )}

            {/* Pick Overlay (Roguelike 3-choice) */}
            {gameState.status === 'pick' && (
              <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                {gameState.wave > 0 ? (
                  <>
                    <h2 className="text-3xl font-black mb-1 text-emerald-400 tracking-tight">{i.waveCleared(gameState.wave)}</h2>
                    <p className="text-emerald-300/60 text-sm font-mono mb-6">+{gameState.wave * 20} pts</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-black mb-1 text-blue-400 tracking-tight">{i.systemUpgrade}</h2>
                    <p className="text-gray-400 text-sm mb-6">{i.pickDescription}</p>
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
                          {opt.kind === 'wire' ? <Cable size={22} /> : <TowerIcon type={opt.towerType!} />}
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
                <h2 className="text-5xl font-black mb-6 text-white tracking-tight">{i.systemPaused}</h2>
                <button
                  onClick={togglePause}
                  className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Play size={20} /> {i.resume}
                  </span>
                </button>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameState.status === 'gameover' && (
              <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-6xl font-black mb-2 text-red-500 tracking-tight">{i.coreBreached}</h2>
                <p className="text-red-300/70 text-xl mb-8 font-mono">{i.systemFailure}</p>
                {gameState.gameMode !== 'custom' && (
                  <div className="bg-black/50 rounded-xl p-6 mb-8 min-w-[200px]">
                    <div className="text-gray-400 text-sm uppercase tracking-wider mb-2">{i.finalScore}</div>
                    <div className="text-4xl font-mono font-bold text-white">{gameState.score}</div>
                    <div className="text-gray-500 text-sm mt-2">{i.survivedWaves(gameState.wave)}</div>
                  </div>
                )}
                <button
                  onClick={gameState.gameMode === 'custom' ? startCustomGame : startGame}
                  className="px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <RotateCcw size={20} /> {i.rebootSystem}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar toggle + panel */}
        <div className="relative shrink-0 flex">
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="absolute -left-8 top-1/2 -translate-y-1/2 z-10 w-7 h-14 bg-gray-800 hover:bg-gray-700 border border-gray-700 border-r-0 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title={sidebarOpen ? i.hidePanel : i.showPanel}
          >
            {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Right Build Panel — Inventory based */}
          <div
            className={`bg-gray-900/80 border-l border-gray-800 p-2 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${
              sidebarOpen ? 'w-[140px] opacity-100' : 'w-0 opacity-0 p-0 border-l-0'
            }`}
          >
            <div className="min-w-[124px]">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 py-1">
                {i.inventory}
              </div>
              {renderTowerButton('blaster')}
              {renderTowerButton('gatling')}
              {renderTowerButton('sniper')}
              {renderTowerButton('tesla')}
              {renderTowerButton('generator')}
              {renderTowerButton('shield')}
              {renderTowerButton('battery')}
              {renderTowerButton('bus')}
              {gameState.gameMode === 'custom' && renderTowerButton('target')}

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-800 bg-gray-900/50 w-full">
                <div className="text-blue-400 shrink-0"><Cable size={16} /></div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-xs font-bold text-gray-200 leading-tight">{i.wires}</span>
                  <span className="text-[10px] text-blue-400 font-mono leading-tight">{gameState.gameMode === 'custom' ? '\u221E' : `x${gameState.wireInventory}`}</span>
                </div>
              </div>

              <div className="mt-4 text-[10px] text-gray-600 px-1 py-2 leading-relaxed">
                <p>{i.clickToRotate}</p>
                <p>{i.dragToWire}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
