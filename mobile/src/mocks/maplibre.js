const React = require("react");
const { View } = require("react-native");

// MapLibreMap Component
function Map(props) {
  return React.createElement(View, { style: props.style }, props.children);
}

// Camera Component
function Camera() {
  return null;
}

// UserLocation Component
function NativeUserLocation() {
  return null;
}

// GeoJSONSource Component
function GeoJSONSource(props) {
  return React.createElement(React.Fragment, null, props.children);
}

// Layer Component
function Layer() {
  return null;
}

// OfflineManager
const OfflineManager = {
  createPack: async (options, progressCallback, errorCallback) => {
    // Mock the download taking a few seconds
    if (progressCallback) {
      setTimeout(() => progressCallback(undefined, { percentage: 50 }), 1000);
      setTimeout(() => progressCallback(undefined, { percentage: 100 }), 2000);
    }
    return { id: "mock-pack-" + Date.now() };
  }
};

module.exports = {
  Map,
  Camera,
  NativeUserLocation,
  GeoJSONSource,
  Layer,
  OfflineManager
};
