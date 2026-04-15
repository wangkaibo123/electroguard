import { BASE_UPGRADE_CONFIG, COMMAND_CARD_CONFIG, TOWER_CONFIG, WEAPON_CONFIG } from '../config';
import { PickOption, TOWER_STATS, TowerType } from '../types';

export const getPickColor = (opt: PickOption) => {
  if (opt.kind === 'wire') return '#60a5fa';
  if (opt.kind === 'command_card' && opt.commandCardType) return COMMAND_CARD_CONFIG[opt.commandCardType].color;
  if (opt.kind === 'base_upgrade' && opt.baseUpgradeType) return BASE_UPGRADE_CONFIG[opt.baseUpgradeType].color;
  return TOWER_STATS[opt.towerType!]?.color ?? '#6b7280';
};

export const getTowerPickStats = (towerType: TowerType) => {
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
    else if (cfg.maxPower > 0) pow = cfg.maxPower;
  }

  const formatPow = (v: number | null) => {
    if (v == null) return '-';
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
