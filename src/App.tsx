import { useState, useEffect } from 'react';
import { Battery, Zap, Crosshair, Activity, Play, RotateCcw, Pause, Hexagon, Cable, Wrench, ChevronRight, ChevronLeft, Flame, Focus, Radio, GitMerge, Globe, LogOut, BookOpen, X, Keyboard, Menu } from 'lucide-react';
import { useGameLoop } from './game/useGameLoop';
import { TOWER_STATS, TowerType, PickOption, EnemyType } from './game/types';
import { t, getLocale, setLocale, Locale } from './game/i18n';
import { GLOBAL_CONFIG, TIPS_CONFIG, TOWER_CONFIG, WEAPON_CONFIG } from './game/config';

const TowerIcon = ({ type, size = 22 }: { type: string; size?: number }) => {
  const icons: Record<string, React.ComponentType<{ size: number }>> = {
    blaster: Crosshair, gatling: Flame, sniper: Focus, tesla: Radio,
    generator: Zap, shield: Hexagon, battery: Battery, bus: GitMerge,
  };
  const Icon = icons[type];
  return Icon ? <Icon size={size} /> : null;
};

const getPickColor = (opt: PickOption) => {
  if (opt.kind === 'wire') return '#60a5fa';
  return TOWER_STATS[opt.towerType!]?.color ?? '#6b7280';
};

const getTowerPickStats = (towerType: TowerType) => {
  const cfg = TOWER_CONFIG[towerType];
  const wpn = (WEAPON_CONFIG as Record<string, {
    range?: number;
    damage?: number;
    damagePerPower?: number;
    powerCost?: number;
    bulletsPerPower?: number;
  }>)[towerType];

  let pow: number | null = null;
  if (wpn) {
    if (wpn.powerCost != null) pow = wpn.powerCost;
    else if (wpn.bulletsPerPower != null) pow = 1 / wpn.bulletsPerPower;
    else if (cfg.maxPower > 0) pow = cfg.maxPower; // tesla discharges all stored power
  }

  const formatPow = (v: number | null) => {
    if (v == null) return '—';
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  };

  return {
    hp: cfg.hp,
    range: wpn?.range ?? null,
    atk: wpn?.damage ?? wpn?.damagePerPower ?? null,
    pow,
    powLabel: formatPow(pow),
  };
};

