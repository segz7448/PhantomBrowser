import React from 'react';
import {NavigationContainer, DefaultTheme, DarkTheme} from '@react-navigation/native';
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
import {useTheme} from './services/Theme';
import {installGlobalErrorHandler} from './services/crashCapture';
import GlobalCrashOverlay from './GlobalCrashOverlay';
import ErrorBoundary from './ErrorBoundary';

installGlobalErrorHandler();

const Tab = createBottomTabNavigator();

function AppNavigator() {
  const theme = useTheme();
  const navTheme = {
    ...(theme.mode === 'light' ? DefaultTheme : DarkTheme),
    colors: {
      ...(theme.mode === 'light' ? DefaultTheme.colors : DarkTheme.colors),
      background: theme.background,
      card: theme.navBackground,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.navBackground,
            borderTopColor: theme.border,
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textMuted,
        }}>
        <Tab.Screen name="Browser" component={BrowserScreen} options={{tabBarLabel: 'Browse'}} />
        <Tab.Screen name="Proxy" component={ProxyScreen} options={{tabBarLabel: 'Proxy'}} />
        <Tab.Screen name="Passwords" component={PasswordScreen} options={{tabBarLabel: 'Vault'}} />
        <Tab.Screen name="Downloads" component={DownloadsScreen} options={{tabBarLabel: 'Files'}} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{tabBarLabel: 'Settings'}} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GlobalCrashOverlay>
        <GestureHandlerRootView style={{flex: 1}}>
          <SafeAreaProvider>
            <AppSettingsProvider>
              <ProxyProvider>
                <AppNavigator />
                <Toast />
              </ProxyProvider>
            </AppSettingsProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </GlobalCrashOverlay>
    </ErrorBoundary>
  );
}
