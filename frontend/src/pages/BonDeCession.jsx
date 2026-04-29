import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

const TYPE_LABELS = {
  cession_atelier: 'Bon de Cession (Atelier → Magasin)',
  livraison_mp: 'Bon de Livraison MP (Magasin → Atelier)',
  livraison_pf_interne: 'Livraison Interne (Atelier → Atelier)',
  reception_achat: 'Bon de Réception Achat',
  expedition_vente: "Bon d'Expédition Vente",
  retour_atelier: 'Bon de Retour Atelier',
};

const STATUT_COLORS = {
  brouillon:   { bg:'#f3f4f6', text:'#374151', border:'#d1d5db' },
  valide:      { bg:'#dcfce7', text:'#15803d', border:'#86efac' },
  expedie:     { bg:'#dbeafe', text:'#1d4ed8', border:'#93c5fd' },
  receptionne: { bg:'#e0e7ff', text:'#4338ca', border:'#a5b4fc' },
  annule:      { bg:'#fee2e2', text:'#dc2626', border:'#fca5a5' },
};

export default function BonDeCession() {
  const [vue, setVue] = useState('liste'); // liste | creer | detail
  const [mouvements, setMouvements] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [mvtSelectionne, setMvtSelectionne] = useState(null);
  const [filtreType, setFiltreType] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');

  // Formulaire création
  const [form, setForm] = useState({
    type_mouvement: 'cession_atelier',
    atelier_source_id: '', atelier_dest_id: '',
    emplacement_source_id: '', emplacement_dest_id: '',
    date_mouvement: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [lignes, setLignes] = useState([{ article_id:'', qte_prevue:'', poids_theorique_kg:'', prix_unitaire:'', unite_id:'' }]);
  const [submitting, setSubmitting] = useState(false);

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtreType) params.append('type_mouvement', filtreType);
      if (filtreStatut) params.append('statut', filtreStatut);
      const [mvts, ats, arts, empls] = await Promise.all([
        axios.get(`${API}/mouvements?${params}`),
        axios.get(`${API}/ateliers`),
        axios.get(`${API}/articles?actif=true`),
        axios.get(`${API}/emplacements`),
      ]);
      setMouvements(mvts.data);
      setAteliers(ats.data);
      setArticles(arts.data);
      setEmplacements(empls.data);
    } catch { toast.error('Erreur chargement'); }
  }, [filtreType, filtreStatut]);

  useEffect(() => { charger(); }, [charger]);

  const ajouterLigne = () => setLignes([...lignes, { article_id:'', qte_prevue:'', poids_theorique_kg:'', prix_unitaire:'', unite_id:'' }]);
  const supprimerLigne = (i) => setLignes(lignes.filter((_,idx) => idx!==i));
  const updateLigne = (i, field, val) => {
    const nl = [...lignes];
    nl[i][field] = val;
    // Auto-remplir poids théorique depuis article
    if (field === 'article_id') {
      const art = articles.find(a => a.id === val);
      if (art) {
        nl[i].poids_theorique_kg = art.poids_theorique_kg || '';
        nl[i].unite_id = art.unite_mesure_id || '';
        nl[i].prix_unitaire = art.prix_cession_interne || art.prix_vente || '';
      }
    }
    setLignes(nl);
  };

  const creerBon = async () => {
    if (!form.type_mouvement) return toast.error('Type de mouvement requis');
    const lignesValides = lignes.filter(l => l.article_id && l.qte_prevue);
    if (!lignesValides.length) return toast.error('Ajoutez au moins une ligne avec article et quantité');
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/mouvements`, { ...form, lignes: lignesValides });
      toast.success(`Bon ${data.numero_bon} créé`);
      setVue('liste'); charger();
      setForm({ type_mouvement:'cession_atelier', atelier_source_id:'', atelier_dest_id:'', emplacement_source_id:'', emplacement_dest_id:'', date_mouvement: new Date().toISOString().split('T')[0], notes:'' });
      setLignes([{ article_id:'', qte_prevue:'', poids_theorique_kg:'', prix_unitaire:'', unite_id:'' }]);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur création'); }
    finally { setSubmitting(false); }
  };

  const validerBon = async (id) => {
    try {
      const { data } = await axios.put(`${API}/mouvements/${id}/valider`);
      toast.success('Bon validé — stock mis à jour');
      charger();
      if (mvtSelectionne?.id === id) {
        const { data: mvt } = await axios.get(`${API}/mouvements/${id}`);
        setMvtSelectionne(mvt);
      }
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur validation'); }
  };

  const telechargerPDF = async (id) => {
    try {
      const { data } = await axios.get(`${API}/mouvements/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch { toast.error('PDF non disponible'); }
  };

  const voirDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/mouvements/${id}`);
      setMvtSelectionne(data);
      setVue('detail');
    } catch { toast.error('Erreur chargement'); }
  };

  const s = (style) => style;

  return (
    <div style={{ fontFamily:'system-ui,sans-serif' }}>
      {/* Barre actions */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:8 }}>
          {['liste','creer'].map(v => (
            <button key={v} onClick={() => setVue(v)} style={{
              padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:13,
              background: vue===v ? '#14532d' : '#f3f4f6', color: vue===v ? '#fff' : '#374151'
            }}>{v==='liste' ? '📋 Liste des bons' : '+ Nouveau bon'}</button>
          ))}
        </div>
        {vue === 'liste' && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)}
              style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'7px 12px', fontSize:13 }}>
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
              style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'7px 12px', fontSize:13 }}>
              <option value="">Tous les statuts</option>
              {['brouillon','valide','expedie','receptionne','annule'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* LISTE */}
      {vue === 'liste' && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f0fdf4' }}>
                {['N° Bon','Type','Source','Destination','Date','Lignes','Poids','Statut','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m,i) => {
                const sc = STATUT_COLORS[m.statut] || STATUT_COLORS.brouillon;
                return (
                  <tr key={m.id} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb', cursor:'pointer' }}
                      onClick={() => voirDetail(m.id)}>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:'#14532d' }}>{m.numero_bon}</td>
                    <td style={{ padding:'10px 12px', fontSize:11 }}>{TYPE_LABELS[m.type_mouvement]?.split('(')[0] || m.type_mouvement}</td>
                    <td style={{ padding:'10px 12px' }}>{m.source_code || '—'}</td>
                    <td style={{ padding:'10px 12px' }}>{m.dest_code || '—'}</td>
                    <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>{new Date(m.date_mouvement||m.created_at).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding:'10px 12px', textAlign:'center' }}>{m.nb_lignes}</td>
                    <td style={{ padding:'10px 12px' }}>{m.poids_total_kg ? `${parseFloat(m.poids_total_kg).toFixed(1)} kg` : '—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:sc.bg, color:sc.text, border:`1px solid ${sc.border}`, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                        {m.statut}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        {m.statut === 'brouillon' && (
                          <button onClick={() => validerBon(m.id)}
                            style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                            ✓ Valider
                          </button>
                        )}
                        {m.pdf_path && (
                          <button onClick={() => telechargerPDF(m.id)}
                            style={{ background:'#dbeafe', color:'#1d4ed8', border:'1px solid #93c5fd', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mouvements.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'#9ca3af' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📦</div>
              <p>Aucun bon de mouvement</p>
              <button onClick={() => setVue('creer')} style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, cursor:'pointer', marginTop:8, fontWeight:600 }}>
                + Créer le premier bon
              </button>
            </div>
          )}
        </div>
      )}

      {/* CRÉER */}
      {vue === 'creer' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:900 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #e5e7eb' }}>
            <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:700, color:'#14532d' }}>Nouveau bon de mouvement</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Type de mouvement *</label>
                <select value={form.type_mouvement} onChange={e => setForm({...form, type_mouvement:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                  {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Atelier source</label>
                <select value={form.atelier_source_id} onChange={e => setForm({...form, atelier_source_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                  <option value="">Sélectionner...</option>
                  {ateliers.map(a => <option key={a.id} value={a.id}>{a.code} — {a.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Atelier destination</label>
                <select value={form.atelier_dest_id} onChange={e => setForm({...form, atelier_dest_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                  <option value="">Sélectionner...</option>
                  {ateliers.map(a => <option key={a.id} value={a.id}>{a.code} — {a.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Emplacement source</label>
                <select value={form.emplacement_source_id} onChange={e => setForm({...form, emplacement_source_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                  <option value="">Sélectionner...</option>
                  {emplacements.map(e => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Emplacement destination</label>
                <select value={form.emplacement_dest_id} onChange={e => setForm({...form, emplacement_dest_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                  <option value="">Sélectionner...</option>
                  {emplacements.map(e => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Date</label>
                <input type="date" value={form.date_mouvement} onChange={e => setForm({...form, date_mouvement:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={2}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13, resize:'vertical', boxSizing:'border-box' }}
                placeholder="Instructions, observations..."/>
            </div>
          </div>

          {/* Lignes articles */}
          <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #e5e7eb' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:'#374151' }}>Lignes articles</h4>
              <button onClick={ajouterLigne} style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                + Ligne
              </button>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    {['Article *','Quantité *','Poids théo. (kg)','Prix unit.',''].map(h => (
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding:'6px 8px' }}>
                        <select value={l.article_id} onChange={e => updateLigne(i,'article_id',e.target.value)}
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:13 }}>
                          <option value="">Sélectionner...</option>
                          {articles.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        <input type="number" value={l.qte_prevue} onChange={e => updateLigne(i,'qte_prevue',e.target.value)}
                          style={{ width:'90px', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:13, textAlign:'center' }}
                          placeholder="0"/>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        <input type="number" value={l.poids_theorique_kg} onChange={e => updateLigne(i,'poids_theorique_kg',e.target.value)}
                          style={{ width:'100px', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:13, textAlign:'center' }}
                          placeholder="0.000"/>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        <input type="number" value={l.prix_unitaire} onChange={e => updateLigne(i,'prix_unitaire',e.target.value)}
                          style={{ width:'90px', border:'1px solid #d1d5db', borderRadius:6, padding:'7px', fontSize:13, textAlign:'center' }}
                          placeholder="0"/>
                      </td>
                      <td style={{ padding:'6px 8px' }}>
                        {lignes.length > 1 && (
                          <button onClick={() => supprimerLigne(i)} style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'6px 10px', cursor:'pointer', fontSize:13 }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={creerBon} disabled={submitting}
              style={{ background: submitting ? '#d1d5db' : '#14532d', color:'#fff', border:'none', padding:'14px 32px', borderRadius:12, cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:15 }}>
              {submitting ? 'Création...' : '✓ Créer le bon'}
            </button>
            <button onClick={() => setVue('liste')} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'14px 24px', borderRadius:12, cursor:'pointer', fontWeight:600 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* DETAIL */}
      {vue === 'detail' && mvtSelectionne && (
        <div>
          <button onClick={() => setVue('liste')} style={{ background:'#f3f4f6', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', marginBottom:16, fontSize:13 }}>
            ← Retour à la liste
          </button>
          <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #e5e7eb', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:20 }}>
              <div>
                <h3 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800, color:'#14532d' }}>{mvtSelectionne.numero_bon}</h3>
                <p style={{ margin:0, color:'#6b7280', fontSize:14 }}>{TYPE_LABELS[mvtSelectionne.type_mouvement]}</p>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {mvtSelectionne.statut === 'brouillon' && (
                  <button onClick={() => validerBon(mvtSelectionne.id)}
                    style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>
                    ✓ Valider & Mettre à jour stock
                  </button>
                )}
                {mvtSelectionne.pdf_path && (
                  <button onClick={() => telechargerPDF(mvtSelectionne.id)}
                    style={{ background:'#dbeafe', color:'#1d4ed8', border:'1px solid #93c5fd', padding:'10px 18px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
                    📄 Télécharger PDF
                  </button>
                )}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12, marginBottom:20 }}>
              {[
                ['Source', mvtSelectionne.source_libelle || '—'],
                ['Destination', mvtSelectionne.dest_libelle || '—'],
                ['Date', new Date(mvtSelectionne.date_mouvement||mvtSelectionne.created_at).toLocaleDateString('fr-FR')],
                ['Statut', mvtSelectionne.statut],
                ['Créé par', mvtSelectionne.cree_par_nom || '—'],
                ['Validé par', mvtSelectionne.valide_par_nom || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ background:'#f9fafb', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#374151' }}>{val}</div>
                </div>
              ))}
            </div>

            {mvtSelectionne.notes && (
              <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#374151' }}>
                <strong>Notes :</strong> {mvtSelectionne.notes}
              </div>
            )}

            <h4 style={{ margin:'0 0 12px', fontSize:14, fontWeight:700 }}>Lignes ({mvtSelectionne.lignes?.length || 0})</h4>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  {['Article','Désignation','Qté prévue','Qté réelle','Écart','Poids th.','Poids réel','N° Lot'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(mvtSelectionne.lignes || []).map((l, i) => (
                  <tr key={l.id} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb' }}>
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:12, fontWeight:600 }}>{l.article_code}</td>
                    <td style={{ padding:'8px 12px' }}>{l.designation}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:600 }}>{l.qte_prevue}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>{l.qte_reelle || '—'}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', color: l.ecart_qte > 0 ? '#dc2626' : l.ecart_qte < 0 ? '#d97706' : '#15803d', fontWeight:600 }}>
                      {l.ecart_qte !== null ? (l.ecart_qte > 0 ? '+' : '') + l.ecart_qte : '—'}
                    </td>
                    <td style={{ padding:'8px 12px' }}>{l.poids_theorique_kg ? `${l.poids_theorique_kg} kg` : '—'}</td>
                    <td style={{ padding:'8px 12px' }}>{l.poids_reel_kg ? `${l.poids_reel_kg} kg` : '—'}</td>
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{l.numero_lot || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
