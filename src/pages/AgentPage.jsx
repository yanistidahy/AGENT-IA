import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getAgent } from "../agents/agentsConfig";
import { getStoredPrompt } from "../components/PromptEditor";
import { sendMessage } from "../api/claude";
import { ArrowLeft, Wifi, AlertCircle, RotateCcw, Trash2, MessageSquare, Settings, Send } from "lucide-react";

const HISTORY_KEY = (id) => `aura_history_${id}`;
const CONVERSATIONS_KEY = (id) => `aura_conversations_${id}`;

function formatTime(date) {
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ── LEFT PANEL ─────────────────────────────────────────────────────────────

function PromptPanel({ agent }) {
  const [prompt, setPrompt] = useState(() => localStorage.getItem(`aura_prompt_${agent.id}`) || agent.defaultPrompt);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(`aura_prompt_${agent.id}`, prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setPrompt(agent.defaultPrompt);
    localStorage.removeItem(`aura_prompt_${agent.id}`);
  };

  return (
    <div style={{ background: "white", borderRadius: "14px", border: "1px solid #E8E8F0", overflow: "hidden", marginBottom: "16px" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings size={14} color="#7C3AED" />
          <span style={{ fontWeight: 700, fontSize: "13px", color: "#1E1B4B" }}>Prompt Système</span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={handleReset} title="Réinitialiser" style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px" }}
            onMouseEnter={e => e.currentTarget.style.color = "#7C3AED"}
            onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
          ><RotateCcw size={13} /></button>
          <button onClick={handleSave} style={{ background: saved ? "#059669" : "#7C3AED", color: "white", border: "none", borderRadius: "6px", padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
            {saved ? "✓ Sauvegardé" : "Sauvegarder"}
          </button>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        style={{
          width: "100%", height: "260px", resize: "vertical",
          background: "#F8F7FF", border: "none", borderBottom: "1px solid #F3F4F6",
          padding: "12px 16px", fontSize: "12px", lineHeight: "1.6", color: "#374151",
          fontFamily: "inherit", outline: "none", display: "block",
        }}
        onFocus={e => e.currentTarget.style.background = "#F0EDFF"}
        onBlur={e => e.currentTarget.style.background = "#F8F7FF"}
      />
      <div style={{ padding: "8px 16px", display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{prompt.length} car.</span>
      </div>
    </div>
  );
}

function ConversationHistory({ agentId, onLoad }) {
  const [convos, setConvos] = useState(() => JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agentId)) || "[]"));

  const handleDelete = (id, e) => {
    e.stopPropagation();
    const updated = convos.filter(c => c.id !== id);
    setConvos(updated);
    localStorage.setItem(CONVERSATIONS_KEY(agentId), JSON.stringify(updated));
  };

  return (
    <div style={{ background: "white", borderRadius: "14px", border: "1px solid #E8E8F0", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
        <MessageSquare size={14} color="#7C3AED" />
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#1E1B4B" }}>Historique</span>
        {convos.length > 0 && <span style={{ background: "#EDE9FE", color: "#7C3AED", fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "99px", marginLeft: "auto" }}>{convos.length}</span>}
      </div>
      <div style={{ maxHeight: "280px", overflowY: "auto" }}>
        {convos.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: "12px" }}>Aucune conversation sauvegardée</div>
        ) : convos.map(c => (
          <div
            key={c.id}
            onClick={() => onLoad(c.messages)}
            style={{ padding: "10px 14px", borderBottom: "1px solid #F9FAFB", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F8F7FF"}
            onMouseLeave={e => e.currentTarget.style.background = ""}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "10px", color: "#9CA3AF", marginBottom: "2px" }}>{c.date}</div>
              <div style={{ fontSize: "12px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview}</div>
            </div>
            <button onClick={(e) => handleDelete(c.id, e)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", padding: "4px", flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
              onMouseLeave={e => e.currentTarget.style.color = "#D1D5DB"}
            ><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RIGHT CHAT PANEL ────────────────────────────────────────────────────────

function TypingIndicator({ emoji }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", marginBottom: "12px" }}>
      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>{emoji}</div>
      <div style={{ background: "#F3F4F6", borderRadius: "12px 12px 12px 3px", padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg, agentEmoji }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end", gap: "6px", marginBottom: "12px" }}>
      {!isUser && (
        <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>{agentEmoji}</div>
      )}
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: "3px" }}>
        <div style={{
          background: isUser ? "#7C3AED" : "#F3F4F6",
          color: isUser ? "white" : "#1E1B4B",
          borderRadius: isUser ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
          padding: "9px 13px", fontSize: "13px", lineHeight: "1.55",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>{msg.content}</div>
        <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{formatTime(msg.timestamp || Date.now())}</span>
      </div>
    </div>
  );
}

function ChatPanel({ agent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_KEY(agent.id));
    setMessages(stored ? JSON.parse(stored) : []);
  }, [agent.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveHistory = (msgs) => localStorage.setItem(HISTORY_KEY(agent.id), JSON.stringify(msgs));

  const saveConversation = (msgs) => {
    if (!msgs.length) return;
    const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agent.id)) || "[]");
    const updated = [{ id: Date.now(), date: new Date().toLocaleString("fr-FR"), preview: msgs[0]?.content?.slice(0, 80), messages: msgs }, ...stored].slice(0, 20);
    localStorage.setItem(CONVERSATIONS_KEY(agent.id), JSON.stringify(updated));
  };

  const loadConversation = (msgs) => {
    saveConversation(messages);
    setMessages(msgs);
    saveHistory(msgs);
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

  return { panel: (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "white", borderLeft: "1px solid #E8E8F0" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${agent.colorHex}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{agent.emoji}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#1E1B4B" }}>{agent.name}</div>
            <div style={{ fontSize: "11px", color: "#10B981", display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%" }} /> En ligne
            </div>
          </div>
        </div>
        <button onClick={handleNew} style={{ background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "11px", color: "#6B7280", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#EDE9FE"; e.currentTarget.style.color = "#7C3AED"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#F8F7FF"; e.currentTarget.style.color = "#6B7280"; }}
        >+ Nouveau</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {messages.length === 0 && !loading && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", color: "#9CA3AF" }}>
            <div style={{ fontSize: "32px" }}>{agent.emoji}</div>
            <div style={{ fontWeight: 600, color: "#6B7280", fontSize: "13px" }}>{agent.name} est prêt</div>
            <div style={{ fontSize: "12px" }}>Posez votre première question...</div>
          </div>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} msg={msg} agentEmoji={agent.emoji} />)}
        {loading && <TypingIndicator emoji={agent.emoji} />}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", marginBottom: "10px" }}>⚠️ {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #F3F4F6", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message...`}
            rows={2}
            style={{
              flex: 1, background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "9px",
              padding: "9px 12px", fontSize: "13px", color: "#1E1B4B", fontFamily: "inherit",
              outline: "none", maxHeight: "80px", overflowY: "auto", lineHeight: "1.5",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#7C3AED"}
            onBlur={e => e.currentTarget.style.borderColor = "#E8E8F0"}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? "#7C3AED" : "#E8E8F0",
              color: input.trim() && !loading ? "white" : "#9CA3AF",
              border: "none", borderRadius: "9px", padding: "9px 12px",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed", flexShrink: 0,
            }}
          ><Send size={15} /></button>
        </div>
        <div style={{ fontSize: "10px", color: "#C4B5FD", marginTop: "5px" }}>↵ Envoyer · ⇧↵ Nouvelle ligne</div>
      </div>
    </div>
  ), loadConversation };
}

// ── PAGE ────────────────────────────────────────────────────────────────────

export default function AgentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agent = getAgent(id);
  const [loadedMsgs, setLoadedMsgs] = useState(null);

  if (!agent) return (
    <div style={{ textAlign: "center", padding: "60px" }}>
      <p style={{ color: "#6B7280" }}>Agent introuvable.</p>
      <button onClick={() => navigate("/")} style={{ marginTop: "16px", color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>← Retour</button>
    </div>
  );

  const pendingConnections = agent.connections.filter(c => c.status !== "connected");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Left zone */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button onClick={() => navigate("/")} style={{ background: "white", border: "1px solid #E8E8F0", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
            <ArrowLeft size={13} /> Retour
          </button>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: `${agent.colorHex}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{agent.emoji}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1E1B4B" }}>{agent.name}</h1>
              <span style={{ background: "#ECFDF5", color: "#059669", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", border: "1px solid #A7F3D0" }}>● Actif</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6B7280" }}>{agent.role}</p>
          </div>
        </div>

        {/* Connection banner */}
        {pendingConnections.length > 0 && (
          <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={14} color="#D97706" />
              <span style={{ fontSize: "12px", color: "#92400E", fontWeight: 500 }}>
                Connexions requises pour cet agent : {pendingConnections.map(c => c.name).join(", ")}
              </span>
            </div>
            <Link to="/connections" style={{ fontSize: "11px", color: "#D97706", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>Configurer →</Link>
          </div>
        )}

        <PromptPanel agent={agent} />
        <ConversationHistory agentId={agent.id} onLoad={setLoadedMsgs} />
      </div>

      {/* Right chat panel */}
      <div style={{ width: "320px", flexShrink: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <ChatPanelComponent agent={agent} loadedMsgs={loadedMsgs} onLoadConsumed={() => setLoadedMsgs(null)} />
      </div>
    </div>
  );
}

function ChatPanelComponent({ agent, loadedMsgs, onLoadConsumed }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_KEY(agent.id));
    setMessages(stored ? JSON.parse(stored) : []);
  }, [agent.id]);

  useEffect(() => {
    if (loadedMsgs) {
      setMessages(loadedMsgs);
      onLoadConsumed();
    }
  }, [loadedMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveHistory = (msgs) => localStorage.setItem(HISTORY_KEY(agent.id), JSON.stringify(msgs));

  const saveConversation = (msgs) => {
    if (!msgs.length) return;
    const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agent.id)) || "[]");
    const updated = [{ id: Date.now(), date: new Date().toLocaleString("fr-FR"), preview: msgs[0]?.content?.slice(0, 80), messages: msgs }, ...stored].slice(0, 20);
    localStorage.setItem(CONVERSATIONS_KEY(agent.id), JSON.stringify(updated));
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "white", borderLeft: "1px solid #E8E8F0" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${agent.colorHex}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{agent.emoji}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#1E1B4B" }}>Chat</div>
            <div style={{ fontSize: "10px", color: "#10B981", display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ width: "5px", height: "5px", background: "#10B981", borderRadius: "50%" }} /> En ligne
            </div>
          </div>
        </div>
        <button onClick={handleNew} style={{ background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "11px", color: "#6B7280", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#EDE9FE"; e.currentTarget.style.color = "#7C3AED"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#F8F7FF"; e.currentTarget.style.color = "#6B7280"; }}
        >+ Nouveau</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {messages.length === 0 && !loading && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", color: "#9CA3AF" }}>
            <div style={{ fontSize: "32px" }}>{agent.emoji}</div>
            <div style={{ fontWeight: 600, color: "#6B7280", fontSize: "13px" }}>{agent.name} est prêt</div>
            <div style={{ fontSize: "12px" }}>Posez votre première question...</div>
          </div>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} msg={msg} agentEmoji={agent.emoji} />)}
        {loading && <TypingIndicator emoji={agent.emoji} />}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", marginBottom: "10px" }}>⚠️ {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 14px", borderTop: "1px solid #F3F4F6", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={2}
            style={{
              flex: 1, background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "9px",
              padding: "9px 12px", fontSize: "13px", color: "#1E1B4B", fontFamily: "inherit",
              outline: "none", maxHeight: "80px", overflowY: "auto", lineHeight: "1.5",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#7C3AED"}
            onBlur={e => e.currentTarget.style.borderColor = "#E8E8F0"}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? "#7C3AED" : "#E8E8F0",
              color: input.trim() && !loading ? "white" : "#9CA3AF",
              border: "none", borderRadius: "9px", padding: "9px 12px",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed", flexShrink: 0,
            }}
          ><Send size={15} /></button>
        </div>
        <div style={{ fontSize: "10px", color: "#C4B5FD", marginTop: "5px" }}>↵ Envoyer · ⇧↵ Nouvelle ligne</div>
      </div>
    </div>
  );
}
