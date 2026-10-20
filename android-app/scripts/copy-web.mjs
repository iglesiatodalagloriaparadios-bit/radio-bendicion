// Copia el sitio (carpeta superior) a www/, que es lo que Capacitor empaqueta en la app.
// Agrega capacitor.js (puente con los plugins nativos); el sitio web no lo carga.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(app, '..');
const www = join(app, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www);
// sw.js no se copia: en la app las actualizaciones llegan por Play Store
for (const item of ['index.html', 'manifest.json', 'css', 'js', 'images']) {
    cpSync(join(site, item), join(www, item), { recursive: true });
}

cpSync(join(app, 'node_modules/@capacitor/core/dist/capacitor.js'), join(www, 'js/capacitor.js'));

// Fuentes dentro de la app en vez de Google Fonts: funciona sin conexión y no consulta a terceros
mkdirSync(join(www, 'fonts'));
for (const font of ['cormorant-garamond-latin.woff2', 'figtree-latin.woff2']) {
    cpSync(join(app, 'fonts', font), join(www, 'fonts', font));
}
cpSync(join(app, 'fonts/fonts.css'), join(www, 'css/fonts.css'));

const indexPath = join(www, 'index.html');
let html = readFileSync(indexPath, 'utf8');

const googleFonts = /\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*" rel="stylesheet">/;
if (!googleFonts.test(html)) {
    throw new Error('No se encontraron las fuentes de Google en index.html para reemplazarlas por las locales');
}
html = html.replace(googleFonts, '\n  <link rel="stylesheet" href="css/fonts.css">');

const jquery = '<script src="js/jquery-4.0.0.min.js"></script>';
if (!html.includes(jquery)) {
    throw new Error('No se encontró el script de jQuery en index.html para agregar capacitor.js');
}
writeFileSync(indexPath, html.replace(jquery, '<script src="js/capacitor.js"></script>\n  ' + jquery));

console.log('Sitio copiado a www/');
