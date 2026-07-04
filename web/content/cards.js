const FACTION_DEFS = [
  {
    key: "steel",
    name: "钢铁营",
    motto: "稳步推进，正面协同",
    art: "◆",
    names: ["侦察步兵", "前线队长", "装甲小队", "稳固坦克", "机动火炮", "推进补给员", "钢铁号令", "前线路障", "突进步兵", "装甲护卫", "整备车组", "压制演练", "钢梁阵地", "远程炮组", "重装小队", "钢铁旗手"]
  },
  {
    key: "sky",
    name: "天空队",
    motto: "观察航线，快速支援",
    art: "✦",
    names: ["观察飞机", "云端侦察员", "轻翼小队", "星翼队长", "高空火力", "航线补给", "空中支援", "临时停机坪", "风向学员", "远空巡航", "空勤整备员", "绕行演练", "雷达哨站", "云层炮组", "翼装护卫", "晴空号角"]
  },
  {
    key: "supply",
    name: "补给队",
    motto: "抽牌修复，资源循环",
    art: "▣",
    names: ["补给卡车", "后勤队员", "修理小队", "整备营地", "零件投送", "备用口粮", "快速补给", "移动仓库", "器材学员", "巡航补给机", "行动调度员", "补给清单", "修复工棚", "器械炮组", "重载车队", "后勤旗帜"]
  },
  {
    key: "guard",
    name: "守备队",
    motto: "守护总部，稳住节奏",
    art: "▰",
    names: ["守护哨兵", "防线队长", "护盾车组", "稳固阵地", "警戒火炮", "防线补给", "总部护盾", "前线掩体", "盾牌学员", "巡逻飞翼", "防务修理员", "阵地调整", "守护哨塔", "压制炮台", "重盾小队", "防线旗手"]
  },
  {
    key: "tactic",
    name: "战术队",
    motto: "移动控制，临时增益",
    art: "◇",
    names: ["调整阵型", "集中指挥", "机动小队", "战术装甲", "烟幕火炮", "预备物资", "快速转移", "训练沙盘", "复盘学员", "观察飞手", "临时整备", "佯攻演练", "指挥哨塔", "信号炮组", "战术护卫", "星盘计划"]
  },
  {
    key: "vanguard",
    name: "先锋队",
    motto: "低费铺场，快速抢线",
    art: "▲",
    names: ["冲锋学员", "快速小队", "机动步兵", "先锋车组", "轻型火炮", "前线背包", "先锋号角", "突进路线", "前线旗手", "轻翼先锋", "路标补给员", "抢线演练", "临时掩护", "机敏炮组", "疾行小队", "晨星队长"]
  }
];

const TYPE_PATTERN = ["步兵", "步兵", "坦克", "坦克", "火炮", "补给", "战术指令", "防御工事", "步兵", "飞机", "补给", "战术指令", "防御工事", "火炮", "坦克", "飞机"];
const RARITY_PATTERN = ["普通", "普通", "普通", "普通", "普通", "普通", "普通", "普通", "稀有", "稀有", "稀有", "稀有", "稀有", "史诗", "史诗", "传说"];
const RARITY_WEIGHT = { "普通": 68, "稀有": 24, "史诗": 7, "传说": 1 };
const FACTION_STYLE = {
  "钢铁营": "正面推进",
  "天空队": "快速支援",
  "补给队": "资源运营",
  "守备队": "总部守护",
  "战术队": "灵活控制",
  "先锋队": "抢占前线"
};

function cardStats(type, rarity, index) {
  const boost = rarity === "传说" ? 3 : rarity === "史诗" ? 2 : rarity === "稀有" ? 1 : 0;
  const baseCost = index % 7;
  const cost = Math.min(6, Math.max(0, baseCost + (rarity === "传说" ? 1 : 0)));
  const actionCost = type === "补给" || type === "战术指令" || type === "防御工事" ? 0 : cost >= 4 ? 2 : 1;
  if (type === "战术指令") return { cost, actionCost, attack: 0, health: 1 };
  if (type === "防御工事") return { cost: Math.max(1, cost), actionCost: 0, attack: 0, health: Math.min(8, 4 + boost + (index % 2)) };
  if (type === "补给") return { cost: Math.max(1, cost), actionCost: 0, attack: index % 3 === 0 ? 1 : 0, health: Math.min(6, 2 + boost + (index % 3)) };
  if (type === "飞机") return { cost: Math.max(1, cost), actionCost, attack: Math.min(5, 1 + boost + (index % 3)), health: Math.max(1, 2 + boost) };
  if (type === "火炮") return { cost: Math.max(2, cost), actionCost: Math.max(1, actionCost), attack: Math.min(6, 2 + boost + (index % 3)), health: Math.max(1, 2 + boost) };
  if (type === "坦克") return { cost: Math.max(2, cost), actionCost, attack: Math.min(6, 2 + boost + (index % 3)), health: Math.min(8, 3 + boost + (index % 4)) };
  return { cost: Math.max(1, cost), actionCost, attack: Math.min(4, 1 + boost + (index % 2)), health: Math.min(6, 2 + boost + (index % 3)) };
}

