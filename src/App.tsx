import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Activity, BookOpen, Cable, Coins, Globe, Keyboard, LogOut, Pause, Play, RotateCcw, Wrench, X } from 'lucide-react';
import { useGameLoop } from './game/useGameLoop';
import type { GameState, TowerType } from './game/types';
import { t, getLocale, setLocale, Locale } from './game/i18n';
import { GLOBAL_CONFIG, TIPS_CONFIG } from './game/config';
import { PickOverlay } from './game/ui/PickOverlay';
import { ShopPanel } from './game/ui/ShopPanel';
import { TowerCodexModal } from './game/ui/TowerCodexModal';

const KeyCap = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`inline-flex h-6 min-w-8 items-center justify-center rounded-md border border-gray-600/70 bg-gray-900/90 px-2 text-[10px] font-black uppercase text-gray-200 shadow-[inset_0_-2px_0_rgba(255,255,255,0.06)] ${className}`}>
    {children}
  </span>
);

const MouseButtonIcon = ({ button, accent = false }: { button: 'left' | 'right' | 'wheel'; accent?: boolean }) => (
  <span className="relative inline-flex h-6 w-7 overflow-hidden rounded-md border border-gray-600/70 bg-gray-900/90 shadow-[inset_0_-2px_0_rgba(255,255,255,0.06)]">
    <span className={`absolute left-0 top-0 h-2.5 w-1/2 border-b border-r border-gray-600/70 ${button === 'left' || accent ? 'bg-cyan-400/80' : 'bg-gray-800'}`} />
    <span className={`absolute right-0 top-0 h-2.5 w-1/2 border-b border-gray-600/70 ${button === 'right' ? 'bg-cyan-400/80' : 'bg-gray-800'}`} />
    <span className={`absolute left-1/2 top-1 h-2 w-1 -translate-x-1/2 rounded-full ${button === 'wheel' ? 'bg-cyan-300' : 'bg-gray-600'}`} />
    <span className="absolute bottom-1 left-1/2 h-2.5 w-3.5 -translate-x-1/2 rounded-b-full border border-gray-700/80 border-t-0" />
  </span>
);

const ControlKeyIcon = ({ code }: { code: string }) => {
  if (code === 'esc') return <KeyCap>Esc</KeyCap>;
  if (code === 'q') return <KeyCap>Q</KeyCap>;
  if (code === 'leftClick') return <MouseButtonIcon button="left" />;
  if (code === 'rightClick') return <MouseButtonIcon button="right" />;
  if (code === 'wheel') return <MouseButtonIcon button="wheel" />;
  if (code === 'leftDrag') {
    return (
      <span className="inline-flex items-center gap-1">
        <MouseButtonIcon button="left" accent />
        <span className="text-[10px] font-black text-cyan-300">+</span>
        <KeyCap className="min-w-6 px-1">↔</KeyCap>
      </span>
    );
  }
  if (code === 'towerClick') {
    return (
      <span className="inline-flex items-center gap-1">
        <MouseButtonIcon button="left" />
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-cyan-500/50 bg-cyan-500/15 text-[11px] font-black text-cyan-200">⟳</span>
      </span>
    );
  }
  if (code === 'portDrag') {
    return (
      <span className="inline-flex h-6 items-center justify-center gap-1 rounded-md border border-gray-600/70 bg-gray-900/90 px-2">
        <span className="h-2 w-2 rounded-full bg-cyan-300" />
        <span className="h-px w-5 bg-cyan-300/80" />
        <span className="h-2 w-2 rounded-full bg-cyan-300" />
      </span>
    );
  }
  return <KeyCap>{code}</KeyCap>;
};

