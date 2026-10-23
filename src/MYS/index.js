import axios from 'axios';
import md5 from 'md5';
import { v4 } from 'uuid';
import { getCookieConfig } from '../utils/config.js';
import { SignRecorder } from '../utils/summary.js';

const WEB_HOST = 'api-takumi.mihoyo.com';
const APP_VERSION = '2.81.1';

const GAME_NAME = {
  Genshin: '原神',
  StarRail: '崩坏：星穹铁道'
};

const GAME_BIZ = {
  Genshin: 'hk4e_cn',
  StarRail: 'hkrpg_cn'
};

const ACT_ID = {
  Genshin: 'e202311201442471',
  StarRail: 'e202304121516551'
};

const DEFAULT_REGION = {
  Genshin: 'cn_gf01',
  StarRail: 'prod_gf_cn'
};

const SIGNGAME = {
  Genshin: 'hk4e',
  StarRail: 'hkrpg'
};

const COMMON__HEADERS = {
  "DS": '',
  "Cookie": '',
  "Host": WEB_HOST,
  "User-Agent": `Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/${APP_VERSION}`,
  "x-rpc-app_version": APP_VERSION,
  "x-rpc-client_type": 5,
  "Accept-Language": "zh-CN,zh-Hans;q=0.9",
  "Accept": "application/json, text/plain, */*",
};

const getRoleHeaders = () => ({
  "Referer": 'https://webstatic.mihoyo.com/',
  "x-rpc-device_id": v4(),
  "Origin": "https://webstatic.mihoyo.com",
  "x-rpc-challenge": 'null',
  "Accept": "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br",
});

const getSignHeaders = (signGame) => ({
  "Referer": "https://act.mihoyo.com/",
  "x-rpc-device_model": "iPhone14,4",
  "x-rpc-device_id": v4(),
  "x-rpc-platform": 1,
  "x-rpc-device_name": "iPhone",
  "Origin": "https://act.mihoyo.com",
  "Sec-Fetch-Site": "same-site",
  "Connection": "keep-alive",
  "Content-Type": "application/json;charset=utf-8",
  "x-rpc-signgame": signGame,
});

const $axios = axios.create({
  timeout: 15000
});

const randomSleep = (min, max) => {
  if (process.env.NO_SLEEP || process.env.NODE_ENV === 'test') {
    return Promise.resolve();
  }
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(`Sleeping for ${delay} seconds...`);
  return new Promise((resolve) => setTimeout(resolve, delay * 1000));
};

async function getDS() {
  const s = "yUZ3s0Sna1IrSNfk29Vo6vRapdOyqyhB";
  const t = Math.floor(Date.now() / 1e3);
  const r = Math.random().toString(36).slice(-6);
  const c = `salt=${s}&t=${t}&r=${r}`;
  return `${t},${r},${md5(c)}`;
}

const getHeaders = async (Cookie, whichHeader) => {
  return { ...COMMON__HEADERS, ...whichHeader, Cookie, DS: await getDS() };
};

/**
 * 获取账号绑定的游戏角色
 */
const getRole = async (cookie, gameKey) => {
  const gameName = GAME_NAME[gameKey] || gameKey;
  try {
    const headers = await getHeaders(cookie, getRoleHeaders());
    const res = await $axios.request({
      method: 'GET',
      headers,
      url: `https://${WEB_HOST}/binding/api/getUserGameRolesByCookie?game_biz=${GAME_BIZ[gameKey]}`
    });

    const data = res?.data;
    if (!data) {
      return {
        success: false,
        status: 'API_ERROR',
        message: '接口返回数据为空'
      };
    }

    // retcode = -100 或 10001 表示未登录/Cookie已失效
    if (data.retcode === -100 || data.retcode === 10001 || data.retcode === -10001) {
      return {
        success: false,
        status: 'COOKIE_INVALID',
        message: data.message || 'Cookie已失效，请重新获取'
      };
    }

    if (data.retcode !== 0) {
      return {
        success: false,
        status: 'API_ERROR',
        message: `获取角色列表失败 [${data.retcode}]: ${data.message || '未知错误'}`
      };
    }

    const list = data.data?.list || [];
    if (list.length === 0) {
      return {
        success: true,
        roles: [],
        status: 'NO_CHARACTER',
        message: '未查询到角色'
      };
    }

    return {
      success: true,
      roles: list,
      status: 'SUCCESS',
      message: 'OK'
    };
  } catch (err) {
    const retcode = err.response?.data?.retcode;
    const apiMsg = err.response?.data?.message || err.message;
    if (retcode === -100 || retcode === 10001) {
      return {
        success: false,
        status: 'COOKIE_INVALID',
        message: apiMsg || 'Cookie已失效，请重新获取'
      };
    }
    return {
      success: false,
      status: 'API_ERROR',
      message: `网络或接口异常: ${apiMsg}`
    };
  }
};

/**
 * 执行具体角色签到
 */
