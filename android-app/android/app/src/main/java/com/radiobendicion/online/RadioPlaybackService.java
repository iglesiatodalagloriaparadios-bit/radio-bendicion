package com.radiobendicion.online;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy;
import androidx.media3.extractor.metadata.icy.IcyHeaders;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Reproduce la radio en un servicio de primer plano (notificación con play/pausa y controles
 * en la pantalla de bloqueo). Android no lo detiene al bloquear el teléfono, y se reconecta
 * solo cuando la red se corta o cambia entre Wi-Fi y datos.
 */
public class RadioPlaybackService extends MediaSessionService {

    private static final String TAG = "RadioBendicion";
    static final String STREAM_URL = "https://radio.radiobendicion.cl/listen/radio_bendici%C3%B3n/radio.mp3";
    private static final String API_URL = "https://radio.radiobendicion.cl/api/nowplaying_static/radio_bendici%C3%B3n.json";
    static final String EXTRA_FAILED = "failed";

    private static final String DEFAULT_TITLE = "Radio Bendición en vivo";
    private static final String DEFAULT_ARTIST = "Alabanza y Palabra las 24 horas";

    // Tras una pausa más larga que esto, al volver a reproducir se reconecta al directo
    private static final long STALE_AFTER_PAUSE_MS = 5_000;
    // Pausada más de esto, se libera la conexión para no gastar datos
    private static final long RELEASE_AFTER_PAUSE_MS = 30_000;
    // Si no logra sonar en este tiempo (sin red), se rinde y lo avisa a la app
    private static final long GIVE_UP_AFTER_MS = 10 * 60_000;
    private static final long METADATA_INTERVAL_MS = 15_000;
    // Audio guardado por delante de lo que suena = atraso respecto del directo.
    // Crece cuando el audio se detiene un momento (notificación, llamada, señal trabada);
    // pasado este límite se vuelve a conectar al directo.
    private static final long MAX_LIVE_LAG_MS = 10_000;
    private static final long LAG_CHECK_INTERVAL_MS = 5_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();

    private ExoPlayer exoPlayer;
    private Player player;
    private MediaSession session;

    private long pausedAt = 0;
    private int errorRetries = 0;
    private String lastSongKey = "";
    private byte[] defaultArtwork;

    private final Runnable releaseConnection = () -> {
        if (!exoPlayer.getPlayWhenReady()) {
            exoPlayer.stop();
        }
    };

    private final Runnable giveUp = new Runnable() {
        @Override
        public void run() {
            // En pausa por una llamada no es falta de señal: se vuelve a revisar después
            if (exoPlayer.getPlaybackSuppressionReason() != Player.PLAYBACK_SUPPRESSION_REASON_NONE) {
                handler.postDelayed(this, GIVE_UP_AFTER_MS);
                return;
            }
            stopForGood();
        }
    };

    private void stopForGood() {
        Log.w(TAG, "No se pudo recuperar la señal. Se detiene la radio.");
        exoPlayer.pause();
        exoPlayer.stop();
        setFailed(true);
    }

    private final Runnable pollMetadata = new Runnable() {
        @Override
        public void run() {
            fetchNowPlaying();
            handler.postDelayed(this, METADATA_INTERVAL_MS);
        }
    };

