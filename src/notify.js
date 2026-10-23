import axios from 'axios';

/**
 * 获取北京时间 (UTC+8) 格式化字符串
 */
function getBeijingTimeString() {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date()).replace(/\//g, '-');
  } catch {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60 * 1000);
    return beijingTime.toISOString().replace('T', ' ').substring(0, 19);
  }
}

const GAME_NAMES = {
  Genshin: '原神',
  StarRail: '崩坏：星穹铁道',
  CloudYS: '云·原神',
  CloudSR: '云·星穹铁道'
};

/**
 * 将签到结果转换为美观的 Markdown 报告与纯文本报告
 * 支持：
 * 1. SignRecorder 实例或 getSummary() 返回的对象
 * 2. 签到结果记录数组 (Array)
 * 3. 预先格式化的字符串 (String)
 * 4. 显式指定的报告对象 ({ title, content, isCookieExpired })
 *
 * @param {Array|string|object} summary
 */
export function formatReport(summary) {
  const beijingTime = getBeijingTimeString();

  // 若传入的是 SignRecorder 实例
  if (summary && typeof summary.getSummary === 'function') {
    summary = summary.getSummary();
  }

  // 若传入的是纯文本字符串
  if (typeof summary === 'string') {
    const isCookieExpired = /失效|未登录|重新登录|401|403|token invalid|expired|cookie_invalid/i.test(summary);
    const title = isCookieExpired
      ? '⚠️ 米游社签到提醒：存在 Cookie 失效，请及时更新！'
      : '米游社每日签到报告';
    return {
      title,
      content: summary,
      plainText: summary,
      isCookieExpired
    };
  }

  let list = [];
  let isCookieExpired = false;

  if (Array.isArray(summary)) {
    list = summary;
  } else if (summary && typeof summary === 'object') {
    if (Array.isArray(summary.records)) {
      list = summary.records;
      if (summary.cookieInvalidCount > 0) {
        isCookieExpired = true;
      }
    } else if (summary.content) {
      return {
        title: summary.title || '米游社每日签到报告',
        content: summary.content,
        plainText: summary.plainText || summary.content,
        isCookieExpired: Boolean(summary.isCookieExpired)
      };
    }
  }

  // 空列表处理
  if (list.length === 0) {
    const title = 'ℹ️ 米游社签到报告：未执行任何签到任务';
    const content = `未检测到有效账号配置或未执行签到任务。\n\n时间: ${beijingTime}`;
    return {
      title,
      content,
      plainText: content,
      isCookieExpired: false
    };
  }

  // 统一判断条目状态
  for (const item of list) {
    const statusUpper = String(item.status || '').toUpperCase();
    const msg = String(item.message || '');
    item._isSkipped = statusUpper === 'SKIPPED' || item.status === 'skipped';
    item._isExpired = item.cookieExpired || statusUpper === 'COOKIE_INVALID' || /失效|未登录|重新登录/i.test(msg);
    if (item._isExpired) {
      isCookieExpired = true;
    }
    item._isSuccess = statusUpper === 'SUCCESS' || statusUpper === 'ALREADY_SIGNED' || item.status === 'success' || item.status === 'already_signed';
    item._isAlready = statusUpper === 'ALREADY_SIGNED' || item.status === 'already_signed' || msg.includes('已经签到');
  }

  const successCount = list.filter(item => item._isSuccess).length;
  const skippedCount = list.filter(item => item._isSkipped).length;
  const failedCount = list.filter(item => !item._isSuccess && !item._isSkipped).length;
  const allSuccess = failedCount === 0 && successCount > 0;

  let title = '';
  if (isCookieExpired) {
    title = '⚠️ 米游社签到提醒：存在 Cookie 失效，请及时更新！';
  } else if (allSuccess) {
    title = `✅ 米游社签到报告：全部成功 (${successCount}/${list.length - skippedCount})`;
  } else if (successCount > 0) {
    title = `⚠️ 米游社签到报告：部分失败 (${successCount} 成功, ${failedCount} 失败)`;
  } else {
    title = `⚠️ 米游社签到报告：执行异常 (失败 ${failedCount} 项)`;
  }

  const mysList = list.filter(item => (item.type || '').toUpperCase() === 'MYS');
  const cloudList = list.filter(item => (item.type || '').toUpperCase() === 'CLOUD');
  const otherList = list.filter(item => (item.type || '').toUpperCase() !== 'MYS' && (item.type || '').toUpperCase() !== 'CLOUD');

  // 构建 Markdown 内容
  const mdLines = [];
  mdLines.push('## 📋 米游社每日签到统计');
  mdLines.push('');
  mdLines.push(`> **状态**：${allSuccess ? '✅ 全部成功' : (failedCount > 0 ? '⚠️ 存在异常' : 'ℹ️ 未配置跳过')}  `);
  mdLines.push(`> **统计**：共 ${list.length} 项（成功 ${successCount}，失败 ${failedCount}，跳过 ${skippedCount}）`);
  mdLines.push('');

  if (isCookieExpired) {
    mdLines.push('> 🚨 **【重要警告】检测到账号 Cookie / Token 已失效！**');
    mdLines.push('> 请尽快重新获取 Cookie 或 Token，并更新 GitHub Secrets 对应配置，以免影响每日签到奖励获取！');
    mdLines.push('');
  }

  const renderItemMd = (item) => {
    const gameLabel = GAME_NAMES[item.game] || item.gameName || item.game;
    let statusIcon = '❌';
    if (item._isSkipped) statusIcon = '⚪';
    else if (item._isExpired) statusIcon = '❌';
    else if (item._isSuccess) statusIcon = item._isAlready ? 'ℹ️' : '✅';

    const accountIdx = item.accountIndex || item.userIndex || 1;
    const accountStr = item._isSkipped && accountIdx === 0 ? '' : ` - 账号 #${accountIdx}`;
    const nickname = item.nickname && item.nickname !== '-' ? ` (${item.nickname})` : '';
    const uid = item.uid && item.uid !== '-' && item.uid !== '无角色/未绑定' ? ` [UID: ${item.uid}]` : '';
    let extra = '';
    if (item.freeTime) {
      extra = ` (免费时长: ${item.freeTime}${item.totalTime ? `, 总时长: ${item.totalTime}` : ''})`;
    }
    const detailMsg = item.statusText || item.message || (item._isSuccess ? '签到成功' : '签到失败');
    return `- **${gameLabel}**${accountStr}${nickname}${uid}: ${statusIcon} ${detailMsg}${extra}`;
  };

  if (mysList.length > 0) {
    mdLines.push('### 🎮 米游社签到');
    for (const item of mysList) {
      mdLines.push(renderItemMd(item));
    }
    mdLines.push('');
  }

  if (cloudList.length > 0) {
    mdLines.push('### ☁️ 云游戏签到');
    for (const item of cloudList) {
      mdLines.push(renderItemMd(item));
    }
    mdLines.push('');
  }

  if (otherList.length > 0) {
    mdLines.push('### 📌 其它项目');
    for (const item of otherList) {
      mdLines.push(renderItemMd(item));
    }
    mdLines.push('');
  }

  mdLines.push('---');
  mdLines.push(`⏰ **签到时间**: ${beijingTime} (北京时间)`);

  // 构建纯文本内容
  const txtLines = [];
  txtLines.push(`[米游社每日签到报告]`);
  txtLines.push(`统计: 成功 ${successCount} | 失败 ${failedCount} | 跳过 ${skippedCount}`);
  if (isCookieExpired) {
    txtLines.push(`⚠️【重要提醒】检测到账号 Cookie/Token 失效，请及时更新 GitHub Secrets！`);
  }
  txtLines.push('');

  const renderItemTxt = (item) => {
    const gameLabel = GAME_NAMES[item.game] || item.gameName || item.game;
    let statusIcon = '【失败】';
    if (item._isSkipped) statusIcon = '【跳过】';
    else if (item._isExpired) statusIcon = '【失效】';
    else if (item._isSuccess) statusIcon = item._isAlready ? '【已签】' : '【成功】';

    const accountIdx = item.accountIndex || item.userIndex || 1;
    const accountStr = item._isSkipped && accountIdx === 0 ? '' : ` 账号#${accountIdx}`;
    const nickname = item.nickname && item.nickname !== '-' ? ` ${item.nickname}` : '';
    const uid = item.uid && item.uid !== '-' && item.uid !== '无角色/未绑定' ? ` (${item.uid})` : '';
    let extra = '';
    if (item.freeTime) {
      extra = ` [免费: ${item.freeTime}${item.totalTime ? `, 总计: ${item.totalTime}` : ''}]`;
    }
    const detailMsg = item.statusText || item.message || (item._isSuccess ? '成功' : '失败');
    return `* ${gameLabel}${accountStr}${nickname}${uid}: ${statusIcon} ${detailMsg}${extra}`;
  };

  if (mysList.length > 0) {
    txtLines.push('--- 米游社签到 ---');
    for (const item of mysList) {
      txtLines.push(renderItemTxt(item));
    }
    txtLines.push('');
  }

  if (cloudList.length > 0) {
    txtLines.push('--- 云游戏签到 ---');
    for (const item of cloudList) {
      txtLines.push(renderItemTxt(item));
    }
    txtLines.push('');
  }

  if (otherList.length > 0) {
    txtLines.push('--- 其它项目 ---');
    for (const item of otherList) {
      txtLines.push(renderItemTxt(item));
    }
    txtLines.push('');
  }

  txtLines.push(`时间: ${beijingTime}`);

  return {
    title,
    content: mdLines.join('\n'),
    plainText: txtLines.join('\n'),
    isCookieExpired
  };
}

