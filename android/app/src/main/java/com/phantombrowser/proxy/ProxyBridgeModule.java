package com.phantombrowser.proxy;

import android.util.Log;

import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewFeature;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * ProxyBridgeModule
 *
 * Implements the same architecture as local_proxy.py from SOCKS5-Termux_v3:
 *   Browser WebView → HTTP/CONNECT on 127.0.0.1:8118
 *                   → SOCKS5H handshake to upstream proxy
 *                   → Internet
 *
 * SOCKS5H: hostname sent to proxy for resolution (no local DNS leak).
 */
public class ProxyBridgeModule extends ReactContextBaseJavaModule {
    private static final String TAG = "ProxyBridge";
    private static final int BUFFER_SIZE = 8192;
    private static final int SOCKS5_CONNECT_TIMEOUT_MS = 30_000;

    private ServerSocket serverSocket;
    private ExecutorService threadPool;
    private final AtomicBoolean running = new AtomicBoolean(false);

    // Upstream proxy config (set on startBridge)
    private volatile String upstreamHost;
    private volatile int    upstreamPort;
    private volatile String upstreamUser;
    private volatile String upstreamPass;

    public ProxyBridgeModule(ReactApplicationContext ctx) {
        super(ctx);
    }

    @Override
    public String getName() { return "ProxyBridgeModule"; }

    // ─────────────────────────────────────────────────────────────────────────
    // JS-callable methods
    // ─────────────────────────────────────────────────────────────────────────

    @ReactMethod
    public void startBridge(String host, int port, String user, String pass,
                            int localPort, Promise promise) {
        if (running.get()) {
            // Already running — stop old one first
            stopBridgeInternal();
        }
        upstreamHost = host;
        upstreamPort = port;
        upstreamUser = user != null ? user : "";
        upstreamPass = pass != null ? pass : "";

        // 1. Verify connectivity & get exit IP
        new Thread(() -> {
            try {
                long start = System.currentTimeMillis();
                String exitIP = fetchIPThroughProxy(host, port,
                        upstreamUser, upstreamPass);
                long latency = System.currentTimeMillis() - start;

                if (exitIP == null || exitIP.isEmpty()) {
                    WritableMap err = Arguments.createMap();
                    err.putBoolean("success", false);
                    err.putString("error", "Proxy verification failed — could not fetch exit IP");
                    promise.resolve(err);
                    return;
                }

                // 2. Start the local bridge
                startLocalBridge(localPort);

                // 3. Route the WebView through the local bridge.
                //
                // System.setProperty() doesn't reach the WebView process on
                // modern Android. The correct approach is:
                //   a) Set the global ProxySelector so Java's HTTP client uses it.
                //   b) Use reflection to call the internal android.net.Proxy
                //      setter that WebView actually reads.
                //   c) Broadcast PROXY_CHANGE so the WebView picks it up live.
                setAndroidWebViewProxy("127.0.0.1", localPort);

                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("exitIP", exitIP);
                result.putDouble("latency", latency);
                promise.resolve(result);

            } catch (Exception e) {
                WritableMap err = Arguments.createMap();
                err.putBoolean("success", false);
                err.putString("error", e.getMessage() != null ? e.getMessage() : "Unknown error");
                promise.resolve(err);
            }
        }).start();
    }

    @ReactMethod
    public void stopBridge(Promise promise) {
        stopBridgeInternal();
        promise.resolve(null);
    }