export default function App() {
  const {
    canvasRef,
    cameraRef,
    gameState,
    startGame,
    startCustomGame,
    togglePause,
    returnToMenu,
    handlePick,
    openCustomPick,
    selectedTower,
    setSelectedTower,
    placeMonsterMode,
    setPlaceMonsterMode,
    selectedMonsterType,
    setSelectedMonsterType,
    staticMonster,
    setStaticMonster,
    skipToNextWave,
    toastMessage,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasMouseLeave,
    handleCanvasWheel,
    handleCanvasContextMenu,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
  } = useGameLoop();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codexTower, setCodexTower] = useState<TowerType | null>(null);
  const [locale, _setLocale] = useState<Locale>(getLocale());

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On mobile, sidebar starts closed; on mobile the sidebar is an overlay
  useEffect(() => {
    if (isMobile && gameState.gameMode === 'custom') setSidebarOpen(false);
  }, [isMobile, gameState.gameMode]);

  const toggleLocale = () => {
    const next: Locale = locale === 'en' ? 'zh' : 'en';
    setLocale(next);
    _setLocale(next);
  };
  const i = t();

  const [tipIndex, setTipIndex] = useState(0);
  const [tipHidden, setTipHidden] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS_CONFIG.tips.length);
    }, TIPS_CONFIG.intervalMs);
    return () => clearInterval(id);
  }, []);

  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const startTutorial = () => { startGame(); setTutorialStep(0); };
  const dismissTutorial = () => {
    setTutorialStep(null);
    try { localStorage.setItem('electroguard_tutorial_done', '1'); } catch {}
  };
  const handleStartGame = () => {
    startGame();
    try { if (localStorage.getItem('electroguard_tutorial_done') !== '1') setTutorialStep(0); } catch {}
  };

  useEffect(() => {
    if (gameState.status === 'menu' || gameState.status === 'gameover') {
      if (tutorialStep !== null) dismissTutorial();
      return;
    }
    if (tutorialStep === 1 && gameState.status === 'playing') setTutorialStep(2);
    else if (tutorialStep === 4 && gameState.wires.length > 0) setTutorialStep(5);
  }, [tutorialStep, gameState]);

  const renderTowerButton = (type: TowerType) => {
    const isCustom = gameState.gameMode === 'custom';
    const count = gameState.towerInventory[type] ?? 0;
    const hasStock = isCustom || count > 0;
    const isSelected = selectedTower === type;
    const label = i.towerName[type] ?? type;

    return (
      <div key={type} className="flex w-full items-stretch min-w-0">
        <button
          onClick={() => {
            setPlaceMonsterMode(false);
            setSelectedTower(isSelected ? null : type);
          }}
          disabled={!hasStock || gameState.status !== 'playing'}
          className={`flex flex-1 min-w-0 items-center gap-2.5 px-3 py-3 rounded-lg border transition-all ${
            isSelected
              ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
              : hasStock
                ? 'border-gray-700 bg-gray-800/80 hover:bg-gray-700 hover:border-gray-500'
                : 'border-gray-800 bg-gray-900/50 opacity-40 cursor-not-allowed'
          }`}
          title={i.towerDesc[type] ?? TOWER_STATS[type].description}
        >
          <div className="text-gray-400 shrink-0"><TowerIcon type={type} size={22} /></div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-bold text-gray-200 leading-tight truncate w-full text-left">{label}</span>
            <span className="text-xs text-emerald-400 font-mono leading-tight">{isCustom ? '\u221E' : `x${count}`}</span>
          </div>
        </button>
      </div>
    );
  };

  const renderPlaceMonsterButton = () => {
    const isActive = placeMonsterMode;
    const enemyTypes: EnemyType[] = ['scout', 'grunt', 'tank', 'saboteur', 'overlord'];

    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setSelectedTower(null);
            setPlaceMonsterMode(!isActive);
          }}
          disabled={gameState.status !== 'playing'}
          className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border transition-all ${
            isActive
              ? 'border-rose-500 bg-rose-500/15 shadow-[0_0_10px_rgba(244,63,94,0.25)] text-rose-200'
              : gameState.status === 'playing'
                ? 'border-gray-700 bg-gray-800/80 hover:bg-gray-700 hover:border-gray-500 text-gray-200'
                : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-40'
          }`}
        >
          <div className={`shrink-0 ${isActive ? 'text-rose-300' : 'text-gray-400'}`}><Activity size={22} /></div>
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-sm font-bold leading-tight">{i.placeMonster}</span>
            <span className={`text-xs font-mono leading-tight ${isActive ? 'text-rose-300' : 'text-rose-400'}`}>
              {i.enemyName[selectedMonsterType]} · {staticMonster ? i.staticMonster : 'AI'} · {isActive ? 'ON' : 'OFF'}
            </span>
          </div>
        </button>

        <div className="px-1">
          <div className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">{i.monsterType}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {enemyTypes.map((type) => {
              const isSelected = selectedMonsterType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedTower(null);
                    setSelectedMonsterType(type);
                    setPlaceMonsterMode(true);
                  }}
                  disabled={gameState.status !== 'playing'}
                  className={`px-2.5 py-2 rounded-md border text-xs font-bold transition-all ${
                    isSelected
                      ? 'border-rose-500 bg-rose-500/15 text-rose-200'
                      : gameState.status === 'playing'
                        ? 'border-gray-700 bg-gray-900/60 text-gray-300 hover:bg-gray-800 hover:border-gray-500'
                        : 'border-gray-800 bg-gray-900/40 text-gray-500 cursor-not-allowed opacity-40'
                  }`}
                >
                  {i.enemyName[type]}
                </button>
              );
            })}
          </div>
        </div>

        <label className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all ${
          gameState.status === 'playing'
            ? 'border-gray-700 bg-gray-900/50 text-gray-200'
            : 'border-gray-800 bg-gray-900/40 text-gray-500 opacity-40'
        }`}>
          <input
            type="checkbox"
            checked={staticMonster}
            onChange={(e) => setStaticMonster(e.target.checked)}
            disabled={gameState.status !== 'playing'}
            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight">{i.staticMonster}</div>
            <div className="text-xs text-gray-400 leading-relaxed">{i.staticMonsterHint}</div>
          </div>
        </label>
      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-950 text-gray-100 font-sans flex flex-col overflow-hidden">

      {/* Top Stats Bar */}
      <div className="shrink-0 bg-gray-900/90 border-b border-gray-800 px-2 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-6">
        <h1 className="text-sm sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 shrink-0">
          ELECTROGUARD
        </h1>

        {gameState.gameMode === 'custom' ? (
          <div className="flex items-center gap-1 sm:gap-1.5 text-orange-400">
            <Wrench size={14} />
            <span className="text-xs uppercase font-bold hidden sm:inline">{i.customMode}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-1.5 text-red-400">
            <Activity size={14} />
            <span className="text-xs text-gray-500 uppercase font-bold hidden sm:inline">{i.wave}</span>
            <span className="text-base sm:text-lg font-mono font-bold ml-0.5 sm:ml-1">{gameState.wave || '-'}</span>
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-1.5 text-blue-400">
          <Cable size={14} />
          <span className="text-xs text-gray-500 uppercase font-bold hidden sm:inline">{i.wires}</span>
          <span className="text-base sm:text-lg font-mono font-bold ml-0.5 sm:ml-1">{gameState.gameMode === 'custom' ? '\u221E' : gameState.wireInventory}</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 text-white">
          <span className="text-xs text-gray-500 uppercase font-bold hidden sm:inline">{i.score}</span>
          <span className="text-base sm:text-lg font-mono font-bold ml-0.5 sm:ml-1">{gameState.score}</span>
        </div>

        {gameState.gameMode !== 'custom' && gameState.status === 'playing' && gameState.enemiesToSpawn === 0 && gameState.enemies.length === 0 && (
          <div className="flex items-center gap-1 sm:gap-3 ml-1 sm:ml-2">
            <div className="text-blue-300 text-[10px] sm:text-xs font-medium animate-pulse hidden sm:block">
              {i.nextWaveIn(Math.ceil(GLOBAL_CONFIG.waveDelay - gameState.waveTimer))}
            </div>
            <button
              onClick={skipToNextWave}
              className="px-2 sm:px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <Play size={10} /> <span className="hidden sm:inline">{i.startNextWave}</span><span className="sm:hidden">GO</span>
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggleLocale}
            className="p-1 sm:p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
            title="EN / 中文"
          >
            <Globe size={14} />
            <span className="hidden sm:inline">{locale === 'en' ? '中文' : 'EN'}</span>
          </button>
          {(gameState.status === 'playing' || gameState.status === 'paused') && (
            <button
              onClick={togglePause}
              className="p-1 sm:p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              title={gameState.status === 'playing' ? i.pause : i.resume}
            >
              {gameState.status === 'playing' ? <Pause size={16} /> : <Play size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Tips Bar — hidden on mobile */}
      {!isMobile && (gameState.status === 'playing' || gameState.status === 'paused') && !tipHidden && (
        <div className="shrink-0 bg-gray-900/80 border-b border-gray-800 px-4 py-1.5 flex items-center gap-3">
          <span className="text-amber-400 text-sm shrink-0">💡</span>
          <p
            key={tipIndex}
            className="text-sm text-gray-300 leading-relaxed flex-1 animate-[fadeIn_0.5s_ease-in-out]"
          >
            {i.gameTips[TIPS_CONFIG.tips[tipIndex]] ?? TIPS_CONFIG.tips[tipIndex]}
          </p>
          <button
            onClick={() => setTipHidden(true)}
            className="shrink-0 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
            title={i.hidePanel}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Area: Canvas + Build Panel */}
      <div className="flex-1 flex min-h-0 relative">

        {/* Canvas Area */}
        <div className="flex-1 min-w-0 p-1 sm:p-2">
          <div className="relative rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.6)] bg-gray-900 w-full h-full">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              onWheel={handleCanvasWheel}
              onContextMenu={handleCanvasContextMenu}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
              onTouchCancel={handleCanvasTouchEnd}
              className={`block w-full h-full touch-none ${gameState.status === 'playing' ? (selectedTower || placeMonsterMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing') : ''}`}
            />

            {/* Controls Guide — top-left (desktop only) */}
            {!isMobile && (gameState.status === 'playing' || gameState.status === 'paused') && (
              controlsHidden ? (
                <button
                  onClick={() => setControlsHidden(false)}
                  className="absolute top-2 left-2 p-1.5 bg-gray-950/60 backdrop-blur-sm rounded-lg border border-gray-700/40 text-gray-500 hover:text-gray-300 hover:bg-gray-800/70 transition-colors"
                  title={locale === 'zh' ? '显示操作指南' : 'Show Controls'}
                >
                  <Keyboard size={14} />
                </button>
              ) : (
                <div className="absolute top-2 left-2 select-none">
                  <div className="bg-gray-950/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-700/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{locale === 'zh' ? '操作指南' : 'Controls'}</span>
                      <button
                        onClick={() => setControlsHidden(true)}
                        className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors ml-3"
                        title={i.hidePanel}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <ul className="space-y-0.5 pointer-events-none">
                      {i.controlsGuide.map((line, idx) => (
                        <li key={idx} className="text-[11px] text-gray-400 leading-snug font-mono whitespace-nowrap">{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            )}

            {/* Toast Notification */}
            {toastMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-gray-900/95 border border-amber-500/60 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.2)] text-amber-300 text-sm font-bold animate-bounce pointer-events-none">
                {toastMessage}
              </div>
            )}

            {/* Menu Overlay */}
            {gameState.status === 'menu' && (
              <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 text-center">
                <h2 className="text-3xl sm:text-5xl font-black mb-3 sm:mb-4 text-white tracking-tight">{i.systemOffline}</h2>
                <p className="text-gray-400 mb-6 sm:mb-8 max-w-lg text-xs sm:text-sm px-2">
                  {i.menuDescription}
                </p>
                <button
                  onClick={handleStartGame}
                  className="group relative w-52 sm:w-64 px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2 text-sm sm:text-base">
                    <Play size={18} /> {i.initializeCore}
                  </span>
                </button>
                <button
                  onClick={startTutorial}
                  className="group relative w-52 sm:w-64 px-6 sm:px-8 py-3 sm:py-4 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-2 sm:mt-3 border border-cyan-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2 text-sm sm:text-base">
                    <BookOpen size={18} /> {i.tutorial}
                  </span>
                </button>
                <button
                  onClick={startCustomGame}
                  className="group relative w-52 sm:w-64 px-6 sm:px-8 py-3 sm:py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-2 sm:mt-3 border border-gray-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2 text-sm sm:text-base">
                    <Wrench size={18} /> {i.customMode}
                  </span>
                </button>
              </div>
            )}

            {/* Pick Overlay (Roguelike 3-choice) */}
            {gameState.status === 'pick' && (
              <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 text-center overflow-y-auto">
                {gameState.pickUiPhase === 'boss_bonus' ? (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-black mb-1 text-amber-400 tracking-tight">{i.bossBonusPickTitle}</h2>
                    <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md leading-relaxed px-2">{i.bossBonusPickDescription}</p>
                  </>
                ) : gameState.wave > 0 ? (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-black mb-1 text-emerald-400 tracking-tight">{i.waveCleared(gameState.wave)}</h2>
                    <p className="text-emerald-300/60 text-xs sm:text-sm font-mono mb-4 sm:mb-6">+{gameState.wave * GLOBAL_CONFIG.waveClearScoreMul} pts</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-black mb-1 text-blue-400 tracking-tight">{i.systemUpgrade}</h2>
                    <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">{i.pickDescription}</p>
                  </>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto items-center">
                  {gameState.pickOptions.map(opt => {
                    const color = getPickColor(opt);
                    const codexType = opt.kind === 'tower' ? opt.towerType : null;
                    return (
                      <div key={opt.id} className="w-full max-w-[200px] sm:w-44 flex flex-col gap-2">
                        {opt.kind === 'tower' && opt.towerType && (() => {
                          const stats = getTowerPickStats(opt.towerType);
                          const color = getPickColor(opt);
                          return (
                            <div className="w-full rounded-lg px-3 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono border" style={{ borderColor: color + '44', backgroundColor: color + '11', color: color }}>
                              <span title={i.statHp}>{i.statHp} {stats.hp}</span>
                              <span title={i.statRange}>{i.statRange} {stats.range != null ? stats.range : '—'}</span>
                              <span title={i.statAtk}>{i.statAtk} {stats.atk != null ? stats.atk : '—'}</span>
                              <span title={i.statPow}>{i.statPow} {stats.powLabel}</span>
                            </div>
                          );
                        })()}
                        <button
                          onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            handlePick(opt.id, {
                              x: rect.left + rect.width / 2,
                              y: rect.top + rect.height / 2,
                            });
                          }}
                          className="group w-full p-4 sm:p-5 rounded-xl border-2 border-gray-700 bg-gray-900/95 hover:bg-gray-800/95 transition-all flex flex-row sm:flex-col items-center text-center gap-3 hover:scale-105 hover:shadow-lg active:scale-95"
                          style={{ '--pick-color': color } as React.CSSProperties}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                        >
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: color + '22', color }}
                          >
                            {opt.kind === 'wire' ? <Cable size={20} /> : <TowerIcon type={opt.towerType!} size={20} />}
                          </div>
                          <div className="flex flex-col items-start sm:items-center min-w-0">
                            <div className="text-sm font-bold text-white">{opt.label}</div>
                            <div className="text-[11px] text-gray-400 leading-snug">{opt.description}</div>
                          </div>
                        </button>
                        {codexType && (
                          <button
                            type="button"
                            title={i.codexButton}
                            onClick={() => setCodexTower(codexType)}
                            className="w-full px-3 py-2 rounded-lg border text-center text-xs font-bold leading-snug transition-all border-amber-700/50 bg-amber-950/35 text-amber-100 hover:bg-amber-900/45 hover:border-amber-500/60"
                          >
                            {i.codexButton}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paused Overlay */}
            {gameState.status === 'paused' && (
              <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 text-center">
                <h2 className="text-3xl sm:text-5xl font-black mb-4 sm:mb-6 text-white tracking-tight">{i.systemPaused}</h2>
                <button
                  onClick={togglePause}
                  className="group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <Play size={20} /> {i.resume}
                  </span>
                </button>
                <button
                  onClick={returnToMenu}
                  className="group relative px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-3 border border-gray-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center gap-2">
                    <LogOut size={20} /> {i.exitToMenu}
                  </span>
                </button>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameState.status === 'gameover' && (
              <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 text-center">
                <h2 className="text-4xl sm:text-6xl font-black mb-2 text-red-500 tracking-tight">{i.coreBreached}</h2>
                <p className="text-red-300/70 text-base sm:text-xl mb-6 sm:mb-8 font-mono">{i.systemFailure}</p>
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

            {/* Tutorial Overlay */}
            {tutorialStep !== null && tutorialStep < i.tutorialSteps.length && (() => {
              const step = i.tutorialSteps[tutorialStep];
              const isInteractive = tutorialStep === 1 || tutorialStep === 4;
              const isFinal = tutorialStep === i.tutorialSteps.length - 1;

              const hlType: Record<number, string> = {
                1: 'arrowDown',
                2: 'spotlight',
                4: 'worldPort',
              };
              const ht = hlType[tutorialStep] ?? '';

              let posClass: string;
              if (isInteractive) {
                posClass = tutorialStep === 1
                  ? 'items-start justify-center pt-4'
                  : tutorialStep === 4
                    ? 'items-end justify-start pb-4 pl-6'
                    : 'items-end justify-center pb-4';
              } else {
                posClass = ht === 'spotlight'
                  ? 'items-end justify-center pb-8'
                  : ht === 'bigArrowRight'
                    ? 'items-start justify-start pl-8 pt-6'
                    : 'items-center justify-center';
              }

              const cam = cameraRef.current;
              const CS = GLOBAL_CONFIG.cellSize;
              const core = gameState.towers.find(tw => tw.type === 'core');

              return (
                <div className={`absolute inset-0 z-50 flex ${posClass} ${isInteractive ? 'pointer-events-none' : ''}`}>
                  {/* Backdrop */}
                  {!isInteractive && (
                    ht === 'spotlight' && core ? (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: `radial-gradient(circle 120px at ${((core.x + core.width / 2) * CS - cam.x) * cam.zoom}px ${((core.y + core.height / 2) * CS - cam.y) * cam.zoom}px, transparent 70%, rgba(3, 7, 18, 0.75) 100%)` }}
                      />
                    ) : !isInteractive ? (
                      <div className="absolute inset-0 bg-gray-950/60" />
                    ) : null
                  )}

                  {/* Pulsing ring on Core (step 2: core spotlight) */}
                  {ht === 'spotlight' && core && (() => {
                    const cx = ((core.x + core.width / 2) * CS - cam.x) * cam.zoom;
                    const cy = ((core.y + core.height / 2) * CS - cam.y) * cam.zoom;
                    return (
                      <>
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-cyan-400/30"
                          style={{ left: `${cx}px`, top: `${cy}px`, width: '200px', height: '200px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-cyan-400/40 animate-[pulse_1.5s_ease-in-out_infinite]"
                          style={{ left: `${cx}px`, top: `${cy}px`, width: '240px', height: '240px', transform: 'translate(-50%, -50%)' }}
                        />
                      </>
                    );
                  })()}

                  {/* World-position target (step 4: place tower) */}
                  {ht === 'worldTarget' && core && (() => {
                    const gx = core.x + core.width + 1;
                    const gy = core.y + 1;
                    const sx = ((gx + 1.5) * CS - cam.x) * cam.zoom;
                    const sy = ((gy + 1.5) * CS - cam.y) * cam.zoom;
                    return (
                      <>
                        <div
                          className="absolute pointer-events-none"
                          style={{ left: `${sx}px`, top: `${sy}px`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-20 h-20 rounded-full border-2 border-cyan-400/40 animate-pulse" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-cyan-400/80 rounded-full" />
                          <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/25" />
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/25" />
                        </div>
                        <div
                          className="absolute pointer-events-none animate-bounce"
                          style={{ left: `${sx}px`, top: `${sy - 110}px`, transform: 'translateX(-50%)' }}
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-[4px] h-16 bg-gradient-to-b from-cyan-400/5 to-cyan-400 rounded-full" />
                            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-cyan-400" />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* World-position port indicator (step 5: connect wire) */}
                  {ht === 'worldPort' && core && (() => {
                    const wx = (core.x + core.width) * CS;
                    const wy = (core.y + core.height * 0.5) * CS;
                    const sx = (wx - cam.x) * cam.zoom;
                    const sy = (wy - cam.y) * cam.zoom;
                    return (
                      <>
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-cyan-400/30"
                          style={{ left: `${sx}px`, top: `${sy}px`, width: '50px', height: '50px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-cyan-400/50 animate-[pulse_1.5s_ease-in-out_infinite]"
                          style={{ left: `${sx}px`, top: `${sy}px`, width: '80px', height: '80px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none rounded-full border border-cyan-400/20 animate-[pulse_2s_ease-in-out_infinite]"
                          style={{ left: `${sx}px`, top: `${sy}px`, width: '110px', height: '110px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none"
                          style={{ left: `${sx}px`, top: `${sy}px`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-3 h-3 bg-cyan-400/80 rounded-full animate-pulse" />
                        </div>
                        <div
                          className="absolute pointer-events-none animate-bounce"
                          style={{ left: `${sx}px`, top: `${sy - 90}px`, transform: 'translateX(-50%)' }}
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-[4px] h-12 bg-gradient-to-b from-cyan-400/5 to-cyan-400 rounded-full" />
                            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-cyan-400" />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Tutorial card */}
                  <div className="relative pointer-events-auto bg-gray-900/95 border border-cyan-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(6,182,212,0.2)] max-w-md w-full mx-2 sm:mx-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-cyan-400/70 text-xs font-mono">{tutorialStep + 1} / {i.tutorialSteps.length}</span>
                      <button onClick={dismissTutorial} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">{i.tutorialSkip}</button>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">{step.text}</p>
                    {step.action && (
                      <div className="text-cyan-300/80 text-xs font-medium animate-pulse mb-3 flex items-center gap-1.5">
                        <span>▸</span> {step.action}
                      </div>
                    )}
                    {/* Tutorial Step 5 Images */}
                    {tutorialStep === 4 && (
                      <div className="flex flex-col gap-2 mb-4">
                        <img 
                          src="/images/tutorial_step5_1.png" 
                          alt="点击电力输出口" 
                          className="w-full rounded-lg border border-gray-700"
                        />
                        <img 
                          src="/images/tutorial_step5_2.png" 
                          alt="连接到输入口" 
                          className="w-full rounded-lg border border-gray-700"
                        />
                      </div>
                    )}
                    {!isInteractive && (
                      <button
                        onClick={() => isFinal ? dismissTutorial() : setTutorialStep(tutorialStep + 1)}
                        className="w-full px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors text-sm"
                      >
                        {isFinal ? i.tutorialDone : i.tutorialNext}
                      </button>
                    )}

                    {/* Arrow down to pick cards (step 1) */}
                    {ht === 'arrowDown' && (
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-11 flex flex-col items-center animate-bounce pointer-events-none">
                        <div className="w-px h-5 bg-gradient-to-b from-cyan-400 to-cyan-400/20" />
                        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[10px] border-l-transparent border-r-transparent border-t-cyan-400" />
                      </div>
                    )}

                    {/* Large arrow right to sidebar (step 3) */}
                    {ht === 'bigArrowRight' && (
                      <div className="absolute top-1/3 -translate-y-1/2 left-[calc(100%+16px)] flex items-center pointer-events-none animate-pulse">
                        <div className="h-[3px] w-44 bg-gradient-to-r from-cyan-400/50 to-cyan-400 rounded-full" />
                        <div className="w-0 h-0 border-t-[12px] border-b-[12px] border-l-[18px] border-t-transparent border-b-transparent border-l-cyan-400" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sidebar toggle + panel (custom mode only) */}
        {gameState.gameMode === 'custom' && (isMobile ? (
          <>
            {/* Mobile sidebar toggle FAB */}
            {(gameState.status === 'playing' || gameState.status === 'paused') && !sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="absolute bottom-3 right-3 z-30 w-12 h-12 bg-gray-800/90 backdrop-blur-sm hover:bg-gray-700 rounded-full border border-gray-600 flex items-center justify-center text-gray-300 shadow-lg active:scale-95 transition-transform"
                title={i.showPanel}
              >
                <Menu size={20} />
              </button>
            )}
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="absolute inset-0 z-40 flex" onClick={() => setSidebarOpen(false)}>
                <div className="flex-1" />
                <div
                  className="w-[240px] bg-gray-900/95 backdrop-blur-md border-l border-gray-800 p-3 flex flex-col gap-2 overflow-y-auto animate-[slideInRight_0.2s_ease-out]"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-1 py-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{i.inventory}</span>
                    <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  {renderTowerButton('blaster')}
                  {renderTowerButton('gatling')}
                  {renderTowerButton('sniper')}
                  {renderTowerButton('tesla')}
                  {renderTowerButton('generator')}
                  {renderTowerButton('shield')}
                  {renderTowerButton('battery')}
                  {renderTowerButton('bus')}
                  {renderPlaceMonsterButton()}

                  <div className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-gray-800 bg-gray-900/50 w-full">
                    <div className="text-blue-400 shrink-0"><Cable size={22} /></div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-sm font-bold text-gray-200 leading-tight">{i.wires}</span>
                      <span className="text-xs text-blue-400 font-mono leading-tight">{gameState.gameMode === 'custom' ? '\u221E' : `x${gameState.wireInventory}`}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openCustomPick}
                    disabled={gameState.status !== 'playing' && gameState.status !== 'paused'}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border transition-all ${
                      gameState.status === 'playing' || gameState.status === 'paused'
                        ? 'border-amber-700/70 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15 hover:border-amber-500/70'
                        : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <div className="shrink-0"><Play size={18} /></div>
                    <span className="text-sm font-bold leading-tight">{i.openPick}</span>
                  </button>

                  <div className="mt-2 text-xs text-gray-600 px-1 py-1 leading-relaxed">
                    <p>{i.clickToPlaceMonster}</p>
                    <p>{i.clickToRotate}</p>
                    <p>{i.dragToWire}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Desktop: original sidebar */
          <div className="relative shrink-0 flex">
            {/* Toggle button */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="absolute -left-9 top-1/2 -translate-y-1/2 z-10 w-9 h-16 bg-gray-800 hover:bg-gray-700 border border-gray-700 border-r-0 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              title={sidebarOpen ? i.hidePanel : i.showPanel}
            >
              {sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Right Build Panel — Inventory based */}
            <div
              className={`bg-gray-900/80 border-l border-gray-800 p-3.5 flex flex-col gap-2.5 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${
                sidebarOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 p-0 border-l-0'
              } ${tutorialStep === 3 || tutorialStep === 4 ? 'shadow-[0_0_20px_rgba(6,182,212,0.4),inset_0_0_20px_rgba(6,182,212,0.15)] border-l-cyan-500/50' : ''}`}
            >
              <div className="min-w-[236px] flex flex-col h-full">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-500 px-1 py-1.5">
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
                {renderPlaceMonsterButton()}

                <div className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-gray-800 bg-gray-900/50 w-full">
                  <div className="text-blue-400 shrink-0"><Cable size={22} /></div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-sm font-bold text-gray-200 leading-tight">{i.wires}</span>
                    <span className="text-xs text-blue-400 font-mono leading-tight">{gameState.gameMode === 'custom' ? '\u221E' : `x${gameState.wireInventory}`}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openCustomPick}
                  disabled={gameState.status !== 'playing' && gameState.status !== 'paused'}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border transition-all ${
                    gameState.status === 'playing' || gameState.status === 'paused'
                      ? 'border-amber-700/70 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15 hover:border-amber-500/70'
                      : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="shrink-0"><Play size={18} /></div>
                  <span className="text-sm font-bold leading-tight">{i.openPick}</span>
                </button>

                <div className="mt-4 text-xs text-gray-600 px-1 py-2 leading-relaxed">
                  <p>{i.clickToPlaceMonster}</p>
                  <p>{i.clickToRotate}</p>
                  <p>{i.dragToWire}</p>
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Machine codex modal */}
      {codexTower && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-sm"
          onClick={() => setCodexTower(null)}
          role="presentation"
        >
          <div
            className="max-w-md w-full bg-gray-900/98 border border-gray-700 rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="codex-title"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-gray-300 shrink-0 p-2 rounded-lg bg-gray-800/80 border border-gray-700">
                  <TowerIcon type={codexTower} size={26} />
                </div>
                <h2 id="codex-title" className="text-lg font-bold text-white leading-tight truncate">
                  {i.towerName[codexTower] ?? codexTower}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCodexTower(null)}
                className="shrink-0 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label={getLocale() === 'zh' ? '关闭' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[min(70vh,28rem)] overflow-y-auto">
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {i.towerCodex[codexTower] ?? i.towerDesc[codexTower] ?? TOWER_STATS[codexTower].description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
