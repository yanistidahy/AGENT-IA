import AgentAvatar from "../components/AgentAvatar";
import { agents } from "../agents/agentsConfig";

export default function Parametres() {
  const aria = agents[0];
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #F0F0F0" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1A1A1A" }}>Paramètres</h1>
      </div>
      <div style={{ padding: "32px", maxWidth: "600px" }}>
        {/* Profil */}
        <div style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
          <div style={{ fontWeight: 600, fontSize: "15px", color: "#1A1A1A", marginBottom: "16px" }}>Profil</div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#1A1A1A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 700 }}>H</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "16px", color: "#1A1A1A" }}>Housni</div>
              <div style={{ fontSize: "13px", color: "#888" }}>yanistidahy@gmail.com</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={{ background: "#F5F5F5", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}>Modifier le profil</button>
            <button style={{ background: "#F5F5F5", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}>Changer le mot de passe</button>
          </div>
        </div>

        {/* API */}
        <div style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px", padding: "24px", marginBottom: "16px" }}>
          <div style={{ fontWeight: 600, fontSize: "15px", color: "#1A1A1A", marginBottom: "16px" }}>Configuration API</div>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#888", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Clé Anthropic API</div>
            <input
              type="password"
              placeholder="sk-ant-..."
              defaultValue={import.meta.env.VITE_ANTHROPIC_API_KEY ? "••••••••••••••••••••••••••••" : ""}
              style={{
                width: "100%", background: "#F5F5F5", border: "1px solid #E0E0E0", borderRadius: "8px",
                padding: "10px 14px", fontSize: "13px", fontFamily: "monospace", outline: "none",
              }}
              readOnly
            />
            <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
              {import.meta.env.VITE_ANTHROPIC_API_KEY ? "✓ Clé API configurée via variable d'environnement" : "Ajoutez VITE_ANTHROPIC_API_KEY dans votre fichier .env"}
            </div>
          </div>
        </div>

        {/* Agents */}
        <div style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontWeight: 600, fontSize: "15px", color: "#1A1A1A", marginBottom: "16px" }}>Vos agents</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {agents.map(agent => (
              <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid #F5F5F5" }}>
                <AgentAvatar agent={agent} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#1A1A1A" }}>{agent.name}</div>
                  <div style={{ fontSize: "12px", color: "#888" }}>{agent.role}</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#16A34A" }}>
                  <span style={{ width: "5px", height: "5px", background: "#22C55E", borderRadius: "50%" }} /> Actif
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
