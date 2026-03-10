# ClawStart 产品与架构执行文档

## 1. 目的

本文件定义 `ClawStart` 的最终产品形态、信息架构、技术架构、跨平台策略和重构执行顺序。

从本文件开始：

- 安装向导和控制台被视为两个独立产品态
- 环境前置条件、安装结果、配置状态必须分层
- 任何后续重构都以本文件为准，不再继续零散修补

---

## 2. 产品定义

`ClawStart` 不是命令按钮集合，也不是 OpenClaw 文档浏览器。

`ClawStart` 是一个跨平台桌面启动器，承担两件事：

1. 首次安装 OpenClaw
2. 安装完成后的控制台与维护入口

因此它必须只有两个顶层工作态：

1. `Setup Wizard`
2. `Control Console`

禁止继续出现“安装中像控制台、安装完还像向导”的混合状态。

---

## 3. 顶层工作态

### 3.1 Setup Wizard

目标：让一台新机器从 `未安装` 变成 `可用`

特征：

- 单线流程
- 一步只做一件事
- 当前步骤必须有唯一主操作
- 过程反馈必须明确
- 失败必须绑定到当前步骤

这不是控制台，不应该提前展示日志中心、维护工具、复杂配置总表。

### 3.2 Control Console

目标：让用户在安装完成后长期使用和维护 OpenClaw

特征：

- 左侧导航
- 顶部服务状态条
- 右侧单主面板
- 支持模型、Skills、渠道、日志、配置、服务管理

这不是向导，不应继续展示步骤和安装进度。

---

## 4. 安装向导的正式流程

安装向导固定为 6 步：

1. `检查环境`
2. `自动补齐环境`
3. `安装 OpenClaw CLI`
4. `首次配置`
5. `完成 Onboarding`
6. `验证并进入控制台`

这 6 步必须严格按顺序推进。

---

## 5. 每一步的职责边界

### Step 1 检查环境

目标：判断当前机器是否具备安装前置条件

只允许检查：

- 操作系统
- Shell / 终端环境
- 基础写权限
- 网络可达性
- Node.js
- npm

不允许检查：

- `openclaw` 是否已安装
- 本地安装目录是否存在
- 配置文件是否存在
- Dashboard 是否可启动

原因：

- 这些都不是“前置条件”
- 它们属于安装结果或安装后状态

页面要求：

- 结果列表
- 一段非常短的解释
- 主按钮：`继续检查 / 重新检测`

### Step 2 自动补齐环境

目标：补齐 Step 1 检测出的前置缺失项

只允许处理：

- Node.js
- npm
- 必需的运行前置能力

不允许处理：

- OpenClaw CLI 安装
- OpenClaw 配置写入
- Onboarding

页面要求：

- 明确过程态
- 明确跳过项
- 明确成功 / 失败结果
- 日志只展示这一阶段的过程

### Step 3 安装 OpenClaw CLI

目标：安装并验证 `openclaw` 命令

只允许处理：

- OpenClaw CLI 安装
- CLI 版本检测
- 安装路径确认

不允许处理：

- Node.js / npm 补齐
- 配置表单
- Onboarding

页面要求：

- 只显示 CLI 安装相关信息
- 独立的安装输出区

### Step 4 首次配置

目标：写入第一次使用真正必须的配置

只允许处理：

- workspace
- gateway 基础项
- provider 选择
- 首次认证
- 首次必要 Skills / 渠道

不允许处理：

- 日志中心
- 验证命令
- 服务控制
- 高级维护配置

页面要求：

- 向导式表单
- 不暴露维护级高级设置
- 写入成功后进入 Step 5

### Step 5 完成 Onboarding

目标：完成官方交互式 onboarding

只允许处理：

- 应用内 Onboarding
- 必要的调试 Shell

不允许处理：

- Doctor 抢跑
- Dashboard 启动
- 配置维护总表

页面要求：

- 一个主按钮：`开始 Onboarding`
- 一个终端主区
- 一个辅助按钮：`打开调试 Shell`

### Step 6 验证并进入控制台

目标：确认 OpenClaw 已经真的可用

只允许处理：

- `doctor`
- `status`
- Dashboard 可达性确认

页面要求：

- 明确告诉用户“安装即将结束”
- 明确下一步是进入控制台

---

## 6. 三层概念必须分离

### 6.1 环境前置条件

包括：

- OS
- Shell
- 权限
- Node.js
- npm

### 6.2 安装结果

包括：

- `openclaw` 是否可执行
- OpenClaw CLI 版本
- 安装路径
- 本地安装目录是否存在

