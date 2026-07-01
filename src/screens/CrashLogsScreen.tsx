import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
  Alert,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {buildGithubIssueUrl} from '../services/CrashReporter';

const {CrashReportModule} = NativeModules;

const JS_CRASH_KEY = 'phantom_pending_js_crash';

interface CrashEntry {
  id: string;
  type: 'js' | 'native' | 'unknown';
  message: string;
  stack: string;
  timestamp: number;
  source: string;
}

export default function CrashLogsScreen() {
  const [logs, setLogs] = useState<CrashEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const entries: CrashEntry[] = [];

    // ── JS crash (current pending) ──
    try {
      const raw = await AsyncStorage.getItem(JS_CRASH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        entries.push({
          id: 'js_pending',
          type: 'js',
          message: parsed.message ?? '(no message)',
          stack: parsed.stack ?? '(no stack)',
          timestamp: parsed.timestamp ?? Date.now(),
          source: 'JS ErrorUtils handler',
        });
      }
    } catch {}

    // ── Native crash (from Java uncaught exception handler) ──
    try {
      if (CrashReportModule?.getPendingReport) {
        const result = await CrashReportModule.getPendingReport();
        if (result?.report) {
          const lines: string[] = result.report.split('\n');
          const message = lines.find((l: string) => l.startsWith('message:'))
            ?.replace('message:', '').trim() ?? 'Native crash';
          entries.push({
            id: 'native_pending',
            type: 'native',
            message,
            stack: result.report,
            timestamp: Date.now(),
            source: 'Java UncaughtExceptionHandler',
          });
        }
      }
    } catch {}

    // ── All AsyncStorage keys (scan for any crash-related keys) ──
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const crashKeys = allKeys.filter(k =>
        k.includes('crash') || k.includes('error') || k.includes('exception'));
      for (const key of crashKeys) {
        if (key === JS_CRASH_KEY) continue; // already added above
        try {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) continue;
          let parsed: any;
          try { parsed = JSON.parse(raw); } catch { parsed = {message: raw}; }
          entries.push({
            id: key,
            type: 'unknown',
            message: parsed.message ?? parsed.error ?? String(raw).slice(0, 100),
            stack: parsed.stack ?? raw,
            timestamp: parsed.timestamp ?? 0,
            source: `AsyncStorage key: ${key}`,
          });
        } catch {}
      }
    } catch {}

    // Sort newest first
    entries.sort((a, b) => b.timestamp - a.timestamp);
    setLogs(entries);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const clearAll = () => {
    Alert.alert('Clear Crash Logs', 'Delete all stored crash reports?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(JS_CRASH_KEY);
          CrashReportModule?.clearPendingReport?.();
          setLogs([]);
        },
      },
    ]);
  };

  const reportToGithub = (entry: CrashEntry) => {
    const url = buildGithubIssueUrl({
      type: entry.type === 'unknown' ? 'js' : entry.type,
      message: entry.message,
      stack: entry.stack,
      timestamp: entry.timestamp,
    });
    Linking.openURL(url);
  };

  return (
    <ScrollView
      style={S.root}
      contentContainerStyle={S.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7c3aed" />}>

      <View style={S.header}>
        <Text style={S.title}>Crash Logs</Text>
        {logs.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={S.clearBtn}>
            <Text style={S.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={S.sub}>Pull to refresh · {logs.length} report{logs.length !== 1 ? 's' : ''} found</Text>

      {logs.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyIcon}>✅</Text>
          <Text style={S.emptyText}>No crash reports found</Text>
          <Text style={S.emptySub}>The app hasn't recorded any crashes yet.</Text>
        </View>
      ) : (
        logs.map(entry => (
          <View key={entry.id} style={S.card}>
            <TouchableOpacity
              style={S.cardHeader}
              onPress={() => setExpanded(expanded === entry.id ? null : entry.id)}
              activeOpacity={0.75}>
              <View style={[S.typeBadge, entry.type === 'native' ? S.typeBadgeNative : entry.type === 'js' ? S.typeBadgeJs : S.typeBadgeUnknown]}>
                <Text style={S.typeBadgeText}>{entry.type.toUpperCase()}</Text>
              </View>
              <View style={S.cardMeta}>
                <Text style={S.cardMessage} numberOfLines={2}>{entry.message}</Text>
                <Text style={S.cardSource}>{entry.source}</Text>
                {entry.timestamp > 0 && (
                  <Text style={S.cardTime}>{new Date(entry.timestamp).toLocaleString()}</Text>
                )}
              </View>
              <Text style={S.chevron}>{expanded === entry.id ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {expanded === entry.id && (
              <View style={S.cardBody}>
                <Text style={S.stackLabel}>Stack trace</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator style={S.stackScroll}>
                  <Text selectable style={S.stack}>{entry.stack}</Text>
                </ScrollView>
                <TouchableOpacity style={S.reportBtn} onPress={() => reportToGithub(entry)}>
                  <Text style={S.reportBtnText}>↗ Report on GitHub</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0a0a0f'},
  content: {padding: 16, paddingBottom: 40},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4},
  title: {color: '#fff', fontSize: 24, fontWeight: '700'},
  clearBtn: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1f2937'},
  clearBtnText: {color: '#ef4444', fontSize: 13, fontWeight: '600'},
  sub: {color: '#6b7280', fontSize: 12, marginBottom: 20},
  empty: {alignItems: 'center', paddingTop: 60},
  emptyIcon: {fontSize: 48, marginBottom: 16},
  emptyText: {color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 8},
  emptySub: {color: '#6b7280', fontSize: 13, textAlign: 'center'},
  card: {
    backgroundColor: '#13131c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  typeBadgeJs: {backgroundColor: '#7c3aed'},
  typeBadgeNative: {backgroundColor: '#dc2626'},
  typeBadgeUnknown: {backgroundColor: '#374151'},
  typeBadgeText: {color: '#fff', fontSize: 10, fontWeight: '800'},
  cardMeta: {flex: 1},
  cardMessage: {color: '#f5f5f7', fontSize: 13, fontWeight: '600', lineHeight: 18},
  cardSource: {color: '#6b7280', fontSize: 11, marginTop: 3},
  cardTime: {color: '#4b5563', fontSize: 11, marginTop: 2},
  chevron: {color: '#6b7280', fontSize: 14, paddingTop: 2},
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  stackLabel: {
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 10,
  },
  stackScroll: {maxHeight: 200},
  stack: {
    color: '#e5e7eb',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  reportBtn: {
    marginTop: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  reportBtnText: {color: '#a78bfa', fontSize: 13, fontWeight: '600'},
});
