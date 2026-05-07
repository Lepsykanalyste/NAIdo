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

import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';

const API = '/api';

// ─────────────────────────────────────────────────────────────
// STATUTS DBM
// ─────────────────────────────────────────────────────────────
const STATUT_DBM = {
  en_attente:    { bg:'#fef3c7', tx:'#92400e', label:'En attente' },
  approuve:      { bg:'#dbeafe', tx:'#1d4ed8', label:'Approuvé' },
  en_preparation:{ bg:'#f3e8ff', tx:'#6d28d9', label:'En préparation' },
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
export function ModuleDBM() {
  const { user } = useAuth();
  const [dbms, setDbms]           = useState([]);
  const [ofs, setOfs]             = useState([]);
  const [ofSel, setOfSel]         = useState(null);
  const [besoins, setBesoins]     = useState([]);
  const [lignes, setLignes]       = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [urgence, setUrgence]     = useState(false);
  const [dateBesoin, setDateBesoin] = useState('');
  const [notes, setNotes]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [detail, setDetail]       = useState(null);

  const charger = async () => {
    try {
      const [d, o] = await Promise.all([
        axios.get(`${API}/dbm`),
        axios.get(`${API}/at3/of`),
      ]);
      setDbms(d.data || []);
      setOfs((o.data || []).filter(o => o.at3_composition_validee));
    } catch { toast.error('Erreur chargement'); }
  };

  useEffect(() => { charger(); }, []);

  const selectionnerOf = async (of_id) => {
    const of = ofs.find(o => o.id === of_id);
    setOfSel(of);
    setLignes([]);
    if (!of_id) return;
    try {
      const { data } = await axios.get(`${API}/dbm/of/${of_id}/besoins`);
      setBesoins(data.besoins || []);
      // Pré-remplir lignes avec quantités à demander
      setLignes((data.besoins || [])
        .filter(b => b.qte_a_demander > 0)
        .map(b => ({
          article_id:      null,
          famille_id:      b.famille_id || b.groupe_id,
          code:            b.groupe_code || b.groupe_libelle,
          designation:     b.groupe_libelle,
          famille_libelle: b.groupe_libelle,
          qte_necessaire:  b.qte_necessaire,
          qte_dispo_at3:   b.qte_dispo_at3,
          qte_dispo_mag:   b.qte_dispo_mag || 0,
          qte_demandee:    b.qte_a_demander,
          unite:           'kg',
        }))
      );
    } catch { toast.error('Erreur calcul besoins'); }
  };

  const majQte = (idx, val) => {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, qte_demandee: val } : l));
  };

  const supprimerLigne = (idx) => setLignes(prev => prev.filter((_, i) => i !== idx));

  const creerDbm = async () => {
    if (!ofSel) return toast.error('Sélectionnez un OF');
    if (!lignes.length) return toast.error('Aucune MP à demander');
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
      const { data } = await axios.get(`${API}/dbm/${id}`);
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

          {/* Lignes à demander */}
          {lignes.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:700, color:'#374151', marginBottom:10, fontSize:13 }}>
                📋 Matières à demander au Magasin MP
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#fef3c7' }}>
                    {['MP', 'Famille', 'Besoin total', 'Stock AT3', 'Stock Mag. MP', 'Qté à demander', ''].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#92400e' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #fef3c7', background: i%2===0?'#fff':'#fffbeb' }}>
                      <td style={{ padding:'8px 10px' }}>
                        <div style={{ fontWeight:700, color:'#92400e', marginBottom:2 }}>{l.famille_libelle||l.code}</div>
                        <select value={l.article_id||''} onChange={e => {
                          const art = (besoins.find(b=>String(b.groupe_id||b.famille_id)===String(l.famille_id))?.articles||[]).find(a=>a.id===e.target.value);
                          setLignes(prev=>prev.map((x,j)=>j!==i?x:{...x,article_id:e.target.value,code:art?.code||x.code,designation:art?.designation||x.designation,qte_dispo_mag:parseFloat(art?.stock_magasin||0)}));
                        }} style={{fontSize:11,border:'1px solid #fcd34d',borderRadius:5,padding:'3px 6px',width:'100%'}}>
                          <option value="">-- Choisir MP --</option>
                          {(besoins.find(b=>String(b.groupe_id||b.famille_id)===String(l.famille_id))?.articles||[]).filter(a=>parseFloat(a.stock_magasin||0)>0).map(a=>(
                            <option key={a.id} value={a.id}>{a.code} — {parseFloat(a.stock_magasin||0).toFixed(0)} kg dispo</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'#6b7280' }}>{l.famille_libelle}</td>
                      <td style={{ padding:'8px 10px', fontWeight:600 }}>{l.qte_necessaire} kg</td>
                      <td style={{ padding:'8px 10px', color: l.qte_dispo_at3 > 0 ? '#15803d' : '#9ca3af' }}>
                        {l.qte_dispo_at3} kg
                      </td>
                      <td style={{ padding:'8px 10px', color: l.qte_dispo_mag > 0 ? '#0369a1' : '#dc2626' }}>
                        {l.qte_dispo_mag} kg
                        {l.qte_dispo_mag < l.qte_demandee && <span style={{ color:'#dc2626', fontSize:10 }}> ⚠</span>}
                      </td>
                      <td style={{ padding:'8px 10px', width:110 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <input type="number" value={l.qte_demandee} min="0" step="0.1"
                            max={l.qte_dispo_mag||undefined}
                            onChange={e => { const v=parseFloat(e.target.value||0); const max=parseFloat(l.qte_dispo_mag||0); if(max>0&&v>max){majQte(i,max);}else{majQte(i,e.target.value);} }}
                            style={{ width:80, border:'2px solid #fcd34d', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                          <span style={{ fontSize:11 }}>kg</span>
                        </div>
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
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, color:'#92400e' }}>{parseFloat(d.poids_total_demande||0).toFixed(1)} kg</div>
                <div style={{ fontSize:11, color:'#15803d' }}>Livré : {parseFloat(d.poids_total_livre||0).toFixed(1)} kg</div>
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

  const charger = async () => {
    try {
      const { data } = await axios.get(`${API}/dbm?statut=en_attente`);
      // Aussi partielles
      const { data: partiel } = await axios.get(`${API}/dbm?statut=partiel`);
      setDbms([...data, ...partiel]);
    } catch { toast.error('Erreur'); }
  };

  useEffect(() => { charger(); }, []);

  const ouvrirDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/dbm/${id}`);
      setDetail(data);
      setLivraisons((data.lignes || []).map(l => ({
        ligne_id:   l.id,
        article_id: l.article_id,
        famille_id: l.famille_id,
        code:       l.code,
        designation:l.designation,
        qte_demandee: l.qte_demandee,
        qte_restante: l.qte_restante,
        qte_livree:  parseFloat(l.qte_restante || 0).toFixed(1),
        numero_lot: '',
      })));
    } catch { toast.error('Erreur'); }
  };

  const livrer = async () => {
    if (!detail) return;
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
                  <td style={{ padding:'7px 10px', width:130 }}>
                    <input type="text" value={l.numero_lot} placeholder="N° lot"
                      onChange={e => setLivraisons(prev => prev.map((x,xi) => xi===i?{...x,numero_lot:e.target.value}:x))}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'5px', fontSize:12, boxSizing:'border-box' }} />
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
              style={{ background:'#0369a1', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
              {loading ? '...' : '✅ Valider Livraison → AT3'}
            </button>
            <button onClick={() => setDetail(null)} style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste DBM en attente */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {dbms.map(d => (
          <div key={d.id} style={{
            background: d.urgence ? '#fff7f0' : '#fff',
            borderRadius:10, padding:'12px 16px',
            border:`2px solid ${d.urgence ? '#fed7aa' : '#bae6fd'}`,
            cursor:'pointer'
          }} onClick={() => ouvrirDetail(d.id)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:800, fontFamily:'monospace', color:'#0369a1' }}>{d.numero_dbm}</span>
                  <Badge statut={d.statut} map={STATUT_DBM} />
                  {d.urgence && <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 6px', borderRadius:20, fontSize:10, fontWeight:700 }}>🚨 URGENT</span>}
                </div>
                <div style={{ fontSize:12, color:'#374151' }}>OF : {d.numero_of} | {d.nb_lignes} MP | AT3</div>
                <div style={{ fontSize:11, color:'#9ca3af' }}>{new Date(d.date_demande).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, color:'#0369a1', fontSize:15 }}>{parseFloat(d.poids_total_demande||0).toFixed(1)} kg</div>
                <div style={{ fontSize:12, color:'#1d4ed8', fontWeight:600 }}>→ Préparer</div>
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE STOCK AT3 — Inventaire interne
// ══════════════════════════════════════════════════════════════
export function ModuleStockAT3() {
  const [stock, setStock]   = useState([]);
  const [resume, setResume] = useState([]);
  const [mvts, setMvts]     = useState([]);
  const [onglet, setOnglet] = useState('stock');

  const charger = async () => {
    try {
      const [s, r, m] = await Promise.all([
        axios.get(`${API}/dbm/stock-at3/liste`),
        axios.get(`${API}/dbm/stock-at3/resume`),
        axios.get(`${API}/dbm/stock-at3/mouvements`),
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

// Export par défaut — composant principal avec navigation
export default function DBM_StockAT3() {
  const { user } = useAuth();
  const [module, setModule] = useState(
    user?.role === 'magasinier_mp' ? 'reception' : 'dbm'
  );

  const MODULES = user?.role === 'magasinier_mp' ? [
    { id:'reception', icon:'🏪', label:'DBM à livrer', color:'#0369a1' },
  ] : [
    { id:'dbm',       icon:'📦', label:'Mes DBM',       color:'#92400e' },
    { id:'stock_at3', icon:'🏗',  label:'Stock AT3',     color:'#15803d' },
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
          </button>
        ))}
      </div>

      {module === 'dbm'       && <ModuleDBM />}
      {module === 'reception' && <ModuleReceptionDBM />}
      {module === 'stock_at3' && <ModuleStockAT3 />}
    </div>
  );
}
