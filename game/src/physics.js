// The flight model and the run's state: an arcade bush-plane feel — throttle
// sets speed, pitch and roll steer, a banked turn, a stall under minimum speed,
// fuel that runs out, damage on a hard hit, rings to fly through and a runway
// to land on. Everything advances in fixed STEP slices so a staged screenshot
// is reproducible.
import { PLANE, RINGS, RUNWAY, SCORE, STEP } from './config.js';
import { clamp, lerp } from './random.js';
import { groundHeight, isOverLake, isOverRunway } from './terrain.js';

export const PHASE_TITLE = 'title';
export const PHASE_FLY = 'fly';
export const PHASE_PAUSED = 'paused';
export const PHASE_CRASHED = 'crashed';
export const PHASE_LANDED = 'landed';

export function createFlight() {
  const state = {
    phase: PHASE_TITLE,
    pos: { x: 0, y: RUNWAY.height + 2, z: RUNWAY.centre.z },
    heading: Math.PI / 2, // east, down the runway
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.tank,
    fuelWarned: false,
    damage: 0,
    gearDown: true,
    /** True once the plane has clearly left the ground; only then can a
     * touchdown count as a landing instead of a takeoff roll. */
    airborne: false,
    rings: 0,
    score: 0,
    elapsed: 0,
    simTime: 0,
    message: '',
    messageUntil: 0,
    verticalSpeed: 0,
    /** For the ring pass check: where the plane was last step. */
    prevPos: { x: 0, y: RUNWAY.height + 2, z: RUNWAY.centre.z },
    crashedReason: '',
    landedAt: 0,
  };

  function reset() {
    state.phase = PHASE_TITLE;
    state.pos = { x: 0, y: RUNWAY.height + 2, z: RUNWAY.centre.z };
    state.prevPos = { ...state.pos };
    state.heading = Math.PI / 2;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = PLANE.tank;
    state.fuelWarned = false;
    state.damage = 0;
    state.gearDown = true;
    state.airborne = false;
    state.rings = 0;
    state.score = 0;
    state.elapsed = 0;
    state.simTime = 0;
    state.message = '';
    state.messageUntil = 0;
    state.verticalSpeed = 0;
    state.crashedReason = '';
    state.landedAt = 0;
  }

  function say(text, seconds = 2.5) {
    state.message = text;
    state.messageUntil = state.simTime + seconds;
  }

  function crash(reason) {
    state.phase = PHASE_CRASHED;
    state.crashedReason = reason;
    state.speed = 0;
  }

  function land() {
    state.phase = PHASE_LANDED;
    state.landedAt = state.elapsed;
    const timeBonus = Math.max(0, SCORE.timeBonusWindow - state.elapsed) * SCORE.timeBonusRate;
    const fuelBonus = Math.round(state.fuel) * SCORE.fuelPerUnit;
    state.score += SCORE.landing + fuelBonus + Math.round(timeBonus);
    say(`Landed! +${SCORE.landing} landing, +${fuelBonus} fuel, +${Math.round(timeBonus)} time`, 6);
  }

  /**
   * One fixed step. `ctl` is { pitch, roll, yaw, throttle } with pitch/roll/yaw
   * in -1..1 and throttle a 0..1 target; `events` collects ring/crash signals.
   * Returns an events object the main loop turns into sound and HUD text.
   */
  function step(ctl, ringsApi) {
    const events = { ring: false, hit: false, crashed: false, landed: false, lowFuel: false };
    if (state.phase !== PHASE_FLY) return events;
    state.elapsed += STEP;
    state.simTime += STEP;
    state.prevPos = { ...state.pos };

    // Throttle: fuel out means the engine quits and the plane glides.
    if (state.fuel <= 0) {
      state.throttle = 0;
      if (!state.fuelWarned) {
        state.fuelWarned = true;
        events.lowFuel = true;
      }
    } else {
      state.throttle = clamp(ctl.throttle, 0, 1);
      state.fuel = Math.max(0, state.fuel - state.throttle * PLANE.fuelDrain * STEP);
    }

    // Attitude follows the stick with a little lag.
    state.roll = lerp(state.roll, ctl.roll * PLANE.maxRoll, 1 - Math.exp(-PLANE.rollRate * STEP));
    state.pitch = lerp(state.pitch, ctl.pitch * PLANE.maxPitch, 1 - Math.exp(-PLANE.pitchRate * STEP));

    // Speed chases the throttle's target; climbing bleeds it, diving gains it.
    // On the ground the plane only rolls with throttle; in the air an idle
    // engine still glides at a slow cruise.
    const groundNow = state.pos.y <= groundHeight(state.pos.x, state.pos.z) + 1.7;
    const target = groundNow
      ? state.throttle * PLANE.maxSpeed
      : state.throttle < 0.05
        ? 22
        : PLANE.idleSpeed + state.throttle * (PLANE.maxSpeed - PLANE.idleSpeed);
    const climbBleed = Math.max(0, Math.sin(state.pitch)) * 14;
    state.speed = lerp(state.speed, Math.max(0, target - climbBleed), 1 - Math.exp(-0.75 * STEP));
    if (groundNow && state.speed < 4 && state.throttle < 0.1) state.speed = 0;

    // A banked turn: heading follows the roll; the rudder adds a little.
    const turn = (state.roll * state.speed) / 58 + ctl.yaw * PLANE.yawRate * 0.35;
    state.heading += turn * STEP;

    // Vertical speed: the wing lifts with speed, stalls under stall speed.
    const lift = state.speed >= PLANE.stallSpeed ? 1 : state.speed / PLANE.stallSpeed;
    let vy = state.speed * Math.sin(state.pitch) * lift;
    if (state.speed < PLANE.stallSpeed && state.pitch > 0) vy -= (PLANE.stallSpeed - state.speed) * 0.18;
    state.verticalSpeed = vy;

    const fx = Math.sin(state.heading) * Math.cos(state.pitch);
    const fz = -Math.cos(state.heading) * Math.cos(state.pitch);
    state.pos.x += fx * state.speed * STEP;
    state.pos.z += fz * state.speed * STEP;
    state.pos.y += vy * STEP;

    // Stay inside the valley; the rim turns the plane back gently.
    const edge = Math.max(Math.abs(state.pos.x), Math.abs(state.pos.z));
    if (edge > 1150) {
      state.heading += Math.PI * STEP * 0.9;
      say('Turning back — the valley ends here', 2);
    }

    // Rings: crossing the next hoop's plane inside it scores.
    if (state.rings < RINGS.length && ringsApi.passedThrough(state.rings, state.prevPos, state.pos)) {
      ringsApi.markPassed(state.rings);
      state.rings += 1;
      state.score += SCORE.ring;
      events.ring = true;
      say(`Ring ${state.rings} of ${RINGS.length}! +${SCORE.ring}`, 2.5);
      if (state.rings === RINGS.length) say('All rings! Bring her home to the runway.', 4);
    }

    // Ground and water. A plane rolling on the ground is pinned to the
    // surface; only a touchdown after real flight is judged as a landing.
    const ground = groundHeight(state.pos.x, state.pos.z);
    const onRunway = isOverRunway(state.pos.x, state.pos.z);
    const wasAirborne = state.airborne;
    if (state.pos.y > ground + 6) state.airborne = true;
    if (state.pos.y <= ground + 1.6) {
      if (!wasAirborne) {
        state.pos.y = ground + 1.6;
        state.verticalSpeed = 0;
      } else {
        const hard = state.verticalSpeed < PLANE.landingSink || state.speed > PLANE.landingSpeed;
        if (onRunway && state.gearDown && !hard && state.speed > 8) {
          state.pos.y = RUNWAY.height + 1.6;
          state.airborne = false;
          land();
          events.landed = true;
        } else {
          state.damage += PLANE.hitDamage;
          events.hit = true;
          state.pos.y = ground + 1.6;
          state.speed *= 0.45;
          state.pitch = 0.25;
          state.airborne = false;
          say(state.damage >= 100 ? 'Crashed!' : `Hard hit! Damage ${Math.round(state.damage)}%`, 2.5);
          if (state.damage >= 100) {
            crash('the terrain');
            events.crashed = true;
          }
        }
      }
    } else if (isOverLake(state.pos.x, state.pos.z) && state.pos.y < 4) {
      state.damage = 100;
      crash('the lake');
      events.crashed = true;
      say('Ditched in the lake!', 3);
    }
    if (state.fuel <= 0 && state.phase === PHASE_FLY && state.speed < PLANE.stallSpeed && state.pos.y - ground < 30) {
      say('Out of fuel — glide her in!', 2);
    }
    return events;
  }

  return { state, reset, step, say, PHASE_TITLE };
}
