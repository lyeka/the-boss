import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Volume2,
  VolumeX,
  Pause,
  Play,
  SkipForward,
  Menu,
  X,
  ArrowRight,
  RotateCcw,
  Download,
  Upload,
  Check,
  ShieldCheck,
  EyeOff,
  Crown,
  Coins,
  Handshake,
  Layers,
  Dices,
  Gavel,
  Info,
} from "lucide-react";
import type {
  Action,
  Card,
  PlayerConfig,
  State,
  Variants,
} from "./engine/types";
import {
  applyAction,
  createGame,
  dealNumber,
  handLimit,
  isAgreed,
  observe,
  resources,
  restoreGame,
} from "./engine/game";
import {
  BOARD,
  TEAM_INFO,
  TEAMS,
  cardName,
  dividendValue,
  endThreshold,
} from "./engine/catalog";
import { decide } from "./agents/basic";
import { Board, Seat } from "./ui/Board";
import { TeamIcon, CardIcon } from "./ui/Icons";
import { Setup } from "./ui/Setup";
import { Rules } from "./ui/Rules";
import { Negotiation } from "./ui/Negotiation";
import { sound } from "./ui/sound";
import "./styles.css";
const SAVE_KEY = "the-boss.save.v1";
const defaultPlayers: PlayerConfig[] = [
  { name: "你", kind: "human" },
  { name: "顾先生", kind: "bot", style: "bold" },
  { name: "林女士", kind: "bot", style: "patient" },
  { name: "陈先生", kind: "bot" },
];
function initial() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { state: restoreGame(raw), started: true, error: "" };
  } catch {
    return {
      state: createGame(defaultPlayers),
      started: false,
      error: "已有存档无法读取，尚未覆盖。你可以导入备份，或重新开局。",
    };
  }
  return { state: createGame(defaultPlayers), started: false, error: "" };
}
function botAction(s: State) {
  const ps = s.players.filter((p) => p.kind === "bot");
  for (let i = 0; i < ps.length; i++) {
    const p = ps[(i + s.revision) % ps.length];
    const a = decide(observe(s, p.id));
    if (a) return a;
  }
  return null;
}
const phaseLabels = {
  placement: "选择起点",
  turn: "回合开始",
  moved: "选择行动",
  negotiation: "自由谈判",
  response: "等待反制",
  closing: "准备成交",
  discard: "整理手牌",
  endcheck: "终局判定",
  between: "回合结束",
  finished: "最终结算",
};
const cardDescriptions = {
  team: "公开放在面前，代表同色投资人参与谈判。成交未使用则回手。",
  travel: "让一个具体投资人本轮离场；若针对团队牌，团队牌与旅行牌一起弃置。",
  recruit: "必须三张同时使用。永久招募一位投资人，公共区投资人优先。",
  boss: "接管当前谈判，成为老板；现有团队牌和旅行状态保留。",
  stop: "立即取消刚打出的旅行、老板或三张招募牌。不能取消另一张 STOP。",
};
export default function App() {
  const [boot] = useState(initial),
    [s, setState] = useState(boot.state),
    [started, setStarted] = useState(boot.started),
    [setup, setSetup] = useState(!boot.started),
    [rules, setRules] = useState(false),
    [menu, setMenu] = useState(false),
    [paused, setPaused] = useState(false),
    [audio, setAudio] = useState(false),
    [speed, setSpeed] = useState(1100);
  const firstHuman = s.players.find((p) => p.kind === "human")?.id ?? 0;
  const [viewer, setViewer] = useState(firstHuman),
    [handoff, setHandoff] = useState<number | null>(
      boot.started ? firstHuman : null,
    ),
    [error, setError] = useState(boot.error),
    [saved, setSaved] = useState(false),
    [inspect, setInspect] = useState<number | null>(null),
    [selectedCard, setSelectedCard] = useState<Card | null>(null),
    [target, setTarget] = useState(""),
    [tab, setTab] = useState<"deal" | "log">("deal"),
    [resultsOpen, setResultsOpen] = useState(true);
  useEffect(() => {
    if (s.phase === "finished") setResultsOpen(true);
  }, [s.phase]);
  useEffect(() => {
    const active =
      setup ||
      rules ||
      handoff !== null ||
      selectedCard !== null ||
      (s.phase === "finished" && resultsOpen);
    if (!active) return;
    const dialogs = Array.from(
      document.querySelectorAll<HTMLElement>("[role=dialog]"),
    );
    const dialog = dialogs.at(-1);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.tabIndex = -1;
    dialog.focus();
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".app-header,.game-layout,.app-footer,.menu-panel,.mobile-game-nav",
      ),
    );
    background.forEach((el) => (el.inert = true));
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary,[tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      background.forEach((el) => (el.inert = false));
      previous?.focus();
    };
  }, [setup, rules, handoff, selectedCard, s.phase, resultsOpen]);
  const fileInput = useRef<HTMLInputElement>(null),
    logEnd = useRef<HTMLDivElement>(null);
  const dispatch = useCallback(
    (a: Action) => {
      try {
        const next = applyAction(s, a);
        setState(next);
        setError("");
        setSelectedCard(null);
        if (a.type === "PLACE") setInspect(null);
        sound(next.totalMinted > s.totalMinted ? "money" : a.type, audio);
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败，请重试");
      }
    },
    [s, audio],
  );
  useEffect(() => {
    if (!started) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      setSaved(true);
    } catch {
      setSaved(false);
      setError("浏览器无法保存进度，请从菜单导出存档。");
    }
  }, [s, started]);
  useEffect(() => {
    if (
      !started ||
      paused ||
      setup ||
      rules ||
      handoff !== null ||
      selectedCard ||
      menu
    )
      return;
    const a = botAction(s);
    if (!a) return;
    const id = window.setTimeout(() => dispatch(a), speed);
    return () => window.clearTimeout(id);
  }, [
    s,
    started,
    paused,
    setup,
    rules,
    handoff,
    selectedCard,
    menu,
    speed,
    dispatch,
  ]);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [s.log.length, tab]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRules(false);
        setMenu(false);
        setSelectedCard(null);
        if (started) setSetup(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [started]);
  const pendingResource = s.pending?.target
    ? resources(s).find((r) => r.id === s.pending!.target)
    : null;
  const pendingDetail = pendingResource
    ? `目标：${TEAM_INFO[pendingResource.team].name} · ${pendingResource.owner === null ? "公共区" : s.players[pendingResource.owner].name}的${pendingResource.card ? "团队牌" : "投资人"}。`
    : s.pending?.cards[0].kind === "boss"
      ? `将取代 ${s.players[s.boss].name} 成为老板。`
      : "";
  const me = s.players[viewer],
    isBoss = s.boss === viewer,
    turnMine = s.turnOwner === viewer,
    negotiating = ["negotiation", "closing", "response"].includes(s.phase),
    deal = BOARD[inspect ?? s.marker],
    value = dividendValue(dealNumber(s));
  function start(players: PlayerConfig[], variants: Variants) {
    const next = createGame(
      players,
      crypto.getRandomValues(new Uint32Array(1))[0],
      variants,
    );
    setState(next);
    setStarted(true);
    setSetup(false);
    setViewer(players.findIndex((p) => p.kind === "human"));
    setHandoff(
      players.filter((p) => p.kind === "human").length > 1
        ? players.findIndex((p) => p.kind === "human")
        : null,
    );
    setPaused(false);
    setInspect(null);
    setSelectedCard(null);
    setError("");
  }
  function switchSeat(id: number) {
    if (s.players[id].kind === "bot" || id === viewer) return;
    setSelectedCard(null);
    setHandoff(id);
  }
  function exportSave() {
    const blob = new Blob([JSON.stringify(s, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `the-boss-${new Date().toISOString().slice(0, 10)}-turn-${s.turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function chooseCard(c: Card) {
    setSelectedCard(c);
    setTarget("");
  }
  const candidates = selectedCard
    ? resources(s).filter((r) =>
        selectedCard.kind === "recruit"
          ? !r.card &&
            r.owner !== viewer &&
            (!TEAMS.some((t) => s.owners[t] === null) || r.owner === null)
          : selectedCard.kind === "travel"
            ? !r.away &&
              r.owner !== null &&
              (!selectedCard.team || r.team === selectedCard.team)
            : false,
      )
    : [];
  const recruitment = me.hand.filter((c) => c.kind === "recruit");
  const canPlay =
    selectedCard &&
    (selectedCard.kind === "stop"
      ? s.phase === "response"
      : ["negotiation", "closing"].includes(s.phase) ||
        (s.phase === "discard" &&
          s.discardQueue[0] === viewer &&
          selectedCard.kind === "recruit"));
  const waitHumans = s.players.filter(
    (p) =>
      p.kind === "human" &&
      (s.phase === "response"
        ? !s.pending!.passed.includes(p.id)
        : s.phase === "closing"
          ? !s.closePassed.includes(p.id)
          : s.phase === "placement"
            ? p.id === (s.turnOwner + s.players.length - 1) % s.players.length
            : s.phase === "discard"
              ? s.discardQueue[0] === p.id
              : ["turn", "moved"].includes(s.phase)
                ? s.turnOwner === p.id
                : s.proposal
                  ? requiredHuman(s, p.id)
                  : false),
  );
  const send = (
    type:
      | "OPEN"
      | "ROLL"
      | "DRAW"
      | "PASS"
      | "CLOSE"
      | "GAVEL"
      | "FAIL"
      | "END_ROLL"
      | "NEXT",
  ) => dispatch({ type, actor: viewer });
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="我是大老板"
        >
          <span className="brand-symbol">
            B<span>.</span>
          </span>
          <span>
            <strong>我是大老板</strong>
            <small>THE BOSS CLUB</small>
          </span>
        </a>
        <div className="header-center">
          <span className="live-dot" />
          本地谈判桌
          <span className="header-divider" />
          {s.players.length} 位老板{" "}
          <span className="desktop-only">
            · 标准{Object.values(s.variants).some(Boolean) ? " + 变体" : "规则"}
          </span>
        </div>
        <nav>
          <button
            className="text-button"
            aria-label="规则手册"
            onClick={() => setRules(true)}
          >
            <BookOpen size={17} />
            <span>规则手册</span>
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setAudio(!audio);
              sound("OPEN", !audio);
            }}
            aria-label={audio ? "关闭音效" : "开启音效"}
            title={audio ? "关闭音效" : "开启音效"}
          >
            {audio ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className="icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="游戏菜单"
          >
            <Menu size={20} />
          </button>
        </nav>
      </header>
      {menu && (
        <div className="menu-panel">
          <header>
            <strong>桌边菜单</strong>
            <button
              className="icon-button"
              onClick={() => setMenu(false)}
              aria-label="关闭菜单"
            >
              <X size={16} />
            </button>
          </header>
          <button
            onClick={() => {
              setSetup(true);
              setMenu(false);
            }}
          >
            <RotateCcw size={17} />
            重新开桌
          </button>
          <button onClick={exportSave}>
            <Download size={17} />
            导出对局存档
          </button>
          <button onClick={() => fileInput.current?.click()}>
            <Upload size={17} />
            导入存档
          </button>
          <p>存档包括隐藏手牌，适合备份与复盘。</p>
        </div>
      )}
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="导入存档文件"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              const next = restoreGame(await file.text());
              setState(next);
              setStarted(true);
              setSetup(false);
              setMenu(false);
              const human =
                next.players.find((p) => p.kind === "human")?.id ?? 0;
              setViewer(human);
              setHandoff(human);
              setError("");
              setInspect(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "存档不可用");
            }
          }
          e.target.value = "";
        }}
      />
      <main className="game-layout">
        <section className="table-area" id="game-board">
          <div className="table-heading">
            <div>
              <span className="round-number">
                {String(dealNumber(s)).padStart(2, "0")}
              </span>
              <div>
                <h2>{phaseLabels[s.phase]}</h2>
                <p>
                  已成交 {Object.keys(s.covered).length} 笔 <span>·</span> 第{" "}
                  {s.turn} 回合
                </p>
              </div>
            </div>
            <div className="ai-controls">
              <span>电脑节奏</span>
              <select
                aria-label="电脑行动速度"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={1800}>从容</option>
                <option value={1100}>标准</option>
                <option value={350}>快速</option>
              </select>
              <button
                className="icon-button"
                onClick={() => setPaused(!paused)}
                aria-label={paused ? "继续电脑行动" : "暂停电脑行动"}
                title={paused ? "继续电脑行动" : "暂停电脑行动"}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
              {paused && (
                <button
                  className="icon-button"
                  aria-label="电脑单步行动"
                  title="电脑单步行动"
                  onClick={() => {
                    const a = botAction(s);
                    if (a) dispatch(a);
                  }}
                >
                  <SkipForward size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="opponents">
            {s.players
              .filter((p) => p.id !== viewer)
              .map((p) => (
                <Seat
                  key={p.id}
                  player={p}
                  state={s}
                  viewer={viewer}
                  onSelect={() => switchSeat(p.id)}
                />
              ))}
          </div>
          <Board
            state={s}
            inspect={inspect}
            onInspect={(i) => {
              setInspect(i);
              setTab("deal");
            }}
          />
          <div className="table-inventory">
            <div>
              <span>公共投资人</span>
              {TEAMS.filter((t) => s.owners[t] === null).map((t) => (
                <span key={t} className="public-investor">
                  <TeamIcon team={t} size={12} />
                  {TEAM_INFO[t].name}
                </span>
              ))}
              {!TEAMS.some((t) => s.owners[t] === null) && (
                <small>已全部入座</small>
              )}
            </div>
            <div>
              <ShieldCheck size={12} />
              {saved ? "进度已保存" : "本地游戏"}
              <span>·</span>私密手牌
            </div>
          </div>
          <section
            id="game-actions"
            className={`action-bar ${s.phase === "response" ? "urgent" : ""}`}
            aria-live="polite"
          >
            <div className="action-copy">
              <span className="action-symbol">
                {s.phase === "response" ? (
                  <ShieldCheck size={21} />
                ) : s.phase === "closing" ? (
                  <Gavel size={21} />
                ) : (
                  <BriefcaseIcon />
                )}
              </span>
              <div>
                <strong>
                  {s.phase === "placement"
                    ? `请 ${s.players[(s.turnOwner + s.players.length - 1) % s.players.length].name} 选择起点`
                    : s.phase === "response"
                      ? `${s.players[s.pending!.actor].name} 打出了${cardName(s.pending!.cards[0])}`
                      : s.phase === "closing"
                        ? s.closingStage
                          ? "第一次落槌，准备成交"
                          : "最后的出牌机会"
                        : s.phase === "discard"
                          ? `${s.players[s.discardQueue[0]].name} 的手牌超出上限`
                          : s.phase === "endcheck"
                            ? `第 ${s.lastSettlement!.number} 笔交易 · 终局掷骰`
                            : s.phase === "between"
                              ? s.lastSettlement?.success
                                ? "落槌成交，利润入账"
                                : "回合结束"
                              : s.phase === "finished"
                                ? "最后的赢家已经揭晓"
                                : negotiating
                                  ? `${s.players[s.boss].name} 是这笔交易的老板`
                                  : `${s.players[s.turnOwner].name}，轮到你做决定`}
                </strong>
                <p>
                  {s.phase === "placement"
                    ? "点击任意交易格，再确认放置棋子。"
                    : s.phase === "response"
                      ? `${pendingDetail} 可用 STOP 取消，或选择不反制。`
                      : s.phase === "closing"
                        ? "所有人确认后落槌。成交前仍可打出影响力牌。"
                        : s.phase === "discard"
                          ? `选择手牌弃置至 ${handLimit(s)} 张，或打出三张招募牌。`
                          : s.phase === "endcheck"
                            ? `掷出 1–${endThreshold(s.lastSettlement!.number)} 游戏结束，否则继续。`
                            : s.phase === "between"
                              ? s.variants.fixedOrder
                                ? "固定顺序：下一回合从原回合玩家左手边开始。"
                                : "下一回合从最终老板的左手边开始。"
                              : s.phase === "moved"
                                ? `掷出 ${s.die} 点。可以发起这笔交易，或抽牌休整。`
                                : negotiating
                                  ? "投资人、分红和老板，都可以重新谈。"
                                  : "就地谈判，或掷骰寻找下一笔商机。"}
                </p>
              </div>
            </div>
            <div className="action-buttons">
              {s.phase === "placement" &&
                (s.turnOwner + s.players.length - 1) % s.players.length ===
                  viewer && (
                  <button
                    className="primary"
                    onClick={() =>
                      dispatch({
                        type: "PLACE",
                        actor: viewer,
                        space: inspect ?? s.marker,
                      })
                    }
                  >
                    从第 {(inspect ?? s.marker) + 1} 格开始
                    <ArrowRight size={16} />
                  </button>
                )}
              {turnMine && ["turn", "moved"].includes(s.phase) && (
                <>
                  <button
                    className="primary"
                    disabled={s.variants.minimumHand && me.hand.length < 4}
                    onClick={() => send("OPEN")}
                  >
                    <Handshake size={16} />
                    开始谈判
                  </button>
                  {s.phase === "turn" ? (
                    <button className="secondary" onClick={() => send("ROLL")}>
                      <Dices size={17} />
                      掷骰移动
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      disabled={s.variants.forceDeal && s.startHandCount >= 10}
                      onClick={() => send("DRAW")}
                    >
                      <Layers size={16} />
                      抽取{" "}
                      {s.variants.variableDraw
                        ? Math.max(
                            1,
                            4 -
                              TEAMS.filter((t) => s.owners[t] === viewer)
                                .length,
                          )
                        : 3}{" "}
                      张牌
                    </button>
                  )}
                </>
              )}
              {s.phase === "response" &&
                !s.pending!.passed.includes(viewer) && (
                  <>
                    {me.hand.some((c) => c.kind === "stop") && (
                      <button
                        className="primary"
                        onClick={() =>
                          chooseCard(me.hand.find((c) => c.kind === "stop")!)
                        }
                      >
                        <ShieldCheck size={15} />
                        使用 STOP
                      </button>
                    )}
                    <button className="secondary" onClick={() => send("PASS")}>
                      不使用 STOP <ArrowRight size={14} />
                    </button>
                  </>
                )}
              {s.phase === "closing" && !s.closePassed.includes(viewer) && (
                <button className="primary" onClick={() => send("PASS")}>
                  不再干预，继续成交
                  <Check size={16} />
                </button>
              )}
              {s.phase === "negotiation" && isBoss && (
                <>
                  <button
                    className="primary"
                    disabled={!isAgreed(s)}
                    onClick={() => send("CLOSE")}
                  >
                    <Gavel size={16} />
                    宣布成交
                  </button>
                  <button className="text-button" onClick={() => send("FAIL")}>
                    放弃交易
                  </button>
                </>
              )}
              {s.phase === "closing" && isBoss && (
                <button
                  className="primary"
                  disabled={s.closePassed.length < s.players.length}
                  onClick={() => send("GAVEL")}
                >
                  <Gavel size={16} />
                  {s.closingStage ? "第二次 · 成交" : "第一次落槌"}
                </button>
              )}
              {s.phase === "endcheck" && isBoss && (
                <button className="primary" onClick={() => send("END_ROLL")}>
                  <Dices size={17} />
                  掷骰判定
                </button>
              )}
              {s.phase === "finished" && (
                <button
                  className="primary"
                  onClick={() => setResultsOpen(true)}
                >
                  <Crown size={16} />
                  查看最终排名
                </button>
              )}
              {s.phase === "between" && isBoss && (
                <button className="primary" onClick={() => send("NEXT")}>
                  下一位老板
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </section>
          {waitHumans.some((p) => p.id !== viewer) && (
            <div className="attention-strip">
              等待真人回应：
              {waitHumans
                .filter((p) => p.id !== viewer)
                .map((p) => (
                  <button key={p.id} onClick={() => switchSeat(p.id)}>
                    {p.name}
                    <ArrowRight size={12} />
                  </button>
                ))}
            </div>
          )}
          {s.lastSettlement?.success && (
            <div className="last-settlement">
              <Check size={12} />
              <span>最近成交 #{s.lastSettlement.number}</span>
              {s.players
                .filter((p) => s.lastSettlement!.payouts[p.id] > 0)
                .map((p) => (
                  <span key={p.id}>
                    {p.name}
                    <strong> +${s.lastSettlement!.payouts[p.id]}M</strong>
                  </span>
                ))}
            </div>
          )}
          <section className="hand-area" id="game-hand">
            <div className="hand-heading">
              <Seat
                player={me}
                state={s}
                viewer={viewer}
                onSelect={() => setHandoff(viewer)}
              />
              <div>
                <h3>
                  你的影响力牌{" "}
                  <span>
                    {me.hand.length} / {handLimit(s)}
                  </span>
                </h3>
                <p>点击卡牌查看效果与出牌目标</p>
              </div>
              <button
                className="text-button hide-hand"
                onClick={() => setHandoff(viewer)}
              >
                <EyeOff size={14} />
                隐藏手牌
              </button>
            </div>
            <div className="hand-scroll">
              <div
                className="hand-fan"
                style={{ "--cards": me.hand.length } as React.CSSProperties}
              >
                {me.hand.map((c, i) => (
                  <button
                    key={c.id}
                    className={`influence-card card-${c.kind}`}
                    style={
                      {
                        "--card-color": c.team
                          ? TEAM_INFO[c.team].color
                          : c.kind === "stop"
                            ? "#aa493d"
                            : c.kind === "boss"
                              ? "#af8a3f"
                              : "#517a69",
                        "--angle": `${(i - (me.hand.length - 1) / 2) * 1.25}deg`,
                      } as React.CSSProperties
                    }
                    onClick={() => chooseCard(c)}
                    aria-label={`${cardName(c)}，查看或出牌`}
                  >
                    <span className="card-corner">
                      <CardIcon card={c} size={15} />
                      <span>
                        {c.kind === "team"
                          ? "PARTNER"
                          : c.kind === "travel"
                            ? "TRAVEL"
                            : c.kind === "recruit"
                              ? "RECRUIT"
                              : c.kind === "boss"
                                ? "THE BOSS"
                                : "STOP"}
                      </span>
                    </span>
                    <span className="card-art">
                      {c.kind === "team" ? (
                        <img src={`./assets/investor-${c.team}.png`} alt="" />
                      ) : (
                        <CardIcon card={c} size={46} />
                      )}
                    </span>
                    <strong>{cardName(c)}</strong>
                    <small>
                      {c.kind === "recruit"
                        ? "三张成组"
                        : c.kind === "stop"
                          ? "即时反制"
                          : c.kind === "boss"
                            ? "接管谈判"
                            : c.kind === "travel"
                              ? "暂时离场"
                              : "参与交易"}
                    </small>
                  </button>
                ))}
              </div>
            </div>
            {!me.hand.length && (
              <p className="empty-hand">
                手里暂时没有影响力牌。下次回合掷骰后补牌。
              </p>
            )}
            {s.table.length > 0 && (
              <div className="table-team-cards">
                <span>桌面团队牌</span>
                {s.table.map((t) => (
                  <span key={t.card.id}>
                    <TeamIcon team={t.card.team!} size={12} label />
                    {s.players[t.owner].name}
                  </span>
                ))}
              </div>
            )}
            <details className="discard-reference">
              <summary>查看公开弃牌 · {s.discard.length} 张</summary>
              <div>
                {s.discard.length ? (
                  Object.entries(
                    s.discard.reduce<Record<string, number>>((counts, card) => {
                      const name = cardName(card);
                      counts[name] = (counts[name] ?? 0) + 1;
                      return counts;
                    }, {}),
                  ).map(([name, count]) => (
                    <span key={name}>
                      {name} <strong>×{count}</strong>
                    </span>
                  ))
                ) : (
                  <span>还没有弃牌。</span>
                )}
              </div>
            </details>
          </section>
        </section>
        <aside className="side-panel" id="game-negotiation">
          <div className="side-tabs">
            <button
              className={tab === "deal" ? "active" : ""}
              onClick={() => setTab("deal")}
            >
              本次商机
            </button>
            <button
              className={tab === "log" ? "active" : ""}
              onClick={() => setTab("log")}
            >
              谈判记录 <span>{s.log.length}</span>
            </button>
          </div>
          {tab === "deal" ? (
            <>
              <section className="deal-summary">
                <div className="deal-title">
                  <span>{String(deal.id + 1).padStart(2, "0")}</span>
                  <h2>
                    {inspect !== null && inspect !== s.marker
                      ? "商机预览"
                      : "一笔值得谈的生意"}
                  </h2>
                  {inspect !== null && (
                    <button
                      className="icon-button"
                      aria-label="返回当前交易"
                      onClick={() => setInspect(null)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="deal-amount">
                  <span>$</span>
                  {deal.dividends * value}
                  <small>M</small>
                </div>
                <p className="deal-math">
                  {deal.dividends} 份分红 × ${value}M{" "}
                  <span>第 {dealNumber(s)} 号交易</span>
                </p>
                <div className="required-title">
                  <span>需要这些投资团队</span>
                  <small>
                    共 {deal.groups.reduce((n, g) => n + g.count, 0)} 位
                  </small>
                </div>
                <div className="required-groups">
                  {deal.groups.map((g, i) => (
                    <div key={i}>
                      <span>
                        {g.teams.map((t) => (
                          <TeamIcon team={t} key={t} size={15} label />
                        ))}
                      </span>
                      <strong>
                        {g.count === g.teams.length
                          ? "全部参与"
                          : `任选 ${g.count} 位`}
                      </strong>
                    </div>
                  ))}
                </div>
                {inspect !== null && inspect !== s.marker && (
                  <button
                    className="text-button"
                    onClick={() => setInspect(null)}
                  >
                    返回当前商机
                    <ArrowRight size={13} />
                  </button>
                )}
              </section>
              {negotiating ? (
                <Negotiation
                  key={`${s.turn}-${s.boss}-${viewer}`}
                  state={s}
                  viewer={viewer}
                  dispatch={dispatch}
                />
              ) : (
                <section className="side-guide">
                  <Crown size={30} strokeWidth={1} />
                  <h3>
                    {s.phase === "between"
                      ? "下一笔，谁来做主？"
                      : "好生意，需要好筹码。"}
                  </h3>
                  <p>
                    你不必拥有所有投资人。
                    <br />
                    让别人加入，谈好价格，
                    <br />
                    再小心那些想取代你的老板。
                  </p>
                  <div className="quiet-rule">
                    <Info size={14} />
                    <span>开始谈判之前，所有玩家都不能出影响力牌。</span>
                  </div>
                </section>
              )}
              <section className="recent-event">
                <span>桌边动态</span>
                <p>{s.log.at(-1)?.text}</p>
                <button className="text-button" onClick={() => setTab("log")}>
                  查看完整记录
                  <ArrowRight size={12} />
                </button>
              </section>
            </>
          ) : (
            <div className="event-log">
              {s.log.map((e) => (
                <div className={`event event-${e.type}`} key={e.id}>
                  <span>{String(e.id).padStart(2, "0")}</span>
                  <div>
                    <small>第 {e.turn} 回合</small>
                    <p>{e.text}</p>
                  </div>
                </div>
              ))}
              <div ref={logEnd} />
            </div>
          )}
          <div className="side-footer">
            <ShieldCheck size={14} />
            <span>手牌私密 · 当前交易支付 · 承诺必须兑现</span>
          </div>
        </aside>
      </main>
      <nav className="mobile-game-nav" aria-label="游戏区域导航">
        {[
          { id: "game-board", label: "棋盘", Icon: Coins },
          { id: "game-actions", label: "行动", Icon: Dices },
          { id: "game-hand", label: "手牌", Icon: Layers },
          { id: "game-negotiation", label: "谈判", Icon: Handshake },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() =>
              document.getElementById(id)?.scrollIntoView({ block: "start" })
            }
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <footer className="app-footer">
        <span>
          Sid Sackson’s I’m the Boss! <span>·</span> 中文数字谈判桌
        </span>
        <span>
          3–6 位玩家 <span>·</span> 每个人都想当老板
        </span>
      </footer>
      {error && (
        <div className="error-toast" role="alert">
          <Info size={17} />
          <span>{error}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {selectedCard && (
        <div className="modal-backdrop" onClick={() => setSelectedCard(null)}>
          <section
            className="card-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2 id="card-title">{cardName(selectedCard)}</h2>
              <button
                className="icon-button"
                onClick={() => setSelectedCard(null)}
                aria-label="关闭卡牌"
              >
                <X />
              </button>
            </header>
            <div className="card-dialog-icon">
              <CardIcon card={selectedCard} size={64} />
            </div>
            <p>{cardDescriptions[selectedCard.kind]}</p>
            {selectedCard.kind === "recruit" && (
              <p className="hint">
                你有 {recruitment.length} 张招募牌，出牌将消耗其中 3 张。
              </p>
            )}
            {["travel", "recruit"].includes(selectedCard.kind) && (
              <label className="target-field">
                选择目标
                <select
                  aria-label="出牌目标"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">请选择一位具体代表</option>
                  {candidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {TEAM_INFO[r.team].name} ·{" "}
                      {r.owner === null
                        ? "公共投资人"
                        : s.players[r.owner].name}{" "}
                      · {r.card ? "团队牌" : "投资人"}
                      {r.away ? "（旅行中）" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="primary wide"
              disabled={
                !canPlay ||
                (selectedCard.kind === "recruit" && recruitment.length < 3) ||
                (["travel", "recruit"].includes(selectedCard.kind) && !target)
              }
              onClick={() =>
                dispatch({
                  type: "PLAY",
                  actor: viewer,
                  cards:
                    selectedCard.kind === "recruit"
                      ? recruitment.slice(0, 3).map((c) => c.id)
                      : [selectedCard.id],
                  target: target || undefined,
                })
              }
            >
              打出{selectedCard.kind === "recruit" ? "三张招募牌" : "这张牌"}
              <ArrowRight size={16} />
            </button>
            {!canPlay && (
              <p className="hint">
                {selectedCard.kind === "stop"
                  ? "等待其他玩家打出可被 STOP 的牌。"
                  : "只能在谈判中使用影响力牌。"}
              </p>
            )}
            {s.phase === "discard" && s.discardQueue[0] === viewer && (
              <button
                className="secondary wide"
                onClick={() =>
                  dispatch({
                    type: "DISCARD",
                    actor: viewer,
                    cards: [selectedCard.id],
                  })
                }
              >
                弃掉这张超限手牌
              </button>
            )}
          </section>
        </div>
      )}
      {handoff !== null && (
        <div
          className="privacy-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="隐私交接"
        >
          <EyeOff size={44} strokeWidth={1} />
          <h2>请把设备交给 {s.players[handoff].name}</h2>
          <p>
            其他玩家请移开视线。
            <br />
            确认后只会显示你的私人手牌。
          </p>
          <button
            className="primary"
            onClick={() => {
              setViewer(handoff);
              setHandoff(null);
            }}
          >
            我是 {s.players[handoff].name}，查看手牌
            <ArrowRight size={17} />
          </button>
          <div className="privacy-seats">
            {s.players
              .filter((p) => p.kind === "human")
              .map((p) => (
                <button key={p.id} onClick={() => setHandoff(p.id)}>
                  {p.name}
                </button>
              ))}
          </div>
        </div>
      )}
      {s.phase === "finished" && resultsOpen && !setup && handoff === null && (
        <div className="modal-backdrop">
          <section
            className="results-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-title"
          >
            <Crown size={50} strokeWidth={1} />
            <h2 id="results-title">
              {s.winners.map((id) => s.players[id].name).join("与")}，<br />
              你才是真正的大老板。
            </h2>
            <p>
              完成 {Object.keys(s.covered).length} 笔交易 · {s.turn} 个回合
            </p>
            <div className="ranking">
              {[...s.players]
                .sort((a, b) => b.money - a.money)
                .map((p, i) => (
                  <div key={p.id}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <strong>{p.name}</strong>
                    {s.winners.includes(p.id) && <Crown size={15} />}
                    <b>
                      ${p.money}
                      <small>M</small>
                    </b>
                  </div>
                ))}
            </div>
            <div className="result-actions">
              <button className="secondary" onClick={exportSave}>
                <Download size={16} />
                保存对局
              </button>
              <button className="primary" onClick={() => setSetup(true)}>
                再开一桌
                <ArrowRight size={17} />
              </button>
            </div>
            <button
              className="text-button"
              onClick={() => setResultsOpen(false)}
            >
              回看棋盘与完整记录
            </button>
            <details>
              <summary>查看最后的结算</summary>
              <p>
                {s.log
                  .slice(-4)
                  .map((e) => e.text)
                  .join(" ")}
              </p>
            </details>
          </section>
        </div>
      )}
      {setup && (
        <Setup
          onStart={start}
          close={() => setSetup(false)}
          hasGame={started}
        />
      )}{" "}
      {rules && <Rules close={() => setRules(false)} />}
    </div>
  );
}
function requiredHuman(s: State, id: number) {
  return (
    s.proposal &&
    !s.proposal.accepted.includes(id) &&
    (s.proposal.payouts[id] > 0 ||
      resources(s).some(
        (r) => r.owner === id && s.proposal!.resources.includes(r.id),
      ))
  );
}
function BriefcaseIcon() {
  return <Coins size={21} />;
}
