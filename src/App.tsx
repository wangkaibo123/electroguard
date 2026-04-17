import { useState, useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import { Activity, BookOpen, Cable, Coins, Globe, Keyboard, LogOut, Pause, Play, RotateCcw, Wrench, X } from 'lucide-react';
import { useGameLoop } from './game/useGameLoop';
import type { CodexEntryType, GameState, TowerType } from './game/types';
import { t, getLocale, setLocale, Locale } from './game/i18n';
import { GLOBAL_CONFIG, TIPS_CONFIG } from './game/config';
import { findWirePath, getPortCell, getPortPos, isPortAccessible } from './game/engine';
import { findTowerAtWorldPoint } from './game/gameActions';
import { PickOverlay } from './game/ui/PickOverlay';
import { ShopPanel } from './game/ui/ShopPanel';
import { CodexModal } from './game/ui/CodexModal';

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

const TURRET_DIRECT_PLUG_TUTORIAL_STEP = 1;
const GENERATOR_DIRECT_PLUG_TUTORIAL_STEP = 2;
const NEXT_WAVE_TUTORIAL_STEP = 3;
const POST_WAVE_PICK_STEP = 100;
const POST_WAVE_WIRE_STEP = 101;
const SHOP_TUTORIAL_STEP = 102;
const SHOP_MACHINE_CONTROL_TUTORIAL_STEP = 103;
const POST_WAVE_TUTORIAL_MIN_WAVE = 1;
const POST_WAVE_PICK_CARD_INDEX = 1;
const CORE_TOWER_TYPES = new Set<TowerType>(['core']);
const TURRET_TOWER_TYPES = new Set<TowerType>(['blaster', 'gatling', 'sniper', 'tesla', 'missile']);
const GENERATOR_TOWER_TYPES = new Set<TowerType>(['generator', 'big_generator']);

const getIsMobileViewport = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const shortSide = Math.min(width, height);
  const hasTouch = navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;

  return width < 768 || (shortSide < 520 && (hasTouch || coarsePointer || noHover));
};

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

