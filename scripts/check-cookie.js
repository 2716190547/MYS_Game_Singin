#!/usr/bin/env node

/**
 * 米游社 Cookie 有效性本地测试脚本
 * 用法：
 * 1. 传参：node scripts/check-cookie.js "account_id=...; cookie_token=...;"
 * 2. 环境变量：MYS_COOKIES="your_cookie" node scripts/check-cookie.js
 */

import axios from 'axios';
import md5 from 'md5';
import { v4 } from 'uuid';

const cookieInput = process.argv[2] || process.env.MYS_COOKIES;

if (!cookieInput) {
  console.log(`
使用方法:
  node scripts/check-cookie.js "你的米游社Cookie"
  或:
  MYS_COOKIES="你的米游社Cookie" node scripts/check-cookie.js

Cookie 获取指引:
  1. 浏览器打开 https://www.miyoushe.com/ys/ 并登录
  2. 按 F12 打开开发者工具，切换到 Console (控制台)
  3. 输入 document.cookie 并回车，复制输出的字符串 (确保包含 account_id 和 cookie_token)
  4. 运行本脚本验证有效性
`);
  process.exit(1);
}

const WEB_HOST = 'api-takumi.mihoyo.com';
const APP_VERSION = '2.81.1';

async function getDS() {
  const s = 'yUZ3s0Sna1IrSNfk29Vo6vRapdOyqyhB';
  const t = Math.floor(Date.now() / 1e3);
  const r = Math.random().toString(36).slice(-6);
  const c = `salt=${s}&t=${t}&r=${r}`;
  return `${t},${r},${md5(c)}`;
}

async function checkGame(gameName, gameBiz, cookie) {
  const ds = await getDS();
  const headers = {
    Host: WEB_HOST,
    Cookie: cookie,
    DS: ds,
    'User-Agent': `Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) miHoYoBBS/${APP_VERSION}`,
    'x-rpc-app_version': APP_VERSION,
    'x-rpc-client_type': 5,
    Referer: 'https://webstatic.mihoyo.com/',
    'x-rpc-device_id': v4(),
    Origin: 'https://webstatic.mihoyo.com',
    Accept: 'application/json, text/plain, */*'
  };

  try {
    const res = await axios.get(`https://${WEB_HOST}/binding/api/getUserGameRolesByCookie?game_biz=${gameBiz}`, {
      headers,
      timeout: 10000
    });

    if (res.data?.retcode === 0 && res.data?.data?.list?.length) {
      console.log(`✅ [${gameName}] 验证成功！`);
      for (const role of res.data.data.list) {
        console.log(`   - 昵称: ${role.nickname} | UID: ${role.game_uid} | 等级: Lv.${role.level} | 区服: ${role.region_name}`);
      }
      return true;
    } else if (res.data?.retcode === 0) {
      console.log(`ℹ️ [${gameName}] Cookie 有效，但未绑定任何角色`);
      return true;
    } else {
      console.error(`❌ [${gameName}] 验证失败: [${res.data?.retcode}] ${res.data?.message}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ [${gameName}] 网络或请求错误: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('正在验证 Cookie 有效性...\n');
  const genshinOk = await checkGame('原神', 'hk4e_cn', cookieInput);
  const starRailOk = await checkGame('崩坏：星穹铁道', 'hkrpg_cn', cookieInput);

  if (genshinOk || starRailOk) {
    console.log('\n🎉 Cookie 校验通过！你可以放心地将其更新到 GitHub 仓库 Secrets (MYS_COOKIES) 中。');
  } else {
    console.log('\n⚠️ Cookie 校验未通过，请检查是否已在米游社登录、或是否复制完整。');
    process.exit(1);
  }
}

main();
