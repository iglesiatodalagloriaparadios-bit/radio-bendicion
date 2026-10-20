# Radio Bendición en Play Console

App: **Radio Bendicion** · paquete `com.radiobendicion.online` · cuenta personal "Theseux".
Estado al 19 oct 2026: borrador, sin archivos subidos, sin ficha de tienda ni formularios completados.

## Antes de empezar: cómo se publica con una cuenta personal

Google exige **una prueba cerrada con al menos 12 testers durante 14 días seguidos** antes de dejar publicar para todo el mundo. El camino es:

1. **Prueba interna (mismo día, sin revisión):** sirve para que tú y unos pocos instalen la versión de Play Store mientras tanto. No cuenta para los 14 días.
2. **Prueba cerrada:** se envía a revisión de Google, que tarda de horas a varios días la primera vez. Cuando la aprueban, los testers aceptan la invitación desde un enlace e instalan la app. **Los 14 días cuentan desde que hay 12 testers inscritos.**
3. **Solicitar acceso a producción:** al cumplir los 14 días se responde un cuestionario (ver el final de esta guía) y Google revisa de nuevo.
4. **Producción:** la app queda visible para todos.

Consejo: pide a los testers que **no se salgan del programa** y que usen la app varias veces durante esas dos semanas. Google revisa que haya uso real.

---

## 1. Ficha de la tienda (Crecer usuarios → Fichas de Play Store)

**Nombre de la app** (máx. 30): `Radio Bendición`

**Descripción breve** (máx. 80):
```
Radio cristiana en vivo 24 horas, devocional diario y peticiones de oración.
```

**Descripción completa** (máx. 4000):
```
Radio Bendición es la radio online de la Iglesia Toda la Gloria para Dios: alabanza y Palabra las 24 horas, ahora en tu celular.

🎧 RADIO EN VIVO
• Escucha la señal en vivo con un solo toque.
• Sigue sonando con la pantalla bloqueada o mientras usas otras apps.
• Controla la radio desde la notificación, la pantalla de bloqueo o tus audífonos.
• Mira qué canción está sonando y quién la interpreta.
• Si se corta internet o cambias de Wi-Fi a datos, la radio se reconecta sola.

📖 DEVOCIONAL DIARIO
• Un devocional para cada día del mes, con versículo, reflexión y oración.
• Recibe un aviso cada mañana con el devocional del día (opcional).
• Compártelo por WhatsApp o cópialo con un toque.

🙏 PETICIONES DE ORACIÓN
• Elige el motivo, escribe tu petición y envíala por WhatsApp a nuestro equipo de oración.
• Indica si quieres que oremos por ti al aire.

📅 PROGRAMACIÓN Y REUNIONES
• Revisa la programación semanal de la radio y comparte el afiche.
• Conoce los horarios de las reuniones de la iglesia y cómo llegar.

🌙 Modo oscuro, diseño simple y sin publicidad.

“Porque donde están dos o tres congregados en mi nombre, allí estoy yo en medio de ellos.” Mateo 18:20

Radio Bendición · Donde la fe se escucha.
```

**Gráficos** (archivos en esta carpeta):
| Campo | Archivo |
|---|---|
| Ícono de la app (512×512) | `icono-512.png` |
| Gráfico destacado (1024×500) | `grafico-destacado-1024x500.png` |
| Capturas de teléfono (mín. 2) | `capturas/01-radio.png` … `04-app.png` (1080×1920) |

## 2. Configuración de la tienda (Crecer usuarios → Configuración de la tienda)

- **Tipo:** App · **Categoría:** Música y audio
- **Etiquetas sugeridas:** Radio, Música cristiana
- **Correo de contacto:** ⚠️ falta definir (es público en la ficha)
- **Sitio web:** https://radiobendicion.cl
- **Teléfono:** opcional

## 3. Contenido de la app (Política y programas → Contenido de la app)

| Formulario | Respuesta |
|---|---|
| **Política de privacidad** | `https://radiobendicion.cl/privacidad` ⚠️ hay que desplegarla antes (hoy da 404) |
| **Acceso a la app** | Toda la funcionalidad está disponible sin restricciones (no hay inicio de sesión) |
| **Anuncios** | No, la app no contiene anuncios |
| **Clasificación del contenido** | Ver abajo |
| **Público objetivo** | 13 a 15, 16 a 17 y 18 o más. **No marcar menores de 13**, porque eso activa el programa de Familias, con requisitos extra. No está diseñada para niños |
| **Seguridad de los datos** | Ver abajo |
| **Apps gubernamentales** | No |
| **Funciones financieras** | Ninguna |
| **Salud** | Ninguna |
| **App de noticias** | No |
| **Permisos de servicio en primer plano** | Aparece después de subir el `.aab`. Ver abajo |

