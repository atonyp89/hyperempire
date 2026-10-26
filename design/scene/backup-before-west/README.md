# Backup: the world before the west strip

These are the 480×180 world layers from before the world grew 160 px west for the bigger Garden.

To roll back:

1. **Copy the files back:** `world-480-1x.png` into `design/scene/`, and the others into `src/web/public/empire/`.
2. **Restore the code:** take `src/web/src/game` and `design/scene/walkable.py` from git as of commit `db1b9c5`. Every x coordinate there is 160 lower, and `WORLD_W` is 480.
