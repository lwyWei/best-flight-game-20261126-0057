// Aldermere Air Rally — every tuning number and colour in one place.
// The world is a 2400 x 2400 m island valley, Y up, x east, z south. Heading 0
// points north (-z) and grows clockwise. Speeds are m/s, altitudes metres,
// the HUD converts to knots and feet for display.

export const STEP = 1 / 60;
export const WORLD = { size: 2400, half: 1200 };

/** Fixed seed: the same seed always builds the same valley, lake and rings. */
export const SEED = 7;

/** Terrain: value-noise octaves, then a flattened airfield and a lake basin. */
export const TERRAIN = {
  baseFreq: 1 / 620,
  octaves: [
    { freq: 1, amp: 96 },
    { freq: 2.1, amp: 44 },
    { freq: 4.3, amp: 20 },
    { freq: 8.7, amp: 9 },
  ],
  /** Height of the flattened airfield plate. */
  fieldHeight: 8,
  /** Centre of the flattened plate (the runway sits on it). */
  fieldCentre: { x: 0, z: 860 },
  fieldRadius: 300,
  /** Lake basin: centre, radius, water surface height. */
  lake: { x: -640, z: -480, radius: 250, water: 2.5 },
};

/** The runway: a 400 m strip on the airfield plate, along x. */
export const RUNWAY = {
  centre: { x: 0, z: 860 },
  length: 400,
  width: 26,
  height: 8.4,
  heading: Math.PI / 2, // east: the landing direction is +x
};

export const PLANE = {
  /** m/s below which the wing stops flying and the nose drops. */
  stallSpeed: 26,
  /** m/s at full throttle, level. */
  maxSpeed: 74,
  minSpeed: 12,
  /** Throttle 0 idles at this speed in level flight. */
  idleSpeed: 15,
  maxRoll: 1.05,
  maxPitch: 0.55,
  rollRate: 2.4,
  pitchRate: 1.6,
  yawRate: 0.55,
  /** Fuel seconds at full throttle from a full tank. */
  fuelDrain: 0.32,
  tank: 100,
  /** Damage taken per hard terrain hit. */
  hitDamage: 45,
  /** Vertical speed (m/s, negative) allowed on a runway touchdown. */
  landingSink: -7,
  /** Speed (m/s) allowed on a runway touchdown. */
  landingSpeed: 32,
  /** Ring pass tolerance, metres from the ring centre. */
  ringRadius: 11,
};

export const RINGS = [
  { x: 60, z: 640, y: 95 },
  { x: 220, z: 260, y: 120 },
  { x: 330, z: -160, y: 150 },
  { x: -80, z: -560, y: 160 },
  { x: -640, z: -480, y: 130 },
  { x: -880, z: 60, y: 150 },
  { x: -420, z: 560, y: 105 },
  { x: -60, z: 830, y: 80 },
];

export const SCORE = {
  ring: 1000,
  landing: 2000,
  fuelPerUnit: 10,
  timeBonusRate: 5,
  timeBonusWindow: 300,
};

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyHorizon: 0xbfe3f5,
  fog: 0xcfe5f5,
  sun: 0xfff2c0,
  grassA: 0x5d8f3e,
  grassB: 0x7aa84f,
  sand: 0xc9b380,
  rock: 0x8a7f72,
  snow: 0xf2f5f7,
  water: 0x2e7fb8,
  asphalt: 0x33373d,
  marking: 0xf5f5f0,
  ring: 0xff7a1a,
  ringDone: 0x37d67a,
  beacon: 0xffb020,
  planeCream: 0xf3e6c8,
  planeRed: 0xc0392b,
  planeDark: 0x2b2f33,
  hudText: '#eaf6ff',
  hudAmber: '#ffb020',
  hudGreen: '#37d67a',
  hudRed: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'aldermere-air-rally.best';
