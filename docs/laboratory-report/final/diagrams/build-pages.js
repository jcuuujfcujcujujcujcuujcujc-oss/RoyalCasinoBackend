'use strict';
const fs = require('node:fs');
const path = require('node:path');

const items = [
  ['architecture', 1180],
  ['erd', 1180],
  ['sequence-post-games', 1150],
  ['module-anatomy', 1050],
];

for (const [name, width] of items) {
  const def = fs.readFileSync(path.join(__dirname, `${name}.mmd`), 'utf8');
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${name}</title>
<style>
html,body{margin:0;padding:0;background:#ffffff}
body{font-family:"Segoe UI",Arial,sans-serif;padding:0}
#diagram{width:${width}px;background:#ffffff}
#diagram svg{display:block;max-width:none;height:auto}
</style>
<script src="./vendor/mermaid.min.js"></script></head>
<body>
<div id="diagram"></div>
<script>
const def = ${JSON.stringify(def)};
mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict',
  fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 16,
  flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: false },
  sequence: { useMaxWidth: false, wrap: false },
  er: { useMaxWidth: false, minEntityWidth: 130, entityPadding: 14 } });
(async () => {
  const { svg } = await mermaid.render('diagram-svg', def);
  document.getElementById('diagram').innerHTML = svg;
  window.__rendered = true;
  document.title = 'ready';
})().catch((e) => { document.body.innerHTML = '<pre>' + e.stack + '</pre>'; document.title = 'error'; });
</script></body></html>`;
  fs.writeFileSync(path.join(__dirname, `render-${name}.html`), html, 'utf8');
  console.log('written', name, width);
}