async function Sign_In(cookie, gameKey, role) {
  try {
    const headers = await getHeaders(cookie, getSignHeaders(SIGNGAME[gameKey]));
    const data = {
      act_id: ACT_ID[gameKey],
      region: role.region || DEFAULT_REGION[gameKey],
      uid: String(role.game_uid),
      lang: 'zh-cn'
    };

    const res = await $axios.request({
      method: 'POST',
      headers,
      data,
      url: `https://${WEB_HOST}/event/luna/${SIGNGAME[gameKey]}/sign`
    });

    const { retcode, message: apiMsg } = res?.data || {};

    if (retcode === 0) {
      return {
        status: 'SUCCESS',
        statusText: '签到成功',
        message: apiMsg || 'OK',
        raw: res.data
      };
    }

    // retcode = -5003 代表已签到，视作正常成功状态
    if (retcode === -5003) {
      return {
        status: 'ALREADY_SIGNED',
        statusText: '今日已签到',
        message: apiMsg || '今日已签到',
        raw: res.data
      };
    }

    // Cookie失效
    if (retcode === -100 || retcode === 10001 || retcode === -10001) {
      return {
        status: 'COOKIE_INVALID',
        statusText: 'Cookie失效',
        message: apiMsg || 'Cookie已失效',
        raw: res.data
      };
    }

    // 风控验证码
    if (retcode === 1034) {
      return {
        status: 'API_ERROR',
        statusText: '风控限制',
        message: `触发风控校验验证码 [${retcode}]`,
        raw: res.data
      };
    }

    return {
      status: 'API_ERROR',
      statusText: '签到失败',
      message: `[${retcode}] ${apiMsg || '未知错误'}`,
      raw: res.data
    };
  } catch (err) {
    const retcode = err.response?.data?.retcode;
    const apiMsg = err.response?.data?.message || err.message;

    if (retcode === -5003) {
      return {
        status: 'ALREADY_SIGNED',
        statusText: '今日已签到',
        message: apiMsg || '今日已签到'
      };
    }
    if (retcode === -100 || retcode === 10001) {
      return {
        status: 'COOKIE_INVALID',
        statusText: 'Cookie失效',
        message: apiMsg || 'Cookie已失效'
      };
    }

    return {
      status: 'API_ERROR',
      statusText: '接口异常',
      message: `请求异常: ${apiMsg}`
    };
  }
}

/**
 * 米游社签到主函数
 * @param {'Genshin' | 'StarRail'} gameKey
 * @param {SignRecorder} [recorder]
 * @returns {Promise<Array>}
 */
const doMYSSign = async (gameKey, recorder = null) => {
  const activeRecorder = recorder || new SignRecorder();
  const gameName = GAME_NAME[gameKey] || gameKey;
  const CONF = await getCookieConfig();
  const cookieList = CONF[gameKey] || [];

  if (!cookieList || cookieList.length === 0) {
    console.warn(`[${gameName}] 未配置 MYS_COOKIES，跳过此游戏签到。`);
    activeRecorder.markMissingRequiredConfig();
    activeRecorder.addRecord({
      type: 'MYS',
      game: gameKey,
      gameName,
      accountIndex: 0,
      nickname: '-',
      uid: '-',
      status: 'COOKIE_INVALID',
      statusText: '缺少凭证',
      message: '未配置环境变量 MYS_COOKIES'
    });
    return activeRecorder.records;
  }

  console.info(`[${gameName}] 开始执行签到，共检测到 ${cookieList.length} 个账号\n`);

  for (let index = 0; index < cookieList.length; index++) {
    const cook = cookieList[index];
    const accountIndex = index + 1;
    if (!cook) continue;

    console.log(`[${gameName}] 账号 ${accountIndex} 开始检查角色并签到...`);
    const roleResult = await getRole(cook, gameKey);

    if (roleResult.status === 'COOKIE_INVALID') {
      console.error(`[${gameName}] 账号 ${accountIndex} 登录失败: ${roleResult.message}`);
      activeRecorder.addRecord({
        type: 'MYS',
        game: gameKey,
        gameName,
        accountIndex,
        nickname: `账号${accountIndex}`,
        uid: '-',
        status: 'COOKIE_INVALID',
        statusText: 'Cookie失效',
        message: roleResult.message
      });
      continue;
    }

    if (roleResult.status === 'API_ERROR') {
      console.error(`[${gameName}] 账号 ${accountIndex} 获取角色异常: ${roleResult.message}`);
      activeRecorder.addRecord({
        type: 'MYS',
        game: gameKey,
        gameName,
        accountIndex,
        nickname: `账号${accountIndex}`,
        uid: '-',
        status: 'API_ERROR',
        statusText: '接口异常',
        message: roleResult.message
      });
      continue;
    }

    if (roleResult.status === 'NO_CHARACTER' || !roleResult.roles || roleResult.roles.length === 0) {
      console.log(`[${gameName}] 账号 ${accountIndex} 未查询到绑定的游戏角色`);
      activeRecorder.addRecord({
        type: 'MYS',
        game: gameKey,
        gameName,
        accountIndex,
        nickname: `账号${accountIndex}`,
        uid: '-',
        status: 'NO_CHARACTER',
        statusText: '未查询到角色',
        message: '该账号未绑定此游戏角色'
      });
      continue;
    }

    // 为该 Cookie 下查询到的角色执行签到
    for (const role of roleResult.roles) {
      console.log(`[${gameName}] 成功登录 <${role.nickname}(${role.game_uid})>`);
      const signRes = await Sign_In(cook, gameKey, role);
      console.log(`[${gameName}] <${role.nickname}(${role.game_uid})> ${signRes.statusText}: ${signRes.message}`);

      activeRecorder.addRecord({
        type: 'MYS',
        game: gameKey,
        gameName,
        accountIndex,
        nickname: role.nickname || `账号${accountIndex}`,
        uid: String(role.game_uid),
        status: signRes.status,
        statusText: signRes.statusText,
        message: signRes.message,
        raw: signRes.raw
      });

      await randomSleep(2, 5);
    }

    await randomSleep(3, 9);
  }

  console.info(`[${gameName}] 签到流程处理完毕\n`);
  return activeRecorder.records;
};

export { doMYSSign };
