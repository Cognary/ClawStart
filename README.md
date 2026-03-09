# ClawStart

ClawStart 是一个桌面启动器原型，目标是把 OpenClaw 的安装、排障和启动流程收敛成一个 GUI，并给第一次使用的人一条清晰的安装路径。

当前版本已经实现这些事情：

- 检测系统里的 `node`、`npm`、`openclaw` 和 `~/.openclaw/bin/openclaw`
- 根据当前平台给出推荐安装模式，并一键执行 OpenClaw 官方安装脚本
- 提供 OpenClaw CLI 的升级 / 重装入口，优先沿用当前检测到的安装方式
- 优先支持 macOS / Linux / WSL 的本地可移植安装模式
- 用步骤卡片引导用户完成“检测 -> 安装 -> 保存配置 -> 验证 -> 启动”
- 内嵌 `xterm` 终端，直接在应用里跑交互式 `openclaw onboard --install-daemon`
- 提供应用内调试 Shell，方便排查 PATH、权限和运行环境问题
- 把环境探针、失败日志和终端输出归类成“证书/TLS、权限、PATH、端口占用、网络超时”等诊断项
- 对高频问题提供直接修复动作，比如一键补 PATH、用 starter 模板重建配置、优先释放本应用占用的 Dashboard 端口
- 新增“更新中心”，支持检查、下载和安装 ClawStart 桌面应用更新
- 直接编辑并保存 `~/.openclaw/openclaw.json`
- 保存配置前做 JSON5 校验，并自动备份旧配置文件
- 自动创建配置里声明的 workspace 目录
- 运行 `openclaw doctor`、`openclaw status`、`openclaw dashboard`、`openclaw gateway`
- 在系统终端里打开交互式 onboarding 向导
- 在界面里实时显示命令日志

## 为什么默认推荐本地安装

根据 OpenClaw 官方安装文档：

- `install.sh` 是推荐安装器，但可能依赖系统级 Node/npm/PATH
- `install-cli.sh` 会把 OpenClaw 安装到 `~/.openclaw`，并生成 `~/.openclaw/bin/openclaw`

对启动器来说，第二种方式更容易检测、更不容易遇到 PATH 问题，也更适合“点一下就装”的体验，所以这个项目在 macOS / Linux / WSL 上默认把它视为推荐模式。

## 开发

```bash
npm install
npm run dev
```

## 打包

```bash
npm run dist
```

Windows 包：

```bash
npm run dist:win
```

只出 Windows 便携版：

```bash
npm run dist:win-portable
```

## GitHub Actions 打 Windows 包

仓库里已经带了 Windows 打包工作流：

- 工作流文件：[windows-package.yml](/Volumes/ziel/ClawStart/.github/workflows/windows-package.yml)
- 触发方式：
  - 手动 `workflow_dispatch`
  - 推送 `v*` tag

它会在 `windows-2022` runner 上执行：

```bash
npm ci
npm run dist:win
```

然后把 `release/` 下的 Windows 产物上传成 Actions artifact，适合在没有本地 Windows 构建机时直接出包测试。

## 配置 ClawStart 自更新

ClawStart 自身更新现在支持两种接法：

- 运行时环境变量
- `electron-builder` 打包产物里自带的 `app-update.yml`

如果两者都没有配置，界面会明确显示“未配置更新源”，不会崩溃。

### 运行时环境变量

Generic 源：

```bash
export CLAWSTART_UPDATE_PROVIDER=generic
export CLAWSTART_UPDATE_URL=https://downloads.example.com/clawstart/
export CLAWSTART_UPDATE_CHANNEL=latest
```

GitHub Releases：

```bash
export CLAWSTART_UPDATE_PROVIDER=github
export CLAWSTART_UPDATE_OWNER=your-org
export CLAWSTART_UPDATE_REPO=clawstart
export CLAWSTART_UPDATE_CHANNEL=latest
```

可选项：

- `CLAWSTART_UPDATE_HOST`：GitHub Enterprise 主机
- `CLAWSTART_UPDATE_PRIVATE=true`：私有仓库
- `CLAWSTART_UPDATE_TOKEN`：私有源访问令牌

### 开发态测试更新

开发态下，更新中心支持两种方式：

- 直接使用上面的环境变量
- 在项目根目录放一个 `dev-app-update.yml`

只要检测到这些配置，界面就会显示“开发态更新配置”，允许手动检查更新。

## 后续建议

这个版本已经从“命令启动板”推进到了“引导安装器 + 更新入口”，下一步适合做三件事：

1. 把自动修复继续往前推，比如提供更细的 PATH/权限网络检测和更稳妥的端口处理策略
2. 把配置编辑器继续往表单化推进，而不只是 raw JSON5 编辑器
3. 做真正的发布流水线，把 `latest.yml` / 安装包上传流程自动化，让自更新可以直接接上生产分发
