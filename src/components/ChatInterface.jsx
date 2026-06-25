import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../api/claude";
import { getStoredPrompt } from "./PromptEditor";

const HISTORY_KEY = (id) => `aura_history_${id}`;
const CONVERSATIONS_KEY = (id) => `aura_conversations_${id}`;

function formatTime(date) {
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function TypingIndicator({ agentIcon }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "16px" }}>
      <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>{agentIcon}</div>
      <div style={{ background: "#F3F4F6", borderRadius: "16px 16px 16px 4px", padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function Message({ msg, agentIcon }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", alignItems: "flex-end", gap: "8px", marginBottom: "16px" }}>
      {!isUser && (
        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>{agentIcon}</div>
      )}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: "4px" }}>
        <div style={{
          background: isUser ? "#7C3AED" : "#F3F4F6",
          color: isUser ? "white" : "#1E1B4B",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          padding: "11px 16px", fontSize: "14px", lineHeight: "1.55",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>{msg.content}</div>
        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{formatTime(msg.timestamp || Date.now())}</span>
      </div>
    </div>
  );
}

export default function ChatInterface({ agent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_KEY(agent.id));
    if (stored) setMessages(JSON.parse(stored));
    else setMessages([]);
  }, [agent.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveHistory = (msgs) => localStorage.setItem(HISTORY_KEY(agent.id), JSON.stringify(msgs));

  const saveConversation = (msgs) => {
    if (!msgs.length) return;
    const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agent.id)) || "[]");
    const updated = [{ id: Date.now(), date: new Date().toLocaleString("fr-FR"), preview: msgs[0]?.content?.slice(0, 80) + "...", messages: msgs }, ...stored].slice(0, 5);
    localStorage.setItem(CONVERSATIONS_KEY(agent.id), JSON.stringify(updated));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", content: text, timestamp: Date.now() }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const systemPrompt = getStoredPrompt(agent.id, agent.defaultPrompt);
      const reply = await sendMessage(systemPrompt, newMessages.map(m => ({ role: m.role, content: m.content })));
      const finalMessages = [...newMessages, { role: "assistant", content: reply, timestamp: Date.now() }];
      setMessages(finalMessages);
      saveHistory(finalMessages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNewConversation = () => {
    saveConversation(messages);
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY(agent.id));
    setError("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ background: "white", borderRadius: "16px", border: "1px solid #E8E8F0", boxShadow: "0 2px 8px rgba(30,27,75,0.06)", display: "flex", flexDirection: "column", height: "580px" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${agent.colorHex}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>{agent.icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#1E1B4B" }}>{agent.name}</div>
            <div style={{ fontSize: "12px", color: "#10B981", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "6px", height: "6px", background: "#10B981", borderRadius: "50%", display: "inline-block" }} />
              En ligne
            </div>
          </div>
        </div>
        <button onClick={handleNewConversation} style={{ background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: 500, color: "#6B7280", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#EDE9FE"; e.currentTarget.style.color = "#7C3AED"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#F8F7FF"; e.currentTarget.style.color = "#6B7280"; }}
        >+ Nouvelle</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.length === 0 && !loading && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#9CA3AF" }}>
            <div style={{ fontSize: "40px" }}>{agent.icon}</div>
            <div style={{ fontWeight: 600, color: "#6B7280", fontSize: "14px" }}>{agent.name} est prêt</div>
            <div style={{ fontSize: "13px" }}>Posez votre première question...</div>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} agentIcon={agent.icon} />)}
        {loading && <TypingIndicator agentIcon={agent.icon} />}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", marginBottom: "12px" }}>
            ⚠️ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message à ${agent.name}...`}
            rows={1}
            style={{
              flex: 1, background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "10px",
              padding: "11px 14px", fontSize: "14px", color: "#1E1B4B", fontFamily: "inherit",
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
              border: "none", borderRadius: "10px", padding: "11px 18px",
              fontSize: "13px", fontWeight: 600, cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              flexShrink: 0,
            }}
          >
            {loading ? "..." : "↑ Envoyer"}
          </button>
        </div>
        <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "6px", paddingLeft: "2px" }}>Entrée pour envoyer · Maj+Entrée pour saut de ligne</div>
      </div>
    </div>
  );
}
