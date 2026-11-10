import { describe, it, expect } from "vitest";
import {
  createGame,
  applyAction,
  assertInvariants,
  validSelection,
  nextSpace,
  observe,
  restoreGame,
  resources,
  handLimit,
} from "../src/engine/game";
import {
  makeDeck,
  TEAMS,
  BOARD,
  dividendValue,
  endThreshold,
} from "../src/engine/catalog";
import { decide } from "../src/agents/basic";
import type { State, Card, Action, Team, Variants } from "../src/engine/types";
const configs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `P${i}`,
    kind: "bot" as const,
    style: (["balanced", "bold", "patient"] as const)[i % 3],
  }));
function game(n = 4) {
  let s = createGame(configs(n), 1234);
  s = applyAction(s, {
    type: "PLACE",
    actor: (s.turnOwner + n - 1) % n,
    space: 13,
  });
  return s;
}
function fixture() {
  const s = game();
  s.phase = "negotiation";
  s.turnOwner = 0;
  s.boss = 0;
  s.marker = 13;
  s.owners = { red: 0, blue: 1, yellow: 2, orange: 3, purple: 2, green: 3 };
  s.deck.push(...s.players.flatMap((p) => p.hand));
  for (const p of s.players) p.hand = [];
  return s;
}
function give(
  s: State,
  player: number,
  kind: Card["kind"],
  team?: Team,
  count = 1,
) {
  for (let i = 0; i < count; i++) {
    const ix = s.deck.findIndex((c) => c.kind === kind && c.team === team);
    if (ix < 0) throw Error("No fixture card");
    s.players[player].hand.push(s.deck.splice(ix, 1)[0]);
  }
  return s.players[player].hand
    .filter((c) => c.kind === kind && c.team === team)
    .slice(-count)
    .map((c) => c.id);
}
function play(
  s: State,
  actor: number,
  kind: Card["kind"],
  team?: Team,
  target?: string,
  count = 1,
) {
  const cards = give(s, actor, kind, team, count);
  return applyAction(s, { type: "PLAY", actor, cards, target });
}
function passAll(state: State) {
  let s = state;
  for (let i = 0; i < s.players.length; i++)
    if (
      (s.phase === "response" && !s.pending!.passed.includes(i)) ||
      (s.phase === "closing" && !s.closePassed.includes(i))
    )
      s = applyAction(s, { type: "PASS", actor: i });
  return s;
}
function propose(
  s: State,
  ids = ["investor-red", "investor-blue"],
  payouts = [4, 2, 0, 0],
) {
  return applyAction(s, {
    type: "PROPOSE",
    actor: s.boss,
    resources: ids,
    payouts,
  });
}
function close(s: State) {
  for (let i = 0; i < s.players.length; i++)
    if (
      s.proposal &&
      !s.proposal.accepted.includes(i) &&
      (s.proposal.payouts[i] > 0 ||
        resources(s).some(
          (r) => r.owner === i && s.proposal!.resources.includes(r.id),
        ))
    )
      s = applyAction(s, { type: "ACCEPT", actor: i });
  s = applyAction(s, { type: "CLOSE", actor: s.boss });
  s = passAll(s);
  s = applyAction(s, { type: "GAVEL", actor: s.boss });
  return applyAction(s, { type: "GAVEL", actor: s.boss });
}

