import type { ComponentType } from 'react';
import { Battery, Bot, Crosshair, Flame, Focus, GitMerge, Hexagon, Plus, Power, Radio, Rocket, Shield, Zap } from 'lucide-react';
import type { BaseUpgradeType, CommandCardType } from '../types';

type IconProps = { size: number };

export const TowerIcon = ({ type, size = 22 }: { type: string; size?: number }) => {
  const icons: Record<string, ComponentType<IconProps>> = {
    blaster: Crosshair,
    gatling: Flame,
    sniper: Focus,
    tesla: Radio,
    generator: Zap,
    shield: Hexagon,
    battery: Battery,
    bus: GitMerge,
    missile: Rocket,
    big_generator: Zap,
    repair_drone: Bot,
  };
  const Icon = icons[type];
  return Icon ? <Icon size={size} /> : null;
};

export const CommandCardIcon = ({ type, size = 22 }: { type: CommandCardType; size?: number }) => {
  const icons: Record<CommandCardType, ComponentType<IconProps>> = {
    add_input: Plus,
    add_output: Plus,
    self_power: Power,
    range_boost: Focus,
  };
  const Icon = icons[type];
  return <Icon size={size} />;
};

export const BaseUpgradeIcon = ({ type, size = 22 }: { type: BaseUpgradeType; size?: number }) => {
  const icons: Record<BaseUpgradeType, ComponentType<IconProps>> = {
    core_power_boost: Zap,
    core_turret_unlock: Crosshair,
    core_shield_unlock: Shield,
  };
  const Icon = icons[type];
  return <Icon size={size} />;
};
