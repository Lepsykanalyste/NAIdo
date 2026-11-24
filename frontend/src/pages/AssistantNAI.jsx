// NAIdo - Assistant IA : meme mise en page que l'assistant LEINAD (indicateurs + graphiques a gauche, conversation a droite).
// Les reponses sont calculees sur le serveur NAIdo, a partir des seules donnees auxquelles la personne a acces.
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API = '/api';
// Couleurs de NAI (logo et site nai-ci.com) : bleu principal, rouge d'accent, bleu marine pour les titres
const VERT = '#1e73be';          // bleu NAI (boutons, courbe, barres)
const VERT_FONCE = '#011627';    // bleu marine NAI (titres, textes forts)
const ROUGE = '#d94948';         // rouge NAI (second axe, alertes)
const PERIODES = [
  { id: 'month', label: 'Ce mois' },
  { id: 'last_month', label: 'Mois précédent' },
  { id: 'days30', label: '30 jours' },
  { id: 'year', label: 'Année' },
];
const SUGGESTIONS_DEFAUT = ['CA du mois', 'Achats du mois', 'Combien de bons à envoyer ?', 'Graphique des ventes du mois', 'Mes droits'];
const MESSAGE_ACCUEIL = { role: 'assistant', content: "Bonjour. Je peux répondre sur votre activité : chiffre d'affaires, achats, ventes, graphiques. Précisez une période si vous voulez, par exemple « en février 2026 »." };
const fcfa = (n) => (n === null || n === undefined ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '));

function Graphique({ graph }) {
  const max = Math.max(1, ...graph.values);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{graph.title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {graph.values.map((v, k) => (
          <div key={k} title={`${graph.labels[k]} : ${fcfa(v)} FCFA`}
            style={{ flex: '1 0 12px', minWidth: 12, background: VERT, borderRadius: '3px 3px 0 0', height: `${Math.max(2, (v / max) * 130)}px` }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', fontSize: 9, color: '#6b7280', marginTop: 3 }}>
        {graph.labels.map((l, k) => <div key={k} style={{ flex: '1 0 12px', minWidth: 12, textAlign: 'center' }}>{l}</div>)}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>Total : {fcfa(graph.total)} FCFA</div>
    </div>
  );
}

const COULEURS = [VERT, ROUGE, VERT_FONCE, '#f59e0b', '#0d9488', '#7c3aed'];

// Courbe d'evolution (SVG) : ligne, zone colorée, axe des valeurs et des dates, comme le graphique LEINAD
function Courbe({ graph }) {
  const W = 640, H = 230, PG = 58, PD = 14, PH = 16, PB = 28;
  const max0 = Math.max(1, ...graph.values, ...(graph.encaisse || [0]));
  const pas = Math.pow(10, Math.floor(Math.log10(max0)));
  const max = Math.ceil(max0 / pas) * pas;
  const n = graph.values.length;
  const x = (i) => (n <= 1 ? (PG + W - PD) / 2 : PG + (i * (W - PG - PD)) / (n - 1));
  const y = (v) => H - PB - (v / max) * (H - PB - PH);
  const pts = graph.values.map((v, i) => [x(i), y(v)]);
  const ligne = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  const zone = `${ligne} L${x(n - 1).toFixed(1)},${H - PB} L${x(0).toFixed(1)},${H - PB} Z`;
  // Deuxieme courbe : montants encaisses (pointillés rouges), comme la courbe des avoirs de LEINAD
  const ligneE = graph.encaisse
    ? graph.encaisse.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    : null;
  const pasX = Math.ceil(n / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={graph.title}>
      <defs>
        <linearGradient id="zoneNAI" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={VERT} stopOpacity="0.28" />
          <stop offset="100%" stopColor={VERT} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={PG} x2={W - PD} y1={y(max * f)} y2={y(max * f)} stroke="#eef2f6" />
          <text x={PG - 6} y={y(max * f) + 3} fontSize="10" fill="#6b7280" textAnchor="end">{fcfa(max * f)}</text>
        </g>
      ))}
      <path d={zone} fill="url(#zoneNAI)" />
      <path d={ligne} fill="none" stroke={VERT} strokeWidth="2.5" strokeLinejoin="round" />
      {ligneE && <path d={ligneE} fill="none" stroke={ROUGE} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />}
      {pts.map(([a, b], i) => (
        <circle key={i} cx={a} cy={b} r="3.2" fill="#fff" stroke={VERT} strokeWidth="2">
          <title>{`${graph.labels[i]} : ${fcfa(graph.values[i])} FCFA`}</title>
        </circle>
      ))}
      {graph.labels.map((l, i) => (i % pasX === 0 ? (
        <text key={i} x={x(i)} y={H - 8} fontSize="10" fill="#6b7280" textAnchor="middle">{l}</text>
      ) : null))}
      <g transform={`translate(${PG},4)`}>
        <rect width="10" height="10" rx="2" fill={VERT} />
        <text x="16" y="9" fontSize="10" fill="#374151">Ventes (TTC)</text>
        {graph.encaisse && (<g transform="translate(110,0)">
          <rect width="10" height="10" rx="2" fill={ROUGE} />
          <text x="16" y="9" fontSize="10" fill="#374151">Encaissé</text>
        </g>)}
      </g>
    </svg>
  );
}

// Barres horizontales : produits les plus vendus
function BarresH({ items }) {
  const max = Math.max(1, ...items.map((i) => i.valeur));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{it.nom}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fcfa(it.valeur)}</span>
          </div>
          <div style={{ background: '#f3f4f6', borderRadius: 6, height: 8, marginTop: 3 }}>
            <div style={{ width: `${(it.valeur / max) * 100}%`, background: COULEURS[i % COULEURS.length], height: 8, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Anneau : modes de paiement
function Anneau({ items }) {
  const total = items.reduce((a, b) => a + b.valeur, 0) || 1;
  let cumul = 0;
  const R = 40, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 100 100" width="120" height="120" role="img" aria-label="Modes de paiement">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {items.map((it, i) => {
          const longueur = (it.valeur / total) * C;
          const decalage = -(cumul / total) * C;
          cumul += it.valeur;
          return (
            <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={COULEURS[i % COULEURS.length]} strokeWidth="14"
              strokeDasharray={`${longueur} ${C - longueur}`} strokeDashoffset={decalage} transform="rotate(-90 50 50)" />
          );
        })}
      </svg>
      <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COULEURS[i % COULEURS.length] }} />
            <span>{it.nom}</span>
            <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{Math.round((it.valeur / total) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Carte({ titre, valeur, sous }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{titre}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{valeur}</div>
      {sous && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sous}</div>}
    </div>
  );
}

