import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, StyleSheet} from 'react-native';
import Library, {LibraryEntry} from '../services/Library';
import theme from '../theme';

interface Props {
  query: string;
  onSelect: (url: string) => void;
}

export default function AddressAutocomplete({query, onSelect}: Props) {
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '100%',
    left: 8,
    right: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 220,
    zIndex: 50,
    elevation: 8,
  },
  row: {paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border},
  title: {color: theme.colors.text, fontSize: 13, fontWeight: '600'},
  url: {color: theme.colors.textFaint, fontSize: 11, marginTop: 2},
});