const TutorialHandCue = ({ className = '' }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`tutorial-hand-cue inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/40 bg-gray-950/90 shadow-[0_0_18px_rgba(34,211,238,0.35)] ${className}`}
  >
    <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none">
      <path
        d="M18.5 23.5V14.4a3.1 3.1 0 0 1 6.2 0v7.2-10.1a3.1 3.1 0 0 1 6.2 0v10.1-7.8a3 3 0 0 1 6 0v11.8-4.9a2.8 2.8 0 0 1 5.6 0v10.5c0 7-4.8 11.3-12.6 11.3h-5.4c-4.6 0-7.8-1.8-10.3-5.7l-4.2-6.7a3.2 3.2 0 0 1 5.4-3.5l2.9 4.1V23.5Z"
        fill="#e0f2fe"
        stroke="#22d3ee"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M18.5 22.5v8.2M24.7 21.7v9M30.9 21.7v9M36.9 25.4v6.4"
        stroke="#0f172a"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.42"
      />
    </svg>
  </span>
);

const AUTO_DEPLOY_TUTORIAL_STEP = 1;
const WIRE_TUTORIAL_STEP = 2;
const CORE_TOWER_TYPES = new Set<TowerType>(['core']);
const TURRET_TOWER_TYPES = new Set<TowerType>(['blaster', 'gatling', 'sniper', 'tesla', 'missile']);
const GENERATOR_TOWER_TYPES = new Set<TowerType>(['generator', 'big_generator']);

