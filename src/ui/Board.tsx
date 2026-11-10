import { Crown, Layers, RotateCw, Coins, Check, Users } from "lucide-react";
import { BOARD, TEAM_INFO, TEAMS, dividendValue } from "../engine/catalog";
import { dealNumber } from "../engine/game";
import type { State, Player } from "../engine/types";
import { TeamIcon } from "./Icons";
const cells = [
  [4, 1],
  [3, 1],
  [2, 1],
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [4, 5],
  [4, 4],
  [4, 3],
  [4, 2],
];
export function Board({
  state,
  inspect,
  onInspect,
}: {
  state: State;
  inspect: number | null;
  onInspect: (id: number) => void;
}) {
  return (
    <div className="board-scroll">
      <div className="wood-board">
        <div className="board-grid">
          {BOARD.map((d, i) => (
            <button
              key={i}
              style={{ gridRow: cells[i][0], gridColumn: cells[i][1] }}
              className={`deal-tile ${state.marker === i ? "active" : ""} ${state.covered[i] !== undefined ? "completed" : ""} ${inspect === i ? "inspected" : ""}`}
              onClick={() => onInspect(i)}
              aria-label={`${d.name}，${d.groups.reduce((n, g) => n + g.count, 0)}位投资人，${d.dividends}份分红${state.marker === i ? "，棋子在此" : ""}`}
            >
              <span className="tile-top">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>
                  ×{d.dividends}
                  <Coins size={11} />
                </strong>
              </span>
              {state.covered[i] !== undefined ? (
                <span className="deal-seal">
                  <Check size={21} />
                  <strong>成交</strong>
                  <small>DEAL {state.covered[i]}</small>
                </span>
              ) : (
                <>
                  <span className="tile-groups">
                    {d.groups.map((g, j) => (
                      <span className="tile-group" key={j}>
                        <span>
                          {g.teams.map((t) => (
                            <TeamIcon team={t} key={t} size={12} />
                          ))}
                        </span>
                        <small>
                          {g.count === g.teams.length
                            ? "全部"
                            : `选 ${g.count}`}
                        </small>
                      </span>
                    ))}
                  </span>
                  <span className="tile-count">
                    <Users size={10} />
                    {d.groups.reduce((n, g) => n + g.count, 0)} 位
                  </span>
                </>
              )}
              {state.marker === i && (
                <span className="money-pawn" aria-hidden="true">
                  $
                </span>
              )}
            </button>
          ))}
          <div className="board-center">
            <div className="center-ornament">
              <span />
              <Crown size={19} />
              <span />
            </div>
            <h1>
              I’M THE
              <br />
              <strong>BOSS!</strong>
            </h1>
            <p>没有永远的朋友，只有下一笔生意。</p>
            <div className="table-decks">
              <div className="deck-stack influence-stack">
                <Layers size={22} />
                <strong>影响力</strong>
                <small>{state.deck.length} 张</small>
              </div>
              <div className="dividend-placard">
                <span>交易 {String(dealNumber(state)).padStart(2, "0")}</span>
                <strong>
                  ${dividendValue(dealNumber(state))}
                  <small>M</small>
                </strong>
                <span>每份分红</span>
              </div>
              <div className="deck-stack discard-stack">
                <RotateCw size={20} />
                <strong>弃牌堆</strong>
                <small>{state.discard.length} 张</small>
              </div>
            </div>
            <div
              className="table-die"
              key={`${state.turn}-${state.die}`}
              title={state.die ? `骰子结果：${state.die}` : "六面骰"}
              aria-label={state.die ? `骰子结果 ${state.die}` : "六面骰"}
            >
              <div className="die-side" />
              <div className="die-front">
                {Array.from({ length: 9 }, (_, i) => (
                  <i
                    key={i}
                    className={
                      [
                        [],
                        [4],
                        [0, 8],
                        [0, 4, 8],
                        [0, 2, 6, 8],
                        [0, 2, 4, 6, 8],
                        [0, 2, 3, 5, 6, 8],
                      ][state.die ?? 1].includes(i)
                        ? "pip"
                        : ""
                    }
                  />
                ))}
              </div>
            </div>
            <span className="board-direction">
              顺时针前进 · 已成交格跳过 <RotateCw size={12} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
export function Seat({
  player,
  state,
  viewer,
  onSelect,
}: {
  player: Player;
  state: State;
  viewer: number;
  onSelect: () => void;
}) {
  const teams = TEAMS.filter((t) => state.owners[t] === player.id),
    lead = teams[0];
  const active =
    state.boss === player.id &&
    ["negotiation", "response", "closing"].includes(state.phase);
  const turn = state.turnOwner === player.id;
  return (
    <button
      className={`player-seat ${viewer === player.id ? "viewing" : ""} ${active ? "boss-seat" : ""}`}
      onClick={onSelect}
      disabled={player.kind === "bot"}
      aria-label={`${player.name}，${player.kind === "bot" ? "电脑对手" : "点击交接设备"}`}
    >
      <span
        className="avatar"
        style={
          {
            "--avatar-color": lead ? TEAM_INFO[lead].color : "#ad9773",
          } as React.CSSProperties
        }
      >
        {lead ? (
          <img src={`./assets/investor-${lead}.png`} alt="" />
        ) : (
          <span>{player.name.slice(0, 1)}</span>
        )}
        {active && (
          <span className="avatar-crown">
            <Crown size={12} />
          </span>
        )}
      </span>
      <span className="seat-info">
        <span className="seat-name">
          {player.name}
          <small>
            {active
              ? "老板"
              : turn
                ? "本回合"
                : player.kind === "bot"
                  ? "电脑"
                  : "真人"}
          </small>
        </span>
        <span className="seat-teams">
          {teams.length ? (
            teams.map((t) => (
              <span
                key={t}
                className={state.travel.some((v) => v.team === t) ? "away" : ""}
              >
                <TeamIcon team={t} size={12} />
              </span>
            ))
          ) : (
            <small>暂无投资人</small>
          )}
        </span>
        <span className="seat-wallet">
          <Coins size={11} />
          {viewer === player.id || state.phase === "finished"
            ? `$${player.money}M`
            : "资产保密"}
          <span className="mini-cards">▱ {player.hand.length}</span>
        </span>
      </span>
    </button>
  );
}
