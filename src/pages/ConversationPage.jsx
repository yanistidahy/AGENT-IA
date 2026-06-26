import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { getAgent, agents } from "../agents/agentsConfig";
import { sendMessage } from "../api/claude";
import AgentAvatar from "../components/AgentAvatar";
import { ArrowLeft, ChevronDown, Lock, Paperclip, Mic, ArrowUp } from "lucide-react";

const STORAGE_KEY = (id) => `aura_prompt_${id}`;
const HISTORY_KEY = (id) => `aura_history_${id}`;
const CONVOS_KEY = (id) => `aura_conversations_${id}`;

function getStoredPrompt(id, def) {
  return localStorage.getItem(STORAGE_KEY(id)) || def;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/* ── TYPING STEPS ─────────────────────────────────────────────────────────── */
const STEPS = ["Lecture du brief", "Analyse du contexte", "Rédaction en cours..."];

function TypingSteps({ agent }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "24px" }} className="fade-in">
      <AgentAvatar agent={agent} size={36} />
      <div style={{ paddingTop: "4px" }}>
        <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: i <= step ? agent.color : "#CCC", width: "12px" }}>
                {i < step ? "✓" : i === step ? "●" : "○"}
              </span>
              <span style={{ fontSize: "12px", color: i < step ? "#AAA" : i === step ? "#1A1A1A" : "#CCC" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── MESSAGE ──────────────────────────────────────────────────────────────── */
function ChatMessage({ msg, agent }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: "20px" }} className="fade-in">
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <AgentAvatar agent={agent} size={36} />
          <div>
            <span style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A" }}>{agent.name}</span>
            <span style={{ fontSize: "11px", color: "#AAA", marginLeft: "8px" }}>{formatTime(msg.timestamp)}</span>
          </div>
        </div>
      )}
      <div style={{
        maxWidth: isUser ? "65%" : "85%",
        marginLeft: isUser ? 0 : "46px",
        fontSize: "14px", lineHeight: "1.65", color: "#1A1A1A",
        background: isUser ? "#F5F5F5" : "transparent",
        padding: isUser ? "12px 16px" : "0",
        borderRadius: isUser ? "12px 12px 2px 12px" : "0",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>{msg.content}</div>
      {isUser && <span style={{ fontSize: "11px", color: "#CCC", marginTop: "4px" }}>{formatTime(msg.timestamp)}</span>}
    </div>
  );
}

