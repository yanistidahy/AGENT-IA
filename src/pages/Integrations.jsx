import { useState } from "react";
import { Search, X, CheckCircle } from "lucide-react";

const integrations = [
  // Nos intégrations clés
  { id: "gmail", name: "Gmail", icon: "📧", color: "#EA4335", bg: "#FEF2F2", category: "Email", status: "connected", description: "Connectez votre compte Gmail pour gérer vos emails avec Aria." },
  { id: "linkedin", name: "LinkedIn", icon: "💼", color: "#0A66C2", bg: "#EFF6FF", category: "Réseaux sociaux", status: "manual", description: "Connectez LinkedIn pour prospecter avec Axel et croître avec Nova." },
  { id: "instagram", name: "Instagram", icon: "📸", color: "#E1306C", bg: "#FDF2F8", category: "Réseaux sociaux", status: "manual", description: "Connectez Instagram pour vos actions de croissance quotidiennes." },
  { id: "calendar", name: "Google Calendar", icon: "📅", color: "#1A73E8", bg: "#EFF6FF", category: "Productivité", status: "pending", description: "Synchronisez votre calendrier pour la gestion des relances." },
  { id: "notion", name: "Notion", icon: "📝", color: "#000000", bg: "#F5F5F5", category: "Productivité", status: "available", description: "Exportez vos documents et notes vers Notion." },
  { id: "sheets", name: "Google Sheets", icon: "📊", color: "#34A853", bg: "#F0FDF4", category: "Productivité", status: "available", description: "Exportez vos données et analyses vers Google Sheets." },
  { id: "stripe", name: "Stripe", icon: "💳", color: "#635BFF", bg: "#F5F4FF", category: "Finance", status: "available", description: "Analysez vos revenus Stripe avec Felix." },
  { id: "slack", name: "Slack", icon: "💬", color: "#4A154B", bg: "#F9F5FF", category: "Communication", status: "available", description: "Recevez les rapports de vos agents dans Slack." },
  { id: "hubspot", name: "HubSpot", icon: "🎯", color: "#FF7A59", bg: "#FFF7ED", category: "CRM", status: "available", description: "Synchronisez vos prospects qualifiés par Axel dans HubSpot." },
  { id: "shopify", name: "Shopify", icon: "🛍️", color: "#96BF48", bg: "#F7FEE7", category: "E-commerce", status: "available", description: "Connectez vos données e-commerce pour des analyses approfondies." },
  { id: "zapier", name: "Zapier", icon: "⚡", color: "#FF4A00", bg: "#FFF7ED", category: "Automatisation", status: "available", description: "Automatisez vos workflows avec 5000+ apps via Zapier." },
  { id: "airtable", name: "Airtable", icon: "🗂️", color: "#FCB400", bg: "#FFFBEB", category: "Base de données", status: "available", description: "Stockez et organisez vos données dans Airtable." },
  { id: "typeform", name: "Typeform", icon: "📋", color: "#262627", bg: "#F5F5F5", category: "Formulaires", status: "available", description: "Créez des formulaires de qualification pour vos prospects." },
  { id: "mailchimp", name: "Mailchimp", icon: "🐒", color: "#FFE01B", bg: "#FEFCE8", category: "Email marketing", status: "available", description: "Envoyez vos contenus créés par Léa via Mailchimp." },
  { id: "whatsapp", name: "WhatsApp Business", icon: "📱", color: "#25D366", bg: "#F0FDF4", category: "Messagerie", status: "available", description: "Connectez WhatsApp Business pour vos relances clients." },
  { id: "trello", name: "Trello", icon: "📌", color: "#0052CC", bg: "#EFF6FF", category: "Gestion de projet", status: "available", description: "Créez des cartes Trello depuis vos actions IA." },
];

const STATUS_LABELS = {
  connected: { label: "Connecté", color: "#16A34A", bg: "#ECFDF5" },
  pending: { label: "En attente", color: "#D97706", bg: "#FFFBEB" },
  manual: { label: "Mode guidé", color: "#2563EB", bg: "#EFF6FF" },
  available: { label: "Disponible", color: "#888", bg: "#F5F5F5" },
};

