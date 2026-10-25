const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

// The book presets are source files outside the npm app workspaces.
config.watchFolders = Array.from(new Set([
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../../shared'),
]));

config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'wasm']));

module.exports = config;
