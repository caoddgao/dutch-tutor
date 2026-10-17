import { readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const dir = "src-tauri/target/release/bundle/nsis";
const installers = readdirSync(dir).filter((name) => name.endsWith("-setup.exe") && !name.includes("家庭版"));
if (!installers.length) throw new Error("没有找到刚生成的 Windows 安装包，请在 Windows 上运行 npm run build:family");
for (const name of installers) {
  const target = join(dir, name.replace(/-setup\.exe$/, "-家庭版-setup.exe"));
  renameSync(join(dir, name), target);
  console.log(`家庭版安装包：${target}`);
}
