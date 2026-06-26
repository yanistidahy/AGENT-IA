import { NavLink, useNavigate } from "react-router-dom";
import { Home, Users, Zap, Plug, FileText, File, Megaphone, Bot, Settings, ChevronRight, Plus } from "lucide-react";

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} style={({ isActive }) => ({
      display: "flex", alignItems: "center", gap: "10px",
      padding: "8px 10px", borderRadius: "8px", marginBottom: "1px",
      textDecoration: "none", fontSize: "14px", fontWeight: isActive ? 500 : 400,
      background: isActive ? "#F5F5F5" : "transparent",
      color: isActive ? "#000" : "#666",
    })}
      onMouseEnter={e => { if (!e.currentTarget.classList.contains("active")) e.currentTarget.style.background = "#F9F9F9"; }}
      onMouseLeave={e => { if (!e.currentTarget.classList.contains("active")) e.currentTarget.style.background = "transparent"; }}
    >
      {Icon && <Icon size={17} style={{ flexShrink: 0, opacity: 0.7 }} />}
      <span>{label}</span>
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: "11px", fontWeight: 600, color: "#AAA", letterSpacing: "0.06em", textTransform: "uppercase", padding: "16px 10px 6px" }}>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside style={{
      position: "fixed", left: 0, top: 0, width: "280px", height: "100vh",
      background: "#FFFFFF", borderRight: "1px solid #F0F0F0",
      display: "flex", flexDirection: "column", zIndex: 50,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            <div style={{
              width: "28px", height: "28px", background: "#000", borderRadius: "7px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px", padding: "5px" }}>
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ width: "4px", height: "4px", background: "white", borderRadius: "1px" }} />
                ))}
              </div>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.2px" }}>AURA FLOW AI</span>
            <ChevronRight size={13} color="#AAA" />
          </div>
          <button
            onClick={() => navigate("/conversation/aria")}
            style={{
              width: "28px", height: "28px", background: "#000", border: "none",
              borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white", flexShrink: 0,
            }}
          ><Plus size={15} /></button>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        <NavItem to="/" icon={Home} label="Accueil" end />
        <NavItem to="/assistants" icon={Users} label="Assistants" />
        <NavItem to="/super-pouvoirs" icon={Zap} label="Super-pouvoirs" />
        <NavItem to="/integrations" icon={Plug} label="Intégrations" />
        <NavItem to="/documents" icon={FileText} label="Documents" />

        <SectionLabel>Mes créations</SectionLabel>
        <NavItem to="/documents" icon={File} label="Contenus" />
        <NavItem to="/super-pouvoirs" icon={Megaphone} label="Campagnes" />
        <NavItem to="/assistants" icon={Bot} label="Agents" />
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #F0F0F0", padding: "10px 12px" }}>
        <NavItem to="/parametres" icon={Settings} label="Paramètres" />
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "8px 10px", borderRadius: "8px", cursor: "pointer", marginTop: "1px",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#F9F9F9"}
          onMouseLeave={e => e.currentTarget.style.background = ""}
        >
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "#1A1A1A", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "11px", fontWeight: 700, flexShrink: 0,
          }}>H</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "#1A1A1A" }}>Housni</div>
            <div style={{ fontSize: "11px", color: "#AAA" }}>Compte pro</div>
          </div>
          <ChevronRight size={13} color="#CCC" />
        </div>
      </div>
    </aside>
  );
}
