#!/usr/bin/env node
/* Compara la salida JSON de una prueba con sus reglas en expected.json.
   Se usa desde run.sh:   node prueba.test.js | node tests/verify.js <nombre>
   Imprime  "OK|N reglas"  o  "FALLO|detalle de cada regla incumplida".      */
const fs = require('fs'), path = require('path');

const nombre = process.argv[2];
const reglas = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8'))[nombre];

let crudo = '';
process.stdin.on('data', d => crudo += d);
process.stdin.on('end', () => {
  if (!reglas) return fin('FALLO', 'no hay reglas para "' + nombre + '" en expected.json');

  // la prueba puede imprimir ruido antes del JSON; nos quedamos con el objeto final
  const i = crudo.indexOf('{');
  if (i < 0) return fin('FALLO', 'la prueba no imprimió JSON:\n' + crudo.trim().slice(-600));
  let datos;
  try { datos = JSON.parse(crudo.slice(i)); }
  catch (e) { return fin('FALLO', 'JSON ilegible (¿la prueba lanzó?):\n' + crudo.trim().slice(-600)); }

  const leer = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const malos = [];
  let n = 0;

  for (const ruta in reglas) {
    if (ruta === '_doc') continue;
    n++;
    const cond = reglas[ruta], v = leer(datos, ruta);
    let ok, esperado;

    if (cond === true || cond === false) { ok = v === cond; esperado = String(cond); }
    else if (typeof cond === 'number')   { ok = v === cond; esperado = String(cond); }
    else if (cond && cond.vacio)         { ok = Array.isArray(v) && v.length === 0;
                                           esperado = 'lista vacía'; }
    else if (cond && 'igual' in cond)    { ok = v === cond.igual; esperado = '= ' + cond.igual; }
    else if (cond && 'min' in cond)      { ok = typeof v === 'number' && v >= cond.min;
                                           esperado = '>= ' + cond.min; }
    else if (cond && 'max' in cond)      { ok = typeof v === 'number' && v <= cond.max;
                                           esperado = '<= ' + cond.max; }
    else { ok = false; esperado = 'regla desconocida'; }

    if (!ok) malos.push('  ' + ruta + ': esperaba ' + esperado +
                        ' pero fue ' + JSON.stringify(v));
  }

  if (malos.length) fin('FALLO', malos.join('\n'));
  else fin('OK', n + ' reglas');
});

function fin(estado, msg) { process.stdout.write(estado + '|' + msg); process.exit(estado === 'OK' ? 0 : 1); }
