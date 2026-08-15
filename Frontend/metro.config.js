const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// react-native-pager-view is native-only; shim it on web so the app can run in a browser
// for Playwright-driven UI audits. Phone/native builds keep the real module.
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === 'react-native-pager-view') {
      return {
        filePath: path.resolve(__dirname, 'web-shims', 'pager-view.js'),
        type: 'sourceFile',
      };
    }
    if (moduleName === 'react-native-maps') {
      return {
        filePath: path.resolve(__dirname, 'web-shims', 'maps.js'),
        type: 'sourceFile',
      };
    }
  }
  return defaultResolver
    ? defaultResolver(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
