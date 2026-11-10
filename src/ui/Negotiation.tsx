import { useState } from "react";
import { Check, Send, Handshake, Sparkles, MessageCircle } from "lucide-react";
import { BOARD, TEAM_INFO, TEAMS } from "../engine/catalog";
import {
  observe,
  pool,
  resources,
  validSelection,
  requiredApprovals,
} from "../engine/game";
import { suggestProposal } from "../agents/basic";
import type { State, Action } from "../engine/types";
import { TeamIcon } from "./Icons";
export function Negotiation({
  state: s,
  viewer,
  dispatch,
}: {
  state: State;
  viewer: number;
  dispatch: (a: Action) => void;
}) {
  const suggestion = suggestProposal(observe(s, s.boss));
  const [selected, setSelected] = useState<string[]>(
      s.proposal?.resources ?? suggestion?.resources ?? [],
    ),
    [payouts, setPayouts] = useState<number[]>(
      s.proposal?.payouts ?? suggestion?.payouts ?? s.players.map(() => 0),
    );
  const [demand, setDemand] = useState(
      s.demands[viewer] ?? Math.max(1, Math.floor(pool(s) / 4)),
    ),
    [chat, setChat] = useState("");
  const rs = resources(s),
    mine = viewer === s.boss,
    editable = ["negotiation", "closing"].includes(s.phase),
    required = s.proposal ? requiredApprovals(s, s.proposal) : [];
  const remainder =
    pool(s) - payouts.reduce((n, v, i) => n + (i === s.boss ? 0 : v), 0);
  return (
    <div className="negotiation">
      <div className="section-title">
        <h3>
          <Handshake size={17} /> 谈判桌
        </h3>
        <span>{s.players[s.boss].name} 做主</span>
      </div>
      {s.proposal && (
        <div className="live-proposal">
          <div className="proposal-heading">
            <strong>当前分红方案</strong>
            <span>
              {s.proposal.accepted.filter((i) => required.includes(i)).length}/
              {required.length} 已同意
            </span>
          </div>
          {s.players.map((p) => (
            <div className="proposal-line" key={p.id}>
              <span>
                {p.name}
                {p.id === s.boss && <small>老板</small>}
              </span>
              <strong>${s.proposal!.payouts[p.id]}M</strong>
              <span>
                {s.proposal!.accepted.includes(p.id) ? (
                  <Check size={14} />
                ) : required.includes(p.id) ? (
                  "待确认"
                ) : (
                  "—"
                )}
              </span>
            </div>
          ))}
          {!mine &&
            required.includes(viewer) &&
            !s.proposal.accepted.includes(viewer) &&
            s.phase === "negotiation" && (
              <button
                className="primary wide"
                onClick={() => dispatch({ type: "ACCEPT", actor: viewer })}
              >
                <Check size={16} />
                接受 ${s.proposal.payouts[viewer]}M 分红
              </button>
            )}
          {!mine && s.proposal.accepted.includes(viewer) && editable && (
            <button
              className="text-button"
              onClick={() => dispatch({ type: "REJECT", actor: viewer })}
            >
              撤回同意，重新议价
            </button>
          )}
        </div>
      )}
      {mine && editable ? (
        <>
          <details className="proposal-editor" open={!s.proposal}>
            <summary>
              {s.proposal ? "修改分红与参与团队" : "拟定交易方案"}
            </summary>
            <button
              className="text-button auto-proposal"
              onClick={() => {
                const p = suggestProposal(observe(s, viewer));
                if (p) {
                  setSelected(p.resources);
                  setPayouts(p.payouts);
                }
              }}
            >
              <Sparkles size={13} /> 按当前报价拟案
            </button>
            <div className="representatives">
              {TEAMS.filter((t) =>
                BOARD[s.marker].groups.some((g) => g.teams.includes(t)),
              ).map((t) => (
                <label key={t}>
                  <TeamIcon team={t} size={14} label />
                  <select
                    aria-label={`${TEAM_INFO[t].name}代表`}
                    value={
                      selected.find(
                        (id) => rs.find((r) => r.id === id)?.team === t,
                      ) ?? ""
                    }
                    onChange={(e) =>
                      setSelected([
                        ...selected.filter(
                          (id) => rs.find((r) => r.id === id)?.team !== t,
                        ),
                        ...(e.target.value ? [e.target.value] : []),
                      ])
                    }
                  >
                    <option value="">不参与</option>
                    {rs
                      .filter((r) => r.team === t)
                      .map((r) => (
                        <option
                          key={r.id}
                          value={r.id}
                          disabled={r.away || r.owner === null}
                        >
                          {r.owner === null
                            ? "公共区"
                            : s.players[r.owner].name}{" "}
                          · {r.card ? "团队牌" : "投资人"}
                          {r.away ? "（旅行中）" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="payout-editor">
              {s.players.map((p) => (
                <label key={p.id}>
                  <span>
                    {p.name}
                    {p.id === s.boss ? "（老板）" : ""}
                  </span>
                  {p.id === s.boss ? (
                    <strong className={remainder < 0 ? "danger" : ""}>
                      ${remainder}M
                    </strong>
                  ) : (
                    <span className="money-input">
                      $
                      <input
                        type="number"
                        min="0"
                        max={pool(s)}
                        step="1"
                        aria-label={`${p.name}分红`}
                        value={payouts[p.id]}
                        onChange={(e) =>
                          setPayouts(
                            payouts.map((v, i) =>
                              i === p.id ? Number(e.target.value) : v,
                            ),
                          )
                        }
                      />
                      M
                    </span>
                  )}
                </label>
              ))}
            </div>
            <button
              className="primary wide"
              disabled={!validSelection(s, selected) || remainder < 0}
              onClick={() =>
                dispatch({
                  type: "PROPOSE",
                  actor: viewer,
                  resources: selected,
                  payouts,
                })
              }
            >
              <Send size={15} /> 发送分红方案
            </button>
            {!validSelection(s, selected) && (
              <small className="hint">
                按照上方每组选取数量，选择不同颜色的代表。
              </small>
            )}
          </details>
        </>
      ) : editable && !mine ? (
        <div className="counter-offer">
          <label>
            我的参与报价
            <span className="money-input">
              $
              <input
                aria-label="我的报价"
                type="number"
                min="0"
                max={pool(s)}
                value={demand}
                onChange={(e) => setDemand(Number(e.target.value))}
              />
              M
            </span>
          </label>
          <button
            className="secondary"
            onClick={() =>
              dispatch({ type: "DEMAND", actor: viewer, amount: demand })
            }
          >
            提出报价
          </button>
          <small>也可以打出团队牌参与，或出牌影响谈判。</small>
        </div>
      ) : null}
      {Object.keys(s.demands).length > 0 && (
        <div className="quotes">
          {Object.entries(s.demands).map(([id, n]) => (
            <span key={id}>
              {s.players[Number(id)].name} 要价 <strong>${n}M</strong>
            </span>
          ))}
        </div>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (chat.trim()) {
            dispatch({ type: "CHAT", actor: viewer, text: chat });
            setChat("");
          }
        }}
      >
        <MessageCircle size={16} />
        <input
          aria-label="谈判发言"
          placeholder="说点什么，改变这笔生意…"
          maxLength={240}
          value={chat}
          onChange={(e) => setChat(e.target.value)}
        />
        <button type="submit" aria-label="发送发言" disabled={!chat.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
