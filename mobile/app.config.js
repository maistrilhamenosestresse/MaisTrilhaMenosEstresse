const variant = process.env.APP_VARIANT === "guide" ? "guide" : "participant";
const isGuide = variant === "guide";
const serviceId = "com.maistrilhasmenosestresse.mesh.v1";
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  "6b55e7d9-f68b-42b1-93ba-964e2c68f7b4";

module.exports = ({ config }) => ({
  ...config,
  owner: "maistrilhas-team",
  name: isGuide ? "Mais Trilha Guia" : "Mais Trilha",
  slug: "maistrilha",
  version: "1.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  scheme: isGuide ? "maistrilhaguia" : "maistrilha",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#071829",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: isGuide
      ? "com.maistrilhasmenosestresse.guia"
      : "com.maistrilhasmenosestresse.app",
    infoPlist: {
      NSBluetoothAlwaysUsageDescription: "Usamos Bluetooth para manter o grupo conectado mesmo sem internet.",
      NSCameraUsageDescription: "Usamos a câmera para ler o convite da operação e atualizar sua foto.",
      NSPhotoLibraryUsageDescription: "Usamos sua galeria somente quando você escolhe uma foto.",
      NSLocalNetworkUsageDescription: "Usamos a rede local para retransmitir localização e pedidos de ajuda.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "Sua localização mantém o guia informado durante a trilha.",
      NSLocationWhenInUseUsageDescription: "Sua localização aparece no mapa operacional da trilha.",
      UIBackgroundModes: ["location", "bluetooth-central", "bluetooth-peripheral"],
      MaisTrilhaNearbyServiceId: serviceId,
    },
  },
  android: {
    package: isGuide
      ? "com.maistrilhasmenosestresse.guia"
      : "com.maistrilhasmenosestresse.app",
    allowBackup: false,
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#071829",
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_ADVERTISE",
      "BLUETOOTH_CONNECT",
      "BLUETOOTH_SCAN",
      "NEARBY_WIFI_DEVICES",
      "CAMERA",
      "POST_NOTIFICATIONS",
      "READ_MEDIA_IMAGES",
    ],
    intentFilters: isGuide ? [] : [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "www.maistrilhasmenosestresse.com",
            pathPrefix: "/app",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Permita a localização para a segurança do grupo durante a trilha.",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#D96224",
        defaultChannel: "seguranca-trilha",
      },
    ],
    "expo-secure-store",
    "expo-sqlite",
    "@maplibre/maplibre-react-native",
    "./plugins/with-android-security",
    "./plugins/with-nearby-ios",
  ],
  extra: {
    appVariant: variant,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://www.maistrilhasmenosestresse.com",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    nearbyServiceId: serviceId,
    eas: {
      projectId: easProjectId,
    },
  },
});
