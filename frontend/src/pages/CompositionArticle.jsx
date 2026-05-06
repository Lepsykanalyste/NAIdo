// ============================================================
// NAIdo — COMPOSITION ARTICLE PAR GROUPE
// Fichier : CompositionArticle.jsx
//
// Utilisé dans :
// 1. Fiche Article (admin) → définir les groupes et %
// 2. DetailOF (chef AT3) → choisir les MP par groupe
// ============================================================

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

// ─────────────────────────────────────────────────────────────
// COULEURS PAR INDEX
// ─────────────────────────────────────────────────────────────
const COLORS = [
  { bg:'#dbeafe', tx:'#1d4ed8', bd:'#93c5fd', light:'#eff6ff' },
  { bg:'#fef3c7', tx:'#92400e', bd:'#fcd34d', light:'#fffbeb' },
  { bg:'#f3e8ff', tx:'#6d28d9', bd:'#c4b5fd', light:'#faf5ff' },
  { bg:'#dcfce7', tx:'#15803d', bd:'#86efac', light:'#f0fdf4' },
  { bg:'#fce7f3', tx:'#9d174d', bd:'#f9a8d4', light:'#fdf2f8' },
  { bg:'#e0f2fe', tx:'#0369a1', bd:'#7dd3fc', light:'#f0f9ff' },
];

