import React, {useState, useRef, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  BackHandler,
  Share,
  Modal,
  Animated,
  PanResponder,
  NativeModules,
  NativeEventEmitter,
  Dimensions,
  ScrollView,
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
import {openInChrome, getChromeEngineInfo, prefetchInChrome, ChromeEngineInfo} from '../services/ChromeShell';
import TabSwitcher, {TabSummary} from '../components/TabSwitcher';
import LibraryModal from '../components/LibraryModal';
import FindBar from '../components/FindBar';
import SiteInfoPanel from '../components/SiteInfoPanel';
import AddressAutocomplete from '../components/AddressAutocomplete';
import PasswordAutofillBanner from '../components/PasswordAutofillBanner';

const {DownloadModule} = NativeModules;
const downloadEmitter = DownloadModule ? new NativeEventEmitter(DownloadModule) : null;

const ADBLOCKER_JS = AdBlocker.getInjectionScript();
const TABS_STORAGE_KEY = 'phantom_tabs_v1';
const DOWNLOADS_KEY = 'phantom_downloads';
const PASSWORDS_KEY = 'phantom_passwords';

// Chrome-matching user agents
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// Forces desktop viewport: overrides meta viewport so the site renders
// as if it's running on a 1280px-wide desktop screen.
const DESKTOP_VIEWPORT_JS = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.appendChild(meta); }
  meta.content = 'width=1280, initial-scale=0.5, user-scalable=yes';
})(); true;
`;

// Restores normal mobile viewport
const MOBILE_VIEWPORT_JS = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.content = 'width=device-width, initial-scale=1, user-scalable=yes';
})(); true;
`;

interface TabState {
  id: string;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  desktopSite: boolean;
  zoom: number;
  mode: 'webview' | 'chrome'; // webview = proxied; chrome = real Chromium engine
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
    zoom: 100,
    mode: 'webview',
  };
}

function getOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}
function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function isHttps(url: string): boolean {
  return url.startsWith('https://');
}

// ─── Icons (inline SVG-style views, no icon font dependency) ──────────────────

