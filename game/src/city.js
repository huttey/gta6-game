// The city of Solmar: a road grid, blocks of buildings, parks and lots between the
// roads, a beach and sea along the south edge and docks on the east edge. Generated
// once from a seed, then read-only: isRoad, collides and the lists the renderer and
// the actors use. Nothing here draws or moves.

import { BEACH, DOCKS, PALETTE, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';
import { pick } from './random.js';

function onRoadX(x) {
  for (const road of ROADS_X) if (Math.abs(x - road) <= ROAD_W / 2) return true;
  return false;
}

function onRoadY(y) {
  for (const road of ROADS_Y) if (Math.abs(y - road) <= ROAD_W / 2) return true;
  return false;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  // Blocks: the rectangles between neighbouring roads (and the map edges).
  const xs = [0, ...ROADS_X.map((r) => r + ROAD_W / 2), WORLD.width];
  const ys = [0, ...ROADS_Y.map((r) => r + ROAD_W / 2), WORLD.height];
  const xEdges = [0];
  for (const r of ROADS_X) xEdges.push(r - ROAD_W / 2, r + ROAD_W / 2);
  xEdges.push(WORLD.width);
  const yEdges = [0];
  for (const r of ROADS_Y) yEdges.push(r - ROAD_W / 2, r + ROAD_W / 2);
  yEdges.push(WORLD.height);

  for (let xi = 0; xi < xEdges.length - 1; xi += 2) {
    for (let yi = 0; yi < yEdges.length - 1; yi += 2) {
      const x0 = xEdges[xi];
      const x1 = xEdges[xi + 1];
      const y0 = yEdges[yi];
      const y1 = yEdges[yi + 1];
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (y0 >= BEACH.y - 40) continue; // the beach strip stays open sand
      if (x0 >= DOCKS.x - 40) continue; // the docks stay open tarmac
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0 + 14, y: y0 + 14, w: x1 - x0 - 28, h: y1 - y0 - 28 });
        continue;
      }
      if (roll < 0.26) {
        lots.push({ x: x0 + 10, y: y0 + 10, w: x1 - x0 - 20, h: y1 - y0 - 20 });
        continue;
      }
      // One to three buildings in the block, with a margin for the sidewalk.
      const count = 1 + Math.floor(random() * 3);
      for (let b = 0; b < count; b += 1) {
        const w = 90 + random() * Math.max(40, (x1 - x0 - 130) / count);
        const h = 80 + random() * Math.max(40, y1 - y0 - 150);
        const x = x0 + 18 + random() * Math.max(1, x1 - x0 - w - 36);
        const y = y0 + 18 + random() * Math.max(1, y1 - y0 - h - 36);
        buildings.push({ x, y, w, h, color: pick(random, PALETTE.buildingRoof) });
      }
    }
  }

  function isRoad(x, y) {
    if (y >= BEACH.y) return false;
    return onRoadX(x) || onRoadY(y);
  }

  function isBeach(x, y) {
    return y >= BEACH.y && y < BEACH.seaY;
  }

  function isSea(x, y) {
    return y >= BEACH.seaY;
  }

  function isDocks(x, y) {
    return x >= DOCKS.x && y < BEACH.y;
  }

  /** Circle (x, y, r) against every building; the sea blocks everyone. */
  function collides(x, y, r) {
    if (isSea(x, y)) return true;
    if (x - r < 0 || x + r > WORLD.width || y - r < 0 || y + r > WORLD.height) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  /** The nearest point on a road centreline to (x, y). */
  function nearestRoadPoint(x, y) {
    let bestX = ROADS_X[0];
    let best = Math.abs(x - ROADS_X[0]);
    for (const road of ROADS_X) {
      const d = Math.abs(x - road);
      if (d < best) {
        best = d;
        bestX = road;
      }
    }
    let bestY = ROADS_Y[0];
    best = Math.abs(y - ROADS_Y[0]);
    for (const road of ROADS_Y) {
      const d = Math.abs(y - road);
      if (d < best) {
        best = d;
        bestY = road;
      }
    }
    return Math.abs(x - bestX) < Math.abs(y - bestY) ? { x: bestX, y } : { x, y: bestY };
  }

  function randomRoadPoint(margin) {
    const vertical = random() < 0.5;
    if (vertical) {
      return { x: pick(random, ROADS_X), y: margin + random() * (BEACH.y - margin * 2) };
    }
    return { x: margin + random() * (DOCKS.x - margin * 2), y: pick(random, ROADS_Y) };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint(80);
    return { x: p.x + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14 + random() * 20), y: p.y };
  }

  return {
    buildings,
    parks,
    lots,
    isRoad,
    isBeach,
    isSea,
    isDocks,
    collides,
    nearestRoadPoint,
    randomRoadPoint,
    randomSidewalkPoint,
  };
}
