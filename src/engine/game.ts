import {
  BOARD,
  TEAMS,
  DEFAULT_VARIANTS,
  makeDeck,
  dividendValue,
  endThreshold,
  cardName,
  TEAM_INFO,
} from "./catalog";
import type {
  State,
  Action,
  PlayerConfig,
  Variants,
  Team,
  Resource,
  Observation,
  Proposal,
  Phase,
  Card,
} from "./types";
export class RuleError extends Error {}
function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}
function random(s: State) {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(s: State, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function log(
  s: State,
  text: string,
  type: State["log"][number]["type"] = "info",
  actor?: number,
) {
  s.log.push({ id: s.log.length + 1, turn: s.turn, text, type, actor });
}
function roll(s: State) {
  return (s.die = 1 + Math.floor(random(s) * 6));
}
export function createGame(
  config: PlayerConfig[],
  seed = Date.now() >>> 0,
  variants: Partial<Variants> = {},
): State {
  requireRule(config.length >= 3 && config.length <= 6, "需要 3–6 名玩家");
  const s: State = {
    version: 1,
    seed: seed >>> 0,
    initialSeed: seed >>> 0,
    players: config.map((p, id) => ({
      id,
      name: p.name.trim().slice(0, 20) || `玩家 ${id + 1}`,
      kind: p.kind,
      style: p.style ?? "balanced",
      hand: [],
      money: 0,
    })),
    owners: Object.fromEntries(TEAMS.map((t) => [t, null])) as State["owners"],
    deck: [],
    discard: [],
    table: [],
    travel: [],
    phase: "placement",
    turn: 1,
    turnOwner: 0,
    boss: 0,
    marker: 0,
    covered: {},
    dealNumbers: [],
    dealIndex: 0,
    die: null,
    pending: null,
    proposal: null,
    demands: {},
    closePassed: [],
    closingStage: 0,
    played: [],
    variants: { ...DEFAULT_VARIANTS, ...variants },
    log: [],
    revision: 0,
    lastSettlement: null,
    totalMinted: 0,
    discardQueue: [],
    discardResume: null,
    startHandCount: 5,
    winners: [],
  };
  const teams = shuffle(s, [...TEAMS]);
  for (let i = 0; i < (config.length === 3 ? 6 : config.length); i++)
    s.owners[teams[i]] = i % config.length;
  s.deck = shuffle(s, makeDeck());
  for (const p of s.players) p.hand = s.deck.splice(-5);
  s.turnOwner = Math.floor(random(s) * config.length);
  s.boss = s.turnOwner;
  s.dealNumbers = Array.from({ length: 15 }, (_, i) => i + 1).filter(
    (n) => !s.variants.shortGame || ![3, 6, 9].includes(n),
  );
  log(
    s,
    `欢迎来到谈判桌。${s.players[s.turnOwner].name} 随机成为起始玩家；请其右手边的 ${s.players[(s.turnOwner + config.length - 1) % config.length].name} 放置棋子。`,
  );
  return s;
}
export function dealNumber(s: Pick<State, "dealNumbers" | "dealIndex">) {
  return s.dealNumbers[Math.min(s.dealIndex, s.dealNumbers.length - 1)];
}
export function pool(s: Pick<State, "dealNumbers" | "dealIndex" | "marker">) {
  return BOARD[s.marker].dividends * dividendValue(dealNumber(s));
}
export function handLimit(
  s: Pick<State, "variants" | "dealNumbers" | "dealIndex">,
) {
  return s.variants.lateHandLimit && dealNumber(s) >= 10 ? 10 : 12;
}
export function resources(
  s: Pick<State, "owners" | "table" | "travel">,
): Resource[] {
  return [
    ...TEAMS.map((team) => ({
      id: `investor-${team}`,
      team,
      owner: s.owners[team],
      away: s.travel.some((t) => t.team === team),
    })),
    ...s.table.map((t) => ({
      id: t.card.id,
      team: t.card.team!,
      owner: t.owner,
      card: t.card,
      away: false,
    })),
  ];
}
export function validSelection(
  s: Pick<State, "owners" | "table" | "travel" | "marker">,
  ids: string[],
): boolean {
  const all = resources(s);
  const chosen = ids.map((id) => all.find((r) => r.id === id));
  const space = BOARD[s.marker];
  if (
    new Set(ids).size !== ids.length ||
    chosen.some((r) => !r || r.away || r.owner === null)
  )
    return false;
  const teams = chosen.map((r) => r!.team);
  return (
    new Set(teams).size === teams.length &&
    teams.length === space.groups.reduce((n, g) => n + g.count, 0) &&
    space.groups.every(
      (g) => g.teams.filter((t) => teams.includes(t)).length === g.count,
    )
  );
}
export function requiredApprovals(
  s: Pick<State, "owners" | "table" | "travel" | "boss" | "variants">,
  p: Proposal,
): number[] {
  return [
    ...new Set([
      s.boss,
      ...(s.variants.lessCutthroat
        ? []
        : resources(s)
            .filter((r) => p.resources.includes(r.id))
            .map((r) => r.owner!)),
      ...p.payouts.flatMap((v, i) =>
        v > 0 && !s.variants.lessCutthroat ? [i] : [],
      ),
    ]),
  ];
}
export function isAgreed(s: State) {
  return (
    !!s.proposal &&
    validSelection(s, s.proposal.resources) &&
    requiredApprovals(s, s.proposal).every((p) =>
      s.proposal!.accepted.includes(p),
    )
  );
}
export function nextSpace(s: Pick<State, "marker" | "covered">, steps = 1) {
  let pos = s.marker;
  for (let i = 0; i < steps; i++) {
    let n = 0;
    do {
      pos = (pos + 1) % 16;
      n++;
    } while (s.covered[pos] !== undefined && n <= 16);
  }
  return pos;
}
function draw(s: State, actor: number, count: number) {
  for (let i = 0; i < count; i++) {
    if (!s.deck.length && s.discard.length)
      s.deck = shuffle(s, s.discard.splice(0));
    const c = s.deck.pop();
    if (c) s.players[actor].hand.push(c);
  }
}
function checkOverflow(s: State, resume: Phase) {
  const queue = s.players
    .filter((p) => p.hand.length > handLimit(s))
    .map((p) => p.id);
  if (queue.length) {
    s.phase = "discard";
    s.discardQueue = queue;
    s.discardResume = resume;
  } else s.phase = resume;
}
function finishDiscard(s: State) {
  s.discardQueue = s.discardQueue.filter(
    (id) => s.players[id].hand.length > handLimit(s),
  );
  if (!s.discardQueue.length) {
    s.phase = s.discardResume ?? "between";
    s.discardResume = null;
  }
}
function resetNegotiation(s: State, clear = true) {
  s.phase = "negotiation";
  s.closePassed = [];
  s.closingStage = 0;
  if (clear) s.proposal = null;
}
function recordPlayed(s: State, actor: number) {
  if (!s.played.includes(actor)) s.played.push(actor);
}
function resolvePending(s: State, canceled = false) {
  const p = s.pending!;
  s.pending = null;
  s.phase = p.resume;
  if (canceled) {
    s.discard.push(...p.cards);
    log(s, "反制成功，刚才的出牌效果取消。", "card");
    if (p.resume === "discard") finishDiscard(s);
    return;
  }
  const kind = p.cards[0].kind;
  if (kind === "boss") {
    s.boss = p.actor;
    resetNegotiation(s);
    log(
      s,
      `${s.players[p.actor].name}：我是大老板！重新谈条件。`,
      "card",
      p.actor,
    );
    s.discard.push(...p.cards);
  } else if (kind === "recruit") {
    const team = p.target!.replace("investor-", "") as Team;
    s.owners[team] = p.actor;
    s.discard.push(...p.cards);
    log(
      s,
      `${s.players[p.actor].name} 招募了${TEAM_INFO[team].name}投资人。`,
      "card",
      p.actor,
    );
    if (p.resume === "negotiation") resetNegotiation(s);
    else finishDiscard(s);
  } else if (kind === "travel") {
    const r = resources(s).find((r) => r.id === p.target)!;
    if (r.card) {
      s.table = s.table.filter((t) => t.card.id !== r.id);
      s.discard.push(r.card, ...p.cards);
    } else s.travel.push({ team: r.team, card: p.cards[0] });
    resetNegotiation(s);
    log(
      s,
      `${TEAM_INFO[r.team].name}${r.card ? "团队牌已弃置" : "投资人外出旅行，本轮不能参加"}。`,
      "card",
      p.actor,
    );
  }
}
function cleanTable(s: State, used: string[]) {
  for (const t of s.table) {
    if (used.includes(t.card.id)) s.discard.push(t.card);
    else s.players[t.owner].hand.push(t.card);
  }
  s.discard.push(...s.travel.map((t) => t.card));
  s.table = [];
  s.travel = [];
  s.proposal = null;
  s.pending = null;
  s.closePassed = [];
  s.closingStage = 0;
}
function finishDeal(s: State, success: boolean) {
  const n = dealNumber(s),
    amount = success ? pool(s) : 0,
    payouts = success ? [...s.proposal!.payouts] : s.players.map(() => 0);
  s.lastSettlement = {
    number: n,
    boss: s.boss,
    space: s.marker,
    amount,
    payouts,
    success,
  };
  if (success) {
    for (const p of s.players) p.money += payouts[p.id];
    s.totalMinted += amount;
    s.covered[s.marker] = n;
    log(
      s,
      `第 ${n} 号交易成交，共 $${amount}M。${s.players.map((p) => `${p.name} +$${payouts[p.id]}M`).join(" · ")}`,
      "money",
    );
    cleanTable(s, s.proposal!.resources);
    s.dealIndex++;
    s.marker = nextSpace(s);
    if (n === 15) {
      endGame(s);
      return;
    }
    checkOverflow(s, n >= 10 ? "endcheck" : "between");
  } else {
    log(
      s,
      `${s.players[s.boss].name} 宣布谈判失败。棋子保留，交易牌不消耗。`,
      "deal",
    );
    cleanTable(s, []);
    checkOverflow(s, "between");
  }
}
function endGame(s: State) {
  s.phase = "finished";
  const max = Math.max(...s.players.map((p) => p.money));
  s.winners = s.players.filter((p) => p.money === max).map((p) => p.id);
  log(
    s,
    `游戏结束。${s.winners.map((id) => s.players[id].name).join("、")} 以 $${max}M 获胜${s.winners.length > 1 ? "（并列）" : ""}。`,
    "money",
  );
}
// Enumerate all physical team combinations, never substituting a duplicate color.
export function combinations(
  s: Pick<State, "owners" | "table" | "travel" | "marker">,
): Resource[][] {
  const rs = resources(s).filter((r) => !r.away && r.owner !== null);
  const out: Resource[][] = [];
  const visit = (i: number, chosen: Resource[]) => {
    if (i === TEAMS.length) {
      if (
        validSelection(
          s,
          chosen.map((r) => r.id),
        )
      )
        out.push(chosen);
      return;
    }
    visit(i + 1, chosen);
    for (const r of rs.filter((r) => r.team === TEAMS[i]))
      visit(i + 1, [...chosen, r]);
  };
  visit(0, []);
  return out;
}
export function applyAction(state: State, action: Action): State {
  const s = structuredClone(state),
    a = action,
    actor = s.players[a.actor];
  requireRule(actor, "玩家不存在");
  requireRule(s.phase !== "finished", "游戏已结束");
  if (a.type === "CHAT") {
    requireRule(
      ["negotiation", "closing", "response"].includes(s.phase),
      "开始谈判后才能发言",
    );
    const t = a.text.trim().slice(0, 240);
    requireRule(t, "请先输入内容");
    log(s, `${actor.name}：${t}`, "chat", a.actor);
    s.revision++;
    return s;
  }
  const isBoss = () =>
    requireRule(a.actor === s.boss, "只有当前老板可以执行此操作");
  const onTurn = () => requireRule(a.actor === s.turnOwner, "现在不是你的回合");
  switch (a.type) {
    case "PLACE":
      requireRule(s.phase === "placement", "棋子已经放置");
      requireRule(
        a.actor === (s.turnOwner + s.players.length - 1) % s.players.length,
        "由起始玩家右手边的人放置棋子",
      );
      requireRule(
        Number.isInteger(a.space) && a.space >= 0 && a.space < 16,
        "交易格不存在",
      );
      s.marker = a.space;
      s.phase = "turn";
      log(s, `${actor.name} 将棋子放在 ${BOARD[a.space].name}。`);
      break;
    case "ROLL":
      onTurn();
      requireRule(s.phase === "turn", "每回合只能掷骰移动一次");
      s.marker = nextSpace(s, roll(s));
      s.phase = "moved";
      log(s, `${actor.name} 掷出 ${s.die}，前往 ${BOARD[s.marker].name}。`);
      break;
    case "DRAW":
      onTurn();
      requireRule(s.phase === "moved", "必须先掷骰移动，才可以选择补牌");
      requireRule(
        !s.variants.forceDeal || s.startHandCount < 10,
        "十张必须谈判变体：本回合必须尝试交易",
      );
      {
        const count = s.variants.variableDraw
          ? Math.max(1, 4 - TEAMS.filter((t) => s.owners[t] === a.actor).length)
          : 3;
        const before = actor.hand.length;
        draw(s, a.actor, count);
        log(s, `${actor.name} 抽取 ${actor.hand.length - before} 张影响力牌。`);
        s.boss = s.turnOwner;
        checkOverflow(s, "between");
      }
      break;
    case "OPEN":
      onTurn();
      requireRule(["turn", "moved"].includes(s.phase), "现在无法发起谈判");
      requireRule(
        !s.variants.minimumHand || actor.hand.length >= 4,
        "四张才可开谈变体：手牌不足 4 张",
      );
      s.phase = "negotiation";
      s.boss = a.actor;
      s.proposal = null;
      s.demands = {};
      s.played = [];
      log(
        s,
        `${actor.name}：来谈一笔生意。${BOARD[s.marker].name}，交易总额 $${pool(s)}M。`,
        "deal",
        a.actor,
      );
      break;
    case "PLAY": {
      requireRule(
        a.cards.length > 0 && new Set(a.cards).size === a.cards.length,
        "请选择不同的手牌",
      );
      const cards = a.cards.map((id) => actor.hand.find((c) => c.id === id));
      requireRule(cards.every(Boolean), "这张牌不在你的手中");
      const cs = cards as Card[],
        kind = cs[0].kind;
      requireRule(
        cs.every((c) => c.kind === kind),
        "不能混合不同类型的牌",
      );
      requireRule(
        kind === "recruit" ? cs.length === 3 : cs.length === 1,
        "招募必须同时打出三张，其他牌每次一张",
      );
      if (kind === "stop")
        requireRule(
          s.phase === "response" && s.pending,
          "STOP 只能紧接旅行、老板或三张招募牌使用，不能阻止 STOP",
        );
      else {
        requireRule(
          ["negotiation", "closing"].includes(s.phase) ||
            (s.phase === "discard" &&
              kind === "recruit" &&
              s.discardQueue[0] === a.actor),
          "只有谈判中可出牌；超限弃牌时可使用招募三张",
        );
      }
      if (kind === "travel") {
        const r = resources(s).find((r) => r.id === a.target);
        requireRule(
          r && !r.away && r.owner !== null,
          "请选择一位在场投资人或已打出的团队成员",
        );
        requireRule(
          !cs[0].team || cs[0].team === r.team,
          "该旅行牌只能用于对应颜色",
        );
      }
      if (kind === "recruit") {
        const r = resources(s).find((r) => r.id === a.target);
        requireRule(
          r && !r.card && r.owner !== a.actor,
          "只能招募公共投资人或其他玩家的投资人",
        );
        requireRule(
          !TEAMS.some((t) => s.owners[t] === null) || r.owner === null,
          "必须先招募公共区的投资人",
        );
      }
      actor.hand = actor.hand.filter((c) => !a.cards.includes(c.id));
      recordPlayed(s, a.actor);
      log(
        s,
        `${actor.name} 打出 ${kind === "recruit" ? "三张招募" : cardName(cs[0])}。`,
        "card",
        a.actor,
      );
      if (kind === "stop") {
        s.discard.push(...cs);
        resolvePending(s, true);
      } else if (kind === "team") {
        s.table.push({ card: cs[0], owner: a.actor });
        resetNegotiation(s, false);
      } else {
        s.pending = {
          actor: a.actor,
          cards: cs,
          target: a.target,
          passed: [a.actor],
          resume: s.phase === "discard" ? "discard" : "negotiation",
        };
        s.phase = "response";
      }
      break;
    }
    case "PASS":
      if (s.phase === "response") {
        requireRule(!s.pending!.passed.includes(a.actor), "你已放弃反制");
        s.pending!.passed.push(a.actor);
        if (s.pending!.passed.length === s.players.length) resolvePending(s);
      } else if (s.phase === "closing") {
        requireRule(
          a.actor !== s.boss && !s.closePassed.includes(a.actor),
          "你已确认本次成交",
        );
        s.closePassed.push(a.actor);
        log(s, `${actor.name} 暂不干预成交。`);
      } else throw new RuleError("现在没有需要回应的出牌或成交");
      break;
    case "DISCARD":
      requireRule(
        s.phase === "discard" && s.discardQueue[0] === a.actor,
        "现在无需你弃牌",
      );
      requireRule(
        a.cards.length > 0 &&
          new Set(a.cards).size === a.cards.length &&
          a.cards.every((id) => actor.hand.some((c) => c.id === id)),
        "请选择有效手牌",
      );
      requireRule(
        actor.hand.length - a.cards.length >= handLimit(s),
        "只需弃掉超出手牌上限的数量",
      );
      s.discard.push(...actor.hand.filter((c) => a.cards.includes(c.id)));
      actor.hand = actor.hand.filter((c) => !a.cards.includes(c.id));
      log(s, `${actor.name} 弃掉 ${a.cards.length} 张超限手牌。`);
      finishDiscard(s);
      break;
    case "PROPOSE": {
      isBoss();
      requireRule(["negotiation", "closing"].includes(s.phase), "请先开始谈判");
      requireRule(
        validSelection(s, a.resources),
        "投资团队不满足该交易的组合；每个颜色只能选一个代表",
      );
      requireRule(
        a.payouts.length === s.players.length &&
          a.payouts.every((v) => Number.isSafeInteger(v) && v >= 0),
        "分红金额应为非负整数百万",
      );
      const payouts = [...a.payouts];
      payouts[s.boss] =
        pool(s) -
        payouts.reduce((sum, v, i) => sum + (i === s.boss ? 0 : v), 0);
      requireRule(
        payouts[s.boss] >= 0,
        "分红总额超过当前交易收益，不能使用既有资产预付",
      );
      requireRule(
        !s.variants.paidMustPlay ||
          payouts.every((v, i) => !v || i === s.boss || s.played.includes(i)),
        "出牌才可分红变体：收款人本轮必须出过牌",
      );
      if (s.variants.lessCutthroat) {
        const selected = resources(s).filter((r) => a.resources.includes(r.id));
        const fair = Math.floor(pool(s) / (selected.length + 1));
        requireRule(
          payouts.every(
            (v, i) =>
              i === s.boss ||
              v >= selected.filter((r) => r.owner === i).length * fair,
          ),
          "温和谈判变体：每位投资人至少获得一份公平份额",
        );
      }
      resetNegotiation(s);
      s.proposal = {
        resources: [...a.resources],
        payouts,
        accepted: [s.boss],
        revision: s.revision + 1,
      };
      log(
        s,
        `${actor.name} 提出分红：${s.players.map((p) => `${p.name} $${payouts[p.id]}M`).join("，")}。`,
        "deal",
        a.actor,
      );
      break;
    }
    case "DEMAND":
      requireRule(
        ["negotiation", "closing"].includes(s.phase),
        "请在谈判中报价",
      );
      requireRule(
        Number.isSafeInteger(a.amount) && a.amount >= 0 && a.amount <= pool(s),
        "报价必须在本次交易收益范围内",
      );
      s.demands[a.actor] = a.amount;
      if (s.proposal)
        s.proposal.accepted = s.proposal.accepted.filter(
          (id) => id !== a.actor,
        );
      resetNegotiation(s, false);
      log(s, `${actor.name}：我要求 $${a.amount}M。`, "chat", a.actor);
      break;
    case "ACCEPT":
      requireRule(
        s.phase === "negotiation" && s.proposal,
        "目前没有待确认的方案",
      );
      requireRule(
        requiredApprovals(s, s.proposal).includes(a.actor),
        "当前方案不需要你确认",
      );
      requireRule(!s.proposal.accepted.includes(a.actor), "你已接受该方案");
      s.proposal.accepted.push(a.actor);
      log(
        s,
        `${actor.name} 接受 $${s.proposal.payouts[a.actor]}M 的分红。`,
        "chat",
        a.actor,
      );
      break;
    case "REJECT":
      requireRule(
        ["negotiation", "closing"].includes(s.phase) && s.proposal,
        "目前没有分红方案",
      );
      requireRule(
        requiredApprovals(s, s.proposal).includes(a.actor) &&
          a.actor !== s.boss,
        "你不是该方案的交易参与方",
      );
      s.proposal.accepted = s.proposal.accepted.filter((id) => id !== a.actor);
      resetNegotiation(s, false);
      log(s, `${actor.name} 拒绝当前方案，请重新报价。`, "chat", a.actor);
      break;
    case "CLOSE":
      isBoss();
      requireRule(
        s.phase === "negotiation" && isAgreed(s),
        "需要投资组合完整且所有参与方同意分红",
      );
      s.phase = "closing";
      s.closePassed = [s.boss];
      s.closingStage = 0;
      log(s, `${actor.name} 准备落槌，所有玩家仍可干预。`, "deal");
      break;
    case "GAVEL":
      isBoss();
      requireRule(
        s.phase === "closing" && isAgreed(s),
        "成交条件发生变化，请重新谈判",
      );
      requireRule(
        s.closePassed.length === s.players.length,
        "请等待所有玩家确认不再出牌",
      );
      s.closingStage++;
      if (s.closingStage >= 2) finishDeal(s, true);
      else log(s, "第一次……第二次落槌前仍可出牌。", "deal");
      break;
    case "FAIL":
      isBoss();
      requireRule(
        ["negotiation", "closing"].includes(s.phase),
        "只能结束正在进行的谈判",
      );
      requireRule(
        !s.variants.lessCutthroat ||
          !combinations(s).some(
            (chosen) =>
              !s.variants.paidMustPlay ||
              chosen.every(
                (r) => r.owner === s.boss || s.played.includes(r.owner!),
              ),
          ),
        "温和谈判变体：存在可行投资组合，必须完成交易",
      );
      finishDeal(s, false);
      break;
    case "END_ROLL":
      isBoss();
      requireRule(s.phase === "endcheck", "现在无需终局判定");
      {
        const die = roll(s),
          threshold = endThreshold(s.lastSettlement!.number);
        s.lastSettlement!.endDie = die;
        log(s, `终局判定：掷出 ${die}，${threshold} 以下（含）结束。`, "deal");
        if (die <= threshold) endGame(s);
        else s.phase = "between";
      }
      break;
    case "NEXT":
      requireRule(s.phase === "between", "当前阶段尚未结束");
      requireRule(a.actor === s.boss, "请由上一位老板继续");
      s.turnOwner =
        ((s.variants.fixedOrder ? s.turnOwner : s.boss) + 1) % s.players.length;
      s.boss = s.turnOwner;
      s.turn++;
      s.die = null;
      s.proposal = null;
      s.demands = {};
      s.played = [];
      s.phase = "turn";
      s.startHandCount = s.players[s.turnOwner].hand.length;
      log(s, `轮到 ${s.players[s.turnOwner].name}。`);
      break;
    default:
      throw new RuleError("未知游戏动作");
  }
  s.revision++;
  assertInvariants(s);
  return s;
}
export function observe(s: State, self: number): Observation {
  const { deck, seed, initialSeed, players, ...rest } = structuredClone(s);
  void seed;
  void initialSeed;
  return {
    ...rest,
    players: players.map(({ hand, money, ...p }) => ({
      ...p,
      handCount: hand.length,
      money: p.id === self || s.phase === "finished" ? money : null,
    })),
    deckCount: deck.length,
    hand: players[self].hand,
    self,
  };
}
export function assertInvariants(s: State) {
  const cards = [
    ...s.deck,
    ...s.discard,
    ...s.players.flatMap((p) => p.hand),
    ...s.table.map((t) => t.card),
    ...s.travel.map((t) => t.card),
    ...(s.pending?.cards ?? []),
  ];
  requireRule(
    cards.length === 98 && new Set(cards.map((c) => c.id)).size === 98,
    "存档损坏：卡牌总量或唯一性异常",
  );
  const valid = new Map(makeDeck().map((c) => [c.id, c]));
  requireRule(
    cards.every(
      (c) =>
        valid.has(c.id) &&
        valid.get(c.id)!.kind === c.kind &&
        valid.get(c.id)!.team === c.team,
    ),
    "存档损坏：未知卡牌",
  );
  requireRule(
    s.players.every((p) => Number.isSafeInteger(p.money) && p.money >= 0),
    "资产不能为负",
  );
  requireRule(
    s.players.reduce((n, p) => n + p.money, 0) === s.totalMinted,
    "交易收支不守恒",
  );
  requireRule(
    TEAMS.every(
      (t) => s.owners[t] === null || s.players[s.owners[t]!] !== undefined,
    ),
    "投资人归属无效",
  );
  requireRule(
    s.marker >= 0 && s.marker < 16 && Number.isInteger(s.marker),
    "棋子位置无效",
  );
  requireRule(s.players.length >= 3 && s.players.length <= 6, "人数无效");
}
export function restoreGame(raw: string): State {
  const s: State = JSON.parse(raw);
  requireRule(
    s &&
      typeof s === "object" &&
      Array.isArray(s.players) &&
      Array.isArray(s.deck) &&
      Array.isArray(s.discard) &&
      Array.isArray(s.table) &&
      Array.isArray(s.travel) &&
      Array.isArray(s.discardQueue) &&
      s.owners &&
      s.variants &&
      s.covered,
    "存档结构不完整",
  );
  requireRule(
    s.phase !== "response" ||
      (s.pending &&
        Array.isArray(s.pending.cards) &&
        s.pending.cards.length > 0 &&
        Array.isArray(s.pending.passed) &&
        s.players[s.pending.actor]),
    "存档缺少正在等待反制的动作",
  );
  requireRule(
    s.phase !== "discard" ||
      (s.discardQueue.length > 0 &&
        s.discardQueue.every((id) => s.players[id]) &&
        s.discardResume),
    "存档缺少超限手牌处理状态",
  );
  requireRule(
    s.phase !== "closing" ||
      (s.proposal &&
        Array.isArray(s.closePassed) &&
        Number.isInteger(s.closingStage)),
    "存档缺少成交方案",
  );
  requireRule(
    !s.proposal ||
      (Array.isArray(s.proposal.resources) &&
        s.proposal.payouts?.length === s.players.length &&
        s.proposal.payouts.every((v) => Number.isSafeInteger(v) && v >= 0) &&
        Array.isArray(s.proposal.accepted) &&
        s.proposal.accepted.every((id) => s.players[id])),
    "存档分红方案无效",
  );
  requireRule(
    !["endcheck", "finished"].includes(s.phase) || s.lastSettlement,
    "存档缺少交易结算",
  );
  requireRule(
    Array.isArray(s.winners) &&
      s.winners.every((id) => s.players[id]) &&
      s.players.every(
        (p) =>
          Array.isArray(p.hand) &&
          typeof p.name === "string" &&
          ["human", "bot"].includes(p.kind) &&
          ["balanced", "bold", "patient"].includes(p.style),
      ),
    "存档玩家数据无效",
  );
  requireRule(
    s.version === 1 &&
      Array.isArray(s.log) &&
      s.players?.every((p, i) => p.id === i) &&
      s.players[s.boss] &&
      s.players[s.turnOwner] &&
      Number.isInteger(s.seed) &&
      Array.isArray(s.dealNumbers) &&
      s.dealNumbers.length > 0 &&
      Number.isInteger(s.dealIndex) &&
      s.dealIndex >= 0 &&
      s.dealIndex <= s.dealNumbers.length &&
      [
        "placement",
        "turn",
        "moved",
        "negotiation",
        "response",
        "closing",
        "discard",
        "endcheck",
        "between",
        "finished",
      ].includes(s.phase),
    "存档格式不受支持",
  );
  assertInvariants(s);
  return s;
}
