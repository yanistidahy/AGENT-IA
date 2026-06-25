import { useParams, useNavigate } from "react-router-dom";
import { getAgent } from "../agents/agentsConfig";
import PromptEditor from "../components/PromptEditor";
import ChatInterface from "../components/ChatInterface";

const CONVERSATIONS_KEY = (id) => `aura_conversations_${id}`;

function ConversationHistory({ agentId }) {
  const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agentId)) || "[]");
  return (
    <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E8E8F0", boxShadow: "0 2px 8px rgba(30,27,75,0.06)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "16px" }}>🕒</span>
        <div style={{ fontWeight: 700, fontSize: "15px", color: "#1E1B4B" }}>Historique</div>
        {stored.length > 0 && <span style={{ background: "#EDE9FE", color: "#7C3AED", fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", marginLeft: "auto" }}>{stored.length}</span>}
      </div>
      <div style={{ padding: "12px 16px" }}>
        {stored.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>💬</div>
            <div style={{ fontSize: "13px" }}>Aucune conversation sauvegardée</div>
          </div>
        ) : (
          stored.map(conv => (
            <div key={conv.id} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #F3F4F6", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8F7FF"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "11px", color: "#9CA3AF", marginBottom: "3px" }}>{conv.date}</div>
                <div style={{ fontSize: "13px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.preview}</div>
              </div>
              <span style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 600, background: "#EDE9FE", padding: "4px 10px", borderRadius: "6px", flexShrink: 0, cursor: "pointer" }}>Voir</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agent = getAgent(id);

  if (!agent) return (
    <div style={{ textAlign: "center", padding: "60px" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>🤷</div>
      <p style={{ color: "#6B7280" }}>Agent introuvable.</p>
      <button onClick={() => navigate("/")} style={{ marginTop: "16px", color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>← Retour</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
        <button onClick={() => navigate("/")} style={{ background: "white", border: "1px solid #E8E8F0", borderRadius: "10px", padding: "8px 14px", fontSize: "13px", color: "#6B7280", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}
          onMouseEnter={e => e.currentTarget.style.color = "#7C3AED"}
          onMouseLeave={e => e.currentTarget.style.color = "#6B7280"}
        >← Retour</button>

        <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `linear-gradient(135deg, ${agent.colorHex}ee, ${agent.colorHex}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", flexShrink: 0 }}>{agent.icon}</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#1E1B4B" }}>{agent.name}</h1>
            <span style={{ background: "#ECFDF5", color: "#059669", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px", border: "1px solid #A7F3D0", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%" }} />
              Actif
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>{agent.role}</p>
        </div>
      </div>

      {/* 2-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <PromptEditor agent={agent} />
          <ConversationHistory agentId={agent.id} />
        </div>
        <div>
          <ChatInterface agent={agent} />
        </div>
      </div>
    </div>
  );
}
