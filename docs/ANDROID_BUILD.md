# 安卓家庭版 apk 打包说明

家庭版 apk 把你电脑上的 Naar Nederland 资料包和儿子的真人录音一起装进手机安装包，手机上打开就能用。资料、录音和签名文件都只在本机，不上传 GitHub，也不用 GitHub Actions。

- 实测手机：小米 13 Ultra，HyperOS 3.0（Android 16）。只出 64 位 arm（aarch64）安装包，近几年的安卓手机都是这种。
- 手机版和电脑版的学习进度各自独立，不同步。
- Azure 发音评分的密钥不在安装包里，在手机"更多 → 设置"里自己粘贴。

打包电脑要先装好 [FAMILY_BUILD.md](FAMILY_BUILD.md) 第一、二节里的工具（Git、Node.js、VS Build Tools、Rust），并且已经取得程序代码、运行过 `npm ci`。下面是安卓**另外**要做的。不用装 Android Studio。

## 一、安装 JDK 17

1. 打开 Oracle 的 [Java 下载页](https://www.oracle.com/java/technologies/downloads/#java17)，选 "Java 17" → "Windows" → "x64 Installer"，下载并双击安装，全部用默认选项。
2. 装好后应该有文件夹 `C:\Program Files\Java\jdk-17`。在 PowerShell 里输入 `& "C:\Program Files\Java\jdk-17\bin\java.exe" -version`，能看到 `17.x` 就对了。

## 二、安装安卓命令行工具、SDK 和 NDK

1. 下载 Google 官方的 Windows 版命令行工具：
   `https://dl.google.com/android/repository/commandlinetools-win-16111833_latest.zip`（约 150MB）。
2. 新建文件夹 `C:\Users\<你的用户名>\AppData\Local\Android\Sdk\cmdline-tools\`，把压缩包解压进去，然后把解压出来的 `cmdline-tools` 文件夹**改名为 `latest`**。改完后，下面这个文件应该存在：
   `…\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`
3. 打开 PowerShell，逐条运行下面的命令。第一次会让你阅读《Android SDK 许可协议》，输入 `y` 回车表示同意：

   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
   $sdk = "$env:LOCALAPPDATA\Android\Sdk"
   & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="$sdk" --licenses
   Set-Content -Encoding ascii "$sdk\packages.txt" "platform-tools`nplatforms;android-36`nbuild-tools;36.0.0`nndk;29.0.14206865"
   & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="$sdk" --package_file="$sdk\packages.txt"
   Remove-Item "$sdk\packages.txt"
   ```

   - 软件包清单要写进 `packages.txt` 再交给 sdkmanager，不能直接写在命令里：包名里的分号会被 Windows 当成分隔符拆开。
   - 下载约 2GB，要等一会儿。出现 "deprecated" 一类的英文提示可以不管。
   - NDK 必须用 r28 或更新的版本（这里用 r29），Android 15 及以后的手机要求这样。
   - 第一次打包时，Gradle 还会自己再下载 android-37 平台和 Gradle，不用手动装。

## 三、设置环境变量（只做一次）

在 PowerShell 里运行（会写进你的用户设置，以后一直有效）：

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-17', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('NDK_HOME', "$env:LOCALAPPDATA\Android\Sdk\ndk\29.0.14206865", 'User')
rustup target add aarch64-linux-android
```

运行完**关掉 PowerShell 再重新打开**，新设置才会生效。

## 四、放入资料包和录音

和电脑家庭版用同一个 `family` 文件夹，摆法见 [FAMILY_BUILD.md](FAMILY_BUILD.md) 第三节：

```text
dutch-tutor/
  family/
    nn-pack/          ← 资料包，manifest.json 直接在这一层
    recordings/       ← 录音模式"导出录音"导出的全部文件，dutch-tutor-recordings.json 直接在这一层
```

放好后先检查资料包（只带录音就跳过）：

```powershell
npm run validate -- --pack family/nn-pack
```

`family/` 已由 Git 忽略，绝不提交。儿子的录音还没录时，只放 `nn-pack/` 就行；录完后按第八节加进去重新打包。

## 五、签名文件（只做一次，做完一定要备份）

安卓要求安装包带签名。**以后每个新版本都必须用同一个签名文件打包**，手机才肯直接覆盖升级、保留学习进度。

### 生成

在项目文件夹里运行：

```powershell
npm run android:keystore
```

它会在 `C:\Users\<你的用户名>\DutchTutorSigning\` 里生成三个文件：

| 文件 | 是什么 |
|---|---|
| `dutch-tutor-release.jks` | 签名文件 |
| `keystore.properties` | 签名密码（随机生成；用记事本打开，`password=` 后面就是） |
| `说明.txt` | 提醒自己这是什么 |

- 这个文件夹在项目外面，不会被提交。打包时会自动去这里找；文件夹换了位置，就把环境变量 `DUTCH_TUTOR_SIGNING` 设为新位置里 `keystore.properties` 的完整路径。
- 已经有签名文件时，这条命令会拒绝运行，不会覆盖。**不要**自己删掉重新生成。

### 备份（至少两个地方）

1. 打开"此电脑 → 本地磁盘 C: → 用户 → 你的用户名"，找到 `DutchTutorSigning` 文件夹。
2. 把**整个文件夹**复制到 U 盘（或移动硬盘）。
3. 再把整个文件夹复制到网盘（OneDrive、百度网盘等），或者另一台电脑。
4. 用记事本打开 `keystore.properties`，把 `password=` 后面那串密码另外抄在纸上，或存进密码管理器。
5. 确认两处备份里都能看到 `dutch-tutor-release.jks` 和 `keystore.properties` 两个文件。

**丢了的后果**：手机上已经装好的 Dutch Tutor 再也无法直接升级。只能卸载后用新签名重装，而卸载会删掉手机里的学习进度、复习记录和自己的跟读录音。

**换电脑打包时**：把备份的整个 `DutchTutorSigning` 文件夹复制到新电脑的 `C:\Users\<你的用户名>\` 下即可。

签名文件和密码不要发给别人，不要放进 `dutch-tutor` 项目文件夹，不要贴到聊天或 GitHub 上。

## 六、打包

在项目文件夹里打开 PowerShell，运行：

```powershell
npm run build:family:android
```

它会：生成资料 / 录音文件清单 → 编译手机程序 → 把 `family/` 装进安装包 → 用你的签名文件签名 → 检查签名。最后一行显示：

```text
家庭版 apk：…\dutch-tutor\release-apk\Dutch Tutor_1.1.0_家庭版_10417120.apk
```

- 文件名里 `1.1.0` 是程序版本（和电脑版一样，来自 `src-tauri/tauri.conf.json`）；最后那串数字是 **versionCode**。
- **versionCode 规则**：10000000 + 从 2026-01-01（UTC）起到打包时的分钟数。每次打包都自动变大，不用手动改，也没有计数文件会丢；手机只接受比已装版本更大的 versionCode，所以新打的包总能覆盖旧的。前提是电脑时间准确。
- `release-apk/` 已由 Git 忽略。第一次打包要下载很多依赖，大约 10 分钟；以后每次几分钟。
- 输出里出现 `Could not close incremental caches`（Kotlin 缓存）的长串报错可以不管：项目在 F 盘、缓存在 C 盘时会这样，编译会自动换一种方式继续。
- 普通（不带资料）的手机包仍可用 `npm run tauri android build -- --apk --target aarch64`，但它不会自动带上家庭版的文件清单，只适合测试。

## 七、装到手机（不用开 USB 调试）

1. 数据线连电脑，手机上选"传输文件"。
2. 在电脑上打开"此电脑 → 手机 → 内部存储设备 → Download"，把 apk 拖进去。
3. 手机"文件管理 → 下载"里点这个 apk。如果提示不允许安装未知来源应用，就按提示允许"文件管理"安装；风险提示选"继续安装"。如果 HyperOS 的"纯净模式"拦截了安装，就到"设置 → 隐私与安全"里把它关掉。
4. 第一次打开会先把资料包和录音从安装包里复制出来，要等几秒。
5. 第一次进发音练习录音时，手机会问是否允许使用麦克风，选"仅在使用中允许"。

**覆盖升级**：同一个签名打的新包直接点开安装即可，学习进度、复习记录、自己的跟读录音都保留。资料包只有更新了（`manifest.json` 的 `created_at` 更新）才会重新复制；同一份录音只导入一次，不会覆盖你后来自己录的声音。

**如果提示"与已安装应用签名不一致"**：说明手机上装的是用别的签名打的包（例如第 2 批的测试包）。只能先卸载旧的再装——卸载会清空手机里的学习进度。正式签名以后就不会再遇到。

## 八、更新录音或资料包后重新打包

1. 在电脑版的录音模式里录好新声音，重新"导出录音"到一个新的空文件夹。
2. 删除 `family/recordings/`，把新导出文件夹的全部内容放进新的 `family/recordings/`。
3. 资料包更新了就替换 `family/nn-pack/`（要重新生成 `manifest.json` 的 `created_at`），没变就不用动。
4. 如需同步最新程序代码，先运行 `git pull` 和 `npm ci`（`family/` 会保留）。
5. 运行 `npm run build:family:android`，把 `release-apk/` 里最新的 apk 按第七节装到手机上覆盖安装。不需要发布 GitHub 新版本。

## 九、手机上占多少空间

安装包本身和复制出来的资料各占一份。2026-10-17 实测（只带资料包，约 420MB）：应用 469MB + 数据 441MB，合计约 0.91GB；第一次打开也是秒开。
