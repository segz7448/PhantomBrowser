import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, StyleSheet} from 'react-native';
import Library, {LibraryEntry} from '../services/Library';
import {useTheme, elevation} from '../services/Theme';

interface Props {
  query: string;
  onSelect: (url: string) => void;
}

export default function AddressAutocomplete({query, onSelect}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [matches, setMatches] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!query.trim()) {
        setMatches([]);
        return;
      }
      const [bookmarks, history] = await Promise.all([Library.getBookmarks(), Library.getHistory()]);
      const q = query.toLowerCase();
      const seen = new Set<string>();
      const combined = [...bookmarks, ...history].filter(entry => {
        if (seen.has(entry.url)) return false;
        const matchesQ = entry.url.toLowerCase().includes(q) || entry.title.toLowerCase().includes(q);
        if (matchesQ) seen.add(entry.url);
        return matchesQ;
      });
      if (!cancelled) setMatches(combined.slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (matches.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({item}) => (
          <TouchableOpacity style={styles.row} onPress={() => onSelect(item.url)}>
            <Text style={styles.title} numberOfLines={1}>{item.title || item.url}</Text>
            <Text style={styles.url} numberOfLines={1}>{item.url}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      maxHeight: 220,
      zIndex: 50,
      ...elevation(theme, 3),
    },
    row: {paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider},
    title: {color: theme.text, fontSize: 13, fontWeight: '600'},
    url: {color: theme.textMuted, fontSize: 11, marginTop: 2},
  });
