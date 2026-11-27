// The screenshot scenes behind ?shot=cover|ring|landing|title (with &seed=N).
// Each one plays the real rules forward from a fresh run, steered by a simple
// autopilot that banks toward the next ring and pitches for its height, so the
// frame is what real play looks like and the same seed always gives the same
// frame. The cover catches the plane mid-course with a ring ahead over the
// lake valley; the ring shot stops just short of a hoop; the landing shot is
// a short final to the runway; the title parks on the runway under the menu.
import { PLANE, RINGS, RUNWAY, STEP } from './config.js';
import { clamp } from './random.js';
import { PHASE_FLY, PHASE_TITLE } from './physics.js';

function autopilotTo(state, target, throttle) {
  const dx = target.x - state.pos.x;
  const dy = target.y - state.pos.y;
  const dz = target.z - state.pos.z;
  const desiredHeading = Math.atan2(dx, -dz);
  let err = desiredHeading - state.heading;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  const roll = clamp(err * 1.4, -1, 1);
  const desiredPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 1.6, -0.35, 0.45);
  const pitch = clamp((desiredPitch - state.pitch) * 2.4, -1, 1);
  return { pitch, roll, yaw: 0, throttle };
}

function autopilotRing(state) {
  const target = RINGS[Math.min(state.rings, RINGS.length - 1)];
  return autopilotTo(state, target, 0.78);
}

/** Fly forward until `stop` returns true or `maxSeconds` pass. */
function flyFor(flight, ringsApi, ctlFor, stop, maxSeconds) {
  const limit = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    const ctl = ctlFor(flight.state);
    flight.step(ctl, ringsApi);
    if (flight.state.phase !== PHASE_FLY) break;
    if (stop(flight.state)) break;
  }
}

function distTo(state, target) {
  return Math.hypot(target.x - state.pos.x, target.y - state.pos.y, target.z - state.pos.z);
}

/**
 * Set the flight to the named scene and return the screen to draw over it.
 * The caller paints the scene twice and then sets window.__shotReady.
 */
export function stageShot(name, flight, ringsApi) {
  flight.reset();
  const state = flight.state;
  if (name === 'landing') {
    // Short final: eastbound down the runway centreline, gear down, low.
    // The start is inside the flattened airfield plate so the ground is the
    // runway height, not a hillside.
    state.phase = PHASE_FLY;
    state.pos = { x: -260, y: 42, z: RUNWAY.centre.z };
    state.prevPos = { ...state.pos };
    state.heading = Math.PI / 2;
    state.pitch = -0.05;
    state.roll = 0;
    state.speed = 28;
    state.throttle = 0.3;
    state.gearDown = true;
    state.rings = RINGS.length;
    state.score = RINGS.length * 1000;
    ringsApi.setNext(RINGS.length);
    flyFor(
      flight,
      ringsApi,
      () => ({ pitch: -0.1, roll: 0, yaw: 0, throttle: 0.28 }),
      (s) => s.pos.x > -120,
      8,
    );
    return { screen: 'fly', camera: 'chase' };
  }
  if (name === 'ring') {
    state.phase = PHASE_FLY;
    state.throttle = 0.78;
    flyFor(
      flight,
      ringsApi,
      autopilotRing,
      (s) => s.rings >= 2 && distTo(s, RINGS[2]) < 46,
      60,
    );
    return { screen: 'fly', camera: 'chase' };
  }
  if (name === 'title') {
    state.phase = PHASE_TITLE;
    state.pos = { x: 30, y: RUNWAY.height + 2, z: RUNWAY.centre.z };
    state.prevPos = { ...state.pos };
    state.heading = Math.PI / 2;
    state.throttle = 0.12;
    return { screen: 'title', camera: 'title' };
  }
  // cover: fly the course until two rings are banked, then press on a little
  // so the passed hoop is behind the camera and the next one is ahead.
  state.phase = PHASE_FLY;
  state.throttle = 0.78;
  flyFor(flight, ringsApi, autopilotRing, (s) => s.rings >= 2 && distTo(s, RINGS[1]) > 90, 40);
  return { screen: 'fly', camera: 'chase' };
}
