export default function AgentAvatar({ agent, size = 40 }) {
  const fontSize = Math.round(size * 0.4);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: agent.bg, color: agent.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 700, flexShrink: 0, userSelect: "none",
    }}>
      {agent.initial}
    </div>
  );
}
