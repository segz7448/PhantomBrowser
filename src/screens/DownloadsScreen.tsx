import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules, PermissionsAndroid} from 'react-native';

const {DownloadModule} = NativeModules;

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  size: string;
  status: 'done' | 'failed' | 'downloading';
  localPath: string;
  savedAt: string;
}

const STORAGE_KEY = 'phantom_downloads';

export default function DownloadsScreen() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const syncPath = '/sdcard/PhantomBrowser';

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setDownloads(JSON.parse(raw));
    } catch {}
  };

  // FIX: WRITE_EXTERNAL_STORAGE is only needed on Android <= 9 (API 28).
  // On API 29+ it is deprecated; on API 30+ MANAGE_EXTERNAL_STORAGE covers it.
  // Requesting it unconditionally on modern devices always returns DENIED.
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const sdkInt = parseInt(Platform.Version as string, 10);
    // API 29+ doesn't need (and won't grant) WRITE_EXTERNAL_STORAGE
    if (sdkInt >= 29) return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {title: 'Storage Permission', message: 'Needed to save downloads', buttonPositive: 'OK'},
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const openFile = useCallback((item: DownloadItem) => {
    if (DownloadModule) {
      DownloadModule.openFile(item.localPath);
    } else {
      Alert.alert('Not available', 'File opening is not supported on this build.');
    }
  }, []);

  const deleteItem = useCallback((id: string) => {
    Alert.alert('Delete', 'Remove this download?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = downloads.filter(d => d.id !== id);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          setDownloads(updated);
        },
      },
    ]);
  }, [downloads]);

  const syncToLocal = useCallback(async () => {
    const ok = await requestPermission();
    if (!ok) {
      Alert.alert('Permission denied', 'Storage permission required for local sync.');
      return;
    }
    Alert.alert(
      'Local Cloud Sync',
      `Files are saved to:\n${syncPath}\n\nAll downloads are already stored locally on your device. This is your "local cloud" — no external servers involved.`,
      [{text: 'OK'}],
    );
  }, [requestPermission, syncPath]);

  const fileIcon = useCallback((filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext ?? '')) return '🖼️';
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext ?? '')) return '🎬';
    if (['mp3', 'flac', 'wav', 'aac'].includes(ext ?? '')) return '🎵';
    if (['pdf'].includes(ext ?? '')) return '📄';
    if (['zip', 'tar', 'gz', 'rar'].includes(ext ?? '')) return '📦';
    return '📁';
  }, []);

  // FIX: removed unused syncPath state (was useState, now const)
  // FIX: wrapped callbacks with useCallback to prevent unnecessary FlatList re-renders

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Downloads</Text>

      {/* Local Cloud Sync Banner */}
      <View style={styles.syncCard}>
        <View style={styles.syncLeft}>
          <Text style={styles.syncIcon}>💾</Text>
          <View>
            <Text style={styles.syncTitle}>Local Cloud Sync</Text>
            <Text style={styles.syncSub}>{syncPath}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.syncBtn} onPress={syncToLocal}>
          <Text style={styles.syncBtnText}>Sync</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{downloads.length} file(s)</Text>

      <FlatList
        data={downloads}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📥</Text>
            <Text style={styles.emptyText}>No downloads yet</Text>
            <Text style={styles.emptySubText}>Files downloaded while browsing appear here</Text>
          </View>
        }
        renderItem={({item}) => (
          <View style={styles.item}>
            <Text style={styles.itemIcon}>{fileIcon(item.filename)}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.filename}</Text>
              <Text style={styles.itemMeta}>{item.size} · {item.status}</Text>
              <Text style={styles.itemDate}>{new Date(item.savedAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity onPress={() => openFile(item)} style={styles.actionBtn}>
                <Text style={styles.actionText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d', padding: 16},
  title: {color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 12},
  syncCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  syncLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  syncIcon: {fontSize: 28},
  syncTitle: {color: '#fff', fontSize: 14, fontWeight: '600'},
  syncSub: {color: '#6b7280', fontSize: 11, marginTop: 2},
  syncBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncBtnText: {color: '#fff', fontWeight: '700', fontSize: 13},
  sectionLabel: {color: '#6b7280', fontSize: 12, marginBottom: 8},
  item: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  itemIcon: {fontSize: 28, marginRight: 12},
  itemInfo: {flex: 1},
  itemName: {color: '#fff', fontSize: 13, fontWeight: '600'},
  itemMeta: {color: '#9ca3af', fontSize: 11, marginTop: 2},
  itemDate: {color: '#6b7280', fontSize: 11},
  itemActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  actionBtn: {
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {color: '#fff', fontSize: 12},
  deleteBtn: {padding: 6},
  deleteText: {color: '#ef4444', fontSize: 16},
  empty: {alignItems: 'center', marginTop: 60},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {color: '#9ca3af', fontSize: 16, fontWeight: '600'},
  emptySubText: {color: '#6b7280', fontSize: 12, marginTop: 4},
});
