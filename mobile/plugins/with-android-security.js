const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withAndroidSecurity(config) {
  return withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application?.[0];
    if (application?.$) {
      application.$["android:allowBackup"] = "false";
      application.$["android:usesCleartextTraffic"] = "false";
    }
    return result;
  });
};
