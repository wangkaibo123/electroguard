import { COMMAND_CARD_CONFIG } from './config';
import { isPortAccessible } from './engine';
import type { CommandCardType, GameState, PortDirection, Tower } from './types';
import { getTowerRange } from './types';

export const MAX_MACHINE_COMMAND_UPGRADES = 3;

const PORT_DIRECTIONS: PortDirection[] = ['top', 'right', 'bottom', 'left'];

export const isMachineCommandCard = (_cardType: CommandCardType) => true;

export const canAddMachinePort = (
  state: GameState,
  tower: Tower,
  portType: 'input' | 'output',
) => {
  if (tower.type === 'core' || tower.isRuined) return false;

  const getSideLength = (direction: PortDirection) =>
    direction === 'top' || direction === 'bottom' ? tower.width : tower.height;
  const getSideCellIndex = (direction: PortDirection, sideOffset = 0.5) =>
    Math.min(getSideLength(direction) - 1, Math.max(0, Math.floor(getSideLength(direction) * sideOffset)));
  const getCandidateCellIndexes = (sideLength: number) => {
    const center = Math.floor(sideLength / 2);
    const seen = new Set<number>();
    const ordered = [center, center - 1, center + 1, 0, sideLength - 1];
    return ordered.filter((index) => {
      if (index < 0 || index >= sideLength || seen.has(index)) return false;
      seen.add(index);
      return true;
    });
  };

  for (const phaseIndex of [0, 1, 2]) {
    for (const direction of PORT_DIRECTIONS) {
      const sideLength = getSideLength(direction);
      const candidates = getCandidateCellIndexes(sideLength);
      const phaseCandidates = phaseIndex === 0
        ? candidates.slice(0, 1)
        : phaseIndex === 1
          ? candidates.slice(1, 3)
          : candidates.slice(3);

      for (const cellIndex of phaseCandidates) {
        const hasSameSpot = tower.ports.some(port =>
          port.direction === direction &&
          getSideCellIndex(direction, port.sideOffset) === cellIndex,
        );
        if (hasSameSpot) continue;

        const sideOffset = (cellIndex + 0.5) / sideLength;
        if (isPortAccessible(state, tower, {
          id: `preview-${tower.id}-${direction}-${cellIndex}`,
          direction,
          portType,
          sideOffset,
        })) {
          return true;
        }
      }
    }
  }

  return false;
};

export const canUseCommandCardOnTower = (
  state: GameState,
  cardType: CommandCardType,
  tower: Tower,
) => {
  if (tower.type === 'core' || tower.isRuined) return false;
  if ((tower.commandUpgradeCount ?? 0) >= MAX_MACHINE_COMMAND_UPGRADES) return false;

  if (cardType === 'add_input' || cardType === 'add_output') {
    return canAddMachinePort(state, tower, cardType === 'add_input' ? 'input' : 'output');
  }

  if (cardType === 'range_boost') {
    return getTowerRange(tower) != null;
  }

  return Boolean(COMMAND_CARD_CONFIG[cardType]);
};
