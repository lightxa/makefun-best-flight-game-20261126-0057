// The world layout and the chase-camera projection: world points (x east, z south,
// y up) into screen pixels. The camera sits behind and above the plane and looks along
// its heading, so the terrain, runway and rings are drawn in true perspective order.
import { ISLANDS, PALETTE } from './config.js';

const FOV = (68 * Math.PI) / 180;

/** Project a world point into screen space. Returns null when behind the camera. */
export function createProjector(width, height) {
  const focal = (height / 2) / Math.tan(FOV / 2);
  return function project(point, camera) {
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const dz = point.z - camera.z;
    const cx = dx * camera.rightX + dz * camera.rightZ;
    const cy = dy * camera.upY + dx * camera.upX + dz * camera.upZ;
    const cz = dx * camera.forwardX + dy * camera.forwardY + dz * camera.forwardZ;
    if (cz < 2) return null;
    return {
      x: width / 2 + (cx * focal) / cz,
      y: height / 2 - (cy * focal) / cz,
      depth: cz,
      scale: focal / cz,
    };
  };
}

/** Camera vectors for a chase view behind the plane. */
export function chaseCamera(plane) {
  const fx = Math.sin(plane.heading) * Math.cos(plane.pitch);
  const fy = Math.sin(plane.pitch);
  const fz = -Math.cos(plane.heading) * Math.cos(plane.pitch);
  const rx = Math.cos(plane.heading);
  const rz = Math.sin(plane.heading);
  // Camera up is world up with the plane's bank removed: the camera never fights the pilot.
  const upX = 0;
  const upY = 1;
  const upZ = 0;
  const behind = 17;
  const above = 5.5;
  return {
    x: plane.x - fx * behind,
    y: plane.y + above - fy * behind,
    z: plane.z - fz * behind,
    forwardX: fx, forwardY: fy, forwardZ: fz,
    rightX: rx, rightZ: rz,
    upX, upY, upZ,
  };
}

/** Mix a colour toward the haze colour by distance (0 near, 1 far). */
export function hazeColor(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const hr = 216, hg = 205, hb = 168;
  const m = Math.min(1, Math.max(0, amount));
  const mix = (a, b2) => Math.round(a + (b2 - a) * m);
  return `rgb(${mix(r, hr)},${mix(g, hg)},${mix(b, hb)})`;
}

/** Island footprint polygon points (a 14-gon with seeded wobble). */
export function islandOutline(island, random) {
  const points = [];
  const wobble = [];
  for (let i = 0; i < 14; i += 1) wobble.push(0.86 + random() * 0.22);
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    const r = island.radius * wobble[i];
    points.push({ x: island.x + Math.cos(a) * r, z: island.z + Math.sin(a) * r });
  }
  return points;
}

/** A seeded set of cloud puffs floating above the sea. */
export function makeClouds(random) {
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    const angle = random() * Math.PI * 2;
    const dist = 1500 + random() * 6500;
    clouds.push({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      y: 480 + random() * 320,
      size: 120 + random() * 260,
      puffs: 3 + Math.floor(random() * 3),
    });
  }
  return clouds;
}

/** A seeded set of palm trees standing on an island, as x/z points. */
export function makePalms(random, island, count) {
  const palms = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const dist = island.radius * (0.25 + random() * 0.6);
    palms.push({
      x: island.x + Math.cos(angle) * dist,
      z: island.z + Math.sin(angle) * dist,
      height: 14 + random() * 8,
    });
  }
  return palms;
}

export { ISLANDS, PALETTE };
