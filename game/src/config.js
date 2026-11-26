// Every tuning number, colour and place in one place. Kestrel Airmail is a 1962 island
// airmail game: one high-wing mail plane, three islands, three missions. The playfield is a
// real map in metres (x east, z south, y up); the renderer projects it with a chase camera,
// so no rule below depends on the screen size.
export const STEP = 1 / 60;
export const FIELD = { width: 1280, height: 720 };

export const PLANE = {
  name: 'Kestrel K-4 Merpati Pos',
  registration: 'PK-KST',
  maxSpeed: 96, // m/s, about 186 kt
  cruiseSpeed: 72,
  stallSpeed: 27, // m/s, 22 with flaps down
  flapStallSpeed: 21,
  accel: 14, // m/s per s toward the throttle target speed
  maxBank: 0.95, // rad
  bankRate: 2.2,
  maxPitch: 0.38, // rad
  pitchRate: 1.6,
  climbPenalty: 0.55, // speed lost per rad of climb, per second
  fuelCapacity: 100,
  burnIdle: 0.08, // fuel units per second at idle
  burnFull: 0.55, // quadratic throttle term: burn is idle + burnFull * throttle^2, so
  // a steady economy cruise sips fuel and full throttle drinks it: the ferry
  // mission is won by flying slow and straight, not by firewalling the lever.
};

export const ISLANDS = [
  {
    id: 'merak', name: 'Tanjung Merak', x: 0, z: 0, radius: 950, peak: 130,
    runway: { x: -120, z: 60, heading: Math.PI / 2, length: 720, width: 46 },
    town: 'Merak Town',
  },
  {
    id: 'kabut', name: 'Pulau Kabut', x: 5400, z: -2700, radius: 720, peak: 210,
    runway: { x: 0, z: 350, heading: Math.PI / 2, length: 620, width: 42 },
    town: 'Kabut Village',
  },
  {
    id: 'karang', name: 'Karang Selatan', x: -900, z: 5400, radius: 820, peak: 55,
    runway: { x: 0, z: 0, heading: 0, length: 680, width: 46 },
    town: 'Karang Selatan',
  },
  { id: 'layar', name: 'Batu Layar', x: 2700, z: 1900, radius: 260, peak: 45, runway: null, town: '' },
  { id: 'api', name: 'Karang Api', x: -3400, z: -1900, radius: 320, peak: 95, runway: null, town: '' },
];

export const MISSIONS = [
  {
    id: 'race', number: 1, name: 'Lomba Cincin Merak',
    goal: 'Terbang melewati 6 cincin emas mengelilingi kepulauan secepat mungkin.',
    detail: 'Setiap cincin +100 poin. Belokan tajam menguras kecepatan, jadi atur throttle dan bank dengan disiplin.',
    timeLimit: 240, fuelStart: 100,
  },
  {
    id: 'landing', number: 2, name: 'Pendaratan Karang Selatan',
    goal: 'Terbang dari Tanjung Merak dan mendarat mulus di runway Karang Selatan.',
    detail: 'Turunkan flaps (F) saat final. Pendaratan kasar merusak pesawat; sentuh zona hijau di tengah runway untuk skor tertinggi.',
    timeLimit: 300, fuelStart: 100,
  },
  {
    id: 'ferry', number: 3, name: 'Pos Hemat ke Pulau Kabut',
    goal: 'Antar 40 kg surat ke Pulau Kabut dengan bahan bakar terbatas.',
    detail: 'Bahan bakar hanya 42 unit dan tidak ada isi ulang di udara. Terbang hemat: throttle rendah, lurus, dan manfaatkan luncuran.',
    timeLimit: 360, fuelStart: 42,
  },
];

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#e8d9a8',
  sun: '#fff3c4',
  seaNear: '#1d6f8e',
  seaFar: '#7fb8cf',
  seaDeep: '#155a75',
  sand: '#e3cd96',
  grass: '#5d8a4a',
  grassDark: '#476b38',
  hill: '#7a9a58',
  rock: '#8d8578',
  runway: '#3a3f45',
  runwayMark: '#f2ede0',
  ring: '#f2b705',
  ringDone: '#3fae5a',
  planeCream: '#f4ead2',
  planeRed: '#b3372c',
  planeDark: '#5a4632',
  hudPanel: 'rgba(12, 24, 38, 0.72)',
  hudText: '#f4f1e4',
  hudAmber: '#ffcf4d',
  hudGreen: '#7ddb8a',
  hudRed: '#ff6b5e',
  cloud: 'rgba(255, 255, 255, 0.85)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'kestrel-airmail.best';
export const SHOT_SEED = 1962;
