// ============================================================
// NAIdo — MODULE COMPOSITION OF — Chef Atelier AT3
// Remplace ModuleChefAtelier dans Atelier3Flux.jsx
// ============================================================

function ModuleChefAtelier() {
  const [ofs, setOfs]             = useState([]);
  const [ofSel, setOfSel]         = useState(null);
  const [mpStock, setMpStock]     = useState([]);
  const [compo, setCompo]         = useState([]);   // lignes composition en cours d'édition
  const [newLigne, setNewLigne]   = useState({ mp_id:'', pct:'', quantite:'' });
  const [config, setConfig]       = useState({ at3_poids_cible_kg:'', at3_nb_bobines_cibles:'', at3_notes_regleur:'', at3_machine_assignee_id:'' });
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');

  // ── Chargement liste OF ──
  const chargerOfs = async () => {
    try {
      const { data } = await axios.get(`${API}/at3/of`);
      setOfs(data);
    } catch { toast.error('Erreur chargement OF'); }
  };

  // ── Chargement MP en stock ──
  const chargerMpStock = async () => {
    try {
      const { data } = await axios.get(`${API}/articles?type_article=matiere_premiere`);
      // Enrichir avec le stock dispo
      const { data: stocks } = await axios.get(`${API}/stock/matieres`).catch(() => ({ data: [] }));
      const enriched = data.map(mp => {
        const s = stocks.find(x => x.article_id === mp.id);
        return { ...mp, qte_disponible: s?.qte_disponible || 0 };
      });
      setMpStock(enriched);
    } catch { toast.error('Erreur chargement MP'); }
  };

  useEffect(() => { chargerOfs(); chargerMpStock(); }, []);

  // ── Ouvrir un OF ──
  const ouvrirOf = async (o) => {
    setOfSel(o);
    // Pré-remplir composition depuis l'article
    const baseCompo = Array.isArray(o.composition) ? o.composition : [];
    setCompo(baseCompo.map(c => ({
      mp_id:       c.mp_id || '',
      code:        c.code || '',
      designation: c.designation || '',
      pct:         c.pct || '',
      quantite:    c.quantite || '',
      unite_id:    c.unite_id || '',
    })));
    setConfig({
      at3_poids_cible_kg:      o.at3_poids_cible_kg || '',
      at3_nb_bobines_cibles:   o.at3_nb_bobines_cibles || '',
      at3_notes_regleur:       o.at3_notes_regleur || '',
      at3_machine_assignee_id: o.at3_machine_assignee_id || '',
    });
  };

  // ── Calcul automatique quantité depuis poids cible ──
  const calcQuantite = (pct) => {
    const poidsCible = parseFloat(config.at3_poids_cible_kg || 0);
    if (!poidsCible || !pct) return '';
    return ((parseFloat(pct) / 100) * poidsCible).toFixed(3);
  };

  // ── Mise à jour d'une ligne ──
  const majLigne = (idx, field, val) => {
    setCompo(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, [field]: val };
      if (field === 'pct') updated.quantite = calcQuantite(val);
      return updated;
    }));
  };

  // ── Ajouter une ligne ──
  const ajouterLigne = () => {
    if (!newLigne.mp_id) return toast.error('Sélectionnez une matière première');
    if (!newLigne.pct)   return toast.error('Indiquez un pourcentage');
    if (compo.find(c => c.mp_id === newLigne.mp_id)) return toast.error('Cette MP est déjà dans la composition');
    const mp = mpStock.find(m => m.id === newLigne.mp_id);
    if (!mp) return;
    const quantite = calcQuantite(newLigne.pct);
    setCompo(prev => [...prev, {
      mp_id:       mp.id,
      code:        mp.code,
      designation: mp.designation,
      pct:         newLigne.pct,
      quantite,
    }]);
    setNewLigne({ mp_id:'', pct:'', quantite:'' });
  };

  // ── Supprimer une ligne ──
  const supprimerLigne = (idx) => setCompo(prev => prev.filter((_, i) => i !== idx));

  // ── Total % ──
  const totalPct = compo.reduce((s, c) => s + parseFloat(c.pct || 0), 0);

  // ── Sauvegarder (sans valider) ──
  const sauvegarder = async (valider = false) => {
    if (valider && compo.length === 0) return toast.error('Ajoutez au moins une matière première');
    if (valider && Math.abs(totalPct - 100) > 0.1) return toast.error(`Total = ${totalPct.toFixed(1)}% — doit être 100%`);
    if (valider && !config.at3_poids_cible_kg) return toast.error('Indiquez le poids cible');
    setLoading(true);
    try {
      await axios.put(`${API}/at3/of/${ofSel.id}/configurer`, {
        ...config,
        composition_of: compo,
        valider,
      });
      toast.success(valider ? '✅ Composition validée — Extrusion lancée !' : '💾 Sauvegardé');
      if (valider) setOfSel(null);
      chargerOfs();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  const ofsFiltres = ofs.filter(o =>
    !search || o.numero_of?.toLowerCase().includes(search.toLowerCase()) ||
    o.article_nom?.toLowerCase().includes(search.toLowerCase())
  );

  const STATUT_COLOR = {
    nouveau:     { bg:'#f3f4f6', tx:'#374151', label:'Nouveau' },
    composition: { bg:'#dbeafe', tx:'#1d4ed8', label:'En config.' },
    extrusion:   { bg:'#fef3c7', tx:'#92400e', label:'En extrusion' },
    quarantaine: { bg:'#fef9c3', tx:'#854d0e', label:'Quarantaine' },
    impression:  { bg:'#f3e8ff', tx:'#6d28d9', label:'Impression' },
    emballage:   { bg:'#ecfdf5', tx:'#065f46', label:'Emballage' },
    stock_at3:   { bg:'#dcfce7', tx:'#15803d', label:'Stock AT3' },
    cede:        { bg:'#e0f2fe', tx:'#0369a1', label:'Cédé ✓' },
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#14532d' }}>
          📋 Chef Atelier — Ordres de Fabrication
        </h3>
        <button onClick={() => { chargerOfs(); chargerMpStock(); }}
          style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
          🔄 Actualiser
        </button>
      </div>

      {/* ── DETAIL OF SÉLECTIONNÉ ── */}
      {ofSel && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #86efac', padding:24, marginBottom:20 }}>

          {/* En-tête OF */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:'#14532d' }}>{ofSel.numero_of}</div>
              <div style={{ fontSize:14, color:'#374151', marginTop:2 }}>{ofSel.article_code} — {ofSel.article_nom}</div>
              <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>Client : {ofSel.client_nom} | Quantité : {ofSel.quantite_cible}</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <span style={{
                background: (STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).bg,
                color:      (STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).tx,
                padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700
              }}>
                {(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).label}
              </span>
              <button onClick={() => setOfSel(null)}
                style={{ background:'#f3f4f6', border:'none', padding:'4px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                ✕ Fermer
              </button>
            </div>
          </div>

          {/* Paramètres production */}
          <div style={{ background:'#f8fafc', borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
              ⚙ Paramètres de production
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
              {[
                ['Poids cible (kg) *', 'at3_poids_cible_kg', 'number'],
                ['Nb bobines prévues', 'at3_nb_bobines_cibles', 'number'],
                ['Machine (ID)', 'at3_machine_assignee_id', 'number'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                  <input type={type} value={config[key] || ''} onChange={e => setConfig({ ...config, [key]: e.target.value })}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:14, boxSizing:'border-box', textAlign:'center', fontWeight:700 }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:10 }}>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Instructions régleur</label>
              <textarea value={config.at3_notes_regleur || ''} onChange={e => setConfig({ ...config, at3_notes_regleur: e.target.value })}
                rows={2} placeholder="Températures, vitesses, consignes spéciales..."
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
            </div>
          </div>

          {/* Composition MP */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#92400e', textTransform:'uppercase', letterSpacing:1 }}>
                🧪 Composition Matières Premières
              </div>
              <div style={{
                background: Math.abs(totalPct - 100) < 0.1 ? '#dcfce7' : totalPct > 100 ? '#fee2e2' : '#fef3c7',
                color:      Math.abs(totalPct - 100) < 0.1 ? '#15803d' : totalPct > 100 ? '#dc2626' : '#92400e',
                padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:800
              }}>
                Total : {totalPct.toFixed(1)}% {Math.abs(totalPct - 100) < 0.1 ? '✓' : totalPct > 100 ? '⚠ > 100%' : `(manque ${(100 - totalPct).toFixed(1)}%)`}
              </div>
            </div>

            {/* Lignes existantes */}
            <div style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', marginBottom:10 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#fef3c7' }}>
                    {['Matière Première', 'Stock dispo', '%', 'Quantité (kg)', ''].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'#92400e', fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compo.map((c, i) => {
                    const mp = mpStock.find(m => m.id === c.mp_id);
                    const qteNecessaire = parseFloat(c.quantite || 0);
                    const qteDispo = parseFloat(mp?.qte_disponible || 0);
                    const insuffisant = qteNecessaire > qteDispo && qteDispo > 0;
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid #fef3c7', background: i%2===0?'#fff':'#fffbeb' }}>
                        <td style={{ padding:'8px 12px' }}>
                          <div style={{ fontWeight:700, color:'#92400e' }}>{c.code}</div>
                          <div style={{ fontSize:11, color:'#6b7280' }}>{c.designation}</div>
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{
                            color: insuffisant ? '#dc2626' : '#15803d',
                            fontWeight:600, fontSize:12
                          }}>
                            {qteDispo > 0 ? `${qteDispo.toFixed(1)} kg` : '—'}
                            {insuffisant && ' ⚠'}
                          </span>
                        </td>
                        <td style={{ padding:'8px 12px', width:80 }}>
                          <input type="number" value={c.pct} min="0" max="100" step="0.1"
                            onChange={e => majLigne(i, 'pct', e.target.value)}
                            style={{ width:65, border:'1px solid #fcd34d', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                          <span style={{ fontSize:11, marginLeft:2 }}>%</span>
                        </td>
                        <td style={{ padding:'8px 12px', width:120 }}>
                          <input type="number" value={c.quantite} step="0.001"
                            onChange={e => majLigne(i, 'quantite', e.target.value)}
                            style={{ width:100, border:'1px solid #d1d5db', borderRadius:6, padding:'5px', fontSize:13, textAlign:'center' }} />
                          <span style={{ fontSize:11, marginLeft:2 }}>kg</span>
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <button onClick={() => supprimerLigne(i)}
                            style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {compo.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding:20, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
                        Aucune matière — ajoutez des lignes ci-dessous
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Ajouter une ligne */}
            <div style={{ background:'#f8fafc', borderRadius:10, padding:12, border:'1px dashed #d1d5db' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:8 }}>+ Ajouter une matière première</div>
              <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr auto', gap:8, alignItems:'flex-end' }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Matière première</label>
                  <select value={newLigne.mp_id} onChange={e => setNewLigne({ ...newLigne, mp_id: e.target.value })}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                    <option value="">-- Sélectionner --</option>
                    {mpStock.filter(mp => !compo.find(c => c.mp_id === mp.id)).map(mp => (
                      <option key={mp.id} value={mp.id}>
                        {mp.code} — {mp.designation} ({parseFloat(mp.qte_disponible||0).toFixed(1)} kg dispo)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>% *</label>
                  <input type="number" value={newLigne.pct} min="0" max="100" step="0.1"
                    onChange={e => setNewLigne({ ...newLigne, pct: e.target.value })}
                    placeholder="0.0"
                    style={{ width:'100%', border:'1px solid #fcd34d', borderRadius:8, padding:'8px', fontSize:14, textAlign:'center', fontWeight:700, boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Qté estimée</label>
                  <div style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'8px', fontSize:13, background:'#f9fafb', textAlign:'center', color:'#6b7280' }}>
                    {newLigne.pct && config.at3_poids_cible_kg
                      ? `${calcQuantite(newLigne.pct)} kg`
                      : '—'}
                  </div>
                </div>
                <button onClick={ajouterLigne}
                  style={{ background:'#92400e', color:'#fff', border:'none', padding:'9px 16px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13 }}>
                  + Ajouter
                </button>
              </div>
              {/* Stock MP disponible */}
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', marginBottom:6 }}>STOCK MP DISPONIBLE</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {mpStock.map(mp => (
                    <span key={mp.id} onClick={() => setNewLigne({ ...newLigne, mp_id: mp.id })}
                      style={{
                        background: compo.find(c=>c.mp_id===mp.id) ? '#dcfce7' : '#fff',
                        border: `1px solid ${compo.find(c=>c.mp_id===mp.id) ? '#86efac' : '#e5e7eb'}`,
                        borderRadius:20, padding:'4px 10px', fontSize:11, cursor:'pointer',
                        color: parseFloat(mp.qte_disponible||0) < 10 ? '#dc2626' : '#374151'
                      }}>
                      {compo.find(c=>c.mp_id===mp.id) ? '✓ ' : ''}{mp.code} — {parseFloat(mp.qte_disponible||0).toFixed(1)} kg
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Boutons action */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => sauvegarder(false)} disabled={loading}
              style={{ background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', padding:'10px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
              💾 Sauvegarder brouillon
            </button>
            <button onClick={() => sauvegarder(true)} disabled={loading || ofSel.at3_statut_zone === 'extrusion'}
              style={{
                background: Math.abs(totalPct-100) < 0.1 && config.at3_poids_cible_kg ? '#14532d' : '#9ca3af',
                color:'#fff', border:'none', padding:'10px 24px', borderRadius:8,
                cursor: Math.abs(totalPct-100) < 0.1 && config.at3_poids_cible_kg ? 'pointer' : 'not-allowed',
                fontWeight:700, fontSize:14
              }}>
              {loading ? '...' : '✅ Valider composition & Lancer Extrusion'}
            </button>
            {ofSel.at3_statut_zone === 'extrusion' && (
              <span style={{ background:'#fef3c7', color:'#92400e', padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600 }}>
                ⚙ Déjà en extrusion
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── LISTE DES OF ── */}
      <div style={{ display:'flex', gap:10, marginBottom:12, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un OF..."
          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'8px 14px', fontSize:13 }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>{ofsFiltres.length} OF</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {ofsFiltres.map(o => {
          const sc = STATUT_COLOR[o.at3_statut_zone] || STATUT_COLOR.nouveau;
          const pct = o.at3_poids_cible_kg > 0
            ? Math.min(100, Math.round((parseFloat(o.poids_produit_kg||0) / o.at3_poids_cible_kg) * 100))
            : 0;
          const compoBase = Array.isArray(o.composition) ? o.composition : [];
          return (
            <div key={o.id} style={{
              background: ofSel?.id === o.id ? '#f0fdf4' : '#fff',
              borderRadius:12, padding:'14px 18px',
              border:`2px solid ${ofSel?.id === o.id ? '#86efac' : sc.bg}`,
              cursor:'pointer'
            }} onClick={() => ofSel?.id === o.id ? setOfSel(null) : ouvrirOf(o)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:800, fontSize:15, color:'#14532d' }}>{o.numero_of}</span>
                    <span style={{ background:sc.bg, color:sc.tx, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {sc.label}
                    </span>
                    {o.at3_composition_validee && (
                      <span style={{ background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                        ✓ Composition validée
                      </span>
                    )}
                    {compoBase.length === 0 && (
                      <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                        ⚠ Composition manquante
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:13, color:'#374151' }}>{o.article_code} — {o.article_nom}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                    Client : {o.client_nom} | Quantité cible : {o.quantite_cible}
                    {o.at3_poids_cible_kg && ` | Poids : ${o.at3_poids_cible_kg} kg`}
                  </div>
                  {compoBase.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                      {compoBase.map((c, i) => (
                        <span key={i} style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, fontSize:10 }}>
                          {c.code} {c.pct}%
                        </span>
                      ))}
                    </div>
                  )}
                  {o.at3_poids_cible_kg > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:10, color:'#6b7280', marginBottom:2 }}>
                        Production : {parseFloat(o.poids_produit_kg||0).toFixed(1)} / {o.at3_poids_cible_kg} kg — {pct}%
                      </div>
                      <div style={{ background:'#e5e7eb', borderRadius:10, height:5, overflow:'hidden', width:'100%', maxWidth:300 }}>
                        <div style={{ background: pct>=100?'#15803d':'#1d4ed8', width:`${pct}%`, height:'100%', borderRadius:10, transition:'width 0.5s' }}/>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700, color:'#14532d', fontSize:15 }}>{o.nb_bobines||0} bob.</div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>{o.nb_palettes||0} palettes</div>
                  <div style={{ marginTop:6, color:'#1d4ed8', fontSize:11, fontWeight:600 }}>
                    {ofSel?.id === o.id ? '▲ Fermer' : '▼ Ouvrir'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {ofsFiltres.length === 0 && (
          <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📋</div>
            <p style={{ color:'#9ca3af' }}>Aucun OF disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
