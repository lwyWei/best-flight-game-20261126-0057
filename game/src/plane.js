// The aircraft: a low-poly bush plane built from primitives, cream with red
// trim, a spinning two-blade propeller and fixed landing gear. The group faces
// -z (north) at heading 0; the flight model drives its position and rotation.
import { PALETTE } from './config.js';

export function createPlane(scene) {
  const group = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: PALETTE.planeCream });
  const red = new THREE.MeshLambertMaterial({ color: PALETTE.planeRed });
  const dark = new THREE.MeshLambertMaterial({ color: PALETTE.planeDark });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x224455 });

  // Fuselage: a tapered body, nose cone and tail cone.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 10), cream);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0.4);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.5, 10), red);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -2.9);
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.8, 10), cream);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.1, 4.0);
  group.add(tailCone);

  // Canopy: a glasshouse over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 8), glass);
  canopy.scale.set(0.9, 0.75, 1.7);
  canopy.position.set(0, 0.72, -0.6);
  group.add(canopy);

  // High wing with red tips, and the tailplane + fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.16, 1.7), cream);
  wing.position.set(0, 0.72, -0.4);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 1.7), red);
    tip.position.set(side * 4.35, 0.72, -0.4);
    group.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), dark);
    strut.position.set(side * 1.5, 0.05, -0.4);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.1), cream);
  tailplane.position.set(0, 0.35, 4.4);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 1.2), red);
  fin.position.set(0, 0.9, 4.4);
  group.add(fin);

  // Propeller: hub + two blades, spinning around the nose axis.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dark);
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.1), dark);
    blade.rotation.z = a;
    blade.position.y = 0;
    prop.add(blade);
  }
  // A faint disc so the spin reads at speed.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 24),
    new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
  );
  prop.add(disc);
  prop.position.set(0, 0, -3.75);
  group.add(prop);

  // Fixed gear: two mains and a tail wheel.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    leg.position.set(side * 0.85, -0.95, -0.9);
    leg.rotation.z = side * 0.25;
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.05, -1.45, -0.9);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 4.3);
  group.add(tailWheel);

  // Navigation lights: red port, green starboard, white tail.
  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1e }));
  navRed.position.set(-4.7, 0.72, -0.4);
  group.add(navRed);
  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff5a }));
  navGreen.position.set(4.7, 0.72, -0.4);
  group.add(navGreen);

  scene.add(group);
  return {
    group,
    /** Spin the propeller by throttle; a parked plane still idles slowly. */
    update(throttle, dt) {
      prop.rotation.z += (2 + throttle * 42) * dt;
    },
    setVisible(v) {
      group.visible = v;
    },
  };
}
