import axios from 'axios';
import { getTokenConfig } from '../utils/config.js';
import { SignRecorder } from '../utils/summary.js';

const $axios = axios.create({
  timeout: 15000
});

const GAME_NAME = {
  CloudYS: '云·原神',
  CloudSR: '云·星穹铁道'
};

const ENV_KEY = {
  CloudYS: 'GENSHIN_TOKENS',
  CloudSR: 'STARRAIL_TOKENS'
};

const randomSleep = (min, max) => {
  if (process.env.NO_SLEEP || process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`Sleeping for ${delay} seconds...`);
  return new Promise((resolve) => setTimeout(resolve, delay * 1000));
};

const commonHeaders = {
  Connection: "Keep-Alive",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "accept-language": "zh-CN,zh;q=0.9",
  Accept: "application/json, text/plain, */*",
  "sec-ch-ua": `"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": `"macOS"`,
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "x-rpc-channel": "mihoyo",
  "x-rpc-client_type": 17,
  "x-rpc-combo_token": "",
  "x-rpc-cps": "mac_mihoyo",
  "x-rpc-device_id": "1b252815-b2df-494f-8c84-a93e1a6d3479",
  "x-rpc-device_model": "Macintosh",
  "x-rpc-device_name": "Apple Macintosh",
  "x-rpc-language": "zh-cn",
  "x-rpc-sys_version": "Mac OS 10.15.7",
  "x-rpc-vendor_id": 2,
};

const gameConfig = {
  CloudYS: {
    headers: {
      Host: "api-cloudgame.mihoyo.com",
      origin: "https://ys.mihoyo.com",
      Referer: "https://ys.mihoyo.com/",
      "x-rpc-app_id": 4,
      "x-rpc-app_version": "6.0.0",
      "x-rpc-cg_game_biz": "hk4e_cn",
      "x-rpc-op_biz": "clgm_cn",
    },
    baseURL: "https://api-cloudgame.mihoyo.com/hk4e_cg_cn",
  },
  CloudSR: {
    headers: {
      Host: "cg-hkrpg-api.mihoyo.com",
      origin: "https://sr.mihoyo.com",
      Referer: "https://sr.mihoyo.com/",
      "x-rpc-app_id": 8,
      "x-rpc-app_version": "3.5.0",
      "x-rpc-cg_game_biz": "hkrpg_cn",
      "x-rpc-op_biz": "clgm_hkrpg-cn",
    },
    baseURL: "https://cg-hkrpg-api.mihoyo.com/hkrpg_cn/cg",
  }
};

/**
 * 查询云游戏钱包及免费时长信息
 */
const getWallet = async (gameKey, token) => {
  const config = gameConfig[gameKey];
  try {
    const res = await $axios.request({
      method: 'GET',
      headers: { ...commonHeaders, ...config.headers, "x-rpc-combo_token": token },
      url: config.baseURL + '/wallet/wallet/get'
    });

    const data = res?.data;
    if (data?.retcode === 0 && data.data) {
      return {
        success: true,
        status: 'SUCCESS',
        data: data.data,
        message: 'OK'
      };
    }

    const retcode = data?.retcode;
    const msg = data?.message || '获取钱包信息失败';

    if (retcode === -100 || retcode === -105 || retcode === 10001 || /token/i.test(msg) || /登录/i.test(msg)) {
      return {
        success: false,
        status: 'COOKIE_INVALID',
        message: `凭证已失效 [${retcode}]: ${msg}`
      };
    }

    return {
      success: false,
      status: 'API_ERROR',
      message: `获取钱包失败 [${retcode}]: ${msg}`
    };
  } catch (err) {
    const retcode = err.response?.data?.retcode;
    const msg = err.response?.data?.message || err.message;
    if (retcode === -100 || retcode === -105 || retcode === 10001) {
      return {
        success: false,
        status: 'COOKIE_INVALID',
        message: `凭证失效: ${msg}`
      };
    }
    return {
      success: false,
      status: 'API_ERROR',
      message: `网络异常: ${msg}`
    };
  }
};

/**
 * 获取未读通知弹窗列表
 */
const getNotifications = async (gameKey, token) => {
  const config = gameConfig[gameKey];
  try {
    const res = await $axios.request({
      method: 'GET',
      headers: { ...commonHeaders, ...config.headers, "x-rpc-combo_token": token },
      url: config.baseURL + '/gamer/api/listNotifications?status=NotificationStatusUnread&type=NotificationTypePopup&is_sort=true'
    });
    if (res?.data?.retcode === 0 && res.data.data?.list) {
      return res.data.data.list;
    }
    return [];
  } catch (err) {
    console.warn(`[${GAME_NAME[gameKey] || gameKey}] 获取通知列表失败: ${err.message}`);
    return [];
  }
};

/**
 * 确认通知弹窗（触发发放免费时长）
 */
const ackNotifications = async (gameKey, token, id) => {
  const config = gameConfig[gameKey];
  try {
    const res = await $axios.request({
      method: 'POST',
      headers: { ...commonHeaders, ...config.headers, "x-rpc-combo_token": token },
      url: config.baseURL + '/gamer/api/ackNotification',
      data: { id }
    });
    return res?.data?.retcode === 0;
  } catch (err) {
    console.warn(`[${GAME_NAME[gameKey] || gameKey}] 确认通知失败: ${err.message}`);
    return false;
  }
};

/**
 * 云游戏签到主流程
 * @param {'CloudYS' | 'CloudSR'} gameKey 
 * @param {SignRecorder} [recorder]
 * @returns {Promise<Array>}
 */
const doCloudSign = async (gameKey, recorder = null) => {
  const activeRecorder = recorder || new SignRecorder();
  const gameName = GAME_NAME[gameKey] || gameKey;
  const envKey = ENV_KEY[gameKey];

  const CONF = await getTokenConfig();
  const tokenList = CONF[gameKey] || [];

  // 如果未配置凭证，作为可选跳过并输出友好提示，不输出报错日志
  if (!tokenList || tokenList.length === 0) {
    console.info(`[${gameName}] 未配置凭证 (${envKey})，跳过云游戏签到任务。`);
    activeRecorder.addRecord({
      type: 'Cloud',
      game: gameKey,
      gameName,
      accountIndex: 0,
      nickname: '-',
      uid: '-',
      status: 'SKIPPED',
      statusText: '未配置跳过',
      message: `未配置环境变量 ${envKey}`
    });
    return activeRecorder.records;
  }

  console.info(`[${gameName}] 开始执行签到，共检测到 ${tokenList.length} 个账号凭证\n`);

  for (let index = 0; index < tokenList.length; index++) {
    const token = tokenList[index];
    const accountIndex = index + 1;
    if (!token) continue;

    console.log(`[${gameName}] 账号 ${accountIndex} 开始检查时长并签到...`);

    const initialWallet = await getWallet(gameKey, token);

    if (initialWallet.status === 'COOKIE_INVALID') {
      console.error(`[${gameName}] 账号 ${accountIndex} 凭证失效: ${initialWallet.message}`);
      activeRecorder.addRecord({
        type: 'Cloud',
        game: gameKey,
        gameName,
        accountIndex,
        nickname: `云游戏账号${accountIndex}`,
        uid: '-',
        status: 'COOKIE_INVALID',
        statusText: '凭证失效',
        message: initialWallet.message
      });
      continue;
    }

    if (initialWallet.status === 'API_ERROR') {
      console.error(`[${gameName}] 账号 ${accountIndex} 查询钱包失败: ${initialWallet.message}`);
      activeRecorder.addRecord({
        type: 'Cloud',
        game: gameKey,
        gameName,
        accountIndex,
        nickname: `云游戏账号${accountIndex}`,
        uid: '-',
        status: 'API_ERROR',
        statusText: '接口异常',
        message: initialWallet.message
      });
      continue;
    }

    // 领取通知时长
    const notificationsList = await getNotifications(gameKey, token);
    if (notificationsList && notificationsList.length > 0) {
      console.log(`[${gameName}] 账号 ${accountIndex} 检测到 ${notificationsList.length} 条待确认通知，正在领取...`);
      for (const notification of notificationsList) {
        await randomSleep(1, 3);
        await ackNotifications(gameKey, token, notification.id);
      }
      await randomSleep(1, 2);
    }

    // 重新获取最新时长
    const finalWallet = await getWallet(gameKey, token);
    const walletData = finalWallet.data || initialWallet.data || {};
    const freeMinutes = walletData.free_time?.free_time ?? 0;
    const totalMinutes = walletData.total_time ?? 0;
    const detailMsg = `免费时长: ${freeMinutes}分钟, 总时长: ${totalMinutes}分钟`;

    console.log(`[${gameName}] 账号 ${accountIndex} 签到成功: ${detailMsg}`);

    activeRecorder.addRecord({
      type: 'Cloud',
      game: gameKey,
      gameName,
      accountIndex,
      nickname: `云游戏账号${accountIndex}`,
      uid: '-',
      status: 'SUCCESS',
      statusText: '签到成功',
      message: detailMsg,
      raw: walletData
    });

    await randomSleep(3, 9);
  }

  console.info(`[${gameName}] 签到流程处理完毕\n`);
  return activeRecorder.records;
};

export { doCloudSign };
