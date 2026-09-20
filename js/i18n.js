// English / Chinese strings. Chinese wording follows the original game (第 N 层, 连击).

let chinese = (() => {
  const saved = localStorage.getItem('chinese');
  if (saved !== null) return saved === 'true';
  return (navigator.language || '').toLowerCase().startsWith('zh');
})();

export const isChinese = () => chinese;
export function setChinese(on) {
  chinese = on;
  localStorage.setItem('chinese', on);
  document.documentElement.lang = on ? 'zh' : 'en';
}

const t = (en, zh) => (chinese ? zh : en);

export const L = {
  level: n => t(`Level ${n}`, `第 ${n} 层`),
  combo: () => t(' Combo', '连击'),
  best: n => t(`Best ${n}`, `最高 ${n}`),
  noMovesUseShuffle: () => t('No moves left — use your shuffle!', '没有可消除的了，快用洗牌！'),
  noMovesShuffling: () => t('No moves left — shuffling!', '没有可消除的了，重新洗牌！'),
  noShufflesLeft: () => t('No shuffles left!', '洗牌用完了！'),
  newBest: () => t('NEW BEST!', '新纪录！'),

  settings: () => t('Settings', '设置'),
  sound: () => t('Sound', '音效'),
  volume: () => t('Volume', '音量'),
  vibration: () => t('Vibration', '振动'),
  language: () => t('Language', '语言'),
  mode: () => t('Mode', '模式'),
  levelsMode: () => t('Levels', '闯关'),
  challengeMode: () => t('Challenge', '挑战'),
  modeHint: () => t('Levels: can’t lose, gets harder. Challenge: limited shuffles, you can lose.',
    '闯关：不会输，越来越难。挑战：洗牌有限，可能会输。'),
  restartLevel: () => t('Restart Level', '重新开始'),
  newGame: () => t('New Game', '新游戏'),
  resume: () => t('Continue', '继续'),

  levelClear: n => t(`Level ${n} Clear!`, `第 ${n} 层 通关！`),
  madeItHome: () => t('She made it home!', '她到家啦！'),
  nextLevel: () => t('Next Level', '下一关'),
  boardCleared: () => t('Board Cleared!', '全部消除！'),
  outOfMoves: () => t('Out of Moves', '无路可走'),
  tilesLeft: n => (n <= 20 ? t(`So close! Only ${n} tiles left`, `差一点！只剩 ${n} 块`) : t(`${n} tiles left`, `还剩 ${n} 块`)),
  score: () => t('Score', '分数'),
  bestScore: n => t(`Best: ${n}`, `最高分：${n}`),
  streak: n => t(`Win streak 🔥 ${n}`, `连胜 🔥 ${n}`),
  record: (w, g) => t(`Won ${w} of ${g} games`, `${g} 局赢了 ${w} 局`),
  secondChance: () => t('Second Chance 💕', '再来一次机会 💕'),
  tryAgain: () => t('Try Again', '再玩一次'),
  playAgain: () => t('Play Again', '再来一局'),

  checkUpdates: () => t('Check for updates', '检查更新'),
  checking: () => t('Checking…', '正在检查…'),
  updating: v => t(`Updating to v${v}…`, `正在更新到 v${v}…`),
  upToDate: v => t(`Up to date (v${v}) ✓`, `已是最新版 (v${v}) ✓`),
  updateFailed: () => t('Couldn\u2019t update — check the connection and try again', '更新失败，请检查网络后重试'),
  version: v => t(`Version ${v}`, `版本 ${v}`),

  reportBug: () => t('Report a problem 🐞', '反馈问题 🐞'),
  reportTitle: () => t('Something wrong?', '有什么问题吗？'),
  reportHint: () => t('Tell me what happened and I’ll fix it. Game details are attached automatically — no photos, nothing private.',
    '告诉我发生了什么，我来修。会自动附上游戏信息 —— 不含照片，也不含隐私。'),
  reportPlaceholder: () => t('What happened? Wishes welcome too 💕', '发生了什么？想要什么功能也可以说 💕'),
  tagFroze: () => t('Froze', '卡住了'),
  tagSlow: () => t('Slow', '很卡顿'),
  tagSound: () => t('Sound', '声音'),
  tagLooks: () => t('Looks wrong', '显示不对'),
  tagIdea: () => t('Idea 💡', '建议 💡'),
  reportSend: () => t('Send', '发送'),
  reportSending: () => t('Sending…', '正在发送…'),
  reportCancel: () => t('Not now', '先不用'),
  reportSent: () => t('Got it 💌 thank you!', '收到啦 💌 谢谢你！'),
  reportQueued: () => t('Copied! Couldn’t reach him — paste it to him in a message 💌',
    '已复制！网络没连上 —— 发消息粘贴给他就好 💌'),
  reportShare: () => t('Send it in a message', '发送到聊天'),
  reportTooSoon: () => t('Already got that one — give it a minute 💕', '刚刚已经收到了 —— 稍等一下 💕'),
  reportWaiting: n => t(`${n} report${n > 1 ? 's' : ''} still waiting to send`, `还有 ${n} 条反馈没发出去`),

  photoBreak: () => t('Photo Break 💕', '回忆时间 💕'),
  rewardIn: s => t(`Reward in ${s}s`, `${s} 秒后获得奖励`),
  collect: kind => (kind === 'hint' ? t('Collect +3 Hints', '领取 +3 提示') : t('Collect Shuffle', '领取洗牌')),
  collectShuffles: () => t('Collect +3 Shuffles', '领取 +3 洗牌'),
  noPhotos: () => t('Thinking of you 💕', '想你了 💕'),
};
