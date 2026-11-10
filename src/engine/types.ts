export type Team = "red" | "yellow" | "blue" | "orange" | "purple" | "green";
export type CardKind = "team" | "travel" | "recruit" | "boss" | "stop";
export interface Card {
  id: string;
  kind: CardKind;
  team?: Team;
}
export interface Player {
  id: number;
  name: string;
  kind: "human" | "bot";
  style: "balanced" | "bold" | "patient";
  hand: Card[];
  money: number;
}
export interface Group {
  teams: Team[];
  count: number;
}
export interface DealSpace {
  id: number;
  name: string;
  dividends: number;
  groups: Group[];
}
export interface Resource {
  id: string;
  team: Team;
  owner: number | null;
  card?: Card;
  away: boolean;
}
export interface Proposal {
  resources: string[];
  payouts: number[];
  accepted: number[];
  revision: number;
}
export interface TableCard {
  card: Card;
  owner: number;
}
export type Phase =
  | "placement"
  | "turn"
  | "moved"
  | "negotiation"
  | "response"
  | "closing"
  | "discard"
  | "endcheck"
  | "between"
  | "finished";
export interface Pending {
  actor: number;
  cards: Card[];
  target?: string;
  passed: number[];
  resume: "negotiation" | "discard";
}
export interface Variants {
  fixedOrder: boolean;
  forceDeal: boolean;
  paidMustPlay: boolean;
  variableDraw: boolean;
  minimumHand: boolean;
  lateHandLimit: boolean;
  shortGame: boolean;
  lessCutthroat: boolean;
}
export interface GameEvent {
  id: number;
  turn: number;
  text: string;
  type: "info" | "card" | "money" | "deal" | "chat";
  actor?: number;
}
export interface Settlement {
  number: number;
  boss: number;
  space: number;
  amount: number;
  payouts: number[];
  success: boolean;
  endDie?: number;
}
export interface State {
  version: 1;
  seed: number;
  initialSeed: number;
  players: Player[];
  owners: Record<Team, number | null>;
  deck: Card[];
  discard: Card[];
  table: TableCard[];
  travel: { team: Team; card: Card }[];
  phase: Phase;
  turn: number;
  turnOwner: number;
  boss: number;
  marker: number;
  covered: Record<number, number>;
  dealNumbers: number[];
  dealIndex: number;
  die: number | null;
  pending: Pending | null;
  proposal: Proposal | null;
  demands: Record<number, number>;
  closePassed: number[];
  closingStage: number;
  played: number[];
  variants: Variants;
  log: GameEvent[];
  revision: number;
  lastSettlement: Settlement | null;
  totalMinted: number;
  discardQueue: number[];
  discardResume: Phase | null;
  startHandCount: number;
  winners: number[];
}
export type Action =
  | { type: "PLACE"; actor: number; space: number }
  | {
      type:
        | "ROLL"
        | "DRAW"
        | "OPEN"
        | "FAIL"
        | "PASS"
        | "ACCEPT"
        | "REJECT"
        | "CLOSE"
        | "GAVEL"
        | "END_ROLL"
        | "NEXT";
      actor: number;
    }
  | { type: "PLAY"; actor: number; cards: string[]; target?: string }
  | { type: "DISCARD"; actor: number; cards: string[] }
  | { type: "PROPOSE"; actor: number; resources: string[]; payouts: number[] }
  | { type: "DEMAND"; actor: number; amount: number }
  | { type: "CHAT"; actor: number; text: string };
export interface PlayerConfig {
  name: string;
  kind: "human" | "bot";
  style?: Player["style"];
}
export interface PublicPlayer extends Omit<Player, "hand" | "money"> {
  handCount: number;
  money: number | null;
}
export interface Observation
  extends Omit<State, "players" | "deck" | "seed" | "initialSeed"> {
  players: PublicPlayer[];
  deckCount: number;
  hand: Card[];
  self: number;
}
export type DecisionAgent = { decide(observation: Observation): Action | null };
