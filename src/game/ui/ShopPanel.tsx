import { useState, type ComponentType, type Dispatch, type SetStateAction } from 'react';
import { Activity, BookOpen, Cable, ChevronLeft, ChevronRight, Coins, Menu, Play, RotateCcw, ShoppingBag, Wrench, X, Crosshair, Zap, Rocket } from 'lucide-react';
import { SHOP_CONFIG, SHOP_ITEM_CONFIG } from '../config';
import type { I18nStrings } from '../i18n';
import type { CommandCardType, EnemyType, GameState, ShopItemType, ShopPackType, TowerType } from '../types';
import { TOWER_STATS } from '../types';
import { CommandCardIcon, TowerIcon } from './icons';

const BUILD_TOWERS: TowerType[] = [
  'blaster',
  'gatling',
  'sniper',
  'tesla',
  'generator',
  'shield',
  'battery',
  'bus',
  'missile',
  'big_generator',
  'repair_drone',
];

const ENEMY_TYPES: EnemyType[] = ['scout', 'grunt', 'tank', 'saboteur', 'overlord'];

type ShopPanelProps = {
  gameState: GameState;
  labels: I18nStrings;
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  shopPanelHiddenForWave: boolean;
  shopPanelVisible: boolean;
  selectedTower: TowerType | null;
  setSelectedTower: (tower: TowerType | null) => void;
  placeMonsterMode: boolean;
  setPlaceMonsterMode: (enabled: boolean) => void;
  selectedMonsterType: EnemyType;
  setSelectedMonsterType: (type: EnemyType) => void;
  staticMonster: boolean;
  setStaticMonster: (enabled: boolean) => void;
  monsterSubTab: 'type' | 'static';
  setMonsterSubTab: Dispatch<SetStateAction<'type' | 'static'>>;
  openCustomPick: () => void;
  buyShopPack: (type: ShopItemType) => void;
  refreshShopOffers: () => void;
  activeCommandCard: CommandCardType | null;
  activeRepair: boolean;
  startRepair: () => void;
  tutorialStep: number | null;
  shopTutorialActive?: boolean;
  interactionLocked?: boolean;
};

