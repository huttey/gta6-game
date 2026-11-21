// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|street|mission|title (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED_FLAG, EVENT_MISSION_DONE, EVENT_WASTED_FLAG } from './world.js';
import { EVENT_CRASH, EVENT_HIT, EVENT_PICKUP, EVENT_SHOT } from './actors.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_NEW_GAME, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { clearSave, loadSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** No input at all: the title screen's living backdrop. */
const IDLE_INPUT = { move: () => ({ x: 0, y: 0 }), running: () => false, mouse: { x: 0, y: 0 } };

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { save: loadSave(), muted: false, flash: 0, showHints: false }, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = loadSave();
  let flash = 0;
  let showHints = true;
  let hintsTimer = 25;
  let justStarted = false;
  let accumulator = 0;
  let last = performance.now();

  const ui = {
    get save() {
      return save;
    },
    get muted() {
      return audio.isMuted();
    },
    get flash() {
      return flash;
    },
    get showHints() {
      return showHints;
    },
  };

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(newGame) {
    audio.ensure();
    if (newGame) {
      clearSave();
      save = null;
      world.reset(true);
    } else {
      world.reset(false);
      save = loadSave();
    }
    screen = SCREEN_PLAY;
    justStarted = true;
    const mission = world.missions.current();
    announce(mission ? `Playing. ${mission.name}.` : 'Playing. Free roam.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEW_GAME && save) startGame(true);
      else if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED) && (actions & ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function stepGame(actions, clicked) {
    const events = world.step(STEP, input, renderer.viewToWorld, actions, clicked);
    const p = world.actors.player;
    if (events & EVENT_HIT) flash = 1;
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_MISSION_DONE) audio.jingle();
    if (events & EVENT_BUSTED_FLAG) {
      audio.busted();
      screen = SCREEN_BUSTED;
      save = loadSave();
      announce('Busted. The cops took their cut.');
    } else if (events & EVENT_WASTED_FLAG) {
      audio.busted();
      screen = SCREEN_WASTED;
      save = loadSave();
      announce('Wasted. Rico wakes at the hospital.');
    }
    audio.engine(p.inCar ? Math.abs(p.inCar.speed) / 520 : 0);
    audio.siren(p.wanted > 0, STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const clicked = input.takeClick();
    handleActions(actions);
    accumulator += dt;
    if (flash > 0) flash = Math.max(0, flash - dt);
    if (showHints) {
      hintsTimer -= dt;
      if (hintsTimer <= 0) showHints = false;
    }
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, IDLE_INPUT, renderer.viewToWorld, 0, false);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      // One-shot presses fire once, on the first fixed step of the frame.
      let actionsLeft = actions;
      let clickLeft = justStarted ? false : clicked;
      while (accumulator >= STEP) {
        stepGame(actionsLeft, clickLeft);
        actionsLeft = 0;
        clickLeft = false;
        justStarted = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      audio.engine(0);
      audio.siren(false, STEP);
    }
    renderer.draw(world, screen, ui, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
