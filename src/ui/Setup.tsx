import { useState } from "react";
import {
  X,
  Users,
  UserRound,
  Plus,
  Minus,
  ArrowRight,
  Settings2,
} from "lucide-react";
import type { PlayerConfig, Variants } from "../engine/types";
import { DEFAULT_VARIANTS, VARIANT_INFO } from "../engine/catalog";
const names = ["你", "顾先生", "林女士", "陈先生", "周女士", "陆先生"];
export function Setup({
  onStart,
  close,
  hasGame,
}: {
  onStart: (p: PlayerConfig[], v: Variants) => void;
  close: () => void;
  hasGame: boolean;
}) {
  const [count, setCount] = useState(4),
    [humans, setHumans] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [variants, setVariants] = useState({ ...DEFAULT_VARIANTS });
  const [players, setPlayers] = useState<PlayerConfig[]>(
    names.map((name, i) => ({
      name,
      kind: i ? "bot" : "human",
      style: (["balanced", "bold", "patient"] as const)[i % 3],
    })),
  );
  function setAll(local: boolean) {
    setHumans(local);
    setPlayers(
      players.map((p, i) => ({
        ...p,
        kind: local || !i ? "human" : "bot",
        name: local ? `玩家 ${i + 1}` : names[i],
      })),
    );
  }
  return (
    <div className="modal-backdrop">
      <section
        className="setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
      >
        <div className="setup-art">
          <div className="art-lines" />
          <span className="club-monogram">B</span>
          <h2>
            生意，
            <br />
            从入座开始。
          </h2>
          <p>
            每一次握手，都有一个价格。
            <br />
            每一个人，都想成为老板。
          </p>
          <div className="setup-signature">
            THE BOSS CLUB <span>Est. 1994</span>
          </div>
        </div>
        <div className="setup-content">
          {hasGame && (
            <button
              className="icon-button modal-close"
              onClick={close}
              aria-label="返回当前对局"
            >
              <X />
            </button>
          )}
          <h2 id="setup-title">组一桌好生意</h2>
          <p className="muted">经典商业谈判 · 3–6 人 · 一张桌子，无限可能</p>
          <div className="mode-options">
            <button
              className={!humans ? "selected" : ""}
              onClick={() => setAll(false)}
            >
              <UserRound size={20} />
              <strong>与电脑过招</strong>
              <small>一个人也能开桌</small>
            </button>
            <button
              className={humans ? "selected" : ""}
              onClick={() => setAll(true)}
            >
              <Users size={20} />
              <strong>本地好友局</strong>
              <small>共用设备，轮流看牌</small>
            </button>
          </div>
          <div className="seat-count">
            <span>入座人数</span>
            <div>
              <button
                className="icon-button"
                disabled={count === 3}
                onClick={() => setCount(count - 1)}
                aria-label="减少人数"
              >
                <Minus size={16} />
              </button>
              <strong>{count}</strong>
              <button
                className="icon-button"
                disabled={count === 6}
                onClick={() => setCount(count + 1)}
                aria-label="增加人数"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="setup-seats">
            {players.slice(0, count).map((p, i) => (
              <div key={i}>
                <span className="seat-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input
                  aria-label={`玩家${i + 1}名字`}
                  maxLength={20}
                  value={p.name}
                  onChange={(e) =>
                    setPlayers(
                      players.map((q, j) =>
                        i === j ? { ...q, name: e.target.value } : q,
                      ),
                    )
                  }
                />
                <select
                  aria-label={`玩家${i + 1}类型`}
                  value={p.kind}
                  onChange={(e) =>
                    setPlayers(
                      players.map((q, j) =>
                        i === j
                          ? { ...q, kind: e.target.value as "human" | "bot" }
                          : q,
                      ),
                    )
                  }
                >
                  <option value="human">真人</option>
                  <option value="bot">电脑</option>
                </select>
                {p.kind === "bot" && (
                  <select
                    aria-label={`玩家${i + 1}风格`}
                    value={p.style}
                    onChange={(e) =>
                      setPlayers(
                        players.map((q, j) =>
                          i === j
                            ? {
                                ...q,
                                style: e.target.value as PlayerConfig["style"],
                              }
                            : q,
                        ),
                      )
                    }
                  >
                    <option value="balanced">稳健</option>
                    <option value="bold">强势</option>
                    <option value="patient">耐心</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          <button
            className="text-button variant-toggle"
            onClick={() => setAdvanced(!advanced)}
          >
            <Settings2 size={15} /> {advanced ? "收起" : "展开"}规则变体{" "}
            <span>默认完整标准规则</span>
          </button>
          {advanced && (
            <div className="variants">
              {VARIANT_INFO.map((v) => (
                <label key={v.key}>
                  <input
                    type="checkbox"
                    checked={variants[v.key]}
                    onChange={(e) =>
                      setVariants({ ...variants, [v.key]: e.target.checked })
                    }
                  />
                  <span>
                    <strong>{v.name}</strong>
                    <small>{v.description}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            className="primary start-button"
            disabled={!players.slice(0, count).some((p) => p.kind === "human")}
            onClick={() => onStart(players.slice(0, count), variants)}
          >
            {hasGame ? "结束当前对局，重新开桌" : "请各位老板入座"}
            <ArrowRight size={18} />
          </button>
          <p className="setup-note">
            随机分配投资人 · 每人 5 张手牌 · 从 $0 开始
          </p>
        </div>
      </section>
    </div>
  );
}
