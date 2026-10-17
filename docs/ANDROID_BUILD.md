# 安卓 apk 打包说明（草稿）

> 第 2 批（2026-10-17，分支 `android-spike`）只记录**实际跑通**的步骤。正式签名、家庭版（带资料包和录音）打包留到第 4 批补全。
> 实测手机：小米 13 Ultra，HyperOS 3.0（Android 16）。

打包电脑要先装好 [FAMILY_BUILD.md](FAMILY_BUILD.md) 第一节里的工具（Git、Node.js、VS Build Tools、Rust），并且已经 `git clone` 了项目、运行过 `npm ci`。下面这些是安卓**另外**要装的。不用装 Android Studio，只装命令行工具就够了。

## 一、安装 JDK 17

本机用的是已经装好的 `C:\Program Files\Java\jdk-17`。在 PowerShell 里输入 `java -version`，能看到 `17.x` 就可以，跳过这一步。

（还没装的电脑：第 4 批再写经过实测的安装方法。）

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
   - NDK 必须用 r28 或更新的版本（这里用 r29）。这样打出来的程序库是 16KB 页对齐的，Android 15 及以后的手机要求这样。
   - 第一次打包时，Gradle 还会自己再下载 android-37 平台和 Gradle 9.6.1，不用手动装。

## 三、设置环境变量（只做一次）

在 PowerShell 里运行（会写进你的用户设置，以后一直有效）：

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-17', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('NDK_HOME', "$env:LOCALAPPDATA\Android\Sdk\ndk\29.0.14206865", 'User')
rustup target add aarch64-linux-android
```

运行完**关掉 PowerShell 再重新打开**，新设置才会生效。

## 四、打包

在项目文件夹里打开 PowerShell。

**第 2 批的实测 apk**（打开先进入临时测试页，再点按钮进入正式手机界面；会带上 350MB 假资料）：

```powershell
node scripts/make-spike-pack.mjs
npm run tauri android build -- --apk --target aarch64 --config src-tauri/tauri.android-spike.conf.json
```

**不带测试页的普通 apk**：

```powershell
npm run tauri android build -- --apk --target aarch64
```

打好的安装包在：

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

- 第一次打包要下载很多依赖，大约 5–10 分钟；以后每次 1–2 分钟。
- 这一批的安装包用**本机自动生成的调试签名**（`C:\Users\<你>\.android\debug.keystore`），只适合测试。第 4 批换成正式签名。换签名后要先卸载旧版才能安装。
- 输出里出现 `Could not close incremental caches`（Kotlin 缓存）的长串报错可以不管：原因是项目在 F 盘、缓存在 C 盘，编译会自动换一种方式继续，最后有 `Finished 1 APK` 就是成功了。
- `src-tauri/gen/android/app/src/main/assets/` 是打包时自动复制进去的资源，已设为 Git 忽略，绝不能提交。

## 五、装到手机（不用开 USB 调试）

1. 数据线连电脑，手机上选"传输文件"。
2. 在电脑上打开"此电脑 → 手机 → 内部存储设备 → Download"，把 apk 拖进去。
3. 手机"文件管理 → 下载"里点这个 apk。如果提示不允许安装未知来源应用，就按提示允许"文件管理"安装；风险提示选"继续安装"。如果 HyperOS 的"纯净模式"拦截了安装，就到"设置 → 隐私与安全"里把它关掉。
4. 同一个签名的新版可以直接覆盖安装，数据会保留。
