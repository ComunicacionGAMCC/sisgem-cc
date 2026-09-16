import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "bo.gob.gamcc.municipiodigital",
  appName: "Municipio Digital",
  webDir: "mobile-shell",
  backgroundColor: "#f5f8f1",
  loggingBehavior: "debug",
  appendUserAgent: " MunicipioDigitalGAMCC/1.0",
  server: {
    url: "https://sisgem-cc.vercel.app/",
    cleartext: false,
    errorPath: "offline.html",
  },
  android: {
    backgroundColor: "#f5f8f1",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
