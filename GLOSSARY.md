# 米哈游多游戏自动签到系统

米游社社区福利自动签到与米哈游云游戏日常赠送时长领取的自动化服务上下文。

## Language

**米游社凭证 (MYS Cookie)**:
用于米哈游社区角色数据查询及游戏社区签到鉴权的凭据集合（主要包含 `account_id`、`cookie_token` 等）。
_Avoid_: 账号密码, 游戏Token

**设备动态密钥 (Dynamic Secret / DS)**:
米哈游客户端 API 特有的安全校验签名参数，通过 Salt、时间戳及随机数生成的防重放防伪造串。
_Avoid_: 接口签名, 随机密钥

**云游戏凭证 (Cloud Game Combo Token)**:
米哈游云游戏（云·原神、云·星穹铁道）专用的鉴权令牌，通过请求头 `x-rpc-combo_token` 传递用于领取每日免费时长。
_Avoid_: 米游社Cookie, 网页Cookie

**通知渠道 (Notification Provider)**:
当签到成功、失败或凭据失效时，向用户主动告警推送消息的第三方服务通道（如 PushPlus、Server酱、Telegram等）。
_Avoid_: 系统日志, 消息队列
