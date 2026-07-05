const STORAGE_KEY = "kids-learn-card-camp-state-v1";
const PACK_COST = 6;
const DECK_LIMIT = 12;
const TODAY_GOAL = 5;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const app = {
  view: "base",
  cardTab: "pack",
  filters: { faction: "全部", rarity: "全部", cost: "全部", owned: "全部" },
  round: null,
  _pushingState: false,
  battleMode: "lobby",
  battle: null,
  selectedBattle: null,
  selectedCard: "",
  currentAudio: null,
  settings: { autoSpeak: true },
  progress: null,
  animating: false,
  selectedDifficulty: undefined
};

function starterCollection() {
  const collection = {};
  DEFAULT_DECKS[0].cards.forEach((id) => collection[id] = (collection[id] || 0) + 1);
  return collection;
}

const ACHIEVEMENTS = [
  { id: "first_learn", name: "初次学习", icon: "🌟", desc: "完成第一次训练", reward: 5 },
  { id: "math_master_1", name: "数学入门", icon: "🧮", desc: "达到数学等级2", reward: 8 },
  { id: "math_master_2", name: "数学进阶", icon: "📐", desc: "达到数学等级4", reward: 12 },
  { id: "english_master", name: "英语小达人", icon: "🔤", desc: "掌握20个英语单词", reward: 10 },
  { id: "streak_3", name: "连续3天", icon: "🔥", desc: "连续3天完成训练", reward: 15 },
  { id: "streak_7", name: "坚持不懈", icon: "💪", desc: "连续7天完成训练", reward: 25 },
  { id: "perfect_round", name: "完美一局", icon: "💯", desc: "一局训练全部答对", reward: 8 },
  { id: "collector_20", name: "收藏新手", icon: "🃏", desc: "收集20张卡牌", reward: 10 },
  { id: "battle_win_3", name: "战场新星", icon: "⚔️", desc: "赢得3场对战", reward: 12 }
];

function fallbackProgress() {
  return {
    level: 1,
    xp: 0,
    stars: 19,
    supplies: 6,
    packProgress: 1,
    badges: 0,
    learned: {},
    mastered: {},
    math: { level: 0, streak: 0, history: [] },
    daily: { correct: 0, englishRounds: 0, mathRounds: 0 },
    collection: starterCollection(),
    deckId: "scout",
    deck: [...DEFAULT_DECKS[0].cards],
    unlockedDecks: ["scout"],
    recentCards: [],
    recentRewards: [],
    battles: { played: 0, wins: 0, losses: 0 },
    settings: { autoSpeak: true },
    achievements: [],
    lastPlayDate: null,
    streakDays: 0
  };
}

function normalizeProgress(raw) {
  const base = fallbackProgress();
  const merged = { ...base, ...(raw || {}) };
  merged.math = { ...base.math, ...(raw?.math || {}) };
  merged.daily = { ...base.daily, ...(raw?.daily || {}) };
  merged.battles = { ...base.battles, ...(raw?.battles || {}) };
  merged.settings = { ...base.settings, ...(raw?.settings || {}) };
  merged.collection = { ...base.collection, ...(raw?.collection || {}) };
  merged.recentCards = Array.isArray(merged.recentCards) ? merged.recentCards.filter(getCard).slice(0, 12) : [];
  merged.recentRewards = Array.isArray(merged.recentRewards) ? merged.recentRewards.slice(0, 12) : [];
  merged.deck = Array.isArray(merged.deck) && merged.deck.length ? merged.deck.filter(getCard).slice(0, DECK_LIMIT) : [...DEFAULT_DECKS[0].cards];
  merged.achievements = Array.isArray(merged.achievements) ? merged.achievements : [];
  DEFAULT_DECKS[0].cards.forEach((id) => merged.collection[id] = Math.max(merged.collection[id] || 0, merged.deck.filter((cardId) => cardId === id).length || 1));
  while (merged.deck.length < DECK_LIMIT) {
    const next = DEFAULT_DECKS[0].cards.find((id) => deckCardCount(merged.deck, id) < Math.min(2, getCard(id).maxCopies));
    if (!next) break;
    merged.deck.push(next);
  }
  return merged;
}

function loadProgress() {
  try { return normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)) || null); }
  catch { return fallbackProgress(); }
}
function saveProgress() { app.progress.settings = app.settings; localStorage.setItem(STORAGE_KEY, JSON.stringify(app.progress)); }
function deckCardCount(deck, id) { return deck.filter((cardId) => cardId === id).length; }
function owned(id) { return app.progress.collection[id] || 0; }
function uniqueOwned() { return Object.keys(app.progress.collection).filter((id) => app.progress.collection[id] > 0).length; }
function packTrack() { return { ready: Math.floor(app.progress.packProgress / PACK_COST), current: app.progress.packProgress % PACK_COST, need: PACK_COST - (app.progress.packProgress % PACK_COST || PACK_COST) }; }
function checkAchievements() {
  const achieved = [];
  const totalRounds = app.progress.daily.englishRounds + app.progress.daily.mathRounds;
  
  ACHIEVEMENTS.forEach((ach) => {
    if (app.progress.achievements.includes(ach.id)) return;
    
    let unlocked = false;
    switch (ach.id) {
      case "first_learn":
        unlocked = totalRounds >= 1;
        break;
      case "math_master_1":
        unlocked = app.progress.math.level >= 2;
        break;
      case "math_master_2":
        unlocked = app.progress.math.level >= 4;
        break;
      case "english_master":
        unlocked = Object.keys(app.progress.mastered).length >= 20;
        break;
      case "streak_3":
        unlocked = app.progress.streakDays >= 3;
        break;
      case "streak_7":
        unlocked = app.progress.streakDays >= 7;
        break;
      case "perfect_round":
        unlocked = app.round && app.round.correct === app.round.total;
        break;
      case "collector_20":
        unlocked = uniqueOwned() >= 20;
        break;
      case "battle_win_3":
        unlocked = app.progress.battles.wins >= 3;
        break;
    }
    
    if (unlocked) {
      app.progress.achievements.push(ach.id);
      app.progress.stars += ach.reward;
      achieved.push(ach);
    }
  });
  
  if (achieved.length > 0) {
    saveProgress();
    achieved.forEach((ach) => {
      toast(`🎉 获得成就：${ach.name} +${ach.reward}星`);
      playSfx("up");
    });
  }
}
function checkDailyStreak() {
  const today = new Date().toDateString();
  const last = app.progress.lastPlayDate;
  
  if (last === today) return;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (last === yesterday.toDateString()) {
    app.progress.streakDays += 1;
  } else if (last && last !== yesterday.toDateString()) {
    app.progress.streakDays = 1;
  } else {
    app.progress.streakDays = 1;
  }
  
  app.progress.lastPlayDate = today;
  saveProgress();
}
function todayProgress() { return Math.min(TODAY_GOAL, app.progress.daily.correct % TODAY_GOAL); }
function pct(value, total) { return `${Math.max(0, Math.min(100, Math.round((value / total) * 100)))}%`; }
function sample(list, count) { return [...list].sort(() => Math.random() - 0.5).slice(0, count); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200); }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function playSfx(kind) {
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    var now = ctx.currentTime;
    if (kind === "up") {
      var o1 = ctx.createOscillator(); var g1 = ctx.createGain();
      o1.connect(g1); g1.connect(ctx.destination);
      o1.type = "sine";
      o1.frequency.setValueAtTime(660, now);
      o1.frequency.setValueAtTime(880, now + 0.08);
      g1.gain.setValueAtTime(0.28, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      o1.start(now); o1.stop(now + 0.28);
      var o2 = ctx.createOscillator(); var g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.type = "sine";
      o2.frequency.setValueAtTime(1100, now + 0.12);
      g2.gain.setValueAtTime(0.001, now);
      g2.gain.linearRampToValueAtTime(0.22, now + 0.14);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      o2.start(now + 0.12); o2.stop(now + 0.38);
    } else if (kind === "down") {
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "triangle";
      o.frequency.setValueAtTime(330, now);
      o.frequency.exponentialRampToValueAtTime(200, now + 0.22);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      o.start(now); o.stop(now + 0.32);
    } else if (kind === "click") {
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "square";
      o.frequency.setValueAtTime(800, now);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      o.start(now); o.stop(now + 0.06);
    }
  } catch (e) { /* audio not supported */ }
}
function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function showAnnounce(text) {
  var board = $("#battleBoard");
  if (!board) return;
  var el = document.createElement("div");
  el.className = "fx-announce";
  el.textContent = text;
  board.style.position = "relative";
  board.appendChild(el);
  return el;
}
function hideAnnounce(el) {
  if (!el) return;
  el.classList.add("fx-announce-out");
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}
function applyDeployFx(uid) {
  if (!uid) return;
  setTimeout(function () {
    var el = document.querySelector('[data-unit="' + uid + '"]');
    if (el) { el.classList.add("fx-deploy-in"); setTimeout(function () { el.classList.remove("fx-deploy-in"); }, 650); }
  }, 30);
}
function showDmgNum(el, amount, remainHp) {
  if (!el) return;
  var num = document.createElement("span");
  num.className = "fx-dmg-num";
  num.textContent = remainHp !== undefined && remainHp !== null
    ? "-" + amount + " \u2192 " + Math.max(0, remainHp)
    : "-" + amount;
  el.style.position = "relative";
  el.appendChild(num);
  setTimeout(function () { if (num.parentNode) num.parentNode.removeChild(num); }, 1300);
}
function xpNeeded(level) { return level * 10; }
function checkLevelUp() {
  var leveled = false;
  var oldLevel = app.progress.level;
  while (app.progress.xp >= xpNeeded(app.progress.level)) {
    app.progress.xp -= xpNeeded(app.progress.level);
    app.progress.level += 1;
    leveled = true;
  }
  if (leveled) {
    saveProgress();
    showLevelUpOverlay(app.progress.level);
    playSfx("up");
    setTimeout(function () { playSfx("up"); }, 200);
    setTimeout(function () { playSfx("up"); }, 400);
  }
  return leveled;
}
function tweenNum(elId, target, duration) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (!duration) duration = 500;
  var start = parseInt(el.textContent, 10) || 0;
  if (start === target) return;
  var startTime = null;
  el.classList.add("num-bounce");
  setTimeout(function () { el.classList.remove("num-bounce"); }, 400);
  function step(time) {
    if (!startTime) startTime = time;
    var progress = Math.min((time - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function showLevelUpOverlay(newLevel) {
  var existing = document.getElementById("levelUpOverlay");
  if (existing) existing.remove();
  var overlay = document.createElement("div");
  overlay.id = "levelUpOverlay";
  overlay.className = "level-up-overlay";
  var particles = "";
  for (var i = 0; i < 16; i++) {
    var angle = (i / 16) * 360;
    var dist = 60 + Math.random() * 80;
    var size = 4 + Math.random() * 6;
    var dur = 0.8 + Math.random() * 0.6;
    particles += '<i class="lu-particle" style="--angle:' + angle + 'deg;--dist:' + dist + 'px;--size:' + size + 'px;--dur:' + dur + 's"></i>';
  }
  overlay.innerHTML = '<div class="lu-content"><div class="lu-badge">Lv.' + newLevel + '</div><h2 class="lu-title">升级了！</h2><p class="lu-sub">指挥官等级提升，继续加油</p></div>' + particles;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function () { overlay.classList.add("lu-fade-out"); setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 400); });
  setTimeout(function () { overlay.classList.add("lu-fade-out"); setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 400); }, 3200);
}
function showAnswerParticles() {
  var screen = $("#playScreen");
  if (!screen) return;
  for (var i = 0; i < 12; i++) {
    (function (idx) {
      setTimeout(function () {
        var p = document.createElement("span");
        p.className = "ans-particle";
        p.style.left = (15 + Math.random() * 70) + "%";
        p.style.animationDuration = (1.2 + Math.random() * 0.8) + "s";
        p.style.animationDelay = (Math.random() * 0.3) + "s";
        p.style.fontSize = (14 + Math.random() * 12) + "px";
        p.textContent = Math.random() > 0.5 ? "★" : "✦";
        screen.appendChild(p);
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 2500);
      }, idx * 60);
    })(i);
  }
}
function showComboBadge(combo) {
  if (combo < 2) return;
  var existing = document.querySelector(".combo-badge");
  if (existing) existing.remove();
  var badge = document.createElement("div");
  badge.className = "combo-badge";
  badge.textContent = "Combo ×" + combo + "!";
  var screen = $("#playScreen");
  if (screen) screen.appendChild(badge);
  setTimeout(function () { if (badge.parentNode) badge.classList.add("combo-out"); }, 1200);
  setTimeout(function () { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 1600);
}

function showView(view) {
  app.view = view;
  if (view === "battle" && !app.battle?.active && app.battleMode !== "playing") app.battleMode = "lobby";
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === `${view}Screen`));
  $$(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  renderShellChrome();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    app._pushingState = true;
    history.pushState({ view: view }, "", "");
  } catch (e) {} finally {
    setTimeout(function () { app._pushingState = false; }, 100);
  }
}

