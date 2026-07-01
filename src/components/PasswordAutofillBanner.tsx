import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '../services/Theme';

interface Props {
  username: string;
  onFill: () => void;
  onDismiss: () => void;
}

export default function PasswordAutofillBanner({username, onFill, onDismiss}: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

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

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    icon: {fontSize: 14, marginRight: 8},
    text: {color: theme.text, fontSize: 12, flex: 1},
    username: {fontWeight: '700', color: theme.primary},
    fillBtn: {backgroundColor: theme.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, marginLeft: 8},
    fillBtnText: {color: theme.onPrimary, fontSize: 12, fontWeight: '700'},
    dismissBtn: {paddingHorizontal: 8, paddingVertical: 5},
    dismissBtnText: {color: theme.textMuted, fontSize: 13},
  });