/**
 * 渠道 1: PushPlus 推送
 */
async function sendPushPlus(title, content) {
  const token = process.env.PUSHPLUS_TOKEN?.trim();
  if (!token) return;

  try {
    const res = await axios.post('https://www.pushplus.plus/send', {
      token,
      title,
      content,
      template: 'markdown'
    }, { timeout: 15000 });

    if (res.data?.code === 200) {
      console.log('[Notify] PushPlus: 发送成功');
    } else {
      console.warn(`[Notify] PushPlus: 发送异常 - ${res.data?.msg || JSON.stringify(res.data)}`);
    }
  } catch (err) {
    console.error(`[Notify] PushPlus: 请求失败 - ${err.message}`);
  }
}

/**
 * 渠道 2: Server酱推送 (支持 Turbo 与标准版)
 */
async function sendServerChan(title, content) {
  const key = process.env.SERVERCHAN_KEY?.trim();
  if (!key) return;

  try {
    let url = `https://sctapi.ftqq.com/${key}.send`;
    if (key.startsWith('sctp')) {
      url = `https://${key}.push.ft07.com/send`;
    } else if (key.startsWith('SCU')) {
      url = `https://sc.ftqq.com/${key}.send`;
    }

    const res = await axios.post(url, {
      title,
      desp: content
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    if (res.data?.code === 0 || res.data?.errno === 0 || res.data?.data?.error === 'SUCCESS') {
      console.log('[Notify] Server酱: 发送成功');
    } else {
      console.warn(`[Notify] Server酱: 发送异常 - ${res.data?.message || res.data?.errmsg || JSON.stringify(res.data)}`);
    }
  } catch (err) {
    console.error(`[Notify] Server酱: 请求失败 - ${err.message}`);
  }
}

/**
 * 渠道 3: Telegram Bot 推送
 */
async function sendTelegram(title, content, plainText) {
  const token = process.env.TG_BOT_TOKEN?.trim();
  const chatId = process.env.TG_USER_ID?.trim();
  if (!token || !chatId) return;

  const host = (process.env.TG_API_HOST?.trim() || 'https://api.telegram.org').replace(/\/$/, '');
  const url = `${host}/bot${token}/sendMessage`;

  // 优先尝试 Markdown 推送
  try {
    const res = await axios.post(url, {
      chat_id: chatId,
      text: `*${title}*\n\n${content}`,
      parse_mode: 'Markdown'
    }, { timeout: 15000 });

    if (res.data?.ok) {
      console.log('[Notify] Telegram: 发送成功');
      return;
    }
  } catch {
    // 若 Markdown 解析失败，降级为纯文本重试
    try {
      const fallbackText = `${title}\n\n${plainText || content}`;
      const resFallback = await axios.post(url, {
        chat_id: chatId,
        text: fallbackText
      }, { timeout: 15000 });

      if (resFallback.data?.ok) {
        console.log('[Notify] Telegram: 纯文本降级发送成功');
        return;
      }
    } catch (retryErr) {
      console.error(`[Notify] Telegram: 请求失败 - ${retryErr.message}`);
    }
  }
}

/**
 * 渠道 4: 自定义 Webhook (支持飞书、钉钉、企业微信及通用 Webhook)
 */
async function sendWebhook(title, content, isCookieExpired) {
  const rawUrls = process.env.WEBHOOK_URL?.trim();
  if (!rawUrls) return;

  // 支持以逗号分割的多个 Webhook
  const urls = rawUrls.split(',').map(u => u.trim()).filter(Boolean);

  for (const url of urls) {
    try {
      const lower = url.toLowerCase();
      let payload;

      if (lower.includes('dingtalk.com')) {
        // 钉钉自定义机器人
        payload = {
          msgtype: 'markdown',
          markdown: {
            title,
            text: `### ${title}\n\n${content}`
          }
        };
      } else if (lower.includes('weixin.qq.com') || lower.includes('qyapi')) {
        // 企业微信机器人
        payload = {
          msgtype: 'markdown',
          markdown: {
            content: `### ${title}\n\n${content}`
          }
        };
      } else if (lower.includes('feishu.cn') || lower.includes('larksuite.com')) {
        // 飞书自定义机器人 (使用卡片格式)
        payload = {
          msg_type: 'interactive',
          card: {
            header: {
              title: {
                tag: 'plain_text',
                content: title
              },
              template: isCookieExpired ? 'red' : 'blue'
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content
                }
              }
            ]
          }
        };
      } else {
        // 通用 Webhook
        payload = {
          title,
          content,
          text: `${title}\n\n${content}`,
          isCookieExpired
        };
      }

      const res = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const isSuccess = res.status >= 200 && res.status < 300 && (
        res.data?.errcode === 0 ||
        res.data?.StatusCode === 0 ||
        res.data?.code === 0 ||
        res.data?.code === 200 ||
        res.data?.success === true ||
        (res.data && res.data.errcode === undefined && res.data.code === undefined)
      );

      if (isSuccess) {
        console.log(`[Notify] Webhook (${new URL(url).hostname}): 发送成功`);
      } else {
        console.warn(`[Notify] Webhook (${new URL(url).hostname}): 响应结果 - ${JSON.stringify(res.data)}`);
      }
    } catch (err) {
      console.error(`[Notify] Webhook (${url}): 请求失败 - ${err.message}`);
    }
  }
}

