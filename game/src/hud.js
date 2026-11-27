// The HUD: DOM panels over the canvas — airspeed, altitude, heading with a
// compass strip, vertical speed, throttle, fuel, score, rings and time — plus
// the title, pause and end overlays and the centre message line. All numbers
// are the flight model's, converted to knots and feet for the instruments.
import { BEST_KEY, FONT, PALETTE, PLANE, RINGS } from './config.js';

const MS_TO_KT = 1.94384;
const M_TO_FT = 3.28084;

function compassLetter(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8];
}

export function createHud(document) {
  const root = document.getElementById('hud');
  root.innerHTML = `
  <div class="panel" id="panel-flight">
    <div class="row big"><span class="label">SPD</span><span id="hud-speed">0</span><span class="unit">kt</span></div>
    <div class="row big"><span class="label">ALT</span><span id="hud-alt">0</span><span class="unit">ft</span></div>
    <div class="row big"><span class="label">HDG</span><span id="hud-hdg">090°</span><span class="unit" id="hud-hdg-letter">E</span></div>
    <div class="row"><span class="label">V/S</span><span id="hud-vs">0</span><span class="unit">ft/min</span></div>
    <div class="compass" id="hud-compass"></div>
  </div>
  <div class="panel" id="panel-mission">
    <div class="row"><span class="label">SCORE</span><span id="hud-score">0</span></div>
    <div class="row"><span class="label">RINGS</span><span id="hud-rings">0 / ${RINGS.length}</span></div>
    <div class="row"><span class="label">TIME</span><span id="hud-time">0:00</span></div>
    <div class="bar"><div class="bar-fill fuel" id="hud-fuel"></div><span class="bar-label">FUEL</span></div>
    <div class="bar"><div class="bar-fill thr" id="hud-thr"></div><span class="bar-label">THR</span></div>
    <div class="row"><span class="label">DMG</span><span id="hud-dmg">0%</span></div>
  </div>
  <div id="hud-message"></div>
  <div id="hud-cross">+</div>
  <div id="hud-cockpit">
    <div class="gauge"><span class="g-label">SPD</span><span class="g-val" id="ck-speed">0</span></div>
    <div class="gauge"><span class="g-label">ALT</span><span class="g-val" id="ck-alt">0</span></div>
    <div class="gauge"><span class="g-label">HDG</span><span class="g-val" id="ck-hdg">090</span></div>
  </div>
  <div class="overlay" id="overlay-title">
    <h1>Aldermere Air Rally</h1>
    <p class="sub">Fly the bush plane through all eight rings over the valley lake,<br>then bring her home to the runway. Watch the fuel.</p>
    <p class="controls">↑ ↓ pitch &nbsp;·&nbsp; ← → bank &nbsp;·&nbsp; A / D rudder<br>
    W / S or Shift / Ctrl throttle &nbsp;·&nbsp; G gear &nbsp;·&nbsp; C camera &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M sound</p>
    <p class="start">Press <b>SPACE</b> or click to fly</p>
    <p class="best" id="hud-best"></p>
  </div>
  <div class="overlay hidden" id="overlay-pause">
    <h1>Paused</h1>
    <p class="start">Press <b>P</b> to keep flying</p>
  </div>
  <div class="overlay hidden" id="overlay-end">
    <h1 id="end-title">Landed</h1>
    <p class="sub" id="end-detail"></p>
    <p class="start">Press <b>R</b> to fly again</p>
    <p class="best" id="end-best"></p>
  </div>`;

  const el = (id) => document.getElementById(id);
  const speedEl = el('hud-speed');
  const altEl = el('hud-alt');
  const hdgEl = el('hud-hdg');
  const hdgLetterEl = el('hud-hdg-letter');
  const vsEl = el('hud-vs');
  const compassEl = el('hud-compass');
  const scoreEl = el('hud-score');
  const ringsEl = el('hud-rings');
  const timeEl = el('hud-time');
  const fuelEl = el('hud-fuel');
  const thrEl = el('hud-thr');
  const dmgEl = el('hud-dmg');
  const msgEl = el('hud-message');
  const bestEl = el('hud-best');
  const titleEl = el('overlay-title');
  const pauseEl = el('overlay-pause');
  const endEl = el('overlay-end');
  const endTitleEl = el('end-title');
  const endDetailEl = el('end-detail');
  const endBestEl = el('end-best');
  const cockpitEl = el('hud-cockpit');

  // Compass strip: ticks every 30°, labelled every 90°.
  let compassHtml = '';
  for (let d = 0; d < 360; d += 30) {
    compassHtml += `<span class="tick" data-deg="${d}">${d % 90 === 0 ? compassLetter(d) : '·'}</span>`;
  }
  compassEl.innerHTML = compassHtml;
  const ticks = [...compassEl.querySelectorAll('.tick')];

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
      // Storage can be off: the best score then lasts this visit only.
    }
  }

  let best = readBest();
  let lastMessage = '';

  function update(state) {
    const deg = ((state.heading * 180) / Math.PI + 360) % 360;
    speedEl.textContent = String(Math.round(state.speed * MS_TO_KT));
    altEl.textContent = String(Math.round(state.pos.y * M_TO_FT));
    hdgEl.textContent = `${String(Math.round(deg)).padStart(3, '0')}°`;
    hdgLetterEl.textContent = compassLetter(deg);
    const vs = Math.round(state.verticalSpeed * M_TO_FT * 60);
    vsEl.textContent = `${vs >= 0 ? '+' : ''}${vs}`;
    scoreEl.textContent = String(state.score);
    ringsEl.textContent = `${state.rings} / ${RINGS.length}`;
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    timeEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    fuelEl.style.width = `${Math.max(0, state.fuel)}%`;
    fuelEl.style.background = state.fuel < 25 ? PALETTE.hudRed : PALETTE.hudGreen;
    thrEl.style.width = `${Math.round(state.throttle * 100)}%`;
    dmgEl.textContent = `${Math.round(state.damage)}%`;
    dmgEl.style.color = state.damage > 60 ? PALETTE.hudRed : PALETTE.hudText;
    // Compass: highlight the tick nearest the heading.
    const nearest = Math.round(deg / 30) % 12;
    ticks.forEach((tick, i) => tick.classList.toggle('on', i === nearest));
    // Cockpit strip mirrors the big numbers.
    el('ck-speed').textContent = speedEl.textContent;
    el('ck-alt').textContent = altEl.textContent;
    el('ck-hdg').textContent = hdgEl.textContent;
    const msg = state.simTime < state.messageUntil ? state.message : '';
    if (msg !== lastMessage) {
      msgEl.textContent = msg;
      lastMessage = msg;
    }
  }

  function showTitle() {
    titleEl.classList.remove('hidden');
    pauseEl.classList.add('hidden');
    endEl.classList.add('hidden');
    bestEl.textContent = best > 0 ? `Best score: ${best}` : '';
  }
  function showPause(on) {
    pauseEl.classList.toggle('hidden', !on);
  }
  function showEnd(landed, detail, score) {
    titleEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    endEl.classList.remove('hidden');
    endTitleEl.textContent = landed ? 'Landed — welcome home' : 'Crashed';
    endDetailEl.textContent = detail;
    if (score > best) {
      best = score;
      saveBest(best);
      endBestEl.textContent = `New best: ${best}!`;
    } else {
      endBestEl.textContent = `Score ${score} · Best ${best}`;
    }
  }
  function hideOverlays() {
    titleEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    endEl.classList.add('hidden');
  }
  function setCockpit(on) {
    cockpitEl.classList.toggle('on', on);
  }

  return { update, showTitle, showPause, showEnd, hideOverlays, setCockpit, readBest };
}

