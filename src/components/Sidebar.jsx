import { NavLink } from "react-router-dom";
import { agents } from "../agents/agentsConfig";
import {
  LayoutDashboard, Brain, Target, TrendingUp, Pencil, Scale, Search, Calculator, Plug,
} from "lucide-react";

const ICON_MAP = {
  brain: Brain,
  target: Target,
  "trending-up": TrendingUp,
  pencil: Pencil,
  scale: Scale,
  search: Search,
  calculator: Calculator,
};

export default function Sidebar() {
  return (
    <aside style={{
      position: "fixed", left: 0, top: 0, width: "220px", height: "100vh",
      background: "#1E1B4B", display: "flex", flexDirection: "column",
      zIndex: 50, boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
    }}>
      {/* Logo */}
      <div style={{
        padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <div style={{
          width: "34px", height: "34px", background: "#7C3AED", borderRadius: "9px",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 800, fontSize: "15px", flexShrink: 0,
          boxShadow: "0 4px 12px rgba(124,58,237,0.4)",
        }}>A</div>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: "14px", lineHeight: 1.2 }}>Aura Flow AI</div>
          <div style={{ color: "#A5B4FC", fontSize: "10px", marginTop: "1px" }}>Dashboard IA</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
        <SidebarLink to="/" Icon={LayoutDashboard} label="Tableau de bord" end />
        <SidebarLink to="/connections" Icon={Plug} label="Connexions" />

        <div style={{
          color: "#6366F1", fontSize: "9px", fontWeight: 700,
          letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px 8px 6px",
        }}>Agents IA</div>

        {agents.map(agent => {
          const Icon = ICON_MAP[agent.icon] || Brain;
          return (
            <SidebarLink key={agent.id} to={`/agent/${agent.id}`} Icon={Icon} label={agent.name} color={agent.colorHex} />
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <div style={{
          width: "30px", height: "30px", borderRadius: "50%", background: "#7C3AED",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 700, fontSize: "12px", flexShrink: 0,
        }}>H</div>
        <div>
          <div style={{ color: "white", fontSize: "12px", fontWeight: 600 }}>Housni</div>
          <div style={{ color: "#6366F1", fontSize: "10px" }}>Admin</div>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ to, Icon, label, end, color }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: "flex", alignItems: "center", gap: "9px",
      padding: "9px 10px", borderRadius: "9px", marginBottom: "2px",
      textDecoration: "none", fontSize: "13px", fontWeight: 500,
      background: isActive ? "rgba(124,58,237,0.25)" : "transparent",
      color: isActive ? "white" : "#C4B5FD",
      borderLeft: isActive ? `3px solid ${color || "#7C3AED"}` : "3px solid transparent",
    })}>
      {Icon && <Icon size={15} style={{ flexShrink: 0 }} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px" }}>{label}</span>
    </NavLink>
  );
}
