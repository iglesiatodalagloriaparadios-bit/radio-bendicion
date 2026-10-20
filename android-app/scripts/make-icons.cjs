// Ícono de la app en todas las densidades, desde images/logo-mark.png del sitio.
// - Ícono adaptable (Android 8+): capa del logo en alta resolución sobre fondo blanco,
//   más una capa monocromática para los íconos temáticos (Android 13+).
// - Íconos clásicos para Android 7: cuadrado redondeado y círculo.
const sharp = require('sharp');
const { join } = require('node:path');

const app = join(__dirname, '..');
const mark = join(app, '..', 'images', 'logo-mark.png');
const res = join(app, 'android', 'app', 'src', 'main', 'res');

const DENSITIES = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
// Capa adaptable: 108 dp, de los que se ven 72 dp y la zona segura es un círculo de 66 dp.
// Con 44 dp de alto, la diagonal del logo (≈56 dp) queda dentro de la zona segura.
const LAYER_DP = 108;
const LOGO_DP = 44;

async function logo(height, color) {
    let img = sharp(mark).resize({ height: Math.round(height), kernel: 'lanczos3' });
    if (color) {
        // Misma silueta (la cruz sigue calada) en un solo color
        const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (let i = 0; i < data.length; i += 4) {
            data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2];
        }
        img = sharp(data, { raw: info });
    }
    return img.png().toBuffer();
}

async function layer(size, logoHeight, file, color) {
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: await logo(logoHeight, color), gravity: 'center' }])
        .png()
        .toFile(file);
}

async function legacy(size, scale, shape, file) {
    const pad = Math.round(scale);  // 1 dp de margen, como los íconos de Material
    const box = size - pad * 2;
    const svg = shape === 'round'
        ? `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${box / 2}" fill="#fff"/></svg>`
        : `<svg width="${size}" height="${size}"><rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="${box * 0.18}" fill="#fff"/></svg>`;
    await sharp(Buffer.from(svg))
        .composite([{ input: await logo(28 * scale), gravity: 'center' }])
        .png()
        .toFile(file);
}

(async () => {
    for (const [name, scale] of Object.entries(DENSITIES)) {
        const dir = join(res, `mipmap-${name}`);
        const size = Math.round(LAYER_DP * scale);
        await layer(size, LOGO_DP * scale, join(dir, 'ic_launcher_foreground.png'));
        await layer(size, LOGO_DP * scale, join(dir, 'ic_launcher_monochrome.png'), [255, 255, 255]);
        await legacy(Math.round(48 * scale), scale, 'square', join(dir, 'ic_launcher.png'));
        await legacy(Math.round(48 * scale), scale, 'round', join(dir, 'ic_launcher_round.png'));
    }
    console.log('Íconos de la app creados en res/mipmap-*');
})();
