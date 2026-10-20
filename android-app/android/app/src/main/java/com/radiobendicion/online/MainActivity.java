package com.radiobendicion.online;

import android.os.Bundle;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins propios de la app (deben registrarse antes de crear el puente)
        registerPlugin(RadioPlayerPlugin.class);
        super.onCreate(savedInstanceState);
        // Fondo mientras carga la página: claro u oscuro según el teléfono, sin destello blanco
        getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.app_background));
    }
}
