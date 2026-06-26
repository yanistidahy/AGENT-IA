import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { agents } from "../agents/agentsConfig";

function AgentAvatar({ agent, size = 56, onClick, showName = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: onClick ? "pointer" : "default", position: "relative" }}
    >
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: hovered ? agent.colorHex : agent.bgHex,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, transition: "all 180ms ease",
        transform: hovered ? "scale(1.08)" : "scale(1)",
        border: `2px solid ${hovered ? agent.colorHex : "transparent"}`,
      }}>
        {agent.emoji}
      </div>
      {(showName || hovered) && (
        <span style={{
          fontSize: "11px", fontWeight: 500, color: "#1A1A1A",
          whiteSpace: "nowrap", opacity: hovered || showName ? 1 : 0,
          transition: "opacity 150ms",
        }}>{agent.name}</span>
      )}
    </div>
  );
}

function AgentCard({ agent }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => navigate(`/agent/${agent.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#fff" : "rgba(255,255,255,0.7)",
        borderRadius: "16px",
        border: `1px solid ${hovered ? agent.colorHex + "40" : "rgba(26,26,26,0.08)"}`,
        padding: "24px 20px 20px",
        cursor: "pointer",
        transition: "all 200ms ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Number */}
      <div style={{
        position: "absolute", top: "16px", left: "18px",
        fontSize: "11px", fontWeight: 600, color: "#999", letterSpacing: "0.05em",
        fontFamily: "'Playfair Display', Georgia, serif",
      }}>{agent.number}</div>

      {/* Status badge */}
      <div style={{ position: "absolute", top: "14px", right: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ width: "5px", height: "5px", background: "#22C55E", borderRadius: "50%" }} />
        <span style={{ fontSize: "10px", color: "#666", fontWeight: 500 }}>En ligne</span>
      </div>

      {/* Avatar */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "8px", marginBottom: "16px" }}>
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          background: hovered ? agent.colorHex : agent.bgHex,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "34px", transition: "all 200ms ease",
        }}>{agent.emoji}</div>
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "20px", fontWeight: 700, color: "#1A1A1A",
        textAlign: "center", marginBottom: "4px",
      }}>{agent.name}</div>

      {/* Role label */}
      <div style={{
        fontSize: "9px", fontWeight: 700, color: "#999",
        letterSpacing: "0.12em", textTransform: "uppercase",
        textAlign: "center", marginBottom: "10px",
      }}>{agent.roleLabel}</div>

      {/* Description */}
      <p style={{
        fontSize: "12px", color: "#666", lineHeight: "1.55",
        textAlign: "center", margin: "0 0 16px", minHeight: "36px",
      }}>{agent.tagline}</p>

      {/* Stats */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 0 0", borderTop: "1px solid rgba(26,26,26,0.06)",
        gap: "4px",
      }}>
        {[
          { label: "livrables", value: agent.stats.livrables },
          { label: "tokens", value: agent.stats.tokens },
          { label: "succès", value: agent.stats.succes },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: agent.colorHex }}>{s.value}</div>
            <div style={{ fontSize: "9px", color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "60px 40px 80px" }}>

      {/* Editorial header */}
      <div style={{ textAlign: "center", marginBottom: "56px" }}>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "13px", fontStyle: "italic", color: "#999",
          margin: "0 0 16px", letterSpacing: "0.03em",
        }}>Un studio. Sept agents. Une équipe qui ne dort jamais.</p>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "#1A1A1A",
          margin: 0, lineHeight: 1.2, letterSpacing: "-1px",
        }}>Votre équipe IA<br /><span style={{ fontStyle: "italic", fontWeight: 400 }}>est prête à travailler.</span></h1>
      </div>

      {/* Avatar row */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "flex-end",
        gap: "20px", marginBottom: "56px", flexWrap: "wrap",
      }}>
        {agents.map(agent => (
          <AgentAvatar
            key={agent.id}
            agent={agent}
            size={52}
            onClick={() => navigate(`/agent/${agent.id}`)}
          />
        ))}
      </div>

      {/* Agents grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px",
      }}>
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

    </div>
  );
}
