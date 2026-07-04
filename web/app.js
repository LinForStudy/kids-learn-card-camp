const STORAGE_KEY = "kids-learn-card-camp-state-v1";
const PACK_COST = 6;
const DECK_LIMIT = 12;
const TODAY_GOAL = 5;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const app = {
  view: "base",
  cardTab: "pack",
  filters: { faction: "全部", rarity: "全部", cost: "全部" },
  round: null,
  battleMode: "lobby",
  battle: null,
  selectedBattle: null,
  selectedCard: "",
  currentAudio: null,
  settings: { autoSpeak: true },
  progress: null
};

function starterCollection() {
  const collection = {};
  DEFAULT_DECKS[0].cards.forEach((id) => collection[id] = (collection[id] || 0) + 1);
  return collection;
}

function fallbackProgress() {
  return {
    level: 1,
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
    settings: { autoSpeak: true }
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
function todayProgress() { return Math.min(TODAY_GOAL, app.progress.daily.correct % TODAY_GOAL); }
function pct(value, total) { return `${Math.max(0, Math.min(100, Math.round((value / total) * 100)))}%`; }
function sample(list, count) { return [...list].sort(() => Math.random() - 0.5).slice(0, count); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200); }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }

function showView(view) {
  app.view = view;
  if (view === "battle" && !app.battle?.active && app.battleMode !== "playing") app.battleMode = "lobby";
  $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === `${view}Screen`));
  $$(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === view));
  renderShellChrome();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderShellChrome() {
  document.body.classList.toggle("battle-playing", app.view === "battle" && app.battleMode === "playing");
  document.body.classList.toggle("learning-playing", app.view === "play");
}

function render() {
  renderBase();
  renderTrain();
  renderCards();
  renderBattle();
  renderParent();
}

const FACTION_KEYS = { "\u94a2\u94c1\u8425": "steel", "\u5929\u7a7a\u961f": "sky", "\u8865\u7ed9\u961f": "supply", "\u5b88\u5907\u961f": "guard", "\u6218\u672f\u961f": "tactic", "\u5148\u950b\u961f": "vanguard" };
function factionKey(faction) { return FACTION_KEYS[faction] || "neutral"; }
function cardVisualLabel(card) { return `${card.artKey || "\u2605"}`; }

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
function renderMiniCard(card) { return `<div class="card-mini faction-${factionKey(card.faction)}"><span>${card.cost} \u00b7 ${card.faction}</span><b>${card.name}</b><small>\u653b${card.attack}/\u8840${card.health}</small></div>`; }


function renderBase() {
  const track = packTrack();
  const today = todayProgress();
  $("#levelText").textContent = `Lv.${app.progress.level}`;
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
  $("#baseDeckCards").innerHTML = app.progress.deck.slice(0, 5).map((id) => renderMiniCard(getCard(id))).join("");
}


function renderTrain() {
  const today = todayProgress();
  $("#trainGoalText").textContent = `\u7b54\u5bf9 ${TODAY_GOAL} \u9898\uff0c\u8865\u7ed9\u8fdb\u5ea6 +${TODAY_GOAL}`;
  $("#trainGoalBar").style.width = pct(today, TODAY_GOAL);
  $("#englishToday").textContent = `\u4eca\u65e5\u5b8c\u6210\uff1a${app.progress.daily.englishRounds} \u5c40`;
  $("#mathLevelText").textContent = `\u5f53\u524d\u96be\u5ea6\uff1aLv.${app.progress.math.level + 1} ${MATH_LEVELS[app.progress.math.level].name}`;
  $("#recentRewardHint").textContent = app.progress.recentRewards[0] || "\u6682\u65e0";
  $("#recentRewards").innerHTML = app.progress.recentRewards.length ? app.progress.recentRewards.map((item) => `<span class="status-pill">${item}</span>`).join("") : `<span class="status-pill">\u5b8c\u6210\u8bad\u7ec3\u540e\u4f1a\u663e\u793a</span>`;
}

