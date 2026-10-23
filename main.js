import { doMYSSign } from './src/MYS/index.js';
import { doCloudSign } from './src/MihoyoCloud/index.js';
import { SignRecorder } from './src/utils/summary.js';

let notify;
try {
  const notifyModule = await import('./src/notify.js');
  notify = notifyModule.notify || notifyModule.default;
} catch {
  // 忽略通知模块不存在的情况
}

/**
 * 签到主入口函数
 * @returns {Promise<import('./src/utils/summary.js').SignSummary>} 结构化签到摘要
 */
async function main() {
  const recorder = new SignRecorder();

  // 1. 米游社每日福利签到（原神、星穹铁道）
  await doMYSSign('Genshin', recorder);
  await doMYSSign('StarRail', recorder);

  // 2. 米哈游云游戏每日时长领取（云·原神、云·星穹铁道）
  await doCloudSign('CloudYS', recorder);
  await doCloudSign('CloudSR', recorder);

  // 3. 输出直观的控制台汇总报表
  recorder.printReport();

  // 4. 获取结构化汇总对象
  const summary = recorder.getSummary();

  // 5. 若存在通知模块，将结构化结果分发至通知渠道（PushPlus、Server酱、Telegram、Webhook等）
  if (typeof notify === 'function') {
    try {
      await notify(summary);
    } catch (notifyErr) {
      console.warn('通知渠道推送过程发生异常:', notifyErr.message);
    }
  }

  // 6. 状态检查：若发生 Cookie/Token 失效，或者全部账号任务失败，则标记异常退出码
  if (summary.hasError) {
    console.error('【错误标记】检测到凭证失效或全部账号任务失败，进程退出码标记为 1 (exitCode = 1)。');
    process.exitCode = 1;
  }

  return summary;
}

main().catch((err) => {
  console.error('执行主任务过程中出现未捕获异常:', err);
  process.exitCode = 1;
});

export { main };
