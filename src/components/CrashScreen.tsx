import React from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet} from 'react-native';

interface Props {
  message: string;
  stack?: string;
  extra?: string;
  onContinue?: () => void;
}

export default function CrashScreen({message, stack, extra, onContinue}: Props) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>⚠️ App crashed (caught)</Text>
        <Text style={styles.subtitle}>
          Screenshot this whole screen and send it over — this is the real error that was closing the app.
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
      {onContinue && (
        <TouchableOpacity style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>Try to continue</Text>
        </TouchableOpacity>
      )}
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
  button: {backgroundColor: '#7c3aed', padding: 14, alignItems: 'center', margin: 16, borderRadius: 10},
  buttonText: {color: '#fff', fontWeight: '700'},
});
