import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

const STATUT_CONFIG = {
  brouillon: { bg:'#f3f4f6', text:'#374151', label:'Brouillon' },
  soumis:    { bg:'#dbeafe', text:'#1d4ed8', label:'Soumis' },
  valide:    { bg:'#dcfce7', text:'#15803d', label:'Validé' },
  rejete:    { bg:'#fee2e2', text:'#dc2626', label:'Rejeté' },
};

export default function RapportJournalier({ userRole = 'chef_atelier' }) {
  const [vue, setVue] = useState('liste');
  const [rapports, setRapports] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [ofs, setOfs] = useState([]);
  const [rapportSelectionne, setRapportSelectionne] = useState(null);
  const [filtreDate, setFiltreDate] = useState(new Date().toISOString().split('T')[0]);
  const [filtreAtelier, setFiltreAtelier] = useState('');

  const [form, setForm] = useState({
    date_rapport: new Date().toISOString().split('T')[0],
    atelier_id: '', shift_id: '1',
    of_id: '', article_id: '', machine_id: '',
    qte_produite: '', poids_net_kg: '', poids_brut_kg: '',
    matiere_prevue_kg: '', matiere_reelle_kg: '',
    qte_dechets: '', poids_dechets_kg: '', motif_dechets: '',
    qte_pertes: '', poids_pertes_kg: '', motif_pertes: '',
    qte_rebus: '', poids_rebus_kg: '', motif_rebus: '',
    temps_prod_prevu_min: '', temps_prod_reel_min: '',
    temps_arret_min: '', temps_reglage_min: '',
    nb_operateurs: '', heures_travaillees: '',
    observations: '', problemes_rencontres: '', actions_correctives: ''
  });

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtreDate) { params.append('date_debut', filtreDate); params.append('date_fin', filtreDate); }
      if (filtreAtelier) params.append('atelier_id', filtreAtelier);
      const [rjs, ats, arts, ofsData] = await Promise.all([
        axios.get(`${API}/rapports-journaliers?${params}`),
        axios.get(`${API}/ateliers`),
        axios.get(`${API}/articles?type_article=produit_fini`),
        axios.get(`${API}/of`),
      ]);
      setRapports(rjs.data);
      setAteliers(ats.data);
      setArticles(arts.data);
      setOfs(ofsData.data);
    } catch { toast.error('Erreur chargement'); }
  }, [filtreDate, filtreAtelier]);

  useEffect(() => { charger(); }, [charger]);

  const creerRapport = async () => {
    if (!form.atelier_id) return toast.error('Atelier requis');
    try {
      const { data } = await axios.post(`${API}/rapports-journaliers`, form);
      toast.success(`Rapport ${data.numero_rapport} créé`);
      setVue('liste'); charger();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const soumettre = async (id) => {
    try {
      await axios.put(`${API}/rapports-journaliers/${id}/soumettre`);
      toast.success('Rapport soumis pour validation');
      charger();
    } catch { toast.error('Erreur'); }
  };

  const valider = async (id) => {
    try {
      const { data } = await axios.put(`${API}/rapports-journaliers/${id}/valider`);
      toast.success('Rapport validé — PDF généré');
      charger();
    } catch { toast.error('Erreur validation'); }
  };

  const telechargerPDF = async (id) => {
    try {
      const { data } = await axios.get(`${API}/rapports-journaliers/${id}/pdf`, { responseType:'blob' });
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch { toast.error('PDF non disponible'); }
  };

  // Calcul TRS preview
  const trsPreview = form.temps_prod_reel_min && form.temps_arret_min
    ? Math.round(parseInt(form.temps_prod_reel_min) / (parseInt(form.temps_prod_reel_min) + parseInt(form.temps_arret_min)) * 100)
    : null;

  const rebusPreview = form.poids_net_kg && (form.poids_dechets_kg || form.poids_rebus_kg)
    ? Math.round(((parseFloat(form.poids_dechets_kg)||0) + (parseFloat(form.poids_rebus_kg)||0)) / parseFloat(form.poids_net_kg) * 100 * 10) / 10
    : null;

  const f = (label, key, type='text', placeholder='') => (
    <div>
      <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm({...form, [key]:e.target.value})}
        placeholder={placeholder}
        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box', textAlign: type==='number' ? 'center' : 'left' }}/>
    </div>
  );

  return (
    <div style={{ fontFamily:'system-ui,sans-serif' }}>
      {/* Navigation */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:8 }}>
          {['liste','creer'].map(v => (
            <button key={v} onClick={() => setVue(v)} style={{
              padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:600, fontSize:13,
              background: vue===v ? '#14532d' : '#f3f4f6', color: vue===v ? '#fff' : '#374151'
            }}>{v==='liste' ? '📋 Rapports' : '+ Nouveau rapport'}</button>
          ))}
        </div>
        {vue === 'liste' && (
          <div style={{ display:'flex', gap:8 }}>
            <input type="date" value={filtreDate} onChange={e => setFiltreDate(e.target.value)}
              style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'7px 12px', fontSize:13 }}/>
            <select value={filtreAtelier} onChange={e => setFiltreAtelier(e.target.value)}
              style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'7px 12px', fontSize:13 }}>
              <option value="">Tous les ateliers</option>
              {ateliers.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* LISTE */}
      {vue === 'liste' && (
        <div>
          {/* KPI du jour */}
          {rapports.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
              {[
                { label:'Production nette', value:`${rapports.reduce((s,r)=>s+parseFloat(r.poids_net_kg||0),0).toFixed(1)} kg`, color:'#15803d', bg:'#dcfce7' },
                { label:'Déchets', value:`${rapports.reduce((s,r)=>s+parseFloat(r.poids_dechets_kg||0),0).toFixed(1)} kg`, color:'#d97706', bg:'#fef3c7' },
                { label:'Pertes', value:`${rapports.reduce((s,r)=>s+parseFloat(r.poids_pertes_kg||0),0).toFixed(1)} kg`, color:'#dc2626', bg:'#fee2e2' },
                { label:'Rebus', value:`${rapports.reduce((s,r)=>s+parseFloat(r.poids_rebus_kg||0),0).toFixed(1)} kg`, color:'#7c3aed', bg:'#ede9fe' },
                { label:'TRS moyen', value:`${rapports.length ? Math.round(rapports.reduce((s,r)=>s+parseFloat(r.trs_calcule||0),0)/rapports.length) : 0}%`, color:'#0369a1', bg:'#e0f2fe' },
              ].map(k => (
                <div key={k.label} style={{ background:k.bg, borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{k.label}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  {['N° Rapport','Atelier','OF / Article','Prod. nette','Déchets','Pertes','TRS','Statut','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rapports.map((r,i) => {
                  const sc = STATUT_CONFIG[r.statut] || STATUT_CONFIG.brouillon;
                  return (
                    <tr key={r.id} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb' }}>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:700, color:'#14532d', fontSize:12 }}>{r.numero_rapport}</td>
                      <td style={{ padding:'10px 12px' }}>{r.atelier_nom}</td>
                      <td style={{ padding:'10px 12px', fontSize:11 }}>
                        {r.numero_of && <div style={{ fontFamily:'monospace' }}>{r.numero_of}</div>}
                        {r.article_nom && <div style={{ color:'#6b7280' }}>{r.article_nom.substring(0,30)}</div>}
                      </td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#15803d' }}>{parseFloat(r.poids_net_kg||0).toFixed(1)} kg</td>
                      <td style={{ padding:'10px 12px', color:'#d97706' }}>{parseFloat(r.poids_dechets_kg||0).toFixed(1)} kg</td>
                      <td style={{ padding:'10px 12px', color:'#dc2626' }}>{parseFloat(r.poids_pertes_kg||0).toFixed(1)} kg</td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ color: parseFloat(r.trs_calcule) >= 80 ? '#15803d' : '#dc2626', fontWeight:700 }}>
                          {r.trs_calcule}%
                        </span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <span style={{ background:sc.bg, color:sc.text, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{sc.label}</span>
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', gap:5 }}>
                          {r.statut === 'brouillon' && (
                            <button onClick={() => soumettre(r.id)} style={{ background:'#dbeafe', color:'#1d4ed8', border:'1px solid #93c5fd', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>Soumettre</button>
                          )}
                          {r.statut === 'soumis' && ['chef_atelier','directeur','super_admin'].includes(userRole) && (
                            <button onClick={() => valider(r.id)} style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>✓ Valider</button>
                          )}
                          {r.pdf_path && (
                            <button onClick={() => telechargerPDF(r.id)} style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>PDF</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rapports.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px', color:'#9ca3af' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
                <p>Aucun rapport pour cette date</p>
                <button onClick={() => setVue('creer')} style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, cursor:'pointer', marginTop:8, fontWeight:600 }}>
                  + Créer le rapport du jour
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CRÉER */}
      {vue === 'creer' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:1000 }}>

          {/* En-tête */}
          <div style={{ background:'#14532d', borderRadius:14, padding:'16px 24px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Nouveau Rapport Journalier</div>
              <div style={{ fontSize:13, color:'#86efac' }}>Atelier 3 · Green Industry</div>
            </div>
            {trsPreview !== null && (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color:'#86efac' }}>TRS estimé</div>
                <div style={{ fontSize:28, fontWeight:800, color: trsPreview >= 80 ? '#4ade80' : '#fbbf24' }}>{trsPreview}%</div>
              </div>
            )}
          </div>

          {/* Identification */}
          <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
            <h4 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:'#374151' }}>📋 Identification</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              {f('Date *','date_rapport','date')}
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Atelier *</label>
                <select value={form.atelier_id} onChange={e => setForm({...form, atelier_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                  <option value="">Sélectionner...</option>
                  {ateliers.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Shift</label>
                <select value={form.shift_id} onChange={e => setForm({...form, shift_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                  <option value="1">Matin (6h-14h)</option>
                  <option value="2">Après-midi (14h-22h)</option>
                  <option value="3">Nuit (22h-6h)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>OF</label>
                <select value={form.of_id} onChange={e => setForm({...form, of_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                  <option value="">Sélectionner...</option>
                  {ofs.map(o => <option key={o.id} value={o.id}>{o.numero_of}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Production */}
          <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
            <h4 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:'#15803d' }}>🏭 Production</h4>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
              {f('Qté produite','qte_produite','number','0')}
              {f('Poids brut (kg)','poids_brut_kg','number','0.000')}
              {f('Poids net (kg) *','poids_net_kg','number','0.000')}
              {f('Matière prévue (kg)','matiere_prevue_kg','number','0.000')}
              {f('Matière réelle (kg)','matiere_reelle_kg','number','0.000')}
              {f('Nb opérateurs','nb_operateurs','number','0')}
              {f('Heures travaillées','heures_travaillees','number','0.0')}
            </div>
          </div>

          {/* Déchets / Pertes / Rebus */}
          <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
            <h4 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:'#dc2626' }}>⚠ Déchets · Pertes · Rebus</h4>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              <div style={{ background:'#fef3c7', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#92400e', marginBottom:10 }}>Déchets (récupérables)</div>
                <div style={{ display:'grid', gap:8 }}>
                  {f('Quantité','qte_dechets','number','0')}
                  {f('Poids (kg)','poids_dechets_kg','number','0.000')}
                  {f('Motif','motif_dechets')}
                </div>
              </div>
              <div style={{ background:'#fee2e2', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#991b1b', marginBottom:10 }}>Pertes (non récupérables)</div>
                <div style={{ display:'grid', gap:8 }}>
                  {f('Quantité','qte_pertes','number','0')}
                  {f('Poids (kg)','poids_pertes_kg','number','0.000')}
                  {f('Motif','motif_pertes')}
                </div>
              </div>
              <div style={{ background:'#f3e8ff', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#6b21a8', marginBottom:10 }}>Rebus (non-conformes)</div>
                <div style={{ display:'grid', gap:8 }}>
                  {f('Quantité','qte_rebus','number','0')}
                  {f('Poids (kg)','poids_rebus_kg','number','0.000')}
                  {f('Motif','motif_rebus')}
                </div>
              </div>
            </div>
          </div>

          {/* Temps */}
          <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
            <h4 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:'#0369a1' }}>⏱ Temps (en minutes)</h4>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {f('Temps prod. prévu','temps_prod_prevu_min','number','480')}
              {f('Temps prod. réel','temps_prod_reel_min','number','0')}
              {f('Temps arrêts','temps_arret_min','number','0')}
              {f('Temps réglage','temps_reglage_min','number','0')}
            </div>
          </div>

          {/* Observations */}
          <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
            <h4 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>💬 Observations & Actions</h4>
            <div style={{ display:'grid', gap:12 }}>
              {[['observations','Observations générales'],['problemes_rencontres','Problèmes rencontrés'],['actions_correctives','Actions correctives prises']].map(([key,label]) => (
                <div key={key}>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                  <textarea value={form[key]} onChange={e => setForm({...form, [key]:e.target.value})} rows={2}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, resize:'vertical', boxSizing:'border-box' }}/>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={creerRapport} style={{ background:'#14532d', color:'#fff', border:'none', padding:'14px 32px', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:15 }}>
              ✓ Enregistrer le rapport
            </button>
            <button onClick={() => setVue('liste')} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'14px 24px', borderRadius:12, cursor:'pointer', fontWeight:600 }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
