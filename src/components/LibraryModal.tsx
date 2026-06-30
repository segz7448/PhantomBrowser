import React, {useState, useEffect, useCallback} from 'react';
import {Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Alert} from 'react-native';
import Library, {LibraryEntry} from '../services/Library';
import {useTheme} from '../services/Theme';
import Favicon from './Favicon';
import haptics from '../services/haptics';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onOpenUrl: (url: string) => void;
}

type Tab = 'bookmarks' | 'history';

export default function LibraryModal({visible, onDismiss, onOpenUrl}: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('bookmarks');
  const [bookmarks, setBookmarks] = useState<LibraryEntry[]>([]);
  const [history, setHistory] = useState<LibraryEntry[]>([]);

  const refresh = useCallback(async () => {
    const [b, h] = await Promise.all([Library.getBookmarks(), Library.getHistory()]);
    setBookmarks(b);
    setHistory(h);
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const data = tab === 'bookmarks' ? bookmarks : history;

  const handleRemove = async (item: LibraryEntry) => {
    haptics.light();
    if (tab === 'bookmarks') {
      await Library.removeBookmark(item.id);
    } else {
      await Library.removeHistoryEntry(item.id);
    }
    refresh();
  };

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'This will remove all browsing history.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          haptics.warning();
          await Library.clearHistory();
          refresh();
        },
      },
    ]);
  };

  const styles = makeStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Library</Text>
          <TouchableOpacity onPress={onDismiss}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'bookmarks' && styles.segmentActive]}
            onPress={() => setTab('bookmarks')}>
            <Text style={[styles.segmentText, tab === 'bookmarks' && styles.segmentTextActive]}>Bookmarks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'history' && styles.segmentActive]}
            onPress={() => setTab('history')}>
            <Text style={[styles.segmentText, tab === 'history' && styles.segmentTextActive]}>History</Text>
          </TouchableOpacity>
        </View>

        {tab === 'history' && history.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory}>
            <Text style={styles.clearBtnText}>Clear All History</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{tab === 'bookmarks' ? 'No bookmarks yet' : 'No history yet'}</Text>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onOpenUrl(item.url);
                onDismiss();
              }}>
              <Favicon url={item.url} size={28} rounded={8} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowUrl} numberOfLines={1}>
                  {item.url}
                </Text>
              </View>
              <TouchableOpacity hitSlop={{top: 10, bottom: 10, left: 10, right: 10}} onPress={() => handleRemove(item)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.background, paddingTop: 48},
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    headerTitle: {color: theme.text, fontSize: 18, fontWeight: '700'},
    doneText: {color: theme.primary, fontSize: 15, fontWeight: '700'},
    segment: {
      flexDirection: 'row',
      marginHorizontal: 16,
      backgroundColor: theme.surfaceElevated,
      borderRadius: 10,
      padding: 4,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentBtn: {flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8},
    segmentActive: {backgroundColor: theme.primary},
    segmentText: {color: theme.textMuted, fontSize: 13, fontWeight: '600'},
    segmentTextActive: {color: theme.onPrimary},
    clearBtn: {marginHorizontal: 16, marginBottom: 4, alignSelf: 'flex-end'},
    clearBtnText: {color: theme.danger, fontSize: 12, fontWeight: '600'},
    list: {paddingHorizontal: 16, paddingBottom: 24},
    empty: {color: theme.textMuted, textAlign: 'center', marginTop: 40, fontSize: 13},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      gap: 10,
    },
    rowText: {flex: 1},
    rowTitle: {color: theme.text, fontSize: 13, fontWeight: '600'},
    rowUrl: {color: theme.textMuted, fontSize: 11, marginTop: 2},
    removeBtn: {color: theme.textMuted, fontSize: 14, paddingHorizontal: 4},
  });
