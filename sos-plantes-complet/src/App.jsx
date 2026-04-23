import { useState, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `Tu es SOS Plantes, le meilleur expert botaniste et phytopathologiste francophone. Tu réponds toujours en français avec chaleur et précision.

Quand on te montre une photo de plante, tu fournis une analyse COMPLÈTE structurée ainsi :

🌿 IDENTIFICATION
- Nom commun et nom scientifique
- Famille botanique
- Origine géographique

🩺 DIAGNOSTIC SANTÉ
- État général (Excellent / Bon / Moyen / Critique)
- Problèmes détectés (maladies, parasites, carences, stress hydrique, etc.)
- Cause probable

💊 TRAITEMENT RECOMMANDÉ
- Actions immédiates (si urgence)
- Traitement naturel possible
- Produit du commerce recommandé (nom précis, ex: "Bouillie bordelaise", "Pyrèthre naturel", etc.)

🌱 CONSEILS D'ENTRETIEN PERSONNALISÉS
- Arrosage (fréquence, quantité)
- Lumière (exposition idéale)
- Sol et rempotage
- Saison et période de floraison

⚠️ POINTS DE VIGILANCE
- Ce qu'il faut surveiller
- Erreurs courantes à éviter

Sois précis, chaleureux, et termine toujours par un encouragement. Si la plante est en bonne santé, félicite l'utilisateur !`;

const BETA_CODE = "SOSPLANTES2024";

const LoadingPulse = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "2rem 0" }}>
    <div style={{ position: "relative", width: 64, height: 64 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "2px solid #22c55e",
          animation: `ping 1.5s ease-out ${i * 0.4}s infinite`,
          opacity: 0
        }} />
      ))}
      <div style={{ position: "absolute", inset: "16px", borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
    </div>
    <p style={{ fontSize: 14, color: "#6b7280", fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Analyse en cours…</p>
  </div>
);

const parseResult = (text) => {
  const sections = [];
  const lines = text.split('\n');
  let current = null;

  const sectionHeaders = {
    'IDENTIFICATION': { icon: '🌿', color: '#16a34a', bg: '#f0fdf4' },
    'DIAGNOSTIC': { icon: '🩺', color: '#0369a1', bg: '#f0f9ff' },
    'TRAITEMENT': { icon: '💊', color: '#9333ea', bg: '#faf5ff' },
    'ENTRETIEN': { icon: '🌱', color: '#d97706', bg: '#fffbeb' },
    'VIGILANCE': { icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let matched = false;
    for (const [key, meta] of Object.entries(sectionHeaders)) {
      if (trimmed.toUpperCase().includes(key)) {
        if (current) sections.push(current);
        current = { title: trimmed.replace(/[🌿🩺💊🌱⚠️]/g, '').trim(), ...meta, items: [] };
        matched = true;
        break;
      }
    }
    if (!matched && current) {
      const cleaned = trimmed.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '');
      if (cleaned) current.items.push(cleaned);
    }
  });

  if (current) sections.push(current);
  return sections.length > 0 ? sections : null;
};

const ResultSection = ({ section }) => (
  <div style={{
    background: section.bg, borderRadius: 16,
    padding: "1rem 1.25rem", marginBottom: 12,
    borderLeft: `4px solid ${section.color}`,
    animation: "fadeUp 0.4s ease both"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 20 }}>{section.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: section.color, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
        {section.title.replace(/[🌿🩺💊🌱⚠️]/g, '').trim()}
      </span>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {section.items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: section.color, marginTop: 2, flexShrink: 0, fontSize: 12 }}>▸</span>
          <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{item}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function SOSPlantes() {
  const [screen, setScreen] = useState("home"); // home | beta | app
  const [betaInput, setBetaInput] = useState("");
  const [betaError, setBetaError] = useState(false);
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [result, setResult] = useState(null);
  const [rawResult, setRawResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setResult(null);
    setRawResult(null);
    setError(null);
    setAnalyzed(false);
    setImageMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  }, []);

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(t => t.stop());
      cameraInputRef.current?.click();
    } catch {
      // Camera blocked in sandbox — fallback to file picker
      fileInputRef.current?.click();
    }
  }, []);

  const analyze = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRawResult(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: imageMime, data: imageBase64 } },
              { type: "text", text: "Analyse complète de cette plante s'il te plaît." }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const parsed = parseResult(text);
      setRawResult(text);
      setResult(parsed);
      setAnalyzed(true);
    } catch (err) {
      setError("Une erreur est survenue. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setImageBase64(null);
    setResult(null);
    setRawResult(null);
    setError(null);
    setAnalyzed(false);
  };

  const validateBeta = () => {
    if (betaInput.trim().toUpperCase() === BETA_CODE) {
      setScreen("app");
      setBetaError(false);
    } else {
      setBetaError(true);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f9fafb; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ping {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .app-shell {
          min-height: 100vh;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          background: white;
          box-shadow: 0 0 40px rgba(0,0,0,0.08);
          position: relative;
        }

        .top-bar {
          background: #14532d;
          padding: 1rem 1.25rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .logo-wrap { display: flex; align-items: center; gap: 10px; }
        .logo-sos {
          background: #ef4444;
          color: white;
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 16px;
          padding: 4px 10px;
          border-radius: 8px;
          letter-spacing: 1px;
        }
        .logo-name {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.5px;
        }
        .beta-badge {
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.9);
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 20px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
        }

        .content { flex: 1; padding: 1.25rem; overflow-y: auto; }

        /* HOME SCREEN */
        .home-hero {
          background: linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%);
          border-radius: 20px;
          padding: 2rem 1.5rem;
          text-align: center;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
          animation: fadeUp 0.5s ease both;
        }
        .home-hero::before {
          content: '';
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
        }
        .hero-icon { font-size: 3.5rem; margin-bottom: 1rem; display: block; }
        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.75rem;
          font-weight: 800;
          color: white;
          line-height: 1.1;
          margin-bottom: 0.5rem;
        }
        .hero-sub {
          font-size: 14px;
          color: rgba(255,255,255,0.75);
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        .hero-btn {
          display: inline-block;
          background: white;
          color: #14532d;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          font-size: 15px;
          padding: 0.875rem 2rem;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s;
          animation: pulse 2.5s ease infinite;
        }
        .hero-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }

        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 1.5rem;
          animation: fadeUp 0.5s ease 0.1s both;
        }
        .feature-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 1rem;
          text-align: center;
        }
        .feature-icon { font-size: 1.6rem; margin-bottom: 6px; display: block; }
        .feature-title { font-size: 12px; font-weight: 600; color: #111827; font-family: 'DM Sans', sans-serif; margin-bottom: 3px; }
        .feature-desc { font-size: 11px; color: #9ca3af; font-family: 'DM Sans', sans-serif; line-height: 1.4; }

        .beta-card {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 14px;
          padding: 1rem 1.25rem;
          animation: fadeUp 0.5s ease 0.2s both;
        }
        .beta-title { font-size: 13px; font-weight: 600; color: #92400e; font-family: 'DM Sans', sans-serif; margin-bottom: 4px; }
        .beta-desc { font-size: 12px; color: #b45309; font-family: 'DM Sans', sans-serif; }

        /* BETA SCREEN */
        .beta-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; text-align: center; }
        .beta-lock { font-size: 3rem; margin-bottom: 1.5rem; animation: fadeUp 0.4s ease both; }
        .beta-heading {
          font-family: 'Syne', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 0.5rem;
          animation: fadeUp 0.4s ease 0.1s both;
        }
        .beta-text {
          font-size: 14px;
          color: #6b7280;
          font-family: 'DM Sans', sans-serif;
          margin-bottom: 2rem;
          animation: fadeUp 0.4s ease 0.15s both;
        }
        .code-input-wrap { width: 100%; max-width: 320px; animation: fadeUp 0.4s ease 0.2s both; }
        .code-input {
          width: 100%;
          padding: 1rem;
          border-radius: 14px;
          border: 2px solid #e5e7eb;
          font-size: 18px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          text-align: center;
          letter-spacing: 3px;
          color: #111827;
          outline: none;
          margin-bottom: 12px;
          transition: border-color 0.2s;
        }
        .code-input:focus { border-color: #22c55e; }
        .code-input.error { border-color: #ef4444; }
        .code-submit {
          width: 100%;
          padding: 1rem;
          background: #14532d;
          color: white;
          border: none;
          border-radius: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .code-submit:hover { background: #166534; transform: translateY(-1px); }
        .code-error { font-size: 13px; color: #ef4444; font-family: 'DM Sans', sans-serif; margin-top: 8px; }
        .beta-hint { font-size: 12px; color: #d1d5db; font-family: 'DM Sans', sans-serif; margin-top: 1.5rem; }

        /* APP SCREEN */
        .drop-zone {
          border: 2px dashed #d1fae5;
          border-radius: 20px;
          padding: 2.5rem 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s;
          background: #f9fafb;
          margin-bottom: 1rem;
          animation: fadeUp 0.4s ease both;
        }
        .drop-zone:hover, .drop-zone.over {
          border-color: #22c55e;
          background: #f0fdf4;
        }
        .drop-icon { font-size: 3rem; margin-bottom: 0.75rem; display: block; }
        .drop-title { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 700; color: #111827; margin-bottom: 4px; }
        .drop-sub { font-size: 13px; color: #9ca3af; font-family: 'DM Sans', sans-serif; }

        .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1rem; animation: fadeUp 0.4s ease 0.05s both; }
        .action-btn {
          padding: 0.875rem;
          border-radius: 14px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .btn-camera { background: #14532d; color: white; }
        .btn-camera:hover { background: #166534; transform: translateY(-1px); }
        .btn-gallery { background: #f3f4f6; color: #374151; }
        .btn-gallery:hover { background: #e5e7eb; transform: translateY(-1px); }

        .preview-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 1rem;
          animation: fadeUp 0.4s ease both;
          background: #111827;
        }
        .preview-img { width: 100%; max-height: 280px; object-fit: cover; display: block; }
        .preview-overlay {
          position: absolute;
          top: 10px; right: 10px;
          display: flex;
          gap: 8px;
        }
        .preview-btn {
          background: rgba(255,255,255,0.95);
          border: none;
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          color: #374151;
          transition: all 0.2s;
        }
        .preview-btn:hover { background: white; }

        .analyze-btn {
          width: 100%;
          padding: 1.125rem;
          background: linear-gradient(135deg, #16a34a, #14532d);
          color: white;
          border: none;
          border-radius: 16px;
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s;
          margin-bottom: 1rem;
          letter-spacing: 0.02em;
          animation: fadeUp 0.4s ease 0.1s both;
        }
        .analyze-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(20,83,45,0.4); }
        .analyze-btn:disabled { background: #d1d5db; cursor: not-allowed; }

        .result-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .result-dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; animation: pulse 2s ease infinite; flex-shrink: 0; }
        .result-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #111827; }

        .new-btn {
          width: 100%;
          padding: 0.875rem;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 1rem;
          transition: all 0.2s;
        }
        .new-btn:hover { background: #e5e7eb; }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 14px;
          padding: 1rem;
          font-size: 13px;
          color: #dc2626;
          font-family: 'DM Sans', sans-serif;
          margin-bottom: 1rem;
        }

        .raw-result {
          background: #f9fafb;
          border-radius: 14px;
          padding: 1rem;
          font-size: 13px;
          color: #374151;
          font-family: 'DM Sans', sans-serif;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .bottom-nav {
          background: white;
          border-top: 1px solid #e5e7eb;
          padding: 0.875rem 1.25rem;
          display: flex;
          justify-content: space-around;
          position: sticky;
          bottom: 0;
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        .nav-item.active { opacity: 1; }
        .nav-icon { font-size: 20px; }
        .nav-label { font-size: 10px; font-family: 'DM Sans', sans-serif; font-weight: 500; color: #14532d; }
      `}</style>

      <div className="app-shell">
        {/* TOP BAR */}
        <div className="top-bar">
          <div className="logo-wrap">
            <span className="logo-sos">SOS</span>
            <span className="logo-name">Plantes</span>
          </div>
          {screen === "app" && <span className="beta-badge">🧪 Bêta gratuite</span>}
        </div>

        {/* HOME SCREEN */}
        {screen === "home" && (
          <div className="content">
            <div className="home-hero">
              <span className="hero-icon">🌿</span>
              <h1 className="hero-title">Votre plante<br />a besoin d'aide ?</h1>
              <p className="hero-sub">Photographiez-la et obtenez un diagnostic complet en quelques secondes grâce à l'IA.</p>
              <button className="hero-btn" onClick={() => setScreen("beta")}>
                🚀 Accéder à la bêta gratuite
              </button>
            </div>

            <div className="features-grid">
              {[
                { icon: "🔬", title: "Identification", desc: "+10 000 espèces reconnues" },
                { icon: "🩺", title: "Diagnostic", desc: "Maladies, parasites, carences" },
                { icon: "💊", title: "Traitement", desc: "Produits recommandés précis" },
                { icon: "🌱", title: "Entretien", desc: "Conseils personnalisés" },
              ].map((f, i) => (
                <div key={i} className="feature-card">
                  <span className="feature-icon">{f.icon}</span>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="beta-card">
              <div className="beta-title">🎁 Bêta testeur — Accès 100% gratuit</div>
              <div className="beta-desc">Vous faites partie des premiers testeurs. Toutes les fonctionnalités sont débloquées gratuitement.</div>
            </div>
          </div>
        )}

        {/* BETA CODE SCREEN */}
        {screen === "beta" && (
          <div className="content">
            <div className="beta-screen">
              <span className="beta-lock">🔐</span>
              <h2 className="beta-heading">Code bêta testeur</h2>
              <p className="beta-text">Entrez votre code d'accès reçu par email ou message pour débloquer l'application gratuitement.</p>
              <div className="code-input-wrap">
                <input
                  className={`code-input ${betaError ? "error" : ""}`}
                  value={betaInput}
                  onChange={e => { setBetaInput(e.target.value.toUpperCase()); setBetaError(false); }}
                  onKeyDown={e => e.key === "Enter" && validateBeta()}
                  placeholder="XXXXXXXX"
                  maxLength={20}
                />
                {betaError && <div className="code-error">❌ Code incorrect. Réessaie !</div>}
                <button className="code-submit" style={{ marginTop: 12 }} onClick={validateBeta}>
                  Accéder à SOS Plantes →
                </button>
                <div className="beta-hint">Code de démo : SOSPLANTES2024</div>
              </div>
            </div>
          </div>
        )}

        {/* APP SCREEN */}
        {screen === "app" && (
          <>
            <div className="content">
              {!image ? (
                <>
                  <div
                    className={`drop-zone ${dragOver ? "over" : ""}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="drop-icon">📷</span>
                    <div className="drop-title">Photographiez votre plante</div>
                    <div className="drop-sub">Glissez une photo ou appuyez pour choisir</div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                  </div>

                  <div className="action-row">
                    <button className="action-btn btn-camera" onClick={openCamera}>
                      📸 Appareil photo
                    </button>
                    <button className="action-btn btn-gallery" onClick={() => fileInputRef.current?.click()}>
                      🖼️ Galerie
                    </button>
                  </div>

                  <div style={{ background: "#f0fdf4", borderRadius: 14, padding: "0.875rem 1rem", border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: 12, color: "#15803d", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, marginBottom: 4 }}>💡 Conseil photo</div>
                    <div style={{ fontSize: 12, color: "#166534", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                      Pour un meilleur diagnostic, photographiez la feuille ou la zone problématique en gros plan, en bonne lumière.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="preview-wrap">
                    <img src={image} alt="Plante" className="preview-img" />
                    <div className="preview-overlay">
                      <button className="preview-btn" onClick={reset}>✕ Changer</button>
                    </div>
                  </div>

                  {!analyzed && (
                    <button className="analyze-btn" onClick={analyze} disabled={loading}>
                      {loading ? "⏳ Analyse en cours…" : "🔍 Lancer le diagnostic SOS"}
                    </button>
                  )}

                  {loading && <LoadingPulse />}

                  {error && <div className="error-box">⚠️ {error}</div>}

                  {result && (
                    <div style={{ animation: "fadeUp 0.4s ease both" }}>
                      <div className="result-header">
                        <div className="result-dot" />
                        <div className="result-title">Diagnostic SOS Plantes</div>
                      </div>
                      {result.map((section, i) => (
                        <ResultSection key={i} section={section} />
                      ))}
                      <button className="new-btn" onClick={reset}>
                        🌿 Analyser une autre plante
                      </button>
                    </div>
                  )}

                  {rawResult && !result && (
                    <div>
                      <div className="result-header">
                        <div className="result-dot" />
                        <div className="result-title">Diagnostic SOS Plantes</div>
                      </div>
                      <div className="raw-result">{rawResult}</div>
                      <button className="new-btn" onClick={reset}>🌿 Nouvelle analyse</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bottom-nav">
              {[
                { icon: "🏠", label: "Accueil", active: true },
                { icon: "🌿", label: "Mes plantes", active: false },
                { icon: "📖", label: "Guide", active: false },
                { icon: "⚙️", label: "Réglages", active: false },
              ].map((item, i) => (
                <div key={i} className={`nav-item ${item.active ? "active" : ""}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