### Clasificación del contenido (cuestionario IARC)
- Correo: el mismo de contacto
- Categoría: **Todas las demás categorías de apps** (no es juego)
- Violencia, miedo, contenido sexual, lenguaje vulgar, drogas, alcohol o tabaco, apuestas: **No** a todo
- ¿Los usuarios pueden interactuar o intercambiar contenido dentro de la app? **No**. Las peticiones de oración se envían por WhatsApp, fuera de la app
- ¿Comparte la ubicación del usuario? **No**
- ¿Permite comprar productos digitales? **No**
- ¿Es un navegador web o buscador? **No**
- Resultado esperado: **Para todos / PEGI 3**

### Seguridad de los datos
- ¿La app recopila o comparte alguno de los tipos de datos requeridos? **No**
  - Justificación: no hay cuentas, analítica ni publicidad. Las preferencias quedan en el teléfono. Las peticiones de oración las envía el usuario desde su propio WhatsApp. Los avisos del devocional se programan en el mismo teléfono.
- ¿Los datos se cifran en tránsito? **Sí** (todas las conexiones son HTTPS)
- Con "No" a la primera pregunta, la ficha mostrará "No se recopilan datos" y "No se comparten datos con terceros".

### Permiso de servicio en primer plano: reproducción multimedia
Google pide describir para qué se usa y un **video** que lo muestre.
- **Tipo:** Reproducción multimedia (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`)
- **Descripción:**
  ```
  La app reproduce la señal en vivo de Radio Bendición. El servicio en primer plano mantiene el audio sonando cuando el usuario bloquea la pantalla o cambia de app, y muestra una notificación multimedia con los controles de reproducción y pausa. El servicio se inicia solo cuando el usuario toca reproducir y se detiene cuando pausa la radio.
  ```
- **Video:** graba la pantalla del teléfono, de 20 a 30 segundos:
  1. Abrir la app y tocar ▶.
  2. Bloquear el teléfono y mostrar los controles en la pantalla de bloqueo.
  3. Desbloquear, bajar la barra de notificaciones y pausar desde ahí.

  Súbelo a YouTube como **No listado** y pega el enlace.

## 4. Firma y subida

1. Crear la llave de subida, una sola vez (ver `README.md` → "Llave de subida").
2. `npm run sync` y luego `./gradlew bundleRelease` en `android-app/android`, o Android Studio → *Build → Generate Signed App Bundle*.
3. El archivo queda en `android/app/build/outputs/bundle/release/app-release.aab`.
4. Al subir el primer `.aab`, Play Console activa **Firma de apps de Google Play**: Google guarda la llave final y tu llave solo sirve para subir versiones. Si algún día la pierdes, se puede pedir un cambio.

## 5. Pruebas

**Prueba interna** (Probar y publicar → Pruebas → Prueba interna):
- Crear una lista de testers con los correos de Gmail con los que cada uno entra a Play Store.
- Crear versión → subir el `.aab` → notas: `Primera versión de prueba.` → Publicar.
- Copiar el **enlace de participación** y enviarlo a los testers.

**Prueba cerrada** (Probar y publicar → Pruebas → Prueba cerrada → Alpha):
- Países: Chile (y los demás donde estén los testers).
- Testers: la misma lista de correos, con al menos 12 personas.
- Crear versión → reutilizar el mismo `.aab` desde la biblioteca → Enviar a revisión.
- Cuando se apruebe, enviar el enlace de participación. Cada tester debe abrirlo, tocar **"Convertirse en tester"** e instalar desde Play Store.

## 6. Solicitud de acceso a producción (después de 14 días)

Borradores de respuesta; ajústalos a lo que realmente pase en la prueba:
- **¿Cómo reclutaste testers?** `Invitamos a miembros de la Iglesia Toda la Gloria para Dios y oyentes de Radio Bendición, que usan la radio a diario.`
- **Interacción de los testers:** `Los testers escucharon la radio a diario, también con la pantalla bloqueada, leyeron el devocional, activaron los avisos diarios, compartieron contenido y enviaron peticiones de oración.`
- **Resumen de comentarios:** `Recogimos comentarios por WhatsApp. Ajustamos la reconexión automática de la radio y la presentación de la programación.`
