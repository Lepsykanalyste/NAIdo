// ============================================================
// NAIdo — DBM + Stock AT3 + Déclarations Production
// Fichier : frontend/src/pages/DBM_StockAT3.jsx
//
// INTÉGRATION dans ChefAtelier.jsx :
// 1. import DBM_StockAT3 from './DBM_StockAT3';
// 2. Dans MENU_PAR_ROLE chef_atelier : ajouter 'dbm','stock_at3','declarations'
// 3. Dans MENU : ajouter les items
// 4. Dans la map sections : dbm, stock_at3, declarations
// ============================================================

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import { ouvrirPdfSecurise } from '../utils/pdf';

const API = '/api';

// ─────────────────────────────────────────────────────────────
// STATUTS DBM
// ─────────────────────────────────────────────────────────────
const STATUT_DBM = {
  en_attente:    { bg:'#fef3c7', tx:'#92400e', label:'En attente' },
  approuve:      { bg:'#dbeafe', tx:'#1d4ed8', label:'Approuvé' },
  en_preparation:{ bg:'#f3e8ff', tx:'#6d28d9', label:'En transit → AT3' },
  livre:         { bg:'#dcfce7', tx:'#15803d', label:'Livré ✓' },
  partiel:       { bg:'#fef9c3', tx:'#854d0e', label:'Partiel' },
  annule:        { bg:'#fee2e2', tx:'#dc2626', label:'Annulé' },
};

