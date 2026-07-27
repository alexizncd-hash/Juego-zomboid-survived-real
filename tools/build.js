#!/usr/bin/env node
/* Empaqueta index.html + css + js en un único archivo autocontenido.
   Útil para compartir el juego como un solo .html sin servidor.
     node tools/build.js  →  dist/zona-cero.html                */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(root, p), 'utf8');

let html = rd('index.html')
  .replace(/<link rel="stylesheet" href="css\/style\.css">/, '<style>\n' + rd('css/style.css') + '\n</style>')
  .replace(/<script src="js\/game\.js"><\/script>/, '<script>\n' + rd('js/game.js') + '\n</script>');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/zona-cero.html');
fs.writeFileSync(out, html);
console.log('✅ dist/zona-cero.html —', (fs.statSync(out).size / 1024).toFixed(1), 'KB');