var _lastBackAtBase = 0;
function goBack() {
  // Close any expanded battle log first
  var expandedLog = document.querySelector(".battle-log-mini.expanded");
  if (expandedLog) { expandedLog.classList.remove("expanded"); return; }

  // Active battle: show game-styled exit confirmation
  if (app.view === "battle" && app.battleMode === "playing" && app.battle?.active) {
    var overlay = $("#battleExitOverlay");
    if (overlay) overlay.hidden = false;
    return;
  }

  // Learning/play mode: show exit confirmation dialog
  if (app.view === "play") {
    var overlay = $("#trainExitOverlay");
    if (overlay) overlay.hidden = false;
    return;
  }

  // Base view: double-tap to exit
  if (app.view === "base") {
    var now = Date.now();
    if (now - _lastBackAtBase < 2500) {
      try { window.close(); } catch (e) {}
      try { if (window.AndroidBridge) window.AndroidBridge.finish(); } catch (e) {}
      return;
    }
    _lastBackAtBase = now;
    toast("再按一次退出应用");
    try { app._pushingState = true; history.pushState({}, "", ""); } catch (e) {}
    setTimeout(function () { app._pushingState = false; }, 100);
    return;
  }

  // All other views (train, cards, battle lobby, parent): go back to base
  showView("base");
}

function renderShellChrome() {
  document.body.classList.toggle("battle-playing", app.view === "battle" && app.battleMode === "playing");
  document.body.classList.toggle("learning-playing", app.view === "play");
  document.body.classList.toggle("not-base", app.view !== "base");
}

function render() {
  var oldStars = app.progress.stars;
  var oldSupplies = app.progress.supplies;
  var baseStarsEl = $("#baseStars");
  var baseSuppliesEl = $("#baseSupplies");
  var prevStars = baseStarsEl ? parseInt(baseStarsEl.textContent, 10) || 0 : oldStars;
  var prevSupplies = baseSuppliesEl ? parseInt(baseSuppliesEl.textContent, 10) || 0 : oldSupplies;
  renderBase();
  renderTrain();
  renderCards();
  renderBattle();
  renderParent();
  if (prevStars > 0 && oldStars > prevStars) tweenNum("baseStars", oldStars, 600);
  if (prevSupplies > 0 && oldSupplies > prevSupplies) tweenNum("baseSupplies", oldSupplies, 600);
}

const FACTION_KEYS = { "\u94a2\u94c1\u8425": "steel", "\u5929\u7a7a\u961f": "sky", "\u8865\u7ed9\u961f": "supply", "\u5b88\u5907\u961f": "guard", "\u6218\u672f\u961f": "tactic", "\u5148\u950b\u961f": "vanguard" };
function factionKey(faction) { return FACTION_KEYS[faction] || "neutral"; }
function cardVisualLabel(card) {
  const typeIcons = {
    "步兵": "🎖️",
    "坦克": "🛡️",
    "飞机": "✈️",
    "火炮": "💣",
    "补给": "📦",
    "防御工事": "🏰",
    "战术指令": "📜"
  };
  return typeIcons[card.type] || card.icon || "★";
}

function deckName() { return DEFAULT_DECKS.find((deck) => deck.id === app.progress.deckId)?.name || "自定义小队"; }
function deckAverageCost(deck = app.progress.deck) { return deck.length ? (deck.reduce((sum, id) => sum + getCard(id).cost, 0) / deck.length).toFixed(1) : "0.0"; }
function deckStyle(deck = app.progress.deck) {
  const counts = deck.reduce((acc, id) => { const card = getCard(id); acc[card.type] = (acc[card.type] || 0) + 1; return acc; }, {});
  if ((counts["防御工事"] || 0) >= 3) return "防守型";
  if ((counts["飞机"] || 0) >= 3) return "空中型";
  if ((counts["补给"] || 0) >= 3) return "运营型";
  if (deck.filter((id) => getCard(id).cost <= 2).length >= 7) return "快攻型";
  return "均衡型";
}
function renderMiniCard(card) { return `<div class="card-mini faction-${factionKey(card.faction)}"><span>${card.cost} · ${card.faction}</span><div class="mini-art"><img src="${card.artImage}" alt="" /></div><b>${card.name}</b><small>攻${card.attack}/血${card.health}</small></div>`; }


function renderBase() {
  const track = packTrack();
  const today = todayProgress();
  $("#levelText").textContent = `Lv.${app.progress.level}`;
  if ($("#headerLevel")) $("#headerLevel").textContent = `Lv.${app.progress.level}`;
  var xpNeed = xpNeeded(app.progress.level);
  var xpPct = Math.min(100, Math.round((app.progress.xp / xpNeed) * 100));
  var xpBarEl = $("#baseXpBar");
  if (xpBarEl) xpBarEl.style.width = xpPct + "%";
  var xpTextEl = $("#baseXpText");
  if (xpTextEl) xpTextEl.textContent = app.progress.xp + " / " + xpNeed;
  $("#baseStars").textContent = app.progress.stars;
  $("#baseSupplies").textContent = app.progress.supplies;
  $("#basePack").textContent = track.ready ? `${track.ready}\u7bb1` : `${track.current}/${PACK_COST}`;
  $("#baseDeckSize").textContent = `${app.progress.deck.length}/${DECK_LIMIT}`;
  $("#todayMissionText").textContent = track.ready ? "\u53ef\u4ee5\u9886\u53d6\u8865\u7ed9\u5305" : `\u518d\u7b54\u5bf9 ${PACK_COST - track.current} \u9898\uff0c\u53ef\u9886\u53d6\u8865\u7ed9\u5305`;
  $("#todayMissionBar").style.width = pct(today || track.current, TODAY_GOAL);
  $("#loopHint").textContent = track.ready ? "\u8865\u7ed9\u5f85\u9886\u53d6" : "\u8bad\u7ec3\u63a8\u8fdb\u4e2d";
  const loop = ["\u8bad\u7ec3", "\u8865\u7ed9", "\u5f00\u5305", "\u7ec4\u5361", "\u5f00\u6218"];
  const active = track.ready ? 2 : app.progress.deck.length < DECK_LIMIT ? 3 : 0;
  $("#growthLoop").innerHTML = loop.map((item, index) => `<div class="loop-step ${index === active ? "active" : ""}"><b>${index + 1}</b><span>${item}</span></div>`).join("");
  const canPack = app.progress.supplies >= PACK_COST || track.ready;
  $("#crateTitle").textContent = canPack ? "\u8865\u7ed9\u7bb1\u5df2\u51c6\u5907\u597d" : "\u8865\u7ed9\u7bb1\u8fdb\u5ea6";
  $("#crateText").textContent = canPack ? "\u6253\u5f00\u540e\u83b7\u5f97\u65b0\u5361\uff0c\u91cd\u590d\u5361\u81ea\u52a8\u8f6c\u4e3a\u8bad\u7ec3\u5fbd\u7ae0\u3002" : `\u5f53\u524d\u8fdb\u5ea6 ${track.current}/${PACK_COST}\uff0c\u5b8c\u6210\u8bad\u7ec3\u53ef\u4ee5\u63a8\u8fdb\u8fdb\u5ea6\u3002`;
  $("#crateActionBtn").textContent = canPack ? "\u5f00\u542f\u8865\u7ed9\u7bb1" : "\u53bb\u8bad\u7ec3";
  $("#baseOpenPackBtn").disabled = !canPack;
  $("#baseDeckName").textContent = deckName();
  $("#baseDeckMeta").innerHTML = `<span>${app.progress.deck.length}/12</span><span>\u5e73\u5747\u8d39\u7528 ${deckAverageCost()}</span><span>${deckStyle()}</span>`;
  $("#baseDeckCards").innerHTML = app.progress.deck.map((id) => renderMiniCard(getCard(id))).join("");
}


