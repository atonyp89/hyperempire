# Backup: the world before the Mine

These are the world layers as they were before the Mine replaced the yard of crates and logs below the Exchange (world x 244–304, y 119–162).

| File | Restores |
| --- | --- |
| `world-480-1x.png` | `design/scene/world-480-1x.png` |
| `town-base.png`, `town.png`, `walkable.png`, `night-lights.png` | the same files in `src/web/public/empire/` |

To roll back, copy them over and remove the `mine` entry from `BUILDINGS` in `src/web/src/game/scene/EmpireScene.tsx` and its two glows in `TimeOfDay.tsx`:

```bash
cp design/scene/backup-before-mine/world-480-1x.png design/scene/
cp design/scene/backup-before-mine/{town-base,town,walkable,night-lights}.png src/web/public/empire/
```