export default function AssistantNAI() {
  const [periode, setPeriode] = useState('month');
  const [kpis, setKpis] = useState(null);
  const [messages, setMessages] = useState([MESSAGE_ACCUEIL]);
  const [suggestions, setSuggestions] = useState(SUGGESTIONS_DEFAUT);
  const [saisie, setSaisie] = useState('');
  const [attente, setAttente] = useState(false);
  const [historique, setHistorique] = useState(() => {
    try { return JSON.parse(localStorage.getItem('naido_assistant_questions') || '[]'); } catch { return []; }
  });
  const [afficherHistorique, setAfficherHistorique] = useState(false);
  const fin = useRef(null);

  useEffect(() => {
    axios.get(`${API}/assistant/kpis`, { params: { p: periode } }).then(({ data }) => setKpis(data)).catch(() => setKpis(null));
  }, [periode]);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, attente]);

  const memoriser = (q) => {
    const liste = [q, ...historique.filter((x) => x !== q)].slice(0, 20);
    setHistorique(liste);
    try { localStorage.setItem('naido_assistant_questions', JSON.stringify(liste)); } catch { /* navigation privee */ }
  };

  const envoyer = async (texte) => {
    const question = (texte ?? saisie).trim();
    if (!question || attente) return;
    setSaisie('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setAttente(true);
    memoriser(question);
    try {
      const { data } = await axios.post(`${API}/assistant/ask`, { question });
      setMessages((m) => [...m, { role: 'assistant', content: data.text, graph: data.graph || null }]);
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Erreur : ${e.response?.data?.error || e.message}` }]);
    } finally {
      setAttente(false);
    }
  };

  const nouvelle = () => setMessages([MESSAGE_ACCUEIL]);

  // Export PDF du rapport (memes droits que le panneau), telecharge avec le jeton de connexion
  const exporter = async () => {
    try {
      const { data, headers } = await axios.get(`${API}/assistant/export`, { params: { p: periode }, responseType: 'blob' });
      const nom = /filename="([^"]+)"/.exec(headers['content-disposition'] || '')?.[1] || 'rapport-activite.pdf';
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = nom;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Export impossible : ${e.response?.data?.error || e.message}` }]);
    }
  };

  const k = kpis || {};
  const sansAcces = <span style={{ fontSize: 12, color: '#9ca3af' }}>Accès limité</span>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }} className="assistant-nai">
      <style>{`@media (max-width: 900px) { .assistant-nai { grid-template-columns: 1fr !important; } }`}</style>

      {/* ---------- Gauche : periode, indicateurs, graphique ---------- */}
      <section>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Période :</span>
          {PERIODES.map((p) => (
            <button key={p.id} onClick={() => setPeriode(p.id)} aria-pressed={periode === p.id}
              style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 12,
                background: periode === p.id ? VERT : '#fff', color: periode === p.id ? '#fff' : '#374151' }}>
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
          <Carte titre="Chiffre d'affaires" valeur={k.ca === undefined || k.ca === null ? sansAcces : `${fcfa(k.ca)} FCFA`} sous={k.periode} />
          <Carte titre="Ventes" valeur={k.ventes === undefined || k.ventes === null ? sansAcces : k.ventes} />
          <Carte titre="Achats (TTC)" valeur={k.achats === undefined || k.achats === null ? sansAcces : `${fcfa(k.achats)} FCFA`} />
          <Carte titre="Commandes d'achat" valeur={k.commandes === undefined || k.commandes === null ? sansAcces : k.commandes} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Évolution des ventes et des encaissements</div>
          {k.graph ? <Courbe graph={k.graph} /> : <div style={{ fontSize: 13, color: '#9ca3af', padding: '40px 0', textAlign: 'center' }}>Aucune donnée accessible pour cette période.</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Produits les plus vendus</div>
            {k.produits === null || k.produits === undefined
              ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Accès limité</div>
              : k.produits.length ? <BarresH items={k.produits} /> : <div style={{ fontSize: 12, color: '#9ca3af' }}>Aucune vente sur la période.</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Modes de paiement</div>
            {k.paiements === null || k.paiements === undefined
              ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Accès limité</div>
              : k.paiements.length ? <Anneau items={k.paiements} /> : <div style={{ fontSize: 12, color: '#9ca3af' }}>Aucune vente sur la période.</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Statut des ventes</div>
            {k.statuts === null || k.statuts === undefined
              ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Accès limité</div>
              : k.statuts.length ? <BarresH items={k.statuts} /> : <div style={{ fontSize: 12, color: '#9ca3af' }}>Aucune vente sur la période.</div>}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Points clés de la période</div>
          {k.points === null || k.points === undefined
            ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Accès limité</div>
            : <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>{k.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
          </div>
        </div>
      </section>

      {/* ---------- Droite : conversation ---------- */}
      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, display: 'flex', flexDirection: 'column', minHeight: 560, overflow: 'hidden' }}>
        <header style={{ padding: 14, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo-nai.jpg" alt="NAI" style={{ height: 38, width: 'auto', borderRadius: 4 }} />
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: VERT_FONCE }}>Assistant IA</h1>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>Calculé sur votre serveur, à partir des données de votre entreprise uniquement.</p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <button onClick={() => setAfficherHistorique((v) => !v)} style={chip}>Historique</button>
            <button onClick={exporter} style={chip}>Exporter</button>
            <button onClick={nouvelle} style={chip}>Nouvelle conversation</button>
          </div>
        </header>

        {afficherHistorique && (
          <div style={{ padding: 12, borderBottom: '1px solid #f3f4f6', background: '#f9fafb', fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Historique des questions</div>
            {historique.length === 0 && <div style={{ color: '#9ca3af' }}>Aucune question pour l'instant.</div>}
            {historique.map((q, i) => (
              <button key={i} onClick={() => { setAfficherHistorique(false); envoyer(q); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: VERT_FONCE }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <main style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && <div style={{ width: 26, height: 26, borderRadius: '50%', background: VERT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>N</div>}
              <div style={{ maxWidth: '82%', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-line',
                background: m.role === 'user' ? VERT : '#f9fafb', color: m.role === 'user' ? '#fff' : '#111827', border: m.role === 'user' ? 'none' : '1px solid #e5e7eb' }}>
                {m.content}
                {m.graph && <Graphique graph={m.graph} />}
              </div>
            </div>
          ))}
          {attente && <div style={{ fontSize: 12, color: '#9ca3af' }}>Calcul en cours…</div>}
          <div ref={fin} />
        </main>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 14px', borderTop: '1px solid #f3f4f6' }}>
          {suggestions.map((s) => (
            <button key={s} onClick={() => envoyer(s)} style={{ ...chip, whiteSpace: 'nowrap', flexShrink: 0 }}>{s}</button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); envoyer(); }} autoComplete="off"
          style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e5e7eb', alignItems: 'center' }}>
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} maxLength={300}
            placeholder="Posez une question sur votre activité…" aria-label="Question"
            style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }} />
          <button type="submit" aria-label="Envoyer" disabled={attente || !saisie.trim()}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: VERT, color: '#fff', cursor: 'pointer', opacity: attente || !saisie.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </form>
      </section>
    </div>
  );
}

const chip = { padding: '6px 12px', borderRadius: 999, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#374151' };
