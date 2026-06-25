import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../api/claude";
import { getStoredPrompt } from "./PromptEditor";

const HISTORY_KEY = (id) => `aura_history_${id}`;
const CONVERSATIONS_KEY = (id) => `aura_conversations_${id}`;

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-8 h-8 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        AI
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
        </div>
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          isUser ? "bg-gray-200 text-gray-600" : "bg-[#7C3AED] text-white"
        }`}
      >
        {isUser ? "Toi" : "AI"}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#7C3AED] text-white rounded-br-none"
            : "bg-gray-100 text-gray-800 rounded-bl-none"
        }`}
      >
        {msg.content}
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

  const saveHistory = (msgs) => {
    localStorage.setItem(HISTORY_KEY(agent.id), JSON.stringify(msgs));
  };

  const saveConversation = (msgs) => {
    if (msgs.length === 0) return;
    const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY(agent.id)) || "[]");
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString("fr-FR"),
      preview: msgs[0]?.content?.slice(0, 80) + "...",
      messages: msgs,
    };
    const updated = [newEntry, ...stored].slice(0, 5);
    localStorage.setItem(CONVERSATIONS_KEY(agent.id), JSON.stringify(updated));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const systemPrompt = getStoredPrompt(agent.id, agent.defaultPrompt);
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const reply = await sendMessage(systemPrompt, apiMessages);
      const finalMessages = [...newMessages, { role: "assistant", content: reply }];
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col" style={{ height: "560px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">{agent.icon}</span>
          <h2 className="font-semibold text-gray-800 text-base">Chat</h2>
          {messages.length > 0 && (
            <span className="text-xs text-gray-400">({messages.length} messages)</span>
          )}
        </div>
        <button
          onClick={handleNewConversation}
          className="text-xs text-gray-500 hover:text-[#7C3AED] transition-colors bg-gray-50 hover:bg-purple-50 px-3 py-1.5 rounded-lg"
        >
          + Nouvelle conversation
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">{agent.icon}</div>
            <p className="text-gray-500 text-sm font-medium">{agent.name} est prêt</p>
            <p className="text-gray-400 text-xs mt-1">Posez votre première question...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-3">
            ⚠️ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-100">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`Message à ${agent.name}...`}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] resize-none transition max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-gray-200 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
          >
            {loading ? "..." : "Envoyer"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</p>
      </div>
    </div>
  );
}
