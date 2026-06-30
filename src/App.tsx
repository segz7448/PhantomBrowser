import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
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

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AppSettingsProvider>
        <ProxyProvider>
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: {
                  backgroundColor: '#0d0d0d',
                  borderTopColor: '#1a1a2e',
                },
                tabBarActiveTintColor: '#7c3aed',
                tabBarInactiveTintColor: '#555',
              }}>
              <Tab.Screen
                name="Browser"
                component={BrowserScreen}
                options={{tabBarLabel: 'Browse'}}
              />
              <Tab.Screen
                name="Proxy"
                component={ProxyScreen}
                options={{tabBarLabel: 'Proxy'}}
              />
              <Tab.Screen
                name="Passwords"
                component={PasswordScreen}
                options={{tabBarLabel: 'Vault'}}
              />
              <Tab.Screen
                name="Downloads"
                component={DownloadsScreen}
                options={{tabBarLabel: 'Files'}}
              />
              <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{tabBarLabel: 'Settings'}}
              />
            </Tab.Navigator>
          </NavigationContainer>
          <Toast />
        </ProxyProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
