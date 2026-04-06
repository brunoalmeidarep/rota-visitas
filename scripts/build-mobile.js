/**
 * build-mobile.js
 * Copia os arquivos do mobile atual para www/
 * sem alterar nenhum arquivo fonte.
 * Executar antes de: npx cap sync
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

if (!fs.existsSync(www)) {
  fs.mkdirSync(www, { recursive: true });
}

const files = [
  'index.html',
  'manifest.json',
  'sw.js',
  'icon-16.png',
  'icon-32.png',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'privacidade.html',
  'termos.html',
];

let ok = 0;
let skip = 0;

files.forEach(file => {
  const src = path.join(root, file);
  const dest = path.join(www, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ ${file}`);
    ok++;
  } else {
    console.warn(`  ⚠ ${file} não encontrado — ignorado`);
    skip++;
  }
});

console.log(`\nwww/ pronto: ${ok} arquivo(s) copiado(s), ${skip} ignorado(s).`);
console.log('Próximo passo: npx cap sync');
