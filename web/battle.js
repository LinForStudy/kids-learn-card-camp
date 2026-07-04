const BattleEngine = (() => {
  const HQ_MAX = 20;
  const MAX_ACTION = 12;
  const SUPPORT_LIMIT = 4;
  const FRONT_LIMIT = 5;
  let uidSeq = 1;

  function shuffle(list) { return [...list].sort(() => Math.random() - 0.5); }
  function side(battle, owner) { return owner === "player" ? battle.player : battle.enemy; }
  function opponent(owner) { return owner === "player" ? "enemy" : "player"; }
  function log(battle, message) { battle.log.unshift(message); battle.log = battle.log.slice(0, 20); }

  function makeSide(deckIds, label) {
    const deck = shuffle(deckIds).filter(getCard);
    return { label, hq: HQ_MAX, maxAction: 1, action: 1, deck, discard: [], hand: [], support: [], front: [] };
  }

  function createBattle(playerDeck, aiDeck) {
    uidSeq = 1;
    const battle = {
      active: true,
      phase: "player",
      winner: "",
      turn: 1,
      player: makeSide(playerDeck, "我方"),
      enemy: makeSide(aiDeck, "敌方"),
      log: ["演练开始：保护总部，争夺前线。"],
      lastRewarded: false
    };
    for (let i = 0; i < 4; i += 1) {
      draw(battle, "player");
      draw(battle, "enemy");
    }
    return battle;
  }

  function draw(battle, owner) {
    const s = side(battle, owner);
    if (!s.deck.length && s.discard.length) {
      s.deck = shuffle(s.discard);
      s.discard = [];
      log(battle, `${s.label}重新整理牌库。`);
    }
    if (!s.deck.length) {
      log(battle, `${s.label}牌库为空，本次不抽牌。`);
      return null;
    }
    const id = s.deck.shift();
    if (s.hand.length < 8) s.hand.push(id); else s.discard.push(id);
    return id;
  }

  function unitFromCard(card, owner) {
    return {
      uid: `u${uidSeq++}`,
      owner,
      cardId: card.id,
      attack: card.attack,
      health: card.health,
      maxHealth: card.health,
      fresh: true,
      attacked: false,
      moved: false,
      shield: card.type === "坦克" ? 1 : 0
    };
  }

  function deployReason(battle, owner, handIndex) {
    const s = side(battle, owner);
    const card = getCard(s.hand[handIndex]);
    if (!battle.active) return "演练已结束";
    if (battle.phase !== owner) return "不是当前回合";
    if (!card) return "没有这张牌";
    if (s.action < card.cost) return `行动点不足，还差 ${card.cost - s.action}`;
    if (card.type !== "战术指令" && s.support.length >= SUPPORT_LIMIT) return "支援区已满";
    return "";
  }

  function deploy(battle, owner, handIndex) {
    const reason = deployReason(battle, owner, handIndex);
    if (reason) return { ok: false, reason };
    const s = side(battle, owner);
    const card = getCard(s.hand[handIndex]);
    s.action -= card.cost;
    s.hand.splice(handIndex, 1);
    if (card.type === "战术指令") {
      resolveTactic(battle, owner, card);
      s.discard.push(card.id);
      log(battle, `${s.label}使用 ${card.name}。`);
    } else {
      s.support.push(unitFromCard(card, owner));
      resolveDeploySkill(battle, owner, card);
      log(battle, `${s.label}部署 ${card.name} 到支援区。`);
    }
    checkEnd(battle);
    return { ok: true };
  }

  function resolveDeploySkill(battle, owner, card) {
    const s = side(battle, owner);
    if (card.skill.includes("抽 1 张牌")) draw(battle, owner);
    if (card.skill.includes("获得 1 行动点")) s.action = Math.min(s.maxAction, s.action + 1);
    if (card.skill.includes("修复我方总部 1 点")) s.hq = Math.min(HQ_MAX, s.hq + 1);
  }

  function resolveTactic(battle, owner, card) {
    const s = side(battle, owner);
    const e = side(battle, opponent(owner));
    if (card.skill.includes("获得 1 行动点")) s.action = Math.min(s.maxAction, s.action + 1);
    if (card.skill.includes("攻击 +2")) {
      const target = [...s.front, ...s.support].find((unit) => !unit.attacked);
      if (target) target.attack += 2;
    }
    if (card.skill.includes("少花 1 行动点推进")) {
      const target = s.support.find((unit) => !unit.fresh && getCard(unit.cardId).type !== "防御工事");
      if (target) target.discountMove = true;
    }
    if (card.skill.includes("前线造成 2")) {
      if (e.front[0]) damageUnit(battle, opponent(owner), e.front[0], 2);
      else e.hq -= 2;
    }
  }

  function moveReason(battle, owner, uid) {
    const s = side(battle, owner);
    const unit = s.support.find((item) => item.uid === uid);
    if (!battle.active) return "演练已结束";
    if (battle.phase !== owner) return "不是当前回合";
    if (!unit) return "单位不在支援区";
    const card = getCard(unit.cardId);
    if (unit.fresh) return "刚部署，下一回合才能推进";
    if (card.type === "防御工事") return "防御工事不能推进";
    if (s.front.length >= FRONT_LIMIT) return "前线区已满";
    const cost = unit.discountMove ? Math.max(0, card.actionCost - 1) : card.actionCost;
    if (s.action < cost) return `行动点不足，还差 ${cost - s.action}`;
    return "";
  }

  function moveToFront(battle, owner, uid) {
    const reason = moveReason(battle, owner, uid);
    if (reason) return { ok: false, reason };
    const s = side(battle, owner);
    const index = s.support.findIndex((item) => item.uid === uid);
    const unit = s.support[index];
    const card = getCard(unit.cardId);
    const cost = unit.discountMove ? Math.max(0, card.actionCost - 1) : card.actionCost;
    s.action -= cost;
    s.support.splice(index, 1);
    unit.moved = true;
    unit.discountMove = false;
    s.front.push(unit);
    if (card.skill.includes("推进到前线时：抽")) draw(battle, owner);
    if (card.skill.includes("推进到前线时：修复")) s.hq = Math.min(HQ_MAX, s.hq + 1);
    log(battle, `${s.label}推进 ${card.name} 到前线。`);
    return { ok: true };
  }

  function attackReason(battle, owner, uid, targetUid = "hq") {
    const s = side(battle, owner);
    const e = side(battle, opponent(owner));
    const unit = [...s.front, ...s.support].find((item) => item.uid === uid);
    if (!battle.active) return "演练已结束";
    if (battle.phase !== owner) return "不是当前回合";
    if (!unit) return "没有选择单位";
    const card = getCard(unit.cardId);
    const inFront = s.front.some((item) => item.uid === uid);
    const isArtillery = card.type === "火炮" && s.support.some((item) => item.uid === uid);
    const isPlane = card.type === "飞机";
    if (unit.fresh) return "刚部署，下一回合才能攻击";
    if (unit.attacked) return "本回合已行动";
    if (card.attack <= 0 || card.type === "防御工事") return "这张牌不能攻击";
    if (s.action < card.actionCost) return `行动点不足，还差 ${card.actionCost - s.action}`;
    if (!inFront && !isArtillery) return "需要先推进到前线";
    if (isArtillery && targetUid === "hq") return "火炮只能远程支援前线";
    if (targetUid === "hq" && e.front.length && !isPlane) return "敌方前线仍有单位";
    return "";
  }

  function attack(battle, owner, uid, targetUid = "hq") {
    const reason = attackReason(battle, owner, uid, targetUid);
    if (reason) return { ok: false, reason };
    const s = side(battle, owner);
    const e = side(battle, opponent(owner));
    const unit = [...s.front, ...s.support].find((item) => item.uid === uid);
    const card = getCard(unit.cardId);
    s.action -= card.actionCost;
    unit.attacked = true;
    if (targetUid === "hq") {
      const bonus = card.skill.includes("额外造成 1") ? 1 : 0;
      e.hq -= unit.attack + bonus;
      log(battle, `${card.name} 攻击总部，造成 ${unit.attack + bonus} 点演练伤害。`);
    } else {
      const target = e.front.find((item) => item.uid === targetUid) || e.support.find((item) => item.uid === targetUid);
      if (target) {
        damageUnit(battle, opponent(owner), target, unit.attack);
        if (e.front.some((item) => item.uid === target.uid) && s.front.some((item) => item.uid === unit.uid)) {
          damageUnit(battle, owner, unit, getCard(target.cardId).attack);
        }
        log(battle, `${card.name} 攻击目标单位。`);
      }
    }
    if (card.skill.includes("攻击后：抽牌")) draw(battle, owner);
    checkEnd(battle);
    return { ok: true };
  }

  function damageUnit(battle, owner, unit, amount) {
    if (unit.shield) {
      unit.shield -= 1;
      amount = Math.max(0, amount - 1);
    }
    unit.health -= amount;
    const s = side(battle, owner);
    if (unit.health <= 0) {
      s.discard.push(unit.cardId);
      s.support = s.support.filter((item) => item.uid !== unit.uid);
      s.front = s.front.filter((item) => item.uid !== unit.uid);
    }
  }

  function startTurn(battle, owner) {
    const s = side(battle, owner);
    battle.phase = owner;
    if (owner === "player") battle.turn += 1;
    s.maxAction = Math.min(MAX_ACTION, s.maxAction + 1);
    s.action = s.maxAction;
    [...s.support, ...s.front].forEach((unit) => {
      unit.fresh = false;
      unit.attacked = false;
      unit.moved = false;
      unit.discountMove = false;
    });
    draw(battle, owner);
    log(battle, `${s.label}回合：抽 1 张牌，行动点恢复。`);
  }

  function endPlayerTurn(battle) {
    if (!battle.active) return;
    battle.phase = "enemy";
    enemyTurn(battle);
  }

  function enemyTurn(battle) {
    startTurn(battle, "enemy");
    let guard = 0;
    while (guard < 8) {
      guard += 1;
      const hqAttacker = [...battle.enemy.front, ...battle.enemy.support].find((unit) => !attackReason(battle, "enemy", unit.uid, "hq"));
      if (hqAttacker) { attack(battle, "enemy", hqAttacker.uid, "hq"); continue; }
      const threat = battle.player.front.slice().sort((a, b) => b.attack - a.attack)[0];
      const attackUnit = [...battle.enemy.front, ...battle.enemy.support].find((unit) => threat && !attackReason(battle, "enemy", unit.uid, threat.uid));
      if (attackUnit && threat) { attack(battle, "enemy", attackUnit.uid, threat.uid); continue; }
      const movable = battle.enemy.support.find((unit) => !moveReason(battle, "enemy", unit.uid));
      if (movable) { moveToFront(battle, "enemy", movable.uid); continue; }
      const deployIndex = battle.enemy.hand.findIndex((id, index) => !deployReason(battle, "enemy", index) && getCard(id).type !== "战术指令");
      if (deployIndex >= 0) { deploy(battle, "enemy", deployIndex); continue; }
      const tacticIndex = battle.enemy.hand.findIndex((id, index) => !deployReason(battle, "enemy", index));
      if (tacticIndex >= 0) { deploy(battle, "enemy", tacticIndex); continue; }
      break;
    }
    if (battle.active) startTurn(battle, "player");
  }

  function frontControl(battle) {
    if (battle.player.front.length && !battle.enemy.front.length) return "我方";
    if (!battle.player.front.length && battle.enemy.front.length) return "敌方";
    if (battle.player.front.length && battle.enemy.front.length) return "争夺中";
    return "无人";
  }

  function hasAction(battle) {
    return battle.player.hand.some((_, index) => !deployReason(battle, "player", index)) ||
      battle.player.support.some((unit) => !moveReason(battle, "player", unit.uid) || !attackReason(battle, "player", unit.uid, battle.enemy.front[0]?.uid || "hq")) ||
      battle.player.front.some((unit) => !attackReason(battle, "player", unit.uid, battle.enemy.front[0]?.uid || "hq"));
  }

  function checkEnd(battle) {
    if (battle.enemy.hq <= 0) {
      battle.active = false;
      battle.winner = "player";
      log(battle, "胜利！敌方总部完成演练撤离。");
    } else if (battle.player.hq <= 0) {
      battle.active = false;
      battle.winner = "enemy";
      log(battle, "演练失败：我方总部需要重新整备。");
    }
    return !battle.active;
  }

  return { HQ_MAX, MAX_ACTION, SUPPORT_LIMIT, FRONT_LIMIT, createBattle, deploy, deployReason, moveToFront, moveReason, attack, attackReason, endPlayerTurn, frontControl, hasAction, draw };
})();

