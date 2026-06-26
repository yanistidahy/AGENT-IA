import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { agents, getAgent } from "../agents/agentsConfig";
import AgentAvatar from "../components/AgentAvatar";
import { Paperclip, Mic, ArrowUp, HelpCircle, UserPlus } from "lucide-react";

const CONVOS_KEY = (id) => `aura_conversations_${id}`;

function getRecentConversations() {
  const all = [];
  agents.forEach(agent => {
    const stored = JSON.parse(localStorage.getItem(CONVOS_KEY(agent.id)) || "[]");
    stored.forEach(c => all.push({ ...c, agentId: agent.id }));
  });
  return all.sort((a, b) => b.id - a.id).slice(0, 5);
}

function relativeDate(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d}j`;
}

export default function Home() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [recentConvos, setRecentConvos] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    setRecentConvos(getRecentConversations());
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    navigate(`/conversation/aria?q=${encodeURIComponent(input.trim())}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 32px", borderBottom: "1px solid #F0F0F0",
      }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1A1A1A" }}>Accueil</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#F5F5F5", border: "none", borderRadius: "8px",
            padding: "8px 14px", fontSize: "13px", color: "#444", cursor: "pointer", fontWeight: 500,
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#EBEBEB"}
            onMouseLeave={e => e.currentTarget.style.background = "#F5F5F5"}
          ><UserPlus size={14} /> Inviter des collaborateurs</button>
          <button style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#F5F5F5", border: "none", borderRadius: "8px",
            padding: "8px 14px", fontSize: "13px", color: "#444", cursor: "pointer", fontWeight: 500,
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#EBEBEB"}
            onMouseLeave={e => e.currentTarget.style.background = "#F5F5F5"}
          ><HelpCircle size={14} /> Besoin d'aide</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* 2 blocs côte à côte */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Bloc assistants */}
          <div style={{
            background: "#F5F5F5", borderRadius: "16px", padding: "28px",
            display: "flex", flexDirection: "column", alignItems: "center", minHeight: "200px",
          }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
              {/* Avatars superposés */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {agents.map((a, i) => (
                  <div key={a.id} style={{ marginLeft: i === 0 ? 0 : -12, zIndex: agents.length - i }}>
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "50%",
                      background: a.bg, color: a.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px", fontWeight: 700,
                      border: "2px solid white",
                    }}>{a.initial}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "15px", color: "#1A1A1A", marginBottom: "4px" }}>Mes assistants</div>
              <div style={{ fontSize: "13px", color: "#888" }}>7 agents IA prêts à travailler</div>
            </div>
            <button
              onClick={() => navigate("/assistants")}
              style={{
                background: "#000", color: "white", border: "none", borderRadius: "8px",
                padding: "10px 20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", width: "100%",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#222"}
              onMouseLeave={e => e.currentTarget.style.background = "#000"}
            >Voir mes assistants</button>
          </div>

          {/* Bloc discussions récentes */}
          <div style={{ background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 600, fontSize: "15px", color: "#1A1A1A", marginBottom: "16px" }}>Discussions récentes</div>
            {recentConvos.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                {agents.slice(0, 4).map(agent => (
                  <button key={agent.id} onClick={() => navigate(`/conversation/${agent.id}`)} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    background: "none", border: "none", cursor: "pointer", padding: "8px",
                    borderRadius: "8px", textAlign: "left",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F9F9F9"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}
                  >
                    <AgentAvatar agent={agent} size={36} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#1A1A1A" }}>Conversation avec {agent.name}</div>
                      <div style={{ fontSize: "12px", color: "#AAA" }}>Démarrer une conversation</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                {recentConvos.map(c => {
                  const agent = getAgent(c.agentId);
                  if (!agent) return null;
                  return (
                    <button key={c.id} onClick={() => navigate(`/conversation/${c.agentId}`)} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      background: "none", border: "none", cursor: "pointer", padding: "8px",
                      borderRadius: "8px", textAlign: "left",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F9F9F9"}
                      onMouseLeave={e => e.currentTarget.style.background = ""}
                    >
                      <AgentAvatar agent={agent} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#1A1A1A" }}>Conversation avec {agent.name}</div>
                        <div style={{ fontSize: "12px", color: "#AAA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview || "Aucun aperçu"}</div>
                      </div>
                      <span style={{ fontSize: "11px", color: "#CCC", flexShrink: 0 }}>{relativeDate(c.id)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => navigate("/assistants/historique")} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "13px", color: "#666", marginTop: "12px", textAlign: "left", padding: "4px 8px",
            }}
              onMouseEnter={e => e.currentTarget.style.color = "#000"}
              onMouseLeave={e => e.currentTarget.style.color = "#666"}
            >Voir toutes les discussions →</button>
          </div>
        </div>

        {/* Universal chat bar */}
        <div style={{ background: "#F5F5F5", borderRadius: "14px", padding: "4px 8px 8px" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Dis-moi ce que tu as en tête..."
            rows={3}
            style={{
              width: "100%", background: "transparent", border: "none",
              padding: "12px 12px 4px", fontSize: "14px", color: "#1A1A1A",
              fontFamily: "inherit", outline: "none", lineHeight: "1.5",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 4px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "6px", color: "#999" }}
                onMouseEnter={e => e.currentTarget.style.color = "#555"}
                onMouseLeave={e => e.currentTarget.style.color = "#999"}
              ><Paperclip size={16} /></button>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "6px", color: "#999" }}
                onMouseEnter={e => e.currentTarget.style.color = "#555"}
                onMouseLeave={e => e.currentTarget.style.color = "#999"}
              ><Mic size={16} /></button>
            </div>
            <button onClick={handleSend} disabled={!input.trim()} style={{
              background: input.trim() ? "#000" : "#CCC", color: "white",
              border: "none", borderRadius: "8px", padding: "8px 14px",
              cursor: input.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600,
            }}>Envoyer <ArrowUp size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
