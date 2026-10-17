# Windows 家庭版打包说明

家庭版把你电脑上的 Naar Nederland 资料包和儿子的真人录音一起放进安装包。家人安装后打开程序，就能直接使用这些内容。资料和录音只在本机打包，不上传 GitHub。

家庭版和普通版是同一个程序，可以互相覆盖安装；学习进度、复习记录、自己的跟读录音都会保留。安装前可在设置中导出一份学习数据备份。

## 一、第一次打包前，要安装什么

用 Windows 11 的 64 位电脑。以下工具只在**负责打包的电脑**上安装，家人收到安装包后不需要装这些工具。

1. [Git for Windows](https://git-scm.com/downloads/win)：安装时使用默认选项。
2. [Node.js](https://nodejs.org/en/download)：安装 22 版或更新的 LTS 版，使用默认选项（包含 npm）。
3. [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/)：在页面的“所有下载”中找到“用于 Visual Studio 2022 的工具”。打开安装器，勾选“使用 C++ 的桌面开发”，保留右侧默认选中的 MSVC 编译工具和 Windows SDK，然后安装。
4. [Rust](https://www.rust-lang.org/tools/install)：下载并运行 `rustup-init.exe`，选择默认安装。使用默认的 stable、Windows MSVC 64 位工具链。
5. Windows 11 通常自带 Microsoft Edge WebView2。若提示缺少它，安装 [WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) 的 x64 版本。

全部装完后，关闭并重新打开 PowerShell，让它识别新装的工具。第一次编译要联网下载依赖，耗时较长；之后会快一些。

## 二、取得程序代码

在你准备保存项目的文件夹空白处，右键选择“在终端中打开”，输入：

```powershell
git clone https://github.com/caoddgao/dutch-tutor.git
cd dutch-tutor
npm ci
```

仓库若要求登录，用有访问权限的 GitHub 账号登录。以后下面的命令都在这个 `dutch-tutor` 文件夹里运行。

如果 PowerShell 提示“禁止运行脚本”，把命令里的 `npm` 改为 `npm.cmd`，例如 `npm.cmd ci`。

## 三、放入资料包和录音

在 `dutch-tutor` 文件夹中，新建一个名为 `family` 的文件夹，按下面摆放：

```text
dutch-tutor/
  family/
    nn-pack/
      manifest.json
      index.json
      words.json
      lessons/
      audio/
      ……
    recordings/
      dutch-tutor-recordings.json
      ……真人录音文件（.webm、.mp3 等）
  package.json
  src-tauri/
  ……
```

- **资料包**：把整理好的整个 `nn-pack` 文件夹复制进 `family`。确认 `manifest.json` 就在 `family/nn-pack/` 中，不要多套一层 `nn-pack`，也不要放压缩包。
- **录音**：在 Dutch Tutor 的“设置 → 录音模式”里，使用“导出录音文件夹”。把导出文件夹中的**全部文件**复制到 `family/recordings/`，让 `dutch-tutor-recordings.json` 直接位于这一层。不要只复制音频，也不要复制程序内部的录音目录；程序内部还有你自己的跟读录音。
- 可以只带资料包，或只带真人录音；缺的那一项不用建子文件夹。至少放入一项再打家庭版。
- `family/` 已由 Git 忽略，不会随普通提交上传。不要使用强制添加命令把它加入仓库。家庭版安装包包含这些私人资料，只在家人之间传递。

打包前可以检查资料包：

```powershell
npm run validate -- --pack family/nn-pack
```

如果只带真人录音，跳过这条命令。

## 四、生成安装包

在项目文件夹的 PowerShell 中运行：

```powershell
npm run build:family
```

等待命令全部完成。它会编译程序、把 `family/` 中的文件装进安装包，再给安装包的文件名加上“家庭版”。

安装包在：

```text
src-tauri/target/release/bundle/nsis/
```

选择文件名含“家庭版”、以 `-setup.exe` 结尾的文件。这就是可以发给家人的完整安装包；不用另外发送 `family` 文件夹。双击它，按提示安装即可。安装包大小会随资料和录音增大。

普通版仍使用 `npm run tauri build`，不需要 `family/`；GitHub CI 和手动 Release 也只构建普通版，不读取你电脑上的私人文件。

## 五、家人打开后会发生什么

- 电脑上没有资料包时，第一次打开自动导入安装包自带的那份资料。
- 已有资料包时，只有自带资料的 `manifest.json` 中 `created_at` 时间更新，才自动替换；相同或更旧的不会覆盖。
- 自带真人录音有变化时，自动导入，并替换同一句已有的真人录音；没有收录的句子保留原录音。相同的一整份自带录音只成功导入一次，不会每次打开都覆盖你后来手动录的新声音。
- 自己的跟读录音、评分、学习数据不会被替换；录音文件夹中的“不自然”标记也不会自动导入。
- 第一次导入较大的资料包时，请等程序打开。若导入失败，程序仍会打开；可在设置页手动导入资料包，在“录音模式”中手动导入录音文件夹。下次打开时会再次尝试未成功的录音导入。

## 六、儿子又录了新声音，怎样重打

1. 在录音模式中录好并保存新声音。
2. 重新使用“导出录音文件夹”，导出到一个新的空文件夹。
3. 删除本机旧的 `family/recordings/` 文件夹，再把新导出文件夹的全部内容放进新的 `family/recordings/`。不要混放两次导出的清单。
4. 若资料包也更新了，替换 `family/nn-pack/`。整理资料包时应重新生成 `manifest.json` 的 `created_at`；不要为了重复打包而随意把旧资料的时间改新。资料包没变就不用动。
5. 如需同步最新程序代码，先运行以下命令；`family/` 会保留：

   ```powershell
   git switch main
   git pull --ff-only
   npm ci
   ```

6. 再运行 `npm run build:family`，把新生成的家庭版安装包发给家人，覆盖安装。只更新录音也可以重新打同一程序版本的家庭版，不需要发布 GitHub 新版本。

## 七、发布普通版 1.1.0（由用户决定何时做）

家庭版本地打包不需要运行 GitHub Actions。若要发布普通版，在 GitHub 仓库进入 **Actions → Release → Run workflow**，选择 `main`，版本号输入 `1.1.0`，再运行。不要加开头的 `v`。

只有手动运行这个工作流才会发布；合并代码不会发布。`x.y.0`（例如 `1.1.0`）是正式版，其余补丁版本（例如 `1.1.1`）标为测试版。已发布过的版本号不能重复使用。
