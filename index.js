import {AppRegistry} from 'react-native';
import {enableScreens} from 'react-native-screens';
import App from './src/App';
import {name as appName} from './app.json';

// Required by react-native-screens for native screen containers
// Must be called before any navigation rendering
enableScreens();

AppRegistry.registerComponent(appName, () => App);
