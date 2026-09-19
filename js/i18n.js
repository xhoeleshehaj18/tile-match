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

  photoBreak: () => t('Photo Break 💕', '回忆时间 💕'),
  rewardIn: s => t(`Reward in ${s}s`, `${s} 秒后获得奖励`),
  collect: kind => (kind === 'hint' ? t('Collect +3 Hints', '领取 +3 提示') : t('Collect Shuffle', '领取洗牌')),
  collectShuffles: () => t('Collect +3 Shuffles', '领取 +3 洗牌'),
  noPhotos: () => t('Thinking of you 💕', '想你了 💕'),
};
