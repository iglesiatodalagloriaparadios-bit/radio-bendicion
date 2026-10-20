$(document).ready(function () {

    const $body = $('body');

    // --- Almacenamiento local seguro (puede fallar en modo privado) ---
    function storageGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* sin almacenamiento */ }
    }

    // --- Notificación flotante (toast) ---
    const $toast = $('#toast');
    const $toastText = $('#toastText');
    const $toastAction = $('#toastAction');
    let toastTimer = null;

    // action: { label, fn } opcional; ms = 0 deja el aviso abierto hasta que se cierre
    function showToast(message, action, ms) {
        clearTimeout(toastTimer);
        $toastText.text(message);
        $toastAction.off('click');
        if (action) {
            $toastAction.text(action.label).prop('hidden', false).on('click', function () {
                hideToast();
                action.fn();
            });
        } else {
            $toastAction.prop('hidden', true);
        }
        $toast.prop('hidden', false);
        if (ms !== 0) {
            toastTimer = setTimeout(hideToast, ms || 3200);
        }
    }

    function hideToast() {
        clearTimeout(toastTimer);
        $toast.prop('hidden', true);
    }

    $('#toastClose').on('click', hideToast);

    // --- Estado del reproductor (declarado aquí porque lo usa la lógica de actualizaciones) ---
    let isPlayingState = false; // true si el usuario quiere que la radio suene
    let isBuffering = false;
    let connectFailed = false;  // el último intento de conexión falló

    // --- Registro del Service Worker para PWA con Detección de Actualizaciones ---
    // Cuando hay una versión nueva se ofrece el botón "Actualizar" (aviso flotante y tarjeta en "Más");
    // la app nunca se recarga sola, así no se corta la radio ni se pierde lo que se está escribiendo.
    let userClickedUpdate = false;
    let swRegistration = null;
    let waitingWorker = null;
    let manualUpdateCheck = false;

    if ('serviceWorker' in navigator) {
        // Comprobar actualizaciones cada vez que se vuelve a abrir la app (entra en primer plano)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && swRegistration) {
                console.log('App en primer plano: buscando actualizaciones PWA...');
                swRegistration.update().catch(() => {});
            }
        });

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    swRegistration = reg;
                    console.log('Service Worker registrado con éxito:', reg.scope);

                    // Buscar una actualización de inmediato al abrir la página
                    reg.update().catch(() => {});

                    // Detectar si hay una actualización en cola o en curso
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                // Si el nuevo SW terminó de instalarse y ya está en espera (waiting)
                                if (newWorker.state === 'installed') {
                                    handleUpdate(newWorker);
                                }
                            });
                        }
                    });

                    // Si ya hay un SW esperando en segundo plano al cargar la página
                    if (reg.waiting) {
                        handleUpdate(reg.waiting);
                    }

                    showAppVersion();
                })
                .catch(error => {
                    console.log('Registro de Service Worker fallido:', error);
                });
        });

        // Recargar la página una sola vez al activarse el nuevo Service Worker
        let refreshing = false;
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing && hadController) {
                // Si la radio está reproduciendo y el usuario NO tocó "Actualizar"
                // (por ejemplo, la actualización se activó desde otra pestaña), posponemos la recarga
                // para no interrumpir la reproducción.
                if (isPlayingState && !userClickedUpdate) {
                    console.log('Nueva versión activada; la recarga se pospone porque la radio está sonando.');
                    return;
                }
                refreshing = true;
                window.location.reload();
            }
        });
    }

    // Hay una versión nueva instalada y esperando: ofrecer el botón para aplicarla
    function handleUpdate(worker) {
        if (!navigator.serviceWorker.controller) {
            // Primera instalación (no había versión anterior): no hay nada que actualizar
            return;
        }
        waitingWorker = worker;
        manualUpdateCheck = false;
        $('#updateCard').prop('hidden', false);
        showToast(isPlayingState
            ? 'Hay una versión nueva. Al actualizar se reiniciará la radio.'
            : 'Hay una versión nueva de la app.', {
            label: 'Actualizar',
            fn: applyUpdate
        }, 0);
    }

    function applyUpdate() {
        userClickedUpdate = true;
        if (waitingWorker) {
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        } else {
            window.location.reload();
        }
    }

    $('.js-apply-update').on('click', applyUpdate);

    // Botón "Buscar actualizaciones" en "Más"
    $('.js-check-update').on('click', function () {
        if (!swRegistration) {
            showToast('No se pudo buscar actualizaciones en este navegador.');
            return;
        }
        if (waitingWorker) {
            handleUpdate(waitingWorker);
            return;
        }
        if (!navigator.onLine) {
            showToast('Necesitas conexión a internet para buscar actualizaciones.');
            return;
        }
        manualUpdateCheck = true;
        showToast('Buscando actualizaciones…');
        swRegistration.update().then(() => {
            // Si hay una versión nueva, 'updatefound' mostrará el botón; si no, avisamos
            setTimeout(() => {
                if (manualUpdateCheck && !swRegistration.installing && !swRegistration.waiting) {
                    manualUpdateCheck = false;
                    showToast('Ya tienes la última versión.');
                }
            }, 1500);
        }).catch(() => {
            manualUpdateCheck = false;
            showToast('No se pudo buscar actualizaciones. Intenta más tarde.');
        });
    });

    // Mostrar la versión instalada (la informa el Service Worker)
    function showAppVersion() {
        const controller = navigator.serviceWorker.controller;
        if (!controller || typeof MessageChannel === 'undefined') return;
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => {
            if (e.data && e.data.version) $('#appVersion').text(e.data.version);
        };
        controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    }

    // --- Tema claro / oscuro ---
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        storageSet('theme', theme);
        $('.js-theme').attr('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
        updateThemeColor();
    }

    // Color de la barra de estado del teléfono según la pantalla (rojo en Radio, fondo en el resto)
    function updateThemeColor() {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const onRadio = $body.attr('data-view') === 'radio';
        const color = onRadio ? '#921628' : (dark ? '#171214' : '#f8f2ec');
        $('meta[name="theme-color"]').attr('content', color);
    }

    // Vibración breve al tocar (solo Android; en el resto no hace nada)
    function haptic() {
        if (navigator.vibrate && window.matchMedia('(pointer: coarse)').matches) {
            try { navigator.vibrate(8); } catch (e) { /* sin vibración */ }
        }
    }

    // Teclado abierto en móvil: ocultar la barra inferior para que no tape los campos
    if (window.visualViewport) {
        const baseHeight = window.innerHeight;
        window.visualViewport.addEventListener('resize', () => {
            const keyboardOpen = window.visualViewport.height < baseHeight * 0.75
                && /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '');
            $body.toggleClass('keyboard-open', keyboardOpen);
        });
    }

    setTheme(storageGet('theme') === 'dark' ? 'dark' : 'light');

    $('.js-theme').on('click', function () {
        setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // --- Navegación entre vistas (Radio, Devocional, Oración, App) ---
    const VIEWS = ['radio', 'devocional', 'oracion', 'app'];
    let currentView = null;

    function viewFromHash() {
        const hash = window.location.hash.replace('#', '');
        // Enlaces antiguos (#inicio, #iglesia, #horarios...) llevan a la radio
        return VIEWS.includes(hash) ? hash : 'radio';
    }

    const scrollByView = {};

    function showView(view) {
        if (view === currentView) return;
        if (currentView) scrollByView[currentView] = window.scrollY;
        const isFirstView = currentView === null;
        currentView = view;
        $body.attr('data-view', view);
        updateThemeColor();
        if (!isFirstView) haptic();

        $('.view').each(function () {
            this.hidden = this.dataset.view !== view;
        });
        $('[data-nav]').each(function () {
            if (this.dataset.nav === view) {
                this.setAttribute('aria-current', 'page');
            } else {
                this.removeAttribute('aria-current');
            }
        });

        // Cada pestaña vuelve a donde se dejó, como en una app
        window.scrollTo(0, scrollByView[view] || 0);
        updateMini();
        if (view === 'radio') {
            setTimeout(layoutMobileArt, 30);
        }
        if (view === 'devocional') {
            centerSelectedDay();
        }
    }

    function goTo(view) {
        if (window.location.hash !== '#' + view) {
            window.location.hash = view;
        } else {
            showView(view);
        }
    }

    $(window).on('hashchange', function () {
        showView(viewFromHash());
    });

    // --- Portada: escenas de fondo que se alternan cada 6 segundos ---
    const $scenes = $('.scene');
    let sceneIndex = 0;
    setInterval(() => {
        if (document.hidden || currentView !== 'radio') return;
        $scenes.eq(sceneIndex).removeClass('is-active');
        sceneIndex = (sceneIndex + 1) % $scenes.length;
        $scenes.eq(sceneIndex).addClass('is-active');
    }, 6000);

    // --- Lógica de Instalación de PWA (Android & iOS) ---
    let deferredPrompt = null;
    const $installBtn = $('#installAppBtn');
    const $installLabel = $('#installLabel');

    // Detección de iOS (iPhone, iPad, iPod)
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

    // Detección de si la app ya está instalada (en modo de pantalla completa/standalone)
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    function markInstalled() {
        $installLabel.text('Ya está instalada');
        $installBtn.prop('disabled', true);
    }

    if (isStandalone) {
        markInstalled();
    } else if (isIos) {
        $installLabel.text('Ver cómo instalar');
    }

    // Comportamiento nativo de PWA para Android/Chrome/Edge/Desktop
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA instalada correctamente');
        deferredPrompt = null;
        markInstalled();
    });

    $installBtn.on('click', async function () {
        if (isIos) {
            openIosGuide();
            return;
        }
        if (!deferredPrompt) {
            showToast('Abre el menú del navegador y elige “Instalar aplicación”.');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Elección de instalación: ${outcome}`);
        deferredPrompt = null;
        if (outcome === 'accepted') {
            showToast('¡Listo! Radio Bendición ya está en tu inicio.');
        }
    });

    // Guía de instalación para iOS
    const $iosGuide = $('#iosGuideModal');
    const $iosBanner = $('#iosBanner');

    function openIosGuide() {
        $iosGuide.prop('hidden', false);
        $iosGuide.find('.js-close-ios-guide').last().trigger('focus');
    }

    function closeIosGuide() {
        $iosGuide.prop('hidden', true);
    }

    if (isIos && !isStandalone && !storageGet('ios-install-banner-closed')) {
        $iosBanner.prop('hidden', false);
    }

    $('.js-open-ios-guide').on('click', openIosGuide);
    $('.js-close-ios-guide').on('click', closeIosGuide);

    // Cerrar al hacer clic en el fondo
    $iosGuide.on('click', function (e) {
        if ($(e.target).is($iosGuide)) {
            closeIosGuide();
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && !$iosGuide.prop('hidden')) {
            closeIosGuide();
        }
    });

    $('#closeIosBannerBtn').on('click', function () {
        $iosBanner.prop('hidden', true);
        storageSet('ios-install-banner-closed', 'true');
    });

    // --- Lógica del Reproductor de Radio ---
    const radioAudio = document.getElementById('radioAudio');
    const $wakeBadge = $('#wakeBadge');
    const $mini = $('#mini');

    // URL de la señal de streaming y API de AzuraCast
    const STREAM_URL = 'https://radio.radiobendicion.cl/listen/radio_bendici%C3%B3n/radio.mp3';
    const API_URL = 'https://radio.radiobendicion.cl/api/nowplaying_static/radio_bendici%C3%B3n.json';

    const GENERIC_TITLE = 'Radio Bendición en vivo';
    const GENERIC_ARTIST = 'Alabanza y Palabra las 24 horas';
    let currentSong = null; // { title, artist } desde la API

    // --- Control de reconexión ---
    let reconnectTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 8; // con espera creciente: ~1 minuto de reintentos (cambio Wi-Fi ↔ datos, red dormida)

    // --- Wake Lock y auto-resume para segundo plano ---
    let wakeLock = null;
    let autoResumeCount = 0;
    let lastAutoResumeTime = 0;

    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            console.log('Screen Wake Lock no es soportado por este navegador.');
            return;
        }
        if (isPlayingState && wakeLock === null) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock activado correctamente.');
                $wakeBadge.prop('hidden', false);
                wakeLock.addEventListener('release', () => {
                    console.log('Screen Wake Lock fue liberado.');
                    wakeLock = null;
                    $wakeBadge.prop('hidden', true);
                });
            } catch (err) {
                console.warn(`No se pudo obtener el Screen Wake Lock: ${err.message}`);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release().then(() => {
                wakeLock = null;
                $wakeBadge.prop('hidden', true);
                console.log('Screen Wake Lock liberado manualmente.');
            }).catch(err => {
                console.warn('Error al liberar el Screen Wake Lock:', err);
            });
        }
    }

    function resetReconnect() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        retryCount = 0;
    }

    // --- Soporte de Media Session API ---
    function updateMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentSong ? currentSong.title : 'Radio Bendición',
                artist: currentSong ? (currentSong.artist || 'Radio Bendición') : 'Señal en Vivo',
                album: 'Radio Bendición · En vivo',
                artwork: [
                    { src: window.location.origin + '/images/logo-192.png', sizes: '192x192', type: 'image/png' },
                    { src: window.location.origin + '/images/logo-512.png', sizes: '512x512', type: 'image/png' }
                ]
            });
        }
    }

    function updateMediaPlaybackState(state) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = state; // 'playing', 'paused', or 'none'
        }
    }

    // Configurar controladores de Media Session una sola vez
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', function () {
            if (!isPlayingState) {
                startPlayback();
            } else if (radioAudio.paused) {
                // Play desde la pantalla de bloqueo cuando la señal quedó detenida
                resetReconnect();
                attemptReconnect();
            }
        });
        navigator.mediaSession.setActionHandler('pause', function () {
            if (isPlayingState) {
                stopPlayback();
            }
        });
        navigator.mediaSession.setActionHandler('stop', function () {
            if (isPlayingState) {
                stopPlayback();
            }
        });
        navigator.mediaSession.setActionHandler('previoustrack', function () {
            console.log("Media Session: previoustrack pulsado.");
            if (isPlayingState) {
                attemptReconnect();
            }
        });
        navigator.mediaSession.setActionHandler('nexttrack', function () {
            console.log("Media Session: nexttrack pulsado.");
            if (isPlayingState) {
                attemptReconnect();
            }
        });
    }

    function attemptReconnect() {
        // Si el usuario pausó manualmente o no hay conexión de red, no hacemos nada
        if (!isPlayingState || !navigator.onLine) {
            resetReconnect();
            return;
        }

        if (retryCount >= MAX_RETRIES) {
            console.warn("Límite de reconexiones alcanzado");
            showToast('Se interrumpió la señal. Toca reproducir para intentar de nuevo.');
            isPlayingState = false;
            isBuffering = false;
            connectFailed = true;
            resetReconnect();
            // Asegurar descarga limpia ante desconexión permanente
            radioAudio.removeAttribute('src');
            radioAudio.load();
            updatePlayerUI();
            updateMediaPlaybackState('paused');
            releaseWakeLock();
            return;
        }

        retryCount++;
        console.log(`Reconectando... Intento ${retryCount}/${MAX_RETRIES}`);
        isBuffering = true;
        updatePlayerUI();

        // Asignar URL fresca con cache-buster para evitar búfer muerto en caché del navegador
        radioAudio.src = `${STREAM_URL}?t=${Date.now()}`;

        radioAudio.play().then(() => {
            console.log("Reconexión exitosa.");
            isBuffering = false;
            resetReconnect();
            updatePlayerUI();
            updateMediaPlaybackState('playing');
            requestWakeLock(); // Asegurar que el wake lock esté activo al reconectar exitosamente
        }).catch(err => {
            console.error("Fallo al reconectar:", err);
            // Si el error es debido a restricciones del navegador para reproducir sin interacción
            if (err.name === 'NotAllowedError' && document.visibilityState === 'hidden') {
                // Con la pantalla bloqueada el sistema puede impedir reiniciar el audio: no nos rendimos,
                // se retoma al desbloquear o con el botón play de la pantalla de bloqueo
                console.warn("Reinicio bloqueado en segundo plano. Se retomará al volver a la app.");
                isBuffering = false;
                resetReconnect();
                updatePlayerUI();
                updateMediaPlaybackState('paused');
            } else if (err.name === 'NotAllowedError') {
                console.warn("Reproducción automática bloqueada por el navegador. Deteniendo reconexión automática.");
                isPlayingState = false;
                isBuffering = false;
                resetReconnect();
                radioAudio.removeAttribute('src');
                radioAudio.load();
                updatePlayerUI();
                showToast('El navegador pausó la radio. Toca reproducir para escuchar.');
                releaseWakeLock();
            } else {
                // Programar el siguiente intento para problemas de red, esperando cada vez un poco más
                // (2s, 4s, 6s… hasta 10s) para dar tiempo a que el teléfono recupere la conexión
                const delay = Math.min(2000 * retryCount, 10000);
                console.log(`Fallo de red. Programando reconexión en ${delay}ms...`);
                reconnectTimeout = setTimeout(attemptReconnect, delay);
            }
        });
    }

    function updateNowPlaying() {
        // Intentar actualizar metadatos con cache-buster para evitar caché
        const urlWithCacheBuster = `${API_URL}?t=${Date.now()}`;

        $.getJSON(urlWithCacheBuster, function (data) {
            if (data && data.now_playing && data.now_playing.song) {
                const song = data.now_playing.song;
                const title = (song.title || '').trim();
                if (title) {
                    currentSong = { title: title, artist: (song.artist || '').trim() };
                    updatePlayerUI();
                    updateMediaSession();
                }
            }
        }).fail(function () {
            console.warn('No se pudieron cargar los metadatos de la radio.');
        });
    }

    // Sincroniza toda la interfaz del reproductor (portada y mini reproductor) con el estado actual
    function updatePlayerUI() {
        let state;
        let statusText;

        if (!navigator.onLine) {
            state = 'offline';
            statusText = 'Sin conexión · volverá sola';
        } else if (isPlayingState && isBuffering) {
            state = 'busy';
            statusText = retryCount > 0
                ? `Reconectando (${retryCount} de ${MAX_RETRIES})…`
                : 'Conectando con la señal…';
        } else if (isPlayingState && radioAudio.paused) {
            state = 'busy';
            statusText = 'Recuperando el audio…';
        } else if (isPlayingState) {
            state = 'playing';
            statusText = 'Sonando en vivo';
        } else if (connectFailed) {
            state = 'error';
            statusText = 'No pudimos conectar. Intenta otra vez.';
        } else {
            state = 'idle';
            statusText = 'Toca para escuchar en vivo';
        }

        $body.attr('data-player', state);
        $('.js-status-text').text(statusText);

        const title = currentSong ? currentSong.title : GENERIC_TITLE;
        const artist = currentSong ? (currentSong.artist || 'Radio Bendición') : GENERIC_ARTIST;
        const $titles = $('.js-track-title');
        if ($titles.first().text() !== title) {
            $titles.text(title);
            // Reiniciar la animación de entrada del título en la portada
            document.querySelectorAll('.now-title, .m-title').forEach(el => {
                el.classList.remove('is-changing');
                void el.offsetWidth;
                el.classList.add('is-changing');
            });
            layoutMobileArt();
        }
        $('.js-track-artist').text(artist);

        $('.js-toggle-play')
            .attr('aria-label', isPlayingState ? 'Pausar radio' : 'Escuchar radio')
            .prop('disabled', !navigator.onLine);

        updateMini();
    }

    // Mini reproductor: visible fuera de la vista Radio mientras suena
    function updateMini() {
        const show = currentView !== null && currentView !== 'radio' && isPlayingState;
        $mini.prop('hidden', !show);
        $body.toggleClass('has-mini', show);
    }

    // --- Control de Polling de Metadatos ---
    let metadataInterval = null;

    function startMetadataPolling() {
        if (!metadataInterval) {
            updateNowPlaying();
            metadataInterval = setInterval(updateNowPlaying, 8000);
        }
    }

    function stopMetadataPolling() {
        if (metadataInterval) {
            clearInterval(metadataInterval);
            metadataInterval = null;
        }
    }

    // --- Vigilante de la señal ---
    // Si el audio deja de avanzar (corte de red, stream congelado), reconecta aunque la pantalla esté bloqueada
    const STALL_LIMIT = 20000;
    let watchdogInterval = null;
    let lastProgressTime = 0;
    let lastProgressAt = 0;

    function startWatchdog() {
        if (watchdogInterval) return;
        lastProgressTime = radioAudio.currentTime;
        lastProgressAt = Date.now();
        watchdogInterval = setInterval(checkProgress, 5000);
    }

    function stopWatchdog() {
        if (watchdogInterval) {
            clearInterval(watchdogInterval);
            watchdogInterval = null;
        }
    }

    function checkProgress() {
        if (!isPlayingState) {
            stopWatchdog();
            return;
        }
        if (radioAudio.currentTime !== lastProgressTime) {
            lastProgressTime = radioAudio.currentTime;
            lastProgressAt = Date.now();
            return;
        }
        // Ya hay un reintento agendado o no hay red (el evento 'online' se encarga)
        if (reconnectTimeout || !navigator.onLine) return;
        if (Date.now() - lastProgressAt > STALL_LIMIT) {
            console.warn('La señal no avanza hace 20 s. Reconectando...');
            lastProgressAt = Date.now();
            attemptReconnect();
        }
    }

    // Cargar metadatos iniciales una vez al abrir la página
    updateNowPlaying();

    // Eventos del elemento de audio para actualizar la interfaz inmediatamente
    $(radioAudio).on('play', function () {
        isPlayingState = true;
        isBuffering = true;
        connectFailed = false;

        updatePlayerUI();
        startMetadataPolling(); // Polling activo solo al reproducir
        updateMediaPlaybackState('playing');
        updateMediaSession();
        requestWakeLock(); // Activar el wake lock cuando comience a sonar
        startWatchdog();
    });

    $(radioAudio).on('playing', function () {
        isBuffering = false;
        resetReconnect();

        updatePlayerUI();
        updateMediaPlaybackState('playing');
        requestWakeLock(); // Asegurar wake lock activo
    });

    // Si el audio se estanca, primero dejamos que el navegador recupere el búfer;
    // si no avanza en 20 s, el vigilante de la señal reconecta (también con la pantalla bloqueada)
    $(radioAudio).on('waiting', function () {
        isBuffering = true;
        updatePlayerUI();
    });

    // En una radio en vivo, 'ended' significa que la red o el servidor cortó la conexión
    $(radioAudio).on('ended', function () {
        if (isPlayingState) {
            console.warn('El stream se cortó. Reconectando...');
            attemptReconnect();
        }
    });

    $(radioAudio).on('pause', function () {
        isBuffering = false;

        updatePlayerUI();
        stopMetadataPolling(); // Detener polling en pausa
        updateMediaPlaybackState('paused');

        if (!isPlayingState) {
            // Si el usuario pausó explícitamente, liberamos el wake lock
            releaseWakeLock();
        } else if (!radioAudio.ended && navigator.onLine && !$body.hasClass('is-offline')) {
            // El audio fue pausado por el OS/navegador inesperadamente en segundo plano
            console.warn("Audio pausado inesperadamente en segundo plano. Intentando recuperar reproducción...");
            const now = Date.now();
            if (now - lastAutoResumeTime > 10000) {
                autoResumeCount = 0; // Reiniciar contador tras 10 segundos
            }
            if (autoResumeCount < 3) {
                autoResumeCount++;
                lastAutoResumeTime = now;
                console.log(`Intentando reanudar audio automáticamente (intento ${autoResumeCount}/3)...`);
                setTimeout(() => {
                    if (isPlayingState && radioAudio.paused) {
                        radioAudio.play().catch(err => {
                            console.error("Fallo al reanudar automáticamente:", err);
                        });
                    }
                }, 1000);
            }
        }
    });

    $(radioAudio).on('error', function (e) {
        // Al quitar el src a propósito (pausa) el navegador también emite 'error': lo ignoramos
        if (!radioAudio.getAttribute('src')) return;

        console.error("Error en elemento de audio:", e);
        isBuffering = false;

        stopMetadataPolling(); // Detener polling ante error

        if (isPlayingState) {
            console.log("Error detectado en reproducción activa. Intentando reconectar inmediatamente...");
            attemptReconnect();
        } else {
            connectFailed = true;
            updatePlayerUI();
            updateMediaPlaybackState('none');
            releaseWakeLock();
        }
    });

    function startPlayback() {
        if (!navigator.onLine) {
            showToast('No tienes conexión a internet para reproducir la radio.');
            return;
        }
        isPlayingState = true;
        isBuffering = true;
        connectFailed = false;
        resetReconnect();
        updatePlayerUI();

        // Asignar URL con cache-buster al iniciar para forzar conexión fresca
        radioAudio.src = `${STREAM_URL}?t=${Date.now()}`;

        radioAudio.play().then(() => {
            // La interfaz se sincroniza con los eventos del elemento 'audio'
            updateMediaSession();
        }).catch(err => {
            console.error("Error al reproducir:", err);
            isBuffering = false;
            isPlayingState = false;
            connectFailed = err.name !== 'NotAllowedError' && err.name !== 'AbortError';
            radioAudio.removeAttribute('src');
            radioAudio.load();
            updatePlayerUI();
            updateMediaPlaybackState('none');
        });
    }

    function stopPlayback() {
        isPlayingState = false;
        isBuffering = false;
        resetReconnect();
        stopWatchdog();
        radioAudio.pause();
        // Liberar conexión de red y detener descarga de datos móviles
        radioAudio.removeAttribute('src');
        radioAudio.load();
        stopMetadataPolling();
        releaseWakeLock();
        updateMediaPlaybackState('paused');
        updatePlayerUI();
    }

    $(document).on('click', '.js-toggle-play', function () {
        haptic();
        if (isPlayingState) {
            stopPlayback();
        } else {
            startPlayback();
        }
    });

    // Reanudar la radio si la pestaña estuvo suspendida en segundo plano y el audio se detuvo
    $(document).on('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            if (isPlayingState) {
                requestWakeLock(); // Volver a solicitar wake lock al regresar al primer plano
                if (radioAudio.paused) {
                    console.log("Pestaña visible nuevamente y el audio está pausado. Intentando reconectar...");
                    attemptReconnect();
                }
            }
        } else {
            // El OS libera el wake lock cuando el documento se oculta, pero liberamos de manera limpia
            releaseWakeLock();
        }
    });

    // --- Detección de Transmisión en Vivo en YouTube ---
    const YOUTUBE_CHANNEL_ID = 'UCdtFAwglkI3zvibkt8YHiZw'; // ID de canal de YouTube
    const YOUTUBE_API_KEY = 'AIzaSyCKVAT0CX0Oj6He8CCEIDzsdenEHI1yn9E';       // API Key de Google Developer
    const ytLiveBtn = $('.js-yt-live');

    // Lista de subidas del canal (mismo ID cambiando el prefijo "UC" por "UU")
    const YOUTUBE_UPLOADS_PLAYLIST = 'UU' + YOUTUBE_CHANNEL_ID.slice(2);
    const YT_CHECK_INTERVAL = 300000; // 5 minutos
    let lastYouTubeCheck = 0;

    // Usa playlistItems.list + videos.list (1 unidad de cuota cada uno) en lugar de
    // search.list (100 unidades), para no agotar la cuota diaria de 10.000 unidades.
    async function checkYouTubeLive() {
        if (!YOUTUBE_CHANNEL_ID || !YOUTUBE_API_KEY || YOUTUBE_CHANNEL_ID.startsWith('YOUR_') || YOUTUBE_API_KEY.startsWith('YOUR_')) {
            ytLiveBtn.prop('hidden', true);
            return;
        }
        if (!navigator.onLine) return;

        lastYouTubeCheck = Date.now();
        const API_BASE = 'https://www.googleapis.com/youtube/v3';

        try {
            // 1. Últimos videos subidos (las transmisiones en vivo aparecen aquí)
            const playlistResponse = await fetch(`${API_BASE}/playlistItems?part=contentDetails&maxResults=5&playlistId=${YOUTUBE_UPLOADS_PLAYLIST}&key=${YOUTUBE_API_KEY}`);
            const playlistData = await playlistResponse.json();
            const videoIds = (playlistData.items || []).map(item => item.contentDetails.videoId);

            if (videoIds.length === 0) {
                ytLiveBtn.prop('hidden', true);
                return;
            }

            // 2. Revisar cuál de ellos está en vivo ahora mismo
            const videosResponse = await fetch(`${API_BASE}/videos?part=snippet&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`);
            const videosData = await videosResponse.json();
            const liveVideo = (videosData.items || []).find(video => video.snippet.liveBroadcastContent === 'live');

            if (liveVideo) {
                // Enlazar al video en vivo actual
                ytLiveBtn.attr('href', `https://www.youtube.com/watch?v=${liveVideo.id}`);
                ytLiveBtn.prop('hidden', false);
            } else {
                ytLiveBtn.prop('hidden', true);
            }
        } catch (error) {
            console.error('Error al verificar la transmisión en vivo de YouTube:', error);
            ytLiveBtn.prop('hidden', true);
        }
    }

    // Verificación inicial
    checkYouTubeLive();
    // Verificar cada 5 minutos, solo si la página está visible (pestañas ocultas no gastan cuota)
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            checkYouTubeLive();
        }
    }, YT_CHECK_INTERVAL);
    // Al volver a la página, verificar si ya pasó el intervalo
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastYouTubeCheck > YT_CHECK_INTERVAL) {
            checkYouTubeLive();
        }
    });

    // --- Programación semanal de la radio (portada en escritorio, "Más" en móvil) ---
    // dow: 0 = domingo ... 6 = sábado. Solo la hora de inicio de cada programa.
    const PROGRAMACION = [
        { dow: 1, time: '19:00', name: 'Rescatando tu valor' },
        { dow: 3, time: '19:00', name: 'Restaurando vidas' },
        { dow: 4, time: '19:00', name: 'Psicología y Fe' },
        { dow: 4, time: '20:00', name: 'Cautivadas por su Gracia' },
        { dow: 6, time: '11:00', name: 'Cristo nos une' },
        { dow: 6, time: '15:00', name: 'Generación con Propósito' },
        { dow: 6, time: '16:00', name: 'Jesús es la Única Esperanza' },
        { dow: 6, time: '20:00', name: 'Mi Testimonio' },
        { dow: 0, time: '18:00', name: 'Evangelizando con los Soldados de Cristo' },
        { dow: 0, time: '19:00', name: 'Unidos en Cristo' }
    ];
    const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes
    const WEEK_DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    $('.js-schedule').each(function () {
        const $sched = $(this);
        WEEK_ORDER.forEach(dow => {
            const programs = PROGRAMACION.map((p, i) => ({ ...p, i })).filter(p => p.dow === dow);
            if (programs.length === 0) return;
            const $slots = $('<div class="sched-slots"></div>');
            programs.forEach(p => {
                $('<div class="sched-slot"></div>').attr('data-index', p.i).append(
                    $('<span class="sched-time"></span>').text(p.time),
                    $('<span class="sched-text"></span>').append(
                        $('<span class="sched-name"></span>').text(p.name),
                        $('<span class="sched-tag" hidden>PRÓXIMO</span>')
                    )
                ).appendTo($slots);
            });
            $('<div class="sched-day"></div>').attr('data-dow', dow).append(
                $('<div class="sched-day-name"></div>').text(WEEK_DAY_NAMES[dow]),
                $slots
            ).appendTo($sched);
        });
    });

    // Destaca el día de hoy y el próximo programa en comenzar
    function highlightSchedule() {
        const now = new Date();
        const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
        const WEEK = 7 * 1440;
        let nextIndex = -1;
        let nextDelta = Infinity;

        PROGRAMACION.forEach((p, i) => {
            const [h, m] = p.time.split(':').map(Number);
            const delta = (p.dow * 1440 + h * 60 + m - nowMin + WEEK) % WEEK;
            if (delta > 0 && delta < nextDelta) {
                nextDelta = delta;
                nextIndex = i;
            }
        });

        $('.js-schedule .sched-day').each(function () {
            $(this).toggleClass('is-today', Number(this.dataset.dow) === now.getDay());
        });
        $('.js-schedule .sched-slot').each(function () {
            const isNext = Number(this.dataset.index) === nextIndex;
            $(this).toggleClass('is-next', isNext).find('.sched-tag').prop('hidden', !isNext);
        });

        // Chip "Luego" en la portada móvil
        if (nextIndex >= 0) {
            const next = PROGRAMACION[nextIndex];
            const isToday = next.dow === now.getDay();
            const when = isToday ? next.time : `${WEEK_DAY_NAMES[next.dow]} ${next.time}`;
            $('.js-next-program').text(`${next.name} · ${when}`);
            $('.js-next-chip').prop('hidden', false);
        }
    }

    highlightSchedule();
    setInterval(highlightSchedule, 60000);

    // Compartir la imagen de la programación (póster para redes)
    const SCHEDULE_IMAGE = '/images/programacion-semanal.png';

    $('.js-share-schedule').on('click', async function () {
        try {
            const blob = await (await fetch(SCHEDULE_IMAGE)).blob();
            const file = new File([blob], 'programacion-radio-bendicion.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Programación semanal · Radio Bendición',
                    text: 'Programación semanal de Radio Bendición. Escúchanos en radiobendicion.cl'
                });
                return;
            }
        } catch (err) {
            if (err && err.name === 'AbortError') return; // el usuario cerró el menú de compartir
            console.warn('No se pudo compartir la imagen:', err);
        }
        // Respaldo: descargar la imagen
        const link = document.createElement('a');
        link.href = SCHEDULE_IMAGE;
        link.download = 'programacion-radio-bendicion.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('Descargamos la imagen de la programación para que la compartas.');
    });

    // --- Reuniones de la iglesia (portada en escritorio, "Más" en móvil) ---
    const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const MEETINGS = [
        { dow: 2, time: '19:00', name: 'Reunión de mujeres' },
        { dow: 5, time: '19:30', name: 'Culto general' },
        { dow: 6, time: '16:00', name: 'Escuela Dominical' },
        { dow: 6, time: '18:00', name: 'Reunión de jóvenes' },
        { dow: 0, time: '10:30', name: 'Culto general' }
    ];
    const MEETING_LENGTH_MIN = 120; // una reunión se considera "en curso" durante 2 horas

    $('.js-meetings').each(function () {
        const $list = $(this);
        MEETINGS.forEach((meeting, i) => {
            $('<article class="pill"></article>').attr('data-index', i).append(
                $('<span class="pill-dot"></span>').text(meeting.time),
                $('<span class="pill-text"></span>').append(
                    $('<span class="pill-name"></span>').text(meeting.name),
                    $('<span class="pill-sub"></span>')
                )
            ).appendTo($list);
        });
    });

    function highlightNextMeeting() {
        const now = new Date();
        const nowMin = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
        const WEEK = 7 * 1440;
        let bestIndex = -1;
        let bestDelta = Infinity;

        MEETINGS.forEach((meeting, i) => {
            const [h, m] = meeting.time.split(':').map(Number);
            const start = meeting.dow * 1440 + h * 60 + m;
            // Minutos hasta el próximo inicio; negativo pequeño = en curso
            let delta = (start - nowMin + WEEK) % WEEK;
            if (delta > WEEK - MEETING_LENGTH_MIN) delta -= WEEK;
            if (delta < bestDelta) {
                bestDelta = delta;
                bestIndex = i;
            }
        });

        $('.js-meetings .pill').each(function () {
            const i = Number(this.dataset.index);
            const meeting = MEETINGS[i];
            const when = meeting.dow === now.getDay() ? 'Hoy' : DAY_NAMES[meeting.dow];
            let sub = when;
            if (i === bestIndex) {
                sub = bestDelta <= 0 ? 'En curso ahora' : `Próxima · ${when}`;
            }
            $(this).toggleClass('is-next', i === bestIndex).find('.pill-sub').text(sub);
        });

    }

    highlightNextMeeting();
    setInterval(highlightNextMeeting, 60000);

    // --- Portada móvil: ubicar el monte con la cruz en el espacio libre sobre el reproductor ---
    const heroBg = document.querySelector('.hero-bg');
    const mobilePlayer = document.querySelector('.m-player');
    const desktopQuery = window.matchMedia('(min-width: 820px)');

    function layoutMobileArt() {
        if (desktopQuery.matches || currentView !== 'radio' || !mobilePlayer) return;
        const vw = window.innerWidth || 390;
        const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 800;
        const headerBottom = 76;
        const blockTop = mobilePlayer.getBoundingClientRect().top + 4 || vh * 0.6;
        const free = Math.max(40, blockTop - headerBottom);
        const base = Math.min(vw, 520);
        const k = Math.min(2.4, Math.max(0.5, (0.42 * free) / (base / 6)));
        const artW = base * k;
        const artH = artW * 0.75;
        // La cruz queda a un tercio del ancho y centrada en el espacio libre
        // (0.597 = posición vertical de la cruz dentro del dibujo)
        heroBg.style.setProperty('--art-w', artW + 'px');
        heroBg.style.setProperty('--art-left', (vw * 0.33 - 0.33 * artW) + 'px');
        heroBg.style.setProperty('--art-top', (headerBottom + free / 2 - 0.597 * artH) + 'px');
    }

    window.addEventListener('resize', layoutMobileArt);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layoutMobileArt);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutMobileArt);

    // --- Copiar texto al portapapeles (API moderna con respaldo para navegadores antiguos) ---
    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            const dummy = document.createElement('textarea');
            dummy.value = text;
            dummy.style.position = 'fixed';
            dummy.style.opacity = '0';
            document.body.appendChild(dummy);
            dummy.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(dummy);
            ok ? resolve() : reject(new Error('No se pudo copiar'));
        });
    }

    // --- Lógica de Compartir Señal ---
    $('.js-share').on('click', function () {
        const shareData = {
            title: 'Radio Bendición',
            text: 'Escucha Radio Bendición en vivo: música y Palabra las 24 horas.',
            url: window.location.origin || window.location.href
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData)
                .then(() => console.log('Señal compartida con éxito'))
                .catch((err) => console.log('Error al compartir:', err));
        } else {
            // Fallback: copiar al portapapeles
            copyToClipboard(shareData.text + ' ' + shareData.url)
                .then(() => showToast('Enlace copiado. ¡Compártelo!'))
                .catch(() => showToast('No se pudo copiar el enlace.'));
        }
    });

    // --- Lógica de Peticiones de Oración ---
    const WHATSAPP_NUMBER = '56957906866';
    const $prayerForm = $('#prayerForm');
    const $prayerName = $('#prayerName');
    const $prayerDetails = $('#prayerDetails');
    const $prayerAire = $('#prayerAire');
    const $prayerError = $('#prayerError');
    const $prayerPreview = $('#prayerPreview');

    function buildPrayerText() {
        const name = $prayerName.val().trim();
        const motivo = $prayerForm.find('input[name="motivo"]:checked').val();
        const details = $prayerDetails.val().trim();
        return `*Petición de Oración - Radio Bendición*\n` +
            (name ? `*Nombre:* ${name}\n` : '') +
            `*Motivo:* ${motivo}\n\n` +
            `${details}\n\n` +
            ($prayerAire.is(':checked') ? 'Pueden mencionarla al aire.' : 'Prefiero que sea privada.');
    }

    function updatePrayerPreview() {
        $prayerPreview.text($prayerDetails.val().trim()
            ? buildPrayerText().replace(/\*/g, '')
            : 'Tu petición aparecerá aquí mientras escribes.');
    }

    $prayerForm.on('input change', updatePrayerPreview);
    $prayerDetails.on('input', () => $prayerError.prop('hidden', true));

    // Envío del formulario a WhatsApp
    $prayerForm.on('submit', function (e) {
        e.preventDefault();

        if ($prayerDetails.val().trim().length < 5) {
            $prayerError.prop('hidden', false);
            $prayerDetails.trigger('focus');
            return;
        }

        const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildPrayerText())}`;
        window.open(waUrl, '_blank');
        showToast('Abrimos WhatsApp con tu petición. Estaremos orando por ti.');
    });

    // --- Lógica del Devocional Diario ---
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const $dayStrip = $('#dayStrip');
    const $devArticle = $('#devArticle');
    const todayNum = new Date().getDate(); // 1 al 31
    let selectedDay = todayNum;

    // Botones de los 31 días
    for (let n = 1; n <= 31; n++) {
        $('<button type="button" class="day"></button>')
            .text(n)
            .attr({ 'data-day': n, 'aria-label': `Día ${n}`, 'aria-pressed': 'false' })
            .toggleClass('is-today', n === todayNum)
            .appendTo($dayStrip);
    }

    $dayStrip.on('click', '.day', function () {
        renderDevotional(Number(this.dataset.day));
        centerSelectedDay();
    });

    // En móvil la tira de días se desplaza: centrar el día elegido
    function centerSelectedDay() {
        const strip = $dayStrip[0];
        const btn = strip.querySelector(`[data-day="${selectedDay}"]`);
        if (!btn || strip.scrollWidth <= strip.clientWidth) return;
        strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' });
    }

    function devotionalDateLabel(day) {
        const now = new Date();
        if (day === todayNum) return `Hoy, ${day} de ${MESES[now.getMonth()]}`;
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return day <= daysInMonth ? `${day} de ${MESES[now.getMonth()]}` : `Día ${day}`;
    }

    function devotionalShareText(d, day) {
        return `*Radio Bendición - Devocional del día ${day}*\n` +
            `*${d.titulo}*\n\n` +
            `_"${d.pasaje}"_ (${d.cita})\n\n` +
            `*Reflexión:* ${d.reflexion}\n\n` +
            `*Oración:* ${d.oracion}\n\n` +
            `Escucha la señal en vivo en: ${window.location.origin || 'https://radiobendicion.cl'}`;
    }

    function renderDevotional(day) {
        if (typeof DEVOTIONALS_DB === 'undefined') {
            console.warn('Base de datos de devocionales no cargada.');
            return;
        }
        const d = DEVOTIONALS_DB[day];
        if (!d) return;
        selectedDay = day;

        $dayStrip.find('.day').attr('aria-pressed', 'false');
        $dayStrip.find(`[data-day="${day}"]`).attr('aria-pressed', 'true');

        $('#devLabel').text(devotionalDateLabel(day));
        $('#devDayNum').text(day);
        $('#devotionalTitle').text(d.titulo);
        $('#devotionalVerseText').text(`“${d.pasaje}”`);
        $('#devotionalVerseCite').text(d.cita);
        $('#devotionalReflection').text(d.reflexion);
        $('#devotionalPrayer').text(d.oracion);

        $devArticle.removeClass('is-changing');
        void $devArticle[0].offsetWidth;
        $devArticle.addClass('is-changing');
    }

    $('#shareDevotionalWs').on('click', function () {
        const text = devotionalShareText(DEVOTIONALS_DB[selectedDay], selectedDay);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });

    $('#copyDevotionalBtn').on('click', function () {
        const text = devotionalShareText(DEVOTIONALS_DB[selectedDay], selectedDay).replace(/[*_]/g, '');
        copyToClipboard(text)
            .then(() => showToast('Devocional copiado.'))
            .catch(() => showToast('No se pudo copiar el devocional.'));
    });

    renderDevotional(todayNum);

    // --- Notificaciones de Devocionales ---
    const devotionalNotifyBtn = $('#devotionalNotifyBtn');

    function updateNotifyBtnUI(subscribed) {
        devotionalNotifyBtn.attr('aria-pressed', subscribed ? 'true' : 'false');
        $('#notifyLabel').text(subscribed ? 'Avisos activos' : 'Recibir avisos');
    }

    // Los avisos diarios usan Periodic Background Sync: el Service Worker se despierta
    // una vez al día y muestra el devocional desde la base local (sin servidor).
    // Solo está disponible en la app instalada en navegadores Chromium (Android).
    const DAILY_SYNC_TAG = 'daily-devotional';
    const supportsNotifications = 'Notification' in window;

    async function getPeriodicSyncRegistration() {
        if (!('serviceWorker' in navigator)) return null;
        const reg = await navigator.serviceWorker.ready;
        return 'periodicSync' in reg ? reg : null;
    }

    async function registerDailySync() {
        try {
            const reg = await getPeriodicSyncRegistration();
            if (!reg) return false;
            const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
            if (status.state !== 'granted') return false;
            await reg.periodicSync.register(DAILY_SYNC_TAG, { minInterval: 24 * 60 * 60 * 1000 });
            return true;
        } catch (err) {
            console.warn('No se pudo registrar la sincronización diaria:', err);
            return false;
        }
    }

    async function unregisterDailySync() {
        try {
            const reg = await getPeriodicSyncRegistration();
            if (reg) await reg.periodicSync.unregister(DAILY_SYNC_TAG);
        } catch (err) {
            console.warn('No se pudo cancelar la sincronización diaria:', err);
        }
    }

    async function activateDailyNotifications() {
        const registered = await registerDailySync();
        if (!registered) {
            storageSet('devotional-notifications', 'unsubscribed');
            updateNotifyBtnUI(false);
            showToast('Los avisos diarios requieren la app instalada en Android. Abre la app para leer el devocional del día.', null, 6000);
            return;
        }
        storageSet('devotional-notifications', 'subscribed');
        updateNotifyBtnUI(true);
        sendWelcomeNotification();
    }

    // Verificar preferencia previa
    const isSubscribed = storageGet('devotional-notifications') === 'subscribed';
    const notificationsActive = isSubscribed && supportsNotifications && Notification.permission === 'granted';
    updateNotifyBtnUI(notificationsActive);
    if (notificationsActive) {
        // Renovar el registro por si el navegador lo descartó
        registerDailySync();
    }

    devotionalNotifyBtn.on('click', function () {
        if (!supportsNotifications) {
            showToast('Tu navegador no permite notificaciones. Abre la app para leer el devocional del día.', null, 5000);
            return;
        }

        if (Notification.permission === 'granted') {
            // Ya está concedido, alternar estado
            if (devotionalNotifyBtn.attr('aria-pressed') === 'true') {
                storageSet('devotional-notifications', 'unsubscribed');
                unregisterDailySync();
                updateNotifyBtnUI(false);
                showToast('Avisos desactivados.');
            } else {
                activateDailyNotifications();
            }
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    activateDailyNotifications();
                } else {
                    showToast('Permiso de notificaciones denegado.');
                }
            });
        } else {
            showToast('Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.', null, 5000);
        }
    });

    function sendWelcomeNotification() {
        const title = "¡Avisos activados!";
        const options = {
            body: "Recibirás un aviso diario de Radio Bendición con el devocional del día.",
            icon: "images/logo-192.png",
            badge: "images/logo-192.png",
            vibrate: [100, 50, 100],
            data: { url: window.location.origin + '/#devocional' }
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
            });
        } else {
            try {
                new Notification(title, options);
            } catch (err) {
                console.warn('Error al lanzar notificación directa:', err);
            }
        }
    }

    // --- Accesos directos dentro de la vista App ---
    $('[data-action="play"]').on('click', function () {
        if (!isPlayingState) startPlayback();
    });
    $('[data-action="today"]').on('click', function () {
        renderDevotional(todayNum);
    });
    $('[data-action="pray"]').on('click', function () {
        setTimeout(() => $prayerDetails.trigger('focus'), 60);
    });

    // --- Detección de Estado de Conexión (Online/Offline) ---
    function updateConnectionStatus() {
        if (navigator.onLine) {
            if ($body.hasClass('is-offline')) {
                $body.removeClass('is-offline');
                showToast('Conexión recuperada. Volvemos al aire.');
                updateNowPlaying();

                // Si el usuario estaba escuchando antes de perder la conexión, intentar reconectar automáticamente
                if (isPlayingState) {
                    attemptReconnect();
                } else {
                    updatePlayerUI();
                }
            }
        } else {
            $body.addClass('is-offline');
            showToast('Sin conexión a internet. Modo sin conexión activo.');

            // Si hay un temporizador de reconexión activo, cancelarlo temporalmente
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }

            // No pausamos el audio: en cortes breves (pantalla bloqueada, cambio Wi-Fi ↔ datos)
            // el búfer sigue sonando, y si la señal cae se reconecta al volver la red
            updatePlayerUI();
        }
    }

    // Escuchar cambios de red del navegador
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Verificación inicial al cargar la página
    if (!navigator.onLine) {
        $body.addClass('is-offline');
    }

    // --- Vista inicial ---
    showView(viewFromHash());
    updatePlayerUI();

    // --- Manejo de Atajos (Shortcuts) / Parámetros de URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    // 1. Atajo para reproducir automáticamente
    if (urlParams.get('play') === 'true') {
        goTo('radio');
        setTimeout(() => {
            console.log('Parámetro play=true detectado. Sintonizando la señal...');
            startPlayback();
        }, 500);
    }

    // 2. Atajo para abrir formulario de petición de oración
    if (action === 'pray') {
        goTo('oracion');
        setTimeout(() => $prayerDetails.trigger('focus'), 300);
    } else if (action === 'devocional') {
        goTo('devocional');
    }

    // Limpiar los parámetros para que recargar la página no repita el atajo
    if (urlParams.has('play') || action) {
        history.replaceState(null, '', window.location.pathname + window.location.hash);
    }

});