/**
 * 核心通知分发函数
 * @param {Array|string|object} summary
 */
export async function notify(summary) {
  const { title, content, plainText, isCookieExpired } = formatReport(summary);

  // 1. 控制台始终输出签到摘要
  console.log('\n====================== 签到结果摘要 ======================');
  console.log(plainText || content);
  console.log('==========================================================');

  if (isCookieExpired) {
    console.warn('⚠️ 警告：检测到存在 Cookie / Token 失效的账号，请尽快检查更新！\n');
  }

  // 2. 检测是否有配置任何推送渠道
  const hasPushPlus = Boolean(process.env.PUSHPLUS_TOKEN?.trim());
  const hasServerChan = Boolean(process.env.SERVERCHAN_KEY?.trim());
  const hasTelegram = Boolean(process.env.TG_BOT_TOKEN?.trim() && process.env.TG_USER_ID?.trim());
  const hasWebhook = Boolean(process.env.WEBHOOK_URL?.trim());

  if (!hasPushPlus && !hasServerChan && !hasTelegram && !hasWebhook) {
    console.log('[Notify] 未配置任何推送环境变量 (PUSHPLUS_TOKEN, SERVERCHAN_KEY, TG_BOT_TOKEN, WEBHOOK_URL)，静默跳过消息推送。');
    return;
  }

  console.log('[Notify] 开始推送通知至已配置的渠道...');
  const tasks = [];
  if (hasPushPlus) tasks.push(sendPushPlus(title, content));
  if (hasServerChan) tasks.push(sendServerChan(title, content));
  if (hasTelegram) tasks.push(sendTelegram(title, content, plainText));
  if (hasWebhook) tasks.push(sendWebhook(title, content, isCookieExpired));

  await Promise.allSettled(tasks);
  console.log('[Notify] 消息推送流程执行完毕。');
}

export const sendNotify = notify;
export default notify;
