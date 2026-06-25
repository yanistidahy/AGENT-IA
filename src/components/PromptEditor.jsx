import { useState, useEffect } from "react";

const STORAGE_KEY = (id) => `aura_prompt_${id}`;

export function getStoredPrompt(agentId, defaultPrompt) {
  return localStorage.getItem(STORAGE_KEY(agentId)) || defaultPrompt;
}

export default function PromptEditor({ agent }) {
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(agent.id));
    setPrompt(stored || agent.defaultPrompt);
  }, [agent.id]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY(agent.id), prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setPrompt(agent.defaultPrompt);
    localStorage.removeItem(STORAGE_KEY(agent.id));
  };

  const card = { background: "white", borderRadius: "16px", border: "1px solid #E8E8F0", boxShadow: "0 2px 8px rgba(30,27,75,0.06)", overflow: "hidden" };

  return (
    <div style={card}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>⚙️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#1E1B4B" }}>Prompt Système</div>
            <div style={{ fontSize: "12px", color: "#9CA3AF" }}>Personnalisez le comportement</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ background: "#EDE9FE", color: "#7C3AED", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "99px" }}>Éditable</span>
          <button onClick={handleReset} style={{ background: "none", border: "none", fontSize: "12px", color: "#9CA3AF", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
            onMouseEnter={e => e.currentTarget.style.color = "#7C3AED"}
            onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
          >Réinitialiser</button>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          style={{
            width: "100%", height: "280px", resize: "vertical",
            background: "#F8F7FF", border: "1px solid #E8E8F0", borderRadius: "12px",
            padding: "14px 16px", fontSize: "13px", lineHeight: "1.6", color: "#374151",
            fontFamily: "inherit", outline: "none",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "#7C3AED"}
          onBlur={e => e.currentTarget.style.borderColor = "#E8E8F0"}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
          <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{prompt.length} caractères</span>
          <button
            onClick={handleSave}
            style={{
              background: saved ? "#059669" : "#7C3AED", color: "white",
              border: "none", borderRadius: "8px", padding: "9px 20px",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}
          >
            {saved ? "✓ Sauvegardé" : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}