describe("原版组件与准备", () => {
  it("有98张牌且每个颜色张数精确", () => {
    const d = makeDeck();
    expect(d).toHaveLength(98);
    for (const t of TEAMS) {
      expect(d.filter((c) => c.kind === "team" && c.team === t)).toHaveLength(
        4,
      );
      expect(d.filter((c) => c.kind === "travel" && c.team === t)).toHaveLength(
        3,
      );
    }
    expect(d.filter((c) => c.kind === "recruit")).toHaveLength(33);
    expect(d.filter((c) => c.kind === "boss")).toHaveLength(10);
    expect(d.filter((c) => c.kind === "stop")).toHaveLength(10);
    expect(d.filter((c) => c.kind === "travel" && !c.team)).toHaveLength(3);
  });
  for (const n of [3, 4, 5, 6])
    it(`${n}人分配、手牌、现金和公共投资人正确`, () => {
      const s = createGame(configs(n), 3);
      for (const p of s.players) {
        expect(p.money).toBe(0);
        expect(p.hand).toHaveLength(5);
        expect(TEAMS.filter((t) => s.owners[t] === p.id)).toHaveLength(
          n === 3 ? 2 : 1,
        );
      }
      expect(TEAMS.filter((t) => s.owners[t] === null)).toHaveLength(
        n === 3 ? 0 : 6 - n,
      );
      assertInvariants(s);
    });
  it("相同种子结果可复现且观察接口不泄露其他手牌或牌库", () => {
    expect(createGame(configs(4), 42)).toEqual(createGame(configs(4), 42));
    const o = observe(game(), 0);
    expect(o).not.toHaveProperty("deck");
    expect(o).not.toHaveProperty("seed");
    expect(o.players[1]).not.toHaveProperty("hand");
    expect(o.players[1].money).toBeNull();
  });
  it("16格严格满足原PDF分组而不是仅人数", () => {
    expect(BOARD).toHaveLength(16);
    const s = fixture();
    s.marker = 10;
    expect(
      validSelection(s, ["investor-green", "investor-red", "investor-blue"]),
    ).toBe(true);
    expect(
      validSelection(s, ["investor-green", "investor-orange", "investor-blue"]),
    ).toBe(false);
    s.marker = 0;
    expect(
      validSelection(s, [
        "investor-red",
        "investor-yellow",
        "investor-blue",
        "investor-purple",
        "investor-green",
      ]),
    ).toBe(true);
    expect(
      validSelection(s, [
        "investor-red",
        "investor-yellow",
        "investor-green",
        "investor-purple",
        "investor-orange",
      ]),
    ).toBe(false);
  });
  it("分红牌和终局阈值", () => {
    expect(Array.from({ length: 15 }, (_, i) => dividendValue(i + 1))).toEqual([
      2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5,
    ]);
    expect([10, 11, 12, 13, 14, 15].map(endThreshold)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});
describe("回合与补牌", () => {
  it("原地不能抽牌且回合外不能出牌", () => {
    const s = game();
    expect(() =>
      applyAction(s, { type: "DRAW", actor: s.turnOwner }),
    ).toThrow();
    const c = s.players[0].hand[0];
    expect(() =>
      applyAction(s, { type: "PLAY", actor: 0, cards: [c.id] }),
    ).toThrow();
  });
  it("跳过已成交格，只掷一次，抽牌后结束回合", () => {
    let s = game();
    s.marker = 0;
    s.covered = { 1: 1, 2: 2, 4: 3 };
    expect(nextSpace(s, 3)).toBe(6);
    s = applyAction(s, { type: "ROLL", actor: s.turnOwner });
    expect(() =>
      applyAction(s, { type: "ROLL", actor: s.turnOwner }),
    ).toThrow();
    const before = s.players[s.turnOwner].hand.length;
    s = applyAction(s, { type: "DRAW", actor: s.turnOwner });
    expect(s.players[s.turnOwner].hand).toHaveLength(before + 3);
    expect(s.phase).toBe("between");
  });
  it("空牌库按需洗弃牌且手牌超限需要处理", () => {
    let s = game();
    const id = s.turnOwner;
    s.discard.push(...s.deck.splice(0));
    s.phase = "moved";
    s.players[id].hand.push(...s.discard.splice(0, 7));
    s = applyAction(s, { type: "DRAW", actor: id });
    expect(s.phase).toBe("discard");
    expect(s.players[id].hand).toHaveLength(15);
    expect(() =>
      applyAction(s, {
        type: "DISCARD",
        actor: id,
        cards: s.players[id].hand.slice(0, 4).map((c) => c.id),
      }),
    ).toThrow();
    s = applyAction(s, {
      type: "DISCARD",
      actor: id,
      cards: s.players[id].hand.slice(0, 3).map((c) => c.id),
    });
    expect(s.phase).toBe("between");
    assertInvariants(s);
  });
});
describe("影响力牌的时机和对象", () => {
  it("STOP救第三方，不能STOP另一张STOP", () => {
    let s = fixture();
    s = play(s, 2, "travel", "blue", "investor-blue");
    s = play(s, 0, "stop");
    expect(s.travel).toHaveLength(0);
    expect(s.discard).toHaveLength(2);
    expect(s.phase).toBe("negotiation");
    const stop = give(s, 1, "stop");
    expect(() =>
      applyAction(s, { type: "PLAY", actor: 1, cards: stop }),
    ).toThrow();
  });
  it("旅行针对具体卡，不能以一张旅行封禁整个颜色", () => {
    let s = fixture();
    s = play(s, 2, "team", "blue");
    s = passAll(play(s, 3, "travel", "blue", "investor-blue"));
    expect(resources(s).find((r) => r.id === "investor-blue")!.away).toBe(true);
    expect(
      resources(s).filter((r) => r.team === "blue" && !r.away),
    ).toHaveLength(1);
    expect(() => play(s, 3, "travel", "red", "investor-blue")).toThrow();
  });
  it("旅行命中团队牌时两张牌一起弃置，STOP保护时团队留桌", () => {
    let s = fixture();
    s = play(s, 1, "team", "green");
    const target = s.table[0].card.id;
    s = play(s, 2, "travel", undefined, target);
    s = play(s, 0, "stop");
    expect(s.table).toHaveLength(1);
    s = passAll(play(s, 2, "travel", "green", target));
    expect(s.table).toHaveLength(0);
    expect(s.discard.some((c) => c.id === target)).toBe(true);
  });
  it("三张招募、公共投资人优先、永久归属、旅行状态保留", () => {
    let s = fixture();
    s.owners.green = null;
    const cards = give(s, 0, "recruit", undefined, 3);
    expect(() =>
      applyAction(s, {
        type: "PLAY",
        actor: 0,
        cards: cards.slice(0, 2),
        target: "investor-green",
      }),
    ).toThrow();
    expect(() =>
      applyAction(s, {
        type: "PLAY",
        actor: 0,
        cards,
        target: "investor-blue",
      }),
    ).toThrow();
    s = passAll(
      applyAction(s, {
        type: "PLAY",
        actor: 0,
        cards,
        target: "investor-green",
      }),
    );
    expect(s.owners.green).toBe(0);
    s = passAll(play(s, 2, "travel", "blue", "investor-blue"));
    s = passAll(play(s, 0, "recruit", undefined, "investor-blue", 3));
    expect(s.owners.blue).toBe(0);
    expect(s.travel[0].team).toBe("blue");
    s = applyAction(s, { type: "FAIL", actor: 0 });
    expect(s.owners.blue).toBe(0);
    expect(s.travel).toHaveLength(0);
  });
  it("可以STOP招募且已出的三张牌不会退回", () => {
    let s = fixture();
    s = play(s, 0, "recruit", undefined, "investor-blue", 3);
    s = play(s, 2, "stop");
    expect(s.owners.blue).toBe(1);
    expect(s.discard).toHaveLength(4);
  });
  it("手牌超限时允许招募例外，其他人可以STOP", () => {
    let s = fixture();
    s.players[0].hand.push(
      ...s.deck.filter((c) => c.kind === "recruit").slice(0, 13),
    );
    const ids = new Set(s.players[0].hand.map((c) => c.id));
    s.deck = s.deck.filter((c) => !ids.has(c.id));
    s.phase = "discard";
    s.discardQueue = [0];
    s.discardResume = "between";
    const stop = give(s, 1, "stop");
    s = applyAction(s, {
      type: "PLAY",
      actor: 0,
      cards: s.players[0].hand.slice(0, 3).map((c) => c.id),
      target: "investor-blue",
    });
    s = applyAction(s, { type: "PLAY", actor: 1, cards: stop });
    expect(s.phase).toBe("between");
    expect(s.owners.blue).toBe(1);
    expect(s.players[0].hand).toHaveLength(10);
  });
  it("老板卡可连续抢夺，保留团队和旅行，后续从最终老板左侧继续", () => {
    let s = fixture();
    s = play(s, 0, "team", "green");
    s = passAll(play(s, 2, "travel", "blue", "investor-blue"));
    s = passAll(play(s, 1, "boss"));
    s = passAll(play(s, 0, "boss"));
    s = passAll(play(s, 3, "boss"));
    expect(s.boss).toBe(3);
    expect(s.table).toHaveLength(1);
    expect(s.travel).toHaveLength(1);
    s = applyAction(s, { type: "FAIL", actor: 3 });
    s = applyAction(s, { type: "NEXT", actor: 3 });
    expect(s.turnOwner).toBe(0);
  });
});
describe("分配、落槌、清理和终局", () => {
  it("必须满足组合、预算和承诺，双落槌前不能结算", () => {
    let s = fixture();
    expect(() => propose(s, ["investor-red"], [4, 2, 0, 0])).toThrow();
    expect(() => propose(s, undefined, [0, 7, 0, 0])).toThrow();
    s = propose(s);
    expect(() => applyAction(s, { type: "CLOSE", actor: 0 })).toThrow();
    s = applyAction(s, { type: "ACCEPT", actor: 1 });
    s = applyAction(s, { type: "CLOSE", actor: 0 });
    expect(() => applyAction(s, { type: "GAVEL", actor: 0 })).toThrow();
    s = passAll(s);
    s = applyAction(s, { type: "GAVEL", actor: 0 });
    expect(s.totalMinted).toBe(0);
    s = applyAction(s, { type: "GAVEL", actor: 0 });
    expect(s.players.map((p) => p.money)).toEqual([4, 2, 0, 0]);
    expect(s.totalMinted).toBe(6);
    expect(s.covered[13]).toBe(1);
    expect(s.marker).toBe(14);
  });
  it("落槌前仍能出牌且成交后不可出牌", () => {
    let s = fixture();
    s = propose(s);
    s = applyAction(s, { type: "ACCEPT", actor: 1 });
    s = applyAction(s, { type: "CLOSE", actor: 0 });
    s = passAll(s);
    s = applyAction(s, { type: "GAVEL", actor: 0 });
    s = passAll(play(s, 2, "boss"));
    expect(s.phase).toBe("negotiation");
    expect(s.boss).toBe(2);
    expect(s.proposal).toBeNull();
  });
  it("只弃实际使用的团队牌，竞争代表和闲置牌回手", () => {
    let s = fixture();
    s = play(s, 1, "team", "blue");
    s = play(s, 2, "team", "blue");
    s = play(s, 0, "team", "green");
    const used = s.table.find((t) => t.owner === 1)!.card.id,
      unused = s.table.filter((t) => t.owner !== 1).map((t) => t.card.id);
    s = propose(s, ["investor-red", used]);
    s = close(s);
    expect(s.discard.some((c) => c.id === used)).toBe(true);
    expect(
      s.players.flatMap((p) => p.hand).filter((c) => unused.includes(c.id)),
    ).toHaveLength(2);
    expect(s.table).toHaveLength(0);
    expect(() => play(s, 0, "boss")).toThrow();
  });
  it("失败不移动、不盖格、不补牌，团队回手", () => {
    let s = fixture();
    s = play(s, 0, "team", "green");
    s = applyAction(s, { type: "FAIL", actor: 0 });
    expect(s.marker).toBe(13);
    expect(s.dealIndex).toBe(0);
    expect(s.covered).toEqual({});
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.totalMinted).toBe(0);
    expect(() => applyAction(s, { type: "DRAW", actor: 0 })).toThrow();
  });
  it("非参与者也可接受本次交易的支付", () => {
    let s = fixture();
    s = propose(s, undefined, [3, 2, 1, 0]);
    s = applyAction(s, { type: "ACCEPT", actor: 1 });
    expect(() => applyAction(s, { type: "CLOSE", actor: 0 })).toThrow();
    s = applyAction(s, { type: "ACCEPT", actor: 2 });
    s = close(s);
    expect(s.players[2].money).toBe(1);
  });
  it("第10笔才进入终局判定，第15笔自动结束", () => {
    let s = fixture();
    s.dealIndex = 9;
    s = propose(s, undefined, [10, 5, 0, 0]);
    s = close(s);
    expect(s.phase).toBe("endcheck");
    s = applyAction(s, { type: "END_ROLL", actor: 0 });
    expect(["between", "finished"]).toContain(s.phase);
    let f = fixture();
    f.dealIndex = 14;
    f = close(propose(f, undefined, [10, 5, 0, 0]));
    expect(f.phase).toBe("finished");
    expect(f.winners).toEqual([0]);
  });
  it("存档往返且拒绝损坏的重复卡牌", () => {
    const s = game();
    expect(restoreGame(JSON.stringify(s))).toEqual(s);
    s.deck[0] = s.deck[1];
    expect(() => restoreGame(JSON.stringify(s))).toThrow();
  });
});
describe("原书第6页完整示例回归", () => {
  it("David/Larry/Bill/Amy反制、抢老板、抬价、招募与30M结算", () => {
    let s = fixture();
    s.dealIndex = 12;
    s.marker = 0;
    s.owners = { blue: 0, purple: 0, red: 1, yellow: 2, green: 2, orange: 3 };
    s = play(s, 0, "team", "green");
    s = play(s, 0, "team", "yellow");
    s = play(s, 2, "travel", "blue", "investor-blue");
    s = play(s, 0, "stop");
    s = passAll(play(s, 3, "travel", "blue", "investor-blue"));
    s = play(s, 3, "team", "blue");
    s = passAll(play(s, 1, "boss"));
    s = passAll(play(s, 0, "boss"));
    s = passAll(play(s, 1, "boss"));
    s = play(s, 1, "team", "orange");
    s = play(s, 1, "team", "purple");
    s = passAll(play(s, 0, "recruit", undefined, "investor-yellow", 3));
    const used = [
      "investor-red",
      "investor-yellow",
      ...s.table
        .filter((t) => t.owner === 1 || t.owner === 3)
        .map((t) => t.card.id),
    ];
    s = propose(s, used, [10, 10, 0, 10]);
    s = close(s);
    expect(s.players.map((p) => p.money)).toEqual([10, 10, 0, 10]);
    expect(s.totalMinted).toBe(30);
    expect(s.players[0].hand.map((c) => c.team).sort()).toEqual([
      "green",
      "yellow",
    ]);
    expect(s.travel).toHaveLength(0);
    expect(s.owners.yellow).toBe(0);
    expect(s.phase).toBe("endcheck");
    assertInvariants(s);
  });
});
describe("完整自主对局", () => {
  for (const n of [3, 4, 5, 6])
    for (let seed = 1; seed <= 8; seed++)
      it(`${n}人，种子${seed}，能完成一局且资金卡牌守恒`, () => {
        let s = createGame(configs(n), seed);
        let steps = 0;
        while (s.phase !== "finished" && steps < 2500) {
          let action: Action | null = null;
          for (let j = 0; j < n; j++) {
            action = decide(observe(s, (j + s.revision) % n));
            if (action) break;
          }
          if (!action)
            throw new Error(
              `AI deadlock ${JSON.stringify({ phase: s.phase, boss: s.boss, proposal: s.proposal, demands: s.demands, turn: s.turn })}`,
            );
          s = applyAction(s, action);
          steps++;
        }
        expect(s.phase).toBe("finished");
        expect(Object.keys(s.covered).length).toBeGreaterThanOrEqual(10);
        expect(Object.keys(s.covered).length).toBeLessThanOrEqual(15);
        assertInvariants(s);
      }, 20000);
  for (const variant of [
    "fixedOrder",
    "forceDeal",
    "paidMustPlay",
    "variableDraw",
    "minimumHand",
    "lateHandLimit",
    "shortGame",
    "lessCutthroat",
  ] as (keyof Variants)[])
    it(`变体 ${variant} 完整一局`, () => {
      let s = createGame(configs(4), 7, { [variant]: true });
      for (let i = 0; i < 2500 && s.phase !== "finished"; i++) {
        const action = s.players
          .map((p) => decide(observe(s, p.id)))
          .find(Boolean);
        if (!action) throw Error(`deadlock ${s.phase} ${variant}`);
        s = applyAction(s, action);
      }
      expect(s.phase).toBe("finished");
      assertInvariants(s);
      if (variant === "shortGame") expect(s.dealNumbers).not.toContain(3);
      if (variant === "lateHandLimit") expect(handLimit(s)).toBe(10);
    }, 20000);
});

describe("接口边界与变体组合", () => {
  it("拒绝未知动作及缺失反制对象的存档", () => {
    const s = fixture();
    expect(() =>
      applyAction(s, { type: "CHEAT", actor: 0 } as unknown as Action),
    ).toThrow("未知");
    s.phase = "response";
    expect(() => restoreGame(JSON.stringify(s))).toThrow("反制");
  });
  it("八个变体同时开启仍可完成对局", () => {
    const variants: Variants = {
      fixedOrder: true,
      forceDeal: true,
      paidMustPlay: true,
      variableDraw: true,
      minimumHand: true,
      lateHandLimit: true,
      shortGame: true,
      lessCutthroat: true,
    };
    let s = createGame(configs(4), 71, variants);
    for (let i = 0; i < 3000 && s.phase !== "finished"; i++) {
      const action = s.players
        .map((p) => decide(observe(s, p.id)))
        .find(Boolean);
      if (!action) throw Error(`deadlock ${s.phase}`);
      s = applyAction(s, action);
    }
    expect(s.phase).toBe("finished");
    assertInvariants(s);
  }, 20000);
});
