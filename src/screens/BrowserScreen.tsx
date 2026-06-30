import React, {useState, useRef, useCallback, useMemo, useEffect} from 'react';
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
  Animated,
  PanResponder,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import {WebView, WebViewNavigation} from 'react-native-webview';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import {useProxy} from '../services/ProxyContext';
import {useAppSettings, SEARCH_ENGINE_URLS} from '../services/AppSettings';
import AdBlocker from '../services/AdBlocker';
import Library from '../services/Library';
import SitePermissions from '../services/SitePermissions';
import TabSwitcher, {TabSummary} from '../components/TabSwitcher';
import LibraryModal from '../components/LibraryModal';
import FindBar from '../components/FindBar';
import SiteInfoPanel from '../components/SiteInfoPanel';
import AddressAutocomplete from '../components/AddressAutocomplete';
import PasswordAutofillBanner from '../components/PasswordAutofillBanner';
import {ChevronIcon, PlusIcon, DotsIcon, ReloadIcon, LockIcon} from '../components/Icon';
import theme from '../theme';

const {DownloadModule} = NativeModules;
const downloadEmitter = DownloadModule ? new NativeEventEmitter(DownloadModule) : null;

const ADBLOCKER_JS = AdBlocker.getInjectionScript();
const TABS_STORAGE_KEY = 'phantom_tabs_v1';
const DOWNLOADS_KEY = 'phantom_downloads';
const PASSWORDS_KEY = 'phantom_passwords';

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

