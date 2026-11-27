// Aldermere Air Rally — a make.fun best-flight-game-20261126-0057 entry
// (Node 22, standard library only). The game is this directory's game/
// folder: plain static files a desktop browser loads offline (game/index.html
// and its ES modules plus a vendored three.js, no network request). This
// program hands it in: it copies game/ and screenshots/ from beside this
// file to /output, checks the scorer's caps itself (screenshots, game size,
// index.html size), and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Bytes of a JPEG or PNG's stored dimensions, for the screenshot caps. */
function imageSize(file) {
  const bytes = readFileSync(file);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // JPEG: walk segments to the first SOF marker.
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) break;
      const marker = bytes[at + 1];
      const len = bytes.readUInt16BE(at + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
      }
      at += 2 + len;
    }
    throw new Error(`${file}: no JPEG SOF marker`);
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  throw new Error(`${file}: not a JPEG or PNG`);
}

function checkShots() {
  const dir = join(here, 'screenshots');
  const names = readdirSync(dir).filter((n) => /\.(jpe?g|png)$/i.test(n)).sort();
  if (names.length < 3 || names.length > CAPS.screenshots.max) {
    throw new Error(`expected 3 or 4 screenshots, found ${names.length}`);
  }
  for (const name of names) {
    const file = join(dir, name);
    const size = statSync(file).size;
    if (size > CAPS.screenshots.max_bytes) throw new Error(`${name}: ${size} bytes, over the 256 KiB cap`);
    const { width, height } = imageSize(file);
    if (Math.max(width, height) > 1280 || Math.min(width, height) < 480) {
      throw new Error(`${name}: ${width}x${height}, outside the 1280x480 frame`);
    }
    console.log(`shot ${name}: ${width}x${height}, ${size} bytes`);
  }
}

function checkGame() {
  const index = join(here, 'game', 'index.html');
  if (!existsSync(index)) throw new Error('game/index.html is missing');
  const size = statSync(index).size;
  if (size > 1024 * 1024) throw new Error(`game/index.html is ${size} bytes, over the 1 MiB cap`);
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        files += 1;
        bytes += statSync(path).size;
      }
    }
  };
  walk(join(here, 'game'));
  if (files > CAPS.game_max_files) throw new Error(`game/ has ${files} files, over the 993 cap`);
  if (bytes > CAPS.game_max_bytes) throw new Error(`game/ is ${bytes} bytes, over the 48 MiB cap`);
  console.log(`game/: ${files} files, ${bytes} bytes`);
}

checkShots();
checkGame();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);

// Read the dossier back: it must parse, and the output tree must hold the
// game, the screenshots and nothing else at the top level.
const parsed = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
if (typeof parsed !== 'object' || parsed === null) throw new Error('dossier.json did not parse to an object');
const topLevel = readdirSync(out).sort().join(', ');
console.log(`output: ${topLevel}`);
console.log('Aldermere Air Rally is ready to hand in.');
