// The valley: a seeded heightfield, a lake, the airfield plate with its runway,
// trees, rocks, a hangar and a windsock. groundHeight(x, z) is the single source
// of truth for both the mesh and the flight model's collision checks.
import { PALETTE, RUNWAY, SEED, TERRAIN, WORLD } from './config.js';
import { clamp, createRandom, valueNoise } from './random.js';

const { fieldHeight, fieldCentre, lake } = TERRAIN;

/** Raw rolling hills from the seeded octaves, before flattening. */
function rawHeight(x, z) {
  let h = 0;
  for (const o of TERRAIN.octaves) {
    h += (valueNoise(x * TERRAIN.baseFreq * o.freq, z * TERRAIN.baseFreq * o.freq, SEED) - 0.5) * 2 * o.amp;
  }
  // The rim rises toward the map edges so the valley reads as a bowl.
  const edge = Math.max(Math.abs(x), Math.abs(z)) / WORLD.half;
  h += Math.max(0, edge - 0.72) * 260;
  return h + 34;
}

export function groundHeight(x, z) {
  let h = rawHeight(x, z);
  // Flatten the airfield: a rectangle around the runway (x -320..320,
  // z 700..930) with a 150 m blend out to the hills, so the departure to
  // the north and both runway approaches are clear.
  const ox = Math.max(0, Math.abs(x - fieldCentre.x) - 320);
  const oz = Math.max(0, 700 - z, z - 930);
  const od = Math.hypot(ox, oz);
  if (od < 150) {
    const t = od / 150;
    const f = t * t * (3 - 2 * t);
    h = fieldHeight + (h - fieldHeight) * f;
  }
  // Carve the lake basin below the waterline.
  const dl = Math.hypot(x - lake.x, z - lake.z);
  if (dl < lake.radius) {
    const t = dl / lake.radius;
    const basin = -6;
    h = h * (t * t * t) + basin * (1 - t * t * t);
  }
  return h;
}

function heightColour(h, slope, out) {
  if (h < lake.water + 1.2) out.setHex(PALETTE.sand);
  else if (h > 108) out.setHex(PALETTE.snow);
  else if (h > 74 || slope > 0.55) out.setHex(PALETTE.rock);
  else if (valueNoise(h * 0.37, h * 0.91, SEED + 5) > 0.5) out.setHex(PALETTE.grassA);
  else out.setHex(PALETTE.grassB);
  return out;
}

export function createTerrain(scene) {
  const group = new THREE.Group();

  // --- Heightfield -------------------------------------------------------
  const SEG = 128;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i += 1) {
    const slope = 1 - nrm.getY(i);
    heightColour(pos.getY(i), slope, colour);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  group.add(ground);

  // --- Lake ---------------------------------------------------------------
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(lake.radius * 0.96, 48),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(lake.x, lake.water, lake.z);
  group.add(water);

  // --- Runway -------------------------------------------------------------
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.8, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  strip.position.set(RUNWAY.centre.x, RUNWAY.height - 0.4, RUNWAY.centre.z);
  group.add(strip);
  // Centreline dashes and threshold bars.
  const dashGeo = new THREE.BoxGeometry(12, 0.12, 1.6);
  const markMat = new THREE.MeshLambertMaterial({ color: PALETTE.marking });
  for (let x = -RUNWAY.length / 2 + 24; x < RUNWAY.length / 2 - 20; x += 32) {
    const dash = new THREE.Mesh(dashGeo, markMat);
    dash.position.set(x, RUNWAY.height + 0.06, RUNWAY.centre.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 6), markMat);
      bar.position.set(end * (RUNWAY.length / 2 - 10), RUNWAY.height + 0.06, RUNWAY.centre.z + k * 4.4);
      group.add(bar);
    }
  }
  // Edge lights, lit amber.
  const lightGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const lightMat = new THREE.MeshBasicMaterial({ color: PALETTE.beacon });
  for (let x = -RUNWAY.length / 2 + 8; x <= RUNWAY.length / 2 - 8; x += 32) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(x, RUNWAY.height + 0.6, RUNWAY.centre.z + side * (RUNWAY.width / 2 - 1));
      group.add(lamp);
    }
  }

  // --- Hangar and windsock --------------------------------------------------
  const hangar = new THREE.Group();
  const shed = new THREE.Mesh(
    new THREE.BoxGeometry(34, 12, 22),
    new THREE.MeshLambertMaterial({ color: 0xd8d3c4 }),
  );
  shed.position.y = 6;
  hangar.add(shed);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 34, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: PALETTE.planeRed }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 12;
  hangar.add(roof);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 9, 18),
    new THREE.MeshLambertMaterial({ color: 0x3a4a5a }),
  );
  door.position.set(-17.2, 4.5, 0);
  hangar.add(door);
  hangar.position.set(258, fieldHeight, 905);
  group.add(hangar);

  const sock = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
  );
  pole.position.y = 7;
  sock.add(pole);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }),
  );
  cone.rotation.z = Math.PI / 2;
  cone.position.set(3.4, 13.4, 0);
  sock.add(cone);
  sock.position.set(-190, fieldHeight, 830);
  group.add(sock);

  // --- Trees and rocks (instanced, seeded) ----------------------------------
  const rng = createRandom(SEED + 11);
  const treePositions = [];
  let guard = 0;
  while (treePositions.length < 150 && guard < 4000) {
    guard += 1;
    const x = (rng() * 2 - 1) * (WORLD.half - 60);
    const z = (rng() * 2 - 1) * (WORLD.half - 60);
    const h = groundHeight(x, z);
    if (h < 6 || h > 58) continue;
    if (Math.abs(x - fieldCentre.x) < 360 && z > 660 && z < 970) continue;
    if (Math.hypot(x - lake.x, z - lake.z) < lake.radius + 20) continue;
    treePositions.push([x, h, z, 0.7 + rng() * 0.9]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const crownGeo = new THREE.ConeGeometry(3.4, 11, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);
  const m4 = new THREE.Matrix4();
  treePositions.forEach(([x, h, z, s], i) => {
    m4.makeScale(s, s, s);
    m4.setPosition(x, h + 2.5 * s, z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(s, s, s);
    m4.setPosition(x, h + (5 + 5.5) * s, z);
    crowns.setMatrixAt(i, m4);
  });
  group.add(trunks);
  group.add(crowns);

  const rockGeo = new THREE.DodecahedronGeometry(2.4, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7d7468 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 60);
  for (let i = 0; i < 60; i += 1) {
    const x = (rng() * 2 - 1) * (WORLD.half - 80);
    const z = (rng() * 2 - 1) * (WORLD.half - 80);
    const h = groundHeight(x, z);
    const s = 0.6 + rng() * 1.8;
    m4.makeScale(s, s * 0.7, s);
    m4.setPosition(x, h + 0.4, z);
    rocks.setMatrixAt(i, m4);
  }
  group.add(rocks);

  scene.add(group);
  return { group, groundHeight };
}

export function isOverRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centre.x) < RUNWAY.length / 2 - 6 &&
    Math.abs(z - RUNWAY.centre.z) < RUNWAY.width / 2 - 2
  );
}

export function isOverLake(x, z) {
  return Math.hypot(x - lake.x, z - lake.z) < lake.radius * 0.96;
}
