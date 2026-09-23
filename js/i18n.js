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
  noMovesUseShuffle: () => t('No moves — shuffle!', '没路了，快洗牌！'),
  noMovesShuffling: () => t('No moves — shuffling', '没路了，洗牌中'),
  noShufflesLeft: () => t('No shuffles left', '洗牌用完了'),
  newBest: () => t('NEW BEST!', '新纪录！'),

  settings: () => t('Settings', '设置'),
  sound: () => t('Sound', '音效'),
  volume: () => t('Volume', '音量'),
  vibration: () => t('Vibration', '振动'),
  language: () => t('Language', '语言'),
  mode: () => t('Mode', '模式'),
  levelsMode: () => t('Levels', '闯关'),
  challengeMode: () => t('Challenge', '挑战'),
  bigMode: () => t('Big', '超大'),
  levelsHint: () => t('Can’t lose · new twist every 5 levels', '不会输 · 每 5 关一个新玩法'),
  challengeHint: () => t('Limited shuffles · you can lose', '洗牌有限 · 会输'),
  bigHint: () => t('A giant 204-tile board', '204 块超大棋盘'),
  restartLevel: () => t('Restart Level', '重新开始'),
  newGame: () => t('New Game', '新游戏'),
  resume: () => t('Continue', '继续'),
  confirmRestart: () => t('Tap again to restart', '再点一次重新开始'),
  confirmNewGame: () => t('Tap again · counts as a loss', '再点一次 · 算输'),

  keepSafeShort: () => t('Save', '保存'),
  keepSafeTitle: () => t('Keep your progress', '保存你的进度'),
  keepSafeWhy: () => t('Safari deletes saved games after a week. Add it to your Home Screen to keep them.',
    'Safari 会清除一周没打开的游戏记录。添加到主屏幕就能一直保存。'),
  keepSafeSteps: () => [
    t('Tap Share ⬆︎', '点分享 ⬆︎'),
    t('Add to Home Screen', '添加到主屏幕'),
    t('Play from the new icon 💕', '从新图标打开 💕'),
  ],
  keepSafeWeChatWhy: () => t('WeChat can delete saved games. Open it in Safari and add it to your Home Screen.',
    '微信可能会清除游戏记录。在 Safari 打开并添加到主屏幕。'),
  keepSafeWeChatSteps: () => [
    t('Tap ··· (top right)', '点右上角 ···'),
    t('Open in Browser', '在浏览器打开'),
    t('Share ⬆︎ → Add to Home Screen', '分享 ⬆︎ → 添加到主屏幕'),
  ],
  keepSafeOtherSteps: () => [
    t('Open the browser menu', '打开浏览器菜单'),
    t('Add to Home Screen', '添加到主屏幕'),
    t('Play from the new icon 💕', '从新图标打开 💕'),
  ],
  gotIt: () => t('Got it', '知道啦'),

  levelClear: n => t(`Level ${n} Clear!`, `第 ${n} 层 通关！`),
  madeItHome: () => t('She made it home!', '她到家啦！'),
  nextLevel: () => t('Next Level', '下一关'),
  boardCleared: () => t('Board Cleared!', '全部消除！'),
  outOfMoves: () => t('Out of Moves', '无路可走'),
  tilesLeft: n => (n <= 20 ? t(`So close! ${n} left`, `差一点！还剩 ${n} 块`) : t(`${n} tiles left`, `还剩 ${n} 块`)),
  score: () => t('Score', '分数'),
  bestScore: n => t(`Best ${n}`, `最高 ${n}`),
  streak: n => t(`🔥 ${n} wins in a row`, `🔥 连胜 ${n}`),
  record: (w, g) => t(`${w} of ${g} won`, `${g} 局赢 ${w} 局`),
  secondChance: () => t('Second Chance 💕', '再来一次机会 💕'),
  tryAgain: () => t('Try Again', '再玩一次'),
  playAgain: () => t('Play Again', '再来一局'),

  updateShort: () => t('Update', '更新'),
  checking: () => t('Checking…', '正在检查…'),
  updating: v => t(`Updating to v${v}…`, `更新到 v${v}…`),
  upToDate: v => t(`Up to date · v${v}`, `已是最新 · v${v}`),
  updateFailed: () => t('Couldn’t update', '更新失败'),
  version: v => `v${v}`,

  reportShort: () => t('Report', '反馈'),
  reportTitle: () => t('Something wrong?', '有什么问题吗？'),
  reportHint: () => t('Game details are attached. Nothing private.', '会附上游戏信息，不含隐私。'),
  reportPlaceholder: () => t('What happened? 💕', '发生了什么？💕'),
  tagFroze: () => t('Froze', '卡住了'),
  tagSlow: () => t('Slow', '很卡顿'),
  tagSound: () => t('Sound', '声音'),
  tagLooks: () => t('Looks wrong', '显示不对'),
  tagIdea: () => t('Idea 💡', '建议 💡'),
  reportSend: () => t('Send', '发送'),
  reportSending: () => t('Sending…', '正在发送…'),
  reportCancel: () => t('Not now', '先不用'),
  reportSent: () => t('Got it, thank you! 💌', '收到啦，谢谢你！💌'),
  reportQueued: () => t('Copied! Paste it to him in a message 💌', '已复制！发消息粘贴给他 💌'),
  reportShare: () => t('Send in a message', '发送到聊天'),
  reportTooSoon: () => t('Already got that one 💕', '刚刚收到了 💕'),
  reportWaiting: n => t(`${n} waiting to send`, `${n} 条待发送`),

  photoBreak: () => t('Photo Break 💕', '回忆时间 💕'),
  rewardIn: s => t(`Reward in ${s}s`, `${s} 秒后获得奖励`),
  collect: kind => (kind === 'hint' ? t('+3 Hints', '+3 提示') : t('+1 Shuffle', '+1 洗牌')),
  collectShuffles: () => t('+3 Shuffles', '+3 洗牌'),
  noPhotos: () => t('Thinking of you 💕', '想你了 💕'),

  // combos and fever
  fever: () => t('FEVER!', '狂热！'),
  comboPrize: n => t(`${n} combo! +1 💡`, `${n} 连击！+1 💡`),
  thawed: () => t('Ice melted! 🧊', '冰化啦！🧊'),
  gravityToast: a => t(`Gravity ${a}`, `重力 ${a}`),

  // twists
  newTwist: () => t('NEW TWIST', '新玩法'),
  letsGo: () => t('Let’s go!', '出发！'),
  twistTitle: k => ({
    stones: t('Rocks', '石头'), gravity: t('Gravity', '重力'), ice: t('Ice', '冰块'), gifts: t('Gifts', '礼物'),
    mix: t('Double Trouble', '双重挑战'), ice2: t('Thick Ice', '厚冰'),
  })[k] ?? '',
  twistText: k => ({
    stones: t('Rocks never move or clear, and they block paths.', '石头不会动也消不掉，还会挡路。'),
    gravity: t('After each match, tiles fall to fill the gap.', '每次消除后，方块会掉下来填空。'),
    ice: t('Frozen tiles can’t move. Match right next to one to break it.', '冻住的方块不能动。在旁边消除就能敲开。'),
    gifts: t('Wrapped tiles open once a space next to them is free.', '旁边空出来，礼物就会打开。'),
    mix: t('Two twists every level from now on. Good luck! 💪', '从现在起每关两种玩法。加油！💪'),
    ice2: t('Thick ice takes two cracks.', '厚冰要敲两次。'),
  })[k] ?? '',

  // stars and prizes
  goalClear: () => t('Clear the board', '清空棋盘'),
  goalTime: (time, par) => t(`Under ${par}  ·  ${time}`, `${par} 内  ·  ${time}`),
  goalCombo: (best, goal) => t(`⚡${goal} combo  ·  best ${best}`, `⚡${goal} 连击  ·  最高 ${best}`),
  chest: () => t('🎁 Chest!', '🎁 宝箱！'),

  // photo puzzle
  photoUnlocked: () => t('Photo unlocked! 💕', '照片解锁啦！💕'),
  puzzleProgress: n => t(`${n} / 12 pieces`, `${n} / 12 块`),
  puzzleCount: n => t(`${n} / 12 pieces`, `${n} / 12 块`),
  photoUnlockedTitle: () => t('Photo unlocked!', '照片解锁啦！'),
  addedToAlbum: () => t('Added to our album 💕', '已放进我们的相册 💕'),
  tapToContinue: () => t('Tap to continue', '点一下继续'),
  piecesToNext: n => t(`+${n} toward the next photo`, `+${n} 给下一张`),
  albumShort: () => t('Album', '相册'),
  albumTitle: () => t('Our Album 💕', '我们的相册 💕'),

  // an old save meeting the new game for the first time
  welcomeTitle: () => t('Welcome back! 💝', '欢迎回来！💝'),
  welcomeText: () => t('New: rocks, ice, gifts, gravity, stars, Fever, a daily board — and a photo puzzle of us.',
    '新内容：石头、冰块、礼物、重力、星星、狂热、每日挑战 —— 还有我们的照片拼图。'),
  welcomeGift: n => t(`${n} levels cleared — your first photo is ready.`, `已过 ${n} 关 —— 第一张照片送你。`),
  openGift: () => t('Open my gift 🎁', '打开礼物 🎁'),
  albumCount: n => t(`${n} photo${n === 1 ? '' : 's'} unlocked`, `已解锁 ${n} 张照片`),
  albumEmpty: () => t('Your first photo is waiting…', '第一张照片在等你…'),

  // daily board
  dailyMode: () => t('Daily', '每日'),
  dailyHint: () => t('New board every day · stars earn pieces', '每天新棋盘 · 星星换拼图'),
  dailyPill: () => t('📅 Daily', '📅 每日'),
  dailyTitle: () => t('Daily Board', '每日挑战'),
  dailyClear: () => t('Daily Cleared!', '每日挑战完成！'),
  dailyTheme: k => ({
    sweet: t('Sweet Sunday 🍬', '甜蜜周日 🍬'),
    stones: t('Rocky Monday 🪨', '石头周一 🪨'),
    gravity: t('Falling Tuesday ⬇️', '下落周二 ⬇️'),
    ice: t('Frozen Wednesday 🧊', '冰冻周三 🧊'),
    gifts: t('Gift Thursday 🎁', '礼物周四 🎁'),
    duo: t('Double Friday ✌️', '双重周五 ✌️'),
    mix: t('Wild Saturday 🌪️', '疯狂周六 🌪️'),
  })[k] ?? '',
  dailyToast: k => ({
    sweet: t('Sweet Sunday 🍬', '甜蜜周日 🍬'), stones: t('Rocky Monday 🪨', '石头周一 🪨'),
    gravity: t('Falling Tuesday ⬇️', '下落周二 ⬇️'), ice: t('Frozen Wednesday 🧊', '冰冻周三 🧊'),
    gifts: t('Gift Thursday 🎁', '礼物周四 🎁'), duo: t('Double Friday ✌️', '双重周五 ✌️'),
    mix: t('Wild Saturday 🌪️', '疯狂周六 🌪️'),
  })[k] ?? '',
  dailyPitch: () => t('Our shared board · stars earn 🧩', '我们的共同棋盘 · 星星换 🧩'),
  dailyBest: n => (n >= 3 ? t('Perfect! 💕', '完美！💕') : t('Replay for more pieces', '再玩拿更多拼图')),
  dailyStreak: n => t(`🔥 ${n}-day streak`, `🔥 连续 ${n} 天`),
  dailyNoNewStars: n => t('No new stars this time', '这次没有新星星'),
  playDaily: () => t('Play', '开始'),
  tryForMore: () => t('Replay', '再玩一次'),
  backTo: mode => t(`Back to ${({ levels: 'Levels', challenge: 'Challenge', big: 'Big' })[mode] ?? 'Levels'}`,
    `回到${({ levels: '闯关', challenge: '挑战', big: '超大' })[mode] ?? '闯关'}`),
  notNow: () => t('Not now', '先不用'),
};