// ══════════════════════════════════════════════════════════════
// 1. COMPOSITION DANS LA FICHE ARTICLE (Admin)
//    Définit les groupes de MP nécessaires et leurs %
// ══════════════════════════════════════════════════════════════
export function CompositionFicheArticle({ articleId }) {
  const [familles, setFamilles]   = useState([]);
  const [groupes, setGroupes]     = useState([]);
  const [lignes, setLignes]       = useState([]);   // composition actuelle
  const [loading, setLoading]     = useState(false);
  const [newLigne, setNewLigne]   = useState({ famille_id:'', groupe_id:'', pct:'' });

  useEffect(() => {
    if (!articleId) return;
    charger();
  }, [articleId]);

  const charger = async () => {
    try {
      const [fam, grp, compo] = await Promise.all([
        axios.get(`${API}/referentiels/familles`),
        axios.get(`${API}/referentiels/groupes`),
        axios.get(`${API}/articles/${articleId}/composition`),
      ]);
      setFamilles(fam.data || []);
      setGroupes(grp.data || []);
      setLignes(compo.data || []);
    } catch(e) { console.error(e); }
  };

  const groupesDeFamille = (famille_id) =>
    groupes.filter(g => String(g.famille_id) === String(famille_id));

  const totalPct = lignes.reduce((s, l) => s + parseFloat(l.pct || 0), 0);

  const ajouterLigne = () => {
    if (!newLigne.groupe_id) return toast.error('Sélectionnez un groupe');
    if (!newLigne.pct) return toast.error('Indiquez un pourcentage');
    if (lignes.find(l => String(l.groupe_id) === String(newLigne.groupe_id))) {
      return toast.error('Ce groupe est déjà dans la composition');
    }
    const grp = groupes.find(g => String(g.id) === String(newLigne.groupe_id));
    const fam = familles.find(f => String(f.id) === String(newLigne.famille_id));
    setLignes(prev => [...prev, {
      groupe_id:       grp.id,
      groupe_code:     grp.code,
      groupe_libelle:  grp.libelle,
      famille_id:      fam?.id,
      famille_libelle: fam?.libelle,
      pct:             parseFloat(newLigne.pct),
      ordre:           prev.length,
    }]);
    setNewLigne({ famille_id:'', groupe_id:'', pct:'' });
  };

  const majPct = (idx, val) => {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, pct: val } : l));
  };

  const supprimerLigne = (idx) => {
    setLignes(prev => prev.filter((_, i) => i !== idx));
  };

  const sauvegarder = async () => {
    if (Math.abs(totalPct - 100) > 0.1) {
      return toast.error(`Total ${totalPct.toFixed(1)}% — doit être 100%`);
    }
    setLoading(true);
    try {
      await axios.put(`${API}/articles/${articleId}/composition`, { lignes });
      toast.success('✓ Composition sauvegardée');
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#374151' }}>
          🧪 Composition par groupe de matières
        </div>
        <div style={{
          background: Math.abs(totalPct-100)<0.1 ? '#dcfce7' : '#fee2e2',
          color:      Math.abs(totalPct-100)<0.1 ? '#15803d' : '#dc2626',
          padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:800
        }}>
          {totalPct.toFixed(1)}% {Math.abs(totalPct-100)<0.1 ? '✓' : `— manque ${(100-totalPct).toFixed(1)}%`}
        </div>
      </div>

      {/* Lignes existantes */}
      {lignes.length > 0 && (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:12 }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              {['Famille','Groupe','% dans formule',''].map(h => (
                <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const clr = COLORS[i % COLORS.length];
              return (
                <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'8px 10px', fontSize:11, color:'#6b7280' }}>{l.famille_libelle || '—'}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <span style={{ background:clr.bg, color:clr.tx, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                      {l.groupe_libelle}
                    </span>
                  </td>
                  <td style={{ padding:'8px 10px', width:120 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input type="number" value={l.pct} min="0" max="100" step="0.1"
                        onChange={e => majPct(i, e.target.value)}
                        style={{ width:70, border:'1px solid #d1d5db', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                      <span style={{ fontSize:12 }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding:'8px 10px' }}>
                    <button onClick={() => supprimerLigne(i)}
                      style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Ajouter groupe */}
      <div style={{ background:'#f8fafc', borderRadius:8, padding:12, border:'1px dashed #d1d5db', marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:8 }}>+ Ajouter un groupe</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px auto', gap:8, alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:10, fontWeight:600, display:'block', marginBottom:3 }}>Famille</label>
            <select value={newLigne.famille_id}
              onChange={e => setNewLigne({ ...newLigne, famille_id: e.target.value, groupe_id:'' })}
              style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:12 }}>
              <option value="">-- Famille --</option>
              {familles.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:600, display:'block', marginBottom:3 }}>Groupe *</label>
            <select value={newLigne.groupe_id}
              onChange={e => setNewLigne({ ...newLigne, groupe_id: e.target.value })}
              style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:12 }}>
              <option value="">-- Groupe --</option>
              {(newLigne.famille_id ? groupesDeFamille(newLigne.famille_id) : groupes)
                .filter(g => !lignes.find(l => String(l.groupe_id) === String(g.id)))
                .map(g => <option key={g.id} value={g.id}>{g.libelle}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:600, display:'block', marginBottom:3 }}>% *</label>
            <input type="number" value={newLigne.pct} min="0" max="100" step="0.1"
              onChange={e => setNewLigne({ ...newLigne, pct: e.target.value })}
              placeholder="0"
              style={{ width:'100%', border:'1px solid #fcd34d', borderRadius:6, padding:'7px', fontSize:13, textAlign:'center', fontWeight:700, boxSizing:'border-box' }} />
          </div>
          <button onClick={ajouterLigne}
            style={{ background:'#374151', color:'#fff', border:'none', padding:'8px 14px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:12 }}>
            + Ajouter
          </button>
        </div>
      </div>

      {/* Bouton sauvegarder */}
      <button onClick={sauvegarder} disabled={loading || lignes.length === 0}
        style={{
          background: lignes.length && Math.abs(totalPct-100)<0.1 ? '#15803d' : '#9ca3af',
          color:'#fff', border:'none', padding:'9px 20px', borderRadius:8,
          cursor: lignes.length ? 'pointer' : 'not-allowed', fontWeight:700, fontSize:13
        }}>
        {loading ? '...' : '💾 Sauvegarder la composition'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 2. COMPOSITION DANS L'OF (Chef AT3)
//    Affiche les groupes de l'article → chef choisit les MP
// ══════════════════════════════════════════════════════════════
export function CompositionOF({ detail, configOf, setConfigOf, onSaved, onClose }) {
  const [groupes, setGroupes]           = useState([]);  // groupes de la composition article
  const [choixMp, setChoixMp]           = useState({});  // { groupe_id: [{mp_id, code, pct, quantite}] }
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (detail?.article_id) chargerGroupes();
  }, [detail?.article_id]);

  // Recalculer quantités quand poids cible change
  useEffect(() => {
    const poids = parseFloat(configOf?.at3_poids_cible_kg || 0);
    if (!poids) return;
    setChoixMp(prev => {
      const updated = {};
      for (const gid in prev) {
        updated[gid] = prev[gid].map(m => ({
          ...m,
          quantite: m.pct ? ((parseFloat(m.pct)/100)*poids).toFixed(3) : ''
        }));
      }
      return updated;
    });
  }, [configOf?.at3_poids_cible_kg]);

  const chargerGroupes = async () => {
    try {
      const { data } = await axios.get(`${API}/dbm/of/${detail.id}/besoins`);
      setGroupes(data.groupes || []);
      // Pré-remplir depuis la composition déjà sauvegardée
      const saved = detail.at3_composition_of;
      const savedArr = Array.isArray(saved) ? saved : (saved ? JSON.parse(saved) : []);
      if (savedArr.length > 0) {
        const preload = {};
        for (const m of savedArr) {
          const gid = String(m.famille_id || m.groupe_id);
          if (!preload[gid]) preload[gid] = [];
          preload[gid].push({
            mp_id:       m.mp_id,
            code:        m.code,
            designation: m.designation,
            pct:         m.pct || '',
            quantite:    m.quantite || '',
          });
        }
        setChoixMp(preload);
      }
    } catch(e) { console.error(e); }
  };

  const ajouterMp = (groupe_id, article) => {
    const gid = String(groupe_id);
    setChoixMp(prev => {
      const existing = prev[gid] || [];
      if (existing.find(m => m.mp_id === article.id)) return prev;
      const poids = parseFloat(configOf?.at3_poids_cible_kg || 0);
      return {
        ...prev,
        [gid]: [...existing, {
          mp_id:       article.id,
          code:        article.code,
          designation: article.designation,
          pct:         '',
          quantite:    '',
          stock_at3:   parseFloat(article.stock_at3 || 0),
          stock_mag:   parseFloat(article.stock_magasin || 0),
        }]
      };
    });
  };

  const majPct = (groupe_id, idx, val) => {
    const gid = String(groupe_id);
    const poids = parseFloat(configOf?.at3_poids_cible_kg || 0);
    setChoixMp(prev => ({
      ...prev,
      [gid]: (prev[gid]||[]).map((m, i) => i !== idx ? m : {
        ...m, pct: val,
        quantite: poids > 0 ? ((parseFloat(val||0)/100)*poids).toFixed(3) : ''
      })
    }));
  };

  const supprimerMp = (groupe_id, idx) => {
    const gid = String(groupe_id);
    setChoixMp(prev => ({ ...prev, [gid]: (prev[gid]||[]).filter((_,i)=>i!==idx) }));
  };

  // Total % global
  const totalPct = Object.values(choixMp).flat().reduce((s, m) => s + parseFloat(m.pct||0), 0);

  const sauvegarder = async (valider = false) => {
    if (valider && Math.abs(totalPct-100) > 0.1) return toast.error(`Total ${totalPct.toFixed(1)}% — doit être 100%`);
    if (valider && !configOf?.at3_poids_cible_kg) return toast.error('Poids cible requis');
    if (valider) {
      for (const g of groupes) {
        const gmp = choixMp[String(g.groupe_id)] || [];
        if (gmp.length === 0) return toast.error(`Groupe "${g.groupe_libelle}" : aucune MP sélectionnée`);
        const totalG = gmp.reduce((s,m)=>s+parseFloat(m.pct||0),0);
        if (Math.abs(totalG - g.pct) > 0.1) return toast.error(`Groupe "${g.groupe_libelle}" : total ${totalG.toFixed(1)}% ≠ ${g.pct}% attendu`);
      }
    }
    setLoading(true);
    try {
      const composition_of = Object.entries(choixMp).flatMap(([gid, mps]) => {
        const g = groupes.find(x => String(x.groupe_id) === gid);
        return mps.map(m => ({
          mp_id: m.mp_id, code: m.code, designation: m.designation,
          pct: m.pct, quantite: m.quantite,
          famille_id: g?.groupe_id, famille_libelle: g?.groupe_libelle,
          groupe_id: g?.groupe_id, groupe_libelle: g?.groupe_libelle,
        }));
      });
      await axios.put(`${API}/at3/of/${detail.id}/configurer`, {
        ...configOf,
        composition_of,
        at3_composition_familles: groupes.map(g => ({
          famille_id: g.groupe_id, groupe_id: g.groupe_id,
          famille_code: g.groupe_code, famille_libelle: g.groupe_libelle,
          pct_famille: g.pct, pct: g.pct,
          mp_choisies: (choixMp[String(g.groupe_id)]||[]).map(m=>({
            mp_id:m.mp_id,code:m.code,designation:m.designation,pct:m.pct,quantite:m.quantite,qte_dispo:m.stock_at3
          })),
        })),
        valider,
      });
      toast.success(valider ? '✅ Composition validée — Extrusion lancée !' : '💾 Composition sauvegardée');
      if (onSaved) onSaved();
      if (valider && onClose) onClose();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  if (!groupes.length) return (
    <div style={{ padding:16, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
      <div style={{ fontSize:28, marginBottom:8 }}>⚠</div>
      Aucune composition définie pour cet article.<br/>
      <span style={{ fontSize:11 }}>L'admin doit configurer la composition dans la fiche article.</span>
    </div>
  );

  return (
    <div>
      {/* Paramètres production */}
      <div style={{ background:'#f8fafc', borderRadius:8, padding:12, marginBottom:14, border:'1px solid #e5e7eb' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
          ⚙ Paramètres production
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
          {[
            ['Poids cible (kg) *', 'at3_poids_cible_kg'],
            ['Nb bobines prévues', 'at3_nb_bobines_cibles'],
            ['Machine (ID)', 'at3_machine_assignee_id'],
          ].map(([label, key]) => (
            <div key={key}>
              <label style={{ fontSize:10, fontWeight:600, display:'block', marginBottom:2 }}>{label}</label>
              <input type="number" value={configOf?.[key]||''} onChange={e => setConfigOf(p=>({...p,[key]:e.target.value}))}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:13, textAlign:'center', fontWeight:700, boxSizing:'border-box' }} />
            </div>
          ))}
        </div>
        <div>
          <label style={{ fontSize:10, fontWeight:600, display:'block', marginBottom:2 }}>Instructions régleur</label>
          <textarea value={configOf?.at3_notes_regleur||''} onChange={e => setConfigOf(p=>({...p,at3_notes_regleur:e.target.value}))}
            rows={2} placeholder="Températures, vitesses, consignes..."
            style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:12, resize:'vertical', boxSizing:'border-box' }} />
        </div>
      </div>

      {/* Total % */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>Composition par groupe</div>
        <div style={{
          background: Math.abs(totalPct-100)<0.1?'#dcfce7':totalPct>100?'#fee2e2':'#fef3c7',
          color:      Math.abs(totalPct-100)<0.1?'#15803d':totalPct>100?'#dc2626':'#92400e',
          padding:'3px 14px', borderRadius:20, fontSize:13, fontWeight:800
        }}>
          Total : {totalPct.toFixed(1)}% {Math.abs(totalPct-100)<0.1?'✓':''}
        </div>
      </div>

      {/* Groupes */}
      {groupes.map((g, gi) => {
        const clr = COLORS[gi % COLORS.length];
        const gid = String(g.groupe_id);
        const mpsChoisis = choixMp[gid] || [];
        const totalGroupe = mpsChoisis.reduce((s,m)=>s+parseFloat(m.pct||0),0);
        const poids = parseFloat(configOf?.at3_poids_cible_kg || 0);
        const qteGroupe = poids > 0 ? ((g.pct/100)*poids).toFixed(1) : '—';

        return (
          <div key={gi} style={{ border:`2px solid ${clr.bd}`, borderRadius:10, overflow:'hidden', marginBottom:10 }}>
            {/* Header groupe */}
            <div style={{ background:clr.bg, padding:'9px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ fontWeight:800, color:clr.tx, fontSize:14 }}>{g.groupe_libelle}</span>
                <span style={{ marginLeft:10, background:'#fff', color:clr.tx, padding:'1px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                  {g.pct}% de l'OF
                </span>
                {poids > 0 && (
                  <span style={{ marginLeft:8, fontSize:11, color:clr.tx }}>= {qteGroupe} kg</span>
                )}
              </div>
              <span style={{
                background: Math.abs(totalGroupe-g.pct)<0.1?'#15803d':'#dc2626',
                color:'#fff', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700
              }}>
                {totalGroupe.toFixed(1)} / {g.pct}% {Math.abs(totalGroupe-g.pct)<0.1?'✓':''}
              </span>
            </div>

            <div style={{ padding:'10px 14px', background:'#fff' }}>
              {/* MP choisies */}
              {mpsChoisis.length > 0 && (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginBottom:10 }}>
                  <thead>
                    <tr style={{ background:clr.light }}>
                      {['MP sélectionnée','Stock AT3','Stock Mag.','% dans OF','Quantité (kg)',''].map(h=>(
                        <th key={h} style={{ padding:'5px 8px', textAlign:'left', fontSize:10, fontWeight:600, color:clr.tx }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mpsChoisis.map((m, mi) => {
                      const qteNec = poids > 0 ? ((parseFloat(m.pct||0)/100)*poids).toFixed(3) : '—';
                      const insuf = m.stock_at3 > 0 && parseFloat(m.quantite||0) > m.stock_at3;
                      return (
                        <tr key={mi} style={{ borderBottom:`1px solid ${clr.bd}` }}>
                          <td style={{ padding:'6px 8px' }}>
                            <div style={{ fontWeight:700, color:clr.tx }}>{m.code}</div>
                            <div style={{ fontSize:10, color:'#6b7280' }}>{m.designation}</div>
                          </td>
                          <td style={{ padding:'6px 8px', fontWeight:600, color: m.stock_at3>0?(insuf?'#dc2626':'#15803d'):'#9ca3af', fontSize:11 }}>
                            {m.stock_at3>0?`${parseFloat(m.stock_at3).toFixed(1)} kg`:'—'}
                            {insuf&&' ⚠'}
                          </td>
                          <td style={{ padding:'6px 8px', color:'#0369a1', fontSize:11 }}>
                            {m.stock_mag>0?`${parseFloat(m.stock_mag).toFixed(1)} kg`:'—'}
                          </td>
                          <td style={{ padding:'6px 8px', width:90 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <input type="number" value={m.pct} min="0" max="100" step="0.1"
                                onChange={e => majPct(g.groupe_id, mi, e.target.value)}
                                style={{ width:60, border:`1px solid ${clr.bd}`, borderRadius:5, padding:'4px', fontSize:12, textAlign:'center', fontWeight:700 }} />
                              <span style={{ fontSize:10 }}>%</span>
                            </div>
                          </td>
                          <td style={{ padding:'6px 8px', fontWeight:700, color:clr.tx, fontSize:12 }}>
                            {m.quantite ? `${m.quantite} kg` : (poids>0 ? qteNec+' kg' : '—')}
                          </td>
                          <td style={{ padding:'6px 8px' }}>
                            <button onClick={() => supprimerMp(g.groupe_id, mi)}
                              style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:5, padding:'3px 7px', cursor:'pointer', fontSize:11 }}>
                              🗑
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Articles disponibles dans ce groupe */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>
                  + Ajouter une MP :
                </span>
                {g.articles?.filter(a => !mpsChoisis.find(m => m.mp_id === a.id)).map(a => (
                  <button key={a.id} onClick={() => ajouterMp(g.groupe_id, a)} style={{
                    background: parseFloat(a.stock_at3||0)>0 ? clr.bg : '#f3f4f6',
                    color:      parseFloat(a.stock_at3||0)>0 ? clr.tx : '#9ca3af',
                    border: `1px solid ${clr.bd}`,
                    borderRadius:20, padding:'4px 12px', cursor:'pointer', fontSize:11, fontWeight:600
                  }}>
                    + {a.code}
                    <span style={{ fontSize:9, marginLeft:4, opacity:0.8 }}>
                      AT3: {parseFloat(a.stock_at3||0).toFixed(0)}kg
                      {parseFloat(a.stock_magasin||0)>0 && ` | Mag: ${parseFloat(a.stock_magasin).toFixed(0)}kg`}
                    </span>
                  </button>
                ))}
                {(!g.articles || g.articles.length === 0) && (
                  <span style={{ fontSize:11, color:'#dc2626' }}>
                    ⚠ Aucune MP dans ce groupe — créez-en dans Matières Premières
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Boutons */}
      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <button onClick={() => sauvegarder(false)} disabled={loading}
          style={{ background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
          💾 Sauvegarder
        </button>
        <button onClick={() => sauvegarder(true)}
          disabled={loading || detail?.at3_statut_zone==='extrusion'}
          style={{
            background: Math.abs(totalPct-100)<0.1 && configOf?.at3_poids_cible_kg ? '#14532d' : '#9ca3af',
            color:'#fff', border:'none', padding:'9px 22px', borderRadius:8,
            cursor: Math.abs(totalPct-100)<0.1 && configOf?.at3_poids_cible_kg ? 'pointer' : 'not-allowed',
            fontWeight:700, fontSize:14
          }}>
          {loading ? '...' : '✅ Valider & Lancer Extrusion'}
        </button>
        {detail?.at3_statut_zone === 'extrusion' && (
          <span style={{ background:'#fef3c7', color:'#92400e', padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600 }}>
            ⚙ Déjà en extrusion
          </span>
        )}
      </div>
    </div>
  );
}

export default { CompositionFicheArticle, CompositionOF };
