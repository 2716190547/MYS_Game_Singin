# 米游社、米家云游戏签到脚本 (Node.js 版) - 支持多账号 (崩铁 & 原神)

## 简介
本项目是一个用于自动签到米游社、云崩铁、云原神的 Node.js 脚本。支持多账号、多渠道消息推送（PushPlus、Server酱、Telegram Bot、自定义 Webhook），并可本地部署或通过 GitHub Actions 自动运行。

## 功能特性
- **多账号支持**: 同时支持多个账号的签到，自动去重与格式清洗。
- **多渠道消息推送**: 支持 PushPlus、Server酱、Telegram Bot、自定义 Webhook（兼容飞书、钉钉、企业微信），并在 Cookie 失效时醒目报警。
- **防止静默失败**: 当凭证失效、未配置必需凭据或签到失败时，主动标记失败退出码 (`exitCode = 1`)，触发 GitHub Actions 变红及邮件报警。
- **本地 Cookie 快速自检**: 内置 `npm run check-cookie` 工具，可在提交前验证 Cookie 有效性及绑定的游戏角色。
- **GitHub Actions 自动化**: 每日北京时间零点自动执行，已升级至 GitHub Actions v4 与 Node 20。

## 免责声明
本脚本仅供交流测试使用。因使用本脚本而产生的任何问题，作者概不负责。官方可能更改接口导致脚本失效，脚本失效会尽快更新，但不保证第一时间。请低调使用，如有不同意，请关闭并停止使用。

## 获取 Cookie 方式 - 米游社签到必需

1. **打开浏览器**:
   - 打开你的浏览器，进入无痕/隐身模式。
   
2. **登录米游社**:
   - 访问 [原神论坛](http://bbs.mihoyo.com/ys) 或 [崩铁论坛](http://bbs.mihoyo.com/sr)，二选一进行登录操作，原神崩铁 Cookie 通用。
   
3. **获取 Cookie**:
   - 按下键盘上的 `F12` 或右键点击页面选择“检查”，打开开发者工具。
   - 切换到“Console”选项卡，复制粘贴以下代码并回车：
     ```js
     const cookie = document.cookie
     const ask = confirm('Cookie:' + cookie + '\n\nDo you want to copy the cookie to the clipboard?')
     if (ask == true) {
       copy(cookie)
       msg = cookie
     } else {
       msg = 'Cancel'
     }
     ```
   - 点击确认，Cookie 即已复制到剪贴板。

4. **本地快速验证 Cookie (可选)**:
   ```bash
   node scripts/check-cookie.js "你的Cookie"
   # 或
   MYS_COOKIES="你的Cookie" npm run check-cookie
   ```
   若输出游戏角色昵称与 UID，说明 Cookie 有效。

## 获取 Token 方式 - 云游戏签到 (可选)

若无需云游戏签到，可直接跳过，脚本会自动识别并优雅跳过：

1. **打开浏览器**: 进入无痕模式访问 [云原神](https://ys.mihoyo.com/cloud/#/) 或 [云崩铁](https://sr.mihoyo.com/cloud/#/)。
2. **获取 Token**:
   - 按 `F12` 打开开发者工具，切换到 `Network` 选项卡。
   - 在 XHR 请求中找到任意一条请求头中带有 `x-rpc-combo_token` 的请求。
   - 复制该 Token。

## 消息通知配置 (可选)

支持配置以下任意一种或多种通知渠道，未配置任何渠道时将静默跳过推送（仅在控制台打印）：

| 环境变量名称 | 说明 | 示例 |
| :--- | :--- | :--- |
| `PUSHPLUS_TOKEN` | [PushPlus](https://www.pushplus.plus/) 用户 Token (微信公众号推送) | `abc123xxx...` |
| `SERVERCHAN_KEY` | [Server酱](https://sct.ftqq.com/) SendKey (支持 Turbo) | `SCTxxxxxx...` |
| `TG_BOT_TOKEN` | Telegram 机器人 Token (需与 `TG_USER_ID` 一同配置) | `123456:ABC-DEF1234...` |
| `TG_USER_ID` | Telegram 接收用户的 Chat ID | `123456789` |
| `WEBHOOK_URL` | 自定义 Webhook 机器人链接（自动识别飞书 / 钉钉 / 企微 / 通用） | `https://open.feishu.cn/...` |

## GitHub Actions 部署

你可以通过 GitHub Actions 定期自动运行签到任务。以下是配置步骤：

1. **配置 GitHub Secrets**:
   - 打开你的 GitHub 仓库页面。
   - 点击 `Settings` -> `Secrets and variables` -> `Actions`。
   - 添加新的 Repository Secret：
     - **必需凭证**：
       - `MYS_COOKIES`: 米游社 Cookie（支持多账号，以换行或逗号分隔）
     - **可选游戏凭证**：
       - `GENSHIN_TOKENS`: 云原神 Token（未配置时自动跳过）
       - `STARRAIL_TOKENS`: 云星穹铁道 Token（未配置时自动跳过）
     - **可选通知凭证**：
       - `PUSHPLUS_TOKEN`: PushPlus 用户 Token
       - `SERVERCHAN_KEY`: Server酱 SendKey
       - `TG_BOT_TOKEN`: Telegram Bot Token
       - `TG_USER_ID`: Telegram Chat ID
       - `WEBHOOK_URL`: 自定义 Webhook 地址

2. **自动与手动触发**:
   - 定时执行：每天 UTC 16:00 (北京时间 00:00) 自动触发。
   - 手动测试：在 GitHub 仓库中进入 `Actions` -> 选择 `MiHoYo Sign-In Script` -> 点击 `Run workflow` 即可立即执行。

## 本地部署

1. **克隆项目并安装依赖**:
   ```bash
   git clone https://github.com/2716190547/MYS_Game_Singin.git
   cd MYS_Game_Singin
   npm install
   ```

2. **配置环境变量并运行**:
   ```bash
   export MYS_COOKIES="你的米游社Cookie"
   # 可选：云游戏与通知
   # export GENSHIN_TOKENS="..."
   # export PUSHPLUS_TOKEN="..."
   npm start
   ```

## 更新日志

- **2026-10 (v1.2.0)**:
  - 修复 Cookie 失效静默成功缺陷，失败时明确标记非零退出码 (`exitCode = 1`)；
  - 现代化 GitHub Actions 工作流（升级 Node 20、Actions v4）；
  - 新增多渠道通知机制（PushPlus、Server酱、Telegram、飞书/钉钉/企业微信 Webhook），支持 Cookie 失效醒目报警；
  - 云游戏凭证改为可选优雅跳过，不再输出伪报错；
  - 增加本地 Cookie 验证脚本 `scripts/check-cookie.js`。
- **2025-09**: v1.1.0 增加云原神云崩铁签到功能。
- **2025-02**: v1.0.0 初始发布，支持原神和崩铁多账号签到功能。
