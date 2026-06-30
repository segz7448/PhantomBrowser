import React from 'react';
import {Modal, View, Text, TouchableOpacity, StyleSheet, Linking} from 'react-native';

interface Props {
  visible: boolean;
  githubUrl: string;
  onDismiss: () => void;
}

export default function CrashReportModal({visible, githubUrl, onDismiss}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Phantom Browser crashed last time</Text>
          <Text style={styles.body}>
            A crash report was captured on your device. Reviewing and submitting it on GitHub
            helps get it fixed — nothing is sent automatically.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              Linking.openURL(githubUrl);
              onDismiss();
            }}>
            <Text style={styles.primaryBtnText}>Review & Submit on GitHub</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onDismiss}>
            <Text style={styles.secondaryBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24},
  card: {
    backgroundColor: '#16161f',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    alignItems: 'center',
  },
  icon: {fontSize: 40, marginBottom: 12},
  title: {color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center'},
  body: {color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20},
  primaryBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryBtnText: {color: '#fff', fontWeight: '700', fontSize: 14},
  secondaryBtn: {paddingVertical: 10},
  secondaryBtnText: {color: '#6b7280', fontSize: 13},
});