function IntegrationModal({ integration, onClose }) {
  if (!integration) return null;
  const isManual = integration.status === "manual";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: "16px", padding: "28px",
        width: "100%", maxWidth: "480px", position: "relative",
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#AAA" }}>
          <X size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: integration.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
            {integration.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "18px", color: "#1A1A1A" }}>Connecter {integration.name}</div>
            <div style={{ fontSize: "13px", color: "#888" }}>{integration.category}</div>
          </div>
        </div>

        {integration.status === "connected" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle size={40} color="#22C55E" style={{ marginBottom: "12px" }} />
            <div style={{ fontWeight: 600, fontSize: "16px", color: "#1A1A1A" }}>Déjà connecté !</div>
            <p style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>Cette intégration est active et fonctionne correctement.</p>
          </div>
        ) : isManual ? (
          <>
            <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.65", marginBottom: "16px" }}>
              <strong>{integration.name}</strong> ne permet pas l'automatisation directe via API. Voici comment utiliser vos agents en mode guidé :
            </p>
            <div style={{ background: "#F5F5F5", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
              {integration.id === "linkedin" ? (
                <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#444", lineHeight: "2" }}>
                  <li>Ouvrez LinkedIn sur votre navigateur</li>
                  <li>Accédez au profil ou post ciblé</li>
                  <li>Copiez l'URL ou le contenu</li>
                  <li>Collez dans <strong>Axel</strong> ou <strong>Nova</strong> pour générer votre action</li>
                  <li>Exécutez l'action directement sur LinkedIn</li>
                </ol>
              ) : (
                <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#444", lineHeight: "2" }}>
                  <li>Ouvrez Instagram sur mobile ou navigateur</li>
                  <li>Utilisez <strong>Nova</strong> : "Plan du jour" pour votre plan d'action</li>
                  <li>Utilisez <strong>Léa</strong> pour créer vos contenus</li>
                  <li>Copiez-collez les textes générés dans Instagram</li>
                  <li>Exécutez les actions d'engagement directement</li>
                </ol>
              )}
            </div>
            <button style={{
              background: "#000", color: "white", border: "none", borderRadius: "8px",
              padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#222"}
              onMouseLeave={e => e.currentTarget.style.background = "#000"}
              onClick={onClose}
            >J'ai compris, commencer</button>
          </>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.65", marginBottom: "20px" }}>{integration.description}</p>
            <button style={{
              background: "#000", color: "white", border: "none", borderRadius: "8px",
              padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#222"}
              onMouseLeave={e => e.currentTarget.style.background = "#000"}
            >Connecter {integration.name}</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Integrations() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("catalogue");
  const [modal, setModal] = useState(null);

  const filtered = integrations.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const connected = integrations.filter(i => i.status === "connected");

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      {/* Header */}
      <div style={{ padding: "20px 32px 0", borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ display: "flex", gap: "0", marginBottom: "0" }}>
          {[
            { key: "catalogue", label: "Catalogue" },
            { key: "connectes", label: `Comptes connectés [${connected.length}]` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "14px 16px 12px", fontSize: "14px",
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? "#1A1A1A" : "#888",
              borderBottom: activeTab === t.key ? "2px solid #1A1A1A" : "2px solid transparent",
              marginBottom: "-1px",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Search bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "16px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "360px" }}>
            <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#AAA" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher des intégrations..."
              style={{
                width: "100%", background: "#F5F5F5", border: "none", borderRadius: "8px",
                padding: "9px 14px 9px 36px", fontSize: "13px", color: "#1A1A1A",
                outline: "none", fontFamily: "inherit",
              }}
            />
          </div>
          <span style={{ fontSize: "13px", color: "#888" }}>{filtered.length} apps disponibles</span>
        </div>

        {activeTab === "connectes" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {connected.map(integ => (
              <IntegCard key={integ.id} integration={integ} onClick={() => setModal(integ)} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            {filtered.map(integ => (
              <IntegCard key={integ.id} integration={integ} onClick={() => setModal(integ)} />
            ))}
          </div>
        )}
      </div>

      <IntegrationModal integration={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function IntegCard({ integration, onClick }) {
  const s = STATUS_LABELS[integration.status];
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #F0F0F0", borderRadius: "12px",
      padding: "18px", display: "flex", flexDirection: "column", gap: "12px",
      cursor: "pointer",
    }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background = "#FAFAFA"; e.currentTarget.style.borderColor = "#E0E0E0"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#F0F0F0"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: integration.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
          {integration.icon}
        </div>
        <span style={{ fontSize: "10px", fontWeight: 600, color: s.color, background: s.bg, padding: "3px 8px", borderRadius: "99px" }}>{s.label}</span>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A", marginBottom: "3px" }}>{integration.name}</div>
        <div style={{ fontSize: "12px", color: "#888" }}>{integration.description}</div>
      </div>
    </div>
  );
}
