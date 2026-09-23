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
  bigMode: () => t('Big', '超大'),
  levelsHint: () => t('Can’t lose — a new twist every 5 levels, and stars to earn', '不会输 —— 每 5 关一个新玩法，还有星星可拿'),
  challengeHint: () => t('Limited shuffles — you can lose', '洗牌有限，可能会输'),
  bigHint: () => t('Levels on a giant board of 204 tiles', '204 块的超大棋盘闯关'),
  restartLevel: () => t('Restart Level', '重新开始'),
  newGame: () => t('New Game', '新游戏'),
  resume: () => t('Continue', '继续'),
  confirmRestart: () => t('Tap again to restart', '再点一次重新开始'),
  confirmNewGame: () => t('Tap again — this game counts as a loss', '再点一次 —— 本局算输'),

  keepSafeShort: () => t('Save', '保存'),
  keepSafeTitle: () => t('Keep your progress', '保存你的进度'),
  keepSafeWhy: () => t('Safari clears a website’s saved games if it isn’t opened for a week. Add Tile Match to your Home Screen and your level, scores and streak are kept for good — they come with you.',
    'Safari 会清除一周没打开的网站的游戏记录。把游戏添加到主屏幕，你的关卡、分数和连胜就会一直保存 —— 现在的进度也会一起带过去。'),
  keepSafeSteps: () => [
    t('Tap the Share button ⬆︎ in Safari', '在 Safari 里点分享按钮 ⬆︎'),
    t('Choose “Add to Home Screen”', '选择“添加到主屏幕”'),
    t('Play from the new icon 💕', '以后从新图标打开 💕'),
  ],
  keepSafeWeChatWhy: () => t('WeChat can clear saved games. Open Tile Match in Safari and add it to your Home Screen to keep your level, scores and streak for good — your progress comes with you.',
    '微信可能会清除游戏记录。在 Safari 里打开，再添加到主屏幕，关卡、分数和连胜就会一直保存 —— 现在的进度也会一起带过去。'),
  keepSafeWeChatSteps: () => [
    t('Tap ··· at the top right', '点右上角的 ···'),
    t('Choose “Open in Browser”', '选择“在浏览器打开”'),
    t('In Safari: Share ⬆︎ → “Add to Home Screen”', '在 Safari 里：分享 ⬆︎ → “添加到主屏幕”'),
  ],
  keepSafeOtherSteps: () => [
    t('Open the browser menu', '打开浏览器菜单'),
    t('Choose “Add to Home Screen”', '选择“添加到主屏幕”'),
    t('Play from the new icon 💕', '以后从新图标打开 💕'),
  ],
  gotIt: () => t('Got it', '知道啦'),

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

  updateShort: () => t('Update', '更新'),
  checking: () => t('Checking…', '正在检查…'),
  updating: v => t(`Updating to v${v}…`, `正在更新到 v${v}…`),
  upToDate: v => t(`Up to date (v${v}) ✓`, `已是最新版 (v${v}) ✓`),
  updateFailed: () => t('Couldn\u2019t update — check the connection', '更新失败，请检查网络'),
  version: v => t(`Version ${v}`, `版本 ${v}`),

  reportShort: () => t('Report', '反馈'),
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

  // combos and fever
  fever: () => t('FEVER!', '狂热！'),
  comboPrize: n => t(`${n} in a row! +1 💡`, `${n} 连击！+1 💡`),
  thawed: () => t('Stuck — the ice melts! 🧊', '卡住了 —— 冰化啦！🧊'),
  gravityToast: a => t(`Gravity ${a}`, `重力 ${a}`),

  // twists
  newTwist: () => t('NEW TWIST', '新玩法'),
  letsGo: () => t('Let’s go!', '出发！'),
  twistTitle: k => ({
    stones: t('Rocks', '石头'), gravity: t('Gravity', '重力'), ice: t('Ice', '冰块'), gifts: t('Gifts', '礼物'),
    mix: t('Double Trouble', '双重挑战'), ice2: t('Thick Ice', '厚冰'),
  })[k] ?? '',
  twistText: k => ({
    stones: t('Rocks never move and never clear. They block the line between twins and stop every slide — plan your way around them.',
      '石头不会动，也消不掉。它们会挡住视线、拦住滑动 —— 要绕着它们想办法。'),
    gravity: t('After every match the tiles fall down to fill the gap. The board keeps changing — look again after each clear!',
      '每次消除后，上面的方块会掉下来填空。棋盘一直在变 —— 每消一次都要重新看看！'),
    ice: t('Frozen tiles can’t move or match, and they block slides. Clear a pair right next to one to crack it free.',
      '冻住的方块不能动也不能消，还会挡住滑动。在它旁边消掉一对就能把冰敲开。'),
    gifts: t('Wrapped tiles hide their picture. They open as soon as a space next to them is empty.',
      '包起来的方块看不到图案。旁边一空出来，它就会打开。'),
    mix: t('From here on every level brings two twists at once, a different pair each time — and it keeps getting harder. Good luck! 💪',
      '从这里开始，每一关都会同时出现两种玩法，每次搭配都不一样 —— 而且越来越难。加油！💪'),
    ice2: t('Some ice is thick now: it takes two cracks to break.', '有些冰变厚了：要敲两次才会碎。'),
  })[k] ?? '',

  // stars and prizes
  goalClear: () => t('Clear the board', '清空棋盘'),
  goalTime: (time, par) => t(`Beat the clock  ${time} / ${par}`, `打败时间  ${time} / ${par}`),
  goalCombo: (best, goal) => t(`Reach a ⚡${goal} combo  (best ${best})`, `达到 ⚡${goal} 连击（最高 ${best}）`),
  chest: () => t('🎁 Chapter chest!', '🎁 章节宝箱！'),

  // photo puzzle
  photoUnlocked: () => t('Photo unlocked! 💕 See it in the Album', '照片解锁啦！💕 去相册看看'),
  puzzleProgress: n => t(`Photo puzzle: ${n} / 12 pieces`, `照片拼图：${n} / 12 块`),
  puzzleCount: n => t(`${n} / 12 pieces`, `${n} / 12 块`),
  photoUnlockedTitle: () => t('Photo unlocked!', '照片解锁啦！'),
  addedToAlbum: () => t('Added to our album 💕', '已放进我们的相册 💕'),
  tapToContinue: () => t('Tap to continue', '点一下继续'),
  piecesToNext: n => t(`+${n} toward the next photo`, `下一张照片 +${n} 块`),
  albumShort: () => t('Album', '相册'),
  albumTitle: () => t('Our Album 💕', '我们的相册 💕'),
  albumHint: () => t('Clear levels and daily boards to collect pieces. Twelve pieces unlock a photo.',
    '通关和每日挑战都能收集拼图，集齐 12 块就能解锁一张照片。'),

  // an old save meeting the new game for the first time
  welcomeTitle: () => t('Welcome back! 💝', '欢迎回来！💝'),
  welcomeText: () => t('The game grew while you were away: rocks, ice, gifts and gravity to beat, three stars on every level, Fever combos, a daily board — and a photo puzzle of us.',
    '你不在的时候，游戏长大了：石头、冰块、礼物和重力，每关三颗星，狂热连击，每日挑战 —— 还有我们的照片拼图。'),
  welcomeGift: n => t(`You’ve already cleared ${n} levels, so your first photo is ready right now.`,
    `你已经通过了 ${n} 关，所以第一张照片现在就送给你。`),
  welcomeRefresher: () => t('Your next eight levels are a quick tour of the new twists, then it gets tough.',
    '接下来八关会带你快速体验新玩法，之后就会越来越难。'),
  openGift: () => t('Open my gift 🎁', '打开礼物 🎁'),
  albumCount: n => t(`${n} photo${n === 1 ? '' : 's'} unlocked`, `已解锁 ${n} 张照片`),
  albumEmpty: () => t('Your first photo is waiting…', '第一张照片在等你…'),

  // daily board
  dailyMode: () => t('Daily', '每日'),
  dailyHint: () => t('A new board every day — each star earns a puzzle piece', '每天一个新棋盘 —— 每颗星换一块拼图'),
  dailyPill: () => t('📅 Daily', '📅 每日'),
  dailyTitle: () => t('Daily Board', '每日挑战'),
  dailyClear: () => t('Daily Cleared!', '每日挑战完成！'),
  dailyTheme: k => ({
    sweet: t('Sweet Sunday 🍬 — chase a big combo', '甜蜜周日 🍬 —— 冲个大连击'),
    stones: t('Rocky Monday 🪨', '石头周一 🪨'),
    gravity: t('Falling Tuesday ⬇️', '下落周二 ⬇️'),
    ice: t('Frozen Wednesday 🧊', '冰冻周三 🧊'),
    gifts: t('Gift Thursday 🎁', '礼物周四 🎁'),
    duo: t('Double Friday ✌️ — two twists at once', '双重周五 ✌️ —— 两种玩法一起来'),
    mix: t('Wild Saturday 🌪️', '疯狂周六 🌪️'),
  })[k] ?? '',
  dailyToast: k => ({
    sweet: t('Sweet Sunday 🍬', '甜蜜周日 🍬'), stones: t('Rocky Monday 🪨', '石头周一 🪨'),
    gravity: t('Falling Tuesday ⬇️', '下落周二 ⬇️'), ice: t('Frozen Wednesday 🧊', '冰冻周三 🧊'),
    gifts: t('Gift Thursday 🎁', '礼物周四 🎁'), duo: t('Double Friday ✌️', '双重周五 ✌️'),
    mix: t('Wild Saturday 🌪️', '疯狂周六 🌪️'),
  })[k] ?? '',
  dailyPitch: () => t('Same board for both of us today. Every star earns a 🧩 puzzle piece!',
    '今天我们俩是同一个棋盘。每颗星都能换一块 🧩 拼图！'),
  dailyBest: n => (n >= 3 ? t('All 3 stars today — perfect! 💕', '今天三颗星全拿到啦 —— 完美！💕')
    : t(`Best today: ${n} ★ — replay for more pieces`, `今天最好：${n} ★ —— 再玩一次拿更多拼图`)),
  dailyStreak: n => t(`🔥 ${n} day${n === 1 ? '' : 's'} in a row`, `🔥 连续 ${n} 天`),
  dailyNoNewStars: n => t(`No new stars — your best today is ${n} ★`, `没有新的星星 —— 今天最好是 ${n} ★`),
  playDaily: () => t('Play Today’s Board', '开始今日挑战'),
  tryForMore: () => t('Try for More Stars', '再挑战更多星星'),
  backTo: mode => t(`Back to ${({ levels: 'Levels', challenge: 'Challenge', big: 'Big' })[mode] ?? 'Levels'}`,
    `回到${({ levels: '闯关', challenge: '挑战', big: '超大' })[mode] ?? '闯关'}`),
  notNow: () => t('Not now', '先不用'),
};
