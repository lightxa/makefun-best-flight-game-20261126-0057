// Drawing only: the world state in, pixels out. Sky, sun and clouds, a perspective sea
// grid, terraced islands with beaches and palms, runways with buildings, golden rings,
// and the Kestrel K-4 mail plane itself drawn as a built machine, not a triangle.
import { FIELD, ISLANDS, PALETTE } from './config.js';
import { chaseCamera, createProjector, hazeColor, islandOutline } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function lerpColor(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
const SEA_NEAR = [29, 111, 142];
const SEA_FAR = [127, 184, 207];

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: FIELD.width, height: FIELD.height };
  const project = createProjector(FIELD.width, FIELD.height);
  const fonts = new Map();
  const outlines = new Map();
  for (const island of ISLANDS) outlines.set(island.id, islandOutline(island, world.random));

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${'system-ui, sans-serif'}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function polygon(points, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.closePath();
    context.fill();
  }

  function drawSky(plane) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.45, PALETTE.skyMid);
    gradient.addColorStop(0.62, PALETTE.skyHorizon);
    gradient.addColorStop(0.63, PALETTE.seaFar);
    gradient.addColorStop(1, PALETTE.seaNear);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Sun, fixed low on the right so it never sits behind a HUD panel.
    const sunX = FIELD.width * 0.9;
    const sunY = 235 - plane.pitch * 120;
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 243, 196, 0.25)';
    context.beginPath();
    context.arc(sunX, sunY, 58, 0, Math.PI * 2);
    context.fill();
  }

  function drawClouds(camera) {
    for (const cloud of world.clouds) {
      const p = project({ x: cloud.x, y: cloud.y, z: cloud.z }, camera);
      if (!p) continue;
      const r = cloud.size * p.scale * 0.5;
      if (r < 4 || p.x < -r || p.x > FIELD.width + r || p.y < -r || p.y > FIELD.height) continue;
      context.fillStyle = PALETTE.cloud;
      for (let i = 0; i < cloud.puffs; i += 1) {
        const ox = (i - cloud.puffs / 2) * r * 0.9;
        context.beginPath();
        context.ellipse(p.x + ox, p.y + Math.sin(i * 2.1) * r * 0.18, r * 0.62, r * 0.34, 0, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawSea(camera, plane) {
    const cell = 500;
    const range = 9;
    const baseX = Math.floor(plane.x / cell) * cell;
    const baseZ = Math.floor(plane.z / cell) * cell;
    const cells = [];
    for (let gx = -range; gx <= range; gx += 1) {
      for (let gz = -range; gz <= range; gz += 1) {
        const x0 = baseX + gx * cell;
        const z0 = baseZ + gz * cell;
        const corners = [
          project({ x: x0, y: 0, z: z0 }, camera),
          project({ x: x0 + cell, y: 0, z: z0 }, camera),
          project({ x: x0 + cell, y: 0, z: z0 + cell }, camera),
          project({ x: x0, y: 0, z: z0 + cell }, camera),
        ];
        if (corners.some((c) => c === null)) continue;
        const depth = corners.reduce((s, c) => s + c.depth, 0) / 4;
        cells.push({ corners, depth, gx, gz });
      }
    }
    cells.sort((a, b) => b.depth - a.depth);
    for (const cellData of cells) {
      const t = Math.min(1, cellData.depth / 9000);
      const shade = (cellData.gx + cellData.gz) % 2 === 0 ? 0 : 0.06;
      context.fillStyle = lerpColor(SEA_NEAR, SEA_FAR, Math.min(1, t + shade));
      polygon(cellData.corners, context.fillStyle);
    }
  }

  function drawIsland(island, camera, plane) {
    const outline = outlines.get(island.id);
    const dx = island.x - plane.x;
    const dz = island.z - plane.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const haze = Math.min(0.55, dist / 14000);
    const base = outline.map((p) => project({ x: p.x, y: 2, z: p.z }, camera)).filter(Boolean);
    if (base.length < 3) return;
    // Beach ring: the same outline, slightly wider, in sand.
    const beach = outline.map((p) => {
      const bx = island.x + (p.x - island.x) * 1.06;
      const bz = island.z + (p.z - island.z) * 1.06;
      return project({ x: bx, y: 1, z: bz }, camera);
    }).filter(Boolean);
    if (beach.length >= 3) polygon(beach, hazeColor(PALETTE.sand, haze));
    polygon(base, hazeColor(PALETTE.grass, haze));
    // Terraces up to the peak: three shrinking rings, darker as they rise.
    const terraces = [
      { scale: 0.62, y: island.peak * 0.45, color: PALETTE.hill },
      { scale: 0.38, y: island.peak * 0.75, color: PALETTE.grassDark },
      { scale: 0.16, y: island.peak, color: PALETTE.rock },
    ];
    for (const terrace of terraces) {
      const ring = outline.map((p) => {
        const tx = island.x + (p.x - island.x) * terrace.scale;
        const tz = island.z + (p.z - island.z) * terrace.scale;
        return project({ x: tx, y: terrace.y, z: tz }, camera);
      }).filter(Boolean);
      if (ring.length >= 3) polygon(ring, hazeColor(terrace.color, haze));
    }
    // Palms: small dark triangles with a trunk line.
    for (const palm of world.palms[island.id] || []) {
      const baseP = project({ x: palm.x, y: 6, z: palm.z }, camera);
      const topP = project({ x: palm.x, y: 6 + palm.height, z: palm.z }, camera);
      if (!baseP || !topP) continue;
      const size = Math.max(2, palm.height * baseP.scale * 0.55);
      context.strokeStyle = hazeColor('#4a3826', haze);
      context.lineWidth = Math.max(1, size * 0.12);
      context.beginPath();
      context.moveTo(baseP.x, baseP.y);
      context.lineTo(topP.x, topP.y);
      context.stroke();
      context.fillStyle = hazeColor(PALETTE.grassDark, haze);
      context.beginPath();
      context.moveTo(topP.x, topP.y - size);
      context.lineTo(topP.x - size * 0.8, topP.y + size * 0.3);
      context.lineTo(topP.x + size * 0.8, topP.y + size * 0.3);
      context.closePath();
      context.fill();
    }
    // Island name, floating where the pilot can read it.
    const label = project({ x: island.x, y: island.peak + 60, z: island.z }, camera);
    if (label && label.depth < 9000) {
      text(island.name, label.x, label.y, Math.max(13, 26 * label.scale * 0.4), 'rgba(244, 241, 228, 0.95)', 'center');
    }
  }

  function drawRunway(island, camera) {
    const r = island.runway;
    if (!r) return;
    const cx = island.x + r.x;
    const cz = island.z + r.z;
    // Runway along-vector matches the plane's forward vector: (sin h, -cos h).
    const fx = Math.sin(r.heading);
    const fz = -Math.cos(r.heading);
    const px = Math.cos(r.heading);
    const pz = Math.sin(r.heading);
    const halfL = r.length / 2;
    const halfW = r.width / 2;
    const corner = (along, across, y) => project({
      x: cx + fx * along + px * across,
      y,
      z: cz + fz * along + pz * across,
    }, camera);
    const strip = [corner(-halfL, -halfW, 3), corner(halfL, -halfW, 3), corner(halfL, halfW, 3), corner(-halfL, halfW, 3)];
    if (strip.some((c) => c === null)) return;
    polygon(strip, PALETTE.runway);
    // Centreline dashes and threshold bars.
    context.fillStyle = PALETTE.runwayMark;
    for (let along = -halfL + 40; along < halfL - 20; along += 70) {
      const a = corner(along, -2.5, 4);
      const b = corner(along + 34, -2.5, 4);
      const c = corner(along + 34, 2.5, 4);
      const d = corner(along, 2.5, 4);
      if (a && b && c && d) polygon([a, b, c, d], PALETTE.runwayMark);
    }
    // Touchdown zone: the green box a precise landing must hit.
    const zone = [corner(-40, -halfW + 6, 4), corner(40, -halfW + 6, 4), corner(40, halfW - 6, 4), corner(-40, halfW - 6, 4)];
    if (zone.every(Boolean)) {
      polygon(zone, 'rgba(63, 174, 90, 0.55)');
      context.strokeStyle = 'rgba(244, 241, 228, 0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(zone[0].x, zone[0].y);
      for (let i = 1; i < 4; i += 1) context.lineTo(zone[i].x, zone[i].y);
      context.closePath();
      context.stroke();
    }
    // A small terminal and hangar beside the strip, so the field reads as an airfield.
    drawBuilding(cx + px * (halfW + 60), cz + pz * (halfW + 60), 46, 16, 30, camera, '#d8c9a3');
    drawBuilding(cx + px * (halfW + 130), cz + pz * (halfW + 60), 60, 12, 34, camera, '#b3372c');
  }

  function drawBuilding(x, z, width, height, depth, camera, color) {
    const y = 3;
    const corners = [
      project({ x: x - width / 2, y, z: z - depth / 2 }, camera),
      project({ x: x + width / 2, y, z: z - depth / 2 }, camera),
      project({ x: x + width / 2, y, z: z + depth / 2 }, camera),
      project({ x: x - width / 2, y, z: z + depth / 2 }, camera),
    ];
    const top = corners.map((c, i) => (c ? { x: c.x, y: c.y - height * c.scale * 0.9, depth: c.depth } : null));
    if (corners.some((c) => c === null) || top.some((c) => c === null)) return;
    polygon(corners, color);
    polygon(top, '#e8e0cc');
  }

  function drawRing(ring, index, passed, camera) {
    const p = project({ x: ring.x, y: ring.y, z: ring.z }, camera);
    if (!p) return;
    const radius = Math.max(6, ring.radius * p.scale);
    if (p.x < -radius || p.x > FIELD.width + radius || p.y < -radius || p.y > FIELD.height + radius) return;
    const color = passed ? PALETTE.ringDone : PALETTE.ring;
    context.strokeStyle = color;
    context.lineWidth = Math.max(4, radius * 0.1);
    context.beginPath();
    context.ellipse(p.x, p.y, radius, radius * 0.92, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.lineWidth = Math.max(1.5, radius * 0.03);
    context.beginPath();
    context.ellipse(p.x, p.y, radius * 0.82, radius * 0.76, 0, 0, Math.PI * 2);
    context.stroke();
    if (!passed) {
      text(`R${index + 1}`, p.x, p.y - radius - 10, Math.max(14, radius * 0.28), '#fff3c4', 'center');
    }
  }

  // The Kestrel K-4 from behind and above: a slim cream fuselage with a red cheatline,
  // a high wing over the cabin, a red tail fin with the registration, and green and red
  // navigation lights. Drawn smaller and lower than the frame's centre so the sky and
  // the target ahead stay visible above it.
  function drawPlane(plane) {
    const cx = FIELD.width / 2;
    const cy = FIELD.height * 0.6;
    const s = 0.9;
    context.save();
    context.translate(cx, cy);
    context.rotate(plane.bank * 0.85);
    context.scale(s, s);
    // High wing over the cabin, thin and tapered.
    context.fillStyle = PALETTE.planeCream;
    context.beginPath();
    context.moveTo(-205, -78);
    context.lineTo(-24, -62);
    context.lineTo(24, -62);
    context.lineTo(205, -78);
    context.lineTo(198, -52);
    context.lineTo(24, -40);
    context.lineTo(-24, -40);
    context.lineTo(-198, -52);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeRed;
    context.fillRect(-205, -78, 10, 7);
    context.fillRect(195, -78, 10, 7);
    // Slim fuselage: narrow at the nose (away from the viewer), wider at the tail.
    context.fillStyle = PALETTE.planeCream;
    context.beginPath();
    context.moveTo(-25, 108);
    context.quadraticCurveTo(-32, 40, -24, -52);
    context.quadraticCurveTo(-18, -92, 0, -96);
    context.quadraticCurveTo(18, -92, 24, -52);
    context.quadraticCurveTo(32, 40, 25, 108);
    context.quadraticCurveTo(0, 122, -25, 108);
    context.closePath();
    context.fill();
    // Red cheatlines down both flanks.
    context.fillStyle = PALETTE.planeRed;
    context.fillRect(-25, -50, 5, 150);
    context.fillRect(20, -50, 5, 150);
    // Cabin roof hump and a small lit cockpit window.
    context.fillStyle = PALETTE.planeCream;
    context.beginPath();
    context.ellipse(0, -58, 15, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2c4a63';
    context.beginPath();
    context.ellipse(0, -60, 8, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 220, 130, 0.9)';
    context.beginPath();
    context.ellipse(-2, -61, 3, 2, 0, 0, Math.PI * 2);
    context.fill();
    // Tail fin with registration, and the horizontal stabilizer.
    context.fillStyle = PALETTE.planeRed;
    context.beginPath();
    context.moveTo(-19, 108);
    context.lineTo(-22, 152);
    context.lineTo(22, 152);
    context.lineTo(19, 108);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeCream;
    context.beginPath();
    context.moveTo(-96, 122);
    context.lineTo(-20, 110);
    context.lineTo(20, 110);
    context.lineTo(96, 122);
    context.lineTo(88, 136);
    context.lineTo(-88, 136);
    context.closePath();
    context.fill();
    context.fillStyle = '#f4f1e4';
    context.font = 'bold 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('PK-KST', 0, 144);
    // Navigation lights: red port, green starboard.
    context.fillStyle = '#ff4d3d';
    context.beginPath();
    context.arc(-202, -65, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#37d67a';
    context.beginPath();
    context.arc(202, -65, 5, 0, Math.PI * 2);
    context.fill();
    // Damage smoke when the airframe is hurt.
    if (plane.damage > 25) {
      context.fillStyle = `rgba(60, 60, 60, ${Math.min(0.7, plane.damage / 130)})`;
      context.beginPath();
      context.arc(-8, 110, 14 + Math.random() * 6, 0, Math.PI * 2);
      context.arc(10, 122, 18 + Math.random() * 6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  /** Paint one frame: sky, sea, islands, runway, rings, plane. HUD is drawn by hud.js. */
  function drawScene(flight, mission, screen) {
    const plane = flight.plane;
    const camera = chaseCamera(plane);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(plane);
    drawClouds(camera);
    drawSea(camera, plane);
    const sorted = [...ISLANDS].sort((a, b) => {
      const da = (a.x - plane.x) ** 2 + (a.z - plane.z) ** 2;
      const db = (b.x - plane.x) ** 2 + (b.z - plane.z) ** 2;
      return db - da;
    });
    for (const island of sorted) {
      drawIsland(island, camera, plane);
      drawRunway(island, camera);
    }
    if (mission.rings) {
      const rings = mission.rings.map((ring, i) => ({ ring, i, passed: i < flight.state.ringsPassed }));
      rings.sort((a, b) => {
        const da = (a.ring.x - plane.x) ** 2 + (a.ring.z - plane.z) ** 2;
        const db = (b.ring.x - plane.x) ** 2 + (b.ring.z - plane.z) ** 2;
        return db - da;
      });
      for (const entry of rings) drawRing(entry.ring, entry.i, entry.passed, camera);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_OVER) drawPlane(plane);
    return camera;
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawScene, text, drawPlane };
}