function renderTrain() {
  const today = todayProgress();
  $("#trainGoalText").textContent = today + " / " + TODAY_GOAL;
  $("#trainGoalBar").style.width = pct(today, TODAY_GOAL);
  $("#englishToday").textContent = "已完成 " + app.progress.daily.englishRounds + " 局";
  $("#mathLevelText").textContent = "Lv." + (app.progress.math.level + 1) + " · " + MATH_LEVELS[app.progress.math.level].name;
  $("#recentRewards").innerHTML = app.progress.recentRewards.length ? app.progress.recentRewards.map((item) => "<span class=\"status-pill\">" + item + "</span>").join("") : "<span class=\"status-pill\">完成训练后会显示</span>";
  if (!app.selectedTheme) app.selectedTheme = "all";
  $("#englishThemeSelector").innerHTML = THEMES.map((t) => `<button class="theme-chip ${app.selectedTheme === t.id ? "active" : ""}" data-theme="${t.id}">${t.icon} ${t.name}</button>`).join("");
  const achCount = app.progress.achievements?.length || 0;
  $("#achievementCount").textContent = achCount + "/" + ACHIEVEMENTS.length;
  $("#achievementsGrid").innerHTML = ACHIEVEMENTS.map((ach) => {
    const unlocked = app.progress.achievements?.includes(ach.id);
    return `<div class="achievement-item ${unlocked ? "unlocked" : "locked"}"><span class="ach-icon">${ach.icon}</span><span class="ach-name">${ach.name}</span><span class="ach-reward">+${ach.reward}星</span></div>`;
  }).join("");
  
  const masteredCount = Object.keys(app.progress.mastered).length;
  const totalRounds = app.progress.daily.englishRounds + app.progress.daily.mathRounds;
  $("#statsGrid").innerHTML = `
    <div class="stat-item"><span class="stat-icon">📚</span><div><strong>${masteredCount}</strong><span>已掌握单词</span></div></div>
    <div class="stat-item"><span class="stat-icon">🔥</span><div><strong>${app.progress.streakDays || 0}</strong><span>连续打卡天数</span></div></div>
    <div class="stat-item"><span class="stat-icon">🎯</span><div><strong>${totalRounds}</strong><span>今日练习局数</span></div></div>
    <div class="stat-item"><span class="stat-icon">⭐</span><div><strong>${app.progress.stars}</strong><span>累计星星</span></div></div>
  `;
  
  $("#suggestionContent").innerHTML = generateSuggestion();
}

function generateSuggestion() {
  const today = todayProgress();
  const mastered = Object.keys(app.progress.mastered).length;
  const streak = app.progress.streakDays || 0;
  const mathLevel = app.progress.math.level;
  
  if (today >= TODAY_GOAL) {
    return `<p>🎉 今日目标已完成！可以去开包或对战啦！</p>`;
  }
  
  if (streak >= 3) {
    return `<p>💪 太棒了！连续 ${streak} 天打卡！今天继续加油，完成目标后可以获得补给包哦！</p>`;
  }
  
  if (mathLevel <= 1 && mastered < 10) {
    return `<p>🎯 建议今天先练习英语找词和数学加减，打好基础！</p>`;
  }
  
  if (mastered >= 20) {
    return `<p>🌟 你已经掌握了 ${mastered} 个单词！今天试试英语听音模式吧！</p>`;
  }
  
  if (mathLevel >= 3) {
    return `<p>🧮 数学等级不错！今天试试乘法启蒙，挑战一下自己！</p>`;
  }
  
  return `<p>📚 选择一种训练开始今天的学习之旅吧！完成5题可以获得补给包哦！</p>`;
}

