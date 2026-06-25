$(document).ready(function () {

    // --- Registro del Service Worker para PWA con Detección de Actualizaciones ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('Service Worker registrado con éxito:', reg.scope);

                    // Detectar si hay una actualización en cola o en curso
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                // Si el nuevo SW terminó de instalarse y ya está en espera (waiting)
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    showUpdateToast(reg);
                                }
                            });
                        }
                    });

                    // Si ya hay un SW esperando en segundo plano al cargar la página
                    if (reg.waiting && navigator.serviceWorker.controller) {
                        showUpdateToast(reg);
                    }
                })
                .catch(error => {
                    console.log('Registro de Service Worker fallido:', error);
                });
        });

        // Recargar la página una sola vez al activarse el nuevo Service Worker
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }

    // Función toast interactiva para actualizaciones
    function showUpdateToast(reg) {
        $('.custom-toast').remove();
        
        const toast = $('<div class="custom-toast update-toast">✨ Nueva versión disponible. <button id="reloadPwaBtn" class="toast-btn">Actualizar</button></div>');
        $('body').append(toast);
        
        setTimeout(() => toast.addClass('show'), 50);

        $('#reloadPwaBtn').on('click', function() {
            if (reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
                window.location.reload();
            }
        });
    }

    // --- Lógica de Instalación de PWA (Android & iOS) ---
    let deferredPrompt;
    const installAppBtn = $('#installAppBtn');

    // Detección de iOS (iPhone, iPad, iPod)
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    
    // Detección de si la app ya está instalada (en modo de pantalla completa/standalone)
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    // Elementos del DOM para la guía iOS
    const iosGuideModal = $('#iosGuideModal');
    const iosInstallBanner = $('#iosInstallBanner');
    let currentStep = 1;

    function openIosGuide() {
        iosGuideModal.addClass('open');
        iosInstallBanner.removeClass('show'); // Oculta el banner al abrir la guía
        showStep(1);
    }

    function closeIosGuide() {
        iosGuideModal.removeClass('open');
    }

    function showStep(stepNum) {
        currentStep = stepNum;
        
        // Alternar slides
        $('.ios-step-slide').removeClass('active prev-step');
        $('.ios-step-slide').each(function() {
            const slideStep = $(this).data('step');
            if (slideStep === currentStep) {
                $(this).addClass('active');
            } else if (slideStep < currentStep) {
                $(this).addClass('prev-step');
            }
        });

        // Actualizar indicadores (puntos de progreso)
        $('.ios-step-dot').removeClass('active');
        $(`.ios-step-dot[data-step="${currentStep}"]`).addClass('active');

        // Actualizar botones del footer
        $('#iosPrevBtn').prop('disabled', currentStep === 1);
        if (currentStep === 4) {
            $('#iosNextBtn').text('Entendido');
        } else {
            $('#iosNextBtn').text('Siguiente');
        }
    }

    if (isIos && !isStandalone) {
        // En iOS, el botón de instalación abre la guía interactiva
        installAppBtn.html('<span>📲</span> Instalar Aplicación').show();
        
        installAppBtn.on('click', function() {
            openIosGuide();
        });

        // Mostrar invitación flotante a instalar después de 3.5 segundos si no se ha cerrado antes
        if (!localStorage.getItem('ios-install-banner-closed')) {
            setTimeout(() => {
                iosInstallBanner.addClass('show');
            }, 3500);
        }

        // Navegación dentro del wizard interactivo
        $('#iosPrevBtn').on('click', function() {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        });

        $('#iosNextBtn').on('click', function() {
            if (currentStep < 4) {
                showStep(currentStep + 1);
            } else {
                closeIosGuide();
            }
        });

        // Cerrar modal
        $('#closeIosModalBtn').on('click', closeIosGuide);
        
        // Cerrar al hacer clic en el backdrop
        iosGuideModal.on('click', function(e) {
            if ($(e.target).is(iosGuideModal)) {
                closeIosGuide();
            }
        });

        // Cerrar banner
        $('#closeIosBannerBtn').on('click', function(e) {
            e.stopPropagation(); // Evitar disparar el clic del banner
            iosInstallBanner.removeClass('show');
            localStorage.setItem('ios-install-banner-closed', 'true');
        });

        // Clic en el banner para abrir la guía
        iosInstallBanner.on('click', function(e) {
            if (!$(e.target).closest('#closeIosBannerBtn').length) {
                openIosGuide();
            }
        });

    } else {
        // Comportamiento nativo de PWA para Android/Chrome/Edge/Desktop
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installAppBtn.show();
        });

        installAppBtn.on('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Elección de instalación: ${outcome}`);
            deferredPrompt = null;
            installAppBtn.hide();
        });
    }

    window.addEventListener('appinstalled', (event) => {
        console.log('PWA instalada correctamente');
        installAppBtn.hide();
    });

    const menuBtn = $('#menuBtn');
    const menu = $('#menu');

    menuBtn.on('click', function () {
        menu.toggleClass('open');
        menuBtn.text(menu.hasClass('open') ? '✕' : '☰');
    });

    // Cerrar menú al hacer clic en el backdrop
    menu.on('click', function (e) {
        if ($(e.target).is(menu)) {
            menu.removeClass('open');
            menuBtn.text('☰');
        }
    });



    $('#year').text(new Date().getFullYear());

    // --- Lógica del Reproductor de Radio ---
    const radioAudio = document.getElementById('radioAudio');
    const playBtn = $('#playBtn');
    const pauseBtn = $('#pauseBtn');
    const volumeSlider = $('#volumeSlider');
    const nowPlayingText = $('.now-playing');

    // URL de la señal de streaming y API de AzuraCast
    const STREAM_URL = 'https://radio.radiobendicion.cl/listen/radio_bendici%C3%B3n/radio.mp3';
    const API_URL = 'https://radio.radiobendicion.cl/api/nowplaying_static/radio_bendici%C3%B3n.json';

    let currentSongText = 'Sintonizando la señal...';
    let isBuffering = false;

    // --- Control de reconexión y estado deseado ---
    let isPlayingState = false; // true si el usuario quiere que la radio suene
    let reconnectTimeout = null;
    let retryCount = 0;
    const MAX_RETRIES = 5;

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
            const cleanArtistText = currentSongText === 'Sintonizando la señal...' ? 'Señal en Vivo' : currentSongText;
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Radio Bendición',
                artist: cleanArtistText,
                album: 'Iglesia Toda la Gloria para Dios',
                artwork: [
                    { src: 'images/logo-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'images/logo-512.png', sizes: '512x512', type: 'image/png' }
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
        navigator.mediaSession.setActionHandler('play', function() {
            if (playBtn.is(':visible')) {
                playBtn.click();
            }
        });
        navigator.mediaSession.setActionHandler('pause', function() {
            if (pauseBtn.is(':visible')) {
                pauseBtn.click();
            }
        });
        navigator.mediaSession.setActionHandler('stop', function() {
            if (pauseBtn.is(':visible')) {
                pauseBtn.click();
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
            showToast('⚠️ Se interrumpió la señal de la radio. Presiona Play para intentar conectar nuevamente.');
            isPlayingState = false;
            isBuffering = false;
            resetReconnect();
            pauseBtn.hide();
            playBtn.show();
            updatePlayerUI();
            updateMediaPlaybackState('paused');
            return;
        }

        retryCount++;
        console.log(`Reconectando... Intento ${retryCount}/${MAX_RETRIES}`);
        isBuffering = true;
        updatePlayerUI();
        
        // Asignar URL fresca con cache-buster para evitar búfer muerto en caché del navegador
        radioAudio.src = `${STREAM_URL}?t=${Date.now()}`;
        radioAudio.load();
        
        radioAudio.play().then(() => {
            console.log("Reconexión exitosa.");
            isBuffering = false;
            resetReconnect();
            updatePlayerUI();
            updateMediaPlaybackState('playing');
        }).catch(err => {
            console.error("Fallo al reconectar:", err);
            // Programar el siguiente intento
            reconnectTimeout = setTimeout(attemptReconnect, 4000);
        });
    }

    function updateNowPlaying() {
        // Intentar actualizar metadatos con cache-buster para evitar caché
        const urlWithCacheBuster = `${API_URL}?t=${Date.now()}`;
        
        $.getJSON(urlWithCacheBuster, function(data) {
            if (data && data.now_playing && data.now_playing.song) {
                const song = data.now_playing.song;
                const text = song.artist ? `${song.artist} - ${song.title}` : song.title;
                currentSongText = text;
                updatePlayerUI();
                updateMediaSession();
            }
        }).fail(function() {
            console.warn('No se pudieron cargar los metadatos de la radio.');
        });
    }

    function updatePlayerUI() {
        if (!navigator.onLine) {
            nowPlayingText.text('Modo sin conexión • Streaming no disponible');
        } else if (radioAudio.error) {
            nowPlayingText.text('Error al conectar con la señal');
        } else if (isBuffering) {
            nowPlayingText.text('Sintonizando la señal (cargando)...');
        } else if (radioAudio.paused) {
            nowPlayingText.text(`Streaming pausado • En vivo: ${currentSongText}`);
        } else {
            nowPlayingText.text(`Estás escuchando: ${currentSongText}`);
        }
    }

    // Actualización inicial y cada 8 segundos para mayor velocidad de refresco
    updateNowPlaying();
    const metadataInterval = setInterval(updateNowPlaying, 8000);

    // Eventos del elemento de audio para actualizar la interfaz inmediatamente
    $(radioAudio).on('play', function() {
        isPlayingState = true;
        isBuffering = true;
        updatePlayerUI();
        updateNowPlaying(); // Forzar actualización de metadatos al reproducir
        updateMediaPlaybackState('playing');
        updateMediaSession();
    });

    $(radioAudio).on('playing', function() {
        isBuffering = false;
        resetReconnect();
        updatePlayerUI();
        updateMediaPlaybackState('playing');
    });

    $(radioAudio).on('waiting stalled', function(e) {
        isBuffering = true;
        updatePlayerUI();
        
        // Si el usuario quería reproducir pero el audio se estanca
        if (isPlayingState && !reconnectTimeout) {
            console.log(`Señal en espera (${e.type}). Agendando reconexión en 5 segundos...`);
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                attemptReconnect();
            }, 5000);
        }
    });

    $(radioAudio).on('pause', function() {
        isBuffering = false;
        updatePlayerUI();
        updateMediaPlaybackState('paused');
    });

    $(radioAudio).on('error', function(e) {
        console.error("Error en elemento de audio:", e);
        isBuffering = false;
        
        if (isPlayingState) {
            console.log("Error detectado en reproducción activa. Intentando reconectar inmediatamente...");
            attemptReconnect();
        } else {
            nowPlayingText.text('Error al conectar con la señal');
            pauseBtn.hide();
            playBtn.show();
            updateMediaPlaybackState('none');
        }
    });

    playBtn.on('click', function() {
        if (!navigator.onLine) {
            showToast('⚠️ No tienes conexión a internet para reproducir la radio.');
            return;
        }
        isPlayingState = true;
        isBuffering = true;
        resetReconnect();
        nowPlayingText.text('Conectando con la señal...');
        
        // Asignar URL con cache-buster al iniciar para forzar conexión fresca
        radioAudio.src = `${STREAM_URL}?t=${Date.now()}`;
        radioAudio.load();
        
        radioAudio.play().then(() => {
            playBtn.hide();
            pauseBtn.show();
            updateMediaPlaybackState('playing');
            updateMediaSession();
        }).catch(err => {
            console.error("Error al reproducir:", err);
            isBuffering = false;
            isPlayingState = false;
            updatePlayerUI();
            updateMediaPlaybackState('none');
        });
    });

    pauseBtn.on('click', function() {
        isPlayingState = false;
        resetReconnect();
        radioAudio.pause();
        pauseBtn.hide();
        playBtn.show();
        // Recargar el stream al pausar para evitar delay/desfase acumulado
        radioAudio.load(); 
        updateMediaPlaybackState('paused');
    });

    volumeSlider.on('input', function() {
        radioAudio.volume = $(this).val();
    });

    // Reanudar la radio si la pestaña estuvo suspendida en segundo plano y el audio se detuvo
    $(document).on('visibilitychange', function() {
        if (document.visibilityState === 'visible' && isPlayingState && radioAudio.paused) {
            console.log("Pestaña visible nuevamente y el audio está pausado. Intentando reconectar...");
            attemptReconnect();
        }
    });

    // --- Detección de Transmisión en Vivo en YouTube ---
    const YOUTUBE_CHANNEL_ID = 'UCdtFAwglkI3zvibkt8YHiZw'; // ID de canal de YouTube
    const YOUTUBE_API_KEY = 'AIzaSyCKVAT0CX0Oj6He8CCEIDzsdenEHI1yn9E';       // API Key de Google Developer
    const ytLiveBtn = $('#ytLiveBtn');

    async function checkYouTubeLive() {
        if (!YOUTUBE_CHANNEL_ID || !YOUTUBE_API_KEY || YOUTUBE_CHANNEL_ID.startsWith('YOUR_') || YOUTUBE_API_KEY.startsWith('YOUR_')) {
            ytLiveBtn.hide();
            return;
        }

        const API_URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`;

        try {
            const response = await fetch(API_URL);
            const data = await response.json();

            if (data && data.items && data.items.length > 0) {
                const liveVideo = data.items[0];
                const videoId = liveVideo.id.videoId;
                
                // Enlazar al video en vivo actual
                ytLiveBtn.attr('href', `https://www.youtube.com/watch?v=${videoId}`);
                ytLiveBtn.css('display', 'inline-flex');
            } else {
                ytLiveBtn.hide();
            }
        } catch (error) {
            console.error('Error al verificar la transmisión en vivo de YouTube:', error);
            ytLiveBtn.hide();
        }
    }

    // Verificación inicial
    checkYouTubeLive();
    // Verificar cada 5 minutos (300000 ms) para no agotar la cuota de la API de Google
    setInterval(checkYouTubeLive, 300000);

    // --- Lógica de los Carruseles ---
    $('.carousel-btn').on('click', function() {
        const carouselId = $(this).data('carousel');
        const track = $(`#${carouselId}`);
        const direction = $(this).hasClass('next') ? 1 : -1;
        const scrollAmount = track.width() * 0.8;

        // Añadir una pequeña animación de escala a los elementos visibles
        track.find('> *').css('transform', 'scale(0.98)');
        
        track.animate({
            scrollLeft: track.scrollLeft() + (scrollAmount * direction)
        }, 400, function() {
            // Restaurar escala después de la animación
            track.find('> *').css('transform', 'scale(1)');
        });
    });

    // --- Lógica del Tema (Modo Claro / Oscuro) ---
    const themeToggleBtn = $('#themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'light';

    function setTheme(theme) {
        if (theme === 'dark') {
            $('html').attr('data-theme', 'dark');
            themeToggleBtn.find('.theme-switch-knob').text('🌙');
            localStorage.setItem('theme', 'dark');
        } else {
            $('html').attr('data-theme', 'light');
            themeToggleBtn.find('.theme-switch-knob').text('☀️');
            localStorage.setItem('theme', 'light');
        }
    }

    // Inicializar tema
    setTheme(currentTheme);

    themeToggleBtn.on('click', function() {
        const newTheme = $('html').attr('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // --- Lógica de Compartir Señal ---
    const shareAppBtn = $('#shareAppBtn');

    // Función toast de notificación
    function showToast(message) {
        $('.custom-toast').remove();
        const toast = $('<div class="custom-toast">' + message + '</div>');
        $('body').append(toast);
        setTimeout(() => toast.addClass('show'), 50);
        setTimeout(() => {
            toast.removeClass('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    shareAppBtn.on('click', function() {
        const shareData = {
            title: 'Radio Bendición',
            text: '🎙️ ¡Escucha en vivo Radio Bendición - Iglesia Toda la Gloria para Dios! 📻✨',
            url: window.location.origin || window.location.href
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            navigator.share(shareData)
                .then(() => console.log('Señal compartida con éxito'))
                .catch((err) => console.log('Error al compartir:', err));
        } else {
            // Fallback: copiar al portapapeles
            const dummy = document.createElement('input');
            const shareText = shareData.text + ' ' + shareData.url;
            document.body.appendChild(dummy);
            dummy.value = shareText;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            showToast('📋 ¡Mensaje y enlace copiados para compartir!');
        }
    });

    // --- Lógica de Peticiones de Oración ---
    const prayerModal = $('#prayerModal');
    const openPrayerBtn = $('#prayerBtn');
    const openPrayerBtnCta = $('#prayerBtnCta');
    const closePrayerBtn = $('#closePrayerModalBtn');
    const prayerForm = $('#prayerForm');

    // Reemplazar con el número de teléfono oficial de la iglesia
    const WHATSAPP_NUMBER = '56957906866'; 

    function openPrayerModal() {
        prayerModal.addClass('open');
    }

    function closePrayerModal() {
        prayerModal.removeClass('open');
        prayerForm[0].reset();
    }

    openPrayerBtn.on('click', openPrayerModal);
    openPrayerBtnCta.on('click', openPrayerModal);
    closePrayerBtn.on('click', closePrayerModal);

    // Cerrar al hacer clic en el backdrop
    prayerModal.on('click', function(e) {
        if ($(e.target).is(prayerModal)) {
            closePrayerModal();
        }
    });

    // Envío del formulario a WhatsApp
    prayerForm.on('submit', function(e) {
        e.preventDefault();

        const name = $('#prayerName').val().trim();
        const category = $('#prayerCategory').val();
        const details = $('#prayerDetails').val().trim();

        if (!name || !category || !details) return;

        // Construir mensaje de WhatsApp
        const waText = 
            `*Petición de Oración - Radio Bendición*\n\n` +
            `*Nombre:* ${name}\n` +
            `*Categoría:* ${category}\n` +
            `*Detalle:* ${details}`;

        const encodedText = encodeURIComponent(waText);
        const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;

        // Abrir link en nueva pestaña
        window.open(waUrl, '_blank');
        
        // Cerrar modal y limpiar
        closePrayerModal();
        showToast('🙏 ¡Petición enviada! Abriendo WhatsApp...');
    });

    // --- Lógica del Devocional Diario ---
    const devotionalDate = $('#devotionalDate');
    const devotionalTitle = $('#devotionalTitle');
    const devotionalVerseText = $('#devotionalVerseText');
    const devotionalVerseCite = $('#devotionalVerseCite');
    const devotionalReflection = $('#devotionalReflection');
    const devotionalPrayer = $('#devotionalPrayer');
    const devotionalNotifyBtn = $('#devotionalNotifyBtn');

    function loadDailyDevotional() {
        if (typeof DEVOTIONALS_DB === 'undefined') {
            console.warn('Base de datos de devocionales no cargada.');
            return;
        }

        const now = new Date();
        const day = now.getDate(); // 1 al 31

        // Obtener devocional correspondiente al día
        const devotional = DEVOTIONALS_DB[day];
        if (!devotional) return;

        // Formatear fecha en español
        const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
        let fechaFormateada = now.toLocaleDateString('es-ES', opciones);
        // Capitalizar primera letra
        fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

        // Cargar en el DOM
        devotionalDate.text(fechaFormateada);
        devotionalTitle.text(devotional.titulo);
        devotionalVerseText.text(`"${devotional.pasaje}"`);
        devotionalVerseCite.text(devotional.cita);
        devotionalReflection.text(devotional.reflexion);
        devotionalPrayer.text(devotional.oracion);

        // Configurar botones de compartir y copiar
        $('#shareDevotionalWs').off('click').on('click', function() {
            const waText = 
                `*Radio Bendición - Devocional Diario*\n` +
                `🕯️ *${devotional.titulo}*\n\n` +
                `_"${devotional.pasaje}"_ (${devotional.cita})\n\n` +
                `📖 *Reflexión:* ${devotional.reflexion}\n\n` +
                `🙏 *Oración:* ${devotional.oracion}\n\n` +
                `🎙️ Escucha la señal en vivo en: ${window.location.origin || 'https://radiobendicion.cl'}`;
            
            const encodedText = encodeURIComponent(waText);
            const waUrl = `https://wa.me/?text=${encodedText}`;
            window.open(waUrl, '_blank');
        });

        $('#copyDevotionalBtn').off('click').on('click', function() {
            const copyText = 
                `Radio Bendición - Devocional Diario\n` +
                `🕯️ ${devotional.titulo}\n\n` +
                `"${devotional.pasaje}" (${devotional.cita})\n\n` +
                `Reflexión: ${devotional.reflexion}\n\n` +
                `Oración: ${devotional.oracion}\n\n` +
                `Escucha la señal en vivo en: ${window.location.origin || 'https://radiobendicion.cl'}`;
            
            const dummy = document.createElement('textarea');
            document.body.appendChild(dummy);
            dummy.value = copyText;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            showToast('📋 ¡Devocional copiado al portapapeles!');
        });
    }

    // Inicializar carga del devocional
    loadDailyDevotional();

    // Notificaciones de Devocionales (Push & Local Fallbacks)
    function updateNotifyBtnUI(subscribed) {
        if (subscribed) {
            devotionalNotifyBtn.addClass('active');
            devotionalNotifyBtn.html('<span class="bell-icon">🔔</span> <span class="btn-text">Avisos Activos</span>');
        } else {
            devotionalNotifyBtn.removeClass('active');
            devotionalNotifyBtn.html('<span class="bell-icon">🔔</span> <span class="btn-text">Recibir Avisos</span>');
        }
    }

    // Verificar preferencia previa
    const isSubscribed = localStorage.getItem('devotional-notifications') === 'subscribed';
    updateNotifyBtnUI(isSubscribed && Notification.permission === 'granted');

    devotionalNotifyBtn.on('click', function() {
        if (!('Notification' in window)) {
            showToast('❌ Tu navegador no soporta notificaciones.');
            return;
        }

        if (Notification.permission === 'granted') {
            // Ya está concedido, alternar estado
            const currentlyActive = devotionalNotifyBtn.hasClass('active');
            if (currentlyActive) {
                localStorage.setItem('devotional-notifications', 'unsubscribed');
                updateNotifyBtnUI(false);
                showToast('🔕 Notificaciones desactivadas.');
            } else {
                localStorage.setItem('devotional-notifications', 'subscribed');
                updateNotifyBtnUI(true);
                showToast('🔔 ¡Notificaciones activadas!');
            }
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    localStorage.setItem('devotional-notifications', 'subscribed');
                    updateNotifyBtnUI(true);
                    
                    // Enviar notificación de bienvenida local
                    sendWelcomeNotification();
                } else {
                    showToast('❌ Permiso de notificaciones denegado.');
                }
            });
        } else {
            showToast('⚠️ Permiso denegado. Actívalas en los ajustes del navegador.');
        }
    });

    function sendWelcomeNotification() {
        const title = "🔔 ¡Notificaciones Activadas!";
        const options = {
            body: "Recibirás avisos diarios de Radio Bendición cuando el nuevo devocional esté listo.",
            icon: "images/logo-192.png",
            badge: "images/logo-192.png",
            vibrate: [100, 50, 100],
            data: { url: window.location.origin + '#devocional' }
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

    // --- Lógica del Carrusel de Fondos del Reproductor ---
    let currentBgIndex = 0;
    const bgLayer1 = $('#playerBg1');
    const bgLayer2 = $('#playerBg2');
    let activeLayer = 1;

    function rotatePlayerBackground() {
        const nextBgIndex = (currentBgIndex + 1) % 4; // Tenemos 4 imágenes (bg-0 a bg-3)

        if (activeLayer === 1) {
            // Cargar la siguiente clase en la capa 2 (que está oculta) y mostrarla
            if (bgLayer2.length) {
                bgLayer2.removeClass('bg-0 bg-1 bg-2 bg-3').addClass(`bg-${nextBgIndex}`);
                bgLayer2.css('opacity', '1');
            }
            if (bgLayer1.length) {
                bgLayer1.css('opacity', '0');
            }
            activeLayer = 2;
        } else {
            // Cargar la siguiente clase en la capa 1 (que está oculta) y mostrarla
            if (bgLayer1.length) {
                bgLayer1.removeClass('bg-0 bg-1 bg-2 bg-3').addClass(`bg-${nextBgIndex}`);
                bgLayer1.css('opacity', '1');
            }
            if (bgLayer2.length) {
                bgLayer2.css('opacity', '0');
            }
            activeLayer = 1;
        }
        currentBgIndex = nextBgIndex;
    }

    if (bgLayer1.length && bgLayer2.length) {
        // Rotar cada 6 segundos
        setInterval(rotatePlayerBackground, 6000);
    }

    // --- Lógica de navegación entre Vistas (Radio vs Iglesia) ---
    const menuLinks = $('#menu a');

    function updateActiveMenuLink(targetHref) {
        $('#menu a').removeClass('active');
        
        // Si el hash corresponde a la iglesia, activar "Nuestra Iglesia"
        if (targetHref === '#iglesia' || targetHref === '#devocional' || targetHref === '#horarios') {
            $('#menu a[href="#iglesia"]').addClass('active');
        } else if (targetHref === '#inicio' || targetHref === '#radio') {
            $('#menu a[href="#inicio"]').addClass('active');
        } else {
            $('#menu a[href="' + targetHref + '"]').addClass('active');
        }
    }

    let adminAuthorized = false;

    function checkHashView() {
        const hash = window.location.hash || '#inicio';
        const isChurch = ['#iglesia', '#devocional', '#horarios', '#nosotros', '#vision', '#ministerios', '#creemos', '#contacto'].some(section => hash.startsWith(section));
        
        if (hash === '#admin-scheduler' || hash === '#admin-programacion') {
            $('body').removeClass('view-radio view-church').addClass('view-admin');
            
            // Si el admin no ha ingresado el PIN, mostrar pantalla de PIN
            if (!adminAuthorized) {
                $('#adminAuthScreen').show();
                $('#adminDashboard').hide();
                setTimeout(() => $('#adminPasscode').focus(), 50);
            } else {
                $('#adminAuthScreen').hide();
                $('#adminDashboard').show();
            }
        } else if (isChurch) {
            $('body').removeClass('view-radio view-admin').addClass('view-church');
            if (hash === '#contacto') {
                updateActiveMenuLink('#contacto');
            } else {
                updateActiveMenuLink('#iglesia');
            }
        } else if (hash === '#inicio' || hash === '#radio') {
            $('body').removeClass('view-church view-admin').addClass('view-radio');
            updateActiveMenuLink('#inicio');
        }
    }

    // Inicializar vista por defecto
    checkHashView();

    function safeScrollTo(targetHref) {
        const targetElement = $(targetHref);
        if (targetElement.length) {
            // Breve espera de 30ms para permitir reflow del DOM tras cambio de clase.
            // Esto es imperceptible y asegura cálculos de offset exactos.
            setTimeout(() => {
                const headerHeight = $('header').outerHeight() || 80;
                const elementPosition = targetElement.offset().top;
                const offsetPosition = elementPosition - headerHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }, 30);
        }
    }

    function navigateToHash(targetHref) {
        if (!targetHref || !targetHref.startsWith('#')) return;

        // 1. Cambiar la vista inmediatamente
        const isChurch = ['#iglesia', '#devocional', '#horarios', '#nosotros', '#vision', '#ministerios', '#creemos', '#contacto'].some(section => targetHref.startsWith(section));
        if (isChurch) {
            $('body').removeClass('view-radio').addClass('view-church');
        } else if (targetHref === '#inicio' || targetHref === '#radio') {
            $('body').removeClass('view-church').addClass('view-radio');
        }

        // 2. Actualizar el link activo
        updateActiveMenuLink(targetHref);

        // 3. Cerrar el menú móvil si está abierto
        menu.removeClass('open');
        menuBtn.text('☰');

        // 4. Realizar el scroll preciso
        if (targetHref === '#inicio' || targetHref === '#iglesia' || targetHref === '#radio') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            history.pushState(null, null, targetHref);
        } else {
            safeScrollTo(targetHref);
            history.pushState(null, null, targetHref);
        }
    }

    // Evento click unificado para todos los enlaces hash (menú y cuerpo de la página)
    $(document).on('click', 'a[href^="#"]', function(e) {
        const targetHref = $(this).attr('href');
        // Excluir el enlace de YouTube u otros enlaces con hash vacío/genérico (#)
        if (targetHref && targetHref.length > 1) {
            e.preventDefault();
            navigateToHash(targetHref);
        }
    });

    // Evento hashchange para navegación con botones atrás/adelante del navegador
    $(window).on('hashchange', function() {
        checkHashView();
        const hash = window.location.hash;
        if (hash && hash !== '#inicio' && hash !== '#iglesia' && hash !== '#radio') {
            safeScrollTo(hash);
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Scroll inicial si se ingresa con hash en la URL
    const initialHash = window.location.hash;
    if (initialHash && initialHash !== '#inicio' && initialHash !== '#iglesia' && initialHash !== '#radio') {
        safeScrollTo(initialHash);
    }

    // --- Lógica del Modal de Redes y Contacto ---
    const socialModal = $('#socialModal');
    const openSocialBtn = $('#openSocialModalBtn');
    const closeSocialBtn = $('#closeSocialModalBtn');
    const prayerBtnModal = $('#prayerBtnModal');

    function openSocialModal() {
        socialModal.addClass('open');
    }

    function closeSocialModal() {
        socialModal.removeClass('open');
    }

    openSocialBtn.on('click', openSocialModal);
    closeSocialBtn.on('click', closeSocialModal);

    // Cerrar al hacer clic en el backdrop
    socialModal.on('click', function(e) {
        if ($(e.target).is(socialModal)) {
            closeSocialModal();
        }
    });

    // Enlace interno del modal: Abrir formulario de oración
    prayerBtnModal.on('click', function() {
        closeSocialModal();
        setTimeout(() => {
            openPrayerModal();
        }, 300);
    });

    // --- Detección de Estado de Conexión (Online/Offline) ---
    function updateConnectionStatus() {
        if (navigator.onLine) {
            if ($('body').hasClass('is-offline')) {
                $('body').removeClass('is-offline');
                showToast('🟢 ¡Conexión restablecida! Reestableciendo señal...');
                updateNowPlaying();
                
                // Si el usuario estaba escuchando antes de perder la conexión, intentar reconectar automáticamente
                if (isPlayingState) {
                    attemptReconnect();
                } else {
                    updatePlayerUI();
                }
            }
        } else {
            $('body').addClass('is-offline');
            showToast('⚠️ Sin conexión a internet. Modo sin conexión activo.');
            
            // Si hay un temporizador de reconexión activo, cancelarlo temporalmente
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            
            // Pausar la reproducción físicamente en el elemento de audio
            radioAudio.pause();
            isBuffering = false;
            updatePlayerUI();
            updateMediaPlaybackState('paused');
        }
    }

    // Escuchar cambios de red del navegador
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Verificación inicial al cargar la página
    if (!navigator.onLine) {
        $('body').addClass('is-offline');
        updatePlayerUI();
    }

    // =========================================================================
    // --- GESTOR DE PLANIFICACIÓN RADIAL (SECRET ADMIN PANEL) ---
    // =========================================================================
    const ADMIN_PIN = "777"; // Pin de acceso secreto

    // Horas y días para generar la grilla
    const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    // Programas por defecto en la lista de disponibles
    const DEFAULT_LIST_PROGRAMS = [
        { id: 'p1', name: 'Música y Reflexión', speaker: 'Pastor Juan', color: '#3b82f6' },
        { id: 'p2', name: 'Juventud en Sintonía', speaker: 'Hno. Carlos', color: '#ec4899' },
        { id: 'p3', name: 'Mujeres de Valor', speaker: 'Hna. María', color: '#a855f7' },
        { id: 'p4', name: 'Palabra de Vida', speaker: 'Pastor Luis', color: '#10b981' },
        { id: 'p5', name: 'Sinfonía Celestial', speaker: 'Instrumental', color: '#f59e0b' },
        { id: 'p6', name: 'La Voz de la Profecía', speaker: 'Hno. Andrés', color: '#6366f1' }
    ];

    let availablePrograms = [];
    let weeklySchedule = {}; // Estructura: { "Lunes_08:00": { id, name, speaker, color } }

    // Generar la tabla de horarios radiales dinámicamente
    function buildSchedulerGrid() {
        const tbody = $('#schedulerTableBody');
        tbody.empty();

        hours.forEach(hour => {
            const tr = $('<tr></tr>');
            tr.append(`<td class="time-cell">${hour}</td>`);

            days.forEach(day => {
                const key = `${day}_${hour}`;
                const slot = $(`<div class="schedule-slot" data-day="${day}" data-hour="${hour}"></div>`);
                
                // Configurar eventos de Drag and Drop en el slot
                slot.on('dragover', handleDragOver);
                slot.on('dragleave', handleDragLeave);
                slot.on('drop', handleDrop);

                // Si hay un programa guardado en este slot, renderizarlo
                if (weeklySchedule[key]) {
                    const prog = weeklySchedule[key];
                    const card = createSlotProgramCard(prog, day, hour);
                    slot.append(card);
                }

                const td = $('<td></td>').append(slot);
                tr.append(td);
            });

            tbody.append(tr);
        });
    }

    // Inicializar datos del administrador desde localStorage
    function initAdminData() {
        // Cargar programas disponibles
        const savedProgs = localStorage.getItem('radio-bendicion-admin-programs');
        if (savedProgs) {
            availablePrograms = JSON.parse(savedProgs);
        } else {
            availablePrograms = [...DEFAULT_LIST_PROGRAMS];
            localStorage.setItem('radio-bendicion-admin-programs', JSON.stringify(availablePrograms));
        }

        // Cargar horarios del calendario
        const savedSchedule = localStorage.getItem('radio-bendicion-weekly-schedule');
        if (savedSchedule) {
            weeklySchedule = JSON.parse(savedSchedule);
        } else {
            weeklySchedule = {};
        }

        renderAvailablePrograms();
    }

    // Renderizar programas en la barra lateral
    function renderAvailablePrograms() {
        const container = $('#programsList');
        container.empty();

        availablePrograms.forEach(p => {
            const card = $(`
                <div class="program-card" draggable="true" data-id="${p.id}" data-name="${p.name}" data-speaker="${p.speaker}" data-color="${p.color}" style="background: ${p.color}">
                    <div class="prog-details">
                        <span class="prog-name">${p.name}</span>
                        <span class="prog-speaker">${p.speaker}</span>
                    </div>
                    <button class="delete-btn" title="Eliminar programa de la lista">×</button>
                </div>
            `);

            // Evento dragstart de la tarjeta de la lista
            card.on('dragstart', function(e) {
                const dragData = {
                    type: 'list-card',
                    id: p.id,
                    name: p.name,
                    speaker: p.speaker,
                    color: p.color
                };
                e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                e.originalEvent.dataTransfer.effectAllowed = 'copyMove';
            });

            // Botón de eliminar programa de la barra lateral
            card.find('.delete-btn').on('click', function(e) {
                e.stopPropagation();
                availablePrograms = availablePrograms.filter(prog => prog.id !== p.id);
                localStorage.setItem('radio-bendicion-admin-programs', JSON.stringify(availablePrograms));
                renderAvailablePrograms();
            });

            container.append(card);
        });
    }

    // Crear la tarjeta que va colocada dentro del slot del calendario
    function createSlotProgramCard(prog, day, hour) {
        const card = $(`
            <div class="slot-program-card" draggable="true" style="background: ${prog.color}">
                <span class="prog-name">${prog.name}</span>
                <span class="prog-speaker">${prog.speaker}</span>
                <button class="remove-btn" title="Quitar de este horario">×</button>
            </div>
        `);

        // Al arrastrar una tarjeta desde un slot a otro
        card.on('dragstart', function(e) {
            const dragData = {
                type: 'slot-card',
                originDay: day,
                originHour: hour,
                id: prog.id,
                name: prog.name,
                speaker: prog.speaker,
                color: prog.color
            };
            e.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
            e.originalEvent.dataTransfer.effectAllowed = 'move';
        });

        // Botón para remover el bloque del slot individual
        card.find('.remove-btn').on('click', function(e) {
            e.stopPropagation();
            const key = `${day}_${hour}`;
            delete weeklySchedule[key];
            card.parent().empty(); // Vaciar el slot visualmente
        });

        return card;
    }

    // Controladores de Eventos del Drag & Drop
    function handleDragOver(e) {
        e.preventDefault();
        $(this).addClass('slot-hover');
    }

    // Remover clase de hover
    function handleDragLeave() {
        $(this).removeClass('slot-hover');
    }

    // Procesar drop en el slot
    function handleDrop(e) {
        e.preventDefault();
        $(this).removeClass('slot-hover');
        
        const targetDay = $(this).data('day');
        const targetHour = $(this).data('hour');
        const targetKey = `${targetDay}_${targetHour}`;

        try {
            const dataText = e.originalEvent.dataTransfer.getData('text/plain');
            if (!dataText) return;

            const dragData = JSON.parse(dataText);

            // Si es un traslado de un slot a otro, limpiar el slot original
            if (dragData.type === 'slot-card') {
                const originKey = `${dragData.originDay}_${dragData.originHour}`;
                delete weeklySchedule[originKey];
                
                // Limpiar visualmente el slot original
                $(`.schedule-slot[data-day="${dragData.originDay}"][data-hour="${dragData.originHour}"]`).empty();
            }

            // Asignar el programa al nuevo slot
            const newProgramData = {
                id: dragData.id,
                name: dragData.name,
                speaker: dragData.speaker,
                color: dragData.color
            };

            weeklySchedule[targetKey] = newProgramData;

            // Renderizar el bloque en el slot destino
            $(this).empty();
            const card = createSlotProgramCard(newProgramData, targetDay, targetHour);
            $(this).append(card);

        } catch (err) {
            console.error("Error al procesar el drop:", err);
        }
    }

    // --- Manejo del PIN y Autorización de Administrador ---
    $('#adminLoginBtn').on('click', handleAdminLogin);
    $('#adminPasscode').on('keypress', function(e) {
        if (e.which === 13) {
            handleAdminLogin();
        }
    });

    function handleAdminLogin() {
        const pin = $('#adminPasscode').val();
        if (pin === ADMIN_PIN) {
            adminAuthorized = true;
            $('#adminPasscode').val('');
            $('#adminAuthScreen').hide();
            $('#adminDashboard').show();
            initAdminData();
            buildSchedulerGrid();
        } else {
            // Animación de error (sacudir tarjeta de login)
            const card = $('.admin-auth-card');
            card.css('position', 'relative');
            card.animate({ left: '-15px' }, 50)
                .animate({ left: '15px' }, 50)
                .animate({ left: '-10px' }, 50)
                .animate({ left: '10px' }, 50)
                .animate({ left: '0px' }, 50);
            
            showToast('❌ Código incorrecto. Inténtalo de nuevo.');
        }
    }

    // --- Creador de Nuevos Programas (Barra Lateral) ---
    let selectedColor = '#3b82f6';
    $('.color-presets .color-dot').on('click', function() {
        $('.color-presets .color-dot').removeClass('selected');
        $(this).addClass('selected');
        selectedColor = $(this).data('color');
    });

    $('#createProgramBtn').on('click', function() {
        const name = $('#newProgName').val().trim();
        const speaker = $('#newProgSpeaker').val().trim();

        if (!name) {
            showToast('⚠️ Introduce el nombre del programa.');
            return;
        }

        const newProg = {
            id: 'p_' + Date.now(),
            name: name,
            speaker: speaker || 'Por definir',
            color: selectedColor
        };

        availablePrograms.push(newProg);
        localStorage.setItem('radio-bendicion-admin-programs', JSON.stringify(availablePrograms));
        renderAvailablePrograms();

        // Limpiar formulario
        $('#newProgName').val('');
        $('#newProgSpeaker').val('');
        showToast('🟢 Programa añadido a la lista.');
    });

    // --- Botones de Control de la Programación ---
    $('#saveScheduleBtn').on('click', function() {
        localStorage.setItem('radio-bendicion-weekly-schedule', JSON.stringify(weeklySchedule));
        showToast('💾 Horario radial guardado exitosamente.');
    });

    $('#clearScheduleBtn').on('click', function() {
        if (confirm('⚠️ ¿Estás seguro de que deseas limpiar por completo la grilla de horarios?')) {
            weeklySchedule = {};
            buildSchedulerGrid();
            showToast('🗑️ Grilla de horarios vaciada.');
        }
    });

    $('#exportScheduleBtn').on('click', function() {
        const exportData = {
            schedule: weeklySchedule,
            programs: availablePrograms
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'programacion_radio_bendicion.json';
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('📤 Horario exportado a archivo JSON.');
    });

    $('#importScheduleBtn').on('click', function() {
        $('#importFileInput').click();
    });

    $('#importFileInput').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const importedData = JSON.parse(evt.target.result);
                if (importedData.schedule && importedData.programs) {
                    weeklySchedule = importedData.schedule;
                    availablePrograms = importedData.programs;

                    localStorage.setItem('radio-bendicion-weekly-schedule', JSON.stringify(weeklySchedule));
                    localStorage.setItem('radio-bendicion-admin-programs', JSON.stringify(availablePrograms));

                    renderAvailablePrograms();
                    buildSchedulerGrid();
                    showToast('📥 Horario e inventario importados con éxito.');
                } else {
                    showToast('❌ El archivo seleccionado no tiene el formato correcto.');
                }
            } catch (err) {
                showToast('❌ Error al leer el archivo JSON.');
            }
        };
        reader.readAsText(file);
        $(this).val('');
    });

    $('#exitAdminBtn').on('click', function() {
        window.location.hash = '#inicio';
    });

    // Cargar datos del administrador si es que ya tiene sesión y recarga la página en la vista del admin
    const initialHash = window.location.hash || '#inicio';
    if (initialHash === '#admin-scheduler' || initialHash === '#admin-programacion') {
        checkHashView();
    }

});