/* ── ACTION CARD ─────────────────────────────────────────────────────────── */
function ActionCard({ action, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px",
      padding: "16px", textAlign: "left", cursor: "pointer", width: "100%",
      display: "flex", alignItems: "center", gap: "14px",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.borderColor = "#E0E0E0"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#F0F0F0"; }}
    >
      <div style={{
        width: "40px", height: "40px", borderRadius: "10px",
        background: "#F5F5F5", display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "20px", flexShrink: 0,
      }}>{action.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A", marginBottom: "3px" }}>{action.title}</div>
        <div style={{ fontSize: "12px", color: "#888" }}>{action.subtitle}</div>
      </div>
      <button style={{
        background: "#000", color: "white", border: "none", borderRadius: "7px",
        padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0,
      }}>Démarrer</button>
    </button>
  );
}

/* ── MAIN PAGE ────────────────────────────────────────────────────────────── */
export default function ConversationPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agent = getAgent(agentId);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!agent) return;
    const stored = localStorage.getItem(HISTORY_KEY(agent.id));
    const initialMsgs = stored ? JSON.parse(stored) : [];
    setMessages(initialMsgs);

    // Handle ?q= param (from home bar)
    const q = searchParams.get("q");
    if (q && initialMsgs.length === 0) {
      setTimeout(() => {
        setInput(q);
        // Auto-send
        const newMsgs = [{ role: "user", content: q, timestamp: Date.now() }];
        setMessages(newMsgs);
        setInput("");
        setLoading(true);
        sendMessage(getStoredPrompt(agent.id, agent.defaultPrompt), newMsgs.map(m => ({ role: m.role, content: m.content })))
          .then(reply => {
            const final = [...newMsgs, { role: "assistant", content: reply, timestamp: Date.now() }];
            setMessages(final);
            saveHistory(final);
          })
          .catch(err => setError(err.message))
          .finally(() => setLoading(false));
      }, 100);
    }
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!agent) return (
    <div style={{ padding: "60px", textAlign: "center" }}>
      <p style={{ color: "#888" }}>Agent introuvable.</p>
      <button onClick={() => navigate("/assistants")} style={{ color: "#000", background: "none", border: "none", cursor: "pointer" }}>← Retour</button>
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
      const reply = await sendMessage(getStoredPrompt(agent.id, agent.defaultPrompt), newMsgs.map(m => ({ role: m.role, content: m.content })));
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

  const handleAction = (action) => {
    setInput(action.prompt);
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#FFFFFF" }}>

      {/* ── HEADER ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: "56px", borderBottom: "1px solid #F0F0F0",
        flexShrink: 0,
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate("/assistants")} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: "#666", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>Conversation avec {agent.name}</span>
          <ChevronDown size={14} color="#AAA" />
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#F5F5F5", border: "none", borderRadius: "7px",
            padding: "6px 12px", fontSize: "12px", color: "#666", cursor: "pointer",
          }}>
            <Lock size={12} /> Conversation privée <ChevronDown size={12} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AgentAvatar agent={agent} size={28} />
            <span style={{ fontSize: "13px", color: "#666" }}>{agent.name}, {agent.roleShort}</span>
            <ChevronDown size={12} color="#AAA" />
          </div>
          {messages.length > 0 && (
            <button onClick={handleNew} style={{
              background: "#F5F5F5", border: "none", borderRadius: "7px",
              padding: "6px 12px", fontSize: "12px", color: "#666", cursor: "pointer",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EBEBEB"; e.currentTarget.style.color = "#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F5F5F5"; e.currentTarget.style.color = "#666"; }}
            >+ Nouvelle</button>
          )}
        </div>
      </div>

      {/* ── MESSAGES ZONE ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 0" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", padding: "0 24px" }}>

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "24px", gap: "20px" }}>
              <AgentAvatar agent={agent} size={56} />
              <div style={{ textAlign: "center" }}>
                <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700, color: "#1A1A1A" }}>Démarrer une conversation</h2>
                <p style={{ margin: 0, fontSize: "14px", color: "#888" }}>{agent.name} connaît déjà votre contexte Aura Flow AI.</p>
              </div>

              {/* Welcome message */}
              <div style={{
                width: "100%", background: "#F5F5F5", borderRadius: "12px",
                padding: "16px 20px", fontSize: "14px", color: "#444", lineHeight: "1.65",
                whiteSpace: "pre-wrap",
              }}>{agent.welcomeMsg}</div>

              {/* Action cards */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                {agent.actions.map((action, i) => (
                  <ActionCard key={i} action={action} onClick={() => handleAction(action)} />
                ))}
              </div>

              {/* Quick agent switch */}
              <div style={{ width: "100%", marginTop: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Changer d'assistant</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {agents.filter(a => a.id !== agent.id).map(a => (
                    <button key={a.id} onClick={() => navigate(`/conversation/${a.id}`)} style={{
                      display: "flex", alignItems: "center", gap: "7px",
                      background: "#F5F5F5", border: "none", borderRadius: "99px",
                      padding: "6px 12px", fontSize: "12px", color: "#666", cursor: "pointer",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#EBEBEB"; e.currentTarget.style.color = "#000"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#F5F5F5"; e.currentTarget.style.color = "#666"; }}
                    >
                      <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: a.bg, color: a.color, fontSize: "8px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{a.initial}</div>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} agent={agent} />)}

          {/* Loading */}
          {loading && <TypingSteps agent={agent} />}

          {/* Error */}
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#DC2626", marginBottom: "16px" }}>
              ⚠️ {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── INPUT BAR ── */}
      <div style={{ borderTop: "1px solid #F0F0F0", padding: "16px 24px 20px", flexShrink: 0 }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ background: "#F5F5F5", borderRadius: "14px", padding: "4px 8px 8px" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Dis-moi ce que tu as en tête... (Entrée pour envoyer)`}
              rows={3}
              style={{
                width: "100%", background: "transparent", border: "none",
                padding: "12px 12px 4px", fontSize: "14px", color: "#1A1A1A",
                fontFamily: "inherit", outline: "none", lineHeight: "1.5", maxHeight: "120px",
                overflowY: "auto",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 4px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "6px", color: "#AAA" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#666"}
                  onMouseLeave={e => e.currentTarget.style.color = "#AAA"}
                ><Paperclip size={15} /></button>
                <button style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "6px", color: "#AAA" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#666"}
                  onMouseLeave={e => e.currentTarget.style.color = "#AAA"}
                ><Mic size={15} /></button>
              </div>
              <button onClick={handleSend} disabled={!input.trim() || loading} style={{
                background: input.trim() && !loading ? "#000" : "#CCC",
                color: "white", border: "none", borderRadius: "8px",
                padding: "8px 16px", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600,
              }}>
                {loading ? "..." : <><ArrowUp size={14} /> Envoyer</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
