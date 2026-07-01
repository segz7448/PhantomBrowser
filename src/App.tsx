import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import BrowserScreen from './screens/BrowserScreen';
import ProxyScreen from './screens/ProxyScreen';
import PasswordScreen from './screens/PasswordScreen';
import DownloadsScreen from './screens/DownloadsScreen';
import SettingsScreen from './screens/SettingsScreen';
import {ProxyProvider} from './services/ProxyContext';
import {AppSettingsProvider} from './services/AppSettings';
import {installJSCrashHandler, getPendingCrash, clearPendingCrash, buildGithubIssueUrl} from './services/CrashReporter';
import CrashReportModal from './components/CrashReportModal';

// Install JS crash handler as early as possible, before any component mounts
installJSCrashHandler();

const Tab = createBottomTabNavigator();

// ─── Tab bar icons (pure View-based, no icon font dependency) ─────────────────

function GlobeIcon({color, size}: {color: string; size: number}) {
  const s = size * 0.9;
  return (
    <View style={{width: s, height: s, borderRadius: s / 2, borderWidth: 1.8, borderColor: color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}}>
      <View style={{position: 'absolute', width: 1.8, height: s, backgroundColor: color}} />
      <View style={{position: 'absolute', width: s, height: 1.8, backgroundColor: color}} />
      <View style={{position: 'absolute', width: s * 0.55, height: s, borderRadius: s * 0.28, borderWidth: 1.8, borderColor: color, backgroundColor: 'transparent'}} />
    </View>
  );
}

function ShieldIcon({color, size}: {color: string; size: number}) {
  const s = size * 0.88;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{
        width: s * 0.82,
        height: s * 0.92,
        borderWidth: 1.8,
        borderColor: color,
        borderRadius: 3,
        borderBottomLeftRadius: s * 0.4,
        borderBottomRightRadius: s * 0.4,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <View style={{width: s * 0.3, height: s * 0.42, borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: color, transform: [{rotate: '-45deg'}], marginTop: -4}} />
      </View>
    </View>
  );
}

function KeyIcon({color, size}: {color: string; size: number}) {
  const s = size * 0.9;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{
        width: s * 0.46, height: s * 0.46,
        borderRadius: s * 0.23,
        borderWidth: 1.8,
        borderColor: color,
        position: 'absolute',
        left: 0, top: 0,
      }} />
      <View style={{
        position: 'absolute',
        right: 0, bottom: s * 0.1,
        width: s * 0.55, height: 1.8,
        backgroundColor: color,
        transform: [{rotate: '-40deg'}],
      }} />
      <View style={{position: 'absolute', right: s * 0.08, bottom: s * 0.22, width: 1.8, height: s * 0.15, backgroundColor: color}} />
      <View style={{position: 'absolute', right: s * 0.2, bottom: s * 0.1, width: 1.8, height: s * 0.15, backgroundColor: color}} />
    </View>
  );
}

function DownloadIcon({color, size}: {color: string; size: number}) {
  const s = size * 0.88;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center', gap: 2}}>
      <View style={{width: 1.8, height: s * 0.5, backgroundColor: color}} />
      <View style={{width: s * 0.55, height: 1.8, backgroundColor: color}} />
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: s * 0.28, borderRightWidth: s * 0.28,
        borderTopWidth: s * 0.28,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: color,
        marginTop: -s * 0.3,
      }} />
      <View style={{width: s * 0.7, height: 1.8, backgroundColor: color, marginTop: 2}} />
    </View>
  );
}

function GearIcon({color, size}: {color: string; size: number}) {
  const s = size * 0.88;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{
        width: s * 0.55, height: s * 0.55,
        borderRadius: s * 0.28,
        borderWidth: 1.8,
        borderColor: color,
      }} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            width: 3, height: s * 0.25,
            backgroundColor: color,
            borderRadius: 2,
            top: s * 0.5 - s * 0.48,
            left: s * 0.5 - 1.5,
            transformOrigin: `1.5px ${s * 0.48}px`,
            transform: [{translateY: 0}, {rotate: `${deg}deg`}],
          }}
        />
      ))}
    </View>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [crashUrl, setCrashUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const pending = await getPendingCrash();
      if (pending) setCrashUrl(buildGithubIssueUrl(pending));
    })();
  }, []);

  const dismissCrash = async () => {
    setCrashUrl(null);
    await clearPendingCrash();
  };

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <ProxyProvider>
            <NavigationContainer>
              <Tab.Navigator
                screenOptions={({route}) => ({
                  headerShown: false,
                  tabBarStyle: styles.tabBar,
                  tabBarActiveTintColor: '#1a73e8',
                  tabBarInactiveTintColor: '#5f6368',
                  tabBarLabelStyle: styles.tabLabel,
                  tabBarIcon: ({color, size}) => {
                    switch (route.name) {
                      case 'Browser': return <GlobeIcon color={color} size={size} />;
                      case 'Proxy':   return <ShieldIcon color={color} size={size} />;
                      case 'Vault':   return <KeyIcon color={color} size={size} />;
                      case 'Files':   return <DownloadIcon color={color} size={size} />;
                      case 'Settings': return <GearIcon color={color} size={size} />;
                      default: return null;
                    }
                  },
                })}>
                <Tab.Screen name="Browser"  component={BrowserScreen}  options={{tabBarLabel: 'Browse'}} />
                <Tab.Screen name="Proxy"    component={ProxyScreen}    options={{tabBarLabel: 'Proxy'}} />
                <Tab.Screen name="Vault"    component={PasswordScreen} options={{tabBarLabel: 'Vault'}} />
                <Tab.Screen name="Files"    component={DownloadsScreen} options={{tabBarLabel: 'Files'}} />
                <Tab.Screen name="Settings" component={SettingsScreen} options={{tabBarLabel: 'Settings'}} />
              </Tab.Navigator>
            </NavigationContainer>
            <Toast />
            <CrashReportModal
              visible={!!crashUrl}
              githubUrl={crashUrl ?? ''}
              onDismiss={dismissCrash}
            />
          </ProxyProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#f1f3f4',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dadce0',
    height: 58,
    paddingBottom: 6,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});
