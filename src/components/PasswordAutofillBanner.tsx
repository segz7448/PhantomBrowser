import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import theme from '../theme';

interface Props {
  username: string;
  onFill: () => void;
  onDismiss: () => void;
}

export default function PasswordAutofillBanner({username, onFill, onDismiss}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔐</Text>
      <Text style={styles.text} numberOfLines={1}>
        Fill saved login for <Text style={styles.username}>{username}</Text>?
      </Text>
      <TouchableOpacity onPress={onFill} style={styles.fillBtn}>
        <Text style={styles.fillBtnText}>Fill</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
        <Text style={styles.dismissBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d1530',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.accentDim,
  },
  icon: {fontSize: 14, marginRight: 8},
  text: {color: theme.colors.text, fontSize: 12, flex: 1},
  username: {fontWeight: '700', color: theme.colors.accent},
  fillBtn: {backgroundColor: theme.colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, marginLeft: 8},
  fillBtnText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  dismissBtn: {paddingHorizontal: 8, paddingVertical: 5},
  dismissBtnText: {color: theme.colors.textDim, fontSize: 13},
});
