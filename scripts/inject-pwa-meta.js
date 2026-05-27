// Injects PWA-related <link> and <meta> tags into dist/index.html after
// `expo export --platform web`. Idempotent: safe to run multiple times.
//
// Expo SDK 51 generates a minimal index.html without manifest/apple-touch-icon
// references, so without this step the installed PWA falls back to the small
// favicon.ico and looks pixelated on home screens.

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error(`[inject-pwa-meta] dist/index.html not found at ${indexPath}`);
  process.exit(1);
}

const tagsToInject = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<meta name="theme-color" content="#0D0D1A">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Remia">',
];

let html = fs.readFileSync(indexPath, 'utf8');
let injected = 0;

for (const tag of tagsToInject) {
  if (html.includes(tag)) continue;
  html = html.replace('</head>', `  ${tag}\n  </head>`);
  injected++;
}

if (injected === 0) {
  console.log('[inject-pwa-meta] all tags already present, nothing to do');
  process.exit(0);
}

fs.writeFileSync(indexPath, html);
console.log(`[inject-pwa-meta] injected ${injected} tag(s) into dist/index.html`);
