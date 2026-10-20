# Reglas de R8 para la versión de Play Store (build release).
# Capacitor, sus plugins y Media3 traen sus propias reglas; aquí solo va lo de esta app.

# Números de línea en los informes de errores de Play Console (el mapa de R8 va dentro del .aab)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Sin registros de depuración en la versión publicada (Log.w y Log.e se mantienen)
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
}
