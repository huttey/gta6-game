// The simulation: city, actors and missions wired together. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react (sounds,
// screens, saves) without the world knowing about them. Nothing here draws.

import { CAR, MISSION_REWARDS, PLAYER, WANTED } from './config.js';
import { createCity } from './city.js';
import {
  EVENT_BUSTED,
  EVENT_CAR_STOLEN,
  EVENT_COP_KILLED,
  EVENT_CRASH,
  EVENT_GANG_DEAD,
  EVENT_HIT,
  EVENT_PED_HIT,
  EVENT_PICKUP,
  EVENT_SHOT,
  EVENT_TARGET,
  EVENT_WASTED,
  createActors,
} from './actors.js';
import { createMissions } from './missions.js';
import { loadSave, writeSave } from './save.js';

export const EVENT_BUSTED_FLAG = EVENT_BUSTED;
export const EVENT_WASTED_FLAG = EVENT_WASTED;
export const EVENT_MISSION_DONE = 4096;
export const EVENT_FARE_DONE = 8192;
export const EVENT_STORY_DONE = 16384;

export const SPAWN = { x: 1500, y: 1420 };
export const HOSPITAL = { x: 900, y: 820 };

export function createWorld(random) {
  const city = createCity(random);
  const actors = createActors(city, random);
  const missions = createMissions();
  const state = {
    messages: [],
    messageTimer: 0,
    saveTimer: 0,
    fareTimer: 10,
    started: false,
  };

  function message(text, seconds) {
    const last = state.messages[state.messages.length - 1];
    if (last && last.text === text) {
      last.life = seconds || 4;
      return;
    }
    state.messages.push({ text, life: seconds || 4 });
    if (state.messages.length > 3) state.messages.shift();
  }

  function snapshot() {
    const p = actors.player;
    return {
      cash: p.cash,
      mission: missions.state.index,
      x: p.x,
      y: p.y,
      health: Math.max(0, Math.round(p.health)),
      ammo: p.ammo,
      wanted: p.wanted,
      storyDone: missions.state.done,
    };
  }

  function save() {
    writeSave(snapshot());
  }

  function applySave(save) {
    const p = actors.player;
    p.cash = save.cash || 0;
    p.health = save.health || PLAYER.health;
    p.ammo = save.ammo || 0;
    p.wanted = 0;
    p.x = save.x || SPAWN.x;
    p.y = save.y || SPAWN.y;
    missions.reset(save.mission || 0);
    if (save.storyDone) missions.state.done = true;
  }

  function reset(newGame) {
    actors.reset(SPAWN);
    missions.reset(0);
    state.messages.length = 0;
    state.saveTimer = 0;
    state.fareTimer = 10;
    state.started = true;
    if (!newGame) {
      const save = loadSave();
      if (save) {
        applySave(save);
        message(save.mission > 0 ? `Welcome back, Rico. Mission ${save.mission + 1} of 5.` : 'Welcome back, Rico.');
      }
    }
    const mission = missions.current();
    if (mission) message(`${mission.name}: ${mission.intro}`, 6);
  }

  function addWanted(amount) {
    const p = actors.player;
    const before = p.wanted;
    p.wanted = Math.min(WANTED.max, p.wanted + amount);
    if (p.wanted > before) {
      message(`WANTED +${p.wanted - before} — ${p.wanted} star${p.wanted === 1 ? '' : 's'}`);
    }
  }

  function step(dt, input, view, actions, clicked) {
    let events = 0;
    const mission = missions.current();
    const target = missions.target();
    const actorEvents = actors.step(dt, input, view, target, actions, clicked);
    const p = actors.player;

    if (actorEvents & EVENT_CAR_STOLEN) {
      addWanted(WANTED.steal);
      message('Car stolen — the law saw that');
    }
    if (actorEvents & EVENT_PED_HIT) {
      addWanted(WANTED.hitPed);
      message('Pedestrian hit — wanted up');
    }
    if (actorEvents & EVENT_COP_KILLED) {
      addWanted(WANTED.killCop);
      message('Cop down — the whole city will hear of this');
    }
    if (actorEvents & EVENT_HIT) {
      // A gang bullet or a cop's shove; the renderer flashes the damage.
    }
    if (actorEvents & EVENT_PICKUP) {
      // The pickup kind is applied inside the actors; the caller plays the sound.
    }
    if (actorEvents & EVENT_CRASH) {
      p.health -= 4;
      if (p.health <= 0) return events | EVENT_WASTED_FLAG;
    }

    // Shooting in the open is a crime even when it misses.
    if (actorEvents & EVENT_SHOT) {
      addWanted(WANTED.shoot);
    }

    if (actorEvents & EVENT_TARGET) {
      if (mission) {
        if (mission.id === 2 && missions.state.stage === 'deliver') {
          const pay = missions.advance();
          p.cash += pay;
          message(`Package delivered. +$${pay}`);
          events |= EVENT_MISSION_DONE;
          save();
        } else if (mission.id === 2 && missions.state.stage === 'go') {
          missions.advance();
          message('Package collected — deliver it to the motel');
        } else if (mission.id === 3) {
          const pay = missions.advance();
          p.cash += pay;
          p.wanted = 0;
          message(`Clean — the spray shop took the heat. +$${pay}`);
          events |= EVENT_MISSION_DONE;
          save();
        } else if (mission.id === 4 && missions.state.stage === 'go') {
          // Reaching the meet starts the ambush; the mission ends when the gang is dead.
          if (actors.gang.length === 0) {
            actors.spawnGang(mission.gangAt.x, mission.gangAt.y, mission.gangCount);
            actors.state.gangSpawned = true;
            message('Ambush! The Vipers are here — take them out');
          }
        } else if (mission.id === 5) {
          const pay = missions.advance();
          p.cash += pay;
          p.wanted = 0;
          message(`You made it. Rico is free. +$${pay}`);
          events |= EVENT_MISSION_DONE;
          events |= EVENT_STORY_DONE;
          save();
        } else if (mission.id === 1) {
          const pay = missions.advance();
          p.cash += pay;
          message(`First wheels delivered. +$${pay}`);
          events |= EVENT_MISSION_DONE;
          save();
        }
      } else if (missions.state.fare) {
        const fare = missions.state.fare;
        if (fare.stage === 'pickup') {
          fare.stage = 'ride';
          message('Fare aboard — drive to the drop-off');
        } else {
          const pay = missions.fareDone();
          p.cash += pay;
          message(`Fare paid. +$${pay}`);
          events |= EVENT_FARE_DONE;
          save();
        }
      }
    }

    if (actorEvents & EVENT_GANG_DEAD) {
      if (mission && mission.id === 4) {
        const pay = missions.advance();
        p.cash += pay;
        actors.addPickup('cash', mission.gangAt.x + 60, mission.gangAt.y, 0);
        message(`The Vipers are done. The cash is yours. +$${pay}`);
        events |= EVENT_MISSION_DONE;
        save();
      }
    }

    if (actorEvents & EVENT_BUSTED) {
      const lost = Math.min(p.cash, Math.max(50, Math.floor(p.cash * 0.2)));
      p.cash -= lost;
      p.wanted = 0;
      p.health = Math.max(50, p.health);
      p.x = HOSPITAL.x;
      p.y = HOSPITAL.y;
      if (p.inCar) p.inCar = null;
      message(`Busted — the cops took $${lost}. You wake at the hospital.`, 6);
      save();
      return events | EVENT_BUSTED_FLAG;
    }
    if (actorEvents & EVENT_WASTED) {
      const lost = Math.min(p.cash, Math.max(0, Math.floor(p.cash * 0.1)));
      p.cash -= lost;
      p.health = 50;
      p.x = HOSPITAL.x;
      p.y = HOSPITAL.y;
      if (p.inCar) p.inCar = null;
      message(`Wasted — you wake at the hospital, $${lost} lighter.`, 6);
      save();
      return events | EVENT_WASTED_FLAG;
    }

    // Mission 3 and 5 start with the heat already on.
    if (mission && mission.wantedOnStart && p.wanted < mission.wantedOnStart && missions.state.stage === 'go') {
      p.wanted = mission.wantedOnStart;
    }

    // Taxi fares appear once the story is done, or while roaming between missions.
    if (!mission || missions.state.done) {
      state.fareTimer -= dt;
      if (state.fareTimer <= 0 && !missions.state.fare) {
        state.fareTimer = 25 + random() * 15;
        const pickup = city.randomSidewalkPoint();
        const dest = city.randomRoadPoint(120);
        missions.startFare(pickup, dest, 40 + Math.floor(random() * 5) * 10);
        message('A fare is waiting — the marker shows where');
      }
    }

    // Message lifetimes and the autosave.
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      state.messages[i].life -= dt;
      if (state.messages[i].life <= 0) state.messages.splice(i, 1);
    }
    state.saveTimer += dt;
    if (state.saveTimer >= 20) {
      state.saveTimer = 0;
      save();
    }
    void CAR;
    void MISSION_REWARDS;
    return events | actorEvents;
  }

  reset(true);

  return { state, city, actors, missions, message, snapshot, save, reset, step };
}