interface PasswordEntry {
  id: string;
  site: string;
  username: string;
  password: string;
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

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
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
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tabSwitcherVisible, setTabSwitcherVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [siteInfoVisible, setSiteInfoVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [proxyWarningDismissed, setProxyWarningDismissed] = useState(false);
  const [autofillUser, setAutofillUser] = useState<{username: string; password: string} | null>(null);
  const [autofillDismissed, setAutofillDismissed] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const webviewRefs = useRef<Record<string, WebView | null>>({});
  const inputUrlRef = useRef(inputUrl);
  inputUrlRef.current = inputUrl;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pullAnim = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  scrollYRef.current = scrollY;

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  const browsingBlocked = settings.requireProxy && !isConnected;
  const showUnprotectedWarning = !settings.requireProxy && !isConnected && !proxyWarningDismissed;

  // ---------- Tab persistence ----------
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TABS_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.tabs?.length) {
            setTabs(saved.tabs);
            setActiveId(saved.activeId ?? saved.tabs[0].id);
          }
        }
      } catch {
        // fall back to the default fresh tab
      } finally {
        setTabsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!tabsLoaded) return; // don't overwrite saved tabs before the initial load resolves
    AsyncStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({tabs, activeId})).catch(() => {});
  }, [tabs, activeId, tabsLoaded]);

  // ---------- Back button ----------
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

  // ---------- Download completion listener ----------
  useEffect(() => {
    if (!downloadEmitter) return;
    const sub = downloadEmitter.addListener('PhantomDownloadComplete', async (event: any) => {
      try {
        const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const updated = list.map((d: any) =>
          d.id === event.id
            ? {...d, status: event.success ? 'done' : 'failed', localPath: event.localPath || d.localPath}
            : d,
        );
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
      } catch {
        // best-effort — DownloadsScreen will just show "downloading" if this fails
      }
    });
    return () => sub.remove();
  }, []);

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
          nav = SEARCH_ENGINE_URLS[settings.searchEngine] + encodeURIComponent(nav);
        }
      }
      updateTab(activeId, {url: nav});
      setInputUrl('');
      setEditingUrl(false);
      setAutofillDismissed(false);
    },
    [activeId, updateTab, settings.searchEngine],
  );

  const checkAutofill = useCallback(async (url: string) => {
    try {
      const raw = await EncryptedStorage.getItem(PASSWORDS_KEY);
      if (!raw) return;
      const entries: PasswordEntry[] = JSON.parse(raw);
      const domain = getDomain(url);
      const match = entries.find(
        e => domain.includes(e.site.toLowerCase()) || e.site.toLowerCase().includes(domain),
      );
      if (match) {
        setAutofillUser({username: match.username, password: match.password});
      } else {
        setAutofillUser(null);
      }
    } catch {
      setAutofillUser(null);
    }
  }, []);

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
        setAutofillDismissed(false);
        checkAutofill(state.url);
      }
    },
    [activeId, updateTab, checkAutofill],
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
    } catch {}
  }, [activeTab]);

  const fillCredentials = useCallback(() => {
    if (!activeTab || !autofillUser) return;
    const u = autofillUser.username.replace(/'/g, "\\'");
    const p = autofillUser.password.replace(/'/g, "\\'");
    webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() {
        try {
          var pass = document.querySelector('input[type=password]');
          var user = document.querySelector('input[type=email], input[type=text][name*=user i], input[type=text][id*=user i], input[autocomplete=username]');
          function setVal(el, val) {
            if (!el) return;
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', {bubbles: true}));
            el.dispatchEvent(new Event('change', {bubbles: true}));
          }
          if (user) setVal(user, '${u}');
          if (pass) setVal(pass, '${p}');
        } catch (e) {}
      })();
      true;
    `);
    setAutofillDismissed(true);
  }, [activeTab, autofillUser]);

  // ---------- File downloads ----------
  const handleFileDownload = useCallback(async (downloadUrl: string) => {
    const filename = decodeURIComponent(downloadUrl.split('/').pop()?.split('?')[0] || `download_${Date.now()}`);
    const jsId = `dl_${Date.now()}`;

    try {
      const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: jsId,
        filename,
        url: downloadUrl,
        size: '',
        status: 'downloading',
        localPath: '',
        savedAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(list));
    } catch {}

    if (DownloadModule?.startDownload) {
      try {
        await DownloadModule.startDownload(downloadUrl, filename, jsId);
      } catch {
        // Falls back to staying in the "downloading" state; user can still open the URL manually.
      }
    }
  }, []);

  // ---------- Site permissions (camera/mic/location requests from pages) ----------
  const handlePermissionRequest = useCallback(
    async (event: any) => {
      const resources: string[] = event.nativeEvent.resources || [];
      const origin = activeTab ? getOrigin(activeTab.url) : '';
      const rec = await SitePermissions.get(origin);

      const kindFor = (r: string) => {
        if (r.toLowerCase().includes('video')) return 'camera' as const;
        if (r.toLowerCase().includes('audio')) return 'microphone' as const;
        return 'camera' as const;
      };

      const decisions = resources.map(r => rec[kindFor(r)]);
      if (decisions.every(d => d === 'allow')) {
        event.grant(resources);
      } else {
        // 'ask' or 'deny' both default to deny here — the user can flip to "allow"
        // anytime from the site info panel (🔒 icon) rather than being interrupted mid-page.
        event.deny();
      }
    },
    [activeTab],
  );

  const userAgent = activeTab?.desktopSite ? DESKTOP_UA : MOBILE_UA;

  const tabSummaries: TabSummary[] = useMemo(
    () => tabs.map(t => ({id: t.id, title: t.title, url: t.url})),
    [tabs],
  );

  const findScript = useCallback(
    (text: string) => {
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
    },
    [activeTab],
  );

  const findNext = useCallback(() => {
    activeTab &&
      webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() { try { window.find && window.find('', false, false, true); } catch(e) {} })(); true;
    `);
  }, [activeTab]);

  // ---------- Progress bar ----------
  const handleLoadProgress = useCallback(
    (e: any) => {
      Animated.timing(progressAnim, {
        toValue: e.nativeEvent.progress,
        duration: 150,
        useNativeDriver: false,
      }).start();
    },
    [progressAnim],
  );

  // ---------- Pull to refresh (custom, since WebView isn't a ScrollView) ----------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        scrollYRef.current <= 0 && gesture.dy > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) {
          pullAnim.setValue(Math.min(gesture.dy, 90));
        }
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 70 && activeTab) {
          setRefreshing(true);
          webviewRefs.current[activeTab.id]?.reload();
          setTimeout(() => setRefreshing(false), 800);
        }
        Animated.spring(pullAnim, {toValue: 0, useNativeDriver: false}).start();
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.bg} />

      <View style={styles.statusBar}>
        <View style={[styles.dot, {backgroundColor: isConnected ? theme.colors.success : theme.colors.danger}]} />
        <Text style={styles.statusText} numberOfLines={1}>
          {isConnected
            ? `Protected · ${chain?.exitIP ?? '...'}`
            : settings.requireProxy
            ? 'No proxy — browsing locked'
            : 'No proxy — browsing unprotected'}
        </Text>
      </View>

      {/* Top loading progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']}),
              opacity: loading ? 1 : 0,
            },
          ]}
        />
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

      {autofillUser && !autofillDismissed && (
        <PasswordAutofillBanner
          username={autofillUser.username}
          onFill={fillCredentials}
          onDismiss={() => setAutofillDismissed(true)}
        />
      )}

      <View style={styles.urlBar}>
        <TouchableOpacity
          onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goBack()}
          disabled={!activeTab?.canGoBack}
          style={styles.iconBtn}>
          <ChevronIcon direction="left" color={activeTab?.canGoBack ? theme.colors.text : theme.colors.textFaint} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goForward()}
          disabled={!activeTab?.canGoForward}
          style={styles.iconBtn}>
          <ChevronIcon direction="right" color={activeTab?.canGoForward ? theme.colors.text : theme.colors.textFaint} />
        </TouchableOpacity>

        <View style={{flex: 1}}>
          {editingUrl ? (
            <TextInput
              style={styles.urlInput}
              placeholder={activeTab?.url}
              placeholderTextColor={theme.colors.textFaint}
              value={inputUrl}
              onChangeText={setInputUrl}
              onSubmitEditing={() => navigate(inputUrlRef.current)}
              onBlur={() => setTimeout(() => setEditingUrl(false), 150)}
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
              <TouchableOpacity
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                onPress={() => setSiteInfoVisible(true)}
                style={{marginRight: 6}}>
                <LockIcon color={isConnected ? theme.colors.success : theme.colors.danger} />
              </TouchableOpacity>
              <Text style={styles.urlDisplayText} numberOfLines={1}>
                {getDomain(activeTab?.url ?? '')}
              </Text>
            </TouchableOpacity>
          )}
          {editingUrl && <AddressAutocomplete query={inputUrl} onSelect={navigate} />}
        </View>

        <TouchableOpacity onPress={() => activeTab && webviewRefs.current[activeTab.id]?.reload()} style={styles.iconBtn}>
          <ReloadIcon color={theme.colors.text} />
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

      <View style={styles.webviewArea} {...panResponder.panHandlers}>
        <Animated.View style={[styles.pullIndicator, {height: pullAnim}]}>
          {(refreshing || (pullAnim as any)._value > 10) && (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          )}
        </Animated.View>

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
                onLoadProgress={tab.id === activeId ? handleLoadProgress : undefined}
                onScroll={tab.id === activeId ? e => setScrollY(e.nativeEvent.contentOffset.y) : undefined}
                onNavigationStateChange={state => handleNavState(tab.id, state)}
                onFileDownload={tab.id === activeId ? e => handleFileDownload(e.nativeEvent.downloadUrl) : undefined}
                onPermissionRequest={tab.id === activeId ? handlePermissionRequest : undefined}
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

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomBtn} onPress={openNewTab}>
          <PlusIcon color={theme.colors.text} />
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
          <DotsIcon color={theme.colors.text} />
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

      <SiteInfoPanel
        visible={siteInfoVisible}
        origin={activeTab ? getOrigin(activeTab.url) : ''}
        isConnected={isConnected}
        exitIP={chain?.exitIP}
        onDismiss={() => setSiteInfoVisible(false)}
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
  container: {flex: 1, backgroundColor: theme.colors.bg},
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  dot: {width: 8, height: 8, borderRadius: 4, marginRight: 6},
  statusText: {color: theme.colors.textDim, fontSize: 11, flex: 1},
  progressTrack: {height: 2, backgroundColor: 'transparent'},
  progressFill: {height: 2, backgroundColor: theme.colors.accent},
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a1d00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#5a2d00',
  },
  warningText: {color: theme.colors.warning, fontSize: 11, flex: 1},
  warningDismiss: {color: theme.colors.warning, fontSize: 14, paddingHorizontal: 8, fontWeight: '700'},
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconBtn: {paddingHorizontal: 8, paddingVertical: 6},
  urlInput: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.accentDim,
  },
  urlDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  urlDisplayText: {color: theme.colors.text, fontSize: 13, flex: 1},
  webviewArea: {flex: 1},
  pullIndicator: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  webview: {flex: 1},
  noProxy: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  noProxyIcon: {fontSize: 56, marginBottom: 16},
  noProxyTitle: {color: theme.colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12},
  noProxyText: {color: theme.colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 22},
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  bottomBtn: {paddingHorizontal: 18, paddingVertical: 4, alignItems: 'center', justifyContent: 'center'},
  bottomIcon: {color: theme.colors.text, fontSize: 18},
  tabCountBadge: {
    width: 26,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {color: theme.colors.text, fontSize: 11, fontWeight: '700'},
  menuOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  menuSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingVertical: 8,
    paddingBottom: 24,
  },
  menuItem: {paddingVertical: 14, paddingHorizontal: 20},
  menuItemText: {color: theme.colors.text, fontSize: 15},
});
