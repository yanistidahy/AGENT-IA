import { Link, useLocation } from "react-router-dom";

export default function TopNav() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(245,242,238,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(26,26,26,0.08)",
      padding: "0 40px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "56px",
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "18px", fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.3px",
        }}>Aura Flow AI</span>
      </Link>

      {/* Links */}
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        {[
          { label: "Agents", to: "/" },
          { label: "Connexions", to: "/connections" },
        ].map(link => (
          <Link key={link.to} to={link.to} style={{
            textDecoration: "none",
            fontSize: "13px", fontWeight: 500,
            color: location.pathname === link.to ? "#1A1A1A" : "#666",
            borderBottom: location.pathname === link.to ? "1px solid #1A1A1A" : "1px solid transparent",
            paddingBottom: "1px",
          }}>{link.label}</Link>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", background: "#22C55E", borderRadius: "50%", display: "inline-block" }} />
          <span style={{ fontSize: "12px", color: "#666", fontWeight: 500 }}>7 agents actifs</span>
        </div>
        <div style={{
          width: "30px", height: "30px", borderRadius: "50%",
          background: "#1A1A1A", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: 700, cursor: "pointer",
        }}>H</div>
      </div>
    </nav>
  );
}
