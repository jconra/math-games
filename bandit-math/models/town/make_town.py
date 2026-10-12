# THE WESTERN TOWN'S LAYOUT AND PLANTING, written from the plan below into layout.json (the buildings, a few props, and the
# game's own places: the spawn, the square, the pasture, the corral) and planting.json (the land's own trails, kept from
# the Terrain Lab; the square's dust; the dirt trail out to the pasture; the corral's fences). The world reads both
# (world/valley.js, src/world.js). Run it again after changing the plan:
#   python3 make_town.py <the Terrain Lab's planting.json, for its land trails>
# After a change to any footpath (the square, the trail, the land trails) the land's bake of the paths picture goes stale:
# re-bake it (the bake rig, rigs/bakeland.cjs in the build notes) so the world loads fast.
import json, math, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))

# The square's frame: the town is laid out round the square with the saloon, the sheriff's office and the general store
# side by side facing the morning sun (it stands to the north-west at the valley's time of day, so their fronts are lit),
# the stage at the square's corner beside the saloon, facing in, its crowd's patch of trodden dirt in front of it running
# into the square; the stable on the square's south-west side behind the stage and the cabin on its north-east, both
# facing in; the trail leaves the square's east side between the store and the cabin. F: the way the row faces
# (north-west), P: along the row (north-east).
SQ = (-12.0, -205.0)
F, P = (-0.7071, -0.7071), (0.7071, -0.7071)
def at(f, p): return (round(SQ[0] + F[0] * f + P[0] * p, 2), round(SQ[1] + F[1] * f + P[1] * p, 2))

SQUARE = (SQ[0], SQ[1], 15.0)             # the square: middle x, z and its dusty radius (m)
BUILDINGS = [                             # kind, (x, z), rot (degrees: the way its front faces, 0 = +z), size (longest side, m)
    ('sheriff', at(-21.5, -7.25), 225, 11.7),
    ('generalStore', at(-21.0, 7.75), 225, 11),
    ('saloon', at(-22.4, -23.2), 225, 13.5),  # the row's third, an alley's width (5 m) past the sheriff's, its front in line with his
    ('stage', at(-4.5, -25.0), 160, 7),     # in the corner between the saloon and the stable, facing the square's middle (turned a little toward the sun)
    ('stable', at(5.0, -37.0), 165, 14),    # (turned 30 degrees from facing the square's middle, toward the sun: its front lit; 13 m further out since the stage came)
    ('cabin', at(0.0, 24.0), 285, 9.5),     # (likewise)
]
CROWD = (*at(-1.25, -18.0), 5.0)          # x, z, r: the trodden dirt in front of the stage, where a crowd stands to watch (it runs into the square)
STABLE_DOOR_OUT = 7.2                     # the stable's door spot: this far out from its middle along its front (half its depth, 5.7 m,
                                          # and 1.5 m more, as src/world.js puts a door)
STABLE_YARD = 3.2                         # the trodden dirt in front of the stable's door (m, its radius)
PROPS = [                                 # kind, (x, z), rot, size (1: life size)
    ('signpost', at(-9.0, 15.5), 45, 1),  # at the trail's head, between the store and the cabin
    ('picnicTable', at(8.0, 30.0), 300, 1),   # in the cabin's yard
]
RAILS = [                                 # hitching rails (short fences): from (f, p) to (f, p) in the square's frame
    ((-12.8, 8.6), (-12.8, 10.8)),        # in front of the general store, left of its door (short: the trail passes just beyond)
    ((-12.8, -9.2), (-12.8, -12.8)),      # in front of the sheriff's office, beside its steps
    ((-12.6, -18.4), (-12.6, -20.8)),     # in front of the saloon, right of its doors (the alley's mouth left open)
]
TREES = [                                 # town trees (drawn by the forest): kind, (x, z), size
    ('oak', at(10.0, 38.0), 1.0),         # shade behind the cabin
    ('ash', at(-14.0, -38.0), 0.9),       # and behind the stable
]
SPAWN = (*at(6.0, 0.0), 45)               # where the player starts: x, z, facing (degrees): looking at the sheriff's office
PASTURE = (175.0, -172.0, 28.0)           # x, z, r: open meadow east of the creek
CORRAL = dict(x=130.0, z=-188.0, w=22.0, d=18.0, rot=0, gate=dict(side='+x', at=0, width=4.0))
TRAIL_R, FENCE_SIZE = 4.2, 1.35         # the trail's brush (its dirt 0.55 of that each side); the corral's fence height (x 1.1 m)
TRAIL = [(-1.0, -205.0), (20.0, -206.0), (40.0, -204.0), (60.0, -202.0), (80.0, -203.0), (100.0, -205.0), (120.0, -206.5), (140.0, -205.0), (150.0, -197.0), (156.0, -186.0)]
WEST = [(-106.0, -201.0), (-80.0, -203.0), (-55.0, -207.0), (-30.0, -209.0)]   # the land's trails from the west, on into the square

