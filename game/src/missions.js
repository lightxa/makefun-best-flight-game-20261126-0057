// The three missions: each one sets the start, the rings or the destination runway,
// and how its score is counted. A mission is a plain object the flight model reads.
import { ISLANDS, MISSIONS } from './config.js';

function islandById(id) { return ISLANDS.find((i) => i.id === id); }

function ringAt(x, y, z, radius) { return { x, y, z, radius }; }

/** Six golden rings in a tight loop around Merak and Batu Layar, altitudes a mail plane can hold. */
function raceRings() {
  return [
    ringAt(900, 380, -700, 42),
    ringAt(2000, 380, -1400, 42),
    ringAt(2600, 400, 400, 46),
    ringAt(1600, 360, 1600, 42),
    ringAt(400, 340, 2200, 42),
    ringAt(0, 380, -100, 46),
  ];
}

function startOnRunway(islandId) {
  const island = islandById(islandId);
  const r = island.runway;
  const cx = island.x + r.x;
  const cz = island.z + r.z;
  const back = r.length / 2 - 60;
  // Start behind the threshold, facing down the runway like the plane's forward vector.
  return {
    x: cx - Math.sin(r.heading) * back,
    y: 0,
    z: cz + Math.cos(r.heading) * back,
    heading: r.heading,
  };
}

/** Build the runtime mission object for mission index 0..2. */
export function buildMission(index) {
  const def = MISSIONS[index];
  if (def.id === 'race') {
    return {
      ...def,
      start: startOnRunway('merak'),
      rings: raceRings(),
      target: { x: 900, z: -700, name: 'Cincin 1' },
      briefing: 'Lepas landas dari Merak, terbang melewati 6 cincin emas. Waktu berjalan.',
    };
  }
  if (def.id === 'landing') {
    const dest = islandById('karang');
    return {
      ...def,
      start: startOnRunway('merak'),
      rings: null,
      target: { x: dest.x, z: dest.z, name: 'Runway Karang Selatan' },
      destination: dest,
      briefing: 'Terbang ke selatan menuju Karang Selatan. Final pelan, flaps turun, sentuh zona hijau.',
    };
  }
  const dest = islandById('kabut');
  const strip = dest.runway;
  return {
    ...def,
    start: startOnRunway('merak'),
    rings: null,
    target: { x: dest.x + strip.x, z: dest.z + strip.z, name: 'Landasan Rumput Kabut' },
    destination: dest,
    briefing: '40 kg surat untuk Kabut. Bahan bakar 42 unit saja: throttle rendah, rute lurus, jangan berputar.',
  };
}

/** Distance in metres from the plane to the mission target. */
export function distanceToTarget(plane, mission) {
  const dx = plane.x - mission.target.x;
  const dz = plane.z - mission.target.z;
  return Math.round(Math.sqrt(dx * dx + dz * dz));
}

/** Landing score: centreline error, vertical speed and fuel left all count. */
export function landingScore(plane, runwayInfo, mission, flight) {
  const across = Math.abs(runwayInfo.across);
  const centre = Math.max(0, 100 - across * 1.6);
  const vs = Math.max(0, 100 + plane.verticalSpeed * 22);
  const fuelBonus = Math.round(plane.fuel * 0.6);
  const total = Math.round(centre * 0.5 + vs * 0.3 + fuelBonus);
  return { centre: Math.round(centre), vs: Math.round(vs), fuelBonus, total };
}

/** Ferry score: what is left in the tank, plus a time bonus. */
export function ferryScore(plane, mission, flight) {
  const fuelBonus = Math.round(plane.fuel * 12);
  const timeBonus = Math.max(0, Math.round((mission.timeLimit - flight.state.elapsed) * 0.5));
  return { fuelBonus, timeBonus, total: fuelBonus + timeBonus };
}

/** Race score: rings plus the time still on the clock. */
export function raceScore(flight, mission) {
  const timeBonus = Math.max(0, Math.round(flight.state.timeLeft * 1.5));
  return { rings: flight.state.ringsPassed * 100, timeBonus, total: flight.state.ringsPassed * 100 + timeBonus };
}

export { MISSIONS };
