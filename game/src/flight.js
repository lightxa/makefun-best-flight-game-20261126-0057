// The flight model, with no drawing and no browser in it: position, heading, pitch,
// bank, speed, throttle, fuel and damage. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react without the model knowing screens.
import { ISLANDS, PLANE } from './config.js';

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASH = 4;
export const EVENT_FUEL_EMPTY = 8;
export const EVENT_DAMAGE = 16;
export const EVENT_TOUCHDOWN_HARD = 32;

const GRAVITY = 9.81;
const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

export function createFlight() {
  const plane = {
    x: 0, y: 0, z: 0, heading: Math.PI / 2, pitch: 0, bank: 0,
    speed: 0, throttle: 0, fuel: PLANE.fuelCapacity, damage: 0,
    flaps: false, onGround: true, verticalSpeed: 0, airborne: false,
  };
  const state = {
    plane, ringsPassed: 0, score: 0, elapsed: 0, timeLeft: 0,
    messages: [], lastRingAt: 0,
  };

  function reset(mission, start) {
    plane.x = start.x; plane.y = start.y; plane.z = start.z;
    plane.heading = start.heading; plane.pitch = 0; plane.bank = 0;
    plane.speed = 0; plane.throttle = mission.id === 'ferry' ? 0 : 0;
    plane.fuel = mission.fuelStart; plane.damage = 0;
    plane.flaps = false; plane.onGround = start.y <= 0.5; plane.airborne = false;
    plane.verticalSpeed = 0;
    state.ringsPassed = 0; state.score = 0; state.elapsed = 0;
    state.timeLeft = mission.timeLimit; state.messages = []; state.lastRingAt = 0;
  }

  function islandAt(x, z) {
    for (const island of ISLANDS) {
      const dx = x - island.x;
      const dz = z - island.z;
      if (dx * dx + dz * dz < island.radius * island.radius) return island;
    }
    return null;
  }

  function runwayAt(x, z) {
    for (const island of ISLANDS) {
      const r = island.runway;
      if (!r) continue;
      const dx = x - (island.x + r.x);
      const dz = z - (island.z + r.z);
      // Runway along-vector matches the plane's forward vector: (sin h, -cos h).
      const along = dx * Math.sin(r.heading) - dz * Math.cos(r.heading);
      const across = dx * Math.cos(r.heading) + dz * Math.sin(r.heading);
      if (Math.abs(along) < r.length / 2 && Math.abs(across) < r.width / 2) {
        return { island, runway: r, along, across };
      }
    }
    return null;
  }

  function groundHeight(x, z) {
    // The airfield is a flat plateau: no hill may poke through a runway.
    for (const island of ISLANDS) {
      const r = island.runway;
      if (!r) continue;
      const dx = x - (island.x + r.x);
      const dz = z - (island.z + r.z);
      const along = dx * Math.sin(r.heading) - dz * Math.cos(r.heading);
      const across = dx * Math.cos(r.heading) + dz * Math.sin(r.heading);
      if (Math.abs(along) < r.length / 2 + 260 && Math.abs(across) < r.width / 2 + 260) return 4;
    }
    const island = islandAt(x, z);
    if (!island) return 0;
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz) / island.radius;
    if (d > 0.92) return 2;
    return island.peak * (1 - d * d) * 0.9 + 2;
  }

  /** Advance one fixed step. `control` is {throttle, pitch, bank} in -1..1. */
  function step(dt, control, mission) {
    let events = 0;
    state.elapsed += dt;
    state.timeLeft = Math.max(0, mission.timeLimit - state.elapsed);
    plane.throttle = Math.min(1, Math.max(0, plane.throttle + control.throttle * dt * 0.55));
    // Fuel always costs: idle burn plus a quadratic throttle term, so a steady
    // economy cruise sips fuel and full throttle drinks it. Empty tank means gliding only.
    const burn = (PLANE.burnIdle + plane.throttle * plane.throttle * PLANE.burnFull) * dt;
    if (plane.fuel > 0) {
      plane.fuel = Math.max(0, plane.fuel - burn);
      if (plane.fuel === 0) events |= EVENT_FUEL_EMPTY;
    }
    const effectiveThrottle = plane.fuel > 0 ? plane.throttle : 0;
    const targetSpeed = effectiveThrottle * PLANE.maxSpeed;
    const drag = 1 + Math.abs(plane.bank) * 0.9 + (plane.flaps ? 0.55 : 0);
    plane.speed += (targetSpeed - plane.speed) * Math.min(1, (PLANE.accel / PLANE.maxSpeed) * dt * drag * 2.2);
    if (plane.speed < 0) plane.speed = 0;
    // Bank toward the stick, then turn at a rate the bank earns.
    const bankTarget = control.bank * PLANE.maxBank;
    plane.bank += (bankTarget - plane.bank) * Math.min(1, PLANE.bankRate * dt);
    const turnRate = (GRAVITY * Math.tan(plane.bank)) / Math.max(plane.speed, 12);
    plane.heading += turnRate * dt;
    // Pitch toward the stick; climb costs speed, diving gains a little.
    const pitchTarget = -control.pitch * PLANE.maxPitch;
    plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, PLANE.pitchRate * dt);
    plane.speed -= Math.sin(plane.pitch) * PLANE.climbPenalty * plane.speed * dt * 0.12;
    const stall = plane.flaps ? PLANE.flapStallSpeed : PLANE.stallSpeed;
    const flying = plane.speed > stall || !plane.onGround;
    void flying;
    const climb = Math.sin(plane.pitch) * plane.speed;
    const liftLoss = plane.speed < stall ? (stall - plane.speed) * 0.55 : 0;
    plane.verticalSpeed = climb - liftLoss;
    const forwardX = Math.sin(plane.heading) * Math.cos(plane.pitch);
    const forwardZ = -Math.cos(plane.heading) * Math.cos(plane.pitch);
    plane.x += forwardX * plane.speed * dt;
    plane.z += forwardZ * plane.speed * dt;
    plane.y += plane.verticalSpeed * dt;
    if (plane.y < 0) plane.y = 0;

    // Rings: crossing the ring's plane inside its radius scores.
    if (mission.rings) {
      const ring = mission.rings[state.ringsPassed];
      if (ring) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.y;
        const dz = plane.z - ring.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < ring.radius) {
          state.ringsPassed += 1;
          state.score += 100;
          state.lastRingAt = state.elapsed;
          state.messages.push({ text: `CINCIN ${state.ringsPassed}/${mission.rings.length}  +100`, at: state.elapsed });
          events |= EVENT_RING;
        }
      }
    }

    // Ground contact: runway landing, rough landing, or a crash into terrain or sea.
    const ground = groundHeight(plane.x, plane.z);
    if (plane.y <= ground + 0.5) {
      const stallNow = plane.flaps ? PLANE.flapStallSpeed : PLANE.stallSpeed;
      if (plane.verticalSpeed > 0.5 && plane.speed > stallNow) {
        // Lifting off: enough speed and a climbing attitude leaves the ground.
        plane.onGround = false;
        plane.airborne = true;
        plane.y = ground + 0.6;
        return events;
      }
      const runway = runwayAt(plane.x, plane.z);
      const vs = -plane.verticalSpeed;
      plane.y = ground;
      if (plane.airborne) {
        if (runway && vs < 6.5 && Math.abs(plane.bank) < 0.35 && plane.speed < 62) {
          plane.onGround = true;
          plane.airborne = false;
          events |= EVENT_LANDED;
        } else if (vs < 6.5 && Math.abs(plane.bank) < 0.35 && plane.speed < 62) {
          // A gentle touchdown on grass or a beach: survivable, but it costs paint.
          // It still counts as a landing (the mission decides whether it counts).
          plane.onGround = true;
          plane.airborne = false;
          plane.damage = Math.min(100, plane.damage + 10);
          state.messages.push({ text: 'MENDARAT DI LUAR RUNWAY  kerusakan +10', at: state.elapsed });
          events |= EVENT_LANDED | EVENT_TOUCHDOWN_HARD | EVENT_DAMAGE;
        } else if (vs < 11 && plane.speed < 70) {
          plane.onGround = true;
          plane.airborne = false;
          plane.damage = Math.min(100, plane.damage + 22);
          state.messages.push({ text: 'PENDARATAN KASAR  kerusakan +22', at: state.elapsed });
          events |= EVENT_TOUCHDOWN_HARD | EVENT_DAMAGE;
        } else {
          plane.damage = Math.min(100, plane.damage + 45);
          plane.speed *= 0.35;
          plane.verticalSpeed = 0;
          // A crash puts the plane down: it rests here and takes no more hits
          // from the same impact. It may take off again, carrying the damage.
          plane.onGround = true;
          plane.airborne = false;
          state.messages.push({ text: runway ? 'TERLALU KERAS  kerusakan +45' : 'MENABRAK TANAH  kerusakan +45', at: state.elapsed });
          events |= EVENT_CRASH | EVENT_DAMAGE;
          if (plane.damage >= 100) plane.onGround = true;
        }
      } else {
        plane.onGround = true;
      }
      if (plane.onGround && plane.speed > 0) {
        // Rolling resistance is light at power, heavy when the throttle is closed.
        plane.speed = Math.max(0, plane.speed - (plane.throttle < 0.15 ? 26 : 4) * dt);
      }
    } else {
      plane.onGround = false;
      if (plane.y > 8) plane.airborne = true;
    }
    if (plane.damage >= 100) events |= EVENT_CRASH;
    return events;
  }

  function knots() { return Math.round(plane.speed * MS_TO_KT); }
  function feet() { return Math.round(plane.y * M_TO_FT); }
  function headingDegrees() { return Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360); }

  return {
    state, plane, reset, step, islandAt, runwayAt, groundHeight,
    knots, feet, headingDegrees,
  };
}
