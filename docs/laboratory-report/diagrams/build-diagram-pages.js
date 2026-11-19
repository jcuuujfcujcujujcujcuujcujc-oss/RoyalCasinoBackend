'use strict';
// Генерирует автономные HTML-страницы для рендеринга Mermaid-диаграмм.
// Используется только для получения изображений диаграмм; в отчёт входят .mmd-исходники.
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const diagrams = [
  ['architecture', 'Architecture of Royal Casino Backend'],
  ['erd', 'Entity Relationship Diagram'],
  ['sequence-post-games', 'POST /api/games request execution'],
  ['module-anatomy', 'Standard feature module anatomy'],
];

const page = (name, caption, def) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${caption}</title>
<style>
html,body{margin:0;padding:0;background:#fff}
body{font-family:"Segoe UI",Arial,sans-serif;padding:28px 32px}
.caption{font-size:18px;color:#222;margin:0 0 18px;font-weight:600}
#diagram{width:1500px}
#diagram svg{max-width:100%;height:auto}
</style>
<script src="vendor/mermaid.min.js"></script></head>
<body>
<div class="caption">${caption}</div>
<div id="diagram"></div>
<script>
const def = ${JSON.stringify(def)};
mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict',
  fontFamily: 'Segoe UI, Arial, sans-serif',
  flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
  sequence: { useMaxWidth: true }, er: { useMaxWidth: true } });
(async () => {
  const { svg } = await mermaid.render('diagram-svg', def);
  document.getElementById('diagram').innerHTML = svg;
  window.__rendered = true;
  document.title = 'ready';
})().catch((e) => { document.body.innerHTML = '<pre>' + e.stack + '</pre>'; });
</script></body></html>`;

for (const [name, caption] of diagrams) {
  const def = fs.readFileSync(path.join(dir, `${name}.mmd`), 'utf8');
  fs.writeFileSync(path.join(dir, `render-${name}.html`), page(name, caption, def), 'utf8');
  console.log('written', `render-${name}.html`);
}
