import React, {useState, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  Share,
  Modal,
} from 'react-native';
import {WebView, WebViewNavigation} from 'react-native-webview';
import {useFocusEffect} from '@react-navigation/native';
import {useProxy} from '../services/ProxyContext';
import {useAppSettings} from '../services/AppSettings';
import AdBlocker from '../services/AdBlocker';
import Library from '../services/Library';
import TabSwitcher, {TabSummary} from '../components/TabSwitcher';
import LibraryModal from '../components/LibraryModal';
import FindBar from '../components/FindBar';

const ADBLOCKER_JS = AdBlocker.getInjectionScript();

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

interface TabState {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  desktopSite: boolean;
}

let tabCounter = 0;
function newTab(url = 'https://duckduckgo.com'): TabState {
  tabCounter += 1;
  return {
    id: `tab_${Date.now()}_${tabCounter}`,
    url,
    title: '',
    canGoBack: false,
    canGoForward: false,
    desktopSite: false,
  };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function BrowserScreen() {
  const {isConnected, chain} = useProxy();
  const settings = useAppSettings();

  const [tabs, setTabs] = useState<TabState[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [inputUrl, setInputUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tabSwitcherVisible, setTabSwitcherVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [proxyWarningDismissed, setProxyWarningDismissed] = useState(false);

  const webviewRefs = useRef<Record<string, WebView | null>>({});
  const inputUrlRef = useRef(inputUrl);
  inputUrlRef.current = inputUrl;

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  // Browsing is blocked only if requireProxy is on AND no proxy is connected.
  const browsingBlocked = settings.requireProxy && !isConnected;
  const showUnprotectedWarning = !settings.requireProxy && !isConnected && !proxyWarningDismissed;

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (activeTab?.canGoBack) {
          webviewRefs.current[activeTab.id]?.goBack();
          return true;
        }
        return false;
      };
      BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBack);
    }, [activeTab]),
  );

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => prev.map(t => (t.id === id ? {...t, ...patch} : t)));
  }, []);

  const navigate = useCallback(
    (target: string) => {
      let nav = target.trim();
      if (!nav) return;
      if (!nav.startsWith('http://') && !nav.startsWith('https://')) {
        if (nav.includes('.') && !nav.includes(' ')) {
          nav = 'https://' + nav;
        } else {
          nav = `https://duckduckgo.com/?q=${encodeURIComponent(nav)}`;
        }
      }
      updateTab(activeId, {url: nav});
      setInputUrl('');
      setEditingUrl(false);
    },
    [activeId, updateTab],
  );

  const handleNavState = useCallback(
    (id: string, state: WebViewNavigation) => {
      updateTab(id, {
        canGoBack: state.canGoBack,
        canGoForward: state.canGoForward,
        title: state.title || '',
        url: state.url || undefined!,
      });
      if (!state.loading && id === activeId) {
        Library.addHistory(state.url, state.title || state.url);
        Library.isBookmarked(state.url).then(setBookmarked);
      }
    },
    [activeId, updateTab],
  );

  const openNewTab = useCallback(() => {
    const t = newTab();
    setTabs(prev => [...prev, t]);
    setActiveId(t.id);
    setTabSwitcherVisible(false);
    setMenuVisible(false);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs(prev => {
        const remaining = prev.filter(t => t.id !== id);
        if (remaining.length === 0) {
          const t = newTab();
          setActiveId(t.id);
          delete webviewRefs.current[id];
          return [t];
        }
        if (id === activeId) {
          setActiveId(remaining[remaining.length - 1].id);
        }
        delete webviewRefs.current[id];
        return remaining;
      });
    },
    [activeId],
  );

  const selectTab = useCallback((id: string) => {
    setActiveId(id);
    setTabSwitcherVisible(false);
  }, []);

  const toggleDesktopSite = useCallback(() => {
    if (!activeTab) return;
    updateTab(activeTab.id, {desktopSite: !activeTab.desktopSite});
    setMenuVisible(false);
    setTimeout(() => webviewRefs.current[activeTab.id]?.reload(), 50);
  }, [activeTab, updateTab]);

  const toggleBookmark = useCallback(async () => {
    if (!activeTab) return;
    const isNowBookmarked = await Library.toggleBookmark(activeTab.url, activeTab.title || activeTab.url);
    setBookmarked(isNowBookmarked);
    setMenuVisible(false);
  }, [activeTab]);

  const shareUrl = useCallback(async () => {
    if (!activeTab) return;
    setMenuVisible(false);
    try {
      await Share.share({message: activeTab.url});
    } catch {
      // user cancelled or share failed silently
    }
  }, [activeTab]);

  const userAgent = activeTab?.desktopSite ? DESKTOP_UA : MOBILE_UA;

  const tabSummaries: TabSummary[] = useMemo(
    () => tabs.map(t => ({id: t.id, title: t.title, url: t.url})),
    [tabs],
  );

  const findScript = useCallback((text: string) => {
    if (!activeTab) return;
    const escaped = text.replace(/'/g, "\\'");
    webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() {
        try {
          if (window.getSelection) window.getSelection().removeAllRanges();
          if ('${escaped}'.length > 0 && window.find) {
            window.find('${escaped}', false, false, true, false, true, false);
          }
        } catch (e) {}
      })();
      true;
    `);
  }, [activeTab]);

  const findNext = useCallback(() => {
    activeTab && webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() { try { window.find && window.find('', false, false, true); } catch(e) {} })(); true;
    `);
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />

      {/* Status / unprotected warning */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, {backgroundColor: isConnected ? '#22c55e' : '#ef4444'}]} />
        <Text style={styles.statusText} numberOfLines={1}>
          {isConnected
            ? `Protected · ${chain?.exitIP ?? '...'}`
            : settings.requireProxy
            ? 'No proxy — browsing locked'
            : 'No proxy — browsing unprotected'}
        </Text>
        {loading && <ActivityIndicator size="small" color="#7c3aed" style={{marginLeft: 8}} />}
      </View>

      {showUnprotectedWarning && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ You're browsing without a proxy. Your real IP is visible to sites.
          </Text>
          <TouchableOpacity onPress={() => setProxyWarningDismissed(true)}>
            <Text style={styles.warningDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* URL bar */}
      <View style={styles.urlBar}>
        <TouchableOpacity
          onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goBack()}
          disabled={!activeTab?.canGoBack}>
          <Text style={[styles.navBtn, !activeTab?.canGoBack && styles.navBtnDisabled]}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goForward()}
          disabled={!activeTab?.canGoForward}>
          <Text style={[styles.navBtn, !activeTab?.canGoForward && styles.navBtnDisabled]}>›</Text>
        </TouchableOpacity>

        {editingUrl ? (
          <TextInput
            style={styles.urlInput}
            placeholder={activeTab?.url}
            placeholderTextColor="#666"
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={() => navigate(inputUrlRef.current)}
            onBlur={() => setEditingUrl(false)}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
        ) : (
          <TouchableOpacity
            style={styles.urlDisplay}
            onPress={() => {
              setInputUrl(activeTab?.url ?? '');
              setEditingUrl(true);
            }}>
            {isConnected && <Text style={styles.lockIcon}>🔒</Text>}
            <Text style={styles.urlDisplayText} numberOfLines={1}>
              {getDomain(activeTab?.url ?? '')}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => activeTab && webviewRefs.current[activeTab.id]?.reload()}>
          <Text style={styles.navBtn}>↻</Text>
        </TouchableOpacity>
      </View>

      {findVisible && (
        <FindBar
          onFind={findScript}
          onNext={findNext}
          onPrev={findNext}
          onClose={() => {
            setFindVisible(false);
            findScript('');
          }}
        />
      )}

      {/* WebViews — all tabs mounted, only active one shown, so background tabs keep state */}
      <View style={styles.webviewArea}>
        {browsingBlocked ? (
          <View style={styles.noProxy}>
            <Text style={styles.noProxyIcon}>🛡️</Text>
            <Text style={styles.noProxyTitle}>No Proxy Connected</Text>
            <Text style={styles.noProxyText}>
              Go to the Proxy tab to connect your SOCKS5 proxy before browsing. You can allow
              unprotected browsing instead from Settings → "Require Proxy".
            </Text>
          </View>
        ) : (
          tabs.map(tab => (
            <View
              key={tab.id}
              style={[StyleSheet.absoluteFill, {display: tab.id === activeId ? 'flex' : 'none'}]}>
              <WebView
                ref={ref => {
                  webviewRefs.current[tab.id] = ref;
                }}
                source={{uri: tab.url}}
                style={styles.webview}
                proxy={isConnected ? {host: '127.0.0.1', port: 8118} : undefined}
                injectedJavaScriptBeforeContentLoaded={settings.adBlock ? ADBLOCKER_JS : undefined}
                onLoadStart={() => tab.id === activeId && setLoading(true)}
                onLoadEnd={() => tab.id === activeId && setLoading(false)}
                onNavigationStateChange={state => handleNavState(tab.id, state)}
                javaScriptEnabled={true}
                domStorageEnabled={!settings.incognito}
                thirdPartyCookiesEnabled={!settings.incognito}
                incognito={settings.incognito}
                userAgent={tab.id === activeId ? userAgent : MOBILE_UA}
                onShouldStartLoadWithRequest={request => {
                  return !settings.adBlock || !AdBlocker.shouldBlock(request.url);
                }}
              />
            </View>
          ))
        )}
      </View>

      {/* Bottom toolbar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomBtn} onPress={openNewTab}>
          <Text style={styles.bottomIcon}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => setLibraryVisible(true)}>
          <Text style={styles.bottomIcon}>📚</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => setTabSwitcherVisible(true)}>
          <View style={styles.tabCountBadge}>
            <Text style={styles.tabCountText}>{tabs.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomBtn} onPress={() => setMenuVisible(true)}>
          <Text style={styles.bottomIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      <TabSwitcher
        visible={tabSwitcherVisible}
        tabs={tabSummaries}
        activeId={activeId}
        onSelect={selectTab}
        onClose={closeTab}
        onNewTab={openNewTab}
        onDismiss={() => setTabSwitcherVisible(false)}
      />

      <LibraryModal
        visible={libraryVisible}
        onDismiss={() => setLibraryVisible(false)}
        onOpenUrl={url => updateTab(activeId, {url})}
      />

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={toggleBookmark}>
              <Text style={styles.menuItemText}>{bookmarked ? '★ Remove Bookmark' : '☆ Add Bookmark'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={toggleDesktopSite}>
              <Text style={styles.menuItemText}>
                {activeTab?.desktopSite ? '📱 Switch to Mobile Site' : '🖥️ Request Desktop Site'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setFindVisible(true);
                setMenuVisible(false);
              }}>
              <Text style={styles.menuItemText}>🔍 Find in Page</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={shareUrl}>
              <Text style={styles.menuItemText}>↗ Share Page</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a1d00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#5a2d00',
  },
  warningText: {color: '#fbbf24', fontSize: 11, flex: 1},
  warningDismiss: {color: '#fbbf24', fontSize: 14, paddingHorizontal: 8, fontWeight: '700'},
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
  urlDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  lockIcon: {fontSize: 11, marginRight: 6},
  urlDisplayText: {color: '#ddd', fontSize: 13, flex: 1},
  navBtn: {color: '#aaa', fontSize: 22, paddingHorizontal: 6},
  navBtnDisabled: {color: '#333'},
  webviewArea: {flex: 1},
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
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  bottomBtn: {paddingHorizontal: 18, paddingVertical: 4, alignItems: 'center', justifyContent: 'center'},
  bottomIcon: {color: '#ccc', fontSize: 20},
  tabCountBadge: {
    width: 26,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {color: '#ccc', fontSize: 11, fontWeight: '700'},
  menuOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  menuSheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  menuItem: {paddingVertical: 14, paddingHorizontal: 20},
  menuItemText: {color: '#fff', fontSize: 15},
});
