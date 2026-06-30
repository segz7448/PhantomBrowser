package com.phantombrowser.modules;

import android.app.Application;
import android.content.Context;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

/**
 * CrashReportModule
 *
 * A process can die from a native/bridge-level crash before any JS error
 * handler gets a chance to run. This installs a Java-level uncaught
 * exception handler as early as possible (in MainApplication.onCreate,
 * before React even starts) so crashes are captured no matter which layer
 * they originate from.
 *
 * The crash is written synchronously to a plain file (no SharedPreferences —
 * those aren't guaranteed to flush before process death) and read back by
 * JS on the next launch via getPendingReport().
 *
 * Deliberately does NOT contain any network code or credentials — it only
 * stores the report locally. Actually sending it anywhere is handled in JS,
 * which opens a pre-filled GitHub issue page for the user to review and
 * submit themselves, so no write-access token ever ships inside the app.
 */
public class CrashReportModule extends ReactContextBaseJavaModule {
    private static final String CRASH_FILE = "phantom_pending_crash.txt";

    public CrashReportModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "CrashReportModule";
    }

    public static void installHandler(Application app) {
        final Thread.UncaughtExceptionHandler previousHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                writeCrashFile(app, throwable);
            } catch (Exception ignored) {
                // Never let crash-reporting itself crash the crash handler.
            }
            if (previousHandler != null) {
                previousHandler.uncaughtException(thread, throwable);
            }
        });
    }

    private static void writeCrashFile(Context context, Throwable throwable) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("type: native\n");
        sb.append("message: ").append(throwable.getMessage()).append("\n");
        sb.append("stack:\n");
        for (StackTraceElement el : throwable.getStackTrace()) {
            sb.append("  at ").append(el.toString()).append("\n");
        }
        File file = new File(context.getFilesDir(), CRASH_FILE);
        try (FileWriter writer = new FileWriter(file, false)) {
            writer.write(sb.toString());
        }
    }

    @ReactMethod
    public void getPendingReport(Promise promise) {
        try {
            File file = new File(getReactApplicationContext().getFilesDir(), CRASH_FILE);
            if (!file.exists()) {
                promise.resolve(null);
                return;
            }
            java.nio.file.Path path = file.toPath();
            byte[] bytes = java.nio.file.Files.readAllBytes(path);
            WritableMap map = Arguments.createMap();
            map.putString("report", new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            promise.resolve(map);
        } catch (Exception e) {
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void clearPendingReport() {
        File file = new File(getReactApplicationContext().getFilesDir(), CRASH_FILE);
        if (file.exists()) {
            file.delete();
        }
    }
}
