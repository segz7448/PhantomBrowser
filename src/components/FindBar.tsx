import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, Text, StyleSheet} from 'react-native';

interface Props {
  onFind: (text: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  matchCount?: number;
  activeMatch?: number;
}

export default function FindBar({onFind, onNext, onPrev, onClose, matchCount, activeMatch}: Props) {
  const [text, setText] = useState('');

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Find in page"
        placeholderTextColor="#666"
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
        <Text style={styles.count}>
          {matchCount > 0 ? `${(activeMatch ?? 0) + 1}/${matchCount}` : '0/0'}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
  },
  count: {color: '#888', fontSize: 12, marginHorizontal: 6, minWidth: 36, textAlign: 'center'},
  btn: {paddingHorizontal: 8, paddingVertical: 4},
  btnText: {color: '#aaa', fontSize: 20},
  closeText: {color: '#aaa', fontSize: 15},
});
