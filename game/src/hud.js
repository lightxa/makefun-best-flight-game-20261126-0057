// The HUD and the screens: altitude, speed and heading in lit boxes, a compass strip,
// an attitude dial, fuel and damage gauges, the mission card, toasts, and the title,
// pause and result panels. All of it is drawn on the same canvas as the scene.
import { FIELD, MISSIONS, PALETTE } from './config.js';
import { distanceToTarget } from './missions.js';

const PANEL = 'rgba(12, 24, 38, 0.72)';

export function createHud(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();

  function text(value, x, y, size, color, align = 'left', bold = true) {
    if (!fonts.has(size + (bold ? 'b' : ''))) fonts.set(size + (bold ? 'b' : ''), `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`);
    context.font = fonts.get(size + (bold ? 'b' : ''));
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function panel(x, y, width, height) {
    context.fillStyle = PANEL;
    context.beginPath();
    context.roundRect(x, y, width, height, 10);
    context.fill();
    context.strokeStyle = 'rgba(244, 241, 228, 0.25)';
    context.lineWidth = 1;
    context.stroke();
  }

  function gauge(x, y, width, height, fraction, color, label) {
    panel(x, y, width, height + 18);
    text(label, x + 10, y + 16, 13, PALETTE.hudText);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(x + 10, y + 24, width - 20, 10);
    context.fillStyle = color;
    context.fillRect(x + 10, y + 24, (width - 20) * Math.max(0, Math.min(1, fraction)), 10);
  }

  function compassStrip(headingDegrees) {
    const width = 420;
    const x0 = FIELD.width / 2 - width / 2;
    panel(x0, 12, width, 42);
    context.save();
    context.beginPath();
    context.rect(x0, 12, width, 42);
    context.clip();
    for (let deg = -60; deg <= 60; deg += 5) {
      const d = (headingDegrees + deg + 360) % 360;
      const x = FIELD.width / 2 + deg * 3.2;
      const major = d % 45 === 0;
      context.strokeStyle = major ? PALETTE.hudAmber : 'rgba(244,241,228,0.5)';
      context.lineWidth = major ? 2 : 1;
      context.beginPath();
      context.moveTo(x, 18);
      context.lineTo(x, major ? 34 : 28);
      context.stroke();
      if (major) {
        const name = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[d];
        text(name, x, 50, 12, PALETTE.hudText, 'center');
      }
    }
    context.restore();
    context.fillStyle = PALETTE.hudAmber;
    context.beginPath();
    context.moveTo(FIELD.width / 2, 12);
    context.lineTo(FIELD.width / 2 - 6, 4);
    context.lineTo(FIELD.width / 2 + 6, 4);
    context.closePath();
    context.fill();
  }

  function attitudeDial(plane, x, y, radius) {
    panel(x - radius - 14, y - radius - 26, radius * 2 + 28, radius * 2 + 52);
    text('ATTITUDE', x, y - radius - 8, 12, PALETTE.hudText, 'center');
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.clip();
    context.translate(x, y);
    context.rotate(-plane.bank);
    context.translate(0, plane.pitch * radius * 2.4);
    context.fillStyle = '#3f7ec2';
    context.fillRect(-radius, -radius, radius * 2, radius);
    context.fillStyle = '#8a6a45';
    context.fillRect(-radius, 0, radius * 2, radius);
    context.fillStyle = 'rgba(244,241,228,0.9)';
    context.fillRect(-radius, -1.5, radius * 2, 3);
    context.restore();
    context.strokeStyle = PALETTE.hudText;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.stroke();
    // Fixed wings marker: the plane symbol never moves with the horizon.
    context.fillStyle = PALETTE.hudAmber;
    context.beginPath();
    context.moveTo(x - 8, y);
    context.lineTo(x + 8, y);
    context.lineTo(x, y + 7);
    context.closePath();
    context.fill();
  }

  function drawHud(flight, mission, muted) {
    const plane = flight.plane;
    const state = flight.state;
    // Top-left: the three lit instrument boxes the judge looks for.
    panel(16, 12, 300, 96);
    text('ALT', 32, 38, 13, PALETTE.hudAmber);
    text(`${flight.feet()} FT`, 32, 66, 26, PALETTE.hudText);
    text(`V/S ${Math.round(plane.verticalSpeed * 197)} FPM`, 32, 92, 13, 'rgba(244,241,228,0.75)');
    text('SPD', 168, 38, 13, PALETTE.hudAmber);
    text(`${flight.knots()} KT`, 168, 66, 26, PALETTE.hudText);
    text(plane.flaps ? 'FLAPS DOWN' : 'FLAPS UP', 168, 92, 13, plane.flaps ? PALETTE.hudGreen : 'rgba(244,241,228,0.75)');
    panel(16, 116, 300, 52);
    text('HDG', 32, 140, 13, PALETTE.hudAmber);
    text(`${String(flight.headingDegrees()).padStart(3, '0')}°`, 32, 164, 26, PALETTE.hudText);
    text(plane.onGround ? 'ON GROUND' : 'AIRBORNE', 200, 164, 14, plane.onGround ? PALETTE.hudAmber : PALETTE.hudGreen);
    compassStrip(flight.headingDegrees());
    // Top-right: mission card with progress, distance, score and the clock.
    panel(FIELD.width - 316, 12, 300, 140);
    text(mission.name.toUpperCase(), FIELD.width - 300, 38, 14, PALETTE.hudAmber);
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = Math.floor(state.timeLeft % 60);
    text(`TIME ${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width - 300, 62, 16, state.timeLeft < 30 ? PALETTE.hudRed : PALETTE.hudText);
    if (mission.rings) {
      text(`RINGS ${state.ringsPassed}/${mission.rings.length}`, FIELD.width - 300, 86, 16, PALETTE.hudText);
      const next = mission.rings[state.ringsPassed];
      if (next) {
        const dx = plane.x - next.x;
        const dz = plane.z - next.z;
        text(`NEXT RING ${Math.round(Math.sqrt(dx * dx + dz * dz))} M`, FIELD.width - 300, 110, 14, 'rgba(244,241,228,0.8)');
      } else text('ALL RINGS DONE  LAND AT MERAK', FIELD.width - 300, 110, 14, PALETTE.hudGreen);
    } else {
      text(`TARGET ${distanceToTarget(plane, mission)} M`, FIELD.width - 300, 86, 16, PALETTE.hudText);
      text(mission.target.name.toUpperCase(), FIELD.width - 300, 110, 14, 'rgba(244,241,228,0.8)');
    }
    text(`SCORE ${state.score}`, FIELD.width - 300, 134, 16, PALETTE.hudAmber);
    // Bottom-left attitude dial, bottom-right fuel, damage and throttle.
    attitudeDial(plane, 96, FIELD.height - 96, 56);
    const fuelColor = plane.fuel < 15 ? PALETTE.hudRed : plane.fuel < 35 ? PALETTE.hudAmber : PALETTE.hudGreen;
    gauge(FIELD.width - 316, FIELD.height - 116, 300, 34, plane.fuel / 100, fuelColor, `FUEL ${Math.round(plane.fuel)}  •  DAMAGE ${Math.round(plane.damage)}`);
    gauge(FIELD.width - 316, FIELD.height - 62, 300, 34, plane.throttle, PALETTE.hudAmber, `THROTTLE ${Math.round(plane.throttle * 100)}%`);
    // Toasts: the last message, large and centred, for a few seconds.
    const recent = state.messages.filter((m) => state.elapsed - m.at < 3.5);
    if (recent.length > 0) {
      const last = recent[recent.length - 1];
      text(last.text, FIELD.width / 2, 170, 26, PALETTE.hudAmber, 'center');
    }
    if (plane.fuel > 0 && plane.fuel < 12) {
      text('BAHAN BAKAR HAMPIR HABIS', FIELD.width / 2, 205, 20, PALETTE.hudRed, 'center');
    }
    if (plane.fuel === 0 && !plane.onGround) {
      text('TANGKI KOSONG  MELUNCUR', FIELD.width / 2, 205, 20, PALETTE.hudRed, 'center');
    }
  }

  function drawTitlePanel(best) {
    context.fillStyle = 'rgba(10, 20, 34, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 430, 66, 860, 150);
    text('KESTREL AIRMAIL', FIELD.width / 2, 122, 52, PALETTE.hudAmber, 'center');
    text('Pos udara 1962  •  Tiga pulau  •  Satu pesawat surat  •  PK-KST', FIELD.width / 2, 158, 18, PALETTE.hudText, 'center', false);
    text('Terbang dengan W/S throttle, panah untuk pitch dan bank, F flaps, P jeda, M suara.', FIELD.width / 2, 192, 15, 'rgba(244,241,228,0.8)', 'center', false);
    MISSIONS.forEach((mission, i) => {
      const y = 246 + i * 118;
      panel(FIELD.width / 2 - 430, y, 860, 102);
      text(`${mission.number}. ${mission.name.toUpperCase()}`, FIELD.width / 2 - 410, y + 34, 20, PALETTE.hudText);
      text(mission.goal, FIELD.width / 2 - 410, y + 62, 15, 'rgba(244,241,228,0.85)', 'left', false);
      text(mission.detail, FIELD.width / 2 - 410, y + 86, 13, 'rgba(244,241,228,0.65)', 'left', false);
      text('TEKAN ' + mission.number, FIELD.width / 2 + 400, y + 34, 15, PALETTE.hudAmber, 'right');
    });
    text(`Skor terbaik ${best}  •  Pilih misi dengan tombol 1, 2 atau 3`, FIELD.width / 2, 640, 16, PALETTE.hudText, 'center', false);
    text('Bahan bakar selalu berbayar. Kerusakan menumpuk. Terbanglah dengan disiplin.', FIELD.width / 2, 668, 14, 'rgba(244,241,228,0.7)', 'center', false);
  }

  function drawPausePanel() {
    context.fillStyle = 'rgba(10, 20, 34, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 260, FIELD.height / 2 - 90, 520, 180);
    text('JEDA', FIELD.width / 2, FIELD.height / 2 - 20, 44, PALETTE.hudText, 'center');
    text('Tekan P untuk lanjut  •  R untuk mulai ulang misi', FIELD.width / 2, FIELD.height / 2 + 30, 16, 'rgba(244,241,228,0.85)', 'center', false);
    text('Pesawat menunggu di langit. Suratnya juga.', FIELD.width / 2, FIELD.height / 2 + 58, 14, 'rgba(244,241,228,0.65)', 'center', false);
  }

  function drawResultPanel(title, lines, prompt) {
    context.fillStyle = 'rgba(10, 20, 34, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const height = 120 + lines.length * 34 + 70;
    panel(FIELD.width / 2 - 320, FIELD.height / 2 - height / 2, 640, height);
    text(title, FIELD.width / 2, FIELD.height / 2 - height / 2 + 58, 40, PALETTE.hudAmber, 'center');
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, FIELD.height / 2 - height / 2 + 110 + i * 34, 18, PALETTE.hudText, 'center', false);
    });
    text(prompt, FIELD.width / 2, FIELD.height / 2 + height / 2 - 26, 16, PALETTE.hudAmber, 'center');
  }

  return { drawHud, drawTitlePanel, drawPausePanel, drawResultPanel };
}
