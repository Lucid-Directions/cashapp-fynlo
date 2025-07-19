/**
 * @format
 */

// Import console polyfill first to ensure console methods work
import './src/utils/consolePolyfill';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
