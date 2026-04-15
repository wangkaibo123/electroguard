import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { Cable, Eye, EyeOff } from 'lucide-react';
import { GLOBAL_CONFIG } from '../config';
import type { GameState, TowerType } from '../types';
import type { I18nStrings } from '../i18n';
import { BaseUpgradeIcon, CommandCardIcon, TowerIcon } from './icons';
import { getPickColor, getTowerPickStats } from './pickStats';

type PickOverlayProps = {
  gameState: GameState;
  labels: I18nStrings;
  hidden: boolean;
  setHidden: Dispatch<SetStateAction<boolean>>;
  onPick: (id: string, origin?: { x: number; y: number }) => void;
  setCodexTower: (tower: TowerType) => void;
};

export const PickOverlay = ({
  gameState,
  labels: i,
  hidden,
  setHidden,
  onPick,
  setCodexTower,
}: PickOverlayProps) => (
  <div className={`absolute inset-0 ${hidden ? 'pointer-events-none' : ''}`}>
    <div className="absolute left-1/2 bottom-14 -translate-x-1/2 z-20 pointer-events-auto">
      <button
        type="button"
        onClick={() => setHidden(v => !v)}
        className="flex items-center gap-2.5 px-5 py-3.5 rounded-xl border border-gray-700 bg-gray-950/88 backdrop-blur-sm text-gray-100 hover:bg-gray-900 transition-colors text-sm font-bold shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        title={hidden ? i.showPanel : i.hidePanel}
      >
        {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
        <span>{hidden ? '显示三选一' : '查看战场'}</span>
      </button>
    </div>
    {!hidden && (
      <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 text-center overflow-y-auto">
        {gameState.pickUiPhase === 'shop_base_upgrade' ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-black mb-1 text-sky-300 tracking-tight">{i.baseUpgradePickTitle}</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md leading-relaxed px-2">{i.baseUpgradePickDescription}</p>
          </>
        ) : gameState.pickUiPhase === 'shop_command' ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-black mb-1 text-cyan-300 tracking-tight">{i.commandCardPickTitle}</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md leading-relaxed px-2">{i.commandCardPickDescription}</p>
          </>
        ) : gameState.pickUiPhase === 'shop_tower' || gameState.pickUiPhase === 'shop_infra' ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-black mb-1 text-yellow-400 tracking-tight">{i.shopPickTitle}</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 max-w-md leading-relaxed px-2">{i.shopPickDescription}</p>
          </>
        ) : gameState.pickUiPhase === 'boss_bonus' ? (
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
                  return (
                    <div className="w-full rounded-lg px-3 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-mono border" style={{ borderColor: color + '44', backgroundColor: color + '11', color }}>
                      <span title={i.statHp}>{i.statHp} {stats.hp}</span>
                      <span title={i.statRange}>{i.statRange} {stats.range != null ? stats.range : '-'}</span>
                      <span title={i.statAtk}>{i.statAtk} {stats.atk != null ? stats.atk : '-'}</span>
                      <span title={i.statPow}>{i.statPow} {stats.powLabel}</span>
                    </div>
                  );
                })()}
                <button
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onPick(opt.id, {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                    });
                  }}
                  className="group w-full p-4 sm:p-5 rounded-xl border-2 border-gray-700 bg-gray-900/95 hover:bg-gray-800/95 transition-all flex flex-row sm:flex-col items-center text-center gap-3 hover:scale-105 hover:shadow-lg active:scale-95"
                  style={{ '--pick-color': color } as CSSProperties}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                >
                  <div
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: color + '22', color }}
                  >
                    {opt.kind === 'wire'
                      ? <Cable size={20} />
                      : opt.kind === 'command_card' && opt.commandCardType
                        ? <CommandCardIcon type={opt.commandCardType} size={20} />
                        : opt.kind === 'base_upgrade' && opt.baseUpgradeType
                          ? <BaseUpgradeIcon type={opt.baseUpgradeType} size={20} />
                          : <TowerIcon type={opt.towerType!} size={20} />}
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
  </div>
);
