// Builds a single self-contained HTML file (JS + CSS inlined) so the game
// can be opened directly from disk or hosted anywhere as one file.
// Usage: npm run build  ->  dist/pagoda.html

import { build, transform } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const js = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: 'es2020',
});

const rawCss = await readFile('styles/main.css', 'utf8');
const css = (await transform(rawCss, { loader: 'css', minify: true })).code;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>PAGODA</title>
<style>${css}</style>
</head>
<body>
<div id="app" aria-live="polite"></div>
<script>${js.outputFiles[0].text}</script>
</body>
</html>
`;

await mkdir('dist', { recursive: true });
await writeFile('dist/pagoda.html', html);
console.log(`dist/pagoda.html written (${(html.length / 1024).toFixed(1)} KB)`);
