// The screenshot scenes behind ?shot=chase|street|mission|title. Each one sets the
// world up for a real situation — a police chase, a walk through traffic, the
// shootout at the meet, the title over a living city — then plays the real rules
// forward for a fixed time, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TITLE_SECONDS = 5;
const STREET_SECONDS = 14;
const MISSION_SECONDS = 9;
const CHASE_SECONDS = 6;

/** Steer a car along the road grid toward a target: drive down one road, turn at
 * the intersection nearest the target's other axis, then down the next road. A
 * stateful driver, so it never flips between two roads at a crossing; if the car
 * stops moving (wedged on a building), it reverses out and carries on. */
function createDriver() {
  const ROADS_X = [300, 900, 1500, 2100, 2700, 3300];
  const ROADS_Y = [300, 900, 1500, 2100];
  let leg = 'v';
  let lastX = 0;
  let lastY = 0;
  let stuckT = 0;
  let reverseT = 0;
  function nearest(list, value) {
    let best = list[0];
    for (const v of list) if (Math.abs(v - value) < Math.abs(best - value)) best = v;
    return best;
  }
  return function driveToward(world, target) {
    const car = world.actors.player.inCar;
    if (!car) return { x: 0, y: 0 };
    if (reverseT > 0) {
      reverseT -= 1 / 60;
      return { x: -0.8, y: 1 };
    }
    const moved = Math.hypot(car.x - lastX, car.y - lastY);
    if (moved < 0.15) stuckT += 1 / 60;
    else stuckT = 0;
    lastX = car.x;
    lastY = car.y;
    if (stuckT > 1.2) {
      stuckT = 0;
      reverseT = 0.9;
      return { x: 0.8, y: 1 };
    }
    const tx = nearest(ROADS_X, target.x);
    const ty = nearest(ROADS_Y, target.y);
    // Lane centering: drift gently toward the centreline of the road the car is
    // actually on (nearest to the car), not the road it is heading for.
    const cx = nearest(ROADS_X, car.x);
    const cy = nearest(ROADS_Y, car.y);
    const ALIGN = 0.004;
    let wantAngle;
    if (leg === 'v') {
      const south = ty > car.y;
      const base = south ? Math.PI / 2 : -Math.PI / 2;
      const corr = Math.max(-0.35, Math.min(0.35, (cx - car.x) * ALIGN));
      wantAngle = base + (south ? -corr : corr);
      if (Math.abs(car.y - ty) < 200) leg = 'h';
    } else {
      const east = tx > car.x;
      const base = east ? 0 : Math.PI;
      const corr = Math.max(-0.35, Math.min(0.35, (cy - car.y) * ALIGN));
      wantAngle = base + (east ? corr : -corr);
      if (Math.abs(car.x - tx) < 200) leg = 'v';
    }
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Ease off the throttle on a hard turn, so the car turns instead of overshooting.
    const throttle = Math.abs(diff) > 0.9 ? -0.35 : -1;
    return { x: Math.max(-1, Math.min(1, diff * 2)), y: throttle };
  };
}

/** Walk toward a target, sliding around buildings the way the player does. */
function walkToward(world, target) {
  const p = world.actors.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** The mouse never aims in a staged shot: a view that answers nowhere. */
const dummyView = () => ({ x: 0, y: 0 });

function stepWorld(world, seconds, control) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    const input = control(world);
    // The autopilot drives through the same step the player uses: a fixed move,
    // the mission target and no one-shot actions.
    world.step(STEP, input, dummyView, 0, false);
  }
}

export function stageShot(name, world) {
  const actors = world.actors;
  const p = actors.player;
  world.reset(true);
  if (name === 'title') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      world.step(STEP, { move: () => ({ x: 0, y: 0 }), running: () => false, mouse: { x: 0, y: 0 } }, dummyView, 0, false);
    }
    return { screen: SCREEN_TITLE };
  }

  if (name === 'street') {
    p.x = 1500;
    p.y = 900;
    p.angle = 0;
    const target = world.missions.target();
    stepWorld(world, STREET_SECONDS, (w) => {
      const move = walkToward(w, target || { x: 2100, y: 900 });
      return { move: () => move, running: () => false, mouse: { x: 0, y: 0 } };
    });
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    const mission = world.missions.current();
    // Jump the story to the exchange: the meet, the ambush, the cash.
    world.missions.reset(3);
    world.state.messages.length = 0;
    world.message('The Exchange: The meet is at the old lot. The Vipers will not let it go easy.', 6);
    actors.spawnGang(1500, 2100, 4);
    actors.state.gangSpawned = true;
    p.x = 1500;
    p.y = 1850;
    p.angle = -Math.PI / 2;
    p.ammo = 48;
    stepWorld(world, MISSION_SECONDS, (w) => {
      const g = w.actors.gang[0];
      const move = g ? walkToward(w, { x: g.x, y: g.y }) : { x: 0, y: 0 };
      return { move: () => move, running: () => false, mouse: { x: 0, y: 0 } };
    });
    return { screen: SCREEN_PLAY };
  }

  // 'chase' (and anything else): the getaway — four stars, two cop cars on the
  // player's tail, the safehouse marker ahead.
  world.missions.reset(4);
  world.state.messages.length = 0;
  world.message('The Getaway: One last run. Four stars, the whole city after you — make the safehouse.', 6);
  p.wanted = 4;
  const car = actors.spawnCar(2700, 2100, 'player');
  car.angle = -Math.PI / 2;
  car.speed = 320;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  actors.spawnCopCar(p.x, p.y);
  actors.spawnCopCar(p.x, p.y);
  const target = world.missions.target();
  const drive = createDriver();
  stepWorld(world, CHASE_SECONDS, (w) => {
    const move = drive(w, target || { x: 300, y: 300 });
    return { move: () => move, running: () => false, mouse: { x: 0, y: 0 } };
  });
  return { screen: SCREEN_PLAY };
}
