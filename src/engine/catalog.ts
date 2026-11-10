import type { Card, DealSpace, Team, Variants } from "./types";
export const TEAMS: Team[] = [
  "red",
  "yellow",
  "blue",
  "orange",
  "purple",
  "green",
];
export const TEAM_INFO: Record<
  Team,
  { name: string; field: string; color: string; letter: string }
> = {
  red: { name: "传媒", field: "MEDIA", color: "#c45949", letter: "M" },
  yellow: { name: "金融", field: "FINANCE", color: "#c9a64f", letter: "F" },
  blue: { name: "科研", field: "SCIENCE", color: "#4f89b2", letter: "S" },
  orange: { name: "法律", field: "LEGAL", color: "#c08248", letter: "L" },
  purple: { name: "政界", field: "POLITICS", color: "#997ba7", letter: "P" },
  green: { name: "科技", field: "TECHNOLOGY", color: "#609579", letter: "T" },
};
export const DEFAULT_VARIANTS: Variants = {
  fixedOrder: false,
  forceDeal: false,
  paidMustPlay: false,
  variableDraw: false,
  minimumHand: false,
  lateHandLimit: false,
  shortGame: false,
  lessCutthroat: false,
};
export const VARIANT_INFO: {
  key: keyof Variants;
  name: string;
  description: string;
}[] = [
  {
    key: "fixedOrder",
    name: "固定回合顺序",
    description: "抢夺老板后，仍按原回合玩家的左手边继续。",
  },
  {
    key: "forceDeal",
    name: "十张必须谈判",
    description: "回合开始时有至少 10 张手牌，必须尝试交易。",
  },
  {
    key: "paidMustPlay",
    name: "出牌才可分红",
    description: "只有老板或本轮出过牌的玩家可以获得交易收入。",
  },
  {
    key: "variableDraw",
    name: "按投资人数补牌",
    description: "持有 0 / 1 / 2 / 3+ 位投资人时，抽 4 / 3 / 2 / 1 张。",
  },
  {
    key: "minimumHand",
    name: "四张才可开谈",
    description: "手牌少于 4 张时不能发起交易。",
  },
  {
    key: "lateHandLimit",
    name: "后期十张上限",
    description: "从第 10 号交易起，手牌上限降至 10 张。",
  },
  {
    key: "shortGame",
    name: "短局",
    description: "移除第 3、6、9 号交易牌，其余结算和结束条件相同。",
  },
  {
    key: "lessCutthroat",
    name: "温和谈判",
    description:
      "可按公平份额使用他人投资人；有可行方案时必须成交。公平份额按每个团队一份、老板一份，整百万余数归老板。",
  },
];
// Verified component transcription is populated from reference/board-data.json.
export const BOARD: DealSpace[] = [
  {
    id: 0,
    name: "第 01 号商机",
    dividends: 6,
    groups: [
      { teams: ["red", "yellow", "blue"], count: 3 },
      { teams: ["orange", "purple", "green"], count: 2 },
    ],
  },
  {
    id: 1,
    name: "第 02 号商机",
    dividends: 4,
    groups: [
      { teams: ["yellow"], count: 1 },
      { teams: ["purple", "blue"], count: 1 },
      { teams: ["green", "red"], count: 1 },
    ],
  },
  {
    id: 2,
    name: "第 03 号商机",
    dividends: 3,
    groups: [{ teams: ["purple", "orange"], count: 2 }],
  },
  {
    id: 3,
    name: "第 04 号商机",
    dividends: 4,
    groups: [{ teams: ["purple", "yellow", "orange", "red"], count: 3 }],
  },
  {
    id: 4,
    name: "第 05 号商机",
    dividends: 6,
    groups: [
      { teams: ["blue", "red"], count: 2 },
      { teams: ["orange", "yellow", "green", "purple"], count: 3 },
    ],
  },
  {
    id: 5,
    name: "第 06 号商机",
    dividends: 5,
    groups: [
      {
        teams: ["red", "yellow", "blue", "orange", "purple", "green"],
        count: 4,
      },
    ],
  },
  {
    id: 6,
    name: "第 07 号商机",
    dividends: 4,
    groups: [{ teams: ["red", "orange", "blue"], count: 3 }],
  },
  {
    id: 7,
    name: "第 08 号商机",
    dividends: 5,
    groups: [
      { teams: ["yellow", "orange", "purple"], count: 2 },
      { teams: ["red", "blue", "green"], count: 2 },
    ],
  },
  {
    id: 8,
    name: "第 09 号商机",
    dividends: 6,
    groups: [
      { teams: ["orange", "blue", "red", "yellow"], count: 3 },
      { teams: ["green", "purple"], count: 2 },
    ],
  },
  {
    id: 9,
    name: "第 10 号商机",
    dividends: 4,
    groups: [
      { teams: ["yellow", "blue"], count: 1 },
      { teams: ["purple", "green"], count: 2 },
    ],
  },
  {
    id: 10,
    name: "第 11 号商机",
    dividends: 4,
    groups: [
      { teams: ["green", "orange"], count: 1 },
      { teams: ["red", "purple"], count: 1 },
      { teams: ["blue", "yellow"], count: 1 },
    ],
  },
  {
    id: 11,
    name: "第 12 号商机",
    dividends: 3,
    groups: [{ teams: ["green", "yellow"], count: 2 }],
  },
  {
    id: 12,
    name: "第 13 号商机",
    dividends: 6,
    groups: [
      { teams: ["green", "orange", "red", "yellow", "purple"], count: 4 },
      { teams: ["blue"], count: 1 },
    ],
  },
  {
    id: 13,
    name: "第 14 号商机",
    dividends: 3,
    groups: [{ teams: ["blue", "red"], count: 2 }],
  },
  {
    id: 14,
    name: "第 15 号商机",
    dividends: 5,
    groups: [
      { teams: ["yellow", "green", "purple", "orange", "red"], count: 4 },
    ],
  },
  {
    id: 15,
    name: "第 16 号商机",
    dividends: 4,
    groups: [
      { teams: ["yellow", "blue", "orange"], count: 2 },
      { teams: ["purple", "green"], count: 1 },
    ],
  },
];
export function makeDeck(): Card[] {
  const cards: Card[] = [];
  const add = (kind: Card["kind"], count: number, team?: Team) => {
    for (let i = 0; i < count; i++)
      cards.push({
        id: `${kind}-${team ?? "any"}-${i}`,
        kind,
        ...(team ? { team } : {}),
      });
  };
  for (const team of TEAMS) {
    add("team", 4, team);
    add("travel", 3, team);
  }
  add("travel", 3);
  add("recruit", 33);
  add("boss", 10);
  add("stop", 10);
  return cards;
}
export const dividendValue = (dealNumber: number) =>
  dealNumber <= 3 ? 2 : dealNumber <= 6 ? 3 : dealNumber <= 9 ? 4 : 5;
export const endThreshold = (dealNumber: number) =>
  Math.max(0, Math.min(6, dealNumber - 9));
export const cardName = (c: Card) =>
  c.kind === "team"
    ? `${TEAM_INFO[c.team!].name}团队`
    : c.kind === "travel"
      ? `${c.team ? TEAM_INFO[c.team].name : "万能"}旅行`
      : c.kind === "recruit"
        ? "招募"
        : c.kind === "boss"
          ? "我是大老板"
          : "STOP";
