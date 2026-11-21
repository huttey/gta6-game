// Drawing only: the world state and the current screen in, pixels out. A camera
// follows the player across Solmar; the HUD shows cash, health, wanted stars, the
// mission and a live minimap. Text that holds a number is rebuilt only when the
// number changes, so a frame allocates nothing.

import { BEACH, CAR, DOCKS, FONT, PALETTE, PED, PLAYER, ROADS_X, ROADS_Y, ROAD_W, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const MINIMAP = { w: 200, h: 134, margin: 16 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, camX: WORLD.width / 2, camY: WORLD.height / 2 };
  const cashLabel = cachedLabel('$');
  const ammoLabel = cachedLabel('');
  const speedLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** Window pixels to world coordinates, for the mouse aim. */
  function viewToWorld(mx, my) {
    const ratio = window.devicePixelRatio || 1;
    const px = mx * ratio;
    const py = my * ratio;
    return {
      x: view.camX + (px - canvas.width / 2) / view.scale,
      y: view.camY + (py - canvas.height / 2) / view.scale,
    };
  }

  function toScreen(wx, wy) {
    return {
      x: (wx - view.camX) * view.scale + canvas.width / 2,
      y: (wy - view.camY) * view.scale + canvas.height / 2,
    };
  }

  function drawCity(city) {
    // Ground: grass everywhere, then the beach, sea and docks on top.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH.y, WORLD.width, BEACH.seaY - BEACH.y);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, BEACH.seaY, WORLD.width, WORLD.height - BEACH.seaY);
    context.fillStyle = PALETTE.seaDeep;
    for (let x = 120; x < WORLD.width; x += 420) {
      context.fillRect(x, BEACH.seaY + 40, 180, 8);
    }
    context.fillStyle = '#6a6f78';
    context.fillRect(DOCKS.x, 0, WORLD.width - DOCKS.x, BEACH.y);
    // Parks.
    context.fillStyle = PALETTE.park;
    for (const park of city.parks) context.fillRect(park.x, park.y, park.w, park.h);
    // Roads: asphalt, sidewalks at the edges, dashed centre lines.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_W / 2 - 8, 0, ROAD_W + 16, BEACH.y);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_W / 2 - 8, DOCKS.x, ROAD_W + 16);
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH.y);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_W / 2, DOCKS.x, ROAD_W);
    context.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 20; y < BEACH.y - 20; y += 64) context.fillRect(rx - 3, y, 6, 32);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < DOCKS.x - 20; x += 64) context.fillRect(x, ry - 3, 32, 6);
    }
    // Parking lots.
    context.fillStyle = '#54595f';
    for (const lot of city.lots) context.fillRect(lot.x, lot.y, lot.w, lot.h);
    // Buildings: shadow, roof, edge.
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingEdge;
      context.fillRect(b.x, b.y, b.w, 4);
      context.fillRect(b.x, b.y, 4, b.h);
    }
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.wrecked) context.globalAlpha = 0.75;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    context.fillStyle = '#bfe3f2';
    context.fillRect(-8, -CAR.width / 2 + 5, 18, CAR.width - 10);
    context.fillStyle = '#222';
    context.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 - 3, 12, 6);
    context.fillRect(-CAR.length / 2 + 6, CAR.width / 2 - 3, 12, 6);
    context.fillRect(CAR.length / 2 - 18, -CAR.width / 2 - 3, 12, 6);
    context.fillRect(CAR.length / 2 - 18, CAR.width / 2 - 3, 12, 6);
    if (car.kind === 'police') {
      context.fillStyle = '#fff';
      context.fillRect(-4, -CAR.width / 2 + 2, 8, CAR.width - 4);
      context.fillStyle = '#e33';
      context.fillRect(-CAR.length / 2 + 2, -6, 10, 12);
      context.fillStyle = '#36c';
      context.fillRect(CAR.length / 2 - 12, -6, 10, 12);
    }
    if (car.kind === 'taxi') {
      context.fillStyle = '#111';
      context.fillRect(-6, -CAR.width / 2 + 2, 12, 6);
    }
    context.restore();
  }

  function drawPed(x, y, angle, color, radius) {
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#222';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * (radius + 5), y + Math.sin(angle) * (radius + 5));
    context.stroke();
  }

  function drawMarker(target, time) {
    if (!target) return;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    context.save();
    context.translate(target.x, target.y - 30);
    context.scale(pulse, pulse);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(0, -16);
    context.lineTo(12, 0);
    context.lineTo(0, 16);
    context.lineTo(-12, 0);
    context.closePath();
    context.fill();
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // A line from the player to the marker, faint, so the eye finds it.
    context.strokeStyle = 'rgba(255,95,162,0.35)';
    context.lineWidth = 3;
    context.setLineDash([10, 12]);
    context.beginPath();
    context.moveTo(view.camX, view.camY);
    context.lineTo(target.x, target.y);
    context.stroke();
    context.setLineDash([]);
  }

  function drawMinimap(world, target, time) {
    const x0 = canvas.width - MINIMAP.w - MINIMAP.margin;
    const y0 = MINIMAP.margin;
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(10,14,22,0.85)';
    context.fillRect(x0 - 6, y0 - 6, MINIMAP.w + 12, MINIMAP.h + 12);
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, MINIMAP.w, MINIMAP.h);
    context.fillStyle = PALETTE.minimapWater;
    context.fillRect(x0, y0 + BEACH.seaY * sy, MINIMAP.w, MINIMAP.h - BEACH.seaY * sy);
    context.fillStyle = PALETTE.minimapRoad;
    for (const rx of ROADS_X) context.fillRect(x0 + rx * sx - 2, y0, 4, BEACH.y * sy);
    for (const ry of ROADS_Y) context.fillRect(x0, y0 + ry * sy - 2, DOCKS.x * sx, 4);
    context.fillStyle = PALETTE.minimapPark;
    for (const park of world.city.parks) context.fillRect(x0 + park.x * sx, y0 + park.y * sy, park.w * sx, park.h * sy);
    const p = world.actors.player;
    if (target) {
      const pulse = 6 + Math.sin(time * 5) * 2;
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(x0 + target.x * sx, y0 + target.y * sy, pulse, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = PALETTE.cop;
    for (const cop of world.actors.cops) {
      const cx = cop.kind === 'car' ? cop.car.x : cop.x;
      const cy = cop.kind === 'car' ? cop.car.y : cop.y;
      context.fillRect(x0 + cx * sx - 2, y0 + cy * sy - 2, 4, 4);
    }
    context.fillStyle = PALETTE.gang;
    for (const g of world.actors.gang) {
      context.fillRect(x0 + g.x * sx - 2, y0 + g.y * sy - 2, 4, 4);
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2);
    context.stroke();
  }

  function drawHud(world, ui, time) {
    const p = world.actors.player;
    const mission = world.missions.current();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.textBaseline = 'top';
    // Cash and health, top left.
    text(cashLabel(p.cash), 20, 16, 30, PALETTE.cash, 'left');
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(20, 52, 180, 14);
    context.fillStyle = p.health > 30 ? PALETTE.health : '#ff2e2e';
    context.fillRect(20, 52, Math.max(0, 180 * (p.health / PLAYER.health)), 14);
    text(`HP ${Math.max(0, Math.round(p.health))}`, 208, 50, 18, PALETTE.text, 'left');
    // Weapon and ammo.
    text(ammoLabel(`${p.weapon === 'pistol' ? 'Pistol' : 'Fists'}  ${p.weapon === 'pistol' ? p.ammo + ' ammo' : ''}`), 20, 74, 18, PALETTE.muted, 'left');
    // Wanted stars, top right above the minimap.
    const stars = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
    text(stars, canvas.width - MINIMAP.w - MINIMAP.margin, MINIMAP.margin + MINIMAP.h + 12, 26, PALETTE.wanted, 'left');
    if (p.wanted > 0) text('WANTED', canvas.width - 16, MINIMAP.margin + MINIMAP.h + 14, 18, '#ff5a5a', 'right');
    drawMinimap(world, world.missions.target(), time);
    // Mission objective, bottom centre.
    const objective = world.missions.objectiveText();
    const title = mission ? `${mission.name} — ` : '';
    context.fillStyle = 'rgba(10,14,22,0.8)';
    const objText = `${title}${objective}`;
    context.font = `18px ${FONT}`;
    const objW = Math.min(canvas.width - 40, 26 + context.measureText(objText).width);
    context.fillRect((canvas.width - objW) / 2, canvas.height - 52, objW, 36);
    text(objText, canvas.width / 2, canvas.height - 44, 18, PALETTE.text, 'center');
    // Speed, bottom right, while driving.
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.12);
      text(speedLabel(`${mph} mph`), canvas.width - 20, canvas.height - 44, 26, PALETTE.text, 'right');
    }
    // Messages, centre top.
    let my = 90;
    context.textBaseline = 'alphabetic';
    for (const m of world.state.messages) {
      text(m.text, canvas.width / 2, my, 20, PALETTE.text, 'center');
      my += 28;
    }
    // Mute state and controls hint.
    if (ui.muted) text('Muted (M)', 20, canvas.height - 30, 16, PALETTE.muted, 'left');
    else if (ui.showHints) text('WASD move · E car · F punch · Click shoot · P pause · M mute', 20, canvas.height - 30, 16, PALETTE.muted, 'left');
    // Damage flash.
    if (ui.flash > 0) {
      context.fillStyle = `rgba(255,30,30,${Math.min(0.35, ui.flash * 0.25)})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Off-screen mission marker: an arrow at the edge, pointing the way.
    const target = world.missions.target();
    if (target && screenHasTarget(target) === false) {
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      const ex = canvas.width / 2 + Math.cos(a) * (canvas.width / 2 - 60);
      const ey = canvas.height / 2 + Math.sin(a) * (canvas.height / 2 - 60);
      context.save();
      context.translate(ex, ey);
      context.rotate(a);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-12, -12);
      context.lineTo(-12, 12);
      context.closePath();
      context.fill();
      context.restore();
      text(`${Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 50) * 50}m`, ex, ey + 22, 16, PALETTE.marker, 'center');
    }
  }

  function screenHasTarget(target) {
    const s = toScreen(target.x, target.y);
    return s.x > 0 && s.x < canvas.width && s.y > 0 && s.y < canvas.height;
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const lineH = 32;
    const height = 150 + lines.length * lineH + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.setTransform(view.scale, 0, 0, view.scale, (canvas.width - VIEW.width * view.scale) / 2, (canvas.height - VIEW.height * view.scale) / 2);
    context.fillStyle = 'rgba(10,14,22,0.92)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + 140 + index * lineH, 21, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.cash, 'center');
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Paint one frame: the city through the camera, then the HUD or a panel. */
  function draw(world, screen, ui, time) {
    const p = world.actors.player;
    // Camera follows the player, clamped to the world.
    const halfW = canvas.width / 2 / view.scale;
    const halfH = canvas.height / 2 / view.scale;
    view.camX = Math.max(halfW, Math.min(WORLD.width - halfW, p.x));
    view.camY = Math.max(halfH, Math.min(WORLD.height - halfH, p.y));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, canvas.width / 2 - view.camX * view.scale, canvas.height / 2 - view.camY * view.scale);
    drawCity(world.city);
    for (const pk of world.actors.pickups) {
      context.fillStyle = pk.kind === 'health' ? '#ff5a5a' : pk.kind === 'ammo' ? '#ffd23e' : '#7be382';
      context.beginPath();
      context.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#111';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + 1);
    }
    for (const car of world.actors.cars) drawCar(car);
    for (const ped of world.actors.peds) drawPed(ped.x, ped.y, ped.angle, ped.color, PED.radius);
    for (const g of world.actors.gang) drawPed(g.x, g.y, g.angle, PALETTE.gang, PED.radius);
    for (const cop of world.actors.cops) {
      if (cop.kind === 'foot') drawPed(cop.x, cop.y, cop.angle, PALETTE.cop, PED.radius);
      else drawCar(cop.car);
    }
    // The player: a yellow jacket, a facing tick, a ring while invulnerable.
    if (p.invulnerable === 0 || Math.floor(p.invulnerable * 10) % 2 === 1) {
      if (!p.inCar) drawPed(p.x, p.y, p.angle, PALETTE.player, PLAYER.radius);
    }
    for (const part of world.actors.particles) {
      context.globalAlpha = Math.max(0, part.life / part.maxLife);
      context.fillStyle = part.color;
      context.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    context.globalAlpha = 1;
    for (const t of world.actors.tracers) {
      context.globalAlpha = Math.max(0, t.life / t.maxLife);
      context.strokeStyle = '#ffe27a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(t.x1, t.y1);
      context.lineTo(t.x2, t.y2);
      context.stroke();
    }
    context.globalAlpha = 1;
    drawMarker(world.missions.target(), time);
    if (screen === SCREEN_TITLE) {
      const save = ui.save;
      const lines = [
        'Rico owes the Vipers $5,000. One week in Solmar to pay it back.',
        'Steal cars, run jobs, lose the cops — and do not get caught.',
        '',
        save ? `Continue: mission ${save.mission + 1} of 5, $${save.cash} in pocket.` : 'A new story in Solmar, city of sun and sirens.',
      ];
      drawPanel('SOLMAR', lines, save ? 'Enter — Continue · N — New game' : 'Enter — Start');
      return;
    }
    drawHud(world, ui, time);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.'], 'P — Resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmar police took their cut.', 'Rico wakes at the hospital.'], 'Enter — Keep playing');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Rico went down in the streets of Solmar.', 'The hospital patches him up.'], 'Enter — Keep playing');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, viewToWorld };
}
