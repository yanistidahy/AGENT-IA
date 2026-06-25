import { agents } from "../agents/agentsConfig";
import AgentCard from "../components/AgentCard";

export default function Dashboard() {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const stats = [
    { icon: "🤖", value: "7", label: "Agents déployés", color: "#7C3AED", bg: "#EDE9FE" },
    { icon: "✅", value: "7", label: "Agents actifs", color: "#059669", bg: "#ECFDF5" },
    { icon: "⏰", value: "24/7", label: "Disponibilité", color: "#0891B2", bg: "#E0F2FE" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "13px", color: "#7C3AED", fontWeight: 500, textTransform: "capitalize", marginBottom: "6px" }}>{today}</div>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#1E1B4B", letterSpacing: "-0.5px" }}>Mes Agents IA</h1>
        <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#6B7280" }}>Gérez et interagissez avec vos agents intelligents</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: "white", borderRadius: "16px", border: "1px solid #E8E8F0", padding: "20px 24px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 2px 8px rgba(30,27,75,0.05)" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "13px", color: "#6B7280", marginTop: "3px" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agents grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
        {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>
    </div>
  );
}
