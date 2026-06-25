import { useState, useEffect } from "react";

const STORAGE_KEY = (id) => `aura_prompt_${id}`;

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

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800 text-base">Prompt Système</h2>
          <p className="text-gray-500 text-sm">Personnalisez le comportement de l'agent</p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-[#7C3AED] transition-colors underline"
        >
          Réinitialiser
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] resize-none transition"
        placeholder="Entrez le prompt système de l'agent..."
      />

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-400">{prompt.length} caractères</p>
        <button
          onClick={handleSave}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
          }`}
        >
          {saved ? "✓ Sauvegardé" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

export function getStoredPrompt(agentId, defaultPrompt) {
  return localStorage.getItem(STORAGE_KEY(agentId)) || defaultPrompt;
}
