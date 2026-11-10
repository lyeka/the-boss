import { defineConfig } from "mygo-cli";
import { version } from "./package.json";

const qa = process.env.THE_BOSS_QA === "1";

export default defineConfig({
  name: qa ? "我是大老板 QA" : "我是大老板",
  slug: "the-boss",
  identifier: qa ? "io.github.lyeka.theboss.qa" : "io.github.lyeka.theboss",
  version,
  devUrl: "http://127.0.0.1:5174",
  devCommand: "npm run dev -- --port 5174 --strictPort",
  buildCommand: "npm run build",
  frontendDist: "dist",
  bindings: "src/platform/mygo.ts",
  out: "build",
  icon: "resources/icon.png",
  resourcesExclude: ["*.py"],
  macos: {
    signingIdentity: "-",
    minimumSystemVersion: "13.3",
    infoPlist: { CFBundleDevelopmentRegion: "zh_CN", CFBundleLocalizations: ["zh_CN", "en"] },
  },
});