    @ReactMethod
    public void checkIP(String host, int port, String user, String pass, Promise promise) {
        new Thread(() -> {
            try {
                long start = System.currentTimeMillis();
                String ip = fetchIPThroughProxy(host, port,
                        user != null ? user : "",
                        pass != null ? pass : "");
                long latency = System.currentTimeMillis() - start;
                WritableMap r = Arguments.createMap();
                r.putString("exitIP", ip != null && !ip.isEmpty() ? ip : "unknown");
                r.putDouble("latency", latency);
                promise.resolve(r);
            } catch (Exception e) {
                promise.reject("CHECK_IP_FAILED",
                        e.getMessage() != null ? e.getMessage() : "Unknown error");
            }
        }).start();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: start the HTTP→SOCKS5H bridge server
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // WebView proxy routing via ProxyController (androidx.webkit)
    //
    // ProxyController.getInstance().setProxyOverride() is the ONLY officially
    // supported API for routing Android WebView traffic through a proxy.
    // All previous approaches (System.setProperty, PROXY_CHANGE broadcast,
    // ProxySelector) are unreliable for WebView — they work for Java's HTTP
    // stack but not for the Chromium network stack that WebView uses internally.
    //
    // ProxyController requires:
    //   - androidx.webkit:webkit:1.1.0+ (we use 1.10.0)
    //   - WebViewFeature.PROXY_OVERRIDE supported (true on all API 24+ devices
    //     with a modern WebView, which covers all real-world devices)
    //   - Must be called on the main thread
    // ─────────────────────────────────────────────────────────────────────────

    private void setAndroidWebViewProxy(String host, int port) {
        android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
        main.post(() -> {
            try {
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) {
                    Log.w(TAG, "ProxyController not supported on this WebView version — falling back to system properties");
                    // Fallback for very old WebView builds (extremely rare on API 24+)
                    System.setProperty("http.proxyHost", host);
                    System.setProperty("http.proxyPort", String.valueOf(port));
                    System.setProperty("https.proxyHost", host);
                    System.setProperty("https.proxyPort", String.valueOf(port));
                    return;
                }

                ProxyConfig proxyConfig = new ProxyConfig.Builder()
                    .addProxyRule(host + ":" + port)
                    // Bypass localhost so the app's own API calls aren't proxied
                    .addDirect("localhost")
                    .addDirect("127.0.0.1")
                    .build();

                ProxyController.getInstance().setProxyOverride(
                    proxyConfig,
                    Runnable::run,  // Executor: run callback inline (sync confirm)
                    () -> Log.i(TAG, "ProxyController: proxy set → " + host + ":" + port)
                );
            } catch (Exception e) {
                Log.e(TAG, "ProxyController setProxyOverride failed: " + e.getMessage());
            }
        });
    }

