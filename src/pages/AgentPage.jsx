import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getAgent, agents } from "../agents/agentsConfig";
import { sendMessage } from "../api/claude";

const STORAGE_KEY = (id) => `aura_prompt_${id}`;
const HISTORY_KEY = (id) => `aura_history_${id}`;
const CONVOS_KEY = (id) => `aura_conversations_${id}`;

function getStoredPrompt(id, def) {
  return localStorage.getItem(STORAGE_KEY(id)) || def;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── PROGRESS INDICATOR ──────────────────────────────────────────────────────
const STEPS = [
  "Lecture du brief",
  "Sélection du framework",
  "Écriture du hook",
  "Rédaction en cours...",
];

function ProgressIndicator({ agent }) {
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, STEPS.length - 1));
      setPct(p => Math.min(p + 22, 88));
    }, 700);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: agent.bgHex, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>{agent.emoji}</div>
        <span style={{ fontSize: "13px", color: "#666" }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#1A1A1A" }}>{agent.name}</span> travaille...
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: "3px", background: "#E5E0D8", borderRadius: "2px", marginBottom: "14px", overflow: "hidden" }}>
        <div style={{
          height: "100%", background: agent.colorHex, borderRadius: "2px",
          width: `${pct}%`, transition: "width 600ms ease",
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", width: "14px", color: i < step ? agent.colorHex : i === step ? "#1A1A1A" : "#CCC" }}>
              {i < step ? "✓" : i === step ? "●" : "○"}
            </span>
            <span style={{ fontSize: "12px", color: i < step ? "#888" : i === step ? "#1A1A1A" : "#BBB", fontWeight: i === step ? 500 : 400 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CHAT MESSAGE ────────────────────────────────────────────────────────────
function ChatMsg({ msg, agent }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }} className="fade-in">
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: agent.bgHex, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>{agent.emoji}</div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1A1A1A", fontFamily: "'Playfair Display', Georgia, serif" }}>{agent.name}</span>
          <span style={{ fontSize: "10px", color: "#AAA" }}>{formatTime(msg.timestamp)}</span>
        </div>
      )}
      <div style={{
        maxWidth: isUser ? "70%" : "90%",
        fontSize: "13px", lineHeight: "1.65", color: isUser ? "#555" : "#1A1A1A",
        textAlign: isUser ? "right" : "left",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        background: isUser ? "rgba(26,26,26,0.04)" : "transparent",
        padding: isUser ? "10px 14px" : "0",
        borderRadius: isUser ? "12px 12px 2px 12px" : "0",
      }}>{msg.content}</div>
      {isUser && <span style={{ fontSize: "10px", color: "#AAA", marginTop: "4px" }}>{formatTime(msg.timestamp)}</span>}
    </div>
  );
}

// ── HISTORY TAB ─────────────────────────────────────────────────────────────
function HistoryTab({ agentId, onLoad }) {
  const [convos, setConvos] = useState(() => JSON.parse(localStorage.getItem(CONVOS_KEY(agentId)) || "[]"));

  const handleDelete = (id, e) => {
    e.stopPropagation();
    const updated = convos.filter(c => c.id !== id);
    setConvos(updated);
    localStorage.setItem(CONVOS_KEY(agentId), JSON.stringify(updated));
  };

  if (convos.length === 0) return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <p style={{ fontSize: "13px", color: "#999" }}>Aucune conversation enregistrée.</p>
    </div>
  );

  return (
    <div style={{ padding: "0" }}>
      {convos.map(c => (
        <div key={c.id}
          onClick={() => onLoad(c.messages)}
          style={{ padding: "14px 24px", borderBottom: "1px solid rgba(26,26,26,0.06)", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(26,26,26,0.02)"}
          onMouseLeave={e => e.currentTarget.style.background = ""}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "11px", color: "#AAA", marginBottom: "3px" }}>{c.date}</div>
            <div style={{ fontSize: "13px", color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview}</div>
            <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{c.messages?.length || 0} messages</div>
          </div>
          <button onClick={(e) => handleDelete(c.id, e)} style={{ background: "none", border: "none", cursor: "pointer", color: "#CCC", fontSize: "14px", padding: "4px" }}
            onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
            onMouseLeave={e => e.currentTarget.style.color = "#CCC"}
          >✕</button>
        </div>
      ))}
    </div>
  );
}

