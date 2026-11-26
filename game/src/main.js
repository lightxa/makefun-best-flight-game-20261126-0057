// Boot and the one loop: input is read every frame, the flight model advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between four screens: title, play, paused and over.
// Missions are picked on the title screen with keys 1, 2 or 3.
//
// ?seed=N fixes the clouds and palms. ?shot=cover|race|landing|ferry (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SHOT_SEED, STEP } from './config.js';
import { createRandom } from './random.js';
import { createFlight, EVENT_CRASH, EVENT_FUEL_EMPTY, EVENT_LANDED, EVENT_RING, EVENT_TOUCHDOWN_HARD } from './flight.js';
import { makeClouds, makePalms } from './terrain.js';
import { buildMission, distanceToTarget, ferryScore, landingScore, raceScore } from './missions.js';
import { ACTION_CONFIRM, ACTION_FLAPS, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { ISLANDS } from './config.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SHOT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = {
  random,
  clouds: makeClouds(createRandom(seed + 7)),
  palms: Object.fromEntries(ISLANDS.map((island) => [island.id, makePalms(createRandom(seed + island.id.length * 31), island, 12)])),
};
const flight = createFlight();
const renderer = createRenderer(canvas, world);
const hud = createHud(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const staged = stageShot(name, flight, buildMission);
  let painted = 0;
  function paint() {
    renderer.drawScene(flight, staged.mission, staged.screen);
    hud.drawHud(flight, staged.mission, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let mission = buildMission(0);
  let accumulator = 0;
  let last = performance.now();
  let resultLines = [];
  let resultTitle = '';
  let warnedFuel = false;
  let warnedDamage = false;
  let stuckTime = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startMission(index) {
    mission = buildMission(index);
    flight.reset(mission, mission.start);
    accumulator = 0;
    warnedFuel = false;
    warnedDamage = false;
    resultLines = [];
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.click();
    announce(`${mission.name}. ${mission.briefing}`);
  }

  function finishMission(title, lines) {
    resultTitle = title;
    resultLines = lines;
    screen = SCREEN_OVER;
    const total = flight.state.score;
    if (total > best) {
      best = total;
      saveBest(best);
    }
    announce(`${title} Skor ${total}. Terbaik ${best}.`);
  }

  function finishAtDestination(hard) {
    const plane = flight.plane;
    const penalty = hard ? '  •  pendaratan kasar mengurangi skor' : '';
    if (mission.id === 'race') {
      if (flight.state.ringsPassed >= mission.rings.length) {
        const s = raceScore(flight, mission);
        flight.state.score += s.timeBonus;
        finishMission('SEMUA CINCIN TERLEWATI', [
          `Cincin ${s.rings} poin  •  bonus waktu ${s.timeBonus}`,
          `Total skor ${flight.state.score}  •  terbaik ${Math.max(best, flight.state.score)}`,
          'Surat Merak terkirim tepat waktu. Pos udara bangga padamu.',
        ]);
      }
      return;
    }
    if (mission.id === 'landing') {
      const runway = flight.runwayAt(plane.x, plane.z) ?? { across: 80 };
      const s = landingScore(plane, runway, mission, flight);
      flight.state.score += Math.max(0, s.total - (hard ? 25 : 0));
      finishMission('PENDARATAN BERHASIL', [
        `Ketepatan garis tengah ${s.centre}  •  kelembutan ${s.vs}`,
        `Bonus bahan bakar ${s.fuelBonus}  •  total skor ${flight.state.score}${penalty}`,
        'Penumpang surat turun dengan selamat di Karang Selatan.',
      ]);
      return;
    }
    if (mission.id === 'ferry') {
      const s = ferryScore(plane, mission, flight);
      flight.state.score += Math.max(0, s.total - (hard ? 25 : 0));
      finishMission('SURAT SAMPAI DI KABUT', [
        `Bonus bahan bakar ${s.fuelBonus}  •  bonus waktu ${s.timeBonus}`,
        `Total skor ${flight.state.score}  •  terbaik ${Math.max(best, flight.state.score)}${penalty}`,
        '40 kg surat diserahkan. Pulau Kabut berterima kasih.',
      ]);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const choice = input.takeMissionChoice();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Suara mati.' : 'Suara hidup.');
    }
    if (screen === SCREEN_TITLE) {
      if (choice >= 1 && choice <= 3) startMission(choice - 1);
      else if (actions & ACTION_CONFIRM) startMission(0);
      return;
    }
    if (actions & ACTION_FLAPS && screen === SCREEN_PLAY) {
      flight.plane.flaps = !flight.plane.flaps;
      announce(flight.plane.flaps ? 'Flaps turun.' : 'Flaps naik.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_OVER)) {
      startMission(mission.number - 1);
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Lanjut terbang.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) {
      screen = SCREEN_TITLE;
      announce('Kestrel Airmail. Pilih misi dengan tombol 1, 2 atau 3.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const control = {
      throttle: input.throttleDirection(),
      pitch: input.pitchDirection(),
      bank: input.bankDirection(),
    };
    const events = flight.step(STEP, control, mission);
    const plane = flight.plane;
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_LANDED) {
      audio.land();
      const onLand = flight.groundHeight(plane.x, plane.z) > 0.5;
      if (!onLand) {
        finishMission('MENDARAT DI LAUT', [
          `Skor ${flight.state.score}  •  pesawat mengapung, suratnya basah`,
          'Laut bukan runway. Terbanglah sampai daratan.',
        ]);
        return;
      }
      // A landing only counts for the ferry and precision missions when it is
      // actually at the destination; anywhere else it is a touch-and-go.
      if ((mission.id === 'landing' || mission.id === 'ferry') && distanceToTarget(plane, mission) > 1500) {
        return;
      }
      finishAtDestination(false);
      return;
    }
    if (events & EVENT_TOUCHDOWN_HARD && plane.onGround) {
      // A rough but survivable landing at the destination still delivers the
      // mail, just with a damage penalty on the score.
      const onLand = flight.groundHeight(plane.x, plane.z) > 0.5;
      if (onLand && (mission.id === 'landing' || mission.id === 'ferry') && distanceToTarget(plane, mission) < 1500) {
        finishAtDestination(true);
        return;
      }
    }
    if (events & EVENT_TOUCHDOWN_HARD) audio.land();
    if (events & EVENT_CRASH) {
      audio.crash();
      if (plane.damage >= 100 || plane.y <= 0.5) {
        finishMission('PESAWAT JATUH', [
          `Kerusakan ${Math.round(plane.damage)}%  •  skor ${flight.state.score}`,
          'Kestrel K-4 ditarik ke hanggar Merak untuk diperbaiki.',
          'Terbang lebih pelan saat rendah, dan jaga bahan bakar.',
        ]);
        return;
      }
    }
    if (events & EVENT_FUEL_EMPTY && !warnedFuel) {
      warnedFuel = true;
      audio.warning();
      announce('Bahan bakar habis. Meluncur ke daratan terdekat.');
    }
    // Out of fuel, on the ground and stopped: the sortie is over, not stuck.
    if (plane.fuel <= 0 && plane.onGround && plane.speed < 1) {
      stuckTime += STEP;
      if (stuckTime > 3) {
        finishMission('KEHABISAN BAHAN BAKAR', [
          `Skor ${flight.state.score}  •  ${mission.id === 'race' ? `cincin ${flight.state.ringsPassed}/${mission.rings.length}` : `jarak ke target ${distanceToTarget(plane, mission)} m`}`,
          'Tangki kosong di darat. Lain kali terbang lebih hemat.',
        ]);
        return;
      }
    } else {
      stuckTime = 0;
    }
    if (plane.damage >= 60 && !warnedDamage) {
      warnedDamage = true;
      audio.warning();
    }
    if (mission.id === 'race' && flight.state.ringsPassed >= mission.rings.length && !plane.onGround) {
      // All rings done: fly home and land at Merak to bank the time bonus.
    }
    if (flight.state.timeLeft <= 0) {
      finishMission('WAKTU HABIS', [
        `Skor ${flight.state.score}  •  ${mission.id === 'race' ? `cincin ${flight.state.ringsPassed}/${mission.rings.length}` : `jarak ke target ${distanceToTarget(plane, mission)} m`}`,
        'Jadwal pos 1962 tidak menunggu siapa pun.',
      ]);
    }
    audio.update(plane.throttle, plane.speed / 96, !plane.onGround);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawScene(flight, mission, screen);
    if (screen === SCREEN_TITLE) hud.drawTitlePanel(best);
    else {
      hud.drawHud(flight, mission, audio.isMuted());
      if (screen === SCREEN_PAUSED) hud.drawPausePanel();
      else if (screen === SCREEN_OVER) hud.drawResultPanel(resultTitle, resultLines, 'Tekan Spasi untuk kembali ke menu misi');
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  announce('Kestrel Airmail. Pilih misi dengan tombol 1, 2 atau 3.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