def stable_walk():
    # the footpath from the square out to the stable's door (the stable stands 31 m out since the stage came): it leaves the
    # square heading for the door and comes up to it straight on for the last 5 m, then runs a step inside the doorway
    kind, (x, z), rot, size = next(b for b in BUILDINGS if b[0] == 'stable')
    fx, fz = math.sin(math.radians(rot)), math.cos(math.radians(rot))
    door = (x + fx * STABLE_DOOR_OUT, z + fz * STABLE_DOOR_OUT)
    ux, uz = door[0] - SQ[0], door[1] - SQ[1]; L = math.hypot(ux, uz); ux, uz = ux / L, uz / L
    pts = [(SQ[0] + ux * 12, SQ[1] + uz * 12), (door[0] + fx * 5, door[1] + fz * 5), door, (door[0] - fx * 1.2, door[1] - fz * 1.2)]
    return [round(door[0], 2), round(door[1], 2)], [(round(a, 2), round(b, 2)) for a, b in pts]

def corral_fences(C):
    # the corral's fence as strokes: its four sides as one line round, broken at the gate
    hw, hd, a = C['w'] / 2, C['d'] / 2, math.radians(C['rot']); c, s = math.cos(a), math.sin(a)
    at = lambda lx, lz: [round(C['x'] + c * lx + s * lz, 2), round(C['z'] - s * lx + c * lz, 2)]
    g = C['gate']; gw = g['width'] / 2
    # the corners in order round the square, starting just past the gate and ending just before it
    if g['side'] == '+x': pts = [(hw, g['at'] + gw), (hw, hd), (-hw, hd), (-hw, -hd), (hw, -hd), (hw, g['at'] - gw)]
    elif g['side'] == '-x': pts = [(-hw, g['at'] - gw), (-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd), (-hw, g['at'] + gw)]
    elif g['side'] == '+z': pts = [(g['at'] - gw, hd), (-hw, hd), (-hw, -hd), (hw, -hd), (hw, hd), (g['at'] + gw, hd)]
    else: pts = [(g['at'] + gw, -hd), (hw, -hd), (hw, hd), (-hw, hd), (-hw, -hd), (g['at'] - gw, -hd)]
    # each side its own stroke (a fence stroke puts a post every 2.2 m from its start, so each corner gets its own post)
    out = []
    for k in range(len(pts) - 1):
        out.append({'id': f'corral{k + 1}', 'mode': 'paint', 'kind': 27, 'r': 1.5, 'density': 2, 'size': FENCE_SIZE, 'seed': 7000 + k, 'pts': [at(*pts[k]), at(*pts[k + 1])]})
    return out

def offset(pts, d):
    # a line moved sideways by d m (left of the way it runs, for d > 0): each point along the mean of its two runs' normals
    out = []
    for i, (x, z) in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, tz) or 1
        out.append([round(x - tz / L * d, 2), round(z + tx / L * d, 2)])
    return out

def dense(pts, step=3.0):
    # a line's points every `step` m, as a hand-drawn stroke has them
    out = [list(pts[0])]
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, bz - az) / step))
        for i in range(1, n + 1): out.append([round(ax + (bx - ax) * i / n, 2), round(az + (bz - az) * i / n, 2)])
    return out

