import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from 'react-native';
import {WebView, WebViewNavigation} from 'react-native-webview';
import {useFocusEffect} from '@react-navigation/native';
import {useProxy} from '../services/ProxyContext';
import AdBlocker from '../services/AdBlocker';

const ADBLOCKER_JS = AdBlocker.getInjectionScript();

export default function BrowserScreen() {
  const {isConnected, proxyUrl, chain} = useProxy();
  const [url, setUrl] = useState('https://browserleaks.com/ip');
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const webviewRef = useRef<WebView>(null);

  // FIX: inputUrl used in navigate — capture inside the callback to avoid stale closure
  const inputUrlRef = useRef(inputUrl);
  inputUrlRef.current = inputUrl;

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (canGoBack) {
          webviewRef.current?.goBack();
          return true;
        }
        return false;
      };
      BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBack);
    }, [canGoBack]),
  );

  const navigate = useCallback((target: string) => {
    let nav = target.trim();
    if (!nav) return;
    if (!nav.startsWith('http://') && !nav.startsWith('https://')) {
      if (nav.includes('.') && !nav.includes(' ')) {
        nav = 'https://' + nav;
      } else {
        nav = `https://duckduckgo.com/?q=${encodeURIComponent(nav)}`;
      }
    }
    setUrl(nav);
    setInputUrl('');
  }, []);

  const handleNavState = useCallback((state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    if (state.title) setPageTitle(state.title);
  }, []);

  const proxyConfig = isConnected
    ? {host: '127.0.0.1', port: 8118}
    : undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, {backgroundColor: isConnected ? '#22c55e' : '#ef4444'}]} />
        <Text style={styles.statusText}>
          {isConnected
            ? `Protected · ${chain?.exitIP ?? '...'}`
            : 'No proxy — not protected'}
        </Text>
        {loading && <ActivityIndicator size="small" color="#7c3aed" style={{marginLeft: 8}} />}
      </View>

      {/* URL bar */}
      <View style={styles.urlBar}>
        <TouchableOpacity onPress={() => webviewRef.current?.goBack()} disabled={!canGoBack}>
          <Text style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => webviewRef.current?.goForward()} disabled={!canGoForward}>
          <Text style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}>›</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.urlInput}
          placeholder={pageTitle || url}
          placeholderTextColor="#666"
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={() => navigate(inputUrlRef.current)}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity onPress={() => webviewRef.current?.reload()}>
          <Text style={styles.navBtn}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* WebView */}
      {isConnected ? (
        <WebView
          ref={webviewRef}
          source={{uri: url}}
          style={styles.webview}
          proxy={proxyConfig}
          injectedJavaScriptBeforeContentLoaded={ADBLOCKER_JS}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavState}
          javaScriptEnabled={true}
          domStorageEnabled={false}
          thirdPartyCookiesEnabled={false}
          incognito={true}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onShouldStartLoadWithRequest={request => {
            return !AdBlocker.shouldBlock(request.url);
          }}
        />
      ) : (
        <View style={styles.noProxy}>
          <Text style={styles.noProxyIcon}>🛡️</Text>
          <Text style={styles.noProxyTitle}>No Proxy Connected</Text>
          <Text style={styles.noProxyText}>
            Go to the Proxy tab to connect your SOCKS5 proxy before browsing. All traffic will be
            tunnelled through your proxy with no DNS leaks.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d'},
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#111',
  },
  dot: {width: 8, height: 8, borderRadius: 4, marginRight: 6},
  statusText: {color: '#aaa', fontSize: 11, flex: 1},
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    marginHorizontal: 4,
  },
  navBtn: {color: '#aaa', fontSize: 22, paddingHorizontal: 6},
  navBtnDisabled: {color: '#333'},
  webview: {flex: 1},
  noProxy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noProxyIcon: {fontSize: 56, marginBottom: 16},
  noProxyTitle: {color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12},
  noProxyText: {color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22},
});
