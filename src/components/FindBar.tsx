import React, {useState, useEffect, useRef} from 'react';
import {View, TextInput, TouchableOpacity, Text, StyleSheet, Animated} from 'react-native';
import {useTheme} from '../services/Theme';

interface Props {
  onFind: (text: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  matchCount?: number;
  activeMatch?: number;
}

export default function FindBar({onFind, onNext, onPrev, onClose, matchCount, activeMatch}: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const slide = useRef(new Animated.Value(-40)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, {toValue: 0, useNativeDriver: true, damping: 16, stiffness: 200}),
      Animated.timing(fade, {toValue: 1, duration: 180, useNativeDriver: true}),
    ]).start();
  }, [slide, fade]);

  const styles = makeStyles(theme);

  return (
    <Animated.View style={[styles.container, {opacity: fade, transform: [{translateY: slide}]}]}>
      <TextInput
        style={styles.input}
        placeholder="Find in page"
        placeholderTextColor={theme.textMuted}
        value={text}
        autoFocus
        onChangeText={t => {
          setText(t);
          onFind(t);
        }}
        returnKeyType="search"
        onSubmitEditing={onNext}
      />
      {typeof matchCount === 'number' && (
        <Text style={styles.count}>{matchCount > 0 ? `${(activeMatch ?? 0) + 1}/${matchCount}` : '0/0'}</Text>
      )}
      <TouchableOpacity onPress={onPrev} style={styles.btn}>
        <Text style={styles.btnText}>‹</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} style={styles.btn}>
        <Text style={styles.btnText}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={styles.btn}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceElevated,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    input: {
      flex: 1,
      backgroundColor: theme.surface,
      color: theme.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: 13,
      borderWidth: 1,
      borderColor: theme.border,
    },
    count: {color: theme.textMuted, fontSize: 12, marginHorizontal: 6, minWidth: 36, textAlign: 'center'},
    btn: {paddingHorizontal: 8, paddingVertical: 4},
    btnText: {color: theme.textSecondary, fontSize: 20},
    closeText: {color: theme.textSecondary, fontSize: 15},
  });
