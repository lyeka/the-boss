import { BOARD, TEAMS, dividendValue } from "../engine/catalog";
import {
  resources,
  combinations,
  pool,
  requiredApprovals,
  dealNumber,
  handLimit,
} from "../engine/game";
import type { Observation, Action, Resource, Proposal } from "../engine/types";
export function fairDemand(o: Observation, id: number, chosen: Resource[]) {
  const count = chosen.filter((r) => r.owner === id).length;
  if (!count) return 0;
  if (o.variants.paidMustPlay && !o.played.includes(id)) return 0;
  const base = Math.max(1, Math.floor(pool(o) / (chosen.length + 1)));
  return Math.min(
    pool(o),
    base * count + (o.players[id].style === "bold" ? 1 : 0),
  );
}
export function suggestProposal(
  o: Observation,
): { resources: string[]; payouts: number[] } | null {
  let best: { resources: string[]; payouts: number[]; score: number } | null =
    null;
  for (const chosen of combinations(o)) {
    if (
      o.variants.lessCutthroat &&
      o.variants.paidMustPlay &&
      chosen.some((r) => r.owner !== o.boss && !o.played.includes(r.owner!))
    )
      continue;
    const payouts = o.players.map((p) =>
      p.id === o.boss
        ? 0
        : Math.max(o.demands[p.id] ?? 0, fairDemand(o, p.id, chosen)),
    );
    // An unsolicited quote by someone outside the coalition is not a binding contract.
    for (const p of o.players)
      if (!chosen.some((r) => r.owner === p.id)) payouts[p.id] = 0;
    if (
      o.variants.paidMustPlay &&
      payouts.some((v, i) => v && i !== o.boss && !o.played.includes(i))
    )
      continue;
    payouts[o.boss] = pool(o) - payouts.reduce((n, v) => n + v, 0);
    if (payouts[o.boss] < 0) continue;
    const score =
      payouts[o.boss] * 100 - chosen.filter((r) => r.card).length * 2;
    if (!best || score > best.score)
      best = { resources: chosen.map((r) => r.id), payouts, score };
  }
  return best;
}
function sameProposal(
  a: Proposal,
  b: { resources: string[]; payouts: number[] },
) {
  return (
    JSON.stringify(a.resources) === JSON.stringify(b.resources) &&
    JSON.stringify(a.payouts) === JSON.stringify(b.payouts)
  );
}
export function decide(o: Observation): Action | null {
  const id = o.self,
    hand = o.hand,
    me = o.players[id],
    action = (
      type:
        | "ROLL"
        | "OPEN"
        | "DRAW"
        | "FAIL"
        | "NEXT"
        | "END_ROLL"
        | "ACCEPT"
        | "PASS"
        | "CLOSE"
        | "GAVEL",
    ): Action => ({ type, actor: id });
  const play = (card: string, target?: string): Action => ({
    type: "PLAY",
    actor: id,
    cards: [card],
    target,
  });
  const myRs = resources(o).filter((r) => r.owner === id && !r.away);
  const relevant = BOARD[o.marker].groups.flatMap((g) => g.teams);
  const recruits = hand.filter((c) => c.kind === "recruit");
  const recruitTarget = resources(o)
    .filter(
      (r) =>
        !r.card &&
        r.owner !== id &&
        (!TEAMS.some((t) => o.owners[t] === null) || r.owner === null),
    )
    .sort(
      (a, b) =>
        Number(relevant.includes(b.team)) - Number(relevant.includes(a.team)),
    )[0];
  if (
    o.phase === "placement" &&
    id === (o.turnOwner + o.players.length - 1) % o.players.length
  ) {
    const ix = BOARD.findIndex((s) =>
      s.groups.some((g) => g.teams.some((t) => o.owners[t] === id)),
    );
    return { type: "PLACE", actor: id, space: Math.max(0, ix) };
  }
  if (o.phase === "response") {
    const p = o.pending!;
    if (p.passed.includes(id)) return null;
    const stop = hand.find((c) => c.kind === "stop");
    const target = resources(o).find((r) => r.id === p.target);
    if (
      stop &&
      ((p.cards[0].kind === "boss" && o.boss === id) ||
        target?.owner === id ||
        (id === o.boss &&
          p.cards[0].kind === "travel" &&
          o.proposal?.resources.includes(p.target!)))
    )
      return play(stop.id);
    return action("PASS");
  }
  if (o.phase === "discard" && o.discardQueue[0] === id) {
    if (recruits.length >= 3 && recruitTarget)
      return {
        type: "PLAY",
        actor: id,
        cards: recruits.slice(0, 3).map((c) => c.id),
        target: recruitTarget.id,
      };
    const ranked = [...hand].sort(
      (a, b) =>
        ({ travel: 0, recruit: 1, team: 2, boss: 3, stop: 4 })[a.kind] -
        { travel: 0, recruit: 1, team: 2, boss: 3, stop: 4 }[b.kind],
    );
    return {
      type: "DISCARD",
      actor: id,
      cards: ranked.slice(0, hand.length - handLimit(o)).map((c) => c.id),
    };
  }
  if (o.phase === "between" && o.boss === id) return action("NEXT");
  if (o.phase === "endcheck" && o.boss === id) return action("END_ROLL");
  if ((o.phase === "turn" || o.phase === "moved") && o.turnOwner === id) {
    const canOpen = !o.variants.minimumHand || hand.length >= 4;
    const force = o.variants.forceDeal && o.startHandCount >= 10;
    const available =
      combinations(o).length > 0 ||
      hand.some((c) => c.kind === "team" && relevant.includes(c.team!));
    if (o.phase === "turn") {
      if (
        canOpen &&
        available &&
        (hand.length >= 7 ||
          myRs.filter((r) => relevant.includes(r.team)).length >= 2)
      )
        return action("OPEN");
      return action("ROLL");
    }
    if (
      canOpen &&
      (force || hand.length >= 9 || (available && hand.length >= 5))
    )
      return action("OPEN");
    return action("DRAW");
  }
  if (!["negotiation", "closing"].includes(o.phase)) return null;
  const myPlays = o.log.filter(
    (e) => e.turn === o.turn && e.actor === id && e.type === "card",
  ).length;
  if (
    recruits.length >= 3 &&
    recruitTarget &&
    (myPlays < 2 || recruits.length >= 6)
  )
    return {
      type: "PLAY",
      actor: id,
      cards: recruits.slice(0, 3).map((c) => c.id),
      target: recruitTarget.id,
    };
  // Tactical aggression uses public information and our own cards only.
  const bossCard = hand.find((c) => c.kind === "boss");
  const standing = myRs.filter((r) => relevant.includes(r.team)).length;
  if (
    id !== o.boss &&
    bossCard &&
    myPlays < 2 &&
    standing > 0 &&
    o.proposal &&
    (o.proposal.payouts[id] === 0 ||
      (me.style === "bold" &&
        o.proposal.payouts[o.boss] > o.proposal.payouts[id] * 3))
  )
    return play(bossCard.id);
  const team = hand.find(
    (c) =>
      c.kind === "team" &&
      ((o.variants.paidMustPlay && !o.played.includes(id)) ||
        (relevant.includes(c.team!) && !myRs.some((r) => r.team === c.team))),
  );
  if (team && (id === o.boss || !o.proposal || o.proposal.payouts[id] === 0))
    return play(team.id);
  if (
    id !== o.boss &&
    myPlays < 2 &&
    me.style === "bold" &&
    o.proposal &&
    o.proposal.payouts[id] === 0
  ) {
    const target = resources(o).find(
      (r) =>
        !r.away &&
        r.owner === o.boss &&
        o.proposal!.resources.includes(r.id) &&
        myRs.some((m) => m.team === r.team),
    );
    const travel =
      target &&
      hand.find(
        (c) => c.kind === "travel" && (!c.team || c.team === target.team),
      );
    if (travel) return play(travel.id, target!.id);
  }
  if (o.phase === "closing") {
    if (id === o.boss)
      return o.closePassed.length === o.players.length ? action("GAVEL") : null;
    return o.closePassed.includes(id) ? null : action("PASS");
  }
  if (id === o.boss) {
    const proposal = suggestProposal(o);
    if (!proposal) return action("FAIL");
    if (!o.proposal || !sameProposal(o.proposal, proposal))
      return { type: "PROPOSE", actor: id, ...proposal };
    if (
      requiredApprovals(o, o.proposal).every((i) =>
        o.proposal!.accepted.includes(i),
      )
    )
      return action("CLOSE");
    return null;
  }
  if (
    o.proposal &&
    requiredApprovals(o, o.proposal).includes(id) &&
    !o.proposal.accepted.includes(id)
  ) {
    const chosen = resources(o).filter((r) =>
      o.proposal!.resources.includes(r.id),
    );
    const demand = o.demands[id] ?? fairDemand(o, id, chosen);
    if (o.proposal.payouts[id] >= demand) return action("ACCEPT");
    if (o.demands[id] !== demand)
      return { type: "DEMAND", actor: id, amount: demand };
  }
  return null;
}
export const basicAgent = { decide };
export function describeDividend(
  o: Pick<Observation, "dealNumbers" | "dealIndex">,
) {
  return dividendValue(dealNumber(o));
}
