import {
  FlaskConical,
  Film,
  ChartNoAxesCombined,
  Landmark,
  Monitor,
  Gavel,
  BriefcaseBusiness,
  Plane,
  Handshake,
  OctagonX,
} from "lucide-react";
import type { Team, Card } from "../engine/types";
import { TEAM_INFO } from "../engine/catalog";
export function TeamIcon({
  team,
  size = 16,
  label = false,
}: {
  team: Team;
  size?: number;
  label?: boolean;
}) {
  const Icon = {
    red: Film,
    yellow: ChartNoAxesCombined,
    blue: FlaskConical,
    orange: Gavel,
    purple: Landmark,
    green: Monitor,
  }[team];
  return (
    <span
      className="team-icon"
      style={{ "--team": TEAM_INFO[team].color } as React.CSSProperties}
      title={TEAM_INFO[team].name}
    >
      <Icon size={size} />
      {label && <span>{TEAM_INFO[team].name}</span>}
    </span>
  );
}
export function CardIcon({ card, size = 28 }: { card: Card; size?: number }) {
  if (card.kind === "team") return <TeamIcon team={card.team!} size={size} />;
  const Icon = {
    travel: Plane,
    boss: BriefcaseBusiness,
    recruit: Handshake,
    stop: OctagonX,
  }[card.kind];
  return <Icon size={size} strokeWidth={1.35} />;
}
