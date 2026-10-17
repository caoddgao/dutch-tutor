// android-spike only (batch 2): builds the temporary test page into dist/spike/, next to the real app,
// so one APK opens the test page first and can still switch to the real phone UI.
import { defineConfig } from "vite";

export default defineConfig({
  root: "android-spike",
  base: "./",
  clearScreen: false,
  build: { outDir: "../dist/spike", emptyOutDir: true, target: "es2022" },
});
