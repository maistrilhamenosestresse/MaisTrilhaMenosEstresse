const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Adicionando suporte para arquivos .wasm (necessário para o expo-sqlite na Web)
config.resolver.assetExts.push("wasm");

if (process.env.EXPO_GO === "1") {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    "@maplibre/maplibre-react-native": path.resolve(__dirname, "src/mocks/maplibre.js"),
  };
}

module.exports = config;
