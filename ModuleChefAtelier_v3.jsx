// ============================================================
// NAIdo — MODULE COMPOSITION PAR FAMILLE — Chef Atelier AT3
// Logique : Article définit % par famille → Chef AT3 choisit
//           les MP concrètes dans chaque famille selon stock
// ============================================================

function ModuleChefAtelier() {
  const [ofs, setOfs]           = useState([]);
  const [ofSel, setOfSel]       = useState(null);
  const [mpStock, setMpStock]   = useState([]);   // toutes les MP avec stock
  const [familles, setFamilles] = useState([]);   // familles MP
  const [compoFamilles, setCompoFamilles] = useState([]); // composition par famille avec MP choisies
  const [config, setConfig]     = useState({ at3_poids_cible_kg:'', at3_nb_bobines_cibles:'', at3_notes_regleur:'', at3_machine_assignee_id:'' });
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');

  const chargerOfs = async () => {
    try {
      const { data } = await axios.get(`${API}/at3/of`);
      setOfs(data);
    } catch { toast.error('Erreur chargement OF'); }
  };

  const chargerRefs = async () => {
    try {
      const [mpRes, famRes] = await Promise.all([
        axios.get(`${API}/articles?type_article=matiere_premiere`),
        axios.get(`${API}/referentiels/familles`).catch(() => ({ data: [] })),
      ]);
      // Enrichir MP avec stock
      const stockRes = await axios.get(`${API}/stock/liste`).catch(() => ({ data: [] }));
      const stocks = stockRes.data || [];
      const mpEnrichies = (mpRes.data || []).map(mp => {
        const s = stocks.find(x => x.article_id === mp.id);
        return { ...mp, qte_disponible: parseFloat(s?.qte_disponible || 0) };
      });
      setMpStock(mpEnrichies);
      setFamilles(famRes.data || []);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { chargerOfs(); chargerRefs(); }, []);

  // ── Ouvrir un OF ──
  const ouvrirOf = async (o) => {
    setOfSel(o);
    setConfig({
      at3_poids_cible_kg:      o.at3_poids_cible_kg || '',
      at3_nb_bobines_cibles:   o.at3_nb_bobines_cibles || '',
      at3_notes_regleur:       o.at3_notes_regleur || '',
      at3_machine_assignee_id: o.at3_machine_assignee_id || '',
    });

    // Charger composition par famille depuis l'article
    try {
      const { data: art } = await axios.get(`${API}/articles/${o.article_id}`);
      const baseCompoFamilles = art.composition_familles || [];

      // Si l'OF a déjà une composition familles sauvegardée, l'utiliser
      const savedCompo = o.at3_composition_familles || [];

      if (savedCompo.length > 0) {
        setCompoFamilles(savedCompo);
      } else if (baseCompoFamilles.length > 0) {
        // Initialiser depuis la composition de l'article
        setCompoFamilles(baseCompoFamilles.map(f => ({
          famille_id:      f.famille_id,
          famille_code:    f.famille_code,
          famille_libelle: f.famille_libelle,
          pct_famille:     f.pct,
          // MP choisies pour cette famille (vide au départ)
          mp_choisies: [],
        })));
      } else {
        setCompoFamilles([]);
      }
    } catch { setCompoFamilles([]); }
  };

  // ── MP disponibles pour une famille ──
  const mpDeFamille = (famille_id) =>
    mpStock.filter(mp => mp.famille_id === famille_id);

  // ── Ajouter une MP dans une famille ──
  const ajouterMpDansFamille = (familleIdx, mp_id) => {
    if (!mp_id) return;
    setCompoFamilles(prev => prev.map((f, i) => {
      if (i !== familleIdx) return f;
      if (f.mp_choisies.find(m => m.mp_id === mp_id)) return f;
      const mp = mpStock.find(m => m.id === mp_id);
      if (!mp) return f;
      return {
        ...f,
        mp_choisies: [...f.mp_choisies, {
          mp_id:       mp.id,
          code:        mp.code,
          designation: mp.designation,
          pct:         '',  // % dans la famille
          quantite:    '',  // kg calculé
          qte_dispo:   mp.qte_disponible,
        }]
      };
    }));
  };

  // ── Modifier % d'une MP dans une famille ──
  const majPctMp = (familleIdx, mpIdx, val) => {
    const poidsCible = parseFloat(config.at3_poids_cible_kg || 0);
    setCompoFamilles(prev => prev.map((f, fi) => {
      if (fi !== familleIdx) return f;
      const mp_choisies = f.mp_choisies.map((m, mi) => {
        if (mi !== mpIdx) return m;
        const pct = parseFloat(val || 0);
        const quantite = poidsCible > 0 ? ((pct / 100) * poidsCible).toFixed(3) : '';
        return { ...m, pct: val, quantite };
      });
      return { ...f, mp_choisies };
    }));
  };

  // ── Supprimer une MP d'une famille ──
  const supprimerMp = (familleIdx, mpIdx) => {
    setCompoFamilles(prev => prev.map((f, fi) => {
      if (fi !== familleIdx) return f;
      return { ...f, mp_choisies: f.mp_choisies.filter((_, mi) => mi !== mpIdx) };
    }));
  };

  // ── Recalculer quantités quand poids cible change ──
  useEffect(() => {
    const poidsCible = parseFloat(config.at3_poids_cible_kg || 0);
    if (!poidsCible) return;
    setCompoFamilles(prev => prev.map(f => ({
      ...f,
      mp_choisies: f.mp_choisies.map(m => ({
        ...m,
        quantite: m.pct ? ((parseFloat(m.pct) / 100) * poidsCible).toFixed(3) : '',
      }))
    })));
  }, [config.at3_poids_cible_kg]);

  // ── Validation ──
  const totalPctGlobal = compoFamilles.reduce((s, f) => {
    const totalFamille = f.mp_choisies.reduce((sf, m) => sf + parseFloat(m.pct || 0), 0);
    return s + totalFamille;
  }, 0);

  const sauvegarder = async (valider = false) => {
    if (valider) {
      if (compoFamilles.length === 0) return toast.error('Aucune composition définie');
      if (Math.abs(totalPctGlobal - 100) > 0.1) return toast.error(`Total = ${totalPctGlobal.toFixed(1)}% — doit être 100%`);
      if (!config.at3_poids_cible_kg) return toast.error('Poids cible requis');
      for (const f of compoFamilles) {
        if (f.mp_choisies.length === 0) return toast.error(`Famille "${f.famille_libelle}" : aucune MP sélectionnée`);
      }
    }
    setLoading(true);
    try {
      await axios.put(`${API}/at3/of/${ofSel.id}/configurer`, {
        ...config,
        composition_of: compoFamilles.flatMap(f => f.mp_choisies.map(m => ({
          mp_id: m.mp_id, code: m.code, designation: m.designation,
          pct: m.pct, quantite: m.quantite,
          famille_id: f.famille_id, famille_libelle: f.famille_libelle,
        }))),
        at3_composition_familles: compoFamilles,
        valider,
      });
      toast.success(valider ? '✅ Composition validée — Extrusion lancée !' : '💾 Sauvegardé');
      if (valider) setOfSel(null);
      chargerOfs();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

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

  const FAMILLE_COLORS = [
    { bg:'#dbeafe', tx:'#1d4ed8', border:'#93c5fd' },
    { bg:'#fef3c7', tx:'#92400e', border:'#fcd34d' },
    { bg:'#f3e8ff', tx:'#6d28d9', border:'#c4b5fd' },
    { bg:'#dcfce7', tx:'#15803d', border:'#86efac' },
    { bg:'#fce7f3', tx:'#9d174d', border:'#f9a8d4' },
    { bg:'#e0f2fe', tx:'#0369a1', border:'#7dd3fc' },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#14532d' }}>
          📋 Chef Atelier — Composition des OF
        </h3>
        <button onClick={() => { chargerOfs(); chargerRefs(); }}
          style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
          🔄 Actualiser
        </button>
      </div>

      {/* ── DETAIL OF ── */}
      {ofSel && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #86efac', padding:24, marginBottom:20 }}>

          {/* En-tête */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:'#14532d' }}>{ofSel.numero_of}</div>
              <div style={{ fontSize:14, color:'#374151' }}>{ofSel.article_code} — {ofSel.article_nom}</div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>Client : {ofSel.client_nom || '—'} | Qté : {ofSel.quantite_cible}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{
                background:(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).bg,
                color:(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).tx,
                padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700
              }}>{(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).label}</span>
              <button onClick={() => setOfSel(null)}
                style={{ background:'#f3f4f6', border:'none', padding:'4px 12px', borderRadius:8, cursor:'pointer' }}>✕</button>
            </div>
          </div>

          {/* Paramètres production */}
          <div style={{ background:'#f8fafc', borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
              ⚙ Paramètres production
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
              {[
                ['Poids cible (kg) *', 'at3_poids_cible_kg'],
                ['Nb bobines prévues', 'at3_nb_bobines_cibles'],
                ['Machine (ID)', 'at3_machine_assignee_id'],
              ].map(([label, key]) => (
                <div key={key}>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                  <input type="number" value={config[key] || ''} onChange={e => setConfig({ ...config, [key]: e.target.value })}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:14, boxSizing:'border-box', textAlign:'center', fontWeight:700 }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:10 }}>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Instructions régleur</label>
              <textarea value={config.at3_notes_regleur || ''} onChange={e => setConfig({ ...config, at3_notes_regleur: e.target.value })}
                rows={2} placeholder="Températures, vitesses, consignes..."
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
            </div>
          </div>

          {/* Total % global */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>
              🧪 Composition par famille de matières premières
            </div>
            <div style={{
              background: Math.abs(totalPctGlobal-100) < 0.1 ? '#dcfce7' : totalPctGlobal > 100 ? '#fee2e2' : '#fef3c7',
              color:      Math.abs(totalPctGlobal-100) < 0.1 ? '#15803d' : totalPctGlobal > 100 ? '#dc2626' : '#92400e',
              padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:800
            }}>
              Total : {totalPctGlobal.toFixed(1)}%
              {Math.abs(totalPctGlobal-100) < 0.1 ? ' ✓' : totalPctGlobal > 100 ? ' ⚠ Dépassement' : ` (manque ${(100-totalPctGlobal).toFixed(1)}%)`}
            </div>
          </div>

          {/* Familles */}
          {compoFamilles.length === 0 ? (
            <div style={{ background:'#fef3c7', borderRadius:10, padding:16, textAlign:'center', color:'#92400e', fontSize:13 }}>
              ⚠ Cet article n'a pas de composition par famille définie.<br/>
              <span style={{ fontSize:11 }}>Demandez à l'admin de configurer la composition famille dans la fiche article.</span>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {compoFamilles.map((f, fi) => {
                const clr = FAMILLE_COLORS[fi % FAMILLE_COLORS.length];
                const mpDispo = mpDeFamille(f.famille_id);
                const totalFamille = f.mp_choisies.reduce((s, m) => s + parseFloat(m.pct || 0), 0);
                const qteNeeded = config.at3_poids_cible_kg
                  ? ((f.pct_famille / 100) * parseFloat(config.at3_poids_cible_kg)).toFixed(1)
                  : '—';

                return (
                  <div key={fi} style={{ border:`2px solid ${clr.border}`, borderRadius:12, overflow:'hidden' }}>
                    {/* Header famille */}
                    <div style={{ background:clr.bg, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <span style={{ fontWeight:800, color:clr.tx, fontSize:14 }}>
                          {f.famille_libelle}
                        </span>
                        <span style={{ marginLeft:10, background:'#fff', color:clr.tx, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                          {f.pct_famille}% de l'OF
                        </span>
                        {config.at3_poids_cible_kg && (
                          <span style={{ marginLeft:8, fontSize:12, color:clr.tx }}>
                            = {qteNeeded} kg à fournir
                          </span>
                        )}
                      </div>
                      <div style={{
                        background: Math.abs(totalFamille - f.pct_famille) < 0.1 ? '#15803d' : '#dc2626',
                        color:'#fff', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700
                      }}>
                        {totalFamille.toFixed(1)}% / {f.pct_famille}%
                        {Math.abs(totalFamille - f.pct_famille) < 0.1 ? ' ✓' : ''}
                      </div>
                    </div>

                    {/* MP choisies */}
                    <div style={{ padding:'12px 16px', background:'#fff' }}>
                      {f.mp_choisies.length > 0 && (
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:10 }}>
                          <thead>
                            <tr style={{ background:clr.bg }}>
                              {['MP sélectionnée', 'Stock dispo', '% dans formule', 'Quantité (kg)', ''].map(h => (
                                <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:clr.tx }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {f.mp_choisies.map((m, mi) => {
                              const qteNecessaire = parseFloat(m.quantite || 0);
                              const insuffisant = qteNecessaire > m.qte_dispo && m.qte_dispo > 0;
                              return (
                                <tr key={mi} style={{ borderBottom:`1px solid ${clr.border}` }}>
                                  <td style={{ padding:'7px 10px' }}>
                                    <div style={{ fontWeight:700, color:clr.tx }}>{m.code}</div>
                                    <div style={{ fontSize:11, color:'#6b7280' }}>{m.designation}</div>
                                  </td>
                                  <td style={{ padding:'7px 10px' }}>
                                    <span style={{ color: insuffisant ? '#dc2626' : '#15803d', fontWeight:600, fontSize:12 }}>
                                      {m.qte_dispo > 0 ? `${m.qte_dispo.toFixed(1)} kg` : '—'}
                                      {insuffisant && ' ⚠ Insuffisant'}
                                    </span>
                                  </td>
                                  <td style={{ padding:'7px 10px', width:100 }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                      <input type="number" value={m.pct} min="0" max="100" step="0.1"
                                        onChange={e => majPctMp(fi, mi, e.target.value)}
                                        style={{ width:65, border:`1px solid ${clr.border}`, borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                                      <span style={{ fontSize:11 }}>%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding:'7px 10px', fontSize:13, fontWeight:700, color:clr.tx }}>
                                    {m.quantite ? `${m.quantite} kg` : '—'}
                                  </td>
                                  <td style={{ padding:'7px 10px' }}>
                                    <button onClick={() => supprimerMp(fi, mi)}
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

                      {/* Ajouter MP dans cette famille */}
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>
                          + Ajouter une MP :
                        </span>
                        {mpDispo.length === 0 ? (
                          <span style={{ fontSize:11, color:'#dc2626' }}>
                            ⚠ Aucune MP dans la famille {f.famille_libelle} — créez-en dans Articles
                          </span>
                        ) : (
                          mpDispo.filter(mp => !f.mp_choisies.find(m => m.mp_id === mp.id)).map(mp => (
                            <button key={mp.id} onClick={() => ajouterMpDansFamille(fi, mp.id)}
                              style={{
                                background: mp.qte_disponible > 0 ? clr.bg : '#f3f4f6',
                                color: mp.qte_disponible > 0 ? clr.tx : '#9ca3af',
                                border: `1px solid ${clr.border}`,
                                borderRadius:20, padding:'4px 12px', cursor:'pointer', fontSize:11, fontWeight:600
                              }}>
                              + {mp.code}
                              <span style={{ fontSize:10, marginLeft:4, opacity:0.8 }}>
                                ({mp.qte_disponible > 0 ? `${mp.qte_disponible.toFixed(0)} kg` : 'rupture'})
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Boutons */}
          <div style={{ display:'flex', gap:10, marginTop:20, flexWrap:'wrap' }}>
            <button onClick={() => sauvegarder(false)} disabled={loading}
              style={{ background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', padding:'10px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
              💾 Sauvegarder
            </button>
            <button onClick={() => sauvegarder(true)} disabled={loading || ofSel.at3_statut_zone === 'extrusion'}
              style={{
                background: Math.abs(totalPctGlobal-100) < 0.1 && config.at3_poids_cible_kg ? '#14532d' : '#9ca3af',
                color:'#fff', border:'none', padding:'10px 24px', borderRadius:8,
                cursor: Math.abs(totalPctGlobal-100) < 0.1 && config.at3_poids_cible_kg ? 'pointer' : 'not-allowed',
                fontWeight:700, fontSize:14
              }}>
              {loading ? '...' : '✅ Valider & Lancer Extrusion'}
            </button>
            {ofSel.at3_statut_zone === 'extrusion' && (
              <span style={{ background:'#fef3c7', color:'#92400e', padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600 }}>
                ⚙ Déjà en extrusion
              </span>
            )}
            <button onClick={() => setOfSel(null)}
              style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── LISTE OF ── */}
      <div style={{ display:'flex', gap:10, marginBottom:12, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un OF..."
          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'8px 14px', fontSize:13 }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>
          {ofs.filter(o => !search || o.numero_of?.toLowerCase().includes(search.toLowerCase()) || o.article_nom?.toLowerCase().includes(search.toLowerCase())).length} OF
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {ofs
          .filter(o => !search || o.numero_of?.toLowerCase().includes(search.toLowerCase()) || o.article_nom?.toLowerCase().includes(search.toLowerCase()))
          .map(o => {
            const sc = STATUT_COLOR[o.at3_statut_zone] || STATUT_COLOR.nouveau;
            const pct = o.at3_poids_cible_kg > 0
              ? Math.min(100, Math.round((parseFloat(o.poids_produit_kg||0) / o.at3_poids_cible_kg) * 100))
              : 0;
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
                      {!o.at3_composition_validee && (
                        <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                          ⚠ À configurer
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:'#374151' }}>{o.article_code} — {o.article_nom}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                      Client : {o.client_nom || '—'} | Qté : {o.quantite_cible}
                      {o.at3_poids_cible_kg && ` | Cible : ${o.at3_poids_cible_kg} kg`}
                    </div>
                    {o.at3_poids_cible_kg > 0 && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:2 }}>
                          Production : {parseFloat(o.poids_produit_kg||0).toFixed(1)} / {o.at3_poids_cible_kg} kg — {pct}%
                        </div>
                        <div style={{ background:'#e5e7eb', borderRadius:10, height:5, overflow:'hidden', maxWidth:300 }}>
                          <div style={{ background:pct>=100?'#15803d':'#1d4ed8', width:`${pct}%`, height:'100%', borderRadius:10 }}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'#14532d' }}>{o.nb_bobines||0} bob.</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{o.nb_palettes||0} palettes</div>
                    <div style={{ marginTop:4, color:'#1d4ed8', fontSize:11, fontWeight:600 }}>
                      {ofSel?.id === o.id ? '▲ Fermer' : '▼ Configurer'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        {ofs.length === 0 && (
          <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📋</div>
            <p style={{ color:'#9ca3af' }}>Aucun OF disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
