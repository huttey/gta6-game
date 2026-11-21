// Every tuning number and colour in one place. Solmar is a sun-soaked coastal city,
// 3600 by 2400, seen top-down through a camera that follows the player. The renderer
// paints a 1280x720 window of it; no rule below depends on the screen size.

export const STEP = 1 / 60;
export const WORLD = { width: 3600, height: 2400 };
export const VIEW = { width: 1280, height: 720 };

/** Roads run on a grid; blocks between them hold buildings, parks and lots. */
export const ROADS_X = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_Y = [300, 900, 1500, 2100];
export const ROAD_W = 120;

/** South strip: sand then sea. East strip: the docks. */
export const BEACH = { y: 2220, sandH: 60, seaY: 2280 };
export const DOCKS = { x: 3450 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 170,
  runSpeed: 260,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchArc: 1.1,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 700,
  reverseAccel: 240,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  grip: 6.0,
  hp: 100,
  colours: ['#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e8e8e8', '#2c3e50', '#e67e22'],
  policeColour: '#1c2733',
  taxiColour: '#f1c40f',
};

export const PED = {
  radius: 11,
  walkSpeed: 55,
  fleeSpeed: 150,
  colours: ['#e74c3c', '#3498db', '#2ecc71', '#f5d76e', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c'],
};

export const POLICE = {
  footSpeed: 175,
  carSpeed: 480,
  catchTime: 1.2,
  carCatchTime: 2.5,
  bustRadius: 30,
  sight: 520,
};

export const WANTED = {
  max: 5,
  decaySeconds: 25,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  copCarPerStar: 1,
  footCopPerStar: 1,
};

export const WEAPON = {
  pistolDamage: 34,
  pistolRange: 520,
  pistolCooldown: 0.28,
  startAmmo: 24,
  ammoPickup: 12,
};

export const MISSION_REWARDS = [150, 300, 250, 500, 800];

export const PALETTE = {
  backdrop: '#0d1b2e',
  grass: '#4d8f4a',
  grassDark: '#3f7d3e',
  sand: '#e8d29a',
  sea: '#1f6fb2',
  seaDeep: '#155a94',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#8a8f98',
  buildingRoof: ['#b5654a', '#7a6a8a', '#4a7a8a', '#8a6a4a', '#5a6a4a', '#9a4a5a', '#6a5a7a', '#c08a3a'],
  buildingEdge: '#2c2f36',
  park: '#3e7d44',
  player: '#ffd23e',
  playerJacket: '#f2c230',
  cop: '#2b6cb0',
  copCar: '#1c2733',
  gang: '#8e2f2f',
  marker: '#ff5fa2',
  panel: '#141a26',
  panelEdge: '#2a3347',
  text: '#f2f5f8',
  muted: '#9aa5b5',
  cash: '#7be382',
  health: '#ff5a5a',
  wanted: '#ffcf3d',
  minimapRoad: '#5a5f6a',
  minimapWater: '#1f6fb2',
  minimapPark: '#2e6b34',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';
