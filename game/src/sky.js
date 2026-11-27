// Sky, sun, clouds and light. Clouds drift with simulation time, so a staged
// screenshot at a fixed sim time always shows the same sky.
import { PALETTE, SEED, WORLD } from './config.js';
import { createRandom } from './random.js';

export function createSky(scene) {
  const group = new THREE.Group();

  // Gradient dome: vertex colours from horizon pale blue to deep blue overhead.
  const domeGeo = new THREE.SphereGeometry(3200, 24, 14);
  const pos = domeGeo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const top = new THREE.Color(PALETTE.skyTop);
  const horizon = new THREE.Color(PALETTE.skyHorizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 3200 + 0.12));
    c.copy(horizon).lerp(top, t * t);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  group.add(dome);

  // Sun disc and the key light that matches it.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(1400, 900, -2400);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  const light = new THREE.DirectionalLight(0xfff2d8, 1.5);
  light.position.set(900, 1200, -800);
  group.add(light);
  group.add(new THREE.AmbientLight(0x9db8cc, 0.85));
  group.add(new THREE.HemisphereLight(0xbfe3f5, 0x5d8f3e, 0.5));

  scene.fog = new THREE.Fog(PALETTE.fog, 700, 2900);

  // Clouds: flattened white puffs, seeded positions, drifting east with sim time.
  const rng = createRandom(SEED + 23);
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88,
  });
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < puffs; k += 1) {
      const r = 14 + rng() * 22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.scale.y = 0.42;
      puff.position.set((rng() * 2 - 1) * 46, (rng() * 2 - 1) * 6, (rng() * 2 - 1) * 22);
      cloud.add(puff);
    }
    const base = {
      x: (rng() * 2 - 1) * (WORLD.half - 100),
      y: 190 + rng() * 90,
      z: (rng() * 2 - 1) * (WORLD.half - 100),
      drift: 2.5 + rng() * 2,
    };
    cloud.position.set(base.x, base.y, base.z);
    cloud.userData.base = base;
    clouds.push(cloud);
    group.add(cloud);
  }

  scene.add(group);
  return {
    group,
    update(simTime) {
      for (const cloud of clouds) {
        const b = cloud.userData.base;
        let x = b.x + simTime * b.drift;
        if (x > WORLD.half) x -= WORLD.size;
        cloud.position.x = x;
      }
    },
  };
}