function skillFor(type, faction, rarity, index) {
  const strong = rarity === "史诗" || rarity === "传说";
  if (type === "步兵") return index % 2 ? "推进到前线时：修复我方总部 1 点。" : "推进到前线时：抽 1 张牌。";
  if (type === "坦克") return strong ? "攻击总部时：额外造成 1 点伤害。" : "部署后获得护盾标记，第一次受伤减少 1 点。";
  if (type === "飞机") return "可以绕过前线攻击总部，但生命较低。";
  if (type === "火炮") return "可以从支援区远程攻击敌方前线单位。";
  if (type === "补给") return index % 2 ? "部署时：修复我方总部 1 点。" : "部署时：抽 1 张牌。";
  if (type === "防御工事") return "不能攻击；生命较高，用来守护总部和拖慢节奏。";
  if (faction === "战术队") return strong ? "选择一个我方单位，本回合攻击 +2。" : "让一个支援区单位少花 1 行动点推进。";
  return strong ? "对敌方前线造成 2 点演练伤害。" : "本回合获得 1 行动点。";
}

function tagsFor(type, faction, rarity) {
  const tags = [FACTION_STYLE[faction], type];
  if (rarity === "史诗" || rarity === "传说") tags.push("核心");
  if (type === "飞机") tags.push("绕行");
  if (type === "火炮") tags.push("远程");
  if (type === "防御工事") tags.push("守护");
  return tags;
}

const CARD_POOL = FACTION_DEFS.flatMap((faction) => faction.names.map((name, index) => {
  const type = TYPE_PATTERN[index];
  const rarity = RARITY_PATTERN[index];
  const stats = cardStats(type, rarity, index);
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `${faction.key}-${number}`,
    name,
    faction: faction.name,
    type,
    rarity,
    rarityWeight: RARITY_WEIGHT[rarity],
    cost: stats.cost,
    actionCost: stats.actionCost,
    attack: stats.attack,
    health: stats.health,
    skill: skillFor(type, faction.name, rarity, index),
    flavor: `${faction.motto}，用于儿童策略演练。`,
    tags: tagsFor(type, faction.name, rarity),
    maxCopies: rarity === "传说" ? 1 : 2,
    artKey: `${faction.art}${number}`
  };
}));

const DEFAULT_DECKS = [
  { id: "scout", name: "侦察小队", style: "均衡型", desc: "适合新手，单位、补给和守备都齐。", cards: ["steel-01", "steel-01", "steel-02", "sky-01", "supply-01", "supply-02", "guard-01", "guard-08", "tactic-01", "vanguard-01", "vanguard-02", "vanguard-08"] },
  { id: "steel-push", name: "钢铁推进", style: "步兵 + 坦克", desc: "适合正面推进。", cards: ["steel-01", "steel-02", "steel-03", "steel-03", "steel-04", "steel-09", "steel-10", "steel-15", "supply-01", "guard-08", "tactic-02", "vanguard-07"] },
  { id: "sky-aid", name: "天空支援", style: "飞机 + 侦察", desc: "适合快速打击。", cards: ["sky-01", "sky-02", "sky-09", "sky-10", "sky-10", "sky-16", "supply-06", "supply-10", "tactic-10", "tactic-11", "guard-06", "vanguard-10"] },
  { id: "guard-line", name: "稳固防线", style: "防御工事 + 总部保护", desc: "适合防守反击。", cards: ["guard-01", "guard-02", "guard-08", "guard-08", "guard-12", "guard-13", "guard-15", "supply-03", "supply-04", "steel-05", "tactic-03", "tactic-05"] },
  { id: "supply-loop", name: "补给循环", style: "抽牌 + 行动点恢复", desc: "适合资源运营。", cards: ["supply-01", "supply-02", "supply-03", "supply-06", "supply-07", "supply-10", "supply-11", "supply-16", "tactic-01", "tactic-07", "guard-04", "steel-06"] },
  { id: "vanguard-rush", name: "先锋快攻", style: "低费铺场 + 快速抢前线", desc: "适合快节奏。", cards: ["vanguard-01", "vanguard-01", "vanguard-02", "vanguard-03", "vanguard-07", "vanguard-08", "vanguard-09", "vanguard-10", "steel-01", "sky-01", "tactic-07", "supply-06"] }
];

const AI_DECKS = [
  { id: "ai-newbie", name: "新手演练", style: "均衡", cards: DEFAULT_DECKS[0].cards },
  { id: "ai-front", name: "前线训练", style: "推进", cards: DEFAULT_DECKS[1].cards },
  { id: "ai-hq", name: "总部挑战", style: "守备", cards: DEFAULT_DECKS[3].cards }
];

function getCard(id) {
  return CARD_POOL.find((card) => card.id === id);
}

if (typeof window !== "undefined") {
  window.CARD_POOL = CARD_POOL;
  window.DEFAULT_DECKS = DEFAULT_DECKS;
  window.AI_DECKS = AI_DECKS;
  window.getCard = getCard;
}