function pickEnglishQuestion(mode) {
  const theme = app.selectedTheme || "all";
  const pool = theme === "all" ? WORD_BANK : WORD_BANK.filter((w) => w.theme === theme);
  
  const mastered = app.progress.mastered || {};
  const notMastered = pool.filter((w) => !mastered[w.id] || mastered[w.id] < 3);
  const availablePool = notMastered.length > 0 ? notMastered : pool;
  
  const answer = sample(availablePool, 1)[0] || WORD_BANK[0];
  
  const candidates = pool.filter((item) => item.id !== answer.id);
  let options = [answer];
  
  for (const item of sample(candidates, candidates.length)) {
    if (options.length >= 4) break;
    if (!options.find((o) => o.id === item.id)) options.push(item);
  }
  
  if (options.length < 4) {
    const allOthers = WORD_BANK.filter((item) => item.id !== answer.id && !options.find((o) => o.id === item.id));
    for (const item of sample(allOthers, allOthers.length)) {
      if (options.length >= 4) break;
      options.push(item);
    }
  }
  
  const shuffledOptions = sample(options, options.length);
  if (!shuffledOptions.find((o) => o.id === answer.id)) {
    return pickEnglishQuestion(mode);
  }
  return { kind: "english", mode, answer, options: shuffledOptions };
}
function pickMathQuestion(level) {
  const q = { kind: "math", ...makeMathQuestion(level !== undefined ? level : app.progress.math.level) };
  if (!q.options.includes(q.answer)) {
    q.options = shuffleList([q.answer, ...sample(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"].filter(n => n !== q.answer), 3)]);
  }
  return q;
}
function startLearning(mode) {
  var mathLevelMap = { "math-add": 0, "math-compare": 1, "math-pattern": 2, "math-add100": 3, "math-multiply": 4 };
  var isMath = mode === "math" || mode in mathLevelMap;
  var mathLevel = mode in mathLevelMap ? mathLevelMap[mode] : app.progress.math.level;
  var effectiveMode = isMath ? "math" : mode;
  app.round = { mode: effectiveMode, total: 5, index: 0, correct: 0, combo: 0, answered: false, wrong: "", question: isMath ? pickMathQuestion(mathLevel) : pickEnglishQuestion(mode) };
  showView("play");
  renderPlay();
  if (!isMath && app.settings.autoSpeak) setTimeout(() => speak(app.round.question.answer.id), 180);
}
function speak(key) {
  const item = WORD_BANK.find((word) => word.id === key || word.word === key);
  if (!item) return;
  if (app.currentAudio) app.currentAudio.pause();
  app.currentAudio = new Audio(item.audio);
  app.currentAudio.play().catch(() => {
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(item.word);
      utter.lang = "en-US";
      utter.rate = 0.78;
      window.speechSynthesis.speak(utter);
    }
  });
}
function renderPlay() {
  const round = app.round;
  if (!round) return;
  const q = round.question;
  $("#questionStep").textContent = `第 ${round.index + 1} / ${round.total} 题`;
  $("#questionPack").textContent = `补给 ${packTrack().current}/${PACK_COST}`;
  $("#questionBar").style.width = pct(round.index + 1, round.total);
  $("#listenBtn").hidden = round.mode === "math";
  if (round.mode === "math") {
    $("#questionIcon").textContent = "算";
    $("#questionTitle").textContent = q.prompt;
    $("#questionHint").textContent = q.hint;
    $("#answerGrid").innerHTML = q.options.map((option) => answerButton(option, option)).join("");
  } else if (round.mode === "spell") {
    if (!round.spellOptions) round.spellOptions = sample([q.answer.answer, "a", "e", "i", "o", "u", "p", "n"].filter((x, i, arr) => arr.indexOf(x) === i), 4);
    $("#questionIcon").textContent = q.answer.icon;
    $("#questionTitle").textContent = q.answer.missing;
    $("#questionHint").textContent = "补上缺少的字母";
    $("#answerGrid").innerHTML = round.spellOptions.map((option) => answerButton(option, option)).join("");
  } else {
    $("#questionIcon").textContent = q.answer.icon;
    $("#questionTitle").textContent = round.mode === "listen" ? "Listen" : q.answer.word;
    $("#questionHint").textContent = round.mode === "listen" ? "听到的单词是哪一个？" : "哪一个是这个图片的英文？";
    $("#answerGrid").innerHTML = q.options.map((item) => answerButton(item.id, round.mode === "look" ? item.word : `${item.icon} ${item.cn}`)).join("");
  }
  $("#answerFeedback").innerHTML = "";
}
function answerButton(value, label) { return `<button class="answer-btn ${app.round?.wrong === value ? "wrong" : ""}" data-answer="${escapeHtml(value)}">${escapeHtml(label)}</button>`; }
function answerQuestion(value) {
  const round = app.round;
  if (!round || round.answered) return;
  const q = round.question;
  const right = round.mode === "math" ? value === q.answer : round.mode === "spell" ? value === q.answer.answer : value === q.answer.id;
  if (!right) {
    round.wrong = value;
    round.combo = 0;
    playSfx("down");
    var wrongBtn = null;
    $$(".answer-btn").forEach(function (btn) { if (btn.dataset.answer === String(value)) wrongBtn = btn; });
    if (wrongBtn) { wrongBtn.classList.add("ans-shake"); setTimeout(function () { wrongBtn.classList.remove("ans-shake"); }, 500); }
    $("#answerFeedback").innerHTML = `<div class="feedback-card wrong-feedback"><h3>再试一次</h3><p>没关系，想一想再选。</p><button class="secondary-action" onclick="renderPlay()">再想想</button><button class="secondary-action" onclick="showHint()">给我提示</button></div>`;
    renderWrongButtons();
    return;
  }
  round.answered = true;
  round.correct += 1;
  round.combo += 1;
  playSfx("up");
  showAnswerParticles();
  showComboBadge(round.combo);
  app.progress.stars += 2;
  app.progress.packProgress += 1;
  app.progress.daily.correct += 1;
  app.progress.xp += 3;
  if (round.mode === "math") updateMathLevel(1, 1); else {
    app.progress.learned[q.answer.id] = (app.progress.learned[q.answer.id] || 0) + 1;
    app.progress.mastered[q.answer.id] = (app.progress.mastered[q.answer.id] || 0) + 1;
  }
  app.progress.recentRewards.unshift("+2星 +3经验 +1补给");
  app.progress.recentRewards = app.progress.recentRewards.slice(0, 8);
  saveProgress();
  checkLevelUp();
  var comboText = round.combo >= 3 ? " 连续 " + round.combo + " 题，太厉害了！" : round.combo >= 2 ? " 连对 " + round.combo + " 题！" : "";
  $("#answerFeedback").innerHTML = `<div class="feedback-card correct-feedback"><h3>太棒了！${comboText}</h3><p>正确答案！学习点 +2，经验 +3，补给进度 +1。</p><button class="primary-action" id="nextQuestionBtn">${round.index >= round.total - 1 ? "完成训练" : "下一题"}</button></div>`;
  $$(".answer-btn").forEach((btn) => { btn.disabled = true; if (btn.dataset.answer === value) { btn.classList.add("correct", "ans-pop"); } });
}
function showHint() { toast(app.round?.mode === "math" ? "可以先拆成十位和个位来想。" : "看一看图片和单词开头。"); }
function renderWrongButtons() { $$(".answer-btn").forEach((btn) => btn.classList.toggle("wrong", btn.dataset.answer === app.round.wrong)); }
function nextQuestion() {
  const round = app.round;
  if (!round) return;
  if (round.index >= round.total - 1) {
    if (round.mode === "math") app.progress.daily.mathRounds += 1; else app.progress.daily.englishRounds += 1;
    checkDailyStreak();
    checkAchievements();
    saveProgress();
    toast("训练完成，补给进度已入库");
    app.round = null;
    showView("train");
    return;
  }
  round.index += 1;
  round.answered = false;
  round.wrong = "";
  round.spellOptions = null;
  round.question = round.mode === "math" ? pickMathQuestion() : pickEnglishQuestion(round.mode);
  renderPlay();
  if (round.mode !== "math" && app.settings.autoSpeak) setTimeout(() => speak(round.question.answer.id), 180);
}
function updateMathLevel(correct, total) {
  const math = app.progress.math;
  if (!math.history) math.history = [];
  math.history.push(correct === total);
  if (math.history.length > 10) math.history.shift();
  
  const recentCorrect = math.history.filter(Boolean).length;
  const recentWrong = math.history.length - recentCorrect;
  
  if (recentCorrect >= 8 && math.level < MATH_LEVELS.length - 1) {
    math.level += 1;
    math.history = [];
    toast("数学升级！挑战更难的题目");
    playSfx("up");
  } else if (recentWrong >= 4 && math.level > 0) {
    math.level -= 1;
    math.history = [];
    toast("难度降低，继续加油");
    playSfx("down");
  }
}

function drawPack(source) {
  const gained = [];
  const pool = source === "learning" ? CARD_POOL.filter((card) => card.rarity !== "传说" || card.tags.includes("核心")) : CARD_POOL;
  for (let i = 0; i < 3; i += 1) {
    const roll = Math.random() * 100;
    const rarity = roll > 98 ? "传说" : roll > 88 ? "史诗" : roll > 58 ? "稀有" : "普通";
    const candidates = pool.filter((card) => card.rarity === rarity);
    gained.push(sample(candidates.length ? candidates : pool, 1)[0]);
  }
  return gained;
}
function grantPack(source) {
  const cards = drawPack(source);
  const result = cards.map((card) => {
    const count = owned(card.id);
    if (count >= card.maxCopies) {
      app.progress.badges += 1;
      return { card, duplicate: true };
    }
    app.progress.collection[card.id] = count + 1;
    app.progress.recentCards.unshift(card.id);
    app.selectedCard = card.id;
    return { card, duplicate: false };
  });
  app.progress.recentCards = app.progress.recentCards.slice(0, 12);
  app.progress.recentRewards.unshift(`补给箱+3张`);
  app.progress.recentRewards = app.progress.recentRewards.slice(0, 8);
  saveProgress();
  render();
  renderPackResult(result);
}
function openSupplyPack() {
  if (app.progress.supplies < PACK_COST) return toast(`补给点还差 ${PACK_COST - app.progress.supplies}`);
  app.progress.supplies -= PACK_COST;
  grantPack("supply");
}
function claimLearningPack() {
  if (app.progress.packProgress < PACK_COST) return toast(`补给进度还差 ${PACK_COST - app.progress.packProgress}`);
  app.progress.packProgress -= PACK_COST;
  grantPack("learning");
  setTimeout(function () {
    var packResult = $("#packResult");
    if (packResult) {
      packResult.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 300);
}
function renderPackResult(result) {
  var hasNew = result.some(function (r) { return !r.duplicate; });
  var html = '<h2>' + (hasNew ? '获得新卡！' : '获得重复卡') + '</h2><div class="pack-cards pack-reveal">';
  result.forEach(function (r, i) {
    var cardHtml = renderCardFrame(r.card, { compact: true, duplicate: r.duplicate });
    html += '<div class="pack-card-slot" data-pack-index="' + i + '" data-pack-rarity="' + r.card.rarity + '">' +
      '<div class="pack-card-inner">' +
      '<div class="pack-card-face pack-card-back"></div>' +
      '<div class="pack-card-face pack-card-front rarity-' + r.card.rarity + '">' + cardHtml + '</div>' +
      '</div></div>';
  });
  html += '</div><div class="pack-reveal-hint">点击卡牌翻开</div>' +
    '<div class="mission-actions"><button class="secondary-action" data-tab="deck">去组卡</button>' +
    '<button class="primary-action" id="openAgainBtn">继续开包</button></div>';
  $("#packResult").innerHTML = html;
  setTimeout(function () { revealPackCards(result); }, 200);
}
function revealPackCards(result) {
  var slots = $$(".pack-card-slot");
  if (!slots.length) return;
  function onSlotClick(e) {
    var slot = e.target.closest(".pack-card-slot");
    if (!slot || slot.classList.contains("revealed")) return;
    slot.classList.add("revealed");
    var rarity = slot.dataset.packRarity;
    if (rarity === "传说" || rarity === "史诗") playSfx("up"); else playSfx("click");
    var allRevealed = slots.every(function (s) { return s.classList.contains("revealed"); });
    if (allRevealed) {
      setTimeout(function () { playSfx("up"); }, 400);
    }
  }
  var container = $(".pack-reveal");
  if (container) container.addEventListener("click", onSlotClick);
}

const factionOptions = ["全部", "钢铁营", "天空队", "补给队", "守备队", "战术队", "先锋队"];
const rarityOptions = ["全部", "普通", "稀有", "史诗", "传说"];
const costOptions = ["全部", "0", "1", "2", "3", "4", "5+"];
const ownedOptions = ["全部", "已拥有", "未拥有"];
function renderCards() {
  if (!app.selectedCard || !getCard(app.selectedCard)) app.selectedCard = app.progress.recentCards[0] || app.progress.deck[0] || CARD_POOL[0]?.id || "";
  const track = packTrack();
  if ($("#libraryStars")) $("#libraryStars").textContent = app.progress.stars;
  if ($("#librarySupplies")) $("#librarySupplies").textContent = app.progress.supplies;
  if ($("#libraryPack")) $("#libraryPack").textContent = track.ready ? `${track.ready}\u7bb1` : `${track.current}/${PACK_COST}`;
  if ($("#libraryOwned")) $("#libraryOwned").textContent = `${uniqueOwned()}/${CARD_POOL.length}`;
  if ($("#libraryDeckName")) $("#libraryDeckName").textContent = deckName();
  if ($("#libraryDeckMetaText")) $("#libraryDeckMetaText").textContent = `${app.progress.deck.length}/12 \u00b7 ${deckStyle()} \u00b7 \u5e73\u5747\u8d39\u7528 ${deckAverageCost()}`;
  if ($("#libraryDeckCards")) $("#libraryDeckCards").innerHTML = app.progress.deck.map((id) => renderMiniCard(getCard(id))).join("");
  $$(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === app.cardTab));
  $$(".card-tab-pane").forEach((pane) => pane.classList.toggle("active", pane.id === `${app.cardTab}Pane`));
  renderPackPane();
  renderFilters();
  renderCollection();
  renderDeckBar();
  renderCardDetail();
}
function renderPackPane() {
  const track = packTrack();
  $("#packSupply").textContent = app.progress.supplies;
  $("#packProgress").textContent = track.ready ? `${track.ready}箱待领` : `${track.current}/${PACK_COST}`;
  $("#openPackBtn").disabled = app.progress.supplies < PACK_COST;
  $("#claimLearningPackBtn").disabled = app.progress.packProgress < PACK_COST;
}
function renderFilters() {
  $("#ownedFilters").innerHTML = ownedOptions.map((item) => filterChip("owned", item)).join("");
  $("#factionFilters").innerHTML = factionOptions.map((item) => filterChip("faction", item)).join("");
  $("#rarityFilters").innerHTML = rarityOptions.map((item) => filterChip("rarity", item)).join("");
  $("#costFilters").innerHTML = costOptions.map((item) => filterChip("cost", item)).join("");
}
function filterChip(key, value) { return `<button class="filter-chip ${app.filters[key] === value ? "active" : ""}" data-filter-key="${key}" data-filter-value="${value}">${value}</button>`; }
function filteredCards() {
  return CARD_POOL.filter((card) => {
    const costGroup = card.cost >= 5 ? "5+" : String(card.cost);
    const count = owned(card.id);
    const ownedMatch = app.filters.owned === "全部" || (app.filters.owned === "已拥有" && count > 0) || (app.filters.owned === "未拥有" && count === 0);
    return ownedMatch && (app.filters.faction === "全部" || card.faction === app.filters.faction) && (app.filters.rarity === "全部" || card.rarity === app.filters.rarity) && (app.filters.cost === "全部" || costGroup === app.filters.cost);
  });
}
function renderCollection() { $("#collectionGrid").innerHTML = filteredCards().map((card) => renderCardFrame(card)).join(""); }
function renderCardDetail() {
  const card = getCard(app.selectedCard) || CARD_POOL[0];
  if (!card || !$("#cardDetailPanel")) return;
  const count = owned(card.id);
  const inDeck = deckCardCount(app.progress.deck, card.id);
  $("#cardDetailPanel").innerHTML = `<div class="panel-title"><span>卡牌模板说明</span><b>${card.rarity}</b></div>${renderCardFrame(card, { detail: true })}<div class="detail-lines"><p><b>费用</b><span>${card.cost}点行动点</span></p><p><b>阵营</b><span>${card.faction}</span></p><p><b>类型</b><span>${card.type}</span></p><p><b>技能</b><span>${card.skill}</span></p><p><b>收藏</b><span>拥有 ${count} · 卡组 ${inDeck}</span></p></div><div class="rarity-row"><span>普通</span><span>稀有</span><span>史诗</span><span>传说</span></div>`;
}
function renderCardFrame(card, opts) {
  opts = opts || {};
  var count = owned(card.id);
  var inDeck = deckCardCount(app.progress.deck, card.id);
  var locked = !count;
  var canAdd = count > inDeck && app.progress.deck.length < DECK_LIMIT && inDeck < card.maxCopies;
  var ownedText = opts.duplicate ? "重复转徽章" : "拥有 " + count;
  var key = factionKey(card.faction);
  var footerControls = "";
  if (!opts.compact && !opts.detail) {
    footerControls = "<span>" + ownedText + "</span>";
    if (inDeck > 0) {
      footerControls += '<span class="card-deck-badge">卡组 x' + inDeck + "</span>";
      footerControls += '<button class="card-remove-btn" data-remove-card="' + card.id + '">移出</button>';
    } else {
      footerControls += "<span>卡组 0</span>";
    }
    footerControls += '<button class="card-add-btn" data-add-card="' + card.id + '"' + (canAdd ? "" : " disabled") + ">加入</button>";
  }
  return '<article class="card-frame card-full rarity-' + card.rarity + " faction-" + key + (locked ? " locked" : "") + (inDeck > 0 ? " in-deck" : "") + (opts.compact ? " compact-card" : "") + (opts.detail ? " detail-card" : "") + '" data-card-detail="' + card.id + '">'
    + '<div class="card-top"><span class="card-cost"><b>' + card.cost + "</b><small>行动</small></span>"
    + '<span class="card-rarity">' + card.rarity + "</span></div>"
    + '<div class="card-title-row"><h3>' + card.name + "</h3>"
    + '<span class="card-faction"><img src="assets/ui/faction-' + key + '.svg" alt="" />' + card.faction + "</span></div>"
    + '<div class="card-art"><img src="' + card.artImage + '" alt="' + card.name + '" /><em>' + card.type + "</em></div>"
    + '<p class="card-skill">' + card.skill + "</p>"
    + '<div class="card-stats"><span><b>' + card.attack + "</b>攻击</span><span><b>" + card.health + "</b>生命</span></div>"
    + '<div class="card-footer">' + footerControls + "</div>"
    + "</article>";
}
function renderDeckBar() {
  if (!$("#deckBar")) return;
  $("#deckBarTitle").textContent = deckName();
  $("#deckBarCount").textContent = app.progress.deck.length + "/12";
  $("#deckBarAvg").textContent = "均费 " + deckAverageCost();
  $("#deckBarCards").innerHTML = app.progress.deck.map(function (id) {
    var card = getCard(id);
    return '<span class="deck-bar-chip" data-card-detail="' + id + '">'
      + '<span class="chip-cost">' + card.cost + "</span>"
      + card.name.slice(0, 4) + "</span>";
  }).join("");
  var units = app.progress.deck.filter(function (id) {
    return ["战术指令", "补给", "防御工事"].indexOf(getCard(id).type) === -1;
  }).length;
  var support = app.progress.deck.length - units;
  var dupOver = [...new Set(app.progress.deck)].some(function (id) {
    return deckCardCount(app.progress.deck, id) > Math.min(2, getCard(id).maxCopies);
  });
  var rules = [];
  rules.push('<span class="' + (units >= 8 ? "rule-ok" : "rule-warn") + '">单位 ' + units + "/8+</span>");
  rules.push('<span class="' + (support >= 2 ? "rule-ok" : "rule-warn") + '">辅助 ' + support + "/2+</span>");
  rules.push('<span class="' + (app.progress.deck.length === 12 ? "rule-ok" : "rule-warn") + '">' + app.progress.deck.length + "/12</span>");
  if (dupOver) rules.push('<span class="rule-warn">重复超限</span>');
  $("#deckBarRules").innerHTML = rules.join("");
}
function addCardToDeck(id) {
  const card = getCard(id);
  if (!owned(id)) return toast("这张卡还未获得");
  if (app.progress.deck.length >= DECK_LIMIT) return toast("卡组已满，先移出一张");
  if (deckCardCount(app.progress.deck, id) >= Math.min(card.maxCopies, owned(id), 2)) return toast("同名卡最多 2 张");
  app.progress.deck.push(id); saveProgress(); renderCards();
}
function removeCardFromDeck(id) {
  if (app.progress.deck.length <= 1) return toast("至少保留 1 张卡");
  const index = app.progress.deck.indexOf(id);
  if (index >= 0) app.progress.deck.splice(index, 1);
  saveProgress(); renderCards();
}
function autoFillDeck() {
  const candidates = Object.keys(app.progress.collection).filter((id) => owned(id) > 0 && getCard(id)).sort((a, b) => getCard(a).cost - getCard(b).cost);
  for (const id of [...DEFAULT_DECKS[0].cards, ...candidates]) {
    if (app.progress.deck.length >= DECK_LIMIT) break;
    const card = getCard(id);
    if (owned(id) > deckCardCount(app.progress.deck, id) && deckCardCount(app.progress.deck, id) < Math.min(2, card.maxCopies)) app.progress.deck.push(id);
  }
  saveProgress(); renderCards(); toast("已自动补满可用卡");
}

function startBattle() {
  var wins = app.progress.battles.wins || 0;
  var aiIndex = app.selectedDifficulty !== undefined
    ? app.selectedDifficulty
    : (wins < 3 ? 0 : wins < 6 ? 1 : 2);
  var aiDeck = AI_DECKS[aiIndex];
  app.battle = BattleEngine.createBattle(app.progress.deck, aiDeck.cards);
  app.battle.challengeName = aiDeck.name;
  app.battle.enemyStyle = aiDeck.style;
  app.battle.aiDeckName = aiDeck.name;
  app.battleMode = "playing";
  app.selectedBattle = null;
  showView("battle");
}
function backToBattleLobby() {
  app.battleMode = "lobby";
  app.selectedBattle = null;
  renderShellChrome();
  renderBattle();
}
function renderBattle() {
  const lobby = $("#battleLobby");
  const playing = $("#battlePlaying");
  if (!lobby || !playing) return;
  const isPlaying = app.battleMode === "playing";
  lobby.hidden = isPlaying;
  playing.hidden = !isPlaying;
  renderShellChrome();
  if (!isPlaying) { renderBattleLobby(); return; }
  renderBattleTable();
}
function renderBattleLobby() {
  const deckReady = app.progress.deck.length === DECK_LIMIT;
  var wins = app.progress.battles.wins || 0;
  var recommended = wins < 3 ? 0 : wins < 6 ? 1 : 2;
  if (app.selectedDifficulty === undefined) app.selectedDifficulty = recommended;
  var aiIndex = app.selectedDifficulty;
  var nextAi = AI_DECKS[aiIndex];
  var hintEl = $("#difficultyHint");
  if (hintEl) hintEl.textContent = aiIndex === recommended ? "根据胜场推荐" : "手动选择";
  $$(".difficulty-btn").forEach(function (btn) {
    var idx = Number(btn.dataset.ai);
    btn.classList.toggle("active", idx === aiIndex);
  });
  $("#lobbyChallengeName").textContent = nextAi.name;
  $("#lobbyEnemyStyle").textContent = nextAi.style;
  $("#battleLobbyDeckName").textContent = deckName();
  $("#battleLobbyDeckCount").textContent = `${app.progress.deck.length}/${DECK_LIMIT}`;
  $("#battleLobbyDeckStyle").textContent = deckStyle();
  $("#battleLobbyDeckCards").innerHTML = app.progress.deck.map((id) => renderMiniCard(getCard(id))).join("");
  $("#startBattleBtn").disabled = !deckReady;
}
function renderBattleTable() {
  if (!app.battle) startBattle();
  const b = app.battle;
  if (!b.active) renderBattleReward();
  $("#battleHudTitle").textContent = `${b.challengeName || "新手演练"} / 回合 ${b.turn}`;
  $("#battleBoard").innerHTML = `
    ${renderHq("enemy")}
    ${renderBattleZone("enemy", "support")}
    ${renderBattleZone("enemy", "front")}
    <div class="front-control-bar"><span>前线控制</span><b>${BattleEngine.frontControl(b)}</b></div>
    ${renderBattleZone("player", "front")}
    ${renderBattleZone("player", "support")}
    ${renderHq("player")}
    <div class="battle-log-mini" id="battleLog"><b>战况：</b>${b.log[0] || "你抽到 1 张牌，行动点恢复。"}<div class="full-log">${b.log.map((item) => `<p>${item}</p>`).join("")}</div></div>`;
  $("#battleHandStrip").innerHTML = b.player.hand.map((id, index) => renderHand(id, index)).join("") || `<span class="empty-hand">没有手牌</span>`;
  if (!app.selectedBattle) renderDefaultBattleAction();
}
function renderDefaultBattleAction() {
  if (!app.battle?.active) {
    showBattleResultModal();
    $("#battleActionPanel").innerHTML = `<div class="action-panel-grid compact"><div><b>演练已结束</b><span>查看结算结果。</span></div></div>`;
    return;
  }
  $("#battleActionPanel").innerHTML = `<div class="action-panel-grid compact"><div><b>请选择手牌或单位</b><span>部署、推进或攻击都从这里确认。</span></div><button class="primary-action" id="endTurnBtn">结束回合</button></div>`;
}
function showBattleResultModal() {
  var overlay = $("#battleResultOverlay");
  var modal = $("#battleResultModal");
  if (!overlay || !modal) return;
  var win = app.battle.winner === "player";
  var turnText = "回合 " + app.battle.turn;
  var challengeName = app.battle.challengeName || "演练";
  var rewards = win
    ? `<div class="result-rewards"><div class="result-reward"><b>+3</b><span>星星</span></div><div class="result-reward"><b>+2</b><span>补给点</span></div><div class="result-reward"><b>+1</b><span>卡包进度</span></div></div>`
    : `<div class="result-rewards"><div class="result-reward"><b>+1</b><span>补给点</span></div></div>`;
  modal.innerHTML = `<div class="result-icon ${win ? "win" : "lose"}">${win ? "★" : "✕"}</div><h2 class="result-title ${win ? "win" : "lose"}">${win ? "胜利！" : "演练结束"}</h2><p class="result-subtitle">${challengeName} · ${turnText}${win ? " · 出色指挥！" : " · 继续努力"}</p>${rewards}<div class="result-actions"><button class="primary-action" id="restartBattleBtn">再来一局</button><div style="display:flex;gap:8px"><button class="secondary-action" id="battleBackBtn">返回大厅</button><button class="secondary-action" data-view="cards" data-card-tab="collection">调整卡组</button></div></div>`;
  overlay.hidden = false;
}
function hideBattleResultModal() {
  var overlay = $("#battleResultOverlay");
  if (overlay) overlay.hidden = true;
}
function renderHq(owner) {
  const s = app.battle[owner];
  const isPlayer = owner === "player";
  const maxHp = 20;
  const hp = Math.max(0, s.hq);
  const hpPct = Math.round(hp / maxHp * 100);
  return `<div class="hq-bar ${isPlayer ? "ally" : "enemy"}"><strong>${isPlayer ? "我方总部" : "敌方总部"}</strong><div class="hq-health-bar"><i style="width:${hpPct}%"></i></div><span>❤${hp}</span><span class="hq-ap">行动⚡${s.action}/${s.maxAction}</span>${isPlayer ? "" : `<span class="hq-hand">🃏${s.hand.length} 手牌</span>`}</div>`;
}
function renderBattleZone(owner, zone) {
  const limit = zone === "support" ? BattleEngine.SUPPORT_LIMIT : BattleEngine.FRONT_LIMIT;
  const title = `${owner === "player" ? "我方" : "敌方"}${zone === "support" ? "支援区" : "前线区"}`;
  return `<section class="battle-zone ${owner} ${zone}"><div class="zone-label">${title}</div>${renderSlots(owner, zone, limit)}</section>`;
}
function renderSlots(owner, zone, limit) {
  const list = app.battle[owner][zone];
  const slots = Array.from({ length: limit }, (_, i) => list[i] ? renderUnit(list[i], zone) : `<div class="battle-slot empty ${owner} ${zone}" aria-label="空槽"></div>`).join("");
  return `<div class="battle-row ${owner} ${zone}" style="--slots:${limit}">${slots}</div>`;
}
function renderUnit(unit, zone) {
  const card = getCard(unit.cardId);
  const selected = app.selectedBattle?.uid === unit.uid || app.selectedBattle?.targetUid === unit.uid ? "selected" : "";
  const status = unit.fresh ? "待命" : unit.attacked ? "已行动" : "可行动";
  const actionable = unit.owner === "player" && app.battle.active && !unit.fresh && !unit.attacked ? "actionable" : "";
  const typeIcon = cardVisualLabel(card);
  return `<button class="battle-slot active ${unit.owner} ${zone} ${actionable}" data-unit="${unit.uid}" data-owner="${unit.owner}"><div class="unit-card faction-${factionKey(card.faction)} rarity-${card.rarity} ${selected} ${unit.attacked ? "spent" : ""}"><span class="unit-cost">${card.cost}</span><b>${card.name}</b><div class="unit-art"><img src="${card.artImage}" alt="" /></div><div class="unit-stats"><span class="atk">⚔${unit.attack}</span><i>/</i><span class="hp">❤${unit.health}</span></div><small>${status}</small><span class="unit-type-icon">${typeIcon}</span></div></button>`;
}
function handTag(card) {
  if (card.skill.includes("抽")) return "抽牌";
  if (card.skill.includes("修复")) return "修复";
  if (card.skill.includes("攻击")) return "攻击";
  if (card.skill.includes("行动点")) return "行动";
  return card.faction;
}
function renderHand(id, index) {
  const card = getCard(id);
  const selected = app.selectedBattle?.hand === index ? "selected" : "";
  const typeIcon = cardVisualLabel(card);
  return `<button class="hand-card faction-${factionKey(card.faction)} rarity-${card.rarity} ${selected}" data-hand="${index}"><span class="hand-cost">${card.cost}</span><span class="hand-art"><img src="${card.artImage}" alt="" /></span><b>${card.name}</b><small>${card.type}</small><span class="hand-stat">⚔${card.attack} ❤${card.health}</span><em>${handTag(card)}</em><span class="hand-type-icon">${typeIcon}</span></button>`;
}
function selectHand(index) {
  if (!app.battle?.active) return;
  const card = getCard(app.battle.player.hand[index]);
  const reason = BattleEngine.deployReason(app.battle, "player", index);
  app.selectedBattle = { hand: index };
  renderBattle();
  const deployBtn = reason
    ? `<button class="primary-action" id="deploySelectedBtn" disabled>${reason}</button>`
    : `<button class="primary-action" id="deploySelectedBtn">部署</button>`;
  $("#battleActionPanel").innerHTML = `<div class="action-panel-grid detail"><div class="unit-detail"><b>${card.name}</b><span>费用 ${card.cost} · ${card.type} · ${card.rarity}</span><p class="skill-text">${card.skill}</p><span>⚔${card.attack} ❤${card.health}</span></div><div class="battle-action-buttons">${deployBtn}<button class="secondary-action" id="endTurnBtn">结束回合</button></div></div>`;
}
function selectUnit(uid, owner) {
  if (!app.battle?.active) return;
  const unit = [...app.battle[owner].front, ...app.battle[owner].support].find((u) => u.uid === uid);
  if (!unit) return;
  const card = getCard(unit.cardId);
  const previous = app.selectedBattle;
  if (owner === "enemy" && previous?.uid && previous.owner === "player") {
    app.selectedBattle = { ...previous, targetUid: uid };
    renderBattle();
    const attacker = getCard([...app.battle.player.front, ...app.battle.player.support].find((u) => u.uid === previous.uid).cardId);
    $("#battleActionPanel").innerHTML = `<div class="action-panel-grid detail"><div class="unit-detail"><b>确认目标</b><span>${attacker.name} → ${card.name}</span><p class="skill-text">选择敌方单位作为本次攻击目标。</p></div><button class="primary-action" id="attackTargetBtn">攻击单位</button></div>`;
    return;
  }
  app.selectedBattle = { uid, owner };
  const inSupport = app.battle[owner].support.some((item) => item.uid === uid);
  const target = app.battle.enemy.front[0];
  const moveReason = owner === "player" ? BattleEngine.moveReason(app.battle, "player", uid) : "只能操作我方单位";
  const unitAttackReason = owner === "player" ? BattleEngine.attackReason(app.battle, "player", uid, target?.uid || "hq") : "先选择我方可攻击单位";
  const hqAttackReason = owner === "player" ? BattleEngine.attackReason(app.battle, "player", uid, "hq") : "先选择我方可攻击单位";
  const status = unit.fresh ? "待命" : unit.attacked ? "已行动" : "可行动";
  const playerActions = inSupport
    ? `<div class="battle-action-buttons"><button class="primary-action" id="moveSelectedBtn" ${moveReason ? "disabled" : ""}>推进到前线</button><button class="secondary-action" id="endTurnBtn">结束回合</button></div><small>${moveReason || "可以推进"}</small>`
    : `<div class="battle-action-buttons">${target ? `<button class="secondary-action" id="attackSelectedBtn" ${unitAttackReason ? "disabled" : ""}>攻击单位</button>` : ""}<button class="primary-action" id="attackHqSelectedBtn" ${hqAttackReason ? "disabled" : ""}>攻击总部</button><button class="secondary-action" id="endTurnBtn">结束回合</button></div><small>${unitAttackReason || hqAttackReason || "可以行动"}</small>`;
  renderBattle();
  $("#battleActionPanel").innerHTML = `<div class="action-panel-grid detail"><div class="unit-detail"><b>${card.name}</b><span>⚔${unit.attack} · ❤${unit.health} · ${status}</span><p class="skill-text">${card.skill}</p></div>${owner === "player" ? playerActions : `<small>${unitAttackReason}</small>`}</div>`;
}
async function deploySelected() {
  if (app.animating) return;
  var index = app.selectedBattle?.hand;
  if (index === undefined) return;
  app.animating = true;
  app.selectedBattle = null;
  var result = BattleEngine.deploy(app.battle, "player", index);
  if (!result.ok) { toast(result.reason); app.animating = false; renderBattle(); return; }
  renderBattle();
  if (result.unitUid) applyDeployFx(result.unitUid);
  await delay(700);
  app.animating = false;
}
async function moveSelected() {
  if (app.animating) return;
  var uid = app.selectedBattle?.uid;
  if (!uid) return;
  app.animating = true;
  app.selectedBattle = null;
  /* Phase 1: glow the unit in its current support position so the player sees immediate feedback */
  var supportEl = document.querySelector('[data-unit="' + uid + '"]');
  if (supportEl) {
    supportEl.classList.add("fx-attacking");
    await delay(420);
  }
  /* Phase 2: execute the move and re-render the board */
  var result = BattleEngine.moveToFront(app.battle, "player", uid);
  if (!result.ok) { toast(result.reason); app.animating = false; renderBattle(); return; }
  renderBattle();
  /* Phase 3: bounce-in the unit at the front line (proven setTimeout pattern) */
  if (result.unitUid) applyDeployFx(result.unitUid);
  await delay(700);
  app.animating = false;
}
async function attackSelected() {
  if (app.animating) return;
  var uid = app.selectedBattle?.uid;
  var target = app.battle.enemy.front[0]?.uid || "hq";
  app.animating = true;
  var attackerEl = document.querySelector('[data-unit="' + uid + '"]');
  var targetEl = target === "hq" ? document.querySelector(".hq-bar.enemy") : document.querySelector('[data-unit="' + target + '"]');
  var attackerUnit = [...app.battle.player.front, ...app.battle.player.support].find(function (u) { return u.uid === uid; });
  var attackerHp = attackerUnit ? attackerUnit.health : 0;
  var targetHp = target === "hq" ? app.battle.enemy.hq : (function () { var t = app.battle.enemy.front.find(function (u) { return u.uid === target; }); return t ? t.health : 0; })();
  if (attackerEl) attackerEl.classList.add("fx-attacking");
  if (targetEl) targetEl.classList.add("fx-targeted");
  await delay(550);
  if (attackerEl) { attackerEl.classList.remove("fx-attacking"); attackerEl.classList.add("fx-lunge"); }
  await delay(220);
  if (targetEl) { targetEl.classList.remove("fx-targeted"); targetEl.classList.add("fx-impact"); }
  var result = BattleEngine.attack(app.battle, "player", uid, target);
  if (!result.ok) { toast(result.reason); app.animating = false; renderBattle(); return; }
  if (result.damage > 0 && target === "hq") { var hqEl = document.querySelector(".hq-bar.enemy"); if (hqEl) { hqEl.classList.add("fx-hit"); showDmgNum(hqEl, result.damage, targetHp - result.damage); } }
  if (result.damage > 0 && target !== "hq") showDmgNum(targetEl, result.damage, targetHp - result.damage);
  if (result.counterDamage > 0) showDmgNum(attackerEl, result.counterDamage, attackerHp - result.counterDamage);
  await delay(600);
  if (result.targetKilled && targetEl && target !== "hq") { targetEl.classList.add("fx-destroy"); await delay(750); if (targetEl.parentNode) targetEl.parentNode.removeChild(targetEl); }
  if (result.attackerKilled && attackerEl) { attackerEl.classList.add("fx-destroy"); await delay(750); if (attackerEl.parentNode) attackerEl.parentNode.removeChild(attackerEl); }
  app.selectedBattle = null;
  renderBattle();
  app.animating = false;
}
async function attackHqSelected() {
  if (app.animating) return;
  var uid = app.selectedBattle?.uid;
  app.animating = true;
  var attackerEl = document.querySelector('[data-unit="' + uid + '"]');
  var hqEl = document.querySelector(".hq-bar.enemy");
  var attackerUnit = [...app.battle.player.front, ...app.battle.player.support].find(function (u) { return u.uid === uid; });
  var attackerHp = attackerUnit ? attackerUnit.health : 0;
  var hqHp = app.battle.enemy.hq;
  if (attackerEl) attackerEl.classList.add("fx-attacking");
  if (hqEl) hqEl.classList.add("fx-targeted");
  await delay(550);
  if (attackerEl) { attackerEl.classList.remove("fx-attacking"); attackerEl.classList.add("fx-lunge"); }
  await delay(220);
  if (hqEl) { hqEl.classList.remove("fx-targeted"); hqEl.classList.add("fx-impact"); }
  var result = BattleEngine.attack(app.battle, "player", uid, "hq");
  if (!result.ok) { toast(result.reason); app.animating = false; renderBattle(); return; }
  if (result.damage > 0 && hqEl) { hqEl.classList.add("fx-hit"); showDmgNum(hqEl, result.damage, hqHp - result.damage); }
  await delay(600);
  app.selectedBattle = null;
  renderBattle();
  app.animating = false;
}
async function attackTarget() {
  if (app.animating) return;
  var uid = app.selectedBattle?.uid;
  var targetUid = app.selectedBattle?.targetUid;
  app.animating = true;
  var attackerEl = document.querySelector('[data-unit="' + uid + '"]');
  var targetEl = document.querySelector('[data-unit="' + targetUid + '"]');
  var attackerUnit = [...app.battle.player.front, ...app.battle.player.support].find(function (u) { return u.uid === uid; });
  var attackerHp = attackerUnit ? attackerUnit.health : 0;
  var targetUnit = [...app.battle.enemy.front, ...app.battle.enemy.support].find(function (u) { return u.uid === targetUid; });
  var targetHp = targetUnit ? targetUnit.health : 0;
  if (attackerEl) attackerEl.classList.add("fx-attacking");
  if (targetEl) targetEl.classList.add("fx-targeted");
  await delay(550);
  if (attackerEl) { attackerEl.classList.remove("fx-attacking"); attackerEl.classList.add("fx-lunge"); }
  await delay(220);
  if (targetEl) { targetEl.classList.remove("fx-targeted"); targetEl.classList.add("fx-impact"); }
  var result = BattleEngine.attack(app.battle, "player", uid, targetUid);
  if (!result.ok) { toast(result.reason); app.animating = false; renderBattle(); return; }
  if (result.damage > 0) showDmgNum(targetEl, result.damage, targetHp - result.damage);
  if (result.counterDamage > 0) showDmgNum(attackerEl, result.counterDamage, attackerHp - result.counterDamage);
  await delay(600);
  if (result.targetKilled && targetEl) { targetEl.classList.add("fx-destroy"); await delay(750); if (targetEl.parentNode) targetEl.parentNode.removeChild(targetEl); }
  if (result.attackerKilled && attackerEl) { attackerEl.classList.add("fx-destroy"); await delay(750); if (attackerEl.parentNode) attackerEl.parentNode.removeChild(attackerEl); }
  app.selectedBattle = null;
  renderBattle();
  app.animating = false;
}
function endTurn() {
  if (!app.battle?.active) return;
  if (app.animating) return;
  if (!BattleEngine.hasAction(app.battle)) {
    runEnemyTurn();
    return;
  }
  var count = 0;
  var b = app.battle;
  b.player.hand.forEach(function (_, i) { if (!BattleEngine.deployReason(b, "player", i)) count++; });
  b.player.support.forEach(function (u) { if (!BattleEngine.moveReason(b, "player", u.uid)) count++; });
  b.player.front.forEach(function (u) { if (!BattleEngine.attackReason(b, "player", u.uid, b.enemy.front[0]?.uid || "hq")) count++; });
  showEndTurnDialog(count);
}
function runEnemyTurn() {
  app.animating = true;
  app.selectedBattle = null;
  BattleEngine.endPlayerTurn(app.battle);
  renderBattle();
  playAiReplay();
}
async function playAiReplay() {
  var banner = $("#enemyTurnBanner");
  if (banner) banner.hidden = false;
  await delay(600);
  var guard = 0;
  var action;
  while ((action = BattleEngine.planNextEnemyAction(app.battle)) && guard < 8) {
    guard++;
    var announceText = "";
    if (action.type === "attack") {
      var preAttacker = [...app.battle.enemy.front, ...app.battle.enemy.support].find(function (u) { return u.uid === action.attackerUid; });
      var preName = preAttacker ? getCard(preAttacker.cardId).name : "敌方";
      if (action.targetUid === "hq") announceText = preName + " 攻击总部";
      else {
        var preTarget = [...app.battle.player.front, ...app.battle.player.support].find(function (u) { return u.uid === action.targetUid; });
        announceText = preName + " 攻击 " + (preTarget ? getCard(preTarget.cardId).name : "目标");
      }
    } else if (action.type === "advance") {
      var preUnit = app.battle.enemy.support.find(function (u) { return u.uid === action.unitUid; });
      announceText = (preUnit ? getCard(preUnit.cardId).name : "敌方") + " 推进前线";
    } else if (action.type === "deploy") {
      var preCardId = app.battle.enemy.hand[action.handIndex];
      announceText = "部署 " + getCard(preCardId).name;
    } else if (action.type === "tactic") {
      var preTacticId = app.battle.enemy.hand[action.handIndex];
      announceText = "使用 " + getCard(preTacticId).name;
    }
    var announceEl = showAnnounce(announceText);
    await delay(400);
    if (action.type === "attack") {
      var atkEl = document.querySelector('[data-unit="' + action.attackerUid + '"]');
      var tgtEl = action.targetUid === "hq" ? document.querySelector(".hq-bar.ally") : document.querySelector('[data-unit="' + action.targetUid + '"]');
      var aiAttackerHp = preAttacker ? preAttacker.health : 0;
      var aiTargetHp = action.targetUid === "hq" ? app.battle.player.hq : (function () { var pt = [...app.battle.player.front, ...app.battle.player.support].find(function (u) { return u.uid === action.targetUid; }); return pt ? pt.health : 0; })();
      if (atkEl) atkEl.classList.add("fx-attacking");
      if (tgtEl) tgtEl.classList.add("fx-targeted");
      await delay(550);
      if (atkEl) { atkEl.classList.remove("fx-attacking"); atkEl.classList.add("fx-lunge"); }
      await delay(220);
      var aiResult = BattleEngine.executeEnemyAction(app.battle, action);
      if (tgtEl) { tgtEl.classList.remove("fx-targeted"); tgtEl.classList.add("fx-impact"); }
      if (aiResult.damage > 0 && tgtEl) { tgtEl.classList.add("fx-hit"); showDmgNum(tgtEl, aiResult.damage, aiTargetHp - aiResult.damage); }
      if (aiResult.counterDamage > 0 && atkEl) showDmgNum(atkEl, aiResult.counterDamage, aiAttackerHp - aiResult.counterDamage);
      await delay(600);
      if (aiResult.targetKilled && tgtEl && action.targetUid !== "hq") { tgtEl.classList.add("fx-destroy"); await delay(750); if (tgtEl.parentNode) tgtEl.parentNode.removeChild(tgtEl); }
      if (aiResult.attackerKilled && atkEl) { atkEl.classList.add("fx-destroy"); await delay(750); if (atkEl.parentNode) atkEl.parentNode.removeChild(atkEl); }
      renderBattle();
    } else if (action.type === "advance") {
      var advResult = BattleEngine.executeEnemyAction(app.battle, action);
      renderBattle();
      if (advResult.unitUid) applyDeployFx(advResult.unitUid);
      await delay(650);
    } else if (action.type === "deploy") {
      var depResult = BattleEngine.executeEnemyAction(app.battle, action);
      renderBattle();
      if (depResult.unitUid) applyDeployFx(depResult.unitUid);
      await delay(650);
    } else if (action.type === "tactic") {
      BattleEngine.executeEnemyAction(app.battle, action);
      renderBattle();
      await delay(400);
    }
    hideAnnounce(announceEl);
    await delay(500);
    if (!app.battle.active) break;
  }
  BattleEngine.endEnemyTurn(app.battle);
  renderBattle();
  if (banner) banner.hidden = true;
  app.animating = false;
}
function showEndTurnDialog(count) {
  var overlay = $("#endTurnOverlay");
  if (!overlay) return;
  var countEl = $("#endTurnActionCount");
  if (countEl) countEl.textContent = count;
  overlay.hidden = false;
  playSfx("click");
}
function hideEndTurnDialog(confirmed) {
  var overlay = $("#endTurnOverlay");
  if (overlay) overlay.hidden = true;
  if (confirmed) runEnemyTurn();
}
function renderBattleReward() { if (app.battle.lastRewarded) return; app.battle.lastRewarded = true; app.progress.battles.played += 1; if (app.battle.winner === "player") { app.progress.battles.wins += 1; app.progress.stars += 3; app.progress.supplies += 2; app.progress.packProgress += 1; app.progress.xp += 5; } else { app.progress.battles.losses += 1; app.progress.supplies += 1; app.progress.xp += 2; } saveProgress(); checkLevelUp(); }
function renderParent() {
  app.settings = { ...app.settings, ...app.progress.settings };
  $("#autoSpeakToggle").checked = app.settings.autoSpeak;
  $("#parentStats").innerHTML = `<div><strong>${app.progress.stars}</strong><span>星星</span></div><div><strong>${app.progress.supplies}</strong><span>补给点</span></div><div><strong>${uniqueOwned()}</strong><span>已获卡</span></div><div><strong>${app.progress.battles.played}</strong><span>对战局</span></div>`;
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const view = event.target.closest("[data-view]");
    if (view) { hideBattleResultModal(); showView(view.dataset.view); if (view.dataset.cardTab) setCardTab(view.dataset.cardTab); }
    const start = event.target.closest("[data-start-learn]"); if (start) startLearning(start.dataset.startLearn);
    const answer = event.target.closest("[data-answer]"); if (answer) answerQuestion(answer.dataset.answer);
    const tab = event.target.closest("[data-tab]"); if (tab) setCardTab(tab.dataset.tab);
    const filter = event.target.closest("[data-filter-key]"); if (filter) { app.filters[filter.dataset.filterKey] = filter.dataset.filterValue; renderCards(); }
    const theme = event.target.closest("[data-theme]"); if (theme) { app.selectedTheme = theme.dataset.theme; renderTrain(); playSfx("click"); }
    const add = event.target.closest("[data-add-card]"); if (add) { addCardToDeck(add.dataset.addCard); return; }
    const detail = event.target.closest("[data-card-detail]"); if (detail) { app.selectedCard = detail.dataset.cardDetail; renderCards(); }
    const remove = event.target.closest("[data-remove-card]"); if (remove) removeCardFromDeck(remove.dataset.removeCard);
    const hand = event.target.closest("[data-hand]"); if (hand) selectHand(Number(hand.dataset.hand));
    const unit = event.target.closest("[data-unit]"); if (unit) selectUnit(unit.dataset.unit, unit.dataset.owner);
    const diff = event.target.closest("[data-ai]"); if (diff) { app.selectedDifficulty = Number(diff.dataset.ai); renderBattleLobby(); playSfx("click"); }
    if (event.target.closest("#nextQuestionBtn")) nextQuestion();
    if (event.target.closest("#openPackBtn")) { setCardTab("pack"); openSupplyPack(); }
    if (event.target.closest("#baseOpenPackBtn")) { setCardTab("pack"); showView("cards"); if (app.progress.supplies >= PACK_COST) openSupplyPack(); else claimLearningPack(); }
    if (event.target.closest("#claimLearningPackBtn")) claimLearningPack();
    if (event.target.closest("#crateActionBtn")) { const track = packTrack(); if (app.progress.supplies >= PACK_COST) { showView("cards"); openSupplyPack(); } else if (track.ready) { showView("cards"); claimLearningPack(); } else showView("train"); }
    if (event.target.closest("#openAgainBtn")) openSupplyPack();
    if (event.target.closest("#autoFillDeckBtn")) autoFillDeck();
    if (event.target.closest("#saveDeckBtn")) { saveProgress(); toast("卡组已保存"); }
    if (event.target.closest("#startBattleBtn") || event.target.closest("#restartBattleBtn")) { hideBattleResultModal(); startBattle(); }
    if (event.target.closest("#battleBackBtn")) { hideBattleResultModal(); backToBattleLobby(); }
    if (event.target.closest("#endTurnConfirmBtn")) { hideEndTurnDialog(true); }
    if (event.target.closest("#endTurnCancelBtn")) { hideEndTurnDialog(false); }
    if (event.target.closest("#battleExitConfirmBtn")) {
      var overlay = $("#battleExitOverlay");
      if (overlay) overlay.hidden = true;
      if (app.battle?.active) { app.battle.active = false; app.battle.winner = "enemy"; renderBattleReward(); }
      hideBattleResultModal();
      app.battleMode = "lobby";
      showView("base");
    }
    if (event.target.closest("#battleExitCancelBtn")) {
      var overlay2 = $("#battleExitOverlay");
      if (overlay2) overlay2.hidden = true;
      try { app._pushingState = true; history.pushState({}, "", ""); } catch (e) {}
      setTimeout(function () { app._pushingState = false; }, 100);
    }
    if (event.target.closest("#trainExitConfirmBtn")) {
      var ov = $("#trainExitOverlay");
      if (ov) ov.hidden = true;
      app.round = null;
      showView("base");
    }
    if (event.target.closest("#trainExitCancelBtn")) {
      var ov2 = $("#trainExitOverlay");
      if (ov2) ov2.hidden = true;
      try { app._pushingState = true; history.pushState({}, "", ""); } catch (e) {}
      setTimeout(function () { app._pushingState = false; }, 100);
    }
    if (event.target.closest("#deploySelectedBtn")) deploySelected();
    if (event.target.closest("#moveSelectedBtn")) moveSelected();
    if (event.target.closest("#attackSelectedBtn")) attackSelected();
    if (event.target.closest("#attackHqSelectedBtn")) attackHqSelected();
    if (event.target.closest("#attackTargetBtn")) attackTarget();
    if (event.target.closest("#endTurnBtn")) endTurn();
    if (event.target.closest("#battleLog")) event.target.closest("#battleLog").classList.toggle("expanded");
  });
  // Intercept Android back button/gesture via popstate
  window.addEventListener("popstate", function () {
    if (app._pushingState) return;
    goBack();
  });
  $("#listenBtn").addEventListener("click", () => { if (app.round?.mode !== "math") speak(app.round.question.answer.id); });
  $("#autoSpeakToggle").addEventListener("change", (event) => { app.settings.autoSpeak = event.target.checked; saveProgress(); });
  $("#resetBtn").addEventListener("click", () => { if (!confirm("确定清空本机学习、卡牌和对战进度吗？")) return; if (!confirm("再次确认：清空后不能恢复，继续吗？")) return; localStorage.removeItem(STORAGE_KEY); app.progress = loadProgress(); app.battle = null; render(); toast("本机进度已清空"); });
}
function setCardTab(tab) { app.cardTab = tab; renderCards(); }
function initPwa() { if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {}); }
function init() { app.progress = loadProgress(); app.settings = { ...app.settings, ...app.progress.settings }; bindEvents(); render(); initPwa(); try { history.pushState({ view: "base" }, "", ""); } catch (e) {} }
init();



