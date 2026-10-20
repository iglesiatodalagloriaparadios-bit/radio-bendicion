// Prepara las imágenes base (assets/) desde el logo del sitio para que
// `npm run assets` genere las pantallas de inicio de Android en todos los tamaños.
const sharp = require('sharp');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const app = join(__dirname, '..');
const mark = join(app, '..', 'images', 'logo-mark.png');
const out = join(app, 'assets');
const CREAM = '#f8f2ec';

async function centered(size, markHeight, background, file) {
    const logo = await sharp(mark).resize({ height: markHeight }).toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background } })
        .composite([{ input: logo, gravity: 'center' }])
        .png()
        .toFile(join(out, file));
}

(async () => {
    mkdirSync(out, { recursive: true });
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    // El ícono de la app lo crea scripts/make-icons.cjs
    // Pantalla de inicio
    await centered(2732, 520, CREAM, 'splash.png');
    await centered(2732, 520, '#171214', 'splash-dark.png');
    // Ícono de la pantalla de inicio de Android 12 y posteriores: el sistema lo muestra en 288 dp
    // y recorta en un círculo de 192 dp, así que el logo ocupa la mitad del lienzo
    await centered(800, 400, transparent, '../android/app/src/main/res/drawable-nodpi/splash_icon.png');
    console.log('Imágenes base creadas en assets/');
})();
