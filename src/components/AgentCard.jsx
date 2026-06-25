import { useNavigate } from "react-router-dom";

export default function AgentCard({ agent }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: "white", borderRadius: "16px", border: "1px solid #E8E8F0",
        boxShadow: "0 2px 8px rgba(30,27,75,0.06)", overflow: "hidden",
        display: "flex", flexDirection: "column", cursor: "default",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(124,58,237,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(30,27,75,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        height: "80px", position: "relative",
        background: `linear-gradient(135deg, ${agent.colorHex}ee, ${agent.colorHex}88)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "32px" }}>{agent.icon}</span>
        <span style={{
          position: "absolute", top: "10px", right: "12px",
          background: "#ECFDF5", color: "#059669", fontSize: "11px", fontWeight: 600,
          padding: "3px 8px", borderRadius: "99px", border: "1px solid #A7F3D0",
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          <span style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%", animation: "pulse 2s infinite" }} />
          Actif
        </span>
      </div>
      <div style={{ padding: "16px 18px 18px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1E1B4B" }}>{agent.name}</h3>
        <p style={{
          margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          flexGrow: 1,
        }}>{agent.role}</p>
        <button
          onClick={() => navigate(`/agent/${agent.id}`)}
          style={{
            marginTop: "10px", width: "100%", background: "#7C3AED", color: "white",
            border: "none", borderRadius: "8px", padding: "10px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#6D28D9"}
          onMouseLeave={e => e.currentTarget.style.background = "#7C3AED"}
        >
          Ouvrir →
        </button>
      </div>
    </div>
  );
}