function BackIcon({color}: {color: string}) {
  return (
    <View style={{width: 20, height: 20, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{rotate: '45deg'}]}} />
    </View>
  );
}
function ForwardIcon({color}: {color: string}) {
  return (
    <View style={{width: 20, height: 20, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{rotate: '-45deg'}]}} />
    </View>
  );
}
function TabsIcon({count, color}: {count: number; color: string}) {
  return (
    <View style={{width: 24, height: 24, borderRadius: 5, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center'}}>
      <Text style={{color, fontSize: count > 9 ? 9 : 11, fontWeight: '700'}}>{count > 99 ? '99' : count}</Text>
    </View>
  );
}
function MenuIcon({color}: {color: string}) {
  return (
    <View style={{gap: 4, alignItems: 'center', justifyContent: 'center', padding: 2}}>
      {[0,1,2].map(i => <View key={i} style={{width: 18, height: 2, backgroundColor: color, borderRadius: 1}} />)}
    </View>
  );
}
function ReloadIcon({color}: {color: string}) {
  return (
    <View style={{width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: color, borderRightColor: 'transparent', transform: [{rotate: '45deg'}]}} />
  );
}
function LockIcon({secure}: {secure: boolean}) {
  return (
    <View style={{alignItems: 'center', marginRight: 4}}>
      <View style={{
        width: 9, height: 7,
        borderWidth: 1.5,
        borderColor: secure ? '#22c55e' : '#9ca3af',
        borderBottomWidth: 0,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
      }} />
      <View style={{
        width: 13, height: 8,
        backgroundColor: secure ? '#22c55e' : '#9ca3af',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <View style={{width: 2, height: 3, backgroundColor: '#fff', borderRadius: 1}} />
      </View>
    </View>
  );
}

// ─── Menu Sheet Item ──────────────────────────────────────────────────────────

function MenuItem({icon, label, sub, onPress, right}: {
  icon: string; label: string; sub?: string; onPress: () => void; right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={menuItemStyle.row} onPress={onPress} activeOpacity={0.65}>
      <Text style={menuItemStyle.icon}>{icon}</Text>
      <View style={{flex: 1}}>
        <Text style={menuItemStyle.label}>{label}</Text>
        {sub ? <Text style={menuItemStyle.sub}>{sub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}
const menuItemStyle = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1f2937'},
  icon: {fontSize: 18, width: 30},
  label: {color: '#f5f5f7', fontSize: 15},
  sub: {color: '#6b7280', fontSize: 11, marginTop: 1},
});

// ─── Zoom Slider ─────────────────────────────────────────────────────────────

function ZoomRow({zoom, onZoom}: {zoom: number; onZoom: (z: number) => void}) {
  const steps = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
  return (
    <View style={zoomStyle.container}>
      <TouchableOpacity onPress={() => {
        const idx = steps.indexOf(zoom);
        if (idx > 0) onZoom(steps[idx - 1]);
      }} style={zoomStyle.btn}>
        <Text style={zoomStyle.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={zoomStyle.label}>{zoom}%</Text>
      <TouchableOpacity onPress={() => {
        const idx = steps.indexOf(zoom);
        if (idx < steps.length - 1) onZoom(steps[idx + 1]);
      }} style={zoomStyle.btn}>
        <Text style={zoomStyle.btnText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onZoom(100)} style={zoomStyle.resetBtn}>
        <Text style={zoomStyle.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}
const zoomStyle = StyleSheet.create({
  container: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1f2937'},
  btn: {width: 36, height: 36, borderRadius: 18, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center'},
  btnText: {color: '#fff', fontSize: 22, fontWeight: '300', lineHeight: 26},
  label: {color: '#f5f5f7', fontSize: 15, fontWeight: '600', width: 52, textAlign: 'center'},
  resetBtn: {marginLeft: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1f2937'},
  resetText: {color: '#8b5cf6', fontSize: 13, fontWeight: '600'},
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BrowserScreen() {
  const {isConnected, chain} = useProxy();
  const settings = useAppSettings();

  const [tabs, setTabs] = useState<TabState[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [tabSwitcherVisible, setTabSwitcherVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [siteInfoVisible, setSiteInfoVisible] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [proxyWarningDismissed, setProxyWarningDismissed] = useState(false);
  const [autofillUser, setAutofillUser] = useState<{username: string; password: string} | null>(null);
  const [autofillDismissed, setAutofillDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [urlBarFocused, setUrlBarFocused] = useState(false);
  const [chromeEngine, setChromeEngine] = useState<ChromeEngineInfo>({available: false, package: '', name: 'None'});
  // Translate modal
  const [translateVisible, setTranslateVisible] = useState(false);
  const [translateLang, setTranslateLang] = useState('es');

  // Detect which Chromium engine is available on this device on mount
  useEffect(() => {
    getChromeEngineInfo().then(setChromeEngine);
  }, []);

  const webviewRefs = useRef<Record<string, WebView | null>>({});
  const inputRef = useRef<TextInput>(null);
  const inputUrlRef = useRef(inputUrl);
  inputUrlRef.current = inputUrl;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pullAnim = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeId) ?? tabs[0], [tabs, activeId]);

  const browsingBlocked = settings.requireProxy && !isConnected;
  const showWarning = !settings.requireProxy && !isConnected && !proxyWarningDismissed;

  // ── Tab persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TABS_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.tabs?.length) { setTabs(saved.tabs); setActiveId(saved.activeId ?? saved.tabs[0].id); }
        }
      } catch {} finally { setTabsLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!tabsLoaded) return;
    AsyncStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({tabs, activeId})).catch(() => {});
  }, [tabs, activeId, tabsLoaded]);

  // ── Download listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!downloadEmitter) return;
    const sub = downloadEmitter.addListener('PhantomDownloadComplete', async (event: any) => {
      try {
        const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const updated = list.map((d: any) =>
          d.id === event.id ? {...d, status: event.success ? 'done' : 'failed', localPath: event.localPath || d.localPath} : d);
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
      } catch {}
    });
    return () => sub.remove();
  }, []);

  // ── Back handler ──────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    const onBack = () => {
      if (activeTab?.canGoBack) { webviewRefs.current[activeTab.id]?.goBack(); return true; }
      return false;
    };
    BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBack);
  }, [activeTab]));

  // ── Progress bar animation ────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(progressAnim, {toValue: loadProgress, duration: 100, useNativeDriver: false}).start();
  }, [loadProgress, progressAnim]);

  const updateTab = useCallback((id: string, patch: Partial<TabState>) => {
    setTabs(prev => prev.map(t => t.id === id ? {...t, ...patch} : t));
  }, []);

  const navigate = useCallback(async (target: string) => {
    let nav = target.trim();
    if (!nav) return;
    if (!nav.startsWith('http://') && !nav.startsWith('https://')) {
      nav = nav.includes('.') && !nav.includes(' ') ? 'https://' + nav
        : SEARCH_ENGINE_URLS[settings.searchEngine ?? 'duckduckgo'] + encodeURIComponent(nav);
    }
    setInputUrl('');
    setEditingUrl(false);
    setAutofillDismissed(false);
    // If active tab is in Chrome mode, open in Chrome shell
    if (activeTab?.mode === 'chrome') {
      await openInChrome(nav);
      return;
    }
    updateTab(activeId, {url: nav});
  }, [activeId, activeTab, updateTab, settings.searchEngine]);

  const checkAutofill = useCallback(async (url: string) => {
    try {
      const raw = await EncryptedStorage.getItem(PASSWORDS_KEY);
      if (!raw) return;
      const entries: PasswordEntry[] = JSON.parse(raw);
      const domain = getDomain(url);
      const match = entries.find(e => domain.includes(e.site.toLowerCase()) || e.site.toLowerCase().includes(domain));
      setAutofillUser(match ? {username: match.username, password: match.password} : null);
    } catch { setAutofillUser(null); }
  }, []);

  const handleNavState = useCallback((id: string, state: WebViewNavigation) => {
    updateTab(id, {canGoBack: state.canGoBack, canGoForward: state.canGoForward, title: state.title || '', url: state.url || undefined!});
    if (!state.loading && id === activeId) {
      Library.addHistory(state.url, state.title || state.url);
      Library.isBookmarked(state.url).then(setBookmarked);
      setAutofillDismissed(false);
      checkAutofill(state.url);
    }
  }, [activeId, updateTab, checkAutofill]);

  const openNewTab = useCallback(() => {
    const t = newTab();
    setTabs(prev => [...prev, t]);
    setActiveId(t.id);
    setTabSwitcherVisible(false);
    setMenuVisible(false);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (remaining.length === 0) {
        const t = newTab(); setActiveId(t.id); delete webviewRefs.current[id]; return [t];
      }
      if (id === activeId) setActiveId(remaining[remaining.length - 1].id);
      delete webviewRefs.current[id];
      return remaining;
    });
  }, [activeId]);

  const selectTab = useCallback((id: string) => { setActiveId(id); setTabSwitcherVisible(false); }, []);

  const toggleDesktopSite = useCallback(() => {
    if (!activeTab) return;
    const next = !activeTab.desktopSite;
    updateTab(activeTab.id, {desktopSite: next});
    setMenuVisible(false);
    // Inject viewport override immediately, then reload for full effect
    const script = next ? DESKTOP_VIEWPORT_JS : MOBILE_VIEWPORT_JS;
    webviewRefs.current[activeTab.id]?.injectJavaScript(script);
    setTimeout(() => webviewRefs.current[activeTab.id]?.reload(), 150);
  }, [activeTab, updateTab]);

  const applyZoom = useCallback((tabId: string, zoom: number) => {
    // Use CSS zoom + meta viewport override for reliable zoom across all sites
    webviewRefs.current[tabId]?.injectJavaScript(`
      (function() {
        document.body.style.zoom = '${zoom / 100}';
        document.documentElement.style.zoom = '${zoom / 100}';
      })(); true;
    `);
  }, []);

  const setZoom = useCallback((zoom: number) => {
    if (!activeTab) return;
    updateTab(activeTab.id, {zoom});
    applyZoom(activeTab.id, zoom);
  }, [activeTab, updateTab, applyZoom]);

  const toggleBookmark = useCallback(async () => {
    if (!activeTab) return;
    const isNow = await Library.toggleBookmark(activeTab.url, activeTab.title || activeTab.url);
    setBookmarked(isNow);
    setMenuVisible(false);
  }, [activeTab]);

  const shareUrl = useCallback(async () => {
    if (!activeTab) return;
    setMenuVisible(false);
    try { await Share.share({message: activeTab.url}); } catch {}
  }, [activeTab]);

  const fillCredentials = useCallback(() => {
    if (!activeTab || !autofillUser) return;
    const u = autofillUser.username.replace(/'/g, "\\'");
    const p = autofillUser.password.replace(/'/g, "\\'");
    webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() {
        try {
          var pass = document.querySelector('input[type=password]');
          var user = document.querySelector('input[type=email], input[type=text][name*=user i], input[autocomplete=username]');
          function setVal(el, val) {
            if (!el) return;
            var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
            s.call(el, val);
            el.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (user) setVal(user, '${u}');
          if (pass) setVal(pass, '${p}');
        } catch(e) {}
      })(); true;
    `);
    setAutofillDismissed(true);
  }, [activeTab, autofillUser]);

  const handleFileDownload = useCallback(async (downloadUrl: string) => {
    const filename = decodeURIComponent(downloadUrl.split('/').pop()?.split('?')[0] || `download_${Date.now()}`);
    const jsId = `dl_${Date.now()}`;
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({id: jsId, filename, url: downloadUrl, size: '', status: 'downloading', localPath: '', savedAt: new Date().toISOString()});
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(list));
    } catch {}
    if (DownloadModule?.startDownload) {
      try { await DownloadModule.startDownload(downloadUrl, filename, jsId); } catch {}
    }
  }, []);

  const handlePermissionRequest = useCallback(async (event: any) => {
    const resources: string[] = event.nativeEvent.resources || [];
    const origin = activeTab ? getOrigin(activeTab.url) : '';
    const rec = await SitePermissions.get(origin);
    const kindFor = (r: string) => r.toLowerCase().includes('video') ? 'camera' as const : 'microphone' as const;
    const decisions = resources.map(r => rec[kindFor(r)]);
    if (decisions.every(d => d === 'allow')) event.grant(resources); else event.deny();
  }, [activeTab]);

  const translatePage = useCallback(() => {
    if (!activeTab) return;
    const url = `https://translate.google.com/translate?sl=auto&tl=${translateLang}&u=${encodeURIComponent(activeTab.url)}`;
    updateTab(activeId, {url});
    setMenuVisible(false);
    setTranslateVisible(false);
  }, [activeTab, activeId, updateTab, translateLang]);

  const toggleChromeMode = useCallback(async () => {
    if (!activeTab) return;
    const next = activeTab.mode === 'chrome' ? 'webview' : 'chrome';
    updateTab(activeTab.id, {mode: next});
    setMenuVisible(false);
    // If switching to Chrome mode, immediately open the current URL in Chrome
    if (next === 'chrome') {
      await openInChrome(activeTab.url);
    }
  }, [activeTab, updateTab]);

  // When a tab is in Chrome mode and navigates, open in Chrome instead
  const navigateChrome = useCallback(async (url: string) => {
    if (!activeTab || activeTab.mode !== 'chrome') return;
    await openInChrome(url);
  }, [activeTab]);

  const readingMode = useCallback(() => {
    if (!activeTab) return;
    setMenuVisible(false);
    webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() {
        try {
          // Remove nav, ads, sidebars; center and enlarge body text
          ['nav','header','footer','aside','[class*="ad"]','[class*="sidebar"]','[id*="sidebar"]'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
          });
          var main = document.querySelector('article,main,[role="main"]') || document.body;
          main.style.cssText = 'max-width:680px;margin:32px auto;padding:0 16px;font-size:20px;line-height:1.7;color:#1a1a1a;font-family:Georgia,serif;background:#fff';
          document.body.style.background = '#fff';
        } catch(e) {}
      })(); true;
    `);
  }, [activeTab]);

  const findScript = useCallback((text: string) => {
    if (!activeTab) return;
    const escaped = text.replace(/'/g, "\\'");
    webviewRefs.current[activeTab.id]?.injectJavaScript(`
      (function() {
        try {
          if (window.getSelection) window.getSelection().removeAllRanges();
          if ('${escaped}'.length > 0 && window.find) window.find('${escaped}', false, false, true, false, true, false);
        } catch(e) {}
      })(); true;
    `);
  }, [activeTab]);

  const findNext = useCallback(() => {
    activeTab && webviewRefs.current[activeTab.id]?.injectJavaScript(
      `(function(){try{window.find&&window.find('',false,false,true);}catch(e){}})();true;`);
  }, [activeTab]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => scrollYRef.current <= 0 && g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_e, g) => { if (g.dy > 0) pullAnim.setValue(Math.min(g.dy, 80)); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 60 && activeTab) {
        setRefreshing(true);
        webviewRefs.current[activeTab.id]?.reload();
        setTimeout(() => setRefreshing(false), 800);
      }
      Animated.spring(pullAnim, {toValue: 0, useNativeDriver: false}).start();
    },
  })).current;

  const webviewProps = useMemo(() => ({
    javaScriptEnabled: true,
    domStorageEnabled: !settings.incognito,
    thirdPartyCookiesEnabled: !settings.incognito,
    incognito: settings.incognito,
    injectedJavaScriptBeforeContentLoaded: settings.adBlock ? ADBLOCKER_JS : undefined,
  }), [settings.incognito, settings.adBlock]);

  const tabSummaries: TabSummary[] = useMemo(() => tabs.map(t => ({id: t.id, title: t.title, url: t.url})), [tabs]);
  const userAgent = activeTab?.desktopSite ? DESKTOP_UA : MOBILE_UA;

  if (!settings.loaded) return null;

  const secure = isHttps(activeTab?.url ?? '');
  const domain = getDomain(activeTab?.url ?? '');
  const canGoBack = activeTab?.canGoBack ?? false;
  const canGoForward = activeTab?.canGoForward ?? false;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f1f3f4" />

      {/* ── Proxy status strip ── */}
      <View style={[S.proxyStrip, {backgroundColor: isConnected ? '#ecfdf5' : '#fef2f2'}]}>
        <View style={[S.proxyDot, {backgroundColor: isConnected ? '#22c55e' : '#ef4444'}]} />
        <Text style={[S.proxyText, {color: isConnected ? '#15803d' : '#b91c1c'}]} numberOfLines={1}>
          {isConnected ? `Protected · ${chain?.exitIP ?? '...'}` : settings.requireProxy ? 'No proxy — browsing locked' : 'Unprotected'}
        </Text>
      </View>

      {/* ── Top address bar (Chrome-style) ── */}
      <View style={S.topBar}>
        <TouchableOpacity
          style={S.navBtn}
          onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goBack()}
          disabled={!canGoBack}>
          <BackIcon color={canGoBack ? '#202124' : '#bdc1c6'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={S.navBtn}
          onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goForward()}
          disabled={!canGoForward}>
          <ForwardIcon color={canGoForward ? '#202124' : '#bdc1c6'} />
        </TouchableOpacity>

        {/* ── Address pill ── */}
        {editingUrl ? (
          <View style={S.addressPillEdit}>
            <TextInput
              ref={inputRef}
              style={S.addressInput}
              value={inputUrl}
              onChangeText={v => {
                setInputUrl(v);
                if (v.startsWith('http') && activeTab?.mode === 'chrome') {
                  prefetchInChrome(v);
                }
              }}
              onSubmitEditing={() => navigate(inputUrlRef.current)}
              onBlur={() => setTimeout(() => setEditingUrl(false), 120)}
              returnKeyType="go"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectTextOnFocus
              autoFocus
              placeholder="Search or type URL"
              placeholderTextColor="#9aa0a6"
            />
            {inputUrl.length > 0 && (
              <TouchableOpacity onPress={() => setInputUrl('')} style={S.clearBtn}>
                <Text style={S.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
            <AddressAutocomplete query={inputUrl} onSelect={navigate} />
          </View>
        ) : (
          <TouchableOpacity
            style={S.addressPill}
            onPress={() => { setInputUrl(activeTab?.url ?? ''); setEditingUrl(true); }}
            activeOpacity={0.7}>
            <TouchableOpacity onPress={() => setSiteInfoVisible(true)} hitSlop={{top:8,bottom:8,left:6,right:6}}>
              <LockIcon secure={secure} />
            </TouchableOpacity>
            <Text style={S.addressText} numberOfLines={1}>{domain || 'Search or type URL'}</Text>
            {activeTab?.mode === 'chrome' && (
              <View style={S.chromeBadge}>
                <Text style={S.chromeBadgeText}>Chrome</Text>
              </View>
            )}
            {loading && (
              <View style={S.loadingDot}>
                <Animated.View style={[S.loadingDotInner, {opacity: progressAnim.interpolate({inputRange:[0,0.5,1],outputRange:[0.3,1,0.3]})}]} />
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={S.navBtn}
          onPress={() => { if (loading) webviewRefs.current[activeTab?.id ?? '']?.stopLoading(); else webviewRefs.current[activeTab?.id ?? '']?.reload(); }}>
          {loading
            ? <Text style={{color: '#5f6368', fontSize: 18}}>✕</Text>
            : <ReloadIcon color="#5f6368" />}
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ── */}
      {loading && (
        <Animated.View style={[S.progressBar, {
          width: progressAnim.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']}),
        }]} />
      )}

      {/* ── Unprotected warning banner ── */}
      {showWarning && (
        <View style={S.warningBanner}>
          <Text style={S.warningText}>⚠️ No proxy — your real IP is visible to sites</Text>
          <TouchableOpacity onPress={() => setProxyWarningDismissed(true)}>
            <Text style={S.warningClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Autofill banner ── */}
      {autofillUser && !autofillDismissed && (
        <PasswordAutofillBanner
          username={autofillUser.username}
          onFill={fillCredentials}
          onDismiss={() => setAutofillDismissed(true)}
        />
      )}

      {/* ── Find bar ── */}
      {findVisible && (
        <FindBar
          onFind={findScript}
          onNext={findNext}
          onPrev={findNext}
          onClose={() => { setFindVisible(false); findScript(''); }}
        />
      )}

      {/* ── WebView area ── */}
      <View style={S.webviewArea} {...panResponder.panHandlers}>
        <Animated.View style={[S.pullIndicator, {height: pullAnim}]}>
          {refreshing && <Text style={{color: '#8b5cf6', fontSize: 18}}>↻</Text>}
        </Animated.View>

        {browsingBlocked ? (
          <View style={S.noProxy}>
            <Text style={S.noProxyIcon}>🛡️</Text>
            <Text style={S.noProxyTitle}>No Proxy Connected</Text>
            <Text style={S.noProxyBody}>Go to the Proxy tab and connect your SOCKS5 proxy before browsing. To allow unprotected browsing, go to Settings → Require Proxy.</Text>
          </View>
        ) : (
          tabs.map(tab => (
            <View key={tab.id} style={[StyleSheet.absoluteFill, {display: tab.id === activeId ? 'flex' : 'none'}]}>
              {tab.mode === 'chrome' ? (
                // Chrome mode: page is open in actual Chrome. Show a card so
                // the user knows what happened and can switch back.
                <View style={S.chromeCard}>
                  <Text style={S.chromeCardIcon}>🌐</Text>
                  <Text style={S.chromeCardTitle}>Opened in {chromeEngine.name}</Text>
                  <Text style={S.chromeCardBody}>
                    This tab is using the real Chromium engine. Sites like Facebook and Instagram
                    see a genuine Chrome fingerprint.{'\n\n'}
                    Note: traffic is NOT routed through your proxy in Chrome mode.
                  </Text>
                  <TouchableOpacity
                    style={S.chromeCardBtn}
                    onPress={() => openInChrome(tab.url)}>
                    <Text style={S.chromeCardBtnText}>Re-open in Chrome</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={S.chromeCardBtnSecondary}
                    onPress={() => updateTab(tab.id, {mode: 'webview'})}>
                    <Text style={S.chromeCardBtnSecondaryText}>Switch back to Proxied WebView</Text>
                  </TouchableOpacity>
                </View>
              ) : (
              <WebView
                ref={ref => { webviewRefs.current[tab.id] = ref; }}
                source={{uri: tab.url}}
                style={S.webview}
                {...webviewProps}
                userAgent={tab.id === activeId ? userAgent : MOBILE_UA}
                onLoadStart={() => tab.id === activeId && setLoading(true)}
                onLoadEnd={() => { if (tab.id === activeId) { setLoading(false); setLoadProgress(0); } }}
                onLoadProgress={tab.id === activeId ? e => setLoadProgress(e.nativeEvent.progress) : undefined}
                onScroll={tab.id === activeId ? e => { scrollYRef.current = e.nativeEvent.contentOffset.y; } : undefined}
                onNavigationStateChange={state => handleNavState(tab.id, state)}
                onFileDownload={tab.id === activeId ? e => handleFileDownload(e.nativeEvent.downloadUrl) : undefined}
                onPermissionRequest={tab.id === activeId ? handlePermissionRequest : undefined}
                onShouldStartLoadWithRequest={request => !settings.adBlock || !AdBlocker.shouldBlock(request.url)}
                injectedJavaScript={tab.zoom !== 100 ? `document.body.style.zoom='${tab.zoom/100}';true;` : undefined}
              />
              )}
            </View>
          ))
        )}
      </View>

      {/* ── Bottom Chrome-style toolbar ── */}
      <View style={S.bottomBar}>
        <TouchableOpacity style={S.bottomBtn} onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goBack()} disabled={!canGoBack}>
          <BackIcon color={canGoBack ? '#202124' : '#bdc1c6'} />
        </TouchableOpacity>
        <TouchableOpacity style={S.bottomBtn} onPress={() => activeTab && webviewRefs.current[activeTab.id]?.goForward()} disabled={!canGoForward}>
          <ForwardIcon color={canGoForward ? '#202124' : '#bdc1c6'} />
        </TouchableOpacity>
        <TouchableOpacity style={S.bottomBtn} onPress={openNewTab}>
          <Text style={{color: '#202124', fontSize: 22, fontWeight: '300'}}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.bottomBtn} onPress={() => setTabSwitcherVisible(true)}>
          <TabsIcon count={tabs.length} color="#202124" />
        </TouchableOpacity>
        <TouchableOpacity style={S.bottomBtn} onPress={() => setMenuVisible(true)}>
          <MenuIcon color="#202124" />
        </TouchableOpacity>
      </View>

      {/* ── Modals ── */}
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

      {/* ── Chrome-style overflow menu bottom sheet ── */}
      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={S.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={S.menuSheet}>
            {/* drag handle */}
            <View style={S.menuHandle} />

            {/* Zoom row always visible at top */}
            <ZoomRow zoom={activeTab?.zoom ?? 100} onZoom={setZoom} />

            {/* Quick action row like Chrome */}
            <View style={S.menuQuickRow}>
              {[
                {icon: bookmarked ? '★' : '☆', label: bookmarked ? 'Bookmarked' : 'Bookmark', action: toggleBookmark},
                {icon: '📚', label: 'Library', action: () => { setMenuVisible(false); setLibraryVisible(true); }},
                {icon: '↓', label: 'Downloads', action: () => setMenuVisible(false)},
                {icon: '↗', label: 'Share', action: shareUrl},
              ].map(({icon, label, action}) => (
                <TouchableOpacity key={label} style={S.menuQuickBtn} onPress={action}>
                  <Text style={S.menuQuickIcon}>{icon}</Text>
                  <Text style={S.menuQuickLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={S.menuDivider} />

            <MenuItem
              icon={activeTab?.desktopSite ? '📱' : '🖥️'}
              label={activeTab?.desktopSite ? 'Switch to Mobile Site' : 'Request Desktop Site'}
              onPress={toggleDesktopSite}
            />
            <MenuItem
              icon="🌐"
              label={activeTab?.mode === 'chrome' ? 'Switch to Proxied WebView' : 'Open in Chrome Shell'}
              sub={activeTab?.mode === 'chrome'
                ? 'Currently using real Chrome engine (no proxy)'
                : chromeEngine.available
                  ? `Uses ${chromeEngine.name} — real fingerprint, no proxy`
                  : 'No Chromium browser found on device'}
              onPress={chromeEngine.available ? toggleChromeMode : () => setMenuVisible(false)}
            />
            <MenuItem icon="🔍" label="Find in Page" onPress={() => { setFindVisible(true); setMenuVisible(false); }} />
            <MenuItem
              icon="🌐"
              label="Translate Page"
              sub={`Target: ${translateLang.toUpperCase()}`}
              onPress={() => setTranslateVisible(true)}
            />
            <MenuItem icon="📰" label="Reading Mode" onPress={readingMode} />
            <MenuItem icon="🔒" label="Site Info" onPress={() => { setSiteInfoVisible(true); setMenuVisible(false); }} />
            <MenuItem icon="⚙️" label="Settings" onPress={() => setMenuVisible(false)} />

            <View style={{height: 16}} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Translate modal ── */}
      <Modal visible={translateVisible} transparent animationType="fade" onRequestClose={() => setTranslateVisible(false)}>
        <TouchableOpacity style={S.menuOverlay} activeOpacity={1} onPress={() => setTranslateVisible(false)}>
          <View style={[S.menuSheet, {paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32}]}>
            <Text style={{color: '#f5f5f7', fontSize: 17, fontWeight: '700', marginBottom: 16}}>Translate To</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{flexDirection: 'row', gap: 8}}>
                {[['en','English'],['es','Spanish'],['fr','French'],['de','German'],['ar','Arabic'],['zh','Chinese'],['ja','Japanese'],['pt','Portuguese'],['ru','Russian'],['hi','Hindi']].map(([code, name]) => (
                  <TouchableOpacity
                    key={code}
                    onPress={() => setTranslateLang(code)}
                    style={[S.langChip, translateLang === code && S.langChipActive]}>
                    <Text style={[S.langChipText, translateLang === code && {color: '#fff'}]}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={S.translateBtn} onPress={translatePage}>
              <Text style={S.translateBtnText}>Translate Now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Light theme matching Chrome's light UI. The rest of the app (Settings etc.)
// still uses the dark purple theme — only the browser chrome is light.

const S = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},

  // Proxy strip
  proxyStrip: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 4},
  proxyDot: {width: 7, height: 7, borderRadius: 4, marginRight: 6},
  proxyText: {fontSize: 11, fontWeight: '500', flex: 1},

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dadce0',
  },
  navBtn: {width: 38, height: 38, alignItems: 'center', justifyContent: 'center'},

  // Address pill (display mode)
  addressPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#dadce0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  addressText: {flex: 1, color: '#202124', fontSize: 14, fontWeight: '400'},

  // Address pill (edit mode)
  addressPillEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#1a73e8',
    elevation: 2,
  },
  addressInput: {flex: 1, color: '#202124', fontSize: 14, paddingVertical: 4},
  clearBtn: {paddingHorizontal: 6},
  clearBtnText: {color: '#5f6368', fontSize: 13},

  // Loading dot in address bar
  loadingDot: {width: 8, height: 8, marginLeft: 6},
  loadingDotInner: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a73e8'},

  // Progress bar (blue, Chrome-style)
  progressBar: {
    height: 3,
    backgroundColor: '#1a73e8',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 99,
  },

  // Warning banner
  warningBanner: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3cd', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#ffc107'},
  warningText: {color: '#664d03', fontSize: 12, flex: 1},
  warningClose: {color: '#664d03', fontSize: 14, paddingHorizontal: 6, fontWeight: '700'},

  // WebView area
  webviewArea: {flex: 1, backgroundColor: '#fff'},
  pullIndicator: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#fff'},
  webview: {flex: 1},

  // No proxy
  noProxy: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f8f9fa'},
  noProxyIcon: {fontSize: 64, marginBottom: 20},
  noProxyTitle: {color: '#202124', fontSize: 20, fontWeight: '700', marginBottom: 12},
  noProxyBody: {color: '#5f6368', fontSize: 14, textAlign: 'center', lineHeight: 22},

  // Bottom bar — Chrome layout: back | forward | new-tab | tabs | menu
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dadce0',
  },
  bottomBtn: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4},

  // Overflow menu sheet
  menuOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'},
  menuSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  menuHandle: {width: 36, height: 4, backgroundColor: '#374151', borderRadius: 2, alignSelf: 'center', marginBottom: 8},
  menuDivider: {height: StyleSheet.hairlineWidth, backgroundColor: '#1f2937', marginVertical: 4},

  // Quick action row (bookmark / library / downloads / share)
  menuQuickRow: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 8},
  menuQuickBtn: {alignItems: 'center', gap: 6, flex: 1},
  menuQuickIcon: {fontSize: 22},
  menuQuickLabel: {color: '#d1d5db', fontSize: 11, fontWeight: '500', textAlign: 'center'},

  // Translate
  langChip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151'},
  langChipActive: {backgroundColor: '#7c3aed', borderColor: '#7c3aed'},
  langChipText: {color: '#9ca3af', fontSize: 13, fontWeight: '600'},
  translateBtn: {marginTop: 20, backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 14, alignItems: 'center'},
  translateBtnText: {color: '#fff', fontWeight: '700', fontSize: 15},

  // Chrome mode badge in address bar
  chromeBadge: {
    backgroundColor: '#1a73e8',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  chromeBadgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},

  // Chrome mode card (shown instead of WebView when tab is in Chrome mode)
  chromeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
  },
  chromeCardIcon: {fontSize: 56, marginBottom: 16},
  chromeCardTitle: {color: '#202124', fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center'},
  chromeCardBody: {color: '#5f6368', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24},
  chromeCardBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  chromeCardBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  chromeCardBtnSecondary: {paddingVertical: 10},
  chromeCardBtnSecondaryText: {color: '#1a73e8', fontSize: 13, fontWeight: '600'},
});