const Badge = ({ statut, map }) => {
  const c = map[statut] || { bg:'#f3f4f6', tx:'#374151', label: statut };
  return (
    <span style={{ background:c.bg, color:c.tx, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
      {c.label}
    </span>
  );
};

// ══════════════════════════════════════════════════════════════
// MODULE DBM — Chef AT3 crée les demandes de besoin
// ══════════════════════════════════════════════════════════════
// Quantite en kg lisible (1 250,5) pour afficher le stock a cote de chaque matiere
const fmtKg = (v) => (parseFloat(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const TOLERANCE_COMMANDE = 0.10;   // on peut demander au plus le besoin de l'OF + 10 %
// Liste de choix des matieres : seules celles qui ont du stock au magasin, avec la quantite disponible en couleur
// (vert = le stock couvre le besoin, orange = stock inferieur au besoin, bleu = pas de besoin connu)
function ListeMatieres({ articles, selectedId, onSelect, besoin = null }) {
  const dispo = articles.filter(a => a.stock > 0);
  if (!dispo.length) return <div style={{ fontSize:11, color:'#dc2626' }}>Aucune matière en stock au magasin.</div>;
  return (
    <div style={{ maxHeight:200, overflowY:'auto', border:'2px solid #fcd34d', borderRadius:8, background:'#fff' }}>
      {dispo.map(a => {
        const choisi = String(selectedId) === String(a.id);
        const c = besoin != null
          ? (a.stock >= besoin ? { bg:'#dcfce7', tx:'#166534', bd:'#86efac' } : { bg:'#ffedd5', tx:'#9a3412', bd:'#fdba74' })
          : { bg:'#dbeafe', tx:'#1e40af', bd:'#93c5fd' };
        return (
          <div key={a.id} onClick={() => onSelect(a)}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, padding:'7px 10px', cursor:'pointer',
                     borderBottom:'1px solid #fef3c7', background: choisi ? '#fef9c3' : '#fff' }}>
            <div style={{ fontSize:12, color:'#374151', minWidth:0 }}>
              <span style={{ fontWeight:700, color:'#92400e' }}>{a.code}</span> — {a.designation}
            </div>
            <span style={{ flexShrink:0, background:c.bg, color:c.tx, border:`1px solid ${c.bd}`, borderRadius:12, padding:'2px 10px', fontSize:12, fontWeight:800 }}>
              {fmtKg(a.stock)} kg
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ModuleDBM() {
  const { user } = useAuth();
  const [dbms, setDbms]           = useState([]);
  const [ofs, setOfs]             = useState([]);
  const [ofSel, setOfSel]         = useState(null);
  const [besoins, setBesoins]     = useState([]);
  const [lignes, setLignes]       = useState([]);
  const [mps, setMps]             = useState([]);          // matieres premieres (articles) avec stock magasin
  const [ajoutArt, setAjoutArt]   = useState('');
  const [ajoutQte, setAjoutQte]   = useState('');
  const [recherche, setRecherche] = useState('');         // barre de recherche des matieres
  const [msgBesoins, setMsgBesoins] = useState('');        // '' | 'composition' | 'suffisant' | 'erreur'
  const [showForm, setShowForm]   = useState(false);
  const [urgence, setUrgence]     = useState(false);
  const [dateBesoin, setDateBesoin] = useState('');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [detail, setDetail]       = useState(null);

  const charger = async () => {
    try {
      const [d, o, m] = await Promise.all([
        axios.get(`${API}/dbm`).catch(()=>({data:[]})),
        axios.get(`${API}/at3/of`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm/stock-mp/liste`).catch(()=>({data:[]})),
      ]);
      setDbms(d.data || []);
      // Matieres premieres : une ligne par article (les stocks de plusieurs emplacements sont additionnes)
      const parArticle = {};
      (Array.isArray(m.data) ? m.data : []).forEach(a => {
        const x = parArticle[a.id] || (parArticle[a.id] = { ...a, qte_disponible: 0 });
        x.qte_disponible += parseFloat(a.qte_disponible || 0);
      });
      setMps(Object.values(parArticle));
      // Charger aussi les DBM en transit (en_preparation) pour réception
      setOfs((o.data || []).filter(o => ['planifie','assigne','en_attente','lance','en_cours'].includes(o.statut)));
    } catch { toast.error('Erreur chargement'); }
  };

  useEffect(() => { charger(); }, []);

  const selectionnerOf = async (of_id) => {
    const of = ofs.find(o => o.id === of_id);
    setOfSel(of);
    setLignes([]);
    setMsgBesoins('');
    if (!of_id) return;
    try {
      const { data } = await axios.get(`${API}/dbm/of/${of_id}/besoins`).catch(()=>({data:[]}));
      setMsgBesoins(Array.isArray(data) ? 'erreur' : (data.message ? 'composition' : (((data.besoins||[]).length && !(data.besoins||[]).some(b => b.qte_a_demander > 0)) ? 'suffisant' : '')));
      // Fusionner groupes (articles+stock mag) avec besoins (calculs AT3)
      const besoinsMap = {};
      (data.besoins || []).forEach(b => { besoinsMap[b.groupe_id] = b; });
      const groupesFusionnes = (data.groupes || []).map(g => ({
        ...g,
        ...(besoinsMap[g.groupe_id] || {}),
      }));
      setBesoins(groupesFusionnes);
      setLignes(groupesFusionnes
        .filter(b => b.qte_a_demander > 0)
        .map(b => ({
          article_id:      null,
          groupe_id:       b.groupe_id,
          famille_id:      b.famille_id,
          code:            b.groupe_code || b.groupe_libelle,
          designation:     b.groupe_libelle,
          famille_libelle: b.groupe_libelle,
          qte_necessaire:  b.qte_necessaire,
          qte_dispo_at3:   b.qte_dispo_at3 || 0,
          qte_dispo_mag:   0,
          qte_demandee:    b.qte_a_demander,
          qte_max:         b.qte_a_demander,
          unite:           'kg',
        }))
      );
    } catch { toast.error('Erreur calcul besoins'); }
  };

  const majQte = (idx, val) => {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, qte_demandee: val } : l));
  };

  const supprimerLigne = (idx) => setLignes(prev => prev.filter((_, i) => i !== idx));

  // Ajout direct d'une matiere (article) choisie dans la liste, avec ou sans composition
  const ajouterMatiere = () => {
    const a = mps.find(x => String(x.id) === String(ajoutArt));
    const q = parseFloat(ajoutQte);
    if (!a) return toast.error('Choisissez un article');
    if (!(q > 0)) return toast.error('Indiquez une quantité supérieure à 0');
    if (erreurAjout) return toast.error(erreurAjout);
    const g = besoins.find(b => (b.articles || []).some(x => String(x.id) === String(a.id)));
    if (lignes.some(l => String(l.article_id) === String(a.id))) return toast.error('Cette matière est déjà dans la liste');
    setLignes(prev => [...prev, { article_id: a.id, groupe_id: g ? g.groupe_id : null, famille_id: g ? g.famille_id : null, code: a.code, designation: a.designation,
      famille_libelle: a.famille_libelle, qte_necessaire: g ? g.qte_necessaire : null, qte_dispo_at3: 0, qte_dispo_mag: parseFloat(a.qte_disponible || 0),
      qte_demandee: q, unite: 'kg', manuel: true }]);
    setAjoutArt(''); setAjoutQte(''); setRecherche('');
  };

  // Recherche : insensible aux accents et a la casse ; tous les mots saisis doivent se retrouver (code, designation ou famille)
  const ACCENTS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
  const normaliser = (t) => String(t || '').normalize('NFD').replace(ACCENTS, '').toLowerCase();
  const correspond = (a, r) => { const txt = normaliser(`${a.code} ${a.designation} ${a.famille_libelle}`); return normaliser(r).split(' ').filter(Boolean).every(m => txt.includes(m)); };
  const mpsDispo = mps.filter(a => a.qte_disponible > 0);
  const mpsFiltrees = mpsDispo.filter(a => correspond(a, recherche));

  // Regles de quantite : jamais plus que le stock magasin, et jamais plus que le besoin de l'OF + 10 % pour un groupe de la composition de l'article
  const plafondGroupe = (groupeId) => {
    const b = besoins.find(x => String(x.groupe_id) === String(groupeId));
    return b && b.qte_necessaire != null ? parseFloat(b.qte_necessaire) * (1 + TOLERANCE_COMMANDE) : null;
  };
  const totalGroupe = (groupeId) => lignes.reduce((s, l) => String(l.groupe_id) === String(groupeId) ? s + (parseFloat(l.qte_demandee) || 0) : s, 0);
  // Plafond global : quantite de l'OF + 10 % pour le total de TOUTES les lignes (couvre aussi les matieres ajoutees a la main, hors groupes)
  const poidsOf = ofSel ? parseFloat(ofSel.at3_poids_cible_kg || ofSel.quantite_cible || 0) : 0;
  const plafondOf = poidsOf > 0 ? poidsOf * (1 + TOLERANCE_COMMANDE) : null;
  const totalOf = () => lignes.reduce((s, l) => s + (parseFloat(l.qte_demandee) || 0), 0);
  const erreurLigne = (l) => {
    const q = parseFloat(l.qte_demandee) || 0;
    if (l.article_id && q > parseFloat(l.qte_dispo_mag || 0) + 1e-6) return `Supérieur au stock magasin : maximum ${fmtKg(l.qte_dispo_mag)} kg`;
    const p = l.groupe_id ? plafondGroupe(l.groupe_id) : null;
    if (p != null && totalGroupe(l.groupe_id) > p + 1e-6) return `Supérieur au besoin de l'OF + 10 % pour ce groupe : maximum ${fmtKg(p)} kg au total`;
    if (plafondOf != null && totalOf() > plafondOf + 1e-6) return `Supérieur à la quantité de l'OF + 10 % : maximum ${fmtKg(plafondOf)} kg au total (${fmtKg(totalOf())} kg demandés)`;
    return null;
  };
  // Controle en direct du formulaire « Ajouter une matiere »
  const aSel = mps.find(x => String(x.id) === String(ajoutArt));
  const qAjout = parseFloat(ajoutQte) || 0;
  const gSel = aSel ? besoins.find(b => (b.articles || []).some(x => String(x.id) === String(aSel.id))) : null;
  let erreurAjout = null;
  if (aSel && qAjout > parseFloat(aSel.qte_disponible || 0) + 1e-6) {
    erreurAjout = `Supérieur au stock magasin : maximum ${fmtKg(aSel.qte_disponible)} kg`;
  } else if (gSel && qAjout > 0) {
    const p = parseFloat(gSel.qte_necessaire) * (1 + TOLERANCE_COMMANDE);
    const deja = totalGroupe(gSel.groupe_id);
    if (deja + qAjout > p + 1e-6) erreurAjout = `Supérieur au besoin de l'OF + 10 % (${gSel.groupe_libelle}) : encore ${fmtKg(Math.max(0, p - deja))} kg possible`;
  }
  if (!erreurAjout && plafondOf != null && aSel && qAjout > 0 && totalOf() + qAjout > plafondOf + 1e-6) {
    erreurAjout = `Supérieur à la quantité de l'OF + 10 % : encore ${fmtKg(Math.max(0, plafondOf - totalOf()))} kg possible au total`;
  }

  const creerDbm = async () => {
    if (!ofSel) return toast.error('Sélectionnez un OF');
    if (!lignes.length) return toast.error('Aucune MP à demander');
    if (lignes.some(l => !l.article_id)) return toast.error('Choisissez la matière (MP) de chaque ligne');
    if (lignes.some(l => !(parseFloat(l.qte_demandee) > 0))) return toast.error('Indiquez une quantité supérieure à 0 pour chaque ligne');
    const idxErr = lignes.findIndex(l => erreurLigne(l));
    if (idxErr >= 0) return toast.error(`${lignes[idxErr].code || 'Ligne'} : ${erreurLigne(lignes[idxErr])}`);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/dbm`, {
        of_id: ofSel.id,
        lignes: lignes.map(l => ({
          article_id:  l.article_id,
          famille_id:  l.famille_id,
          qte_demandee: parseFloat(l.qte_demandee),
          unite: 'kg',
        })),
        urgence, date_besoin: dateBesoin || null,
        notes_demandeur: notes,
      });
      toast.success(data.message);
      setShowForm(false);
      setOfSel(null);
      setLignes([]);
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  const ouvrirDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/dbm/${id}`).catch(()=>({data:[]}));
      setDetail(data);
    } catch { toast.error('Erreur'); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#92400e' }}>
          📦 Demandes de Besoin en Matières (DBM)
        </h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={charger} style={{ background:'#fef3c7', border:'1px solid #fcd34d', color:'#92400e', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🔄</button>
          {user?.role === 'chef_atelier' && (
            <button onClick={() => setShowForm(true)}
              style={{ background:'#92400e', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
              + Nouvelle DBM
            </button>
          )}
        </div>
      </div>

      {/* ── FORMULAIRE CRÉATION DBM ── */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #fcd34d', padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:800, color:'#92400e', fontSize:15, marginBottom:16 }}>
            📦 Nouvelle Demande de Besoin en Matières
          </div>

          {/* Sélection OF */}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:700, display:'block', marginBottom:6, color:'#374151' }}>
              Ordre de Fabrication *
            </label>
            <select value={ofSel?.id || ''} onChange={e => selectionnerOf(e.target.value)}
              style={{ width:'100%', border:'2px solid #fcd34d', borderRadius:8, padding:'10px', fontSize:13 }}>
              <option value="">-- Sélectionnez l'OF --</option>
              {ofs.map(o => (
                <option key={o.id} value={o.id}>
                  {o.numero_of} — {o.article_code} {o.article_nom} ({o.at3_poids_cible_kg || o.quantite_cible} kg)
                </option>
              ))}
            </select>
            {ofs.length === 0 && (
              <div style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>
                ⚠ Aucun OF avec composition validée — validez d'abord la composition dans Flux AT3
              </div>
            )}
          </div>

          {/* Besoins calculés */}
          {besoins.length > 0 && (
            <div style={{ background:'#fffbeb', borderRadius:10, padding:14, marginBottom:16, border:'1px solid #fde68a' }}>
              <div style={{ fontWeight:700, color:'#92400e', marginBottom:10, fontSize:12 }}>
                📊 Analyse des besoins — OF {ofSel?.numero_of}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
                {besoins.map((b, i) => (
                  <div key={i} style={{
                    background: b.suffisant ? '#f0fdf4' : '#fef2f2',
                    borderRadius:8, padding:'10px 12px',
                    border: `1px solid ${b.suffisant ? '#86efac' : '#fca5a5'}`
                  }}>
                    <div style={{ fontWeight:700, fontSize:12, color:'#374151' }}>{b.code}</div>
                    <div style={{ fontSize:10, color:'#6b7280', marginBottom:6 }}>{b.famille_libelle}</div>
                    <div style={{ fontSize:11 }}>
                      Besoin : <strong>{b.qte_necessaire} kg</strong>
                    </div>
                    <div style={{ fontSize:11, color: b.qte_dispo_at3 >= b.qte_necessaire ? '#15803d' : '#d97706' }}>
                      Stock AT3 : {b.qte_dispo_at3} kg
                    </div>
                    <div style={{ fontSize:11, color: b.suffisant ? '#15803d' : '#dc2626', fontWeight:700, marginTop:4 }}>
                      {b.suffisant ? '✓ Stock suffisant' : `⚠ Manque : ${b.qte_a_demander} kg`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages d'aide quand aucune ligne n'est calculee */}
          {ofSel && msgBesoins === 'composition' && (
            <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#92400e', marginBottom:12 }}>
              ⚠ Aucune composition n'est définie pour l'article de cet OF : ajoutez les matières à la main ci-dessous (ou définissez la composition dans Articles pour un calcul automatique).
            </div>
          )}
          {ofSel && msgBesoins === 'suffisant' && (
            <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#15803d', marginBottom:12 }}>
              ✓ Le stock de l'Atelier 3 couvre déjà le besoin calculé de cet OF. Vous pouvez tout de même ajouter une matière ci-dessous.
            </div>
          )}
          {ofSel && msgBesoins === 'erreur' && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#dc2626', marginBottom:12 }}>
              ⚠ Le calcul des besoins n'a pas pu être chargé : ajoutez les matières à la main ci-dessous.
            </div>
          )}

          {/* Ajout d'une matiere (article) a la main */}
          {ofSel && (
            <div style={{ background:'#f9fafb', border:'1px dashed #fcd34d', borderRadius:10, padding:12, marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:12, color:'#92400e', marginBottom:8 }}>➕ Ajouter une matière (article) à la demande</div>
              {mpsDispo.length === 0 && <div style={{ fontSize:11, color:'#dc2626', marginBottom:6 }}>Aucune matière première disponible au magasin.</div>}
              <div style={{ marginBottom:8 }}>
                <input type="text" value={recherche} placeholder="🔍 Rechercher une matière (code, désignation, famille)…"
                  onChange={e => { const r = e.target.value; setRecherche(r); const f = mpsDispo.filter(a => correspond(a, r)); setAjoutArt(f.length === 1 ? String(f[0].id) : (f.some(a => String(a.id) === String(ajoutArt)) ? ajoutArt : '')); }}
                  style={{ width:'100%', border:'2px solid #fcd34d', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
                {recherche && (
                  <div style={{ fontSize:11, color: mpsFiltrees.length ? '#6b7280' : '#dc2626', marginTop:3 }}>
                    {mpsFiltrees.length ? `${mpsFiltrees.length} matière(s) trouvée(s)` : 'Aucune matière ne correspond à cette recherche'}
                  </div>
                )}
              </div>
              <div style={{ marginBottom:10 }}>
                <ListeMatieres articles={mpsFiltrees.map(a => ({ id:a.id, code:a.code, designation:a.designation, stock: parseFloat(a.qte_disponible || 0) }))}
                  selectedId={ajoutArt} onSelect={a => setAjoutArt(String(a.id))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr auto', gap:8, alignItems:'flex-end' }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Matière choisie</label>
                  <div style={{ border:'2px solid #fcd34d', borderRadius:8, padding:'8px', fontSize:13, background:'#fff', minHeight:20 }}>
                    {(() => { const a = mps.find(x => String(x.id) === String(ajoutArt)); return a ? `${a.code} — ${a.designation}` : <span style={{ color:'#9ca3af' }}>Cliquez sur une matière dans la liste ci-dessus</span>; })()}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Quantité (kg)</label>
                  <input type="number" min="0" step="0.1" value={ajoutQte} onChange={e => setAjoutQte(e.target.value)} placeholder="0"
                    style={{ width:'100%', border: erreurAjout ? '2px solid #dc2626' : '2px solid #fcd34d', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
                  {erreurAjout && <div style={{ color:'#dc2626', fontSize:11, fontWeight:700, marginTop:3 }}>⚠ {erreurAjout}</div>}
                </div>
                <button onClick={ajouterMatiere}
                  style={{ background:'#15803d', color:'#fff', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
                  ➕ Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Lignes à demander */}
          {lignes.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:700, color:'#374151', marginBottom:10, fontSize:13 }}>
                📋 Matières à demander au Magasin MP
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#fef3c7' }}>
                    {['MP', 'Famille', 'Besoin total', 'Stock AT3', 'Qté à demander', ''].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#92400e' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #fef3c7', background: i%2===0?'#fff':'#fffbeb' }}>
                      <td style={{ padding:'8px 10px' }}>
                        <div style={{ fontWeight:700, color:'#92400e', marginBottom:2 }}>{l.famille_libelle||l.code}</div>
                        {l.manuel ? (<div style={{ fontSize:12, color:'#374151' }}>{l.code} — {l.designation}</div>) : (l.article_id ? (
                          <div style={{ fontSize:12, color:'#374151' }}>{l.code} — {l.designation}
                            <button onClick={() => setLignes(prev => prev.map((x, j) => j !== i ? x : { ...x, article_id:'', qte_dispo_mag:0 }))}
                              style={{ marginLeft:8, background:'none', border:'none', color:'#0369a1', cursor:'pointer', fontSize:11, textDecoration:'underline' }}>changer</button>
                          </div>
                        ) : (
                          <ListeMatieres besoin={l.qte_necessaire}
                            articles={(besoins.find(b => String(b.groupe_id) === String(l.groupe_id))?.articles || []).map(a => ({ id:a.id, code:a.code, designation:a.designation, stock: parseFloat(a.stock_magasin || 0) }))}
                            selectedId={l.article_id}
                            onSelect={a => setLignes(prev => prev.map((x, j) => j !== i ? x : { ...x, article_id:a.id, code:a.code, designation:a.designation, qte_dispo_mag:a.stock }))} />
                        ))}
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'#6b7280' }}>{l.famille_libelle}</td>
                      <td style={{ padding:'8px 10px', fontWeight:600 }}>{l.qte_necessaire != null ? `${l.qte_necessaire} kg` : '—'}</td>
                      <td style={{ padding:'8px 10px', color: l.qte_dispo_at3 > 0 ? '#15803d' : '#9ca3af' }}>
                        {l.qte_dispo_at3} kg
                      </td>
                
                      <td style={{ padding:'8px 10px', width:160 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <input type="number" value={l.qte_demandee} min="0" step="0.1"
                            max={l.qte_dispo_mag||undefined}
                            onChange={e => majQte(i, e.target.value)}
                            style={{ width:80, border: erreurLigne(l) ? '2px solid #dc2626' : '2px solid #fcd34d', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                          <span style={{ fontSize:11 }}>kg</span>
                        </div>
                        {erreurLigne(l) && <div style={{ color:'#dc2626', fontSize:10, fontWeight:700, marginTop:3, maxWidth:210 }}>⚠ {erreurLigne(l)}</div>}
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        <div style={{display:'flex',gap:4}}>
                        <button onClick={() => setLignes(prev=>[...prev.slice(0,i+1),{...prev[i],article_id:'',code:'',designation:'',qte_dispo_mag:0},...prev.slice(i+1)])}
                          style={{ background:'#dcfce7', color:'#15803d', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>+</button>
                        <button onClick={() => supprimerLigne(i)}
                          style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {besoins.length > 0 && lignes.length === 0 && (
            <div style={{ background:'#dcfce7', borderRadius:8, padding:12, marginBottom:16, fontSize:13, color:'#15803d', fontWeight:600 }}>
              ✓ Stock AT3 suffisant pour toutes les MP — aucune commande nécessaire
            </div>
          )}

          {/* Options */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Date de besoin</label>
              <input type="date" value={dateBesoin} onChange={e => setDateBesoin(e.target.value)}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
              <input type="checkbox" id="urgence" checked={urgence} onChange={e => setUrgence(e.target.checked)}
                style={{ width:16, height:16, cursor:'pointer' }} />
              <label htmlFor="urgence" style={{ fontSize:13, fontWeight:700, color:'#dc2626', cursor:'pointer' }}>
                🚨 URGENT
              </label>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Notes pour le magasin</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={creerDbm} disabled={loading || !ofSel || lignes.length === 0}
              style={{ background: ofSel && lignes.length ? '#92400e' : '#9ca3af', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              {loading ? '...' : '📤 Envoyer au Magasin MP'}
            </button>
            <button onClick={() => { setShowForm(false); setOfSel(null); setLignes([]); setBesoins([]); }}
              style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── DÉTAIL DBM ── */}
      {detail && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #fcd34d', padding:20, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#92400e', fontFamily:'monospace' }}>{detail.numero_dbm}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>OF : {detail.numero_of} | Par : {detail.demandeur_nom}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <Badge statut={detail.statut} map={STATUT_DBM} />
              {detail.urgence && <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>🚨 URGENT</span>}
              <button onClick={() => setDetail(null)} style={{ background:'#f3f4f6', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕</button>
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#fef3c7' }}>
                {['MP', 'Famille', 'Demandé', 'Livré', 'Restant'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#92400e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.lignes || []).map((l, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #fef3c7', background: i%2===0?'#fff':'#fffbeb' }}>
                  <td style={{ padding:'7px 10px', fontWeight:700 }}>{l.code||l.designation||l.famille_libelle||'—'}</td>
                  <td style={{ padding:'7px 10px', fontSize:11, color:'#6b7280' }}>{l.famille_libelle||l.groupe_libelle||'—'}</td>
                  <td style={{ padding:'7px 10px', fontWeight:600 }}>{parseFloat(l.qte_demandee).toFixed(1)} kg</td>
                  <td style={{ padding:'7px 10px', color:'#15803d', fontWeight:600 }}>{parseFloat(l.qte_livree||0).toFixed(1)} kg</td>
                  <td style={{ padding:'7px 10px', color: parseFloat(l.qte_restante||0) > 0 ? '#d97706' : '#15803d', fontWeight:600 }}>
                    {parseFloat(l.qte_restante||0).toFixed(1)} kg
                    {parseFloat(l.qte_restante||0) <= 0 && ' ✓'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── LISTE DBM ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {dbms.map(d => (
          <div key={d.id} style={{
            background:'#fff', borderRadius:10, padding:'12px 16px',
            border:`2px solid ${STATUT_DBM[d.statut]?.bg || '#e5e7eb'}`,
            cursor:'pointer'
          }} onClick={() => detail?.id === d.id ? setDetail(null) : ouvrirDetail(d.id)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:800, fontFamily:'monospace', color:'#92400e' }}>{d.numero_dbm}</span>
                  <Badge statut={d.statut} map={STATUT_DBM} />
                  {d.urgence && <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>🚨 URGENT</span>}
                </div>
                <div style={{ fontSize:12, color:'#374151' }}>OF : {d.numero_of} | {d.nb_lignes} article(s)</div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>Par : {d.demandeur_nom} | {new Date(d.date_demande).toLocaleDateString('fr-FR')}</div>
              </div>
              <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <div style={{ fontWeight:700, color:'#92400e' }}>{parseFloat(d.poids_total_demande||0).toFixed(1)} kg</div>
                <div style={{ fontSize:11, color:'#15803d' }}>Livré : {parseFloat(d.poids_total_livre||0).toFixed(1)} kg</div>
                <button onClick={e=>{e.stopPropagation();ouvrirPdfSecurise(`/api/dbm/${d.id}/pdf?t=${Date.now()}`);}}
                  style={{ background:'#fff7ed', color:'#92400e', border:'1px solid #fed7aa', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                  🖨 PDF
                </button>
              </div>
            </div>
          </div>
        ))}
        {dbms.length === 0 && (
          <div style={{ padding:48, textAlign:'center', border:'1px solid #fef3c7', borderRadius:12, color:'#9ca3af' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📦</div>
            <p>Aucune DBM</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE RÉCEPTION DBM — Magasinier MP
// ══════════════════════════════════════════════════════════════
export function ModuleReceptionDBM() {
  const [dbms, setDbms]     = useState([]);
  const [detail, setDetail] = useState(null);
  const [livraisons, setLivraisons] = useState([]);
  const [notesMag, setNotesMag] = useState('');
  const [loading, setLoading] = useState(false);

  const [onglet, setOnglet] = useState('alivrer');
  const [historique, setHistorique] = useState([]);
  const [bonsLivraison, setBonsLivraison] = useState([]);
  const [showAnnuler, setShowAnnuler] = useState(null);
  const [motifAnnul, setMotifAnnul] = useState('');

  // Ecarts de reception (livre different de recu) a expliquer / prendre en compte par le magasin
  const [ecarts, setEcarts] = useState([]);
  const chargerEcarts = () => { axios.get(`${API}/dbm/livraisons/ecarts`).then(r => setEcarts(Array.isArray(r.data) ? r.data : [])).catch(() => setEcarts([])); };
  const ecartVu = async (id) => {
    try { await axios.put(`${API}/dbm/livraisons/ecarts/${id}/vu`); toast.success('Écart pris en compte'); chargerEcarts(); }
    catch (e) { toast.error(e.response?.data?.error || 'Erreur'); }
  };

  const charger = async () => {
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        axios.get(`${API}/dbm?statut=en_attente`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=partiel`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=en_preparation`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=livre`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=annule`).catch(()=>({data:[]})),
      ]);
      setDbms([...(r1.data||[]), ...(r2.data||[])]);
      setHistorique([...(r2.data||[]), ...(r3.data||[]), ...(r4.data||[]), ...(r5.data||[])]);
      // Charger les bons de livraison
      axios.get(`${API}/dbm/livraisons`).catch(()=>({data:[]})).then(r => setBonsLivraison(r.data||[]));
      chargerEcarts();
    } catch { toast.error('Erreur'); }
  };

  const annulerDbm = async (id) => {
    if (!motifAnnul || motifAnnul.trim().length < 5) return toast.error('Motif obligatoire (min 5 caractères)');
    try {
      const { data } = await axios.put(`${API}/dbm/${id}/annuler`, { motif: motifAnnul });
      toast.success(data.message);
      setShowAnnuler(null);
      setMotifAnnul('');
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur annulation'); }
  };

  useEffect(() => { charger(); }, []);

  const [lots, setLots] = useState({});

  const ouvrirDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/dbm/${id}`).catch(()=>({data:[]}));
      setDetail(data);
      // Charger les lots pour chaque article
      const lotsMap = {};
      for (const l of (data.lignes||[])) {
        if (l.article_id && !lotsMap[l.article_id]) {
          const { data: lotsData } = await axios.get(`${API}/dbm/lots/${l.article_id}`).catch(()=>({data:[]}));
          lotsMap[l.article_id] = lotsData;
        }
      }
      setLots(lotsMap);
      // FIFO : le lot le plus ancien est propose d'office ; si la quantite depasse son stock, le reste est pris sur le lot suivant
      setLivraisons((data.lignes || []).flatMap(l => {
        const base = { ligne_id: l.id, article_id: l.article_id, famille_id: l.famille_id, code: l.code, designation: l.designation,
                       qte_demandee: l.qte_demandee, qte_restante: l.qte_restante };
        let reste = parseFloat(l.qte_restante || 0);
        const rows = [];
        for (const lot of (lotsMap[l.article_id] || [])) {
          if (reste <= 0.0005) break;
          const dispo = parseFloat(lot.qte_disponible || 0);
          if (dispo <= 0) continue;
          const prise = Math.min(reste, dispo);
          rows.push({ ...base, lot_id: lot.id, numero_lot: lot.numero_lot, qte_livree: String(Math.round(prise * 1000) / 1000) });
          reste -= prise;
        }
        return rows.length ? rows : [{ ...base, qte_livree: parseFloat(l.qte_restante || 0).toFixed(1), lot_id: '', numero_lot: '' }];
      }));
    } catch { toast.error('Erreur'); }
  };

  // FIFO : renvoie le lot plus ancien dont le stock n'est pas encore entierement sorti (null si le lot choisi respecte le FIFO)
  const lotPrioritaire = (articleId, lotId) => {
    const liste = lots[articleId] || [];
    const idx = liste.findIndex(x => x.id === lotId);
    if (idx <= 0) return null;
    return liste.slice(0, idx).find(o => {
      const sorti = livraisons.filter(x => x.article_id === articleId && x.lot_id === o.id).reduce((s, x) => s + (parseFloat(x.qte_livree) || 0), 0);
      return sorti < parseFloat(o.qte_disponible || 0) - 0.05;
    }) || null;
  };

  const ajouterLigneParLot = (i) => {
    const l = livraisons[i];
    setLivraisons(prev => [
      ...prev.slice(0, i+1),
      { ...l, lot_id:'', numero_lot:'', qte_livree:'0' },
      ...prev.slice(i+1)
    ]);
  };

  const demanderException = async (i, l, choisi, plusAncien) => {
    const motif = (await saisir(`Pourquoi sortir le lot ${choisi.numero_lot} avant le lot ${plusAncien.numero_lot} ?`));
    if (!motif || !motif.trim()) return toast.error('Le motif est obligatoire');
    const qte = parseFloat(l.qte_livree || 0);
    if (!(qte > 0)) return toast.error('Indiquez d\'abord la quantité à sortir');
    try {
      const { data } = await axios.post(`${API}/dbm/exceptions-fifo`, { article_id: l.article_id, lot_demande: choisi.numero_lot, qte, motif });
      setLivraisons(prev => prev.map((x, xi) => xi === i ? { ...x, exception_id: data.id, exception_statut: 'en_attente' } : x));
      toast.success('Exception demandée : la direction doit l\'approuver');
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur'); }
  };
  const verifierException = async (i, l) => {
    try {
      const { data } = await axios.get(`${API}/dbm/exceptions-fifo`);
      const ex = (Array.isArray(data) ? data : []).find(x => x.id === l.exception_id);
      if (!ex) return toast.error('Exception introuvable');
      setLivraisons(prev => prev.map((x, xi) => xi === i ? { ...x, exception_statut: ex.statut } : x));
      if (ex.statut === 'approuvee') toast.success('Exception approuvée : vous pouvez livrer');
      else if (ex.statut === 'refusee') toast.error(`Exception refusée${ex.motif_refus ? ' : ' + ex.motif_refus : ''}`);
      else toast('Toujours en attente de la direction');
    } catch (e) { toast.error('Erreur de vérification'); }
  };

  const livrer = async () => {
    if (!detail) return;
    const horsFifo = livraisons.find(l => l.lot_id && parseFloat(l.qte_livree) > 0 && lotPrioritaire(l.article_id, l.lot_id) && l.exception_statut !== 'approuvee');
    if (horsFifo) return toast.error(`FIFO : pour ${horsFifo.code}, sortez d'abord le lot ${lotPrioritaire(horsFifo.article_id, horsFifo.lot_id).numero_lot} (le plus ancien) avant le lot ${horsFifo.numero_lot}, ou demandez une exception à la direction`);
    setLoading(true);
    try {
      const { data } = await axios.put(`${API}/dbm/${detail.id}/livrer`, {
        livraisons: livraisons.map(l => ({
          ...l,
          qte_livree: parseFloat(l.qte_livree || 0),
        })),
        notes_magasin: notesMag,
      });
      toast.success(data.message);
      setDetail(null);
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#0369a1' }}>
          🏪 Magasin MP — Réception des DBM
        </h3>
        <button onClick={charger} style={{ background:'#e0f2fe', border:'1px solid #7dd3fc', color:'#0369a1', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🔄</button>
      </div>

      {/* Ecarts de reception : l'atelier a recu moins que ce qui a ete livre */}
      {ecarts.length > 0 && (
        <div style={{ background:'#fef2f2', border:'2px solid #fca5a5', borderRadius:12, padding:14, marginBottom:16 }}>
          <div style={{ fontWeight:800, color:'#b91c1c', marginBottom:8 }}>⚠ Écarts de réception à traiter ({ecarts.length})</div>
          {ecarts.map(e => (
            <div key={e.id} style={{ background:'#fff', borderRadius:8, padding:'8px 12px', marginBottom:6, display:'flex', justifyContent:'space-between', gap:10, alignItems:'center' }}>
              <div style={{ fontSize:12, color:'#374151', minWidth:0 }}>
                <div><b>{e.code}</b> — {e.designation} <span style={{ color:'#6b7280' }}>· {e.numero_livraison} · lot {e.numero_lot || '—'} · DBM {e.numero_dbm}</span></div>
                <div>Livré <b>{fmtKg(e.qte_livree)} kg</b> · Reçu <b>{fmtKg(e.qte_recue)} kg</b> · <b style={{ color:'#dc2626' }}>écart {fmtKg(e.ecart)} kg</b></div>
                <div style={{ color:'#92400e' }}>Motif donné par l'atelier : {e.observation_reception || 'non renseigné'}</div>
              </div>
              <button onClick={() => ecartVu(e.id)}
                style={{ flexShrink:0, background:'#15803d', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                ✓ Pris en compte
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Détail + formulaire livraison */}
      {detail && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #7dd3fc', padding:20, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#0369a1', fontFamily:'monospace' }}>{detail.numero_dbm}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>OF : {detail.numero_of} | Demandeur : {detail.demandeur_nom}</div>
              {detail.urgence && <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>🚨 URGENT</span>}
            </div>
            <button onClick={() => setDetail(null)} style={{ background:'#f3f4f6', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕</button>
          </div>

          <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:8, padding:'6px 10px', fontSize:11, color:'#92400e', marginBottom:10 }}>
            FIFO : le lot le plus ancien est toujours sorti en premier. Les quantités sont réparties automatiquement ; sortir un lot plus récent exige l'accord de la direction.
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:14 }}>
            <thead>
              <tr style={{ background:'#e0f2fe' }}>
                {['MP', 'Demandé', 'Restant', 'Qté à livrer', 'N° Lot'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#0369a1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #e0f2fe' }}>
                  <td style={{ padding:'7px 10px' }}>
                    <div style={{ fontWeight:700 }}>{l.code}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{l.designation}</div>
                  </td>
                  <td style={{ padding:'7px 10px', fontWeight:600 }}>{parseFloat(l.qte_demandee).toFixed(1)} kg</td>
                  <td style={{ padding:'7px 10px', color:'#d97706', fontWeight:600 }}>{parseFloat(l.qte_restante||0).toFixed(1)} kg</td>
                  <td style={{ padding:'7px 10px', width:110 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input type="number" value={l.qte_livree} min="0" step="0.1"
                        onChange={e => setLivraisons(prev => prev.map((x,xi) => xi===i?{...x,qte_livree:e.target.value}:x))}
                        style={{ width:80, border:'2px solid #7dd3fc', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                      <span style={{ fontSize:11 }}>kg</span>
                    </div>
                  </td>
                  <td style={{ padding:'7px 10px', width:160 }}>
                    <select value={l.lot_id||''} onChange={e => {
                      const lot = (lots[l.article_id]||[]).find(x=>x.id===e.target.value);
                      setLivraisons(prev => prev.map((x,xi) => xi===i?{...x,exception_id:null,exception_statut:null,lot_id:e.target.value,numero_lot:lot?.numero_lot||'',qte_livree:Math.min(parseFloat(l.qte_restante||0),parseFloat(lot?.qte_disponible||0)).toFixed(1)}:x));
                    }} style={{ width:'100%', border:'1px solid #7dd3fc', borderRadius:6, padding:'5px', fontSize:12, boxSizing:'border-box', marginBottom:3 }}>
                      <option value="">-- Choisir lot --</option>
                      {(lots[l.article_id]||[]).map((lot, rang) => {
                        // Déduire ce qui est déjà alloué dans les autres lignes
                        const dejaAlloue = livraisons
                          .filter((x, xi) => xi !== i && x.lot_id === lot.id)
                          .reduce((s, x) => s + parseFloat(x.qte_livree||0), 0);
                        const dispo = Math.max(0, parseFloat(lot.qte_disponible) - dejaAlloue);
                        return (
                          <option key={lot.id} value={lot.id}>
                            {rang === 0 ? '① ' : ''}{lot.numero_lot} ({dispo.toFixed(0)} kg dispo){lot.date_reception ? ' · reçu le ' + new Date(lot.date_reception).toLocaleDateString('fr-FR') : ''}{rang === 0 ? ' — À SORTIR EN PREMIER' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {(() => {
                      const choisi = (lots[l.article_id]||[]).find(x => x.id === l.lot_id);
                      const plusAncien = choisi ? lotPrioritaire(l.article_id, l.lot_id) : null;
                      if (!choisi || !plusAncien) return null;
                      return (
                        <div style={{ fontSize:10, marginBottom:3 }}>
                          {l.exception_statut !== 'approuvee' && <div style={{ color:'#dc2626', fontWeight:700, marginBottom:2 }}>⚠ FIFO : le lot {plusAncien.numero_lot} doit être sorti en premier</div>}
                          {l.exception_statut === 'approuvee' && <span style={{ color:'#15803d', fontWeight:700 }}>✓ Exception approuvée</span>}
                          {l.exception_id && l.exception_statut !== 'approuvee' && <span style={{ color:'#b45309' }}>⏳ Exception en attente de la direction </span>}
                          {l.exception_id && l.exception_statut !== 'approuvee' && (
                            <button onClick={() => verifierException(i, l)} style={{ fontSize:10, background:'#fef3c7', color:'#92400e', border:'none', borderRadius:4, padding:'2px 6px', cursor:'pointer' }}>↻ vérifier</button>
                          )}
                          {!l.exception_id && (
                            <button onClick={() => demanderException(i, l, choisi, plusAncien)} style={{ fontSize:10, background:'#fef3c7', color:'#92400e', border:'none', borderRadius:4, padding:'2px 6px', cursor:'pointer' }}>
                              📝 Demander une exception FIFO (lot plus ancien : {plusAncien.numero_lot})
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{ display:'flex', gap:4, marginTop:2 }}>
                      <button onClick={() => ajouterLigneParLot(i)}
                        style={{ fontSize:10, background:'#e0f2fe', color:'#0369a1', border:'none', borderRadius:4, padding:'2px 8px', cursor:'pointer' }}>
                        + autre lot
                      </button>
                      {livraisons.filter(x=>x.ligne_id===l.ligne_id).length > 1 && (
                        <button onClick={() => setLivraisons(prev => prev.filter((_,xi) => xi!==i))}
                          style={{ fontSize:10, background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:4, padding:'2px 8px', cursor:'pointer' }}>
                          🗑
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Notes magasin</label>
            <textarea value={notesMag} onChange={e => setNotesMag(e.target.value)} rows={2}
              style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={livrer} disabled={loading}
              style={{ background: loading ? '#9ca3af' : '#0369a1', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor: loading ? 'not-allowed' : 'pointer', fontWeight:700 }}
              onDoubleClick={e => e.preventDefault()}>
              {loading ? '⏳ Envoi en cours...' : '✅ Valider Livraison → AT3'}
            </button>
            <button onClick={() => setDetail(null)} style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderRadius:10, overflow:'hidden', border:'2px solid #e5e7eb', width:'fit-content' }}>
        {[['alivrer','📦 À livrer'],['historique','📋 Historique']].map(([id,label]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{
            padding:'8px 18px', border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
            background: onglet===id ? '#0369a1' : '#fff', color: onglet===id ? '#fff' : '#6b7280'
          }}>{label}</button>
        ))}
      </div>

      {/* Modal annulation */}
      {showAnnuler && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #fca5a5', padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:700, color:'#dc2626', marginBottom:12 }}>🚫 Annuler la DBM {showAnnuler.numero_dbm}</div>
          <textarea value={motifAnnul} onChange={e => setMotifAnnul(e.target.value)} rows={3}
            placeholder="Motif obligatoire (min 5 caractères)..."
            style={{ width:'100%', border:'2px solid #fca5a5', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box', marginBottom:12 }} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => annulerDbm(showAnnuler.id)}
              style={{ background:'#dc2626', color:'#fff', border:'none', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              🚫 Confirmer annulation
            </button>
            <button onClick={() => { setShowAnnuler(null); setMotifAnnul(''); }}
              style={{ background:'#f3f4f6', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste DBM à livrer */}
      {onglet === 'alivrer' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {dbms.map(d => (
            <div key={d.id} style={{
              background: d.urgence ? '#fff7f0' : '#fff',
              borderRadius:10, padding:'12px 16px',
              border:`2px solid ${d.urgence ? '#fed7aa' : '#bae6fd'}`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div onClick={() => ouvrirDetail(d.id)} style={{ cursor:'pointer', flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontFamily:'monospace', color:'#0369a1' }}>{d.numero_dbm}</span>
                    <Badge statut={d.statut} map={STATUT_DBM} />
                    {d.urgence && <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>🚨 URGENT</span>}
                  </div>
                  <div style={{ fontSize:12, color:'#374151' }}>OF : {d.numero_of} | {d.nb_lignes} MP | AT3</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{new Date(d.date_demande).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'#0369a1', fontSize:15 }}>{parseFloat(d.poids_total_demande||0).toFixed(1)} kg</div>
                    <div style={{ fontSize:12, color:'#1d4ed8', fontWeight:600 }}>→ Préparer</div>
                  </div>
                  {d.statut === 'partiel' && (
                    <button onClick={() => { setShowAnnuler(d); setMotifAnnul(''); }}
                      style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      🚫 Annuler
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {dbms.length === 0 && (
            <div style={{ padding:48, textAlign:'center', border:'1px solid #e0f2fe', borderRadius:12, color:'#9ca3af' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
              <p>Aucune DBM en attente</p>
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {onglet === 'historique' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {bonsLivraison.length === 0 ? (
            <div style={{ padding:48, textAlign:'center', color:'#9ca3af' }}>Aucun bon de livraison</div>
          ) : bonsLivraison.map((b, i) => (
            <div key={i} style={{ background:'#fff', borderRadius:10, padding:'12px 16px', border:'1px solid #bae6fd' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:800, fontFamily:'monospace', color:'#0369a1' }}>{b.numero_livraison}</div>
                  <div style={{ fontSize:12, color:'#374151' }}>DBM : {b.numero_dbm} | OF : {b.numero_of}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{new Date(b.date_livraison).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })} — {b.livre_par_nom}</div>
                  <DetailBon numero={b.numero_livraison} />
                </div>
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  <div style={{ fontWeight:700, color:'#15803d' }}>Livré : {parseFloat(b.poids_livre||0).toFixed(1)} kg | Reçu : {parseFloat(b.poids_recu||0).toFixed(1)} kg</div>
                  <button onClick={() => ouvrirPdfSecurise(`/api/dbm/livraisons/${b.numero_livraison}/pdf?t=${Date.now()}`)}
                    style={{ background:'#f0f9ff', color:'#0369a1', border:'1px solid #bae6fd', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                    🖨 PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE STOCK AT3 — Inventaire interne
// ══════════════════════════════════════════════════════════════
function DetailBon({ numero }) {
  const [ouvert, setOuvert] = useState(false);
  const [lignes, setLignes] = useState(null);
  const basculer = async () => {
    const v = !ouvert;
    setOuvert(v);
    if (v && lignes === null) {
      try {
        const { data } = await axios.get(`${API}/dbm/livraisons/${encodeURIComponent(numero)}`);
        setLignes(Array.isArray(data) ? data : []);
      } catch { setLignes([]); }
    }
  };
  return (
    <div style={{ marginTop:6 }}>
      <button onClick={basculer}
        style={{ background:'none', border:'none', color:'#0369a1', cursor:'pointer', fontSize:11, fontWeight:700, padding:0 }}>
        {ouvert ? '▲ Masquer le détail' : '▼ Voir le détail'}
      </button>
      {ouvert && (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:6, fontSize:12 }}>
          <thead>
            <tr style={{ background:'#f3f4f6' }}>
              {['MP','Lot','Envoyé','Reçu','Observation'].map(h => (
                <th key={h} style={{ padding:'4px 8px', textAlign:'left', fontSize:10, color:'#6b7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(lignes || []).map(l => (
              <tr key={l.id} style={{ borderBottom:'1px solid #e5e7eb' }}>
                <td style={{ padding:'4px 8px', fontWeight:600 }}>{l.designation || l.code}</td>
                <td style={{ padding:'4px 8px', fontFamily:'monospace' }}>{l.numero_lot || '—'}</td>
                <td style={{ padding:'4px 8px' }}>{parseFloat(l.qte_livree||0).toFixed(3)} kg</td>
                <td style={{ padding:'4px 8px', fontWeight:700, color: l.receptionne ? '#15803d' : '#b45309' }}>
                  {l.receptionne ? parseFloat(l.qte_recue ?? l.qte_livree).toFixed(3) + ' kg' : 'En transit'}
                </td>
                <td style={{ padding:'4px 8px', color:'#b45309' }}>{l.observation_reception || ''}</td>
              </tr>
            ))}
            {lignes !== null && lignes.length === 0 && (
              <tr><td colSpan={5} style={{ padding:8, color:'#9ca3af' }}>Aucune ligne</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function ModuleStockAT3() {
  const [stock, setStock]   = useState([]);
  const [resume, setResume] = useState([]);
  const [mvts, setMvts]     = useState([]);
  const [onglet, setOnglet] = useState('stock');

  const charger = async () => {
    try {
      const [s, r, m] = await Promise.all([
        axios.get(`${API}/dbm/stock-at3/liste`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm/stock-at3/resume`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm/stock-at3/mouvements`).catch(()=>({data:[]})),
      ]);
      setStock(s.data || []);
      setResume(r.data || []);
      setMvts(m.data || []);
    } catch { toast.error('Erreur stock AT3'); }
  };

  useEffect(() => { charger(); }, []);

  const TYPE_MVT = {
    entree_dbm:         { label:'Entrée DBM', color:'#15803d', bg:'#dcfce7' },
    sortie_production:  { label:'Sortie prod.', color:'#dc2626', bg:'#fee2e2' },
    retour_magasin:     { label:'Retour mag.', color:'#0369a1', bg:'#dbeafe' },
    inventaire:         { label:'Inventaire', color:'#6d28d9', bg:'#f3e8ff' },
    perte:              { label:'Perte', color:'#92400e', bg:'#fef3c7' },
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#15803d' }}>
          🏗 Stock Interne AT3
        </h3>
        <button onClick={charger} style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🔄</button>
      </div>

      {/* Résumé par famille */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:20 }}>
        {resume.filter(r => parseFloat(r.qte_totale||0) > 0).map(r => (
          <div key={r.famille_id} style={{ background:'#f0fdf4', borderRadius:12, padding:'12px 14px', border:'1px solid #86efac' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', marginBottom:4 }}>{r.famille_libelle}</div>
            <div style={{ fontSize:22, fontWeight:800, color:'#15803d' }}>{parseFloat(r.qte_totale||0).toFixed(1)}</div>
            <div style={{ fontSize:10, color:'#6b7280' }}>kg disponible</div>
            {parseFloat(r.qte_reservee||0) > 0 && (
              <div style={{ fontSize:10, color:'#d97706', marginTop:2 }}>
                {parseFloat(r.qte_reservee).toFixed(1)} kg réservé
              </div>
            )}
          </div>
        ))}
        {resume.filter(r => parseFloat(r.qte_totale||0) > 0).length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#9ca3af', padding:20, fontSize:13 }}>
            Stock AT3 vide — en attente de livraison DBM
          </div>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderRadius:10, overflow:'hidden', border:'2px solid #e5e7eb', width:'fit-content' }}>
        {[['stock','📦 Stock détaillé'],['mouvements','🔄 Mouvements']].map(([id,label]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{
            padding:'8px 18px', border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
            background: onglet===id ? '#15803d' : '#fff', color: onglet===id ? '#fff' : '#6b7280'
          }}>{label}</button>
        ))}
      </div>

      {onglet === 'stock' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f0fdf4' }}>
                {['Famille','Article','Disponible','Réservé','Consommé','Lot','Date entrée'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stock.map((s, i) => (
                <tr key={s.id} style={{ borderBottom:'1px solid #f0fdf4', background: i%2===0?'#fff':'#f9fefb' }}>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#6b7280' }}>{s.famille_libelle||'—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    <div style={{ fontWeight:700 }}>{s.code}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{s.designation}</div>
                  </td>
                  <td style={{ padding:'8px 12px', fontWeight:700, color:'#15803d' }}>{parseFloat(s.qte_disponible||0).toFixed(3)} kg</td>
                  <td style={{ padding:'8px 12px', color:'#d97706' }}>{parseFloat(s.qte_reservee||0).toFixed(3)} kg</td>
                  <td style={{ padding:'8px 12px', color:'#6b7280' }}>{parseFloat(s.qte_consommee||0).toFixed(3)} kg</td>
                  <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'monospace' }}>{s.numero_lot||'—'}</td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#9ca3af' }}>
                    {new Date(s.date_entree).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {stock.length === 0 && (
                <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>Stock vide</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {onglet === 'mouvements' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['N° Mvt','Type','Article','Quantité','OF','Par','Date'].map(h => (
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'2px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mvts.map((m, i) => {
                const tc = TYPE_MVT[m.type_mvt] || { label:m.type_mvt, color:'#374151', bg:'#f3f4f6' };
                return (
                  <tr key={m.id} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                    <td style={{ padding:'7px 12px', fontFamily:'monospace', fontSize:11, fontWeight:700 }}>{m.numero_mvt}</td>
                    <td style={{ padding:'7px 12px' }}>
                      <span style={{ background:tc.bg, color:tc.color, padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>{tc.label}</span>
                    </td>
                    <td style={{ padding:'7px 12px', fontWeight:600 }}>{m.code}</td>
                    <td style={{ padding:'7px 12px', fontWeight:700, color: m.type_mvt.startsWith('entree') ? '#15803d' : '#dc2626' }}>
                      {m.type_mvt.startsWith('entree') ? '+' : '-'}{parseFloat(m.quantite).toFixed(3)} kg
                    </td>
                    <td style={{ padding:'7px 12px', fontSize:11, color:'#0369a1' }}>{m.numero_of||'—'}</td>
                    <td style={{ padding:'7px 12px', fontSize:11, color:'#6b7280' }}>{m.operateur_nom||'—'}</td>
                    <td style={{ padding:'7px 12px', fontSize:11, color:'#9ca3af', whiteSpace:'nowrap' }}>
                      {new Date(m.date_mvt).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}
                    </td>
                  </tr>
                );
              })}
              {mvts.length === 0 && (
                <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>Aucun mouvement</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MODULE RÉCEPTION AT3 — Chef AT3 valide les MP reçues
// ══════════════════════════════════════════════════════════════
export function ModuleReceptionAT3() {
  const [dbms, setDbms]         = useState([]);
  const [detail, setDetail]     = useState(null);
  const [receptions, setReceptions] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [ongletRecep, setOngletRecep] = useState('attente');
  const [bonsLivraison, setBonsLivraison] = useState([]);

  const charger = async () => {
    try {
      const [r1, r2] = await Promise.all([axios.get(`${API}/dbm?statut=en_preparation`).catch(()=>({data:[]})), axios.get(`${API}/dbm?statut=en_attente`).catch(()=>({data:[]}))]);
      setDbms([...(r1.data||[]), ...(r2.data||[])]);
      axios.get(`${API}/dbm/livraisons`).catch(()=>({data:[]})).then(r => setBonsLivraison(r.data||[]));
    } catch { toast.error('Erreur chargement'); }
  };

  useEffect(() => { charger(); }, []);

  const ouvrirDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/dbm/${id}`).catch(()=>({data:[]}));
      setDetail(data);
      const src = (data.livraisons && data.livraisons.length > 0)
        ? data.livraisons.filter(lv => parseFloat(lv.qte_livree||0) > 0 && lv.receptionne === false).map(lv => ({
            livraison_id: lv.id,
            numero_livraison: lv.numero_livraison,
            ligne_id:   lv.ligne_id,
            article_id: lv.article_id,
            famille_id: (data.lignes||[]).find(l=>l.id===lv.ligne_id)?.famille_id,
            code:       lv.code,
            designation: lv.designation,
            qte_en_transit: parseFloat(lv.qte_livree||0),
            qte_recue:  String(parseFloat(lv.qte_livree||0)),
            numero_lot: lv.numero_lot||'',
            observation: '',
          }))
        : (data.lignes||[]).map(l => ({
            ligne_id:   l.id,
            article_id: l.article_id,
            famille_id: l.famille_id,
            code:       l.code,
            designation: l.designation,
            qte_en_transit: parseFloat(l.qte_en_transit||0),
            qte_recue:  parseFloat(l.qte_en_transit||0).toFixed(1),
            numero_lot: l.numero_lot||'',
            observation: '',
          }));
      setReceptions(src);
    } catch { toast.error('Erreur'); }
  };

  const receptionner = async () => {
    if (!detail) return;
    // Vérifier observations obligatoires
    for (const r of receptions) {
      if (parseFloat(r.qte_recue||0) !== parseFloat(r.qte_en_transit||0) && !r.observation?.trim()) {
        return toast.error(`${r.code} : expliquez l'écart (quantité reçue différente de la quantité livrée) dans la case Observation`);
      }
    }
    setLoading(true);
    try {
      const { data } = await axios.put(`${API}/dbm/${detail.id}/receptionner`, {
        receptions: receptions.map(r => ({
          ...r,
          qte_recue: parseFloat(r.qte_recue || 0),
        })),
      });
      toast.success(data.message);
      setDetail(null);
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur réception'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#7c3aed' }}>📥 Réception MP</h3>
        <button onClick={charger} style={{ background:'#f3e8ff', border:'1px solid #c4b5fd', color:'#7c3aed', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🔄</button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['attente','📥 En attente'],['historique','📋 Historique']].map(([id,label]) => (
          <button key={id} onClick={() => setOngletRecep(id)}
            style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700,
              background: ongletRecep===id ? '#7c3aed' : '#f3e8ff',
              color: ongletRecep===id ? '#fff' : '#7c3aed' }}>{label}</button>
        ))}
      </div>
      {ongletRecep === 'historique' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {bonsLivraison.length === 0 ? (
            <div style={{ padding:48, textAlign:'center', color:'#9ca3af' }}>Aucun bon de livraison</div>
          ) : bonsLivraison.map((b, i) => (
            <div key={i} style={{ background:'#faf5ff', borderRadius:10, padding:'12px 16px', border:'1px solid #c4b5fd' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:800, fontFamily:'monospace', color:'#7c3aed' }}>{b.numero_livraison}</div>
                  <div style={{ fontSize:12, color:'#374151' }}>DBM : {b.numero_dbm} | OF : {b.numero_of}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{new Date(b.date_livraison).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}</div>
                  <DetailBon numero={b.numero_livraison} />
                </div>
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                  <div style={{ fontSize:12, color:'#7c3aed' }}>Livré : {parseFloat(b.poids_livre||0).toFixed(1)} kg</div>
                  <div style={{ fontSize:12, color:'#15803d', fontWeight:700 }}>Reçu : {parseFloat(b.poids_recu||0).toFixed(1)} kg</div>
                  <button onClick={() => ouvrirPdfSecurise(`/api/dbm/livraisons/${b.numero_livraison}/pdf?t=${Date.now()}`)}
                    style={{ background:'#f3e8ff', color:'#7c3aed', border:'1px solid #c4b5fd', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                    🖨 PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {ongletRecep === 'attente' && (<>


      {detail && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #c4b5fd', padding:20, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#7c3aed', fontFamily:'monospace' }}>{detail.numero_dbm}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>OF : {detail.numero_of} | Envoyé par Magasin MP</div>
            </div>
            <button onClick={() => setDetail(null)} style={{ background:'#f3f4f6', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer' }}>✕</button>
          </div>

          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:14 }}>
            <thead>
              <tr style={{ background:'#f3e8ff' }}>
                {['MP', 'N° Lot', 'Envoyé', 'Qté reçue réelle', 'Observation'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#7c3aed' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receptions.map((r, i) => (
                <tr key={i} style={{ borderBottom:'1px solid #f3e8ff' }}>
                  <td style={{ padding:'7px 10px' }}>
                    <div style={{ fontWeight:700 }}>{r.code}</div>
                    <div style={{ fontSize:10, color:'#6b7280' }}>{r.designation}</div>
                  </td>
                  <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>{r.numero_lot || '—'}{r.numero_livraison && <div style={{ fontSize:9, color:'#7c3aed' }}>{r.numero_livraison.split('-').pop()}</div>}</td>
                  <td style={{ padding:'7px 10px', fontWeight:600, color:'#7c3aed' }}>{r.qte_en_transit} kg</td>
                  <td style={{ padding:'7px 10px', width:130 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input type="number" value={r.qte_recue} min="0" step="0.1"
                        max={r.qte_en_transit}
                        onChange={e => {
                          const v = parseFloat(e.target.value||0);
                          const max = r.qte_en_transit;
                          setReceptions(prev => prev.map((x,xi) => xi===i ? {...x, qte_recue: v>max?max:e.target.value} : x));
                        }}
                        style={{ width:80, border:'2px solid #c4b5fd', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                      <span style={{ fontSize:11 }}>kg</span>
                    </div>
                  </td>
                  <td style={{ padding:'7px 10px', minWidth:230 }}>
                    {(() => {
                      const diff = (parseFloat(r.qte_recue || 0) - parseFloat(r.qte_en_transit || 0));
                      const ecart = Math.abs(diff) > 0.0005;
                      const vide = !(r.observation || '').trim();
                      return (<>
                        <textarea rows={2} value={r.observation || ''}
                          onChange={e => setReceptions(prev => prev.map((x, xi) => xi === i ? { ...x, observation: e.target.value } : x))}
                          placeholder={ecart ? "Expliquez l'écart : pourquoi ? (obligatoire)" : 'Observation (facultative)'}
                          style={{ width:'100%', border: (ecart && vide) ? '2px solid #dc2626' : '1px solid #c4b5fd', borderRadius:6, padding:'5px', fontSize:12, boxSizing:'border-box', resize:'vertical', fontFamily:'inherit' }} />
                        {ecart && (
                          <div style={{ fontSize:10, fontWeight:700, color:'#dc2626', marginTop:2 }}>
                            ⚠ Écart de {Math.abs(diff).toFixed(1)} kg{vide ? ' : le motif est obligatoire' : ' : le magasin sera alerté'}
                          </div>
                        )}
                      </>);
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={receptionner} disabled={loading}
              style={{ background:'#7c3aed', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              {loading ? '...' : '✅ Valider Réception → Stock AT3'}
            </button>
            <button onClick={() => setDetail(null)} style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {dbms.map(d => (
          <div key={d.id} style={{ background:'#faf5ff', borderRadius:10, padding:'12px 16px', border:'2px solid #c4b5fd', cursor:'pointer' }}
            onClick={() => ouvrirDetail(d.id)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:800, fontFamily:'monospace', color:'#7c3aed' }}>{d.numero_dbm}</div>
                <div style={{ fontSize:12, color:'#374151' }}>OF : {d.numero_of} | {d.nb_lignes} MP</div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>{new Date(d.date_livraison||d.date_demande).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, color:'#7c3aed' }}>{parseFloat(d.poids_total_demande||0).toFixed(1)} kg</div>
                <div style={{ fontSize:12, color:'#7c3aed', fontWeight:600 }}>📥 À réceptionner</div>
              </div>
            </div>
          </div>
        ))}
        {dbms.length === 0 && (
          <div style={{ padding:48, textAlign:'center', border:'1px solid #f3e8ff', borderRadius:12, color:'#9ca3af' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
            <p>Aucune livraison en attente de réception</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MODULE STOCK MAGASIN MP
// ══════════════════════════════════════════════════════════════
export function ModuleStockMP() {
  const { user } = useAuth();
  const [articles, setArticles] = useState([]);
  const [lots, setLots] = useState([]);
  const [artSel, setArtSel] = useState(null);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [searchFourn, setSearchFourn] = useState('');
  useEffect(() => {
    axios.get('/api/achat/fournisseurs').then(r => setFournisseurs(r.data||[])).catch(()=>{});
  }, []);
  const fournisseursFiltres = fournisseurs.filter(f =>
    !searchFourn || f.raison_sociale.toLowerCase().includes(searchFourn.toLowerCase()) ||
    (f.code||'').toLowerCase().includes(searchFourn.toLowerCase())
  );
  const [showEntree, setShowEntree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    article_id:'', numero_lot:'', qte:'', prix_unitaire:'',
    fournisseur_nom:'', date_reception: new Date().toISOString().split('T')[0],
    date_dluo:'', notes:''
  });

  const charger = async () => {
    try {
      const { data } = await axios.get(`${API}/dbm/stock-mp/liste`).catch(()=>({data:[]}));
      setArticles(data||[]);
    } catch { toast.error('Erreur chargement stock MP'); }
  };

  const chargerLots = async (article) => {
    setArtSel(article);
    try {
      const { data } = await axios.get(`${API}/dbm/stock-mp/lots/${article.id}`).catch(()=>({data:[]}));
      setLots(data||[]);
    } catch { toast.error('Erreur lots'); }
  };

  useEffect(() => { if(user) setTimeout(charger,300); }, [user]);

  const enregistrerEntree = async () => {
    if (!form.article_id || !form.numero_lot || !form.qte) return toast.error('Article, lot et quantité obligatoires');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/dbm/stock-mp/entree`, {
        ...form, qte: parseFloat(form.qte)
      });
      toast.success(data.message);
      setShowEntree(false);
      setForm({ article_id:'', numero_lot:'', qte:'', prix_unitaire:'', fournisseur_nom:'', date_reception: new Date().toISOString().split('T')[0], date_dluo:'', notes:'' });
      charger();
      if (artSel?.id === form.article_id) chargerLots(artSel);
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#0369a1,#0284c7)', borderRadius:14, padding:'14px 20px', marginBottom:16, color:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:16 }}>📦 Stock Magasin MP</div>
        <div style={{ fontSize:11, opacity:0.8, marginTop:2 }}>Inventaire et réceptions matières premières</div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button onClick={charger} style={{ background:'#e0f2fe', border:'1px solid #7dd3fc', color:'#0369a1', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🔄</button>
        <button onClick={() => setShowEntree(true)}
          style={{ background:'#0369a1', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
          + Réception fournisseur
        </button>
      </div>

      {/* Formulaire entrée */}
      {showEntree && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #7dd3fc', padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:800, color:'#0369a1', fontSize:15, marginBottom:16 }}>📥 Nouvelle réception fournisseur</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Article MP *</label>
              <select value={form.article_id} onChange={e => setForm(f=>({...f,article_id:e.target.value}))}
                style={{ width:'100%', border:'2px solid #7dd3fc', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}>
                <option value="">-- Choisir article --</option>
                {articles.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>N° Lot *</label>
              <input type="text" value={form.numero_lot} onChange={e => setForm(f=>({...f,numero_lot:e.target.value}))}
                placeholder="Ex: EXXO-2026-003"
                style={{ width:'100%', border:'2px solid #7dd3fc', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Quantité (kg) *</label>
              <input type="number" value={form.qte} onChange={e => setForm(f=>({...f,qte:e.target.value}))}
                style={{ width:'100%', border:'2px solid #7dd3fc', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Prix unitaire (FCFA/kg)</label>
              <input type="number" value={form.prix_unitaire} onChange={e => setForm(f=>({...f,prix_unitaire:e.target.value}))}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Fournisseur *</label>
              <input type="text" placeholder="🔍 Rechercher fournisseur..." value={searchFourn}
                onChange={e => setSearchFourn(e.target.value)}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'7px', fontSize:12, boxSizing:'border-box', marginBottom:4 }} />
              <select value={form.fournisseur_nom} onChange={e => { setForm(f=>({...f,fournisseur_nom:e.target.value})); setSearchFourn(''); }}
                style={{ width:'100%', border:'2px solid #7dd3fc', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}>
                <option value="">-- Choisir fournisseur --</option>
                {fournisseursFiltres.map(f => <option key={f.id} value={f.raison_sociale}>{f.code} — {f.raison_sociale}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Date réception</label>
              <input type="date" value={form.date_reception} onChange={e => setForm(f=>({...f,date_reception:e.target.value}))}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Date DLUO</label>
              <input type="date" value={form.date_dluo} onChange={e => setForm(f=>({...f,date_dluo:e.target.value}))}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:16 }}>
            <button onClick={enregistrerEntree} disabled={loading}
              style={{ background:'#0369a1', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              {loading ? '...' : '✅ Enregistrer réception'}
            </button>
            <button onClick={() => setShowEntree(false)}
              style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Tableau stock */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#e0f2fe' }}>
              {['Famille','Article','Stock dispo','Réservé','Nb lots',''].map(h => (
                <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#0369a1', borderBottom:'2px solid #bae6fd' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {articles.map((a,i) => (
              <tr key={a.id} style={{ borderBottom:'1px solid #f0f9ff', background: i%2===0?'#fff':'#f0f9ff' }}>
                <td style={{ padding:'8px 12px', fontSize:11, color:'#6b7280' }}>{a.famille_libelle}</td>
                <td style={{ padding:'8px 12px' }}>
                  <div style={{ fontWeight:700 }}>{a.code}</div>
                  <div style={{ fontSize:10, color:'#6b7280' }}>{a.designation}</div>
                </td>
                <td style={{ padding:'8px 12px', fontWeight:700, color: parseFloat(a.qte_disponible||0)>0?'#0369a1':'#dc2626' }}>
                  {parseFloat(a.qte_disponible||0).toFixed(3)} kg
                </td>
                <td style={{ padding:'8px 12px', color:'#d97706' }}>{parseFloat(a.qte_reservee||0).toFixed(3)} kg</td>
                <td style={{ padding:'8px 12px', color:'#6b7280' }}>{a.nb_lots} lot(s)</td>
                <td style={{ padding:'8px 12px' }}>
                  <button onClick={() => artSel?.id===a.id ? setArtSel(null) : chargerLots(a)}
                    style={{ background:'#e0f2fe', color:'#0369a1', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11 }}>
                    {artSel?.id===a.id ? '▲ Masquer' : '▼ Lots'}
                  </button>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr><td colSpan={6} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>Aucun article</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Détail lots */}
      {artSel && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #bae6fd', padding:16 }}>
          <div style={{ fontWeight:700, color:'#0369a1', marginBottom:12 }}>📋 Lots — {artSel.code}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#e0f2fe' }}>
                {['N° Lot','Fournisseur','Date réception','DLUO','Disponible','Prix/kg','Fiche'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#0369a1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lots.map((l,i) => (
                <tr key={l.id} style={{ borderBottom:'1px solid #e0f2fe', background: i%2===0?'#fff':'#f0f9ff' }}>
                  <td style={{ padding:'7px 10px', fontFamily:'monospace', fontWeight:700 }}>{l.numero_lot}</td>
                  <td style={{ padding:'7px 10px', color:'#6b7280' }}>{l.fournisseur_nom||'—'}</td>
                  <td style={{ padding:'7px 10px' }}>{l.date_reception ? new Date(l.date_reception).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding:'7px 10px', color: l.date_dluo && new Date(l.date_dluo) < new Date() ? '#dc2626' : '#6b7280' }}>
                    {l.date_dluo ? new Date(l.date_dluo).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ padding:'7px 10px', fontWeight:700, color:'#0369a1' }}>{parseFloat(l.qte_disponible).toFixed(3)} kg</td>
                  <td style={{ padding:'7px 10px', color:'#6b7280' }}>{parseFloat(l.prix_unitaire||0).toFixed(0)} FCFA</td>
                  <td style={{ padding:'7px 10px' }}>
                    <button onClick={() => ouvrirPdfSecurise(`/api/dbm/stock-mp/entree/${l.id}/pdf?t=${Date.now()}`)}
                      style={{ background:'#e0f2fe', color:'#0369a1', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      🖨 Fiche
                    </button>
                  </td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr><td colSpan={6} style={{ padding:20, textAlign:'center', color:'#9ca3af' }}>Aucun lot disponible</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
// ══════════════════════════════════════════════════════════════
// DASHBOARD MAGASIN MP
// ══════════════════════════════════════════════════════════════
export function DashboardMagasinMP() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ en_attente:0, en_preparation:0, partiel:0, livre:0 });
  const [stockMP, setStockMP] = useState([]);
  const [dernLivraisons, setDernLivraisons] = useState([]);
  const loadedRef = useRef(false);

  const charger = async () => { setStockMP([]);
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        axios.get(`${API}/dbm?statut=en_attente`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=en_preparation`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=partiel`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm?statut=livre`).catch(()=>({data:[]})),
        axios.get(`${API}/dbm/stock-mp/resume`).catch(()=>({data:[]})),
      ]);
      setStats({
        en_attente:    (r1.data||[]).length,
        en_preparation:(r2.data||[]).length,
        partiel:       (r3.data||[]).length,
        livre:         (r4.data||[]).length,
      });
      // Grouper stock par famille, uniquement MP avec stock > 0
      const stockParFamille = {};
      for (const s of (r5.data||[])) {
        if (parseFloat(s.qte_disponible||0) <= 0) continue;
        const fam = s.famille_libelle || 'Autre';
        if (!stockParFamille[fam]) stockParFamille[fam] = 0;
        stockParFamille[fam] += parseFloat(s.qte_disponible||0);
      }
      setStockMP(Object.entries(stockParFamille).map(([fam, qte]) => ({ famille_libelle:fam, qte_totale:qte })));
      setDernLivraisons([...(r3.data||[]), ...(r4.data||[])].sort((a,b) => new Date(b.date_livraison||b.date_demande) - new Date(a.date_livraison||a.date_demande)).slice(0,5));
    } catch(e) { console.error('Dashboard error:', e?.response?.config?.url, e?.response?.status, e.message); toast.error('Erreur: ' + (e?.response?.config?.url || e.message)); }
  };
  useEffect(() => { if (user?.id && !loadedRef.current) { loadedRef.current = true; charger(); } }, [user?.id]);

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#0369a1,#0284c7)', borderRadius:14, padding:'14px 20px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:16 }}>🏪 Magasin MP — Tableau de bord</div>
        <div style={{ fontSize:11, opacity:0.8, marginTop:2 }}>Vue d'ensemble des livraisons et du stock</div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'DBM en attente',    val:stats.en_attente,     bg:'#fef3c7', tx:'#92400e', icon:'📦' },
          { label:'En transit → AT3',  val:stats.en_preparation, bg:'#f3e8ff', tx:'#6d28d9', icon:'🚚' },
          { label:'Livraisons partielles', val:stats.partiel,    bg:'#fef9c3', tx:'#854d0e', icon:'⚠' },
          { label:'Livrées (total)',   val:stats.livre,          bg:'#dcfce7', tx:'#15803d', icon:'✅' },
        ].map((k,i) => (
          <div key={i} style={{ background:k.bg, borderRadius:12, padding:'14px 16px', border:`1px solid ${k.tx}30` }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{k.icon}</div>
            <div style={{ fontSize:24, fontWeight:800, color:k.tx }}>{k.val}</div>
            <div style={{ fontSize:11, color:k.tx, fontWeight:600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Stock MP par famille */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16, marginBottom:16 }}>
        <div style={{ fontWeight:700, color:'#0369a1', marginBottom:12, fontSize:13 }}>📊 Stock MP disponible par famille</div>
        {stockMP.length === 0 ? (
          <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>Stock vide</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
            {stockMP.map((s,i) => (
              <div key={i} style={{ background:'#f0f9ff', borderRadius:10, padding:'12px 14px', border:'1px solid #bae6fd' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:4 }}>{s.famille_libelle||'—'}</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#0369a1' }}>{parseFloat(s.qte_totale||0).toFixed(1)}</div>
                <div style={{ fontSize:10, color:'#6b7280' }}>kg disponible</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières livraisons */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
        <div style={{ fontWeight:700, color:'#15803d', marginBottom:12, fontSize:13 }}>📋 Dernières livraisons</div>
        {dernLivraisons.length === 0 ? (
          <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>Aucune livraison</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {dernLivraisons.map(d => (
              <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb' }}>
                <div>
                  <span style={{ fontWeight:800, fontFamily:'monospace', color:'#374151', fontSize:13 }}>{d.numero_dbm}</span>
                  <span style={{ fontSize:11, color:'#6b7280', marginLeft:8 }}>OF : {d.numero_of}</span>
                </div>
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                  <div style={{ fontWeight:700, color:'#15803d' }}>{parseFloat(d.poids_total_livre||0).toFixed(1)} kg</div>
                  <div style={{ fontSize:10, color:'#9ca3af' }}>{new Date(d.date_livraison||d.date_demande).toLocaleDateString('fr-FR')}</div>
                  <button onClick={() => ouvrirPdfSecurise(`/api/dbm/${d.id}/pdf?t=${Date.now()}`)}
                    style={{ background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                    🖨 PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop:16, textAlign:'right' }}>
        <button onClick={charger} style={{ background:'#e0f2fe', border:'1px solid #7dd3fc', color:'#0369a1', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12 }}>🔄 Actualiser</button>
      </div>
    </div>
  );
}
// Export par défaut — composant principal avec navigation
export default function DBM_StockAT3() {
  const { user } = useAuth();
  const [module, setModule] = useState(
    user?.role === 'magasinier_mp' ? 'reception' : 'dbm'
  );
  // Livraisons du magasin a receptionner : l'alerte ouvre directement l'onglet « Réception MP » et l'onglet affiche le nombre
  const [aRecevoir, setARecevoir] = useState(0);
  useEffect(() => {
    axios.get(`${API}/notifications`).then(({ data }) => {
      const n = ((data && data.items) || []).filter(i => i.ecran === 'dbm' && /réceptionner/.test(i.titre)).reduce((s, i) => s + i.nombre, 0);
      setARecevoir(n);
      if (n > 0 && user?.role !== 'magasinier_mp') setModule(prev => prev === 'dbm' ? 'reception_at3' : prev);
    }).catch(() => {});
  }, []);

  const MODULES = user?.role === 'magasinier_mp' ? [
    { id:'reception', icon:'🏪', label:'DBM à livrer', color:'#0369a1' },
  ] : [
    { id:'dbm',         icon:'📦', label:'Mes DBM',         color:'#92400e' },
    { id:'reception_at3', icon:'📥', label:'Réception MP',  color:'#7c3aed' },
  ];

  return (
    <div>
      <div style={{ background:'linear-gradient(135deg,#92400e,#b45309)', borderRadius:14, padding:'14px 20px', marginBottom:16, color:'#fff' }}>
        <div style={{ fontWeight:800, fontSize:16 }}>
          {user?.role === 'magasinier_mp' ? '🏪 Magasin MP — Gestion des livraisons' : '📦 Approvisionnement & Stock AT3'}
        </div>
        <div style={{ fontSize:11, opacity:0.8, marginTop:2 }}>
          {user?.role === 'magasinier_mp' ? 'Réception et traitement des demandes de l\'Atelier 3' : 'Demandes de besoin MP + Stock interne Atelier 3'}
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setModule(m.id)} style={{
            background: module===m.id ? m.color : '#fff',
            color: module===m.id ? '#fff' : m.color,
            border:`2px solid ${m.color}`,
            padding:'8px 18px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:13
          }}>
            {m.icon} {m.label}
            {m.id === 'reception_at3' && aRecevoir > 0 && (
              <span style={{ marginLeft:8, background:'#dc2626', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:800 }}>{aRecevoir}</span>
            )}
          </button>
        ))}
      </div>

      {module === 'dbm'           && <ModuleDBM />}
      {module === 'reception'     && <ModuleReceptionDBM />}
      {module === 'reception_at3' && <ModuleReceptionAT3 />}
      {module === 'stock_at3'     && <ModuleStockAT3 />}
    </div>
  );
}
