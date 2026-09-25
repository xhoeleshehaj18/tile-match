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
  turnUpright: () => t('Turn your phone upright to play', '把手机竖过来玩吧'),

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
    t('Tap Share {share}', '点分享 {share}'),
    t('Add to Home Screen', '添加到主屏幕'),
    t('Play from the new icon {hearts}', '从新图标打开 {hearts}'),
  ],
  keepSafeWeChatWhy: () => t('WeChat can delete saved games. Open it in Safari and add it to your Home Screen.',
    '微信可能会清除游戏记录。在 Safari 打开并添加到主屏幕。'),
  keepSafeWeChatSteps: () => [
    t('Tap ··· (top right)', '点右上角 ···'),
    t('Open in Browser', '在浏览器打开'),
    t('Share {share} → Add to Home Screen', '分享 {share} → 添加到主屏幕'),
  ],
  keepSafeOtherSteps: () => [
    t('Open the browser menu', '打开浏览器菜单'),
    t('Add to Home Screen', '添加到主屏幕'),
    t('Play from the new icon {hearts}', '从新图标打开 {hearts}'),
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
  streak: n => t(`{flame} ${n} wins in a row`, `{flame} 连胜 ${n}`),
  record: (w, g) => t(`${w} of ${g} won`, `${g} 局赢 ${w} 局`),
  secondChance: () => t('Second Chance {hearts}', '再来一次机会 {hearts}'),
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
  reportPlaceholder: () => t('What happened?', '发生了什么？'),
  tagFroze: () => t('Froze', '卡住了'),
  tagSlow: () => t('Slow', '很卡顿'),
  tagSound: () => t('Sound', '声音'),
  tagLooks: () => t('Looks wrong', '显示不对'),
  tagIdea: () => t('Idea {bulb}', '建议 {bulb}'),
  reportSend: () => t('Send', '发送'),
  reportSending: () => t('Sending…', '正在发送…'),
  reportCancel: () => t('Not now', '先不用'),
  reportSent: () => t('Got it, thank you! {envelope}', '收到啦，谢谢你！{envelope}'),
  reportQueued: () => t('Copied! Paste it to him in a message {envelope}', '已复制！发消息粘贴给他 {envelope}'),
  reportShare: () => t('Send in a message', '发送到聊天'),
  reportTooSoon: () => t('Already got that one {hearts}', '刚刚收到了 {hearts}'),
  reportWaiting: n => t(`${n} waiting to send`, `${n} 条待发送`),

  photoBreak: () => t('Photo Break {hearts}', '回忆时间 {hearts}'),
  rewardIn: s => t(`Reward in ${s}s`, `${s} 秒后获得奖励`),
  collect: kind => (kind === 'hint' ? t('+3 Hints', '+3 提示') : t('+1 Shuffle', '+1 洗牌')),
  collectShuffles: () => t('+3 Shuffles', '+3 洗牌'),
  noPhotos: () => t('Thinking of you {hearts}', '想你了 {hearts}'),

  // combos and fever
  fever: () => t('FEVER!', '狂热！'),
  comboPrize: n => t(`${n} combo! +1 {bulb}`, `${n} 连击！+1 {bulb}`),
  thawed: () => t('Ice melted! {ice}', '冰化啦！{ice}'),
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
    mix: t('Two twists every level from now on. Good luck! {sparkle}', '从现在起每关两种玩法。加油！{sparkle}'),
    ice2: t('Thick ice takes two cracks.', '厚冰要敲两次。'),
  })[k] ?? '',

  // stars and prizes
  goalClear: () => t('Clear the board', '清空棋盘'),
  goalTime: (time, par) => t(`Under ${par}  ·  ${time}`, `${par} 内  ·  ${time}`),
  goalCombo: (best, goal) => t(`{bolt}${goal} combo  ·  best ${best}`, `{bolt}${goal} 连击  ·  最高 ${best}`),
  chest: () => t('{gift} Chest!', '{gift} 宝箱！'),

  // photo puzzle
  photoUnlocked: () => t('Photo unlocked! {hearts}', '照片解锁啦！{hearts}'),
  puzzleProgress: n => t(`${n} / 12 pieces`, `${n} / 12 块`),
  puzzleCount: n => t(`${n} / 12 pieces`, `${n} / 12 块`),
  photoUnlockedTitle: () => t('Photo unlocked!', '照片解锁啦！'),
  addedToAlbum: () => t('Added to our album {hearts}', '已放进我们的相册 {hearts}'),
  tapToContinue: () => t('Tap to continue', '点一下继续'),
  piecesToNext: n => t(`+${n} toward the next photo`, `+${n} 给下一张`),
  albumShort: () => t('Album', '相册'),
  albumTitle: () => t('Our Album {hearts}', '我们的相册 {hearts}'),

  // an old save meeting the new game for the first time
  welcomeTitle: () => t('Welcome back! {heart}', '欢迎回来！{heart}'),
  welcomeText: () => t('New: rocks, ice, gifts, gravity, stars, Fever, a daily board — and a photo puzzle of us.',
    '新内容：石头、冰块、礼物、重力、星星、狂热、每日挑战 —— 还有我们的照片拼图。'),
  welcomeGift: n => t(`${n} levels cleared — your first photo is ready.`, `已过 ${n} 关 —— 第一张照片送你。`),
  openGift: () => t('Open my gift {gift}', '打开礼物 {gift}'),
  albumCount: n => t(`${n} photo${n === 1 ? '' : 's'} unlocked`, `已解锁 ${n} 张照片`),
  albumEmpty: () => t('Your first photo is waiting…', '第一张照片在等你…'),

  // daily board
  dailyMode: () => t('Daily', '每日'),
  dailyHint: () => t('New board every day · stars earn pieces', '每天新棋盘 · 星星换拼图'),
  dailyPill: () => t('{calendar}Daily', '{calendar}每日'),
  dailyTitle: () => t('Daily Board', '每日挑战'),
  dailyClear: () => t('Daily Cleared!', '每日挑战完成！'),
  dailyTheme: k => ({
    sweet: t('Sweet Sunday {candy}', '甜蜜周日 {candy}'), stones: t('Rocky Monday {rock}', '石头周一 {rock}'),
    gravity: t('Falling Tuesday {arrowDown}', '下落周二 {arrowDown}'), ice: t('Frozen Wednesday {ice}', '冰冻周三 {ice}'),
    gifts: t('Gift Thursday {gift}', '礼物周四 {gift}'), duo: t('Double Friday {duo}', '双重周五 {duo}'),
    mix: t('Wild Saturday {twister}', '疯狂周六 {twister}'),
  })[k] ?? '',
  dailyToast: k => L.dailyTheme(k),
  dailyPitch: () => t('Our shared board · stars earn {puzzle}', '我们的共同棋盘 · 星星换 {puzzle}'),
  dailyBest: n => (n >= 3 ? t('Perfect! {hearts}', '完美！{hearts}') : t('Replay for more pieces', '再玩拿更多拼图')),
  dailyStreak: n => t(`{flame} ${n}-day streak`, `{flame} 连续 ${n} 天`),
  dailyNoNewStars: n => t('No new stars this time', '这次没有新星星'),
  playDaily: () => t('Play', '开始'),
  tryForMore: () => t('Replay', '再玩一次'),
  backTo: mode => t(`Back to ${({ levels: 'Levels', challenge: 'Challenge', big: 'Big' })[mode] ?? 'Levels'}`,
    `回到${({ levels: '闯关', challenge: '挑战', big: '超大' })[mode] ?? '闯关'}`),
  notNow: () => t('Not now', '先不用'),

  // the menu
  tab: k => ({
    play: t('Play', '游戏'), shop: t('Shop', '商店'), album: t('Album', '相册'), settings: t('Settings', '设置'),
  })[k] ?? '',
  paused: () => t('Paused', '暂停中'),
  close: () => t('Close', '关闭'),
  modeIcon: m => ({ levels: 'scooter', daily: 'calendar', challenge: 'trophy', big: 'elephant' })[m] ?? 'gamepad',
  modeName: m => ({ levels: L.levelsMode(), daily: L.dailyMode(), challenge: L.challengeMode(), big: L.bigMode() })[m] ?? '',
  modeHint: m => ({
    levels: t('New twist every 5 levels', '每 5 关一个新玩法'),
    daily: t('A new board every day', '每天一个新棋盘'),
    challenge: t('Chase a high score', '冲击最高分'),
    big: t('A giant 204-tile board', '204 块超大棋盘'),
  })[m] ?? '',
  youAreOn: m => t(`Playing ${L.modeName(m)}`, `正在玩：${L.modeName(m)}`),

  // the shop
  riders: () => t('Riders', '骑手'),
  trails: () => t('Trails', '尾迹'),
  useThis: () => t('Use this', '使用'),
  inUse: () => t('In use {check}', '使用中 {check}'),
  buy: () => t('Buy', '购买'),
  needMore: (n, lv) => t(`${n} more · about ${lv} level${lv === 1 ? '' : 's'}`, `还差 ${n} · 大约 ${lv} 关`),
  legendary: () => t('LEGENDARY', '传说'),
  yours: () => t('Yours! {hearts}', '归你啦！{hearts}'),
  itemName: (kind, id) => ({
    girl: t('Scooter Girl', '滑板车女孩'), bunny: t('Bunny', '小兔'), capy: t('Capybara', '卡皮巴拉'),
    kitty: t('Kitty', '小猫'), penguin: t('Penguin', '企鹅'), panda: t('Panda', '熊猫'), unicorn: t('Unicorn', '独角兽'),
    none: t('No trail', '无尾迹'), hearts: t('Hearts', '爱心'), sparkles: t('Sparkles', '闪闪'), bubbles: t('Bubbles', '泡泡'),
    petals: t('Petals', '花瓣'), notes: t('Music', '音符'), rainbow: t('Rainbow', '彩虹'),
  })[id] ?? id,
  itemText: (kind, id) => ({
    girl: t('The original. Cap on, off she goes!', '最初的她。戴好帽子，出发！'),
    bunny: t('Bow on, ears up — until she gets excited.', '戴着蝴蝶结，一兴奋耳朵就耷拉下来。'),
    capy: t('Unbothered. Moisturized. Yuzu on head. {yuzu}', '淡定，滋润，头顶柚子。{yuzu}'),
    kitty: t('Jingle-bell collar and a very busy tail.', '小铃铛项圈，尾巴忙个不停。'),
    penguin: t('Faster than waddling. Scarf knitted with love.', '比摇摇摆摆快多啦。围巾是用爱织的。'),
    panda: t('Growing a little bamboo sprout, for a snack later.', '头上长了棵小竹笋，留着当零食。'),
    unicorn: t('Rainbow mane, golden horn, pure sparkle.', '彩虹鬃毛，金色独角，闪闪发光。'),
    none: t('Just the open road.', '只有路和风。'),
    hearts: t('Leaves a little love everywhere she goes.', '走到哪里，爱就留到哪里。'),
    sparkles: t('Twinkle, twinkle, little scooter.', '一闪一闪亮晶晶。'),
    bubbles: t('Pop. Pop. Pop.', '啵，啵，啵。'),
    petals: t('Spring on wheels.', '带着春天出发。'),
    notes: t('Humming a happy song on the way home.', '一路哼着开心的歌回家。'),
    rainbow: t('Paints the whole road in every colour.', '把整条路都涂成彩虹色。'),
  })[id] ?? '',
  coinReason: k => ({
    clear: t('Clear', '通关'), stars: t('Stars', '星星'), combo: t('Combo', '连击'), fever: t('Fever', '狂热'),
    depth: t('Level', '关卡'), chest: t('Chest', '宝箱'), big: t('Big', '超大'), newStars: t('New stars', '新星星'),
    streak: t('Streak', '连续'), score: t('Score', '分数'),
  })[k] ?? k,

  // the shop opening
  shopOpenTitle: () => t('The shop is open!', '商店开张啦！'),
  shopOpenText: () => t('Cute riders and trails for the scooter, paid for with coins from every level.',
    '用每关赚到的金币，给滑板车换上可爱的骑手和尾迹。'),
  shopGift: () => t('A little something to start with:', '先送你一点点：'),
  takeALook: () => t('Take a look {bag}', '去看看 {bag}'),
  later: () => t('Later', '等会儿'),
};