    private final Runnable checkLiveLag = new Runnable() {
        @Override
        public void run() {
            long lag = exoPlayer.getTotalBufferedDuration();
            Log.d(TAG, "Diagnóstico: búfer " + lag + " ms, posición " + exoPlayer.getCurrentPosition()
                + " ms, estado " + exoPlayer.getPlaybackState() + ", sonando " + exoPlayer.isPlaying());
            if (exoPlayer.isPlaying() && lag > MAX_LIVE_LAG_MS) {
                Log.i(TAG, "Atraso de " + lag / 1000 + " s respecto del directo. Volviendo al directo...");
                loadLive();
            }
            handler.postDelayed(this, LAG_CHECK_INTERVAL_MS);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent("RadioBendicion-Android")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(10_000)
            .setReadTimeoutMs(15_000);

        // Sin metadatos ICY en el audio: el título y la carátula salen de la API de la radio
        ResolvingDataSource.Factory dataSource = new ResolvingDataSource.Factory(http, this::withoutIcyHeader);

        // Ante cortes de red el reproductor reintenta indefinidamente (cada 1–5 s) en vez de fallar
        DefaultLoadErrorHandlingPolicy retryForever = new DefaultLoadErrorHandlingPolicy(Integer.MAX_VALUE) {
            @Override
            public long getRetryDelayMsFor(@NonNull LoadErrorInfo info) {
                long delay = super.getRetryDelayMsFor(info);
                return delay == C.TIME_UNSET ? C.TIME_UNSET : Math.min(1_000L * info.errorCount, 5_000L);
            }
        };

        // Búfer corto, como corresponde a una radio en vivo: empieza a sonar con 1,5 s de audio
        // (3 s tras un corte) y nunca guarda más de 20 s, para no quedar atrasado
        DefaultLoadControl liveBuffer = new DefaultLoadControl.Builder()
            .setBufferDurationsMs(10_000, 20_000, 1_500, 3_000)
            .build();

        exoPlayer = new ExoPlayer.Builder(this)
            .setLoadControl(liveBuffer)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSource).setLoadErrorHandlingPolicy(retryForever))
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(), true) // pausa durante llamadas y vuelve sola al terminar
            .setHandleAudioBecomingNoisy(true) // pausa al desconectar audífonos
            .setWakeMode(C.WAKE_MODE_NETWORK) // mantiene CPU y Wi-Fi activos con la pantalla bloqueada
            .build();
        exoPlayer.addListener(new PlayerEvents());

        player = new LivePlayer(exoPlayer);
        defaultArtwork = readDefaultArtwork();

        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openApp = PendingIntent.getActivity(this, 0, open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        DefaultMediaNotificationProvider notifications = new DefaultMediaNotificationProvider.Builder(this).build();
        notifications.setSmallIcon(R.drawable.ic_stat_radio);
        setMediaNotificationProvider(notifications);

        session = new MediaSession.Builder(this, player)
            .setSessionActivity(openApp)
            .build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        // Al cerrar la app desde recientes: si la radio está sonando sigue; si no, se cierra todo
        if (!exoPlayer.getPlayWhenReady()) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        network.shutdownNow();
        if (session != null) {
            session.release();
            session = null;
        }
        exoPlayer.release();
        super.onDestroy();
    }

    private DataSpec withoutIcyHeader(DataSpec dataSpec) {
        Map<String, String> headers = new HashMap<>(dataSpec.httpRequestHeaders);
        headers.remove(IcyHeaders.REQUEST_HEADER_ENABLE_METADATA_NAME);
        return dataSpec.withRequestHeaders(headers);
    }

    /** Carga el directo desde cero (sin audio viejo en el búfer). */
    private void loadLive() {
        Log.i(TAG, "Conectando al directo");
        MediaItem item = new MediaItem.Builder()
            .setUri(Uri.parse(STREAM_URL + "?t=" + System.currentTimeMillis()))
            .setMediaMetadata(currentMetadata())
            .build();
        exoPlayer.setMediaItem(item);
        exoPlayer.prepare();
    }

    /** Se llama cada vez que alguien pide reproducir: la app, la notificación o unos audífonos. */
    private void onPlayRequested() {
        handler.removeCallbacks(releaseConnection);
        setFailed(false);
        int state = exoPlayer.getPlaybackState();
        boolean stale = pausedAt > 0 && System.currentTimeMillis() - pausedAt > STALE_AFTER_PAUSE_MS;
        if (exoPlayer.getMediaItemCount() == 0 || state == Player.STATE_IDLE || state == Player.STATE_ENDED
            || exoPlayer.getPlayerError() != null || stale) {
            loadLive();
        }
        pausedAt = 0;
    }

    private void setFailed(boolean failed) {
        if (session == null) return;
        Bundle extras = new Bundle();
        extras.putBoolean(EXTRA_FAILED, failed);
        session.setSessionExtras(extras);
    }

    private final class PlayerEvents implements Player.Listener {
        @Override
        public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
            handler.removeCallbacks(checkLiveLag);
            if (playWhenReady) {
                handler.removeCallbacks(pollMetadata);
                handler.post(pollMetadata);
                handler.postDelayed(checkLiveLag, LAG_CHECK_INTERVAL_MS);
            } else {
                pausedAt = System.currentTimeMillis();
                handler.removeCallbacks(pollMetadata);
                handler.removeCallbacks(giveUp);
                handler.removeCallbacks(releaseConnection);
                handler.postDelayed(releaseConnection, RELEASE_AFTER_PAUSE_MS);
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            if (isPlaying) {
                errorRetries = 0;
                handler.removeCallbacks(giveUp);
            } else if (exoPlayer.getPlayWhenReady()) {
                // Quiere sonar pero está esperando señal: si no vuelve en 10 minutos, se rinde
                handler.removeCallbacks(giveUp);
                handler.postDelayed(giveUp, GIVE_UP_AFTER_MS);
            }
        }

        @Override
        public void onPlaybackStateChanged(int state) {
            // En una radio en vivo, "terminó" significa que el servidor cortó la conexión
            if (state == Player.STATE_ENDED && exoPlayer.getPlayWhenReady()) {
                Log.w(TAG, "El servidor cerró la transmisión. Reconectando...");
                loadLive();
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            Log.e(TAG, "Error de reproducción", error);
            if (!exoPlayer.getPlayWhenReady()) return;
            errorRetries++;
            long delay = Math.min(2_000L * errorRetries, 15_000L);
            handler.postDelayed(() -> {
                if (exoPlayer.getPlayWhenReady()) loadLive();
            }, delay);
        }
    }

    // --- Título, artista y carátula de lo que suena (API de AzuraCast) ---

    private MediaMetadata currentMetadata() {
        MediaItem item = exoPlayer.getMediaItemCount() > 0 ? exoPlayer.getCurrentMediaItem() : null;
        if (item != null && item.mediaMetadata.title != null) {
            return item.mediaMetadata;
        }
        return buildMetadata(DEFAULT_TITLE, DEFAULT_ARTIST, null);
    }

    private MediaMetadata buildMetadata(String title, String artist, @Nullable String art) {
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setStation("Radio Bendición")
            .setIsPlayable(true)
            .setIsBrowsable(false);
        if (art != null && !art.isEmpty()) {
            builder.setArtworkUri(Uri.parse(art));
        } else if (defaultArtwork != null) {
            builder.setArtworkData(defaultArtwork, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
        }
        return builder.build();
    }

    private void fetchNowPlaying() {
        network.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(API_URL + "?t=" + System.currentTimeMillis()).openConnection();
                conn.setConnectTimeout(8_000);
                conn.setReadTimeout(8_000);
                JSONObject song = new JSONObject(readAll(conn.getInputStream()))
                    .getJSONObject("now_playing").getJSONObject("song");
                String title = song.optString("title", "").trim();
                String artist = song.optString("artist", "").trim();
                String art = song.optString("art", "").trim();
                if (title.isEmpty()) return;
                handler.post(() -> applyNowPlaying(title, artist.isEmpty() ? "Radio Bendición" : artist, art));
            } catch (Exception e) {
                Log.d(TAG, "No se pudieron leer los datos de la canción: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void applyNowPlaying(String title, String artist, String art) {
        String key = title + "|" + artist + "|" + art;
        MediaItem item = exoPlayer.getCurrentMediaItem();
        if (item == null || key.equals(lastSongKey)) return;
        lastSongKey = key;
        // Mismo audio, solo cambia la información: no interrumpe la reproducción
        exoPlayer.replaceMediaItem(exoPlayer.getCurrentMediaItemIndex(),
            item.buildUpon().setMediaMetadata(buildMetadata(title, artist, art)).build());
    }

    private byte[] readDefaultArtwork() {
        try (InputStream in = getResources().openRawResource(R.drawable.radio_artwork)) {
            return readBytes(in);
        } catch (Exception e) {
            return null;
        }
    }

    private static String readAll(InputStream in) throws Exception {
        try (InputStream stream = in) {
            return new String(readBytes(stream), StandardCharsets.UTF_8);
        }
    }

    private static byte[] readBytes(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        return out.toByteArray();
    }

    /** Antes de reproducir decide si hay que reconectar al directo. */
    private final class LivePlayer extends ForwardingPlayer {
        LivePlayer(Player player) {
            super(player);
        }

        @Override
        public void play() {
            onPlayRequested();
            super.play();
        }

        @Override
        public void setPlayWhenReady(boolean playWhenReady) {
            if (playWhenReady) onPlayRequested();
            super.setPlayWhenReady(playWhenReady);
        }

        @Override
        public void prepare() {
            // Lo resuelve onPlayRequested(); preparar sin reproducir no aplica a una radio en vivo
            if (exoPlayer.getMediaItemCount() == 0) return;
            super.prepare();
        }
    }
}
