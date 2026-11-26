// The screenshot scenes behind ?shot=cover|race|landing|ferry. Each one stages a real
// flight state (a real position, speed, fuel, mission progress and ring layout) and the
// renderer paints it, so the frame is what the game really looks like mid-flight and the
// same seed always gives the same frame.
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function stage(flight, mission, plane) {
  flight.reset(mission, mission.start);
  Object.assign(flight.plane, plane);
  flight.plane.onGround = plane.y <= 0.5;
  flight.plane.airborne = plane.y > 8;
}

export function stageShot(name, flight, missionFor) {
  if (name === 'race') {
    const mission = missionFor(0);
    stage(flight, mission, {
      x: 1500, y: 360, z: -1400, heading: 1.15, pitch: -0.02, bank: 0.55,
      speed: 78, throttle: 0.85, fuel: 71, damage: 0,
    });
    flight.state.ringsPassed = 1;
    flight.state.score = 100;
    flight.state.elapsed = 58;
    flight.state.messages.push({ text: 'CINCIN 1/6  +100', at: 58 });
    return { screen: SCREEN_PLAY, mission };
  }
  if (name === 'landing') {
    const mission = missionFor(1);
    stage(flight, mission, {
      x: -780, y: 95, z: 6200, heading: -0.03, pitch: -0.06, bank: 0.03,
      speed: 42, throttle: 0.3, fuel: 58, damage: 6, flaps: true,
    });
    flight.state.elapsed = 132;
    flight.state.messages.push({ text: 'FINAL  FLAPS TURUN  JAGA KECEPATAN', at: 132 });
    return { screen: SCREEN_PLAY, mission };
  }
  if (name === 'ferry') {
    const mission = missionFor(2);
    stage(flight, mission, {
      x: 2900, y: 290, z: -1400, heading: 1.05, pitch: 0.01, bank: -0.08,
      speed: 58, throttle: 0.42, fuel: 21, damage: 0,
    });
    flight.state.elapsed = 178;
    flight.state.messages.push({ text: 'SURAT DI BAGASI  MENUJU KABUT', at: 178 });
    return { screen: SCREEN_PLAY, mission };
  }
  // Cover: the hero frame. Chase view over the sea, Merak and its runway behind the
  // plane, the first gold ring dead ahead, instruments lit, HUD complete.
  const mission = missionFor(0);
  stage(flight, mission, {
    x: 400, y: 300, z: -450, heading: 1.0, pitch: -0.01, bank: 0.12,
    speed: 68, throttle: 0.72, fuel: 84, damage: 0,
  });
  flight.state.ringsPassed = 0;
  flight.state.score = 0;
  flight.state.elapsed = 21;
  flight.state.messages.push({ text: 'CINCIN 1 DI DEPAN', at: 21 });
  return { screen: SCREEN_PLAY, mission };
}
