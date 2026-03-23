const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // expo-router가 로컬 node_modules에만 있어서 babel-preset-expo가 자동으로
    // expoRouterBabelPlugin을 추가하지 못함 (hasModule 체크 실패). 직접 추가.
    plugins: [expoRouterBabelPlugin],
  };
};
