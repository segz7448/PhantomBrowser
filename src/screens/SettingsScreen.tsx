import React, {useState} from 'react';
import {View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import Toast from 'react-native-toast-message';
import {useProxy} from '../services/ProxyContext';

export default function SettingsScreen() {
  const {disconnect} = useProxy();
  const [adBlock, setAdBlock] = useState(true);
  const [webrtcBlock, setWebrtcBlock] = useState(true);
  const [dnsOverProxy, setDnsOverProxy] = useState(true);
  const [incognito, setIncognito] = useState(true);
  const [quicDisabled, setQuicDisabled] = useState(true);

  const clearData = () => {
    Alert.alert('Clear All Data', 'This will delete all passwords, downloads, and proxy config.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear Everything',
        style: 'destructive',
        onPress: async () => {
          try {
            await disconnect();
            await AsyncStorage.clear();
            // FIX: EncryptedStorage.clear() does not exist in react-native-encrypted-storage.
            // The correct method is removeItem per key, or we use a known key to clear vault data.
            // We clear the known password storage key explicitly.
            await EncryptedStorage.removeItem('phantom_passwords');
            Toast.show({type: 'success', text1: 'All data cleared'});
          } catch (e: any) {
            Toast.show({type: 'error', text1: 'Clear failed', text2: e?.message});
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <SectionHeader title="Privacy & Security" />
      <SettingRow label="Ad Blocker" sub="Block ads and trackers" value={adBlock} onChange={setAdBlock} />
      <SettingRow label="Block WebRTC" sub="Prevent IP leak via WebRTC" value={webrtcBlock} onChange={setWebrtcBlock} />
      <SettingRow label="DNS over Proxy" sub="SOCKS5H — no local DNS leak" value={dnsOverProxy} onChange={setDnsOverProxy} />
      <SettingRow label="Disable QUIC" sub="Force TCP, no protocol bypass" value={quicDisabled} onChange={setQuicDisabled} />
      <SettingRow label="Incognito Mode" sub="No history or cookies saved" value={incognito} onChange={setIncognito} />

      <SectionHeader title="About" />
      <InfoRow label="App" value="Phantom Browser v1.0.0" />
      <InfoRow label="Proxy Layer" value="SOCKS5H (proxy-side DNS)" />
      <InfoRow label="Storage" value="Encrypted on-device" />
      <InfoRow label="Cloud" value="None — local only" />

      <SectionHeader title="Data" />
      <TouchableOpacity style={styles.dangerBtn} onPress={clearData}>
        <Text style={styles.dangerBtnText}>🗑 Clear All Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionHeader({title}: {title: string}) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{false: '#374151', true: '#7c3aed'}}
        thumbColor="#fff"
      />
    </View>
  );
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0d0d0d'},
  content: {padding: 16, paddingBottom: 40},
  title: {color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 16},
  sectionHeader: {
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  rowLeft: {flex: 1},
  rowLabel: {color: '#fff', fontSize: 14, fontWeight: '500'},
  rowSub: {color: '#6b7280', fontSize: 11, marginTop: 2},
  infoValue: {color: '#9ca3af', fontSize: 12},
  dangerBtn: {
    backgroundColor: '#1f0a0a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    marginTop: 4,
  },
  dangerBtnText: {color: '#ef4444', fontWeight: '700'},
});
