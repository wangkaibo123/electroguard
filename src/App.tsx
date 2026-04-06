import { useState, useEffect } from 'react';
import { Battery, Zap, Crosshair, Activity, Play, RotateCcw, Pause, Hexagon, Cable, Target, Wrench, ChevronRight, ChevronLeft, Flame, Focus, Radio, GitMerge, Globe, LogOut, BookOpen } from 'lucide-react';
import { useGameLoop } from './game/useGameLoop';
import { TOWER_STATS, TowerType, PickOption } from './game/types';
import { t, getLocale, setLocale, Locale } from './game/i18n';
import { GLOBAL_CONFIG, TIPS_CONFIG } from './game/config';

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
    cameraRef,
    gameState,
    startGame,
    startCustomGame,
    togglePause,
    returnToMenu,
    handlePick,
    selectedTower,
    setSelectedTower,
    skipToNextWave,
    toastMessage,
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

  const [tipIndex, setTipIndex] = useState(0);
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
    else if (tutorialStep === 4 && gameState.towers.length > 1) setTutorialStep(5);
    else if (tutorialStep === 5 && gameState.wires.length > 0) setTutorialStep(6);
  }, [tutorialStep, gameState]);

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
        className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border transition-all w-full ${
          isSelected
            ? 'border-blue-500 bg-blue-500/15 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
            : hasStock
              ? 'border-gray-700 bg-gray-800/80 hover:bg-gray-700 hover:border-gray-500'
              : 'border-gray-800 bg-gray-900/50 opacity-40 cursor-not-allowed'
        }`}
        title={i.towerDesc[type] ?? TOWER_STATS[type].description}
      >
        <div className="text-gray-400 shrink-0"><TowerIcon type={type} size={20} /></div>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-bold text-gray-200 leading-tight">{label}</span>
          <span className="text-xs text-emerald-400 font-mono leading-tight">{isCustom ? '\u221E' : `x${count}`}</span>
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
          <div className="flex items-center gap-3 ml-2">
            <div className="text-blue-300 text-xs font-medium animate-pulse">
              {i.nextWaveIn(Math.ceil(GLOBAL_CONFIG.waveDelay - gameState.waveTimer))}
            </div>
            <button
              onClick={skipToNextWave}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
            >
              <Play size={12} /> {i.startNextWave}
            </button>
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
        <div className="flex-1 min-w-0 p-2">
          <div className="relative rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.6)] bg-gray-900 w-full h-full">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              onWheel={handleCanvasWheel}
              onContextMenu={handleCanvasContextMenu}
              className={`block w-full h-full ${gameState.status === 'playing' ? (selectedTower ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing') : ''}`}
            />

            {/* Toast Notification */}
            {toastMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-gray-900/95 border border-amber-500/60 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.2)] text-amber-300 text-sm font-bold animate-bounce pointer-events-none">
                {toastMessage}
              </div>
            )}

            {/* Menu Overlay */}
            {gameState.status === 'menu' && (
              <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                <h2 className="text-5xl font-black mb-4 text-white tracking-tight">{i.systemOffline}</h2>
                <p className="text-gray-400 mb-8 max-w-lg text-sm">
                  {i.menuDescription}
                </p>
                <button
                  onClick={handleStartGame}
                  className="group relative w-64 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2">
                    <Play size={20} /> {i.initializeCore}
                  </span>
                </button>
                <button
                  onClick={startTutorial}
                  className="group relative w-64 px-8 py-4 bg-cyan-700 hover:bg-cyan-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-3 border border-cyan-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2">
                    <BookOpen size={20} /> {i.tutorial}
                  </span>
                </button>
                <button
                  onClick={startCustomGame}
                  className="group relative w-64 px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all overflow-hidden mt-3 border border-gray-600"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                  <span className="relative flex items-center justify-center gap-2">
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
                    <p className="text-emerald-300/60 text-sm font-mono mb-6">+{gameState.wave * GLOBAL_CONFIG.waveClearScoreMul} pts</p>
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

            {/* Tutorial Overlay */}
            {tutorialStep !== null && tutorialStep < i.tutorialSteps.length && (() => {
              const step = i.tutorialSteps[tutorialStep];
              const isInteractive = tutorialStep === 1 || tutorialStep === 4 || tutorialStep === 5;
              const isFinal = tutorialStep === i.tutorialSteps.length - 1;

              const hlType: Record<number, string> = {
                1: 'arrowDown',
                2: 'spotlight',
                3: 'bigArrowRight',
                4: 'worldTarget',
                5: 'worldPort',
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
                  <div className="relative pointer-events-auto bg-gray-900/95 border border-cyan-500/40 rounded-xl p-5 shadow-[0_0_25px_rgba(6,182,212,0.2)] max-w-md w-full mx-4 backdrop-blur-sm">
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
            className={`bg-gray-900/80 border-l border-gray-800 p-3 flex flex-col gap-2 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${
              sidebarOpen ? 'w-[180px] opacity-100' : 'w-0 opacity-0 p-0 border-l-0'
            } ${tutorialStep === 3 || tutorialStep === 4 ? 'shadow-[0_0_20px_rgba(6,182,212,0.4),inset_0_0_20px_rgba(6,182,212,0.15)] border-l-cyan-500/50' : ''}`}
          >
            <div className="min-w-[160px] flex flex-col h-full">
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
              {gameState.gameMode === 'custom' && renderTowerButton('target')}

              <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-gray-800 bg-gray-900/50 w-full">
                <div className="text-blue-400 shrink-0"><Cable size={20} /></div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-bold text-gray-200 leading-tight">{i.wires}</span>
                  <span className="text-xs text-blue-400 font-mono leading-tight">{gameState.gameMode === 'custom' ? '\u221E' : `x${gameState.wireInventory}`}</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-600 px-1 py-2 leading-relaxed">
                <p>{i.clickToRotate}</p>
                <p>{i.dragToWire}</p>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-800">
                <div className="px-2 py-2.5 rounded-lg bg-gray-800/60 border border-gray-700/50 min-h-[56px] flex items-start gap-2">
                  <span className="text-amber-400/70 text-xs mt-0.5 shrink-0">💡</span>
                  <p
                    key={tipIndex}
                    className="text-[11px] text-gray-400 leading-relaxed animate-[fadeIn_0.5s_ease-in-out]"
                  >
                    {i.gameTips[TIPS_CONFIG.tips[tipIndex]] ?? TIPS_CONFIG.tips[tipIndex]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