### 6.3 安装后状态

包括：

- 配置文件有效性
- Onboarding 是否完成
- Doctor / Status 是否通过
- Dashboard / Gateway 是否运行

任何 UI 都不能继续把这三层混成一个“环境检查”列表。

---

## 7. 控制台正式结构

安装完成后自动切换到 `Control Console`。

### 左侧

- 产品标识
- 主导航菜单
  - 总览
  - 模型
  - Skills
  - 渠道
  - 日志
  - 设置
- 底部低权重入口
  - 重新进入安装向导
  - 更新中心

### 顶部右侧

- 服务状态条
  - Dashboard
  - Gateway
  - CLI 版本
- 轻量动作
  - 打开 Dashboard
  - 重跑 Doctor
  - 查看 Status

### 主内容区

一次只显示一个主面板：

- Dashboard / 总览
- 模型管理
- Skills 管理
- 渠道管理
- 配置
- 日志

---

## 8. 跨平台策略

### Windows

- 缺 Node.js / npm 时允许自动补齐
- 优先 `winget`
- 回退官方 `Node.js LTS MSI`
- OpenClaw CLI 安装与环境补齐分开

### macOS

- 以 OpenClaw 官方推荐安装链路为主
- 避免自动改动太多系统级环境
- 应优先保证本地安装和系统终端兼容

### Linux

- 以本地可移植安装或官方安装脚本为主
- 不默认假设 systemd、桌面环境、包管理器完全一致

跨平台原则：

- 平台差异压在 `src/main`
- `src/renderer` 不理解平台细节，只消费整理后的状态

---

## 9. 技术架构

### 桌面栈

- `Electron`
- `React`
- `TypeScript`
- `Vite`
- `electron-builder`
- `electron-updater`
- `xterm.js`
- `node-pty`

### 代码分层

#### `src/main`

职责：

- 环境检测
- 环境补齐
- OpenClaw CLI 安装
- 配置读写
- 终端会话
- 更新
- 服务状态探测

建议进一步拆分：

- `environment service`
- `openclaw install service`
- `config service`
- `terminal service`
- `update service`
- `service probe service`

#### `src/renderer`

职责：

- 安装向导
- 控制台
- 状态展示
- 配置表单
- 日志与终端视图

#### `src/renderer/app`

职责：

- 顶层模式切换
- selector
- UI 状态机

---

## 10. 当前代码重构目标

当前代码需要被拉向以下目标：

1. 安装向导完整 6 步
2. 控制台完整左侧导航结构
3. 主进程动作分层清晰
4. 任何步骤都只有自己的主任务

---

## 11. 重构执行顺序

### Phase 1 安装向导前半段

目标：

- Step 1 检查环境
- Step 2 自动补齐环境
- Step 3 安装 OpenClaw CLI

完成标准：

- `openclaw` 不再出现在环境检测里
- 环境补齐不再偷偷安装 OpenClaw
- CLI 安装单独成步

### Phase 2 安装向导后半段

目标：

- Step 4 首次配置
- Step 5 Onboarding
- Step 6 验证

完成标准：

- 配置成功不再等于 Onboarding 完成
- Doctor 不再抢在 Onboarding 之前
- 验证成功后才切换控制台

### Phase 3 控制台重构

目标：

- 左侧导航
- 顶部服务状态条
- 右侧单主面板

完成标准：

- 控制台看起来像“控制台”
- 不再残留安装思维

### Phase 4 维护功能完善

目标：

- 模型管理
- Skills 管理
- Channels 管理
- 日志与配置

---

## 12. 验收标准

### 安装向导验收

- 新机器首次打开时，用户能明确看懂当前步骤
- Step 1 不出现 `openclaw` 和安装目录
- Step 2 只补环境
- Step 3 只装 CLI
- Step 4 只做首次配置
- Step 5 只做 Onboarding
- Step 6 只做验证

### 控制台验收

- 安装完成后自动进入控制台
- 控制台左侧有稳定导航
- 顶部状态与操作清楚
- 一次只显示一个主面板

### 失败体验验收

- 每一步失败都能明确知道失败在哪一步
- 每一步都有对应的重试动作
- 不再出现所有错误都堆到一个泛诊断区的情况

---

## 13. 本次文档结论

`ClawStart` 的最终形态不是“安装页上堆维护功能”，也不是“控制台里夹安装步骤”。

它必须是：

1. 一个真正的安装向导
2. 一个真正的日常控制台

后续执行顺序：

1. 按本文件继续完成安装向导剩余收口
2. 再正式重构控制台

