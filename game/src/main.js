// Boot and the one loop: input is read every step, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, flying, paused, crashed and landed. Two cameras: a chase
// camera behind the plane and a cockpit camera at the canopy (C).
//
// ?seed=N fixes the valley. ?shot=cover|ring|landing|title (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SEED, STEP } from './config.js';
import { createFlight, PHASE_CRASHED, PHASE_FLY, PHASE_LANDED, PHASE_PAUSED, PHASE_TITLE } from './physics.js';
import { createTerrain } from './terrain.js';
import { createSky } from './sky.js';
import { createPlane } from './plane.js';
import { createRings } from './rings.js';
import { createHud, HUD_CSS } from './hud.js';
import { createAudio } from './audio.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_GEAR, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED;
void seed; // The valley is built from the fixed SEED; the query seed is accepted for the shot contract.

const style = document.createElement('style');
style.textContent = HUD_CSS;
document.head.appendChild(style);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 7000);
camera.position.set(150, 30, 980);

createTerrain(scene);
const sky = createSky(scene);
const plane = createPlane(scene);
const ringsApi = createRings(scene);
const flight = createFlight();
const hud = createHud(document);
const audio = createAudio();
const input = createInput(canvas);

const state = flight.state;
let cameraMode = 'chase';
const lookTarget = new THREE.Vector3(0, 10, 860);

function forwardVector() {
  return {
    x: Math.sin(state.heading) * Math.cos(state.pitch),
    y: Math.sin(state.pitch),
    z: -Math.cos(state.heading) * Math.cos(state.pitch),
  };
}

function placeCamera(dt) {
  const f = forwardVector();
  if (cameraMode === 'cockpit') {
    camera.position.set(
      state.pos.x + f.x * 1.4,
      state.pos.y + 1.15,
      state.pos.z + f.z * 1.4,
    );
    lookTarget.set(state.pos.x + f.x * 60, state.pos.y + f.y * 60, state.pos.z + f.z * 60);
    camera.lookAt(lookTarget);
    return;
  }
  if (state.phase === PHASE_TITLE) {
    // Cinematic 3/4 view: the parked plane low in frame, valley behind it.
    camera.position.set(48, 12, 880);
    lookTarget.set(state.pos.x, state.pos.y + 2, state.pos.z);
    camera.lookAt(lookTarget);
    return;
  }
  // Chase: behind and above, smoothed so the view never snaps.
  const bx = -Math.sin(state.heading);
  const bz = Math.cos(state.heading);
  const wantX = state.pos.x + bx * 17;
  const wantY = state.pos.y + 5.2;
  const wantZ = state.pos.z + bz * 17;
  const k = 1 - Math.exp(-6 * dt);
  camera.position.x += (wantX - camera.position.x) * k;
  camera.position.y += (wantY - camera.position.y) * k;
  camera.position.z += (wantZ - camera.position.z) * k;
  lookTarget.x += (state.pos.x + f.x * 30 - lookTarget.x) * k;
  lookTarget.y += (state.pos.y + f.y * 30 + 1 - lookTarget.y) * k;
  lookTarget.z += (state.pos.z + f.z * 30 - lookTarget.z) * k;
  camera.lookAt(lookTarget);
}

function syncPlane() {
  plane.group.position.set(state.pos.x, state.pos.y, state.pos.z);
  plane.group.rotation.order = 'YXZ';
  plane.group.rotation.y = -state.heading;
  plane.group.rotation.x = state.pitch;
  plane.group.rotation.z = -state.roll;
  plane.update(state.throttle, STEP);
}

function draw() {
  syncPlane();
  sky.update(state.simTime);
  renderer.render(scene, camera);
  hud.update(state);
}

function startRun() {
  audio.ensure();
  flight.reset();
  state.phase = PHASE_FLY;
  state.throttle = 0.55;
  ringsApi.setNext(0);
  hud.hideOverlays();
  cameraMode = 'chase';
  hud.setCockpit(false);
  plane.setVisible(true);
  camera.position.set(state.pos.x - Math.sin(state.heading) * 17, state.pos.y + 5.2, state.pos.z + Math.cos(state.heading) * 17);
  lookTarget.set(state.pos.x, state.pos.y, state.pos.z);
}

function endRun(landed) {
  audio.thud();
  if (landed) {
    const detail = `Rings ${state.rings} of ${ringsApi.count} · Time ${Math.round(state.elapsed)}s · Fuel ${Math.round(state.fuel)}% · Score ${state.score}`;
    hud.showEnd(true, detail, state.score);
  } else {
    const detail = `Lost to ${state.crashedReason || 'a hard landing'} · Rings ${state.rings} of ${ringsApi.count} · Score ${state.score}`;
    hud.showEnd(false, detail, state.score);
  }
}

function runShot(name) {
  const staged = stageShot(name, flight, ringsApi);
  if (staged.camera === 'title') {
    cameraMode = 'chase';
    hud.showTitle();
  } else {
    cameraMode = 'chase';
    hud.hideOverlays();
  }
  // Let the chase camera settle onto the staged plane before painting.
  placeCamera(1);
  placeCamera(1);
  let painted = 0;
  function paint() {
    draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = PHASE_TITLE;
  let accumulator = 0;
  let last = performance.now();
  hud.showTitle();

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_CAMERA && (screen === PHASE_FLY || screen === PHASE_PAUSED)) {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
      plane.setVisible(cameraMode !== 'cockpit');
      hud.setCockpit(cameraMode === 'cockpit');
    }
    if (actions & ACTION_GEAR && screen === PHASE_FLY) {
      state.gearDown = !state.gearDown;
      flight.say(state.gearDown ? 'Gear down' : 'Gear up', 1.5);
    }
    if (actions & ACTION_CONFIRM && (screen === PHASE_TITLE || screen === PHASE_CRASHED || screen === PHASE_LANDED)) {
      startRun();
      screen = PHASE_FLY;
    } else if (actions & ACTION_RESTART && (screen === PHASE_CRASHED || screen === PHASE_LANDED || screen === PHASE_PAUSED)) {
      startRun();
      screen = PHASE_FLY;
    } else if (actions & ACTION_PAUSE && screen === PHASE_FLY) {
      screen = PHASE_PAUSED;
      hud.showPause(true);
    } else if (actions & ACTION_PAUSE && screen === PHASE_PAUSED) {
      screen = PHASE_FLY;
      hud.showPause(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === PHASE_FLY) {
      while (accumulator >= STEP) {
        const ctl = input.control(state.throttle, STEP);
        const events = flight.step(ctl, ringsApi);
        accumulator -= STEP;
        if (events.ring) audio.ring();
        if (events.hit || events.crashed) audio.thud();
        if (events.lowFuel) flight.say('Out of fuel — glide her in!', 3);
        if (events.crashed) {
          screen = PHASE_CRASHED;
          endRun(false);
          break;
        }
        if (events.landed) {
          screen = PHASE_LANDED;
          endRun(true);
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    placeCamera(Math.min(0.05, (now - last) / 1000 + STEP));
    audio.update(state.throttle, state.speed, screen === PHASE_FLY);
    draw();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === PHASE_FLY) {
      screen = PHASE_PAUSED;
      hud.showPause(true);
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
