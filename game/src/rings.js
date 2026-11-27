// The ring course: eight glowing hoops in order around the valley, a light
// pillar over the next one, and the pass check the flight model calls each step.
import { PALETTE, PLANE, RINGS } from './config.js';

export function createRings(scene) {
  const group = new THREE.Group();
  const meshes = RINGS.map((ring, i) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(PLANE.ringRadius, 0.9, 12, 40),
      new THREE.MeshLambertMaterial({
        color: PALETTE.ring,
        emissive: PALETTE.ring,
        emissiveIntensity: 0.9,
      }),
    );
    mesh.position.set(ring.x, ring.y, ring.z);
    // Face along the course: toward the next ring (the last faces the runway).
    const next = RINGS[(i + 1) % RINGS.length];
    mesh.lookAt(next.x, next.y, next.z);
    mesh.userData.index = i;
    group.add(mesh);
    // A small floating marker post under each ring so it reads from far away.
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 18, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.35 }),
    );
    post.position.set(ring.x, ring.y - PLANE.ringRadius - 9, ring.z);
    group.add(post);
    return mesh;
  });

  // Beacon pillar over the next ring, moved as rings are passed.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 260, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: PALETTE.beacon,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  group.add(beacon);

  scene.add(group);

  function setNext(index) {
    const ring = RINGS[index % RINGS.length];
    beacon.position.set(ring.x, ring.y + 120, ring.z);
    meshes.forEach((mesh, i) => {
      const done = i < index;
      const mat = mesh.material;
      mat.color.setHex(done ? PALETTE.ringDone : PALETTE.ring);
      mat.emissive.setHex(done ? PALETTE.ringDone : PALETTE.ring);
      mat.emissiveIntensity = i === index ? 1.6 : 0.9;
    });
  }

  setNext(0);
  return {
    group,
    count: RINGS.length,
    setNext,
    /** The ring the pilot must fly through next. */
    next(index) {
      return RINGS[index % RINGS.length];
    },
    /** Mark a ring passed: green, and move the beacon on. */
    markPassed(index) {
      const mesh = meshes[index];
      mesh.material.color.setHex(PALETTE.ringDone);
      mesh.material.emissive.setHex(PALETTE.ringDone);
      setNext(index + 1);
    },
    /** True when `prev` -> `now` crossed this ring's plane inside its hoop. */
    passedThrough(index, prev, now) {
      const ring = RINGS[index % RINGS.length];
      const next = RINGS[(index + 1) % RINGS.length];
      // Ring plane normal: the course direction out of this ring.
      const nx = next.x - ring.x;
      const ny = next.y - ring.y;
      const nz = next.z - ring.z;
      const len = Math.hypot(nx, ny, nz) || 1;
      const ux = nx / len;
      const uy = ny / len;
      const uz = nz / len;
      const dPrev = (prev.x - ring.x) * ux + (prev.y - ring.y) * uy + (prev.z - ring.z) * uz;
      const dNow = (now.x - ring.x) * ux + (now.y - ring.y) * uy + (now.z - ring.z) * uz;
      if (dPrev >= 0 || dNow < 0) return false;
      // Closest approach to the centre while crossing.
      const t = dPrev / (dPrev - dNow);
      const cx = prev.x + (now.x - prev.x) * t - ring.x;
      const cy = prev.y + (now.y - prev.y) * t - ring.y;
      const cz = prev.z + (now.z - prev.z) * t - ring.z;
      const along = cx * ux + cy * uy + cz * uz;
      const dx = cx - along * ux;
      const dy = cy - along * uy;
      const dz = cz - along * uz;
      return Math.hypot(dx, dy, dz) < PLANE.ringRadius;
    },
  };
}
