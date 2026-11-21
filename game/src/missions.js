// Rico's story: five missions, played in order, each with a target on the map, a line
// of objective text and a cash payout. After the last one the city stays open with
// repeatable taxi fares. The mission state machine only names targets and pays out;
// the world moves the player, the cars and the police.

import { MISSION_REWARDS } from './config.js';

export const MISSION_LIST = [
  {
    id: 1,
    name: 'First Wheels',
    intro: 'Rico needs wheels. Steal any car and bring it to the garage.',
    objective: 'Steal a car (E) and drive to the garage',
    target: { x: 2100, y: 900 },
    targetLabel: 'Garage',
    needsCar: true,
  },
  {
    id: 2,
    name: 'The Package',
    intro: 'A package waits at the docks. Pick it up and drop it at the motel. No cops.',
    objective: 'Pick up the package at the docks, deliver it to the motel',
    target: { x: 3450, y: 1500 },
    targetLabel: 'Docks pickup',
    pickupAt: { x: 3450, y: 1500 },
    deliverAt: { x: 900, y: 2100 },
    deliverLabel: 'Motel',
  },
  {
    id: 3,
    name: 'Lose the Heat',
    intro: 'The heat is on — three stars and climbing. Reach the spray shop to go clean.',
    objective: 'Lose the cops: reach the spray shop',
    target: { x: 2700, y: 300 },
    targetLabel: 'Spray shop',
    wantedOnStart: 3,
    clearWantedOnDone: true,
  },
  {
    id: 4,
    name: 'The Exchange',
    intro: 'The meet is at the old lot. The Vipers will not let it go easy — bring a gun.',
    objective: 'Reach the meet, take out the Vipers, grab the cash',
    target: { x: 1500, y: 2100 },
    targetLabel: 'The meet',
    gangAt: { x: 1500, y: 2100 },
    gangCount: 4,
  },
  {
    id: 5,
    name: 'The Getaway',
    intro: 'One last run. Four stars, the whole city after you — make the safehouse.',
    objective: 'Escape to the safehouse',
    target: { x: 300, y: 300 },
    targetLabel: 'Safehouse',
    wantedOnStart: 4,
    clearWantedOnDone: true,
  },
];

export function createMissions() {
  const state = { index: 0, stage: 'go', done: false, fare: null };

  function current() {
    if (state.index >= MISSION_LIST.length) return null;
    return MISSION_LIST[state.index];
  }

  function objectiveText() {
    const mission = current();
    if (mission) {
      if (mission.id === 2 && state.stage === 'deliver') return 'Deliver the package to the motel';
      return mission.objective;
    }
    if (state.fare) {
      return state.fare.stage === 'pickup' ? 'Pick up the fare (drive to the marker)' : 'Drive the fare to the destination';
    }
    return 'Free roam — a fare will show up soon';
  }

  function target() {
    const mission = current();
    if (mission) {
      if (mission.id === 2 && state.stage === 'deliver') return { ...mission.deliverAt, label: mission.deliverLabel };
      return { ...mission.target, label: mission.targetLabel };
    }
    if (state.fare) {
      return state.fare.stage === 'pickup'
        ? { ...state.fare.pickup, label: 'Fare' }
        : { ...state.fare.destination, label: 'Drop-off' };
    }
    return null;
  }

  /** Start a taxi fare: a rider waits at `pickup`, wants `destination`. */
  function startFare(pickup, destination, pay) {
    state.fare = { pickup, destination, pay, stage: 'pickup' };
  }

  function fareDone() {
    const pay = state.fare ? state.fare.pay : 0;
    state.fare = null;
    return pay;
  }

  /** Advance one step of the current mission; returns the payout when it completes. */
  function advance() {
    const mission = current();
    if (!mission) return 0;
    if (mission.id === 2 && state.stage === 'go') {
      state.stage = 'deliver';
      return 0;
    }
    const pay = MISSION_REWARDS[state.index];
    state.index += 1;
    state.stage = 'go';
    if (state.index >= MISSION_LIST.length) state.done = true;
    return pay;
  }

  function reset(index) {
    state.index = index;
    state.stage = 'go';
    state.done = index >= MISSION_LIST.length;
    state.fare = null;
  }

  return { state, current, objectiveText, target, startFare, fareDone, advance, reset };
}
