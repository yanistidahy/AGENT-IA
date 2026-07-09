import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Star } from "lucide-react";

const STORAGE_KEY = "nova_comptes_cibles";
const CATEGORIES = ["Outil ecom", "Concurrent", "Média", "Influenceur", "Marque DTC", "Autre"];

const DEFAULTS = [
  { handle: "@shopify_fr", categorie: "Outil ecom", priorite: "Haute" },
  { handle: "@businessoffashion", categorie: "Média", priorite: "Normale" },
  { handle: "@camilleleblanc_officiel", categorie: "Influenceur", priorite: "Haute" },
];

export function getComptesClient() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

export default function NovaComptesClient({ onGenerate }) {
  const [comptes, setComptes] = useState(() => {
    const stored = getComptesClient();
    return stored.length > 0 ? stored : DEFAULTS;
  });
  const [newHandle, setNewHandle] = useState("");
  const [newCat, setNewCat] = useState("Marque DTC");
  const [newPrio, setNewPrio] = useState("Normale");
  const [saved, setSaved] = useState(false);
  const [filters, setFilters] = useState({
    boutique: false,
    fondateur: false,
    minAbonnes: 1000,
    maxAbonnes: 100000,
    exclureFollowed: true,
    exclureVus: false,
  });

  const handleAdd = () => {
    const h = newHandle.trim();
    if (!h) return;
    const handle = h.startsWith("@") ? h : `@${h}`;
    if (comptes.find(c => c.handle === handle)) return;
    setComptes(prev => [...prev, { handle, categorie: newCat, priorite: newPrio }]);
    setNewHandle("");
  };

  const handleRemove = (handle) => {
    setComptes(prev => prev.filter(c => c.handle !== handle));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comptes));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGenerate = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comptes));
    // Build the rapport prompt with accounts and filters
    const comptesList = comptes.map((c, i) =>
      `${i + 1}. ${c.handle} (${c.categorie} — Priorité ${c.priorite})`
    ).join("\n");

    const filtersList = [];
    if (filters.boutique) filtersList.push("- Seulement profils avec lien boutique en bio");
    if (filters.fondateur) filtersList.push("- Seulement fondateur/fondatrice/CEO en bio");
    if (filters.exclureFollowed) filtersList.push("- Exclure comptes déjà followés");
    if (filters.exclureVus) filtersList.push("- Exclure comptes vus cette semaine");
    filtersList.push(`- Minimum ${filters.minAbonnes.toLocaleString()} abonnés`);
    filtersList.push(`- Maximum ${filters.maxAbonnes.toLocaleString()} abonnés`);

    const prompt = `rapport du jour

MES COMPTES CIBLES (${comptes.length} comptes) :
${comptesList}

FILTRES ACTIFS :
${filtersList.join("\n")}

Génère le rapport complet avec 100 prospects groupés par compte source, avec scores, actions recommandées, et les unfollows J+7.`;

    onGenerate(prompt);
  };

  const pct = Math.round((comptes.length / 20) * 100);

  return (
    <div style={{ padding: "24px 32px", maxWidth: "800px" }}>

      {/* Header stats */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#1A1A1A" }}>Mes 20 comptes cibles</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>Nova puise dans leurs abonnés pour trouver vos 100 prospects/jour</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "#059669" }}>{comptes.length}<span style={{ fontSize: "14px", color: "#AAA", fontWeight: 400 }}>/20</span></div>
          <div style={{ fontSize: "11px", color: "#888" }}>comptes configurés</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: "4px", background: "#F0F0F0", borderRadius: "2px", marginBottom: "20px", overflow: "hidden" }}>
        <div style={{ height: "100%", background: comptes.length >= 20 ? "#059669" : "#D1FAE5", borderRadius: "2px", width: `${pct}%`, transition: "width 300ms" }} />
      </div>

      {/* Add form */}
      <div style={{ background: "#F9F9F9", borderRadius: "12px", padding: "16px", marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 160px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Handle Instagram</div>
          <input
            value={newHandle}
            onChange={e => setNewHandle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="@shopify_fr"
            style={{
              width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px",
              padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit",
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#059669"}
            onBlur={e => e.currentTarget.style.borderColor = "#E0E0E0"}
          />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Catégorie</div>
          <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{
            width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px",
            padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", cursor: "pointer",
          }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 120px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Priorité</div>
          <select value={newPrio} onChange={e => setNewPrio(e.target.value)} style={{
            width: "100%", background: "#FFF", border: "1px solid #E0E0E0", borderRadius: "8px",
            padding: "8px 12px", fontSize: "13px", outline: "none", fontFamily: "inherit", cursor: "pointer",
          }}>
            <option>Haute</option>
            <option>Normale</option>
          </select>
        </div>
        <button onClick={handleAdd} disabled={!newHandle.trim() || comptes.length >= 20} style={{
          background: comptes.length >= 20 ? "#CCC" : "#000", color: "white", border: "none",
          borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600,
          cursor: comptes.length >= 20 ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
        }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Comptes list */}
      <div style={{ background: "#FFF", border: "1px solid #F0F0F0", borderRadius: "12px", overflow: "hidden", marginBottom: "16px" }}>
        {comptes.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#888", fontSize: "13px" }}>
            Aucun compte cible — ajoutez-en jusqu'à 20
          </div>
        ) : (
          comptes.map((c, i) => (
            <div key={c.handle} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px 16px", borderBottom: i < comptes.length - 1 ? "1px solid #F5F5F5" : "none",
            }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: "#D1FAE5", color: "#059669",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</div>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#1A1A1A", flex: "0 0 180px" }}>{c.handle}</div>
              <div style={{ flex: 1, display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ background: "#F5F5F5", borderRadius: "99px", padding: "2px 10px", fontSize: "11px", color: "#666" }}>{c.categorie}</span>
                <span style={{
                  background: c.priorite === "Haute" ? "#FEF3C7" : "#F5F5F5",
                  color: c.priorite === "Haute" ? "#D97706" : "#888",
                  borderRadius: "99px", padding: "2px 10px", fontSize: "11px",
                  display: "flex", alignItems: "center", gap: "3px",
                }}>
                  {c.priorite === "Haute" && <Star size={9} fill="currentColor" />}
                  {c.priorite}
                </span>
              </div>
              <button onClick={() => handleRemove(c.handle)} style={{
                background: "none", border: "none", cursor: "pointer", color: "#CCC", padding: "4px",
              }}
                onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#CCC"}
              ><Trash2 size={14} /></button>
            </div>
          ))
        )}
      </div>

      {/* Save button */}
      <button onClick={handleSave} style={{
        background: saved ? "#059669" : "#F5F5F5",
        color: saved ? "white" : "#1A1A1A",
        border: "none", borderRadius: "8px", padding: "10px 20px",
        fontSize: "13px", fontWeight: 600, cursor: "pointer",
        display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px",
      }}>
        <Save size={14} />{saved ? "✓ Comptes sauvegardés" : "Sauvegarder mes comptes cibles"}
      </button>

      {/* Separator */}
      <div style={{ height: "1px", background: "#F0F0F0", margin: "0 0 24px" }} />

      {/* Filters */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", marginBottom: "14px" }}>Filtres prospects</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { key: "boutique", label: "Seulement avec lien boutique en bio" },
            { key: "fondateur", label: 'Seulement avec "fondateur / fondatrice / CEO" en bio' },
            { key: "exclureFollowed", label: "Exclure les comptes déjà followés" },
            { key: "exclureVus", label: "Exclure les comptes déjà vus cette semaine" },
          ].map(f => (
            <label key={f.key} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" checked={filters[f.key]} onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.checked }))}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#059669" }}
              />
              <span style={{ fontSize: "13px", color: "#444" }}>{f.label}</span>
            </label>
          ))}

          {/* Range sliders */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "4px" }}>
            <div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
                Minimum abonnés : <strong style={{ color: "#1A1A1A" }}>{filters.minAbonnes.toLocaleString()}</strong>
              </div>
              <input type="range" min={1000} max={50000} step={1000}
                value={filters.minAbonnes}
                onChange={e => setFilters(prev => ({ ...prev, minAbonnes: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#059669" }}
              />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
                Maximum abonnés : <strong style={{ color: "#1A1A1A" }}>{filters.maxAbonnes.toLocaleString()}</strong>
              </div>
              <input type="range" min={10000} max={500000} step={5000}
                value={filters.maxAbonnes}
                onChange={e => setFilters(prev => ({ ...prev, maxAbonnes: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#059669" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plan Crescendo info */}
      <div style={{ background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "12px", padding: "16px 18px", marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Plan Crescendo — Quotas du jour</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
          {[
            { sem: "S1", f: 20, l: 40, s: 20 },
            { sem: "S2", f: 25, l: 50, s: 25 },
            { sem: "S3", f: 30, l: 60, s: 30 },
            { sem: "S4", f: 35, l: 70, s: 35 },
            { sem: "S5+", f: 40, l: 80, s: 40 },
          ].map((q, i) => (
            <div key={i} style={{ background: i === 2 ? "#059669" : "rgba(5,150,105,0.08)", borderRadius: "8px", padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: i === 2 ? "white" : "#059669", marginBottom: "4px" }}>{q.sem}</div>
              <div style={{ fontSize: "10px", color: i === 2 ? "rgba(255,255,255,0.8)" : "#666", lineHeight: "1.6" }}>
                {q.f} follows<br />{q.l} likes<br />{q.s} stories
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "10px", fontSize: "11px", color: "#D97706", display: "flex", alignItems: "center", gap: "5px" }}>
          ⚠️ Exécution manuelle recommandée pour protéger votre compte Instagram
        </div>
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={comptes.length === 0} style={{
        background: comptes.length === 0 ? "#CCC" : "#059669",
        color: "white", border: "none", borderRadius: "10px",
        padding: "14px 24px", fontSize: "14px", fontWeight: 700,
        cursor: comptes.length === 0 ? "not-allowed" : "pointer",
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      }}>
        📊 Générer mes 100 prospects du jour
      </button>
    </div>
  );
}
