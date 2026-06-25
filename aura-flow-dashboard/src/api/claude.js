const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export async function sendMessage(systemPrompt, conversationHistory) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      "Clé API manquante. Ajoutez VITE_ANTHROPIC_API_KEY dans votre fichier .env"
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error?.error?.message || `Erreur API: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.content[0].text;
}
