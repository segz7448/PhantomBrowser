import React from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking} from 'react-native';

interface Props {
  message: string;
  stack?: string;
  extra?: string;
  onContinue?: () => void;
  githubUrl?: string;
}

export default function CrashScreen({message, stack, extra, onContinue, githubUrl}: Props) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>⚠️ App crashed (caught)</Text>
        <Text style={styles.subtitle}>
          The error below didn't close the app, but it's worth getting fixed. Nothing is sent
          automatically — review the details and submit to GitHub yourself if you'd like it tracked.
        </Text>

        <Text style={styles.label}>Message</Text>
        <Text selectable style={styles.code}>
          {message}
        </Text>

        {stack ? (
          <>
            <Text style={styles.label}>Stack</Text>
            <Text selectable style={styles.code}>
              {stack}
            </Text>
          </>
        ) : null}

        {extra ? (
          <>
            <Text style={styles.label}>Component stack</Text>
            <Text selectable style={styles.code}>
              {extra}
            </Text>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {githubUrl && (
          <TouchableOpacity style={styles.reportButton} onPress={() => Linking.openURL(githubUrl)}>
            <Text style={styles.reportButtonText}>Review & Report on GitHub</Text>
          </TouchableOpacity>
        )}
        {onContinue && (
          <TouchableOpacity style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>Try to continue</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d', paddingTop: 48},
  scroll: {padding: 16, paddingBottom: 24},
  title: {color: '#ef4444', fontSize: 18, fontWeight: '700', marginBottom: 8},
  subtitle: {color: '#aaa', fontSize: 12, marginBottom: 16, lineHeight: 18},
  label: {color: '#7c3aed', fontSize: 11, fontWeight: '700', marginTop: 16, marginBottom: 4, textTransform: 'uppercase'},
  code: {color: '#e5e5e5', fontSize: 11, fontFamily: 'monospace'},
  actions: {paddingHorizontal: 16, paddingBottom: 16},
  reportButton: {backgroundColor: '#1f2937', padding: 14, alignItems: 'center', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#7c3aed'},
  reportButtonText: {color: '#a78bfa', fontWeight: '700'},
  button: {backgroundColor: '#7c3aed', padding: 14, alignItems: 'center', borderRadius: 10},
  buttonText: {color: '#fff', fontWeight: '700'},
});
