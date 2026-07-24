const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Bun's Windows watcher cannot attach to paths at the legacy MAX_PATH boundary.
// These packaged native build artifacts are not JavaScript bundle inputs.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /node_modules[\\/]expo-image-manipulator[\\/]prebuilds(?:[\\/]|$)/,
];

module.exports = config;