def main():
    lab = json.load(open(sys.argv[1]))
    land = [st for st in lab['strokes'] if str(st['id']).startswith('landpath')]
    layout = {'v': 1, 'items': [], 'roads': [], 'game': {
        'spawn': {'x': SPAWN[0], 'z': SPAWN[1], 'rot': SPAWN[2]},
        'square': {'x': SQUARE[0], 'z': SQUARE[1], 'r': SQUARE[2]},
        'pasture': {'x': PASTURE[0], 'z': PASTURE[1], 'r': PASTURE[2]},
        'corral': CORRAL,
        'crowd': {'x': CROWD[0], 'z': CROWD[1], 'r': CROWD[2]}}}
    for k, (kind, (x, z), rot, size) in enumerate(BUILDINGS):
        layout['items'].append({'id': kind, 'type': 'model', 'kind': kind, 'x': x, 'z': z, 'rot': rot, 'size': size, 'level': True})
    for k, (kind, (x, z), rot, size) in enumerate(PROPS):
        layout['items'].append({'id': f'{kind}{k + 1}', 'type': 'prop', 'kind': kind, 'x': x, 'z': z, 'rot': rot, 'size': size})
    for k, (kind, (x, z), size) in enumerate(TREES):
        layout['items'].append({'id': f'tree{k + 1}', 'type': 'tree', 'kind': kind, 'x': x, 'z': z, 'rot': 0, 'size': size})
    strokes = list(land)
    # (a footpath's dirt is 0.55 of its brush each side of its line: the brushes here are the dirt's own sizes over that)
    strokes.append({'id': 'square', 'mode': 'paint', 'kind': 25, 'r': round(SQUARE[2] / 0.55, 2), 'density': 2, 'size': 1, 'seed': 6000, 'pts': [[SQUARE[0], SQUARE[1]]]})
    strokes.append({'id': 'crowd', 'mode': 'paint', 'kind': 25, 'r': round(CROWD[2] / 0.55, 2), 'density': 2, 'size': 1, 'seed': 6003, 'pts': [[CROWD[0], CROWD[1]]]})
    strokes.append({'id': 'trail', 'mode': 'paint', 'kind': 25, 'r': TRAIL_R, 'density': 2, 'size': 1, 'seed': 6001, 'pts': dense(TRAIL)})
    door, walk = stable_walk()
    strokes.append({'id': 'stablewalk', 'mode': 'paint', 'kind': 25, 'r': TRAIL_R, 'density': 2, 'size': 1, 'seed': 6004, 'pts': dense(walk)})
    strokes.append({'id': 'stableyard', 'mode': 'paint', 'kind': 25, 'r': round(STABLE_YARD / 0.55, 2), 'density': 2, 'size': 1, 'seed': 6005, 'pts': [door]})
    # the trail's verges: a band of short grass each side (lawn tufts and the odd bunchgrass), so the tall meadow stands back
    # a few metres from the dirt instead of leaning over it (painting them keeps the land's own plants out from under them)
    hw = TRAIL_R * 0.55
    for side in (1, -1):
        line = offset(dense(TRAIL), side * (hw + 2.0))[2:]          # (not over the square)
        strokes.append({'id': f'verge-lawn{1 if side > 0 else 2}', 'mode': 'paint', 'kind': 16, 'r': 2.6, 'density': 0.6, 'size': 1.2, 'seed': 6010 + side, 'pts': line})
        strokes.append({'id': f'verge-grass{1 if side > 0 else 2}', 'mode': 'paint', 'kind': 3, 'r': 2.6, 'density': 0.04, 'size': 0.8, 'seed': 6020 + side, 'pts': line})
    strokes.append({'id': 'westtrail', 'mode': 'paint', 'kind': 25, 'r': 3.273, 'density': 2, 'size': 1, 'seed': 6002, 'pts': dense(WEST)})
    strokes += corral_fences(CORRAL)
    for k, (a, b) in enumerate(RAILS):
        strokes.append({'id': f'rail{k + 1}', 'mode': 'paint', 'kind': 27, 'r': 1.5, 'density': 2, 'size': 1, 'seed': 7100 + k, 'pts': [list(at(*a)), list(at(*b))]})
    # the corral's floor: trampled dirt (two strokes along it, rounded at the corners)
    C, hd = CORRAL, CORRAL['d'] / 2
    for k, oz in enumerate((-hd / 2, hd / 2)):
        pts = [[C['x'] - C['w'] / 2 + hd / 2, C['z'] + oz], [C['x'] + C['w'] / 2 - hd / 2, C['z'] + oz]]
        strokes.append({'id': f'corralfloor{k + 1}', 'mode': 'paint', 'kind': 25, 'r': round(hd / 2 / 0.55, 2), 'density': 2, 'size': 1, 'seed': 6100 + k, 'pts': pts})
    # THE PASTURE, grazed short: the meadow cleared over a ragged patch (a few overlapping round brushes, so its edge isn't a
    # ring), then short lawn tufts and a sprinkle of low plants (bunchgrass, wild strawberry, dandelions)
    px, pz, pr = PASTURE
    blobs = [(0, 0, pr + 2), (pr * 0.45, -pr * 0.35, pr * 0.7), (-pr * 0.5, pr * 0.3, pr * 0.65), (pr * 0.3, pr * 0.55, pr * 0.6), (-pr * 0.35, -pr * 0.5, pr * 0.6)]
    for k, (ox, oz, r) in enumerate(blobs):
        strokes.append({'id': f'pasture-clear{k + 1}', 'mode': 'clear', 'kind': 3, 'r': round(r, 2), 'density': 2, 'size': 1, 'seed': 6200 + k, 'pts': [[round(px + ox, 2), round(pz + oz, 2)]]})
    for k, (ox, oz, r) in enumerate(blobs):
        strokes.append({'id': f'pasture-lawn{k + 1}', 'mode': 'paint', 'kind': 16, 'r': round(r, 2), 'density': 0.5, 'size': 1.3, 'seed': 6300 + k, 'pts': [[round(px + ox, 2), round(pz + oz, 2)]]})
    for k, (kind, dens, size) in enumerate([(3, 0.03, 0.8), (5, 0.05, 1.0), (6, 0.015, 1.0)]):
        strokes.append({'id': f'pasture-low{k + 1}', 'mode': 'paint', 'kind': kind, 'r': pr + 2, 'density': dens, 'size': size, 'seed': 6400 + k, 'pts': [[px, pz]]})
    planting = {'v': 1, 'procedural': True, 'strokes': strokes, 'items': []}
    json.dump(layout, open(os.path.join(HERE, 'layout.json'), 'w'), indent=1)
    json.dump(planting, open(os.path.join(HERE, 'planting.json'), 'w'), separators=(',', ':'))
    print(f"layout: {len(layout['items'])} items; planting: {len(strokes)} strokes ({len(land)} land trails)")

main()
