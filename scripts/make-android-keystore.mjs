// One-time: creates the Android release signing key outside the repo (docs/ANDROID_BUILD.md).
// Refuses to touch an existing key: a new key cannot update the app already on the phone.
// The password is random, written only to keystore.properties next to the key, never printed.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const properties = process.env.DUTCH_TUTOR_SIGNING ?? join(homedir(), "DutchTutorSigning", "keystore.properties");
const dir = dirname(properties);
const store = join(dir, "dutch-tutor-release.jks");
if (existsSync(properties) || existsSync(store)) {
  console.error(`签名文件已经存在，不会覆盖：${dir}`);
  console.error("换新签名后，手机上的旧版无法直接升级。如果确实要重新生成，请先和施工方确认。");
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
const password = randomBytes(24).toString("base64url");
const keytool = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", "keytool") : "keytool";
const result = spawnSync(
  keytool,
  [
    "-genkeypair",
    "-keystore",
    store,
    "-storetype",
    "PKCS12",
    "-alias",
    "dutch-tutor",
    "-keyalg",
    "RSA",
    "-keysize",
    "4096",
    "-validity",
    "20000",
    "-dname",
    "CN=Dutch Tutor, O=Family",
    "-storepass:env",
    "DT_KEYSTORE_PASSWORD",
    "-keypass:env",
    "DT_KEYSTORE_PASSWORD",
  ],
  { env: { ...process.env, DT_KEYSTORE_PASSWORD: password }, stdio: ["ignore", "ignore", "inherit"] },
);
if (result.status !== 0) {
  console.error("生成签名文件失败：请先按 ANDROID_BUILD.md 装好 JDK 17 并设置 JAVA_HOME。");
  process.exit(1);
}
writeFileSync(properties, `storeFile=dutch-tutor-release.jks\nkeyAlias=dutch-tutor\npassword=${password}\n`);
writeFileSync(
  join(dir, "说明.txt"),
  [
    "这是 Dutch Tutor 安卓版的签名文件，两个文件缺一不可：",
    "  dutch-tutor-release.jks  —— 签名文件",
    "  keystore.properties      —— 签名密码（用记事本能打开，password= 后面就是密码）",
    "",
    "丢了的后果：手机上已经装好的 Dutch Tutor 再也无法直接升级。只能卸载重装，",
    "卸载会删掉手机里的学习进度和自己的跟读录音。",
    "",
    "请把整个文件夹复制到至少两个地方（例如 U 盘 + 网盘），并把密码另外抄在纸上或存进密码管理器。",
    "不要发给别人，不要放进 dutch-tutor 项目文件夹。",
    "",
  ].join("\r\n"),
);
console.log(`已生成签名文件：${dir}`);
