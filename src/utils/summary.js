/**
 * 签到结果统计器与摘要生成器
 */

export class SignRecorder {
  constructor() {
    this.startTime = new Date();
    this.records = [];
    this.missingRequiredConfig = false;
  }

  /**
   * 记录一条签到结果
   * @param {Object} record
   * @param {'MYS' | 'Cloud'} [record.type='MYS']
   * @param {string} record.game 内部游戏标识 (Genshin, StarRail, CloudYS, CloudSR)
   * @param {string} [record.gameName] 游戏中文名称 (原神, 崩坏：星穹铁道, 云·原神, 云·星穹铁道)
   * @param {number} [record.accountIndex=1] 账号索引序号 (1-based)
   * @param {string} [record.nickname='-'] 账号昵称
   * @param {string} [record.uid='-'] 游戏UID
   * @param {'SUCCESS' | 'ALREADY_SIGNED' | 'COOKIE_INVALID' | 'NO_CHARACTER' | 'API_ERROR' | 'SKIPPED'} record.status
   * @param {string} [record.statusText] 状态中文描述
   * @param {string} [record.message=''] 详细说明信息
   * @param {any} [record.raw] 原始返回数据
   */
  addRecord(record) {
    const item = {
      type: record.type || 'MYS',
      game: record.game || '',
      gameName: record.gameName || record.game || '',
      accountIndex: record.accountIndex || 1,
      nickname: record.nickname || '-',
      uid: record.uid ? String(record.uid) : '-',
      status: record.status || 'API_ERROR',
      statusText: record.statusText || '',
      message: record.message || '',
      raw: record.raw || null
    };

    if (!item.statusText) {
      switch (item.status) {
        case 'SUCCESS':
          item.statusText = '签到成功';
          break;
        case 'ALREADY_SIGNED':
          item.statusText = '今日已签到';
          break;
        case 'COOKIE_INVALID':
          item.statusText = 'Cookie失效';
          break;
        case 'NO_CHARACTER':
          item.statusText = '未查询到角色';
          break;
        case 'API_ERROR':
          item.statusText = '接口异常';
          break;
        case 'SKIPPED':
          item.statusText = '未配置跳过';
          break;
        default:
          item.statusText = item.status;
      }
    }

    this.records.push(item);
    return item;
  }

  /**
   * 标记缺失必要配置（例如未提供 MYS_COOKIES）
   */
  markMissingRequiredConfig() {
    this.missingRequiredConfig = true;
  }

  /**
   * 获取结构化汇总结果
   */
  getSummary() {
    let success = 0;
    let alreadySigned = 0;
    let failed = 0;
    let skipped = 0;
    let cookieInvalidCount = 0;

    for (const r of this.records) {
      switch (r.status) {
        case 'SUCCESS':
          success++;
          break;
        case 'ALREADY_SIGNED':
          alreadySigned++;
          break;
        case 'SKIPPED':
          skipped++;
          break;
        case 'COOKIE_INVALID':
          failed++;
          cookieInvalidCount++;
          break;
        case 'NO_CHARACTER':
        case 'API_ERROR':
        default:
          failed++;
          break;
      }
    }

    const nonSkipped = this.records.filter(r => r.status !== 'SKIPPED');
    const total = this.records.length;
    const hasAnySuccess = (success + alreadySigned) > 0;

    // 核心判定规则：
    // 1. 如果发生 Cookie 失效，标记 hasError
    // 2. 如果缺少必需的环境变量凭证，标记 hasError
    // 3. 如果所有非跳过账号全部失败（无任何成功或已签到），标记 hasError
    let hasError = false;
    if (this.missingRequiredConfig) {
      hasError = true;
    } else if (cookieInvalidCount > 0) {
      hasError = true;
    } else if (nonSkipped.length > 0 && !hasAnySuccess) {
      hasError = true;
    }

    return {
      startTime: this.startTime.toISOString(),
      endTime: new Date().toISOString(),
      total,
      success,
      alreadySigned,
      failed,
      skipped,
      cookieInvalidCount,
      hasError,
      records: this.records
    };
  }

  /**
   * 打印格式化的签到汇总报表
   */
  printReport() {
    const summary = this.getSummary();
    console.log('\n' + '='.repeat(64));
    console.log('                    签到任务执行汇总报告');
    console.log('='.repeat(64));

    if (this.records.length === 0) {
      console.log('  未执行任何签到任务。');
    } else {
      this.records.forEach((r, idx) => {
        const num = `[${idx + 1}]`.padEnd(5);
        const game = `[${r.gameName || r.game}]`.padEnd(12);
        const target = r.uid && r.uid !== '-' ? `${r.nickname} (UID: ${r.uid})` : `${r.nickname}`;
        console.log(`${num} ${game} ${target}`);
        console.log(`      状态: ${r.statusText} | 详情: ${r.message}`);
      });
    }

    console.log('-'.repeat(64));
    console.log(`统计: 总计 ${summary.total} | 成功 ${summary.success} | 已签到 ${summary.alreadySigned} | 失败 ${summary.failed} | 跳过 ${summary.skipped}`);
    if (summary.hasError) {
      console.log('结果判定: ❌ 任务存在异常 (存在Cookie失效或全部账号失败，已标记 hasError)');
    } else {
      console.log('结果判定: ✅ 任务正常完成');
    }
    console.log('='.repeat(64) + '\n');
  }
}
