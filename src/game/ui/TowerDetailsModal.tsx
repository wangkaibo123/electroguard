import { X } from 'lucide-react';
import { getLocale } from '../i18n';
import { TOWER_STATS, TowerType, getTowerRange } from '../types';
import { WEAPON_CONFIG } from '../config';
import { TowerIcon } from './icons';

type TowerDetailsModalProps = {
  type: TowerType;
  labels: {
    towerName: Partial<Record<TowerType, string>>;
  };
  onClose: () => void;
};

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;

const getWeaponRows = (type: TowerType, zh: boolean): Array<[string, string]> => {
  const label = {
    damage: zh ? '伤害' : 'Damage',
    cooldown: zh ? '冷却' : 'Cooldown',
    powerCost: zh ? '耗电' : 'Power cost',
    bulletSpeed: zh ? '弹速' : 'Projectile speed',
    splashRadius: zh ? '爆炸半径' : 'Splash radius',
    bounceRange: zh ? '弹跳范围' : 'Bounce range',
    repair: zh ? '维修量' : 'Repair',
    attack: zh ? '无人机攻击' : 'Drone attack',
    shots: zh ? '最大射速' : 'Max fire rate',
    bullets: zh ? '每格电弹数' : 'Bullets per power',
  };

  if (type === 'blaster') {
    const weapon = WEAPON_CONFIG.blaster;
    return [
      [label.damage, String(weapon.damage)],
      [label.cooldown, formatSeconds(weapon.cooldown)],
      [label.powerCost, String(weapon.powerCost)],
      [label.bulletSpeed, `${weapon.bulletSpeed}px/s`],
    ];
  }
  if (type === 'gatling') {
    const weapon = WEAPON_CONFIG.gatling;
    return [
      [label.damage, String(weapon.damage)],
      [label.shots, `${weapon.shotsPerSecond}/s`],
      [label.bullets, String(weapon.bulletsPerPower)],
      [label.bulletSpeed, `${weapon.bulletSpeed}px/s`],
    ];
  }
  if (type === 'sniper') {
    const weapon = WEAPON_CONFIG.sniper;
    return [
      [label.damage, String(weapon.damage)],
      [label.cooldown, formatSeconds(weapon.cooldown)],
      [label.powerCost, String(weapon.powerCost)],
      [label.bulletSpeed, `${weapon.bulletSpeed}px/s`],
    ];
  }
  if (type === 'tesla') {
    const weapon = WEAPON_CONFIG.tesla;
    return [
      [label.damage, `${weapon.damagePerPower}/${zh ? '电' : 'power'}`],
      [label.cooldown, formatSeconds(weapon.cooldown)],
      [label.bounceRange, `${weapon.bounceRange}px`],
    ];
  }
  if (type === 'missile') {
    const weapon = WEAPON_CONFIG.missile;
    return [
      [label.damage, String(weapon.damage)],
      [label.cooldown, formatSeconds(weapon.cooldown)],
      [label.powerCost, String(weapon.powerCost)],
      [label.splashRadius, `${weapon.splashRadius}px`],
    ];
  }
  if (type === 'repair_drone') {
    const weapon = WEAPON_CONFIG.repairDrone;
    return [
      [label.repair, `${weapon.repairAmount} / ${formatSeconds(weapon.repairCooldown)}`],
      [label.powerCost, String(weapon.repairCost)],
      [label.attack, `${weapon.attackDamage} / ${formatSeconds(weapon.attackCooldown)}`],
    ];
  }
  return [];
};

export const TowerDetailsModal = ({ type, labels, onClose }: TowerDetailsModalProps) => {
  const zh = getLocale() === 'zh';
  const stats = TOWER_STATS[type];
  const range = getTowerRange(type);
  const title = labels.towerName[type] ?? type;
  const rows: Array<[string, string]> = [
    [zh ? '生命值' : 'HP', String(stats.hp)],
    [zh ? '占地' : 'Footprint', `${stats.width}x${stats.height}`],
    [zh ? '储电上限' : 'Power storage', String(stats.maxPower)],
    ...(range ? [[zh ? '射程' : 'Range', `${range}px`] as [string, string]] : []),
    ...(stats.maxShieldHp > 0 ? [[zh ? '护盾值' : 'Shield HP', String(stats.maxShieldHp)] as [string, string]] : []),
    ...(stats.shieldRadius > 0 ? [[zh ? '护盾半径' : 'Shield radius', `${stats.shieldRadius}px`] as [string, string]] : []),
    ...getWeaponRows(type, zh),
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-gray-700 bg-gray-900/98 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tower-details-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-5 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg border border-gray-700 bg-gray-800/80 p-2 text-gray-300">
              <TowerIcon type={type} size={26} />
            </div>
            <h2 id="tower-details-title" className="truncate text-lg font-bold leading-tight text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label={zh ? '关闭' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>
        <div className="divide-y divide-gray-800">
          {rows.map(([name, value]) => (
            <div key={name} className="flex items-center justify-between gap-4 bg-gray-900 px-5 py-3">
              <span className="text-xs font-bold uppercase text-gray-500">{name}</span>
              <span className="shrink-0 font-mono text-sm font-bold text-gray-100">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