    private void clearAndroidWebViewProxy() {
        android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
        main.post(() -> {
            try {
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)) {
                    System.clearProperty("http.proxyHost");
                    System.clearProperty("http.proxyPort");
                    System.clearProperty("https.proxyHost");
                    System.clearProperty("https.proxyPort");
                    return;
                }
                ProxyController.getInstance().clearProxyOverride(
                    Runnable::run,
                    () -> Log.i(TAG, "ProxyController: proxy cleared")
                );
            } catch (Exception e) {
                Log.e(TAG, "ProxyController clearProxyOverride failed: " + e.getMessage());
            }
        });
    }

    private void startLocalBridge(int localPort) throws IOException {
        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress("127.0.0.1", localPort));
        running.set(true);
        threadPool = Executors.newCachedThreadPool();

        threadPool.submit(() -> {
            Log.i(TAG, "Local bridge started on 127.0.0.1:" + localPort);
            while (running.get()) {
                try {
                    Socket client = serverSocket.accept();
                    threadPool.submit(() -> handleClient(client));
                } catch (IOException e) {
                    if (running.get()) Log.w(TAG, "Accept error: " + e.getMessage());
                }
            }
        });
    }

    private void stopBridgeInternal() {
        running.set(false);
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) {}
        if (threadPool != null) threadPool.shutdownNow();
        // Clear the WebView proxy so it goes back to direct internet.
        clearAndroidWebViewProxy();
        Log.i(TAG, "Bridge stopped");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Handle one client connection
    // ─────────────────────────────────────────────────────────────────────────

    private void handleClient(Socket client) {
        Socket remote = null;
        try {
            client.setSoTimeout(60_000);
            InputStream cin = client.getInputStream();
            OutputStream cout = client.getOutputStream();

            // Read first request line
            byte[] buf = new byte[BUFFER_SIZE];
            int n = cin.read(buf);
            if (n <= 0) return;
            String request = new String(buf, 0, n, StandardCharsets.ISO_8859_1);

            if (request.startsWith("CONNECT")) {
                // HTTPS CONNECT tunnel
                String[] parts = request.split(" ");
                if (parts.length < 2) return;
                String hostPort = parts[1];
                String[] hp = hostPort.split(":");
                String targetHost = hp[0];
                int targetPort = hp.length > 1 ? Integer.parseInt(hp[1]) : 443;

                remote = connectViaSocks5h(targetHost, targetPort);
                cout.write("HTTP/1.1 200 Connection Established\r\n\r\n".getBytes(StandardCharsets.UTF_8));
                cout.flush();

            } else {
                // Plain HTTP — parse Host header
                String targetHost = "example.com";
                int targetPort = 80;
                for (String line : request.split("\r\n")) {
                    if (line.toLowerCase().startsWith("host:")) {
                        String hostVal = line.substring(5).trim();
                        if (hostVal.contains(":")) {
                            String[] hostParts = hostVal.split(":");
                            targetHost = hostParts[0];
                            try {
                                targetPort = Integer.parseInt(hostParts[1]);
                            } catch (NumberFormatException ignored) {}
                        } else {
                            targetHost = hostVal;
                        }
                        break;
                    }
                }
                remote = connectViaSocks5h(targetHost, targetPort);
                // Forward original request bytes
                remote.getOutputStream().write(Arrays.copyOf(buf, n));
                remote.getOutputStream().flush();
            }

            // Bidirectional pipe — FIX: use correct stream getters
            final InputStream remoteIn  = remote.getInputStream();
            final OutputStream remoteOut = remote.getOutputStream();
            Thread t1 = new Thread(() -> pipe(cin, remoteOut));
            Thread t2 = new Thread(() -> pipe(remoteIn, cout));
            t1.start();
            t2.start();
            t1.join();
            t2.join();

        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "";
            if (!msg.contains("closed") && !msg.contains("reset") && !msg.contains("broken pipe")) {
                Log.w(TAG, "Client handler error: " + msg);
            }
        } finally {
            closeQuietly(client);
            closeQuietly(remote);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SOCKS5H handshake (RFC 1928 + RFC 1929, hostname sent to proxy)
    // ─────────────────────────────────────────────────────────────────────────

    private Socket connectViaSocks5h(String targetHost, int targetPort) throws IOException {
        Socket sock = new Socket();
        sock.connect(new InetSocketAddress(upstreamHost, upstreamPort), SOCKS5_CONNECT_TIMEOUT_MS);
        sock.setSoTimeout(SOCKS5_CONNECT_TIMEOUT_MS);

        InputStream in   = sock.getInputStream();
        OutputStream out = sock.getOutputStream();

        // === Auth negotiation ===
        boolean hasAuth = upstreamUser != null && !upstreamUser.isEmpty();
        if (hasAuth) {
            out.write(new byte[]{0x05, 0x02, 0x00, 0x02});
        } else {
            out.write(new byte[]{0x05, 0x01, 0x00});
        }
        out.flush();

        byte[] authResp = readExact(in, 2);
        if (authResp[0] != 0x05) throw new IOException("SOCKS5: bad version in auth response");

        if (authResp[1] == 0x02) {
            // Username/password auth (RFC 1929)
            byte[] user = upstreamUser.getBytes(StandardCharsets.UTF_8);
            byte[] pass = upstreamPass.getBytes(StandardCharsets.UTF_8);
            byte[] authPkt = new byte[3 + user.length + pass.length];
            authPkt[0] = 0x01;
            authPkt[1] = (byte) user.length;
            System.arraycopy(user, 0, authPkt, 2, user.length);
            authPkt[2 + user.length] = (byte) pass.length;
            System.arraycopy(pass, 0, authPkt, 3 + user.length, pass.length);
            out.write(authPkt);
            out.flush();
            byte[] authAck = readExact(in, 2);
            if (authAck[1] != 0x00) throw new IOException("SOCKS5: auth rejected");
        } else if (authResp[1] != 0x00) {
            throw new IOException("SOCKS5: no acceptable auth method");
        }

        // === CONNECT request with hostname (SOCKS5H: ATYP=0x03) ===
        byte[] hostBytes = targetHost.getBytes(StandardCharsets.UTF_8);
        if (hostBytes.length > 255) throw new IOException("Hostname too long for SOCKS5");
        byte[] req = new byte[7 + hostBytes.length];
        req[0] = 0x05; // VER
        req[1] = 0x01; // CMD CONNECT
        req[2] = 0x00; // RSV
        req[3] = 0x03; // ATYP: domain name
        req[4] = (byte) hostBytes.length;
        System.arraycopy(hostBytes, 0, req, 5, hostBytes.length);
        req[5 + hostBytes.length] = (byte) ((targetPort >> 8) & 0xFF);
        req[6 + hostBytes.length] = (byte) (targetPort & 0xFF);
        out.write(req);
        out.flush();

        // === Read reply ===
        byte[] rep = readExact(in, 4);
        if (rep[0] != 0x05) throw new IOException("SOCKS5: bad version in reply");
        if (rep[1] != 0x00) throw new IOException("SOCKS5: connect failed, code=" + (rep[1] & 0xFF));

        // Skip bound address
        int atyp = rep[3] & 0xFF;
        if (atyp == 0x01) readExact(in, 4);          // IPv4
        else if (atyp == 0x03) {
            int len = in.read();
            if (len < 0) throw new IOException("SOCKS5: stream closed reading domain length");
            readExact(in, len);                        // domain
        }
        else if (atyp == 0x04) readExact(in, 16);    // IPv6
        else throw new IOException("SOCKS5: unknown ATYP " + atyp);
        readExact(in, 2); // port

        sock.setSoTimeout(0); // back to blocking
        return sock;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IP check through proxy (for validation + re-check)
    // ─────────────────────────────────────────────────────────────────────────

    private String fetchIPThroughProxy(String host, int port, String user, String pass)
            throws IOException {
        // Temporarily swap upstream config for this check
        String savedHost = upstreamHost; int savedPort = upstreamPort;
        String savedUser = upstreamUser; String savedPass = upstreamPass;
        upstreamHost = host; upstreamPort = port;
        upstreamUser = user != null ? user : "";
        upstreamPass = pass != null ? pass : "";

        try {
            Socket sock = connectViaSocks5h("api.ipify.org", 80);
            OutputStream out = sock.getOutputStream();
            out.write("GET / HTTP/1.0\r\nHost: api.ipify.org\r\nConnection: close\r\n\r\n"
                    .getBytes(StandardCharsets.UTF_8));
            out.flush();

            InputStream in = sock.getInputStream();
            StringBuilder sb = new StringBuilder();
            byte[] buf = new byte[1024];
            int n;
            while ((n = in.read(buf)) != -1) sb.append(new String(buf, 0, n, StandardCharsets.UTF_8));
            sock.close();

            String body = sb.toString();
            int idx = body.indexOf("\r\n\r\n");
            return idx >= 0 ? body.substring(idx + 4).trim() : body.trim();
        } finally {
            upstreamHost = savedHost; upstreamPort = savedPort;
            upstreamUser = savedUser; upstreamPass = savedPass;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private void pipe(InputStream src, OutputStream dst) {
        byte[] buf = new byte[BUFFER_SIZE];
        try {
            int n;
            while ((n = src.read(buf)) != -1) {
                dst.write(buf, 0, n);
                dst.flush();
            }
        } catch (IOException ignored) {}
    }

    private byte[] readExact(InputStream in, int n) throws IOException {
        byte[] buf = new byte[n];
        int read = 0;
        while (read < n) {
            int r = in.read(buf, read, n - read);
            if (r < 0) throw new IOException("Stream closed during read");
            read += r;
        }
        return buf;
    }

    private void closeQuietly(Socket s) {
        if (s != null) try { s.close(); } catch (Exception ignored) {}
    }
}