export const ShopPanel = (props: ShopPanelProps) => {
  const {
    gameState,
    labels: i,
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    shopPanelHiddenForWave,
    shopPanelVisible,
    selectedTower,
    setSelectedTower,
    placeMonsterMode,
    setPlaceMonsterMode,
    selectedMonsterType,
    setSelectedMonsterType,
    staticMonster,
    setStaticMonster,
    monsterSubTab,
    setMonsterSubTab,
    openCustomPick,
    buyShopPack,
    refreshShopOffers,
    activeCommandCard,
    activeRepair,
    startRepair,
    tutorialStep,
    shopTutorialActive = false,
    interactionLocked = false,
  } = props;
  const [refreshAnimationId, setRefreshAnimationId] = useState(0);

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
            if (interactionLocked) return;
            setPlaceMonsterMode(false);
            setSelectedTower(isSelected ? null : type);
          }}
          disabled={interactionLocked || !hasStock || gameState.status !== 'playing'}
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

    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            if (interactionLocked) return;
            setSelectedTower(null);
            setPlaceMonsterMode(!isActive);
          }}
          disabled={interactionLocked || gameState.status !== 'playing'}
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

        {isActive && (
          <div className="flex flex-col gap-2 px-1">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMonsterSubTab('type')}
                disabled={interactionLocked}
                className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all border ${
                  monsterSubTab === 'type'
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                    : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {i.monsterType}
              </button>
              <button
                type="button"
                onClick={() => setMonsterSubTab('static')}
                disabled={interactionLocked}
                className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all border ${
                  monsterSubTab === 'static'
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                    : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {i.staticMonster}
              </button>
            </div>

            {monsterSubTab === 'type' && (
              <div className="grid grid-cols-2 gap-1.5">
                {ENEMY_TYPES.map((type) => {
                  const isSelected = selectedMonsterType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        if (interactionLocked) return;
                        setSelectedTower(null);
                        setSelectedMonsterType(type);
                        setPlaceMonsterMode(true);
                      }}
                      disabled={interactionLocked || gameState.status !== 'playing'}
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
            )}

            {monsterSubTab === 'static' && (
              <label className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                gameState.status === 'playing'
                  ? 'border-gray-700 bg-gray-900/50 text-gray-200'
                  : 'border-gray-800 bg-gray-900/40 text-gray-500 opacity-40'
              }`}>
                <input
                  type="checkbox"
                  checked={staticMonster}
                  onChange={(e) => setStaticMonster(e.target.checked)}
                  disabled={interactionLocked || gameState.status !== 'playing'}
                  className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500"
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight">{i.staticMonster}</div>
                  <div className="text-xs text-gray-400 leading-relaxed">{i.staticMonsterHint}</div>
                </div>
              </label>
            )}
          </div>
        )}
      </div>
    );
  };

  const shopPackUi: Record<ShopPackType, {
    label: string;
    description: string;
    price: number;
    Icon: ComponentType<{ size: number }>;
    colorClass: string;
    enabledClass: string;
    iconClass: string;
  }> = {
    tower: {
      label: i.towerPack,
      description: i.towerPackDesc,
      price: SHOP_ITEM_CONFIG.tower.price,
      Icon: Crosshair,
      colorClass: 'text-yellow-400',
      enabledClass: 'border-yellow-700/70 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/15 hover:border-yellow-500/70',
      iconClass: 'text-yellow-400',
    },
    infra: {
      label: i.infraPack,
      description: i.infraPackDesc,
      price: SHOP_ITEM_CONFIG.infra.price,
      Icon: Zap,
      colorClass: 'text-yellow-400',
      enabledClass: 'border-yellow-700/70 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/15 hover:border-yellow-500/70',
      iconClass: 'text-yellow-400',
    },
    advanced: {
      label: i.advancedPack,
      description: i.advancedPackDesc,
      price: SHOP_ITEM_CONFIG.advanced.price,
      Icon: Rocket,
      colorClass: 'text-yellow-400',
      enabledClass: 'border-rose-700/70 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 hover:border-rose-500/70',
      iconClass: 'text-rose-400',
    },
    command: {
      label: i.commandCardPack,
      description: i.commandCardPackDesc,
      price: SHOP_ITEM_CONFIG.command.price,
      Icon: BookOpen,
      colorClass: 'text-yellow-400',
      enabledClass: 'border-cyan-700/70 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15 hover:border-cyan-500/70',
      iconClass: 'text-cyan-300',
    },
    base_upgrade: {
      label: i.baseUpgradePack,
      description: i.baseUpgradePackDesc,
      price: SHOP_ITEM_CONFIG.base_upgrade.price,
      Icon: Wrench,
      colorClass: 'text-yellow-400',
      enabledClass: 'border-sky-700/70 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15 hover:border-sky-500/70',
      iconClass: 'text-sky-300',
    },
  };

  const renderShopButtons = (closeSidebar = false, topMargin = true) => {
    const handleBuy = (type: ShopItemType) => {
      if (interactionLocked) return;
      buyShopPack(type);
      if (closeSidebar) setSidebarOpen(false);
    };
    const handleRefresh = () => {
      if (interactionLocked) return;
      setRefreshAnimationId(id => id + 1);
      refreshShopOffers();
    };
    const isCustom = gameState.gameMode === 'custom';
    const canBuy = (price: number) => !interactionLocked && gameState.status === 'playing' && (isCustom || gameState.gold >= price);
    const offers = gameState.shopOffers.length > 0 ? gameState.shopOffers : (['tower', 'infra', 'command'] as ShopItemType[]);
    const refreshCost = gameState.shopRefreshCost ?? SHOP_CONFIG.initialRefreshCost;
    const canRefresh = !interactionLocked && gameState.status === 'playing' && (isCustom || gameState.gold >= refreshCost);
    const repairCost = SHOP_CONFIG.repairCost;
    const hasRepairTarget = gameState.towers.some(tower =>
      tower.type !== 'core' && (tower.isRuined || tower.hp < tower.maxHp),
    );
    const canRepair = !interactionLocked && gameState.status === 'playing' && hasRepairTarget && (isCustom || gameState.gold >= repairCost);
    const getShopItemUi = (offer: ShopItemType) => {
      const item = SHOP_ITEM_CONFIG[offer];
      if (item.kind === 'machine') {
        const towerType = item.towerType!;
        return {
          label: i.towerName[towerType] ?? item.name,
          description: i.towerDesc[towerType] ?? TOWER_STATS[towerType].description,
          price: item.price,
          icon: <TowerIcon type={towerType} size={20} />,
          colorClass: 'text-yellow-400',
          enabledClass: 'border-gray-700 bg-gray-800/80 text-gray-200 hover:bg-gray-700 hover:border-gray-500',
          iconClass: 'text-gray-400',
        };
      }
      if (item.kind === 'command_card') {
        const commandCardType = item.commandCardType!;
        return {
          label: i.commandCardName[commandCardType] ?? item.name,
          description: i.commandCardDesc[commandCardType] ?? '',
          price: item.price,
          icon: <CommandCardIcon type={commandCardType} size={20} />,
          colorClass: 'text-cyan-300',
          enabledClass: 'border-cyan-700/70 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15 hover:border-cyan-500/70',
          iconClass: 'text-cyan-300',
          commandCardType,
        };
      }
      const pack = shopPackUi[offer as ShopPackType];
      const Icon = pack.Icon;
      return {
        ...pack,
        icon: <Icon size={20} />,
      };
    };
    return (
      <>
        <div className={`text-xs font-bold uppercase tracking-widest text-gray-500 px-1 py-1.5 ${topMargin ? 'mt-2' : ''}`}>
          <div className="flex items-center gap-1.5">
            <ShoppingBag size={12} />
            {i.shop}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {offers.map((offer, index) => {
            if (!offer) {
              return (
                <div
                  key={`empty-shop-offer-${refreshAnimationId}-${index}`}
                  className={`flex h-[70px] items-center justify-center rounded-lg border border-dashed border-gray-800 bg-gray-950/40 text-gray-700 ${
                    refreshAnimationId > 0 ? 'shop-card-refresh-in' : ''
                  }`}
                  style={refreshAnimationId > 0 ? { animationDelay: `${index * 55}ms` } : undefined}
                  aria-label="Empty shop slot"
                />
              );
            }
            const item = getShopItemUi(offer);
            const activeShopCommand = item.commandCardType && activeCommandCard === item.commandCardType;
            return (
              <button
                key={`${refreshAnimationId}-${offer}-${index}`}
                type="button"
                onClick={() => handleBuy(offer)}
                disabled={!canBuy(item.price)}
                className={`flex h-[70px] items-center gap-2.5 px-3 py-3 rounded-lg border text-left transition-all ${
                  canBuy(item.price)
                    ? activeShopCommand
                      ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50 ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-gray-950'
                      : item.enabledClass
                    : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-40'
                } ${refreshAnimationId > 0 ? 'shop-card-refresh-in' : ''}`}
                style={refreshAnimationId > 0 ? { animationDelay: `${index * 55}ms` } : undefined}
              >
                <div className={`shrink-0 ${item.iconClass}`}>{item.icon}</div>
                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                  <span className="text-sm font-bold leading-tight">{item.label}</span>
                  <span className="text-xs text-gray-400 leading-tight line-clamp-2">{item.description}</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold shrink-0">
                  <Coins size={12} />{item.price}
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!canRefresh}
            className={`flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-black transition-all ${
              canRefresh
                ? 'border-emerald-700/70 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15 hover:border-emerald-500/70'
                : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-40'
            }`}
            title={i.refreshShopDesc(refreshCost)}
          >
            <RotateCcw size={16} />
            <span>{i.refreshShop}</span>
            <span className="flex items-center gap-1 text-yellow-400">
              <Coins size={12} />{refreshCost}
            </span>
          </button>
          <button
            type="button"
            onClick={startRepair}
            disabled={!canRepair}
            className={`flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-black transition-all ${
              canRepair
                ? activeRepair
                  ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50 ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-gray-950'
                  : 'border-cyan-700/70 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15 hover:border-cyan-500/70'
                : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-40'
            }`}
            title={i.repairDesc(repairCost)}
          >
            <Wrench size={16} />
            <span>{i.repair}</span>
            <span className="flex items-center gap-1 text-yellow-400">
              <Coins size={12} />{repairCost}
            </span>
          </button>
        </div>
      </>
    );
  };

  const renderPanelContent = (mobile = false) => (
    <>
      {gameState.gameMode === 'custom' && (
        <>
          {renderShopButtons(mobile, false)}
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500 px-1 py-1.5">
            {i.inventory}
          </div>
          {BUILD_TOWERS.map(renderTowerButton)}
          {renderPlaceMonsterButton()}

          <div className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-gray-800 bg-gray-900/50 w-full">
            <div className="text-blue-400 shrink-0"><Cable size={22} /></div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-bold text-gray-200 leading-tight">{i.wires}</span>
              <span className="text-xs text-blue-400 font-mono leading-tight">{'\u221E'}</span>
            </div>
          </div>
        </>
      )}

      {gameState.gameMode !== 'custom' && renderShopButtons(mobile)}

      {gameState.gameMode === 'custom' && (
        <button
          type="button"
          onClick={openCustomPick}
          disabled={interactionLocked || (gameState.status !== 'playing' && gameState.status !== 'paused')}
          className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border transition-all ${
            !interactionLocked && (gameState.status === 'playing' || gameState.status === 'paused')
              ? 'border-amber-700/70 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15 hover:border-amber-500/70'
              : 'border-gray-800 bg-gray-900/50 text-gray-500 cursor-not-allowed opacity-50'
          }`}
        >
          <div className="shrink-0"><Play size={18} /></div>
          <span className="text-sm font-bold leading-tight">{i.openPick}</span>
        </button>
      )}

      <div className={`${mobile ? 'mt-2' : 'mt-4'} text-xs text-gray-600 px-1 ${mobile ? 'py-1' : 'py-2'} leading-relaxed`}>
        {!mobile && <p>{i.clickToPlaceMonster}</p>}
        <p>{i.clickToRotate}</p>
        <p>{i.dragToWire}</p>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {(gameState.status === 'playing' || gameState.status === 'paused') && !shopPanelHiddenForWave && (
          <button
            onClick={() => setSidebarOpen(v => !v)}
            disabled={interactionLocked}
            className={`absolute top-1/2 flex h-14 w-[25px] -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-gray-700 bg-gray-800/90 text-gray-300 shadow-lg backdrop-blur-sm transition-[right,transform,background-color] hover:bg-gray-700 active:scale-95 ${
              tutorialStep === null ? 'z-50' : 'z-30'
            } ${
              sidebarOpen ? 'right-[260px]' : 'right-0'
            }`}
            title={sidebarOpen ? i.hidePanel : i.showPanel}
          >
            {sidebarOpen ? <ChevronRight size={16} /> : <Menu size={16} />}
          </button>
        )}
        {shopPanelVisible && (
          <div className="absolute inset-0 z-40 flex" onClick={() => setSidebarOpen(false)}>
            <div className="flex-1" />
            <div
              className="no-scrollbar w-[260px] bg-gray-900/95 backdrop-blur-md border-l border-gray-800 p-3 flex flex-col gap-2 overflow-y-auto animate-[slideInRight_0.2s_ease-out]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-1 py-1">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{i.inventory}</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
                  <X size={16} />
                </button>
              </div>
              {renderPanelContent(true)}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative shrink-0 flex">
      {!shopPanelHiddenForWave && (
        <button
          onClick={() => setSidebarOpen(v => !v)}
          disabled={interactionLocked}
          className="absolute -left-9 top-1/2 -translate-y-1/2 z-10 w-9 h-16 bg-gray-800 hover:bg-gray-700 border border-gray-700 border-r-0 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          title={sidebarOpen ? i.hidePanel : i.showPanel}
        >
          {sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}

      <div
        className={`no-scrollbar bg-gray-900/80 border-l border-gray-800 p-3.5 flex flex-col gap-2.5 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${
          shopPanelVisible ? 'w-[260px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-8 p-0 border-l-0'
        } ${tutorialStep === 3 || shopTutorialActive ? 'shadow-[0_0_20px_rgba(6,182,212,0.4),inset_0_0_20px_rgba(6,182,212,0.15)] border-l-cyan-500/50' : ''}`}
      >
        <div className="min-w-[236px] flex flex-col h-full">
          {renderPanelContent(false)}
        </div>
      </div>
    </div>
  );
};
