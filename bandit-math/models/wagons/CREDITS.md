# Wagons: credits

- **The four wagons** (`covered.glb` from wagon2.glb, `chuck.glb` from wagon.glb, `farm.glb` from wagon3.glb,
  `freight.glb` from wagon4.glb): the game maker's own models, made with Tripo. Made game-ready by
  `~/pw/bandit-math/rigs/wagons/build_wagons.mjs` (not in the repo): the loose parts joined into one body and a tongue
  (one material each, the picture shrunk to 1024), the wagons' own wheels taken out, turned to face +Z, sized to life.
- **The wheel** (`wheel.glb`): one wheel shared by all four, rebuilt from the farm wagon's back wheel (its rim, hub and
  cap, and one spoke bar six times over, 30 degrees apart, so the twelve spokes are even and it looks right turning).
- `wagons.json`: where each wagon's wheels, seat, bed and tongue are (measured on the built models).
- The horses are the farm-pack horse (Quaternius, CC0: see the game's README); the collars, traces, reins and the
  doubletree are made in code (src/wagon.js). The driver's Drive clip (models/people/clips_drive_m.glb / _f.glb) was
  keyed in Blender on Quaternius' character skeletons (`~/pw/bandit-math/rigs/wagons/build_drive_clip.py`).