function pickEnglishQuestion(mode) {
  const answer = sample(WORD_BANK, 1)[0] || WORD_BANK[0];
  const options = sample([answer, ...sample(WORD_BANK.filter((item) => item.id !== answer.id), 3)], 4);
  return { kind: "english", mode, answer, options };
}
function pickMathQuestion() { return { kind: "math", ...makeMathQuestion(app.progress.math.level) }; }
function startLearning(mode) {
  app.round = { mode, total: 5, index: 0, correct: 0, answered: false, wrong: "", question: mode === "math" ? pickMathQuestion() : pickEnglishQuestion(mode) };
  showView("play");
  renderPlay();
  if (mode !== "math" && app.settings.autoSpeak) setTimeout(() => speak(app.round.question.answer.id), 180);
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
    $("#answerFeedback").innerHTML = `<div class="feedback-card"><h3>再试一次</h3><p>这题不扣分，想一想再选。</p><button class="secondary-action" onclick="renderPlay()">再想想</button><button class="secondary-action" onclick="showHint()">给我提示</button></div>`;
    renderWrongButtons();
    return;
  }
  round.answered = true;
  round.correct += 1;
  app.progress.stars += 2;
  app.progress.packProgress += 1;
  app.progress.daily.correct += 1;
  if (round.mode === "math") updateMathLevel(1, 1); else {
    app.progress.learned[q.answer.id] = (app.progress.learned[q.answer.id] || 0) + 1;
    app.progress.mastered[q.answer.id] = (app.progress.mastered[q.answer.id] || 0) + 1;
  }
  app.progress.recentRewards.unshift("学习点 +2 · 补给进度 +1");
  app.progress.recentRewards = app.progress.recentRewards.slice(0, 8);
  saveProgress();
  $("#answerFeedback").innerHTML = `<div class="feedback-card"><h3>太棒了！</h3><p>正确答案！学习点 +2，补给进度 +1。</p><button class="primary-action" id="nextQuestionBtn">${round.index >= round.total - 1 ? "完成训练" : "下一题"}</button></div>`;
  $$(".answer-btn").forEach((btn) => { btn.disabled = true; if (btn.dataset.answer === value) btn.classList.add("correct"); });
}
function showHint() { toast(app.round?.mode === "math" ? "可以先拆成十位和个位来想。" : "看一看图片和单词开头。"); }
function renderWrongButtons() { $$(".answer-btn").forEach((btn) => btn.classList.toggle("wrong", btn.dataset.answer === app.round.wrong)); }
function nextQuestion() {
  const round = app.round;
  if (!round) return;
  if (round.index >= round.total - 1) {
    if (round.mode === "math") app.progress.daily.mathRounds += 1; else app.progress.daily.englishRounds += 1;
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
  if (correct === total) math.streak += 1;
  if (math.streak >= 4 && math.level < MATH_LEVELS.length - 1) { math.level += 1; math.streak = 0; }
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
  app.progress.recentRewards.unshift(`${source === "learning" ? "学习" : "标准"}补给箱 +3 张`);
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
}
function renderPackResult(result) {
  $("#packResult").innerHTML = `<h2>${result.some((item) => !item.duplicate) ? "获得新卡！" : "获得重复卡"}</h2><div class="pack-cards">${result.map(({ card, duplicate }) => renderCardFrame(card, { compact: true, duplicate })).join("")}</div><div class="mission-actions"><button class="secondary-action" data-tab="deck">去组卡</button><button class="primary-action" id="openAgainBtn">继续开包</button></div>`;
}

const factionOptions = ["全部", "钢铁营", "天空队", "补给队", "守备队", "战术队", "先锋队"];
const rarityOptions = ["全部", "普通", "稀有", "史诗", "传说"];
const costOptions = ["全部", "0", "1", "2", "3", "4", "5+"];
function renderCards() {
  if (!app.selectedCard || !getCard(app.selectedCard)) app.selectedCard = app.progress.recentCards[0] || app.progress.deck[0] || CARD_POOL[0]?.id || "";
  const track = packTrack();
  if ($("#libraryStars")) $("#libraryStars").textContent = app.progress.stars;
  if ($("#librarySupplies")) $("#librarySupplies").textContent = app.progress.supplies;
  if ($("#libraryPack")) $("#libraryPack").textContent = track.ready ? `${track.ready}\u7bb1` : `${track.current}/${PACK_COST}`;
  if ($("#libraryOwned")) $("#libraryOwned").textContent = `${uniqueOwned()}/${CARD_POOL.length}`;
  if ($("#libraryDeckName")) $("#libraryDeckName").textContent = deckName();
  if ($("#libraryDeckMetaText")) $("#libraryDeckMetaText").textContent = `${app.progress.deck.length}/12 \u00b7 ${deckStyle()} \u00b7 \u5e73\u5747\u8d39\u7528 ${deckAverageCost()}`;
  if ($("#libraryDeckCards")) $("#libraryDeckCards").innerHTML = app.progress.deck.slice(0, 4).map((id) => renderMiniCard(getCard(id))).join("");
  $$(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === app.cardTab));
  $$(".card-tab-pane").forEach((pane) => pane.classList.toggle("active", pane.id === `${app.cardTab}Pane`));
  renderPackPane();
  renderFilters();
  renderCollection();
  renderDeckBuilder();
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
  $("#factionFilters").innerHTML = factionOptions.map((item) => filterChip("faction", item)).join("");
  $("#rarityFilters").innerHTML = rarityOptions.map((item) => filterChip("rarity", item)).join("");
  $("#costFilters").innerHTML = costOptions.map((item) => filterChip("cost", item)).join("");
}
function filterChip(key, value) { return `<button class="filter-chip ${app.filters[key] === value ? "active" : ""}" data-filter-key="${key}" data-filter-value="${value}">${value}</button>`; }
function filteredCards() {
  return CARD_POOL.filter((card) => {
    const costGroup = card.cost >= 5 ? "5+" : String(card.cost);
    return (app.filters.faction === "全部" || card.faction === app.filters.faction) && (app.filters.rarity === "全部" || card.rarity === app.filters.rarity) && (app.filters.cost === "全部" || costGroup === app.filters.cost);
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
function renderCardFrame(card, opts = {}) {
  const count = owned(card.id);
  const inDeck = deckCardCount(app.progress.deck, card.id);
  const locked = !count;
  const canAdd = count > inDeck && app.progress.deck.length < DECK_LIMIT && inDeck < card.maxCopies;
  const ownedText = opts.duplicate ? "\u91cd\u590d\u8f6c\u5fbd\u7ae0" : `\u62e5\u6709 ${count}`;
  const key = factionKey(card.faction);
  const addControl = opts.compact || opts.detail ? "" : `<button class="card-add-btn" data-add-card="${card.id}" ${canAdd ? "" : "disabled"}>\u52a0\u5165</button>`;
  return `<article class="card-frame card-full rarity-${card.rarity} faction-${key} ${locked ? "locked" : ""} ${opts.compact ? "compact-card" : ""} ${opts.detail ? "detail-card" : ""}" data-card-detail="${card.id}">
    <div class="card-top"><span class="card-cost"><b>${card.cost}</b><small>\u884c\u52a8</small></span><span class="card-rarity">${card.rarity}</span></div>
    <div class="card-title-row"><h3>${card.name}</h3><span class="card-faction"><img src="assets/ui/faction-${key}.svg" alt="" />${card.faction}</span></div>
    <div class="card-art"><span>${cardVisualLabel(card)}</span><em>${card.type}</em></div>
    <p class="card-skill">${card.skill}</p>
    <div class="card-stats"><span><b>${card.attack}</b>\u653b\u51fb</span><span><b>${card.health}</b>\u751f\u547d</span></div>
    <div class="card-footer"><span>${ownedText}</span><span>\u5361\u7ec4 ${inDeck}</span>${addControl}</div>
  </article>`;
}
function renderDeckBuilder() {
  $("#deckTitle").textContent = deckName();
  $("#deckCount").textContent = `${app.progress.deck.length}/12`;
  renderCurve();
  renderDeckRules();
  const grouped = [...new Set(app.progress.deck)].map((id) => ({ id, count: deckCardCount(app.progress.deck, id), card: getCard(id) }));
  $("#deckList").innerHTML = grouped.map(({ id, count, card }) => `<div class="deck-row"><span class="cost-dot">${card.cost}</span><div><strong>${card.name}</strong><br><small>${card.faction} · ${card.type} · 攻${card.attack} 血${card.health}</small></div><span>x${count}</span><button data-remove-card="${id}">移出</button></div>`).join("");
}
function renderCurve() {
  const groups = [1, 2, 3, 4, 5].map((cost) => app.progress.deck.filter((id) => cost === 5 ? getCard(id).cost >= 5 : getCard(id).cost === cost).length);
  const max = Math.max(1, ...groups);
  $("#curvePanel").innerHTML = `<div class="panel-title"><span>费用曲线</span><b>平均 ${deckAverageCost()}</b></div><div class="curve-bars">${groups.map((count, index) => `<div class="curve-item"><i style="height:${22 + count / max * 70}px"></i><span>${index === 4 ? "5+" : index + 1}费</span><b>${count}</b></div>`).join("")}</div>`;
}
function renderDeckRules() {
  const units = app.progress.deck.filter((id) => !["战术指令", "补给", "防御工事"].includes(getCard(id).type)).length;
  const support = app.progress.deck.length - units;
  const duplicateOverflow = [...new Set(app.progress.deck)].some((id) => deckCardCount(app.progress.deck, id) > Math.min(2, getCard(id).maxCopies));
  const valid = app.progress.deck.length === DECK_LIMIT && units >= 8 && support >= 2 && !duplicateOverflow;
  $("#deckRules").innerHTML = `<div class="panel-title"><span>组卡规则</span><b>${valid ? "规则通过" : "需要调整"}</b></div><div class="status-grid"><span class="status-pill">单位 ${units}/8+</span><span class="status-pill">辅助 ${support}/2+</span><span class="status-pill">风格 ${deckStyle()}</span><span class="status-pill">徽章 ${app.progress.badges}</span></div>`;
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
  const aiDeck = AI_DECKS.find((deck) => deck.id === "balanced") || AI_DECKS[0];
  app.battle = BattleEngine.createBattle(app.progress.deck, aiDeck.cards);
  app.battle.challengeName = "新手演练";
  app.battle.enemyStyle = "均衡";
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
  $("#battleLobbyDeckName").textContent = deckName();
  $("#battleLobbyDeckCount").textContent = `${app.progress.deck.length}/${DECK_LIMIT}`;
  $("#battleLobbyDeckStyle").textContent = deckStyle();
  $("#battleLobbyDeckCards").innerHTML = app.progress.deck.slice(0, 6).map((id) => renderMiniCard(getCard(id))).join("");
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
    const win = app.battle?.winner === "player";
    $("#battleActionPanel").innerHTML = `<div class="result-panel"><h2>${win ? "胜利！" : "演练结束"}</h2><p>${win ? "奖励：星星 +3，补给点 +2，卡包进度 +1。" : "本局已完成复盘，补给点 +1。"}</p><div class="mission-actions"><button class="secondary-action" id="battleBackBtn">返回战场</button><button class="secondary-action" data-view="cards" data-card-tab="deck">调整卡组</button><button class="primary-action" id="restartBattleBtn">再来一局</button></div></div>`;
    return;
  }
  $("#battleActionPanel").innerHTML = `<div class="action-panel-grid compact"><div><b>请选择手牌或单位</b><span>部署、推进或攻击都从这里确认。</span></div><button class="primary-action" id="endTurnBtn">结束回合</button></div>`;
}
function renderHq(owner) {
  const s = app.battle[owner];
  const isPlayer = owner === "player";
  return `<div class="hq-bar ${isPlayer ? "ally" : "enemy"}"><strong>${isPlayer ? "我方总部" : "敌方总部"}</strong><span>生命 ${Math.max(0, s.hq)}</span><span>行动点 ${s.action}/${s.maxAction}</span>${isPlayer ? "" : `<span>手牌 ${s.hand.length}</span>`}</div>`;
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
  return `<button class="battle-slot active ${unit.owner} ${zone} ${actionable}" data-unit="${unit.uid}" data-owner="${unit.owner}"><div class="unit-card faction-${factionKey(card.faction)} ${selected} ${unit.attacked ? "spent" : ""}"><b>${card.name}</b><div class="unit-stats"><span>${unit.attack}</span><i>/</i><span>${unit.health}</span></div><small>${status}</small></div></button>`;
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
  return `<button class="hand-card faction-${factionKey(card.faction)} ${selected}" data-hand="${index}"><span class="hand-cost">${card.cost}</span><span class="hand-art">${cardVisualLabel(card)}</span><b>${card.name}</b><small>${card.type}</small><span class="hand-stat">${card.attack}/${card.health}</span><em>${handTag(card)}</em></button>`;
}
function selectHand(index) {
  if (!app.battle?.active) return;
  const card = getCard(app.battle.player.hand[index]);
  app.selectedBattle = { hand: index };
  renderBattle();
  $("#battleActionPanel").innerHTML = `<div class="action-panel-grid detail"><div><b>${card.name}</b><span>费用 ${card.cost} · ${card.type}</span><p>${card.skill}</p></div><button class="primary-action" id="deploySelectedBtn">部署</button></div>`;
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
    $("#battleActionPanel").innerHTML = `<div class="action-panel-grid detail"><div><b>确认目标</b><span>${attacker.name} → ${card.name}</span><p>选择敌方单位作为本次攻击目标。</p></div><button class="primary-action" id="attackTargetBtn">攻击单位</button></div>`;
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
    ? `<div class="battle-action-buttons"><button class="primary-action" id="moveSelectedBtn" ${moveReason ? "disabled" : ""}>推进到前线</button></div><small>${moveReason || "可以推进"}</small>`
    : `<div class="battle-action-buttons">${target ? `<button class="secondary-action" id="attackSelectedBtn" ${unitAttackReason ? "disabled" : ""}>攻击单位</button>` : ""}<button class="primary-action" id="attackHqSelectedBtn" ${hqAttackReason ? "disabled" : ""}>攻击总部</button></div><small>${unitAttackReason || hqAttackReason || "可以行动"}</small>`;
  renderBattle();
  $("#battleActionPanel").innerHTML = `<div class="action-panel-grid detail"><div><b>${card.name}</b><span>攻击 ${unit.attack} · 生命 ${unit.health} · ${status}</span><p>${card.skill}</p></div>${owner === "player" ? playerActions : `<small>${unitAttackReason}</small>`}</div>`;
}
function deploySelected() { const index = app.selectedBattle?.hand; if (index === undefined) return; const result = BattleEngine.deploy(app.battle, "player", index); if (!result.ok) toast(result.reason); app.selectedBattle = null; renderBattle(); }
function moveSelected() { const uid = app.selectedBattle?.uid; const result = BattleEngine.moveToFront(app.battle, "player", uid); if (!result.ok) toast(result.reason); app.selectedBattle = null; renderBattle(); }
function attackSelected() { const uid = app.selectedBattle?.uid; const target = app.battle.enemy.front[0]?.uid || "hq"; const result = BattleEngine.attack(app.battle, "player", uid, target); if (!result.ok) toast(result.reason); app.selectedBattle = null; renderBattle(); }
function attackHqSelected() { const uid = app.selectedBattle?.uid; const result = BattleEngine.attack(app.battle, "player", uid, "hq"); if (!result.ok) toast(result.reason); app.selectedBattle = null; renderBattle(); }
function attackTarget() { const result = BattleEngine.attack(app.battle, "player", app.selectedBattle?.uid, app.selectedBattle?.targetUid); if (!result.ok) toast(result.reason); app.selectedBattle = null; renderBattle(); }
function endTurn() { if (!app.battle?.active) return; if (BattleEngine.hasAction(app.battle) && !confirm("还有单位可以行动，确定结束回合吗？")) return; BattleEngine.endPlayerTurn(app.battle); app.selectedBattle = null; renderBattle(); }
function renderBattleReward() { if (app.battle.lastRewarded) return; app.battle.lastRewarded = true; app.progress.battles.played += 1; if (app.battle.winner === "player") { app.progress.battles.wins += 1; app.progress.stars += 3; app.progress.supplies += 2; app.progress.packProgress += 1; } else { app.progress.battles.losses += 1; app.progress.supplies += 1; } saveProgress(); }
function renderParent() {
  app.settings = { ...app.settings, ...app.progress.settings };
  $("#autoSpeakToggle").checked = app.settings.autoSpeak;
  $("#parentStats").innerHTML = `<div><strong>${app.progress.stars}</strong><span>星星</span></div><div><strong>${app.progress.supplies}</strong><span>补给点</span></div><div><strong>${uniqueOwned()}</strong><span>已获卡</span></div><div><strong>${app.progress.battles.played}</strong><span>对战局</span></div>`;
}

function bindEvents() {
  document.body.addEventListener("click", (event) => {
    const view = event.target.closest("[data-view]");
    if (view) { showView(view.dataset.view); if (view.dataset.cardTab) setCardTab(view.dataset.cardTab); }
    const start = event.target.closest("[data-start-learn]"); if (start) startLearning(start.dataset.startLearn);
    const answer = event.target.closest("[data-answer]"); if (answer) answerQuestion(answer.dataset.answer);
    const tab = event.target.closest("[data-tab]"); if (tab) setCardTab(tab.dataset.tab);
    const filter = event.target.closest("[data-filter-key]"); if (filter) { app.filters[filter.dataset.filterKey] = filter.dataset.filterValue; renderCards(); }
    const add = event.target.closest("[data-add-card]"); if (add) { addCardToDeck(add.dataset.addCard); return; }
    const detail = event.target.closest("[data-card-detail]"); if (detail) { app.selectedCard = detail.dataset.cardDetail; renderCards(); }
    const remove = event.target.closest("[data-remove-card]"); if (remove) removeCardFromDeck(remove.dataset.removeCard);
    const hand = event.target.closest("[data-hand]"); if (hand) selectHand(Number(hand.dataset.hand));
    const unit = event.target.closest("[data-unit]"); if (unit) selectUnit(unit.dataset.unit, unit.dataset.owner);
    if (event.target.closest("#nextQuestionBtn")) nextQuestion();
    if (event.target.closest("#openPackBtn")) { setCardTab("pack"); openSupplyPack(); }
    if (event.target.closest("#baseOpenPackBtn")) { setCardTab("pack"); showView("cards"); if (app.progress.supplies >= PACK_COST) openSupplyPack(); else claimLearningPack(); }
    if (event.target.closest("#claimLearningPackBtn")) claimLearningPack();
    if (event.target.closest("#crateActionBtn")) { const track = packTrack(); if (app.progress.supplies >= PACK_COST) { showView("cards"); openSupplyPack(); } else if (track.ready) { showView("cards"); claimLearningPack(); } else showView("train"); }
    if (event.target.closest("#openAgainBtn")) openSupplyPack();
    if (event.target.closest("#autoFillDeckBtn")) autoFillDeck();
    if (event.target.closest("#saveDeckBtn")) { saveProgress(); toast("卡组已保存"); }
    if (event.target.closest("#startBattleBtn") || event.target.closest("#restartBattleBtn")) startBattle();
    if (event.target.closest("#battleBackBtn")) backToBattleLobby();
    if (event.target.closest("#deploySelectedBtn")) deploySelected();
    if (event.target.closest("#moveSelectedBtn")) moveSelected();
    if (event.target.closest("#attackSelectedBtn")) attackSelected();
    if (event.target.closest("#attackHqSelectedBtn")) attackHqSelected();
    if (event.target.closest("#attackTargetBtn")) attackTarget();
    if (event.target.closest("#endTurnBtn")) endTurn();
    if (event.target.closest("#battleLog")) event.target.closest("#battleLog").classList.toggle("expanded");
  });
  $("#listenBtn").addEventListener("click", () => { if (app.round?.mode !== "math") speak(app.round.question.answer.id); });
  $("#autoSpeakToggle").addEventListener("change", (event) => { app.settings.autoSpeak = event.target.checked; saveProgress(); });
  $("#resetBtn").addEventListener("click", () => { if (!confirm("确定清空本机学习、卡牌和对战进度吗？")) return; if (!confirm("再次确认：清空后不能恢复，继续吗？")) return; localStorage.removeItem(STORAGE_KEY); app.progress = loadProgress(); app.battle = null; render(); toast("本机进度已清空"); });
}
function setCardTab(tab) { app.cardTab = tab; renderCards(); }
function initPwa() { if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {}); }
function init() { app.progress = loadProgress(); app.settings = { ...app.settings, ...app.progress.settings }; bindEvents(); render(); initPwa(); }
init();