const hasDirectPlugBetween = (
  state: GameState,
  sourceTypes: Set<TowerType>,
  targetTypes: Set<TowerType>,
) => state.wires.some((wire) => {
  if (!wire.direct) return false;
  const startTower = state.towerMap.get(wire.startTowerId);
  const endTower = state.towerMap.get(wire.endTowerId);
  if (!startTower || !endTower) return false;

  return (
    (sourceTypes.has(startTower.type) && targetTypes.has(endTower.type)) ||
    (sourceTypes.has(endTower.type) && targetTypes.has(startTower.type))
  );
});

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
    buyShopPack,
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
    refreshShopOffers,
    activeCommandCard,
    activeRepair,
    startRepair,
  } = useGameLoop();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codexTower, setCodexTower] = useState<TowerType | null>(null);
  const [locale, _setLocale] = useState<Locale>(getLocale());
  const [monsterSubTab, setMonsterSubTab] = useState<'type' | 'static'>('type');
  const previousPickStateRef = useRef({
    status: gameState.status,
    pickUiPhase: gameState.pickUiPhase,
  });
  const shopPanelHiddenForWave = false;
  const shopPanelVisible = sidebarOpen && !shopPanelHiddenForWave;
  const canStartNextWave =
    gameState.gameMode !== 'custom' &&
    gameState.status === 'playing' &&
    !gameState.needsPick &&
    gameState.enemiesToSpawn === 0 &&
    gameState.enemies.length === 0 &&
    !gameState.pendingBossBonusPick;
  const [nextWavePromptActive, setNextWavePromptActive] = useState(false);

  useEffect(() => {
    if (!canStartNextWave) {
      setNextWavePromptActive(false);
      return;
    }

    setNextWavePromptActive(false);
    const timeoutId = window.setTimeout(() => {
      setNextWavePromptActive(true);
    }, 20_000);

    return () => window.clearTimeout(timeoutId);
  }, [canStartNextWave]);

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

  useEffect(() => {
    const previous = previousPickStateRef.current;
    const previousWasWavePick =
      previous.status === 'pick' &&
      previous.pickUiPhase !== 'shop_tower' &&
      previous.pickUiPhase !== 'shop_infra' &&
      previous.pickUiPhase !== 'shop_command' &&
      previous.pickUiPhase !== 'shop_base_upgrade';

    if (
      gameState.gameMode !== 'custom' &&
      previousWasWavePick &&
      gameState.status === 'playing' &&
      !gameState.pendingBossBonusPick &&
      !gameState.needsPick
    ) {
      setSidebarOpen(true);
    }

    previousPickStateRef.current = {
      status: gameState.status,
      pickUiPhase: gameState.pickUiPhase,
    };
  }, [
    gameState.status,
    gameState.pickUiPhase,
    gameState.gameMode,
    gameState.pendingBossBonusPick,
    gameState.needsPick,
  ]);

  const toggleLocale = () => {
    const next: Locale = locale === 'en' ? 'zh' : 'en';
    setLocale(next);
    _setLocale(next);
  };
  const i = t();

  const [tipIndex, setTipIndex] = useState(0);
  const [tipHidden, setTipHidden] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [pickOverlayHidden, setPickOverlayHidden] = useState(false);
  const showControlsGuide = !isMobile && (gameState.status === 'playing' || gameState.status === 'paused');
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS_CONFIG.tips.length);
    }, TIPS_CONFIG.intervalMs);
    return () => clearInterval(id);
  }, []);

  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [autoDeployTutorialPending, setAutoDeployTutorialPending] = useState(false);
  const [directPlugProgress, setDirectPlugProgress] = useState({
    coreToTurret: false,
    generatorToTurret: false,
  });
  const startTutorial = () => {
    startGame();
    setAutoDeployTutorialPending(true);
    setDirectPlugProgress({ coreToTurret: false, generatorToTurret: false });
    setTutorialStep(0);
  };
  const dismissTutorial = () => {
    setTutorialStep(null);
    setAutoDeployTutorialPending(false);
    setDirectPlugProgress({ coreToTurret: false, generatorToTurret: false });
    try { localStorage.setItem('electroguard_tutorial_done', '1'); } catch {}
  };
  const handleStartGame = () => {
    startGame();
    try {
      if (localStorage.getItem('electroguard_tutorial_done') !== '1') {
        setAutoDeployTutorialPending(true);
        setDirectPlugProgress({ coreToTurret: false, generatorToTurret: false });
        setTutorialStep(0);
      }
    } catch {}
  };

  useEffect(() => {
    if (gameState.status !== 'pick' && pickOverlayHidden) setPickOverlayHidden(false);
  }, [gameState.status, pickOverlayHidden]);

  useEffect(() => {
    if (gameState.status === 'menu' || gameState.status === 'gameover') {
      if (tutorialStep !== null) dismissTutorial();
      return;
    }
    if (
      tutorialStep === WIRE_TUTORIAL_STEP &&
      !(autoDeployTutorialPending && gameState.status === 'pick' && gameState.wave >= 2)
    ) {
      const nextDirectPlugProgress = {
        coreToTurret:
          directPlugProgress.coreToTurret ||
          hasDirectPlugBetween(gameState, CORE_TOWER_TYPES, TURRET_TOWER_TYPES),
        generatorToTurret:
          directPlugProgress.generatorToTurret ||
          hasDirectPlugBetween(gameState, GENERATOR_TOWER_TYPES, TURRET_TOWER_TYPES),
      };

      if (
        nextDirectPlugProgress.coreToTurret !== directPlugProgress.coreToTurret ||
        nextDirectPlugProgress.generatorToTurret !== directPlugProgress.generatorToTurret
      ) {
        setDirectPlugProgress(nextDirectPlugProgress);
      }

      if (nextDirectPlugProgress.coreToTurret && nextDirectPlugProgress.generatorToTurret) {
        setTutorialStep(WIRE_TUTORIAL_STEP + 1);
      }
    }
    else if (
      tutorialStep === null &&
      autoDeployTutorialPending &&
      gameState.status === 'pick' &&
      gameState.wave >= 2
    ) {
      setTutorialStep(AUTO_DEPLOY_TUTORIAL_STEP);
    }
  }, [tutorialStep, gameState, autoDeployTutorialPending, directPlugProgress]);

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

        <div className="flex items-center gap-1 sm:gap-1.5 text-yellow-400">
          <Coins size={14} />
          <span className="text-xs text-gray-500 uppercase font-bold hidden sm:inline">{i.gold}</span>
          <span className="text-base sm:text-lg font-mono font-bold ml-0.5 sm:ml-1">{gameState.gameMode === 'custom' ? '\u221E' : gameState.gold}</span>
        </div>

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
            className="shrink-0 rounded p-1.5 text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title={i.hidePanel}
          >
            <X size={24} />
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
              className={`block w-full h-full touch-none ${gameState.status === 'playing' ? (selectedTower || placeMonsterMode || activeCommandCard || activeRepair ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing') : ''}`}
            />

            {/* Controls Guide — top-left (desktop only) */}
            {showControlsGuide && (
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
                  <div className="w-[260px] bg-gray-950/70 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-gray-700/40 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{locale === 'zh' ? '操作指南' : 'Controls'}</span>
                      <button
                        onClick={() => setControlsHidden(true)}
                        className="ml-3 rounded p-1.5 text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title={i.hidePanel}
                      >
                        <X size={24} />
                      </button>
                    </div>
                    <ul className="space-y-1.5 pointer-events-none">
                      {i.controlsGuide.map((item, idx) => (
                        <li key={idx} className="grid grid-cols-[78px_1fr] items-center gap-3">
                          <span className="flex justify-end">
                            {item.keys.map((key) => (
                              <ControlKeyIcon key={key} code={key} />
                            ))}
                          </span>
                          <span className="text-[12px] leading-snug text-gray-300">{item.action}</span>
                        </li>
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

            {gameState.status === 'pick' && (
              <PickOverlay
                gameState={gameState}
                labels={i}
                hidden={pickOverlayHidden}
                setHidden={setPickOverlayHidden}
                onPick={handlePick}
                setCodexTower={setCodexTower}
              />
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
              const isPostWaveTutorialStep =
                autoDeployTutorialPending &&
                gameState.status === 'pick' &&
                gameState.wave >= 2 &&
                (tutorialStep === AUTO_DEPLOY_TUTORIAL_STEP || tutorialStep === WIRE_TUTORIAL_STEP);
              const isPostWaveAutoDeployStep = isPostWaveTutorialStep && tutorialStep === AUTO_DEPLOY_TUTORIAL_STEP;
              const isPostWaveWireStep = isPostWaveTutorialStep && tutorialStep === WIRE_TUTORIAL_STEP;
              const step = isPostWaveTutorialStep
                ? i.postWaveTutorialSteps[tutorialStep - AUTO_DEPLOY_TUTORIAL_STEP]
                : i.tutorialSteps[tutorialStep];
              const isDirectPlugStep = tutorialStep === WIRE_TUTORIAL_STEP && !isPostWaveWireStep;
              const isInteractive = isDirectPlugStep;
              const isFinal = tutorialStep === i.tutorialSteps.length - 1;
              const directPlugDoneCount =
                (directPlugProgress.coreToTurret ? 1 : 0) +
                (directPlugProgress.generatorToTurret ? 1 : 0);
              const actionText = isDirectPlugStep
                ? `${step.action ?? ''} (${directPlugDoneCount}/2)`
                : step.action;
              const advanceTutorial = () => {
                if (isPostWaveAutoDeployStep) {
                  setTutorialStep(WIRE_TUTORIAL_STEP);
                } else if (isPostWaveWireStep) {
                  dismissTutorial();
                } else if (isFinal && autoDeployTutorialPending) {
                  setTutorialStep(null);
                } else {
                  setTutorialStep(tutorialStep + 1);
                }
              };

              const hlType: Record<number, string> = {
                0: 'spotlight',
                [WIRE_TUTORIAL_STEP]: 'worldPort',
              };
              const ht = hlType[tutorialStep] ?? '';

              let posClass: string;
              if (isInteractive) {
                posClass = tutorialStep === WIRE_TUTORIAL_STEP
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
              const turret = gameState.towers.find(tw => TURRET_TOWER_TYPES.has(tw.type));
              const generator = gameState.towers.find(tw => GENERATOR_TOWER_TYPES.has(tw.type));
              const toScreen = (wx: number, wy: number) => ({
                x: (wx - cam.x) * cam.zoom,
                y: (wy - cam.y) * cam.zoom,
              });
              const towerCenter = (tower: GameState['towers'][number]) => toScreen(
                (tower.x + tower.width / 2) * CS,
                (tower.y + tower.height / 2) * CS,
              );
              const nearestPortHint = (
                source: GameState['towers'][number],
                target: GameState['towers'][number],
              ) => {
                const sourceCx = source.x + source.width / 2;
                const targetCx = target.x + target.width / 2;
                const sourceCy = source.y + source.height / 2;
                const targetTop = target.y + target.height * 0.24;
                const targetBottom = target.y + target.height * 0.76;
                const targetY = Math.min(targetBottom, Math.max(targetTop, sourceCy));
                const targetX = sourceCx < targetCx ? target.x : target.x + target.width;
                return toScreen(targetX * CS, targetY * CS);
              };
              const directPlugCue = isDirectPlugStep && core && turret
                ? (() => {
                    const source = directPlugProgress.coreToTurret && generator ? generator : turret;
                    const target = directPlugProgress.coreToTurret && generator ? turret : core;
                    const start = towerCenter(source);
                    const end = nearestPortHint(source, target);
                    const minX = Math.min(start.x, end.x);
                    const minY = Math.min(start.y, end.y);
                    const width = Math.max(24, Math.abs(start.x - end.x));
                    const height = Math.max(24, Math.abs(start.y - end.y));
                    const pad = 44;
                    return {
                      start,
                      end,
                      pathBox: {
                        left: minX - pad,
                        top: minY - pad,
                        width: width + pad * 2,
                        height: height + pad * 2,
                      },
                      line: {
                        x1: start.x - minX + pad,
                        y1: start.y - minY + pad,
                        x2: end.x - minX + pad,
                        y2: end.y - minY + pad,
                      },
                    };
                  })()
                : null;
              const displayStepNumber = isPostWaveTutorialStep
                ? tutorialStep - AUTO_DEPLOY_TUTORIAL_STEP + 1
                : tutorialStep + 1;
              const displayStepTotal = isPostWaveTutorialStep
                ? i.postWaveTutorialSteps.length
                : i.tutorialSteps.length;

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

                  {/* World-position direct-plug cue */}
                  {ht === 'worldPort' && directPlugCue && (() => {
                    const { start, end, pathBox, line } = directPlugCue;
                    return (
                      <>
                        <svg
                          className="tutorial-drag-path absolute pointer-events-none overflow-visible"
                          style={{
                            left: `${pathBox.left}px`,
                            top: `${pathBox.top}px`,
                            width: `${pathBox.width}px`,
                            height: `${pathBox.height}px`,
                          }}
                          viewBox={`0 0 ${pathBox.width} ${pathBox.height}`}
                        >
                          <line
                            x1={line.x1}
                            y1={line.y1}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="rgba(8, 47, 73, 0.86)"
                            strokeWidth="10"
                            strokeLinecap="round"
                          />
                          <line
                            x1={line.x1}
                            y1={line.y1}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="rgba(34, 211, 238, 0.9)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="12 10"
                          />
                          <circle r="5" fill="#67e8f9">
                            <animateMotion dur="1.35s" repeatCount="indefinite" path={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`} />
                          </circle>
                        </svg>
                        <div
                          className="absolute pointer-events-none rounded-lg border-2 border-cyan-300/35 bg-cyan-300/5"
                          style={{ left: `${start.x}px`, top: `${start.y}px`, width: '76px', height: '76px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none rounded-lg border-2 border-cyan-300/50 animate-[pulse_1.5s_ease-in-out_infinite]"
                          style={{ left: `${start.x}px`, top: `${start.y}px`, width: '98px', height: '98px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none"
                          style={{ left: `${start.x + 34}px`, top: `${start.y + 34}px`, transform: 'translate(-50%, -50%)' }}
                        >
                          <TutorialHandCue />
                        </div>
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-cyan-400/30"
                          style={{ left: `${end.x}px`, top: `${end.y}px`, width: '50px', height: '50px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none rounded-full border-2 border-cyan-400/50 animate-[pulse_1.5s_ease-in-out_infinite]"
                          style={{ left: `${end.x}px`, top: `${end.y}px`, width: '80px', height: '80px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none rounded-full border border-cyan-400/20 animate-[pulse_2s_ease-in-out_infinite]"
                          style={{ left: `${end.x}px`, top: `${end.y}px`, width: '110px', height: '110px', transform: 'translate(-50%, -50%)' }}
                        />
                        <div
                          className="absolute pointer-events-none"
                          style={{ left: `${end.x}px`, top: `${end.y}px`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div className="w-3 h-3 bg-cyan-400/80 rounded-full animate-pulse" />
                        </div>
                      </>
                    );
                  })()}

                  {/* Tutorial card */}
                  <div className="relative pointer-events-auto bg-gray-900/95 border border-cyan-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(6,182,212,0.2)] max-w-md w-full mx-2 sm:mx-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-cyan-400/70 text-xs font-mono">{displayStepNumber} / {displayStepTotal}</span>
                      <button onClick={dismissTutorial} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">{i.tutorialSkip}</button>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">{step.text}</p>
                    {actionText && (
                      <div className="text-cyan-300/80 text-xs font-medium animate-pulse mb-3 flex items-center gap-1.5">
                        <TutorialHandCue className="h-7 w-7" />
                        <span>{actionText}</span>
                      </div>
                    )}
                    {/* Wire tutorial images */}
                    {isPostWaveWireStep && (
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
                        onClick={advanceTutorial}
                        className="w-full px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors text-sm"
                      >
                        {isFinal || isPostWaveWireStep ? i.tutorialDone : i.tutorialNext}
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
        {!shopPanelHiddenForWave && (gameState.status === 'playing' || gameState.status === 'paused' || gameState.status === 'pick') && (
          <ShopPanel
            gameState={gameState}
            labels={i}
            isMobile={isMobile}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            shopPanelHiddenForWave={shopPanelHiddenForWave}
            shopPanelVisible={shopPanelVisible}
            selectedTower={selectedTower}
            setSelectedTower={setSelectedTower}
            placeMonsterMode={placeMonsterMode}
            setPlaceMonsterMode={setPlaceMonsterMode}
            selectedMonsterType={selectedMonsterType}
            setSelectedMonsterType={setSelectedMonsterType}
            staticMonster={staticMonster}
            setStaticMonster={setStaticMonster}
            monsterSubTab={monsterSubTab}
            setMonsterSubTab={setMonsterSubTab}
            openCustomPick={openCustomPick}
            buyShopPack={buyShopPack}
            refreshShopOffers={refreshShopOffers}
            activeCommandCard={activeCommandCard}
            activeRepair={activeRepair}
            startRepair={startRepair}
            tutorialStep={tutorialStep}
          />
        )}

        {canStartNextWave && (
          <button
            type="button"
            onClick={skipToNextWave}
            className={`absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-400/70 bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition-colors hover:bg-blue-500 active:scale-95 sm:bottom-6 sm:px-6 sm:text-base ${nextWavePromptActive ? 'next-wave-breathe' : ''}`}
          >
            <Play size={18} />
            <span>{i.startNextWave}</span>
          </button>
        )}
      </div>

      {/* Machine codex modal */}
      {codexTower && (
        <TowerCodexModal tower={codexTower} labels={i} onClose={() => setCodexTower(null)} />
      )}
    </div>
  );
}
