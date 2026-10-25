/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import {registerBackgroundHandlers} from './src/push';
import { name as appName } from './app.json';

registerBackgroundHandlers();
AppRegistry.registerComponent(appName, () => App);