export const HUD_CSS = `
  #hud { position: fixed; inset: 0; pointer-events: none; font-family: ${FONT}; color: ${PALETTE.hudText}; }
  .panel { position: absolute; background: rgba(8, 18, 28, 0.62); border: 1px solid rgba(234, 246, 255, 0.25);
    border-radius: 10px; padding: 10px 14px; backdrop-filter: blur(2px); }
  #panel-flight { top: 14px; left: 14px; min-width: 218px; }
  #panel-mission { top: 14px; right: 14px; min-width: 190px; }
  .row { display: flex; justify-content: space-between; gap: 12px; line-height: 1.5; font-size: 15px; }
  .row.big { font-size: 22px; font-weight: 650; }
  .label { color: #9fc3d8; font-size: 12px; letter-spacing: 1px; align-self: center; }
  .unit { color: #9fc3d8; font-size: 12px; align-self: center; }
  .compass { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 5px;
    border-top: 1px solid rgba(234, 246, 255, 0.2); font-size: 12px; color: #9fc3d8; }
  .compass .tick.on { color: ${PALETTE.hudAmber}; font-weight: 800; }
  .bar { position: relative; height: 12px; background: rgba(255,255,255,0.12); border-radius: 6px;
    margin: 7px 0 2px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; transition: width 0.2s; }
  .bar-fill.fuel { background: ${PALETTE.hudGreen}; }
  .bar-fill.thr { background: ${PALETTE.hudAmber}; }
  .bar-label { position: absolute; right: 6px; top: 0; font-size: 9px; line-height: 12px; color: #eaf6ff; letter-spacing: 1px; }
  #hud-message { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); font-size: 24px;
    font-weight: 700; color: ${PALETTE.hudAmber}; text-shadow: 0 2px 8px rgba(0,0,0,0.7); white-space: nowrap; }
  #hud-cross { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 20px;
    color: rgba(234,246,255,0.75); text-shadow: 0 1px 4px rgba(0,0,0,0.8); }
  #hud-cockpit { display: none; position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
    gap: 18px; background: rgba(8, 18, 28, 0.72); border: 1px solid rgba(234,246,255,0.3); border-radius: 12px;
    padding: 10px 22px; }
  #hud-cockpit.on { display: flex; }
  .gauge { text-align: center; }
  .g-label { display: block; font-size: 11px; color: #9fc3d8; letter-spacing: 1px; }
  .g-val { font-size: 24px; font-weight: 700; }
  .overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; background: rgba(6, 14, 22, 0.45); }
  .overlay.hidden { display: none; }
  #overlay-title { justify-content: flex-start; padding-top: 9vh; background: rgba(6, 14, 22, 0.32); }
  .overlay h1 { font-size: 54px; margin: 0 0 10px; text-shadow: 0 3px 14px rgba(0,0,0,0.8); letter-spacing: 1px; }
  .overlay .sub { font-size: 19px; line-height: 1.5; margin: 0 0 18px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
  .overlay .controls { font-size: 15px; line-height: 1.8; color: #cfe4f2; margin: 0 0 22px; }
  .overlay .start { font-size: 21px; color: ${PALETTE.hudAmber}; }
  .overlay .best { font-size: 15px; color: #cfe4f2; }
`;
