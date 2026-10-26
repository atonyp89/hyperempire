# Backup: the world before the Mine

These are the world layers as they were before the Mine: the yard of crates below the Exchange and the Workshop at its first height. The Mine now sits at the bottom right of the east strip, and the Workshop moved up 30 px.

| File | Restores |
| --- | --- |
| `world-480-1x.png` | `design/scene/world-480-1x.png` |
| `town-base.png`, `town.png`, `walkable.png`, `night-lights.png` | the same files in `src/web/public/empire/` |

To roll back, copy them over and remove the `mine` entry from `BUILDINGS` in `src/web/src/game/scene/EmpireScene.tsx` and its two glows in `TimeOfDay.tsx`. Then set the Workshop back: its box `fromCrop(383, 40, 63, 73)`, and its glows at y 104 and 81.

```bash
cp design/scene/backup-before-mine/world-480-1x.png design/scene/
cp design/scene/backup-before-mine/{town-base,town,walkable,night-lights}.png src/web/public/empire/
```
