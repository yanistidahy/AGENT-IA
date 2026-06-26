import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { agents, getAgent } from "../agents/agentsConfig";
import AgentAvatar from "../components/AgentAvatar";

const CONVOS_KEY = (id) => `aura_conversations_${id}`;

function getAllConversations() {
  const all = [];
  agents.forEach(agent => {
    const stored = JSON.parse(localStorage.getItem(CONVOS_KEY(agent.id)) || "[]");
    stored.forEach(c => all.push({ ...c, agentId: agent.id }));
  });
  return all.sort((a, b) => b.id - a.id);
}

function relativeDate(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d}j`;
  return new Date(ts).toLocaleDateString("fr-FR");
}

function AgentCard({ agent }) {
  const navigate = useNavigate();
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px",
      padding: "20px", display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <AgentAvatar agent={agent} size={48} />
        <div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#1A1A1A" }}>{agent.name}</div>
          <div style={{ fontSize: "13px", color: "#888" }}>{agent.role}</div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: "1.55" }}>{agent.tagline}</p>
      <button
        onClick={() => navigate(`/conversation/${agent.id}`)}
        style={{
          background: "#F5F5F5", border: "none", borderRadius: "8px",
          padding: "10px", fontSize: "13px", fontWeight: 600, color: "#1A1A1A",
          cursor: "pointer", width: "100%",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#EBEBEB"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#F5F5F5"; }}
      >Discuter avec {agent.name}</button>
    </div>
  );
}

function HistoriqueTab() {
  const navigate = useNavigate();
  const [convos] = useState(getAllConversations);

  if (convos.length === 0) return (
    <div style={{ padding: "64px 32px", textAlign: "center" }}>
      <div style={{ fontSize: "32px", marginBottom: "12px" }}>💬</div>
      <div style={{ fontSize: "15px", fontWeight: 600, color: "#1A1A1A", marginBottom: "6px" }}>Aucune conversation</div>
      <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>Vos conversations avec les agents apparaîtront ici.</p>
    </div>
  );

  return (
    <div style={{ padding: "0 32px 32px" }}>
      {convos.map(c => {
        const agent = getAgent(c.agentId);
        if (!agent) return null;
        const lastMsg = c.messages?.[c.messages.length - 1];
        return (
          <div key={c.id}
            onClick={() => navigate(`/conversation/${c.agentId}`)}
            style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "14px 0", borderBottom: "1px solid #F5F5F5",
              cursor: "pointer",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
          >
            <AgentAvatar agent={agent} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A" }}>Conversation avec {agent.name}</span>
                <span style={{ fontSize: "11px", color: "#AAA" }}>{relativeDate(c.id)}</span>
              </div>
              <div style={{ fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lastMsg?.content?.slice(0, 90) || c.preview || "Aucun aperçu"}
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "#CCC" }}>{c.messages?.length || 0} msgs</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AssistantsPage({ tab = "assistants" }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(tab);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      {/* Header */}
      <div style={{ padding: "20px 32px 0", borderBottom: "1px solid #F0F0F0" }}>
        <h1 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#1A1A1A" }}>Mes assistants</h1>
        <div style={{ display: "flex", gap: "0" }}>
          {[
            { key: "assistants", label: "Mes assistants", to: "/assistants" },
            { key: "historique", label: "Historique des conversations", to: "/assistants/historique" },
          ].map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); navigate(t.to); }} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 16px 12px", fontSize: "14px",
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? "#1A1A1A" : "#888",
              borderBottom: activeTab === t.key ? "2px solid #1A1A1A" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {activeTab === "historique" ? (
        <HistoriqueTab />
      ) : (
        <div style={{ padding: "28px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
          </div>
        </div>
      )}
    </div>
  );
}
