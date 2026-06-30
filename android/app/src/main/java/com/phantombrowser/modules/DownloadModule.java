package com.phantombrowser.modules;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Environment;
import android.webkit.MimeTypeMap;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

/**
 * DownloadModule
 *
 * Hands off WebView download URLs to Android's built-in DownloadManager.
 * No third-party dependencies — DownloadManager and FileProvider are both
 * part of the Android SDK / AndroidX core, already present in any RN build.
 *
 * Emits "PhantomDownloadComplete" to JS with {id, success, localPath} when
 * the system reports the download finished (or failed).
 */
public class DownloadModule extends ReactContextBaseJavaModule {
    private static final String EVENT_NAME = "PhantomDownloadComplete";

    private final Map<Long, String> pendingIds = new HashMap<>();
    private BroadcastReceiver completeReceiver;

    public DownloadModule(ReactApplicationContext context) {
        super(context);
        registerReceiver(context);
    }

    @Override
    public String getName() {
        return "DownloadModule";
    }

    private void registerReceiver(ReactApplicationContext context) {
        completeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                String jsId = pendingIds.remove(downloadId);
                if (jsId == null) return;

                DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm == null) return;

                DownloadManager.Query query = new DownloadManager.Query();
                query.setFilterById(downloadId);
                android.database.Cursor cursor = dm.query(query);
                boolean success = false;
                String localPath = "";
                if (cursor != null && cursor.moveToFirst()) {
                    int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    int uriIdx = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                    if (statusIdx >= 0 && cursor.getInt(statusIdx) == DownloadManager.STATUS_SUCCESSFUL) {
                        success = true;
                        if (uriIdx >= 0) {
                            String rawUri = cursor.getString(uriIdx);
                            if (rawUri != null) {
                                Uri uri = Uri.parse(rawUri);
                                localPath = uri.getPath() != null ? uri.getPath() : rawUri;
                            }
                        }
                    }
                }
                if (cursor != null) cursor.close();

                WritableMap params = Arguments.createMap();
                params.putString("id", jsId);
                params.putBoolean("success", success);
                params.putString("localPath", localPath);

                if (getReactApplicationContext().hasActiveCatalystInstance()) {
                    getReactApplicationContext()
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit(EVENT_NAME, params);
                }
            }
        };
        context.registerReceiver(completeReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
    }

    /**
     * Enqueues a download with the system DownloadManager. Saves to the
     * public Downloads/PhantomBrowser folder so files are visible outside
     * the app (e.g. in a file manager) without needing extra permissions
     * on modern Android.
     */
    @ReactMethod
    public void startDownload(String url, String filename, String jsId, Promise promise) {
        try {
            Uri uri = Uri.parse(url);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle(filename);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS, "PhantomBrowser/" + filename);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);

            DownloadManager dm = (DownloadManager) getReactApplicationContext()
                .getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) {
                promise.reject("NO_DOWNLOAD_MANAGER", "DownloadManager unavailable on this device");
                return;
            }
            long downloadId = dm.enqueue(request);
            pendingIds.put(downloadId, jsId);
            promise.resolve((double) downloadId);
        } catch (Exception e) {
            promise.reject("DOWNLOAD_FAILED", e.getMessage());
        }
    }

    @ReactMethod
    public void openFile(String path) {
        try {
            File file = new File(path);
            if (!file.exists()) return;

            Context context = getReactApplicationContext();
            Uri contentUri = FileProvider.getUriForFile(
                context, context.getPackageName() + ".fileprovider", file);

            String extension = MimeTypeMap.getFileExtensionFromUrl(path);
            String mimeType = extension != null
                ? MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase())
                : null;
            if (mimeType == null) mimeType = "*/*";

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (Exception e) {
            // Silently ignore — JS side shows its own "not available" message on failure paths.
        }
    }
}
