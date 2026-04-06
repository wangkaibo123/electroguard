# ElectroGuard — AI Agent Project Brief

> For AI agents developing or maintaining this project.
> Last updated: 2026-04-06

## 1. Project Overview

Browser-based **roguelike tower defense** — players place electrical machines on a grid, wire them into a power network, and defend a central Core against enemy waves. After each wave, pick 1 of 3 random upgrades. No currency economy; growth comes entirely from picks.

**Stack:** React 19 · TypeScript · Canvas 2D · Tailwind CSS v4 · Vite 6 · lucide-react (icons)

## 2. File Structure

```
src/
├── main.tsx              # Entry point (StrictMode → <App />)
├── App.tsx               # UI: stats bar, canvas, sidebar inventory, overlays
├── index.css             # Tailwind CSS import
└── game/
    ├── config.ts         # ★ All game balance parameters (9 config tables, Chinese comments)
    ├── types.ts          # Type definitions + re-exported constants from config
    ├── engine.ts         # Pure logic: pathfinding, power grid, spawning, picks
    ├── renderer.ts       # Stateless Canvas 2D rendering
    ├── useGameLoop.ts    # React hook: game loop, state mutation, input handling
    └── i18n.ts           # EN/ZH localization
```

## 3. Architecture

```
User Input → useGameLoop (mutates stateRef)
               ├── engine.ts (logic)
               ├── sync() → React re-render (UI only)
               └── renderGame() each frame (Canvas)
```

- **GameState is mutated directly** via `stateRef`, not immutable React updates.
- `**towerMap`** (Map) maintained for O(1) lookups — call `rebuildTowerMap()` after tower add/remove.
- **Rendering is stateless** — `renderGame()` reads state and draws from scratch each frame.

## 4. Config System (`config.ts`)

All game balance values are centralized in `src/game/config.ts` with Chinese comments. Tables:


| Export               | Content                                           |
| -------------------- | ------------------------------------------------- |
| `GLOBAL_CONFIG`      | Map size, wave timing, power, zoom, port count    |
| `TOWER_CONFIG`       | HP, size, maxPower, shield for all 10 tower types |
| `WEAPON_CONFIG`      | Cooldown, range, damage, speed for 4 weapon types |
| `ENEMY_CONFIG`       | Base stats for 5 enemy types + unlock waves       |
| `ENEMY_SCALING`      | Per-wave HP/speed/damage scaling coefficients     |
| `SHIELD_CONFIG`      | Shield recharge costs and amounts                 |
| `SCORE_CONFIG`       | Kill scores per enemy type                        |
| `STARTING_INVENTORY` | Initial wires and towers                          |
| `PICK_POOL_CONFIG`   | Roguelike reward pool + pick count                |
| `ENEMY_AI_CONFIG`    | Saboteur targeting weight multipliers             |


`types.ts` re-exports derived constants (`GRID_WIDTH`, `CELL_SIZE`, `TOWER_STATS`, etc.) from config for backward compatibility.

## 5. Tower Types


| Type      | Size | Ports           | Key Behavior                                |
| --------- | ---- | --------------- | ------------------------------------------- |
| Core      | 5×5  | 4 output        | Central hub. Generates power. Has shield.   |
| Blaster   | 3×3  | 2 random input  | Homing bullets. 2 power per shot.           |
| Gatling   | 3×3  | 2 random input  | Heat-based rapid fire, spreads with heat.   |
| Sniper    | 3×3  | 2 random input  | High-damage piercing shot, long cooldown.   |
| Tesla     | 3×3  | 2 random input  | Chain lightning bouncing between enemies.   |
| Generator | 3×3  | 2 random output | Power source for the network.               |
| Shield    | 1×1  | 1 random input  | Projects protective bubble, consumes power. |
| Battery   | 3×2  | 1 in + 1 out    | Stores power, discharges rapidly.           |
| Bus       | 3×2  | 3 in + 3 out    | Merges/splits wire connections.             |
| Target    | 1×1  | none            | Practice target (custom mode only).         |


## 6. Enemy Types


| Type     | Unlock | Traits                                |
| -------- | ------ | ------------------------------------- |
| Scout    | Wave 1 | Fast, fragile                         |
| Grunt    | Wave 1 | Balanced stats                        |
| Tank     | Wave 3 | High HP/damage, slow                  |
| Saboteur | Wave 5 | Prioritizes wires, 2× wire damage     |
| Overlord | Boss   | Every N waves, has shield, high stats |


Stats scale per wave via `ENEMY_SCALING` coefficients. Spawn count: `floor(base + wave×linear + √wave×sqrt)`.

## 7. Roguelike Pick Flow

1. Game start → Core placed, initial inventory (1 Blaster + 1 Generator + 5 Wires) → first pick
2. Player picks 1 of 3 → items added to inventory → countdown → wave spawns
3. Wave cleared → score bonus → pick overlay → repeat

## 8. Key Engine Functions


| Function                 | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `findWirePath()`         | A* pathfinding on grid between ports                 |
| `updatePowerGrid()`      | BFS marking towers reachable from power sources      |
| `dispatchPulse()`        | BFS finding nearest tower needing power, sends pulse |
| `applyTowerRotation()`   | 90° rotation with collision check, re-paths wires    |
| `canPlace()`             | Validates placement (bounds, collision, inventory)   |
| `generatePickOptions()`  | Returns N random options from pick pool              |
| `generatePorts(type, n)` | Creates n random-direction ports                     |
| `rebuildTowerMap()`      | Rebuilds towerMap after tower add/remove             |


## 9. Common Pitfalls

- After modifying `state.towers` → call `rebuildTowerMap(state)`.
- After modifying `state.wires` → call `updatePowerGrid(state)`.
- `tower.rotation` is visual-only for knob animation; resets to 0 after applying.
- `needsPick` flag drives the pick/wave cycle.
- Game balance values live **only** in `config.ts` — don't hardcode numbers elsewhere.

## 10. Scripts

```bash
npm run dev      # Dev server on port 3000
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # TypeScript type-check (tsc --noEmit)
```

