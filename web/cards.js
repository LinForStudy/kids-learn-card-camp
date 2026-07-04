const CARD_POOL = [
  { id: "infantry-scout", name: "侦察步兵", faction: "钢铁营", type: "步兵", rarity: "common", cost: 1, op: 1, atk: 1, hp: 2, icon: "♟", text: "部署后适合抢占前线。" },
  { id: "field-medic", name: "野战医护", faction: "补给队", type: "步兵", rarity: "common", cost: 2, op: 1, atk: 1, hp: 3, icon: "✚", text: "部署时修复我方总部 1 点。" },
  { id: "rifle-team", name: "步枪小队", faction: "钢铁营", type: "步兵", rarity: "common", cost: 2, op: 1, atk: 2, hp: 2, icon: "▣", text: "稳定的基础单位。" },
  { id: "engineer-squad", name: "工程小队", faction: "补给队", type: "步兵", rarity: "common", cost: 2, op: 1, atk: 1, hp: 4, icon: "⚙", text: "生命较高，适合防守。" },
  { id: "armored-car", name: "装甲侦察车", faction: "钢铁营", type: "坦克", rarity: "common", cost: 3, op: 1, atk: 2, hp: 3, icon: "▰", text: "推进到前线后压制力不错。" },
  { id: "light-tank", name: "轻型坦克", faction: "钢铁营", type: "坦克", rarity: "rare", cost: 4, op: 2, atk: 3, hp: 4, icon: "▱", text: "攻防均衡的主力单位。" },
  { id: "heavy-tank", name: "重装坦克", faction: "钢铁营", type: "坦克", rarity: "epic", cost: 6, op: 2, atk: 5, hp: 6, icon: "▰", text: "高生命、高攻击，但费用较高。" },
  { id: "mobile-artillery", name: "机动火炮", faction: "钢铁营", type: "火炮", rarity: "rare", cost: 4, op: 2, atk: 4, hp: 2, icon: "⌁", text: "攻击高，但需要保护。" },
  { id: "fighter-cover", name: "战斗机掩护", faction: "天空队", type: "飞机", rarity: "rare", cost: 3, op: 1, atk: 2, hp: 3, icon: "✈", text: "轻快灵活，适合补刀。" },
  { id: "bomber-wing", name: "轰炸机编队", faction: "天空队", type: "飞机", rarity: "epic", cost: 5, op: 2, atk: 4, hp: 3, icon: "✦", text: "部署时对敌方总部造成 1 点伤害。" },
  { id: "supply-truck", name: "补给卡车", faction: "补给队", type: "补给", rarity: "common", cost: 2, op: 0, atk: 0, hp: 3, icon: "▤", text: "部署时抽 1 张牌。" },
  { id: "repair-depot", name: "维修站", faction: "补给队", type: "防御工事", rarity: "rare", cost: 3, op: 0, atk: 0, hp: 5, icon: "▥", text: "部署时修复所有我方单位 1 点。" },
  { id: "front-bunker", name: "前线掩体", faction: "钢铁营", type: "防御工事", rarity: "common", cost: 2, op: 0, atk: 0, hp: 5, icon: "▧", text: "高生命防守单位，不能主动攻击。" },
  { id: "radio-order", name: "无线电命令", faction: "补给队", type: "战术指令", rarity: "common", cost: 1, op: 0, atk: 0, hp: 0, icon: "⌾", text: "抽 1 张牌。" },
  { id: "rapid-advance", name: "快速推进", faction: "钢铁营", type: "战术指令", rarity: "rare", cost: 2, op: 0, atk: 0, hp: 0, icon: "↟", text: "让一个支援线单位免费推进到前线。" },
  { id: "smoke-screen", name: "烟幕掩护", faction: "钢铁营", type: "战术指令", rarity: "common", cost: 2, op: 0, atk: 0, hp: 0, icon: "≈", text: "本回合修复我方总部 2 点。" },
  { id: "air-raid", name: "空中打击", faction: "天空队", type: "战术指令", rarity: "rare", cost: 3, op: 0, atk: 0, hp: 0, icon: "⌖", text: "对敌方前线第一个单位造成 3 点伤害；若没有单位则攻击总部。" },
  { id: "precision-strike", name: "精确打击", faction: "天空队", type: "战术指令", rarity: "epic", cost: 4, op: 0, atk: 0, hp: 0, icon: "◎", text: "对敌方总部造成 3 点伤害。" },
  { id: "cadet-guard", name: "学员卫队", faction: "星卡营", type: "步兵", rarity: "common", cost: 1, op: 1, atk: 1, hp: 1, icon: "★", text: "低费用，适合前期部署。" },
  { id: "math-planner", name: "算术参谋", faction: "星卡营", type: "补给", rarity: "rare", cost: 3, op: 0, atk: 1, hp: 3, icon: "+", text: "部署时获得 1 点当前资源。" },
  { id: "word-runner", name: "单词传令兵", faction: "星卡营", type: "步兵", rarity: "rare", cost: 3, op: 1, atk: 2, hp: 3, icon: "A", text: "学习奖励卡，均衡可靠。" },
  { id: "shield-line", name: "护盾阵线", faction: "星卡营", type: "防御工事", rarity: "rare", cost: 3, op: 0, atk: 0, hp: 6, icon: "⬟", text: "用于保护总部。" },
  { id: "command-star", name: "指挥星章", faction: "星卡营", type: "战术指令", rarity: "epic", cost: 4, op: 0, atk: 0, hp: 0, icon: "✪", text: "所有我方单位修复 2 点，总部修复 2 点。" },
  { id: "final-push", name: "总攻号令", faction: "星卡营", type: "战术指令", rarity: "legend", cost: 6, op: 0, atk: 0, hp: 0, icon: "⚑", text: "对敌方总部造成 4 点伤害。" }
];

const STARTER_DECK = [
  "infantry-scout", "field-medic", "rifle-team", "engineer-squad",
  "armored-car", "fighter-cover", "supply-truck", "front-bunker",
  "radio-order", "smoke-screen", "cadet-guard", "word-runner"
];
