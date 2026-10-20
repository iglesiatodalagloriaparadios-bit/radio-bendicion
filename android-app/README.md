# Radio Bendición · App Android

App para Google Play hecha con [Capacitor](https://capacitorjs.com). La interfaz es el mismo sitio web de la carpeta superior (`index.html`, `css/`, `js/`, `images/`); lo único nativo es:

- **Reproductor de la radio** (`RadioPlaybackService.java`, con Media3/ExoPlayer): servicio en primer plano con notificación y controles en la pantalla de bloqueo. Sigue sonando con el teléfono bloqueado y se reconecta solo si la red se corta o cambia entre Wi-Fi y datos.
- **Puente con la web** (`RadioPlayerPlugin.java`): `RadioPlayer.play()`, `pause()`, `getState()` y el evento `state`.
- Plugins oficiales: compartir, avisos del devocional, botón atrás, barra de estado.

En `js/index.js`, `IS_NATIVE_APP` decide si se usa lo nativo o lo del navegador.

## Requisitos

- Node.js 22 o superior
- [Android Studio](https://developer.android.com/studio), que trae el JDK 21 y el SDK de Android

## Flujo de trabajo

```bash
cd android-app
npm install
npm run sync     # copia el sitio a www/ y actualiza el proyecto Android
npm run open     # abre el proyecto en Android Studio
```

Haz `npm run sync` cada vez que cambies el sitio, antes de compilar.

`npm run sync` también cambia las fuentes de Google Fonts por las de `fonts/`, que van dentro de la app para que funcione sin conexión. Si cambias las fuentes del sitio, actualiza esa carpeta.

En Android Studio:
- **Probar en un teléfono:** conecta el teléfono con la depuración USB activada y presiona ▶ Run.
- **Generar el archivo para Play Store:** *Build → Generate Signed App Bundle → Android App Bundle*, que crea un `.aab`.
  - La primera vez, crea ahí mismo la llave de firma (*keystore*). Guárdala junto con sus contraseñas en un lugar seguro, porque sin ella no podrás publicar actualizaciones.

## Llave de subida (una sola vez)

En la terminal, dentro de `android-app/android`:

```bash
"C:\Program Files\Android\Android Studio\jbr\bin\keytool" -genkeypair -v -keystore radio-bendicion-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

El comando te pedirá una contraseña y tus datos. Después crea `android-app/android/keystore.properties` con:

```
storeFile=radio-bendicion-upload.jks
storePassword=TU_CONTRASEÑA
keyAlias=upload
keyPassword=TU_CONTRASEÑA
```

Ninguno de los dos archivos se sube a git. **Respáldalos fuera del computador**, por ejemplo en Google Drive.

Para compilar el `.aab` firmado: `./gradlew bundleRelease`. El archivo queda en `android/app/build/outputs/bundle/release/`.

## Publicar una nueva versión

1. En `android/app/build.gradle`, sube `versionCode` en 1 (2, 3, 4…) y cambia `versionName` (por ejemplo, `"1.1"`).
2. Corre `npm run sync` y genera el `.aab` firmado.
3. Sube el `.aab` en Play Console.

## Íconos y pantalla de inicio

Se generan desde `images/logo-mark.png` del sitio:

```bash
npm run assets
```
