import { useNavigate } from "react-router-dom";
import { agents } from "../agents/agentsConfig";
import { Bot, CheckCircle, Clock, Wifi, WifiOff, AlertCircle } from "lucide-react";

function StatusBadge({ status }) {
  if (status === "connected") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: "#ECFDF5", color: "#059669", fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "99px", border: "1px solid #A7F3D0" }}>
      <Wifi size={9} /> Connecté
    </span>
  );
  if (status === "pending") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: "#FFF7ED", color: "#D97706", fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "99px", border: "1px solid #FED7AA" }}>
      <AlertCircle size={9} /> En attente
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: "#F3F4F6", color: "#6B7280", fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "99px" }}>
      <WifiOff size={9} /> Déconnecté
    </span>
  );
}

function AgentCard({ agent }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/agent/${agent.id}`)}
      style={{
        background: "white", borderRadius: "16px", border: "1px solid #E8E8F0",
        overflow: "hidden", cursor: "pointer", transition: "transform 150ms, box-shadow 150ms",
        boxShadow: "0 2px 8px rgba(30,27,75,0.05)",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(30,27,75,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(30,27,75,0.05)"; }}
    >
      <div style={{ height: "6px", background: `linear-gradient(90deg, ${agent.colorHex}, ${agent.colorHex}88)` }} />
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
            background: `${agent.colorHex}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px",
          }}>{agent.emoji}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#1E1B4B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</div>
            <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px", lineHeight: 1.4 }}>{agent.role}</div>
          </div>
        </div>

        {agent.connections.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {agent.connections.map(c => (
              <span key={c.name} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 500, padding: "2px 6px", borderRadius: "6px", background: c.status === "connected" ? "#ECFDF5" : "#FFF7ED", color: c.status === "connected" ? "#059669" : "#D97706" }}>
                {c.status === "connected" ? <Wifi size={8} /> : <AlertCircle size={8} />} {c.name}
              </span>
            ))}
          </div>
        )}

        <div style={{ marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#ECFDF5", color: "#059669", fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "99px", border: "1px solid #A7F3D0" }}>
            <span style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%" }} /> Actif
          </span>
          <span style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 600 }}>Ouvrir →</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const stats = [
    { Icon: Bot, value: "7", label: "Agents déployés", color: "#7C3AED", bg: "#EDE9FE" },
    { Icon: CheckCircle, value: "7", label: "Agents actifs", color: "#059669", bg: "#ECFDF5" },
    { Icon: Clock, value: "24/7", label: "Disponibilité", color: "#0891B2", bg: "#E0F2FE" },
  ];

  return (
    <div style={{ padding: "32px" }}>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "12px", color: "#7C3AED", fontWeight: 600, textTransform: "capitalize", marginBottom: "4px" }}>{today}</div>
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#1E1B4B", letterSpacing: "-0.5px" }}>Tableau de bord</h1>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>Gérez et interagissez avec vos agents intelligents</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: "white", borderRadius: "14px", border: "1px solid #E8E8F0", padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 2px 8px rgba(30,27,75,0.05)" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.Icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
        {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>
    </div>
  );
}
