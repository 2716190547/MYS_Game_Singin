/**
 * 环境变量解析与凭证配置读取工具
 */

/**
 * 清除单个凭证的前后空白、多余分隔符及可能包含的外层单/双引号
 * @param {string} token 
 * @returns {string}
 */
export function cleanToken(token) {
  if (typeof token !== 'string') return '';
  let str = token.trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
  while (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    str = str.slice(1, -1).trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
  }
  return str.trim();
}

/**
 * 解析支持多种分隔符（换行符、逗号、分号）的多账号凭证字符串
 * 针对 Cookie 内部可能自带分号的特性进行了智能处理，支持混合格式
 * 
 * @param {string} rawStr 
 * @returns {string[]}
 */
export function parseConfigList(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return [];
  let content = rawStr.trim();
  if (!content) return [];

  // 若整个字符串仅由单一外层引号包裹，先剥离外层引号
  if (
    (content.startsWith('"') && content.endsWith('"') && (content.match(/"/g) || []).length === 2) ||
    (content.startsWith("'") && content.endsWith("'") && (content.match(/'/g) || []).length === 2)
  ) {
    content = content.slice(1, -1).trim();
  }

  // 1. 优先按换行符切分
  const rawLines = content.split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);

  // 2. 对每行处理双分号或引号外的分号（如 "c1"; "c2" 或 c1;;c2）
  const lineParts = [];
  for (const line of rawLines) {
    const semiParts = line
      .split(/(?<=["'])\s*;\s*(?=["'])|;;+/)
      .map(s => s.trim())
      .filter(Boolean);
    lineParts.push(...semiParts);
  }

  // 3. 按逗号进一步拆分（RFC Cookie 规范中值不含逗号，逗号作为账号分隔符极其可靠）
  const commaParts = [];
  for (const part of lineParts) {
    const sub = part.split(',').map(cleanToken).filter(Boolean);
    commaParts.push(...sub);
  }

  // 4. 针对无引号单行内的重复凭证关键字段或纯 Token 分号列表进行拆分
  const result = [];
  for (const item of commaParts) {
    const cleaned = cleanToken(item);
    if (!cleaned) continue;

    // 检测同一字符串内是否包含多个米游社账号特征键
    const accountIdCount = (cleaned.match(/account_id\s*=/g) || []).length;
    const cookieTokenCount = (cleaned.match(/cookie_token\s*=/g) || []).length;
    const ltuidCount = (cleaned.match(/ltuid\s*=/g) || []).length;
    const comboTokenCount = (cleaned.match(/ai\s*=/g) || []).length;

    if (accountIdCount > 1 || cookieTokenCount > 1 || ltuidCount > 1) {
      const parts = cleaned.split(/(?=account_id\s*=|ltuid\s*=)/g).map(cleanToken).filter(Boolean);
      result.push(...parts);
      continue;
    }

    if (comboTokenCount > 1) {
      const parts = cleaned.split(/(?=ai\s*=)/g).map(cleanToken).filter(Boolean);
      result.push(...parts);
      continue;
    }

    // 纯 Token 列表且含分号（例如 token1; token2）
    if (!cleaned.includes('=') && cleaned.includes(';')) {
      const parts = cleaned.split(';').map(cleanToken).filter(Boolean);
      result.push(...parts);
      continue;
    }

    result.push(cleaned);
  }

  return result.filter(Boolean);
}

/**
 * 获取米游社多账号 Cookie 配置
 * @returns {Promise<{ Genshin: string[], StarRail: string[] }>}
 */
export const getCookieConfig = async () => {
  const rawCookies = process.env.MYS_COOKIES || process.env.GENSHIN_COOKIES;
  const cookieList = parseConfigList(rawCookies);
  return { Genshin: cookieList, StarRail: cookieList };
};

/**
 * 获取云游戏凭证配置（原神与星穹铁道）
 * @returns {Promise<{ CloudYS: string[], CloudSR: string[] }>}
 */
export const getTokenConfig = async () => {
  const genshinTokens = process.env.GENSHIN_TOKENS;
  const starRailTokens = process.env.STARRAIL_TOKENS;

  const genshinTokenArr = parseConfigList(genshinTokens);
  const starRailTokenArr = parseConfigList(starRailTokens);

  return { CloudYS: genshinTokenArr, CloudSR: starRailTokenArr };
};
