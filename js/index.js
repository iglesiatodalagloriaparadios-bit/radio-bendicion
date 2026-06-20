$(document).ready(function () {

    // --- Registro del Service Worker para PWA ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registrado con éxito:', registration.scope);
                })
                .catch(error => {
                    console.log('Registro de Service Worker fallido:', error);
                });
        });
    }

    // --- Lógica de Instalación de PWA ---
    let deferredPrompt;
    const installAppBtn = $('#installAppBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevenir el banner por defecto en navegadores móviles
        e.preventDefault();
        // Guardar el evento para dispararlo al hacer clic
        deferredPrompt = e;
        // Mostrar el botón personalizado de instalación
        installAppBtn.show();
    });

    installAppBtn.on('click', async () => {
        if (!deferredPrompt) return;
        // Mostrar prompt oficial de instalación
        deferredPrompt.prompt();
        // Esperar la elección del usuario
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Elección de instalación: ${outcome}`);
        // Limpiar el evento guardado
        deferredPrompt = null;
        // Ocultar botón
        installAppBtn.hide();
    });

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

    $('a[href^="#"]').on('click', function (e) {

        const target = $($(this).attr('href'));

        if (target.length) {

            e.preventDefault();

            const headerHeight = $('header').outerHeight();

            $('html, body').stop().animate({
                scrollTop: target.offset().top - headerHeight
            }, 1000, 'swing');

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

    // URL de la API de AzuraCast para metadatos "Now Playing"
    const API_URL = 'https://radio.radiobendicion.cl/api/nowplaying_static/radio_bendici%C3%B3n.json';

    function updateNowPlaying() {
        $.getJSON(API_URL, function(data) {
            if (data && data.now_playing && data.now_playing.song) {
                const song = data.now_playing.song;
                const text = song.artist ? `${song.artist} - ${song.title}` : song.title;
                nowPlayingText.text(text);
                
                // Si el audio está pausado, mantenemos el texto de metadatos
                // pero si se acaba de cargar, ayuda a saber qué suena
            }
        }).fail(function() {
            console.warn('No se pudieron cargar los metadatos de la radio.');
        });
    }

    // Actualización inicial y cada 20 segundos
    updateNowPlaying();
    setInterval(updateNowPlaying, 20000);

    playBtn.on('click', function() {
        radioAudio.play().then(() => {
            playBtn.hide();
            pauseBtn.show();
        }).catch(err => {
            console.error("Error al reproducir:", err);
            nowPlayingText.text('Error al reproducir la señal');
        });
    });

    pauseBtn.on('click', function() {
        radioAudio.pause();
        pauseBtn.hide();
        playBtn.show();
        nowPlayingText.text('Streaming pausado');
        // Opcional: recargar el stream al pausar para evitar delay acumulado
        radioAudio.load(); 
    });

    volumeSlider.on('input', function() {
        radioAudio.volume = $(this).val();
    });

    // Manejo de errores de carga
    $(radioAudio).on('error', function() {
        nowPlayingText.text('Error al conectar con la señal');
        pauseBtn.hide();
        playBtn.show();
    });

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

});