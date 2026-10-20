package com.radiobendicion.online;

import android.content.ComponentName;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.core.util.Consumer;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.concurrent.Executor;

/**
 * Puente entre la interfaz web y el reproductor nativo.
 * JS: RadioPlayer.play(), RadioPlayer.pause(), RadioPlayer.getState() y el evento "state"
 * con { state: "playing" | "buffering" | "paused" | "error" }.
 */
@CapacitorPlugin(name = "RadioPlayer")
public class RadioPlayerPlugin extends Plugin {

    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private boolean failed = false;
    private Executor main;

    @Override
    public void load() {
        main = ContextCompat.getMainExecutor(getContext());
        SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), RadioPlaybackService.class));
        controllerFuture = new MediaController.Builder(getContext(), token)
            .setListener(new MediaController.Listener() {
                @Override
                public void onExtrasChanged(@NonNull MediaController c, @NonNull Bundle extras) {
                    failed = extras.getBoolean(RadioPlaybackService.EXTRA_FAILED, false);
                    emitState();
                }
            })
            .buildAsync();
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                controller.addListener(new Player.Listener() {
                    @Override
                    public void onEvents(@NonNull Player player, @NonNull Player.Events events) {
                        emitState();
                    }
                });
                emitState();
            } catch (Exception e) {
                controller = null;
            }
        }, main);
    }

    @Override
    protected void handleOnDestroy() {
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
        }
        controller = null;
    }

    @PluginMethod
    public void play(PluginCall call) {
        withController(call, c -> {
            failed = false;
            c.play();
            call.resolve(stateObject());
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, c -> {
            c.pause();
            call.resolve(stateObject());
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        withController(call, c -> call.resolve(stateObject()));
    }

    private void withController(PluginCall call, Consumer<MediaController> action) {
        Runnable run = () -> {
            if (controller == null) {
                call.reject("El reproductor no está disponible");
                return;
            }
            action.accept(controller);
        };
        if (controller != null) {
            main.execute(run);
        } else {
            controllerFuture.addListener(run, main);
        }
    }

    private String currentState() {
        if (controller == null) return "paused";
        if (controller.getPlayWhenReady()) {
            return controller.isPlaying() ? "playing" : "buffering";
        }
        return failed ? "error" : "paused";
    }

    private JSObject stateObject() {
        JSObject data = new JSObject();
        data.put("state", currentState());
        return data;
    }

    private void emitState() {
        notifyListeners("state", stateObject(), true);
    }
}
