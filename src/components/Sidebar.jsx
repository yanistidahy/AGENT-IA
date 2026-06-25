import { NavLink } from "react-router-dom";
import { agents } from "../agents/agentsConfig";

export default function Sidebar() {
  return (
    <aside style={{
      position: "fixed", left: 0, top: 0, width: "260px", height: "100vh",
      background: "#1E1B4B", display: "flex", flexDirection: "column",
      zIndex: 50, boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
    }}>
      <div style={{
        padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <div style={{
          width: "38px", height: "38px", background: "#7C3AED", borderRadius: "10px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 800, fontSize: "17px", flexShrink: 0,
          boxShadow: "0 4px 12px rgba(124,58,237,0.4)",
        }}>A</div>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: "16px", lineHeight: 1.2 }}>Aura Flow AI</div>
          <div style={{ color: "#A5B4FC", fontSize: "11px", marginTop: "2px" }}>Dashboard IA</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <SidebarLink to="/" icon="🏠" label="Tableau de bord" end />
        <div style={{
          color: "#6366F1", fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", padding: "16px 8px 8px",
        }}>Mes Agents</div>
        {agents.map(agent => (
          <SidebarLink key={agent.id} to={`/agent/${agent.id}`} icon={agent.icon} label={agent.name} />
        ))}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", color: "#6366F1", fontSize: "11px" }}>
        © 2025 Aura Flow AI
      </div>
    </aside>
  );
}

function SidebarLink({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 12px", borderRadius: "10px", marginBottom: "2px",
      textDecoration: "none", fontSize: "14px", fontWeight: 500,
      background: isActive ? "#7C3AED" : "transparent",
      color: isActive ? "white" : "#C4B5FD",
    })}>
      <span style={{ fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </NavLink>
  );
}
