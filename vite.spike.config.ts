// android-spike only (batch 2): builds the temporary test page in android-spike/ to dist-spike/.
import { defineConfig } from "vite";

export default defineConfig({
  root: "android-spike",
  clearScreen: false,
  build: { outDir: "../dist-spike", emptyOutDir: true, target: "es2022" },
});
