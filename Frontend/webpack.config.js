const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['@react-native-async-storage/async-storage'],
      },
    },
    argv
  );

  // Fix for React Native Web
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native$': 'react-native-web',
  };

  // Output to dist folder
  config.output.path = path.join(__dirname, 'dist');

  return config;
};