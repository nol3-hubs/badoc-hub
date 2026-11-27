#!/usr/bin/env node
// Stamps every local js/ and css/ reference in index.html with ?v=<content hash> and regenerates the
// precache list + cache name in sw.js. Run from the repo root after editing any js/ or css/ file:
//     node tools/stamp-assets.mjs
// (CI does this automatically: .github/workflows/stamp-assets.yml)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 8);
let html = readFileSync('index.html', 'utf8');
const used = new Set();
// <script src="js/x.js?v=old"> (also actual-scanned.js and extension/pod-checker/app.js), <link href="css/x.css">, <meta ... content="js/x.js">
html = html.replace(/((?:src|href|content)=")((?:\.\/)?(?:(?:js|css)\/[A-Za-z0-9._-]+\.(?:js|css)|actual-scanned\.js|extension\/pod-checker\/app\.js))(?:\?v=[A-Za-z0-9._-]+)?(")/g, (m, a, ref, z) => {
  const path = ref.replace(/^\.\//, '');
  if (!existsSync(path)) { console.warn('missing file referenced:', path); return m; }
  used.add(path);
  return `${a}${ref}?v=${sha(readFileSync(path))}${z}`;
});
writeFileSync('index.html', html);
// Precache everything except the lazily loaded extension map.
const shell = ['./index.html'];
for (const m of html.matchAll(/(?:src|href)="(?:\.\/)?((?:(?:js|css)\/|actual-scanned\.js|extension\/pod-checker\/app\.js)[^"]*)"/g)) if (!m[1].includes('bridge-files')) shell.push('./' + m[1]);
const cacheKey = sha(Buffer.from(html));
let sw = readFileSync('sw.js', 'utf8');
sw = sw.replace(/\/\* STAMP:BEGIN \*\/[\s\S]*?\/\* STAMP:END \*\//,
  `/* STAMP:BEGIN */\nconst CACHE_NAME = 'badoc-hub-pwa-${cacheKey}';\nconst APP_SHELL = ${JSON.stringify(shell, null, 2)};\n/* STAMP:END */`);
writeFileSync('sw.js', sw);
console.log(`stamped ${used.size} assets; cache badoc-hub-pwa-${cacheKey}; precache ${shell.length} files`);
