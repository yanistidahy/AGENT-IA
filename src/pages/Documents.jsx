import { useState } from "react";
import { Search, Plus, FolderPlus, Home, SortDesc, Upload } from "lucide-react";

export default function Documents() {
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      {/* Header */}
      <div style={{ padding: "20px 32px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1A1A1A" }}>Documents</h1>
        <button style={{
          background: "#000", color: "white", border: "none", borderRadius: "8px",
          padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#222"}
          onMouseLeave={e => e.currentTarget.style.background = "#000"}
        ><Plus size={14} /> Ajouter</button>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px" }}>
          <Home size={14} color="#888" />
          <span style={{ fontSize: "13px", color: "#888" }}>Mes documents</span>
        </div>

        {/* Search + Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#AAA" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un document..."
              style={{
                width: "100%", background: "#F5F5F5", border: "none", borderRadius: "8px",
                padding: "9px 14px 9px 36px", fontSize: "13px", color: "#1A1A1A",
                outline: "none", fontFamily: "inherit",
              }}
            />
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#F5F5F5", border: "none", borderRadius: "8px",
            padding: "9px 14px", fontSize: "13px", color: "#666", cursor: "pointer",
          }}>
            <SortDesc size={14} /> Trier par date
          </button>
        </div>

        {/* Dossiers */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A1A1A" }}>Dossiers</span>
            <button style={{
              display: "flex", alignItems: "center", gap: "5px",
              background: "none", border: "1px solid #E0E0E0", borderRadius: "7px",
              padding: "5px 12px", fontSize: "12px", color: "#666", cursor: "pointer",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#999"; e.currentTarget.style.color = "#000"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E0E0E0"; e.currentTarget.style.color = "#666"; }}
            ><FolderPlus size={13} /> Nouveau dossier</button>
          </div>
          <div style={{ background: "#F5F5F5", borderRadius: "12px", padding: "24px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📁</div>
            <div style={{ fontSize: "13px", color: "#888" }}>Aucun dossier créé</div>
          </div>
        </div>

        {/* Fichiers */}
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1A1A1A", marginBottom: "12px" }}>Fichiers</div>
          {/* Dropzone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); }}
            style={{
              border: `2px dashed ${dragging ? "#000" : "#E0E0E0"}`,
              borderRadius: "12px", padding: "48px 24px",
              textAlign: "center", background: dragging ? "#F5F5F5" : "#FAFAFA",
              cursor: "pointer", transition: "all 150ms",
            }}
            onClick={() => document.getElementById("file-input").click()}
          >
            <Upload size={28} color="#CCC" style={{ marginBottom: "12px" }} />
            <div style={{ fontSize: "14px", fontWeight: 500, color: "#666", marginBottom: "6px" }}>
              Déposez vos documents ici ou cliquez pour parcourir
            </div>
            <div style={{ fontSize: "12px", color: "#AAA" }}>Taille maximale : 25 Mo par fichier</div>
            <input id="file-input" type="file" multiple style={{ display: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