const hasWireBetween = (
  state: GameState,
  sourceTypes: Set<TowerType>,
  targetTypes: Set<TowerType>,
  requireNonDirect = false,
) => state.wires.some((wire) => {
  if (requireNonDirect && wire.direct) return false;
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
    forceTutorialGeneratorPick,
    focusCameraOnWorld,
    isCameraTransitioning,
    openCustomPick,
    buyShopPack,
    selectedTower,
    setSelectedTower,
    rotatingTowerId,
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
    isTowerDragging,
  } = useGameLoop();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codexTower, setCodexTower] = useState<CodexEntryType | null>(null);
  const [locale, _setLocale] = useState<Locale>(getLocale());
  const [monsterSubTab, setMonsterSubTab] = useState<'type' | 'static'>('type');
  const previousPickStateRef = useRef({
    status: gameState.status,
    pickUiPhase: gameState.pickUiPhase,
  });
  const canStartNextWave =
    gameState.gameMode !== 'custom' &&
    gameState.status === 'playing' &&
    !gameState.needsPick &&
    gameState.enemiesToSpawn === 0 &&
    gameState.themeEnemiesToSpawn.length === 0 &&
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

  // Mobile detection includes phones in landscape, where width alone looks desktop-sized.
  const [isMobile, setIsMobile] = useState(getIsMobileViewport);
  useEffect(() => {
    const onResize = () => setIsMobile(getIsMobileViewport());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  // On mobile, sidebar starts closed; on mobile the sidebar is an overlay
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

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
  const [tutorialToastMessage, setTutorialToastMessage] = useState<string | null>(null);
  const tutorialToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTutorialToast = (message: string, durationMs = 1800) => {
    if (tutorialToastTimerRef.current) clearTimeout(tutorialToastTimerRef.current);
    setTutorialToastMessage(message);
    tutorialToastTimerRef.current = setTimeout(() => setTutorialToastMessage(null), durationMs);
  };
  const showControlsGuide = !isMobile && (gameState.status === 'playing' || gameState.status === 'paused');
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS_CONFIG.tips.length);
    }, TIPS_CONFIG.intervalMs);
    return () => clearInterval(id);
  }, []);

  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const tutorialCameraFocusKeyRef = useRef<string | null>(null);
  const [autoDeployTutorialPending, setAutoDeployTutorialPending] = useState(false);
  const [firstWavePickTutorialDone, setFirstWavePickTutorialDone] = useState(false);
  const [wireTutorialDone, setWireTutorialDone] = useState(false);
  const [wireTutorialPendingAfterDrop, setWireTutorialPendingAfterDrop] = useState(false);
  const [shopTutorialUnlocked, setShopTutorialUnlocked] = useState(false);
  const shopPanelHiddenForWave =
    autoDeployTutorialPending &&
    gameState.gameMode !== 'custom' &&
    !shopTutorialUnlocked;
  const shopPanelVisible = sidebarOpen && !shopPanelHiddenForWave;
  const [directPlugProgress, setDirectPlugProgress] = useState({
    coreToTurret: false,
    generatorToTurret: false,
  });
  const tutorialInputLocked = isCameraTransitioning;
  const startTutorial = () => {
    startGame();
    setAutoDeployTutorialPending(true);
    setFirstWavePickTutorialDone(false);
    setWireTutorialDone(false);
    setWireTutorialPendingAfterDrop(false);
    setShopTutorialUnlocked(false);
    setDirectPlugProgress({ coreToTurret: false, generatorToTurret: false });
    tutorialCameraFocusKeyRef.current = null;
    setTutorialStep(0);
  };
  const dismissTutorial = () => {
    setTutorialStep(null);
    setAutoDeployTutorialPending(false);
    setFirstWavePickTutorialDone(false);
    setWireTutorialDone(false);
    setWireTutorialPendingAfterDrop(false);
    setShopTutorialUnlocked(false);
    setDirectPlugProgress({ coreToTurret: false, generatorToTurret: false });
    tutorialCameraFocusKeyRef.current = null;
    try { localStorage.setItem('electroguard_tutorial_done', '1'); } catch {}
  };
  const handleStartGame = () => {
    startGame();
    try {
      if (localStorage.getItem('electroguard_tutorial_done') !== '1') {
        setAutoDeployTutorialPending(true);
        setFirstWavePickTutorialDone(false);
        setWireTutorialDone(false);
        setWireTutorialPendingAfterDrop(false);
        setShopTutorialUnlocked(false);
        setDirectPlugProgress({ coreToTurret: false, generatorToTurret: false });
        tutorialCameraFocusKeyRef.current = null;
        setTutorialStep(0);
      }
    } catch {}
  };

  useEffect(() => {
    if (tutorialStep === null || gameState.status === 'menu' || gameState.status === 'gameover') {
      tutorialCameraFocusKeyRef.current = null;
      return;
    }

    const CS = GLOBAL_CONFIG.cellSize;
    const core = gameState.towers.find(tw => tw.type === 'core');
    const turret = gameState.towers.find(tw => TURRET_TOWER_TYPES.has(tw.type));
    const generator = gameState.towers.find(tw => GENERATOR_TOWER_TYPES.has(tw.type));
    const centerOf = (tower: GameState['towers'][number]) => ({
      x: (tower.x + tower.width / 2) * CS,
      y: (tower.y + tower.height / 2) * CS,
    });
    const midpoint = (
      a: GameState['towers'][number] | undefined,
      b: GameState['towers'][number] | undefined,
    ) => {
      if (a && b) {
        const ac = centerOf(a);
        const bc = centerOf(b);
        return { x: (ac.x + bc.x) / 2, y: (ac.y + bc.y) / 2 };
      }
      if (a) return centerOf(a);
      if (b) return centerOf(b);
      return null;
    };

    const target =
      tutorialStep === TURRET_DIRECT_PLUG_TUTORIAL_STEP
        ? midpoint(turret, core)
        : tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP
          ? midpoint(generator, turret)
        : tutorialStep === POST_WAVE_WIRE_STEP
          ? midpoint(generator, turret)
        : tutorialStep === SHOP_MACHINE_CONTROL_TUTORIAL_STEP
          ? (turret ? centerOf(turret) : null)
        : core
          ? centerOf(core)
        : null;

    if (!target) return;

    const focusKey = `${tutorialStep}:${Math.round(target.x)}:${Math.round(target.y)}`;
    if (tutorialCameraFocusKeyRef.current === focusKey) return;
    tutorialCameraFocusKeyRef.current = focusKey;
    focusCameraOnWorld(target, 700, { x: 0.5, y: 0.36 });
  }, [tutorialStep, gameState.status, gameState.towers, focusCameraOnWorld]);

  useEffect(() => {
    if (gameState.status !== 'pick' && pickOverlayHidden) setPickOverlayHidden(false);
  }, [gameState.status, pickOverlayHidden]);

  useEffect(() => {
    if (
      pickOverlayHidden &&
      tutorialStep === POST_WAVE_PICK_STEP
    ) {
      setPickOverlayHidden(false);
    }
  }, [pickOverlayHidden, tutorialStep]);

  useEffect(() => {
    if (gameState.status === 'menu' || gameState.status === 'gameover') {
      if (tutorialStep !== null) dismissTutorial();
      return;
    }
    if (
      (tutorialStep === TURRET_DIRECT_PLUG_TUTORIAL_STEP || tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP) &&
      !(autoDeployTutorialPending && gameState.status === 'pick' && gameState.wave >= POST_WAVE_TUTORIAL_MIN_WAVE)
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

      if (isTowerDragging) return;

      if (tutorialStep === TURRET_DIRECT_PLUG_TUTORIAL_STEP && nextDirectPlugProgress.coreToTurret) {
        setTutorialStep(GENERATOR_DIRECT_PLUG_TUTORIAL_STEP);
      } else if (tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP && nextDirectPlugProgress.generatorToTurret) {
        setTutorialStep(GENERATOR_DIRECT_PLUG_TUTORIAL_STEP + 1);
      }
    }
    else if (
      tutorialStep === POST_WAVE_WIRE_STEP &&
      hasWireBetween(gameState, GENERATOR_TOWER_TYPES, TURRET_TOWER_TYPES, true)
    ) {
      setWireTutorialDone(true);
      setTutorialStep(null);
    }
    else if (
      tutorialStep === null &&
      autoDeployTutorialPending &&
      wireTutorialPendingAfterDrop &&
      gameState.status === 'playing' &&
      gameState.incomingDrops.length === 0
    ) {
      setWireTutorialPendingAfterDrop(false);
      setTutorialStep(POST_WAVE_WIRE_STEP);
    }
    else if (
      tutorialStep === null &&
      autoDeployTutorialPending &&
      gameState.status === 'pick' &&
      gameState.pickUiPhase === 'standard' &&
      gameState.wave >= POST_WAVE_TUTORIAL_MIN_WAVE
    ) {
      if (gameState.wave === 1 && !firstWavePickTutorialDone) {
        forceTutorialGeneratorPick();
        setTutorialStep(POST_WAVE_PICK_STEP);
      }
    }
    else if (
      tutorialStep === null &&
      autoDeployTutorialPending &&
      wireTutorialDone &&
      !shopTutorialUnlocked &&
      canStartNextWave &&
      gameState.wave >= 2
    ) {
      setShopTutorialUnlocked(true);
      setSidebarOpen(true);
      setTutorialStep(SHOP_TUTORIAL_STEP);
    }
    else if (
      tutorialStep === SHOP_MACHINE_CONTROL_TUTORIAL_STEP &&
      rotatingTowerId
    ) {
      dismissTutorial();
    }
  }, [
    tutorialStep,
    gameState,
    autoDeployTutorialPending,
    directPlugProgress,
    isTowerDragging,
    firstWavePickTutorialDone,
    wireTutorialDone,
    wireTutorialPendingAfterDrop,
    shopTutorialUnlocked,
    canStartNextWave,
    forceTutorialGeneratorPick,
    rotatingTowerId,
  ]);

  const tutorialHighlightedPickIndex =
    autoDeployTutorialPending &&
    gameState.status === 'pick' &&
    gameState.pickUiPhase === 'standard' &&
    tutorialStep === POST_WAVE_PICK_STEP
      ? POST_WAVE_PICK_CARD_INDEX
      : null;

  const tutorialForcedGeneratorOption =
    tutorialStep === POST_WAVE_PICK_STEP
      ? gameState.pickOptions[POST_WAVE_PICK_CARD_INDEX]
      : null;

  const tutorialDisabledPickIds =
    tutorialForcedGeneratorOption
      ? gameState.pickOptions
          .filter(option => option.id !== tutorialForcedGeneratorOption.id)
          .map(option => option.id)
      : [];
  const battleViewToggleLocked =
    autoDeployTutorialPending &&
    !firstWavePickTutorialDone &&
    tutorialStep === POST_WAVE_PICK_STEP;
  const handleNextWaveClick = () => {
    if (tutorialInputLocked) return;
    if (tutorialStep === NEXT_WAVE_TUTORIAL_STEP && autoDeployTutorialPending) {
      setTutorialStep(null);
    }
    skipToNextWave();
  };

  const handleTutorialPick = (optionId: string, origin?: { x: number; y: number }) => {
    if (tutorialInputLocked) return;
    const option = gameState.pickOptions.find(pickOption => pickOption.id === optionId);
    if (!option) return;

    if (tutorialStep === POST_WAVE_PICK_STEP) {
      const forced = gameState.pickOptions[POST_WAVE_PICK_CARD_INDEX];
      if (
        option.id !== forced?.id ||
        option.kind !== 'tower' ||
        option.towerType !== 'generator'
      ) {
        return;
      }
    }

    const wasFirstWavePickTutorial = tutorialStep === POST_WAVE_PICK_STEP && gameState.wave === 1;
    handlePick(optionId, origin);

    if (wasFirstWavePickTutorial) {
      setFirstWavePickTutorialDone(true);
      setTutorialStep(null);
      setWireTutorialPendingAfterDrop(true);
    }
  };
  const isNearAnyPortAt = (wx: number, wy: number, portHitRadius: number) =>
    gameState.towers.some(tower =>
      !tower.isRuined &&
      tower.ports.some(port => {
        const pos = getPortPos(tower, port);
        return Math.hypot(pos.x - wx, pos.y - wy) < portHitRadius;
      }),
    );
  const getCanvasWorldPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const cam = cameraRef.current;
    return {
      wx: (clientX - rect.left) / cam.zoom + cam.x,
      wy: (clientY - rect.top) / cam.zoom + cam.y,
    };
  };
  const wireDragLockedByTutorial =
    autoDeployTutorialPending &&
    !wireTutorialDone &&
    tutorialStep !== POST_WAVE_WIRE_STEP;
  const blockWireDragBeforeWireTutorial = (clientX: number, clientY: number, portHitRadius: number) => {
    if (!wireDragLockedByTutorial || gameState.status !== 'playing') return false;
    const point = getCanvasWorldPoint(clientX, clientY);
    if (!point) return false;
    return isNearAnyPortAt(point.wx, point.wy, portHitRadius);
  };
  const blockMachineDragDuringWireTutorial = (clientX: number, clientY: number, portHitRadius: number) => {
    if (tutorialStep !== POST_WAVE_WIRE_STEP || gameState.status !== 'playing') return false;
    const point = getCanvasWorldPoint(clientX, clientY);
    if (!point) return false;
    if (isNearAnyPortAt(point.wx, point.wy, portHitRadius)) return false;

    if (findTowerAtWorldPoint(gameState, point.wx, point.wy)) {
      showTutorialToast(i.wireTutorialDragPortOnly);
      return true;
    }

    return false;
  };

  const handleTutorialCanvasMouseDown = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (tutorialInputLocked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.button === 0 && blockWireDragBeforeWireTutorial(event.clientX, event.clientY, 15)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.button === 0 && blockMachineDragDuringWireTutorial(event.clientX, event.clientY, 15)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    handleCanvasMouseDown(event);
  };

  const handleTutorialCanvasTouchStart = (event: ReactTouchEvent<HTMLCanvasElement>) => {
    if (tutorialInputLocked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const touch = event.touches[0];
    if (touch && blockWireDragBeforeWireTutorial(touch.clientX, touch.clientY, 20)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (touch && blockMachineDragDuringWireTutorial(touch.clientX, touch.clientY, 20)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    handleCanvasTouchStart(event);
  };
  const activeToastMessage = toastMessage ?? tutorialToastMessage;

  return (
    <div className="app-shell bg-gray-950 text-gray-100 font-sans flex flex-col overflow-hidden">

      {/* Top Stats Bar */}
      <div className="shrink-0 bg-gray-900/90 border-b border-gray-800 px-2 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-6">
        <h1 className="app-title text-sm sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 shrink-0">
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
              disabled={tutorialInputLocked}
              className="p-1 sm:p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors disabled:cursor-wait disabled:opacity-60"
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
              onMouseDown={handleTutorialCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseLeave}
              onWheel={handleCanvasWheel}
              onContextMenu={handleCanvasContextMenu}
              onTouchStart={handleTutorialCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
              onTouchCancel={handleCanvasTouchEnd}
              className={`block w-full h-full touch-none ${gameState.status === 'playing' ? (selectedTower || placeMonsterMode || activeCommandCard || activeRepair ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing') : ''}`}
            />
            {tutorialInputLocked && (
              <div
                className="absolute inset-0 z-40 cursor-wait"
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onTouchStart={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onWheel={event => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            )}

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
                  <div className="w-[220px] bg-gray-950/70 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-gray-700/40 shadow-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{locale === 'zh' ? '操作指南' : 'Controls'}</span>
                      <button
                        onClick={() => setControlsHidden(true)}
                        className="ml-2 rounded p-1 text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title={i.hidePanel}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <ul className="space-y-1 pointer-events-none">
                      {i.controlsGuide.map((item, idx) => (
                        <li key={idx} className="grid grid-cols-[64px_1fr] items-center gap-2">
                          <span className="flex justify-end origin-right scale-90">
                            {item.keys.map((key) => (
                              <ControlKeyIcon key={key} code={key} />
                            ))}
                          </span>
                          <span className="text-[11px] leading-tight text-gray-300">{item.action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            )}

            {/* Toast Notification */}
            {activeToastMessage && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-gray-900/95 border border-amber-500/60 rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.2)] text-amber-300 text-sm font-bold animate-bounce pointer-events-none">
                {activeToastMessage}
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
                onPick={handleTutorialPick}
                setCodexTower={setCodexTower}
                highlightPickIndex={tutorialHighlightedPickIndex}
                disabledPickIds={tutorialDisabledPickIds}
                battleViewToggleLocked={battleViewToggleLocked || tutorialInputLocked}
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
            {tutorialStep !== null && (tutorialStep < i.tutorialSteps.length || tutorialStep >= POST_WAVE_PICK_STEP) && (() => {
              const isPostWaveTutorialStep =
                autoDeployTutorialPending &&
                (tutorialStep === POST_WAVE_PICK_STEP || tutorialStep === POST_WAVE_WIRE_STEP);
              const isShopTutorialStep = tutorialStep === SHOP_TUTORIAL_STEP;
              const isShopMachineControlTutorialStep = tutorialStep === SHOP_MACHINE_CONTROL_TUTORIAL_STEP;
              const isShopPostTutorialStep = isShopTutorialStep || isShopMachineControlTutorialStep;
              const isPostWavePickStep = isPostWaveTutorialStep && tutorialStep === POST_WAVE_PICK_STEP;
              const isPostWaveWireStep = isPostWaveTutorialStep && tutorialStep === POST_WAVE_WIRE_STEP;
              const postWaveStepIndex =
                tutorialStep === POST_WAVE_WIRE_STEP ? 1 : 0;
              const step = isPostWaveTutorialStep
                ? i.postWaveTutorialSteps[postWaveStepIndex]
                : isShopTutorialStep
                  ? i.shopTutorialStep
                : isShopMachineControlTutorialStep
                  ? i.shopMachineControlTutorialStep
                : i.tutorialSteps[tutorialStep];
              const isDirectPlugStep =
                !isPostWaveTutorialStep &&
                (tutorialStep === TURRET_DIRECT_PLUG_TUTORIAL_STEP || tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP);
              const isNextWaveTutorialStep = tutorialStep === NEXT_WAVE_TUTORIAL_STEP;
              const isPickChoiceTutorialStep = isPostWavePickStep;
              const isInteractive =
                isDirectPlugStep ||
                isPickChoiceTutorialStep ||
                isPostWaveWireStep ||
                isNextWaveTutorialStep ||
                isShopMachineControlTutorialStep;
              const isFinal = tutorialStep === i.tutorialSteps.length - 1;
              const actionText = step.action;
              const advanceTutorial = () => {
                if (isPostWavePickStep) {
                  setTutorialStep(POST_WAVE_WIRE_STEP);
                } else if (isPostWaveWireStep) {
                  setTutorialStep(null);
                } else if (isShopTutorialStep) {
                  setTutorialStep(SHOP_MACHINE_CONTROL_TUTORIAL_STEP);
                } else if (isShopMachineControlTutorialStep) {
                  dismissTutorial();
                } else if (isFinal && autoDeployTutorialPending) {
                  setTutorialStep(null);
                } else {
                  setTutorialStep(tutorialStep + 1);
                }
              };

              const hlType: Record<number, string> = {
                0: 'spotlight',
                [TURRET_DIRECT_PLUG_TUTORIAL_STEP]: 'worldPort',
                [GENERATOR_DIRECT_PLUG_TUTORIAL_STEP]: 'worldPort',
                [SHOP_TUTORIAL_STEP]: 'bigArrowRight',
                [SHOP_MACHINE_CONTROL_TUTORIAL_STEP]: 'worldMachineTap',
              };
              const ht = hlType[tutorialStep] ?? '';

              let posClass: string;
              if (isPickChoiceTutorialStep) {
                posClass = 'items-start justify-center pt-20 sm:pt-24';
              } else if (isNextWaveTutorialStep) {
                posClass = 'items-end justify-center pb-28 sm:pb-32';
              } else if (isShopTutorialStep) {
                posClass = 'items-start justify-start pl-6 pt-20 sm:pl-10 sm:pt-24';
              } else if (isShopMachineControlTutorialStep) {
                posClass = 'items-end justify-center pb-8 sm:pb-10';
              } else if (isInteractive) {
                posClass = isDirectPlugStep
                  ? 'items-end justify-center pb-6 sm:pb-8 lg:pb-10'
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
              const portIsUsed = (portId: string) =>
                gameState.wires.some(wire => wire.startPortId === portId || wire.endPortId === portId);
              const getConnectablePorts = (
                tower: GameState['towers'][number],
                portType: 'input' | 'output',
              ) => tower.ports.filter(port =>
                port.portType === portType &&
                !portIsUsed(port.id) &&
                isPortAccessible(gameState, tower, port),
              );
              const nearestConnectablePortPair = (
                source: GameState['towers'][number],
                target: GameState['towers'][number],
                sourcePortType: 'input' | 'output',
                targetPortType: 'input' | 'output',
                requireWirePath = false,
              ) => {
                const sourcePorts = getConnectablePorts(source, sourcePortType);
                const targetPorts = getConnectablePorts(target, targetPortType);
                let best: {
                  sourcePos: { x: number; y: number };
                  targetPos: { x: number; y: number };
                  distance: number;
                } | null = null;

                for (const sourcePort of sourcePorts) {
                  const sourcePos = getPortPos(source, sourcePort);
                  for (const targetPort of targetPorts) {
                    if (sourcePort.portType === targetPort.portType) continue;
                    if (requireWirePath && !findWirePath(getPortCell(source, sourcePort), getPortCell(target, targetPort), gameState)) continue;
                    const targetPos = getPortPos(target, targetPort);
                    const distance = Math.hypot(sourcePos.x - targetPos.x, sourcePos.y - targetPos.y);
                    if (!best || distance < best.distance) {
                      best = { sourcePos, targetPos, distance };
                    }
                  }
                }

                return best;
              };
              const directPlugCueCompleted =
                tutorialStep === TURRET_DIRECT_PLUG_TUTORIAL_STEP
                  ? hasDirectPlugBetween(gameState, CORE_TOWER_TYPES, TURRET_TOWER_TYPES)
                  : tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP
                    ? hasDirectPlugBetween(gameState, GENERATOR_TOWER_TYPES, TURRET_TOWER_TYPES)
                    : false;
              const wireDragCueCompleted =
                isPostWaveWireStep &&
                hasWireBetween(gameState, GENERATOR_TOWER_TYPES, TURRET_TOWER_TYPES, true);
              const directPlugCue = isDirectPlugStep && !directPlugCueCompleted && core && turret
                ? (() => {
                    if (tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP && !generator) return null;
                    const source = tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP ? generator! : turret;
                    const target = tutorialStep === GENERATOR_DIRECT_PLUG_TUTORIAL_STEP ? turret : core;
                    const targetPortType = target.type === 'core' || target.type === 'generator' || target.type === 'big_generator'
                      ? 'output'
                      : 'input';
                    const sourcePortType = source.type === 'core' || source.type === 'generator' || source.type === 'big_generator'
                      ? 'output'
                      : 'input';
                    const portPair = nearestConnectablePortPair(source, target, sourcePortType, targetPortType);
                    if (!portPair) return null;
                    const sourcePortWorld = portPair.sourcePos;
                    const targetPortWorld = portPair.targetPos;
                    const start = toScreen(sourcePortWorld.x, sourcePortWorld.y);
                    const end = toScreen(targetPortWorld.x, targetPortWorld.y);
                    const minX = Math.min(start.x, end.x);
                    const minY = Math.min(start.y, end.y);
                    const width = Math.max(24, Math.abs(start.x - end.x));
                    const height = Math.max(24, Math.abs(start.y - end.y));
                    const pad = 44;
                    return {
                      start,
                      end,
                      hand: towerCenter(source),
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
              const wireDragCue = isPostWaveWireStep && !wireDragCueCompleted && turret
                ? (() => {
                    const generators = gameState.towers.filter(tw => GENERATOR_TOWER_TYPES.has(tw.type));
                    const source = generators.find(candidate =>
                      !gameState.wires.some(wire =>
                        wire.direct &&
                        ((wire.startTowerId === candidate.id && wire.endTowerId === turret.id) ||
                          (wire.endTowerId === candidate.id && wire.startTowerId === turret.id)),
                      ),
                    ) ?? generator;
                    if (!source) return null;

                    const portPair = nearestConnectablePortPair(source, turret, 'output', 'input', true);
                    if (!portPair) return null;
                    const sourcePortWorld = portPair.sourcePos;
                    const targetPortWorld = portPair.targetPos;
                    const start = toScreen(sourcePortWorld.x, sourcePortWorld.y);
                    const end = toScreen(targetPortWorld.x, targetPortWorld.y);
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
                ? postWaveStepIndex + 1
                : isShopTutorialStep
                  ? 1
                : isShopMachineControlTutorialStep
                  ? 2
                : tutorialStep + 1;
              const displayStepTotal = isPostWaveTutorialStep
                ? i.postWaveTutorialSteps.length
                : isShopPostTutorialStep
                  ? 2
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
                    const { hand, pathBox, line } = directPlugCue;
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
                          className="absolute pointer-events-none"
                          style={{ left: `${hand.x}px`, top: `${hand.y}px`, transform: 'translate(-50%, -50%)' }}
                        >
                          <TutorialHandCue />
                        </div>
                      </>
                    );
                  })()}

                  {/* World-position wire drag cue */}
                  {wireDragCue && (() => {
                    const { start, end, pathBox, line } = wireDragCue;
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
                          className="tutorial-hand-drag-cue absolute pointer-events-none"
                          style={{
                            left: `${start.x}px`,
                            top: `${start.y}px`,
                            '--drag-x': `${end.x - start.x}px`,
                            '--drag-y': `${end.y - start.y}px`,
                          } as CSSProperties}
                        >
                          <TutorialHandCue />
                        </div>
                      </>
                    );
                  })()}

                  {/* Arrow to Start Next Wave button */}
                  {isNextWaveTutorialStep && canStartNextWave && (
                    <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center animate-bounce pointer-events-none sm:bottom-20">
                      <div className="w-[4px] h-8 bg-gradient-to-b from-cyan-300 to-blue-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.45)]" />
                      <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[15px] border-l-transparent border-r-transparent border-t-blue-400" />
                    </div>
                  )}

                  {/* World-position tap cue for machine controls */}
                  {isShopMachineControlTutorialStep && turret && (() => {
                    const center = towerCenter(turret);
                    return (
                      <div
                        className="absolute pointer-events-none"
                        style={{ left: `${center.x}px`, top: `${center.y}px`, transform: 'translate(-50%, -50%)' }}
                      >
                        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300/50 animate-pulse" />
                        <TutorialHandCue />
                      </div>
                    );
                  })()}

                  {/* Tutorial card */}
                  <div className="relative pointer-events-auto bg-gray-900/95 border border-cyan-500/40 rounded-xl p-3 sm:p-3.5 lg:p-4 shadow-[0_0_22px_rgba(6,182,212,0.18)] max-w-sm sm:max-w-md lg:max-w-md w-full mx-2 sm:mx-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-cyan-400/70 text-xs font-mono">{displayStepNumber} / {displayStepTotal}</span>
                      <button onClick={dismissTutorial} className="text-gray-500 hover:text-gray-300 text-xs transition-colors">{i.tutorialSkip}</button>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{step.title}</h3>
                    <p className="text-gray-300 text-xs leading-relaxed mb-2.5">{step.text}</p>
                    {actionText && (
                      <div className="text-cyan-300/80 text-xs font-medium animate-pulse mb-2 flex items-center gap-1.5">
                        <TutorialHandCue className="h-6 w-6" />
                        <span>{actionText}</span>
                      </div>
                    )}
                    {!isInteractive && (
                      <button
                        onClick={advanceTutorial}
                        className="w-full px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors text-xs sm:text-sm"
                      >
                        {isFinal || isPostWaveWireStep || isShopMachineControlTutorialStep ? i.tutorialDone : i.tutorialNext}
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
            shopTutorialActive={tutorialStep === SHOP_TUTORIAL_STEP}
            interactionLocked={tutorialInputLocked}
          />
        )}

        {canStartNextWave && (
          <button
            type="button"
            onClick={handleNextWaveClick}
            disabled={tutorialInputLocked}
            className={`next-wave-button absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-400/70 bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition-colors hover:bg-blue-500 active:scale-95 disabled:cursor-wait disabled:opacity-60 sm:px-6 sm:text-base ${nextWavePromptActive ? 'next-wave-breathe' : ''}`}
          >
            <Play size={18} />
            <span>{i.startNextWave}</span>
          </button>
        )}
      </div>

      {/* Machine codex modal */}
      {codexTower && (
        <CodexModal entry={codexTower} labels={i} onClose={() => setCodexTower(null)} />
      )}
    </div>
  );
}
