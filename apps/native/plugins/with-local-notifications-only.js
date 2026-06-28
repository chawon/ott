const fs = require("fs");
const path = require("path");
const { withFinalizedMod } = require("expo/config-plugins");

const EMPTY_ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
`;

const withLocalNotificationsOnly = (config) =>
  withFinalizedMod(config, [
    "ios",
    async (config) => {
      const projectName = config.modRequest.projectName;
      const iosRoot = config.modRequest.platformProjectRoot;

      if (!projectName) return config;

      const projectFile = path.join(iosRoot, `${projectName}.xcodeproj`, "project.pbxproj");
      if (fs.existsSync(projectFile)) {
        const contents = fs.readFileSync(projectFile, "utf8");
        const nextContents = contents.replace(/^\s*CODE_SIGN_ENTITLEMENTS = [^;\n]+;\n/gm, "");
        if (nextContents !== contents) {
          fs.writeFileSync(projectFile, nextContents);
        }
      }

      const entitlementsFile = path.join(iosRoot, projectName, `${projectName}.entitlements`);
      if (fs.existsSync(entitlementsFile)) {
        fs.writeFileSync(entitlementsFile, EMPTY_ENTITLEMENTS);
      }

      return config;
    },
  ]);

module.exports = withLocalNotificationsOnly;
