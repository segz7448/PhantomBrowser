import React from 'react';
import {View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView, Alert, StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import Toast from 'react-native-toast-message';
import {useProxy} from '../services/ProxyContext';
import {useAppSettings} from '../services/AppSettings';
import {useTheme, elevation} from '../services/Theme';
import haptics from '../services/haptics';

export default function SettingsScreen() {
  const {disconnect} = useProxy();
  const settings = useAppSettings();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const clearData = () => {
    Alert.alert('Clear All Data', 'This will delete all passwords, downloads, and proxy config.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear Everything',
        style: 'destructive',
        onPress: async () => {
          try {
            haptics.warning();
            await disconnect();
            await AsyncStorage.clear();
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
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />
      <Text style={styles.title}>Settings</Text>

      <SectionHeader title="Appearance" theme={theme} />
      <View style={styles.themeRow}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>Theme</Text>
          <Text style={styles.rowSub}>Choose how Phantom Browser looks</Text>
        </View>
        <View style={styles.themeSwitch}>
          <TouchableOpacity
            style={[styles.themeOption, settings.theme === 'dark' && styles.themeOptionActive]}
            onPress={() => {
              haptics.light();
              settings.update('theme', 'dark');
            }}>
            <Text style={[styles.themeOptionText, settings.theme === 'dark' && styles.themeOptionTextActive]}>
              🌙 Dark
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.themeOption, settings.theme === 'light' && styles.themeOptionActive]}
            onPress={() => {
              haptics.light();
              settings.update('theme', 'light');
            }}>
            <Text style={[styles.themeOptionText, settings.theme === 'light' && styles.themeOptionTextActive]}>
              ☀️ Light
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionHeader title="Browsing" theme={theme} />
      <SettingRow
        theme={theme}
        label="Require Proxy"
        sub="Block browsing until a proxy is connected"
        value={settings.requireProxy}
        onChange={v => settings.update('requireProxy', v)}
      />
      <SettingRow
        theme={theme}
        label="Desktop Site by Default"
        sub="Request desktop pages on new tabs"
        value={settings.desktopSiteDefault}
        onChange={v => settings.update('desktopSiteDefault', v)}
      />

      <SectionHeader title="Privacy & Security" theme={theme} />
      <SettingRow
        theme={theme}
        label="Ad Blocker"
        sub="Block ads and trackers"
        value={settings.adBlock}
        onChange={v => settings.update('adBlock', v)}
      />
      <SettingRow
        theme={theme}
        label="Block WebRTC"
        sub="Prevent IP leak via WebRTC"
        value={settings.webrtcBlock}
        onChange={v => settings.update('webrtcBlock', v)}
      />
      <SettingRow
        theme={theme}
        label="DNS over Proxy"
        sub="SOCKS5H — no local DNS leak"
        value={settings.dnsOverProxy}
        onChange={v => settings.update('dnsOverProxy', v)}
      />
      <SettingRow
        theme={theme}
        label="Disable QUIC"
        sub="Force TCP, no protocol bypass"
        value={settings.quicDisabled}
        onChange={v => settings.update('quicDisabled', v)}
      />
      <SettingRow
        theme={theme}
        label="Incognito Mode"
        sub="No history or cookies saved by the WebView"
        value={settings.incognito}
        onChange={v => settings.update('incognito', v)}
      />

      <SectionHeader title="About" theme={theme} />
      <InfoRow theme={theme} label="App" value="Phantom Browser v1.0.0" />
      <InfoRow theme={theme} label="Proxy Layer" value="SOCKS5H (proxy-side DNS)" />
      <InfoRow theme={theme} label="Storage" value="Encrypted on-device" />
      <InfoRow theme={theme} label="Cloud" value="None — local only" />

      <SectionHeader title="Data" theme={theme} />
      <TouchableOpacity style={styles.dangerBtn} onPress={clearData}>
        <Text style={styles.dangerBtnText}>🗑 Clear All Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionHeader({title, theme}: {title: string; theme: ReturnType<typeof useTheme>}) {
  return <Text style={[sharedStyles.sectionHeader, {color: theme.primary}]}>{title}</Text>;
}

function SettingRow({
  theme,
  label,
  sub,
  value,
  onChange,
}: {
  theme: ReturnType<typeof useTheme>;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={v => {
          haptics.light();
          onChange(v);
        }}
        trackColor={{false: theme.border, true: theme.primary}}
        thumbColor="#fff"
      />
    </View>
  );
}

function InfoRow({theme, label, value}: {theme: ReturnType<typeof useTheme>; label: string; value: string}) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
});

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.background},
    content: {padding: 16, paddingBottom: 40},
    title: {color: theme.text, fontSize: 26, fontWeight: '800', marginTop: 8, marginBottom: 16, letterSpacing: -0.5},
    row: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      ...elevation(theme, 1),
    },
    themeRow: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginBottom: 4,
      ...elevation(theme, 1),
    },
    themeSwitch: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceElevated,
      borderRadius: 10,
      padding: 4,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    themeOption: {flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8},
    themeOptionActive: {backgroundColor: theme.primary},
    themeOptionText: {color: theme.textMuted, fontSize: 13, fontWeight: '600'},
    themeOptionTextActive: {color: theme.onPrimary},
    rowLeft: {flex: 1},
    rowLabel: {color: theme.text, fontSize: 14, fontWeight: '500'},
    rowSub: {color: theme.textMuted, fontSize: 11, marginTop: 2},
    infoValue: {color: theme.textSecondary, fontSize: 12},
    dangerBtn: {
      backgroundColor: theme.dangerSoft,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.danger,
      marginTop: 4,
    },
    dangerBtnText: {color: theme.danger, fontWeight: '700'},
  });