// ── PROMPT TAB ──────────────────────────────────────────────────────────────
function PromptTab({ agent }) {
  const [prompt, setPrompt] = useState(() => getStoredPrompt(agent.id, agent.defaultPrompt));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY(agent.id), prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        style={{
          width: "100%", height: "340px",
          background: "rgba(26,26,26,0.02)", border: "1px solid rgba(26,26,26,0.1)",
          borderRadius: "10px", padding: "14px 16px", fontSize: "12px",
          lineHeight: "1.65", color: "#333", fontFamily: "inherit", outline: "none",
        }}
        onFocus={e => e.currentTarget.style.borderColor = agent.colorHex + "60"}
        onBlur={e => e.currentTarget.style.borderColor = "rgba(26,26,26,0.1)"}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
        <span style={{ fontSize: "11px", color: "#AAA" }}>{prompt.length} car.</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setPrompt(agent.defaultPrompt)} style={{ background: "none", border: "1px solid rgba(26,26,26,0.1)", borderRadius: "7px", padding: "6px 12px", fontSize: "11px", color: "#666", cursor: "pointer" }}>Réinitialiser</button>
          <button onClick={handleSave} style={{ background: saved ? "#22C55E" : "#1A1A1A", color: "white", border: "none", borderRadius: "7px", padding: "6px 14px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
            {saved ? "✓ Sauvegardé" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agent = getAgent(id);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!agent) return;
    const stored = localStorage.getItem(HISTORY_KEY(agent.id));
    setMessages(stored ? JSON.parse(stored) : []);
  }, [agent?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!agent) return (
    <div style={{ textAlign: "center", padding: "80px" }}>
      <p style={{ color: "#999" }}>Agent introuvable.</p>
      <button onClick={() => navigate("/")} style={{ color: "#1A1A1A", background: "none", border: "none", cursor: "pointer", fontSize: "13px", marginTop: "12px" }}>← Retour</button>
    </div>
  );

  const saveHistory = (msgs) => localStorage.setItem(HISTORY_KEY(agent.id), JSON.stringify(msgs));
  const saveConversation = (msgs) => {
    if (!msgs.length) return;
    const stored = JSON.parse(localStorage.getItem(CONVOS_KEY(agent.id)) || "[]");
    const updated = [{ id: Date.now(), date: new Date().toLocaleString("fr-FR"), preview: msgs[0]?.content?.slice(0, 80), messages: msgs }, ...stored].slice(0, 20);
    localStorage.setItem(CONVOS_KEY(agent.id), JSON.stringify(updated));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMsgs = [...messages, { role: "user", content: text, timestamp: Date.now() }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const systemPrompt = getStoredPrompt(agent.id, agent.defaultPrompt);
      const reply = await sendMessage(systemPrompt, newMsgs.map(m => ({ role: m.role, content: m.content })));
      const final = [...newMsgs, { role: "assistant", content: reply, timestamp: Date.now() }];
      setMessages(final);
      saveHistory(final);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNew = () => {
    saveConversation(messages);
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY(agent.id));
    setError("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const pendingConnections = agent.connections.filter(c => c.status !== "connected");

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{
        width: "280px", flexShrink: 0,
        borderRight: "1px solid rgba(26,26,26,0.08)",
        display: "flex", flexDirection: "column",
        background: "#F5F2EE", overflowY: "auto", padding: "32px 24px",
      }}>
        {/* Agent avatar */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            width: "100px", height: "100px", borderRadius: "50%",
            background: agent.bgHex,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "50px", margin: "0 auto 14px",
          }}>{agent.emoji}</div>

          {/* Badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#ECFDF5", color: "#16A34A", fontSize: "10px", fontWeight: 600, padding: "3px 9px", borderRadius: "99px" }}>
              <span style={{ width: "5px", height: "5px", background: "#22C55E", borderRadius: "50%" }} /> En ligne
            </span>
            <span style={{ background: "rgba(26,26,26,0.06)", color: "#666", fontSize: "10px", fontWeight: 500, padding: "3px 9px", borderRadius: "99px" }}>Sonnet</span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "26px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 4px",
          }}>{agent.name}</h1>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#999", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "12px" }}>{agent.roleLabel}</div>
          <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.6", margin: 0 }}>{agent.description}</p>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(26,26,26,0.08)", margin: "0 0 20px" }} />

        {/* Stats */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "4px" }}>
            {[
              { label: "Livrables", value: agent.stats.livrables },
              { label: "Tokens 30j", value: agent.stats.tokens },
              { label: "Coût 30j", value: agent.stats.cout },
              { label: "Succès", value: agent.stats.succes },
            ].map((s, i) => (
              <div key={i} style={{ background: "rgba(26,26,26,0.03)", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: agent.colorHex }}>{s.value}</div>
                <div style={{ fontSize: "9px", color: "#AAA", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <blockquote style={{
          margin: "0 0 24px", padding: "12px 14px",
          borderLeft: `2px solid ${agent.colorHex}`,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontStyle: "italic", fontSize: "12px", color: "#888", lineHeight: "1.6",
        }}>"{agent.testimonial}"</blockquote>

        {/* Quick agent nav */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#BBB", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Autres agents</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {agents.filter(a => a.id !== agent.id).map(a => (
              <button key={a.id} onClick={() => navigate(`/agent/${a.id}`)} style={{
                background: "rgba(26,26,26,0.04)", border: "none", borderRadius: "99px",
                padding: "4px 10px", fontSize: "11px", color: "#666", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "4px",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = a.bgHex; e.currentTarget.style.color = a.colorHex; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(26,26,26,0.04)"; e.currentTarget.style.color = "#666"; }}
              >{a.emoji} {a.name}</button>
            ))}
          </div>
        </div>

        {/* Back */}
        <div style={{ marginTop: "auto" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#999", display: "flex", alignItems: "center", gap: "6px", padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = "#1A1A1A"}
            onMouseLeave={e => e.currentTarget.style.color = "#999"}
          >← Accueil</button>
        </div>
      </div>

      {/* ── RIGHT MAIN AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FFFFFF", overflow: "hidden" }}>

        {/* Connections banner */}
        {pendingConnections.length > 0 && (
          <div style={{
            padding: "10px 24px", background: "#FFFBEB",
            borderBottom: "1px solid rgba(217,119,6,0.15)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: "12px", color: "#92400E" }}>
              ⚠️ {agent.name === "Axel" || agent.name === "Nova"
                ? `LinkedIn et Instagram — mode guidé actif. ${agent.name} prépare vos actions, vous les exécutez.`
                : `Connexions en attente : ${pendingConnections.map(c => c.name).join(", ")}`}
            </span>
            <Link to="/connections" style={{ fontSize: "11px", color: "#D97706", fontWeight: 600, textDecoration: "none" }}>Voir le guide →</Link>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "0",
          borderBottom: "1px solid rgba(26,26,26,0.08)",
          padding: "0 24px", flexShrink: 0,
        }}>
          {[
            { key: "chat", label: "Chat" },
            { key: "historique", label: "Historique" },
            { key: "prompt", label: "Prompt" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "14px 16px 12px", fontSize: "13px", fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? "#1A1A1A" : "#999",
              borderBottom: activeTab === tab.key ? "2px solid #1A1A1A" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{tab.label}</button>
          ))}
          {activeTab === "chat" && (
            <button onClick={handleNew} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#999", padding: "14px 0 12px" }}
              onMouseEnter={e => e.currentTarget.style.color = "#1A1A1A"}
              onMouseLeave={e => e.currentTarget.style.color = "#999"}
            >+ Nouveau</button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "historique" ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <HistoryTab agentId={agent.id} onLoad={(msgs) => { setMessages(msgs); setActiveTab("chat"); }} />
          </div>
        ) : activeTab === "prompt" ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <PromptTab agent={agent} />
          </div>
        ) : (
          /* ── CHAT TAB ── */
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px 16px" }}>
              {/* Empty state */}
              {messages.length === 0 && !loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", gap: "16px" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: agent.bgHex, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>{agent.emoji}</div>
                  <div style={{ textAlign: "center" }}>
                    <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#1A1A1A", margin: "0 0 6px" }}>Démarrer une conversation</h2>
                    <p style={{ fontSize: "13px", color: "#999", margin: 0 }}>{agent.name} connaît déjà votre contexte Aura Flow AI.</p>
                  </div>
                  {/* Suggestion chips */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "480px" }}>
                    {agent.suggestions.map((s, i) => (
                      <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{
                        background: "rgba(26,26,26,0.03)", border: "1px solid rgba(26,26,26,0.08)",
                        borderRadius: "99px", padding: "10px 18px", fontSize: "13px", color: "#444",
                        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                        transition: "all 150ms",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = agent.bgHex; e.currentTarget.style.borderColor = agent.colorHex + "30"; e.currentTarget.style.color = agent.colorHex; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(26,26,26,0.03)"; e.currentTarget.style.borderColor = "rgba(26,26,26,0.08)"; e.currentTarget.style.color = "#444"; }}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => <ChatMsg key={i} msg={msg} agent={agent} />)}

              {/* Loading */}
              {loading && <ProgressIndicator agent={agent} />}

              {/* Error */}
              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "#DC2626", marginBottom: "16px" }}>
                  ⚠️ {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "16px 24px 20px", borderTop: "1px solid rgba(26,26,26,0.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Demandez à ${agent.name}... (Entrée pour envoyer)`}
                  rows={2}
                  style={{
                    flex: 1, background: "rgba(26,26,26,0.03)",
                    border: "1px solid rgba(26,26,26,0.1)", borderRadius: "10px",
                    padding: "11px 14px", fontSize: "13px", color: "#1A1A1A",
                    fontFamily: "inherit", outline: "none", maxHeight: "100px",
                    overflowY: "auto", lineHeight: "1.5",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = agent.colorHex + "50"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(26,26,26,0.1)"}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button onClick={handleSend} disabled={!input.trim() || loading} style={{
                    background: input.trim() && !loading ? "#1A1A1A" : "#E5E0D8",
                    color: input.trim() && !loading ? "white" : "#AAA",
                    border: "none", borderRadius: "9px", padding: "11px 16px",
                    fontSize: "12px", fontWeight: 600, cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap",
                  }}>Envoyer ↑</button>
                  {messages.length > 0 && (
                    <button onClick={handleNew} style={{ background: "none", border: "1px solid rgba(26,26,26,0.1)", borderRadius: "9px", padding: "7px 10px", fontSize: "11px", color: "#999", cursor: "pointer", whiteSpace: "nowrap" }}>
                      Nouveau
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
