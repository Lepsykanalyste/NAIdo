// ============================================================
// NAIdo — DASHBOARD AT3 DÉDIÉ + FILTRAGE CHEF ATELIER
// Fichier : DashboardAT3_patch.jsx
//
// INSTRUCTIONS D'INTÉGRATION dans ChefAtelier.jsx :
//
// 1. Remplacer la fonction Dashboard() existante par celle ci-dessous
//    OU ajouter DashboardAT3 comme composant séparé
//
// 2. Dans la map des sections (ligne ~7328), remplacer :
//    dashboard: <Dashboard />,
//    par :
//    dashboard: user?.role === 'chef_atelier' ? <DashboardAT3 /> : <Dashboard />,
//
// 3. Masquer la valeur stock pour chef_atelier :
//    Dans Dashboard(), chercher "Valeur stock" et ajouter la condition
// ============================================================

// ─────────────────────────────────────────────────────────────
// DASHBOARD AT3 DÉDIÉ — Chef Atelier uniquement
// ─────────────────────────────────────────────────────────────
function DashboardAT3() {
  const { user } = useAuth();
  const [data, setData]         = useState({});
  const [zones, setZones]       = useState([]);
  const [flux, setFlux]         = useState([]);
  const [trs, setTrs]           = useState([]);
  const [quarantaine, setQuar]  = useState([]);
  const [stock, setStock]       = useState([]);
  const [cessions, setCessions] = useState([]);
  const [pannes, setPannes]     = useState([]);

  const charger = async () => {
    try {
      const [d1, d2, d3, d4, d5, d6] = await Promise.all([
        axios.get(`${API}/at3/dashboard`).catch(()=>({data:{zones:[],flux:[],mouvements_jour:[]}})),
        axios.get(`${API}/kpi/trs`).catch(()=>({data:[]})),
        axios.get(`${API}/at3/quarantaine`).catch(()=>({data:[]})),
        axios.get(`${API}/at3/stock`).catch(()=>({data:[]})),
        axios.get(`${API}/at3/cessions`).catch(()=>({data:[]})),
        axios.get(`${API}/gmao/dashboard`).catch(()=>({data:{}})),
      ]);
      setZones(d1.data?.zones || []);
      setFlux(d1.data?.flux || []);
      setTrs(d2.data || []);
      setQuar(d3.data || []);
      setStock(d4.data || []);
      setCessions((d5.data || []).filter(c => c.statut !== 'accepte'));
      setPannes(d6.data || {});
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    charger();
    const t = setInterval(charger, 30000);
    return () => clearInterval(t);
  }, []);

  const trsColor = v => v >= 85 ? '#15803d' : v >= 70 ? '#d97706' : '#dc2626';
  const trsLabel = v => v >= 85 ? 'Excellent' : v >= 70 ? 'Acceptable' : 'Critique';

  const ZONE_CFG = {
    EXTR:   { icon:'⚙',  label:'Extrusion',    bg:'#dbeafe', tx:'#1d4ed8' },
    QUAR:   { icon:'⏳', label:'Quarantaine',   bg:'#fef3c7', tx:'#92400e' },
    IMPR:   { icon:'🖨',  label:'Impression',   bg:'#f3e8ff', tx:'#6d28d9' },
    EMBL:   { icon:'📦', label:'Emballage',     bg:'#ecfdf5', tx:'#065f46' },
    STKAT3: { icon:'🏗',  label:'Stock AT3',    bg:'#dcfce7', tx:'#15803d' },
  };

  const STATUT_OF = {
    nouveau:     { bg:'#f3f4f6', tx:'#374151', label:'Nouveau' },
    composition: { bg:'#dbeafe', tx:'#1d4ed8', label:'Config.' },
    extrusion:   { bg:'#fef3c7', tx:'#92400e', label:'Extrusion' },
    quarantaine: { bg:'#fef9c3', tx:'#854d0e', label:'Quarantaine' },
    impression:  { bg:'#f3e8ff', tx:'#6d28d9', label:'Impression' },
    emballage:   { bg:'#ecfdf5', tx:'#065f46', label:'Emballage' },
    stock_at3:   { bg:'#dcfce7', tx:'#15803d', label:'Stock AT3' },
    cede:        { bg:'#e0f2fe', tx:'#0369a1', label:'Cédé ✓' },
  };

  // Machines AT3 depuis TRS
  const machinesEX  = Array.from({length:9}, (_,i) => {
    const code = `EX${String(i+1).padStart(2,'0')}`;
    const m = trs.find(t => (t.machine_code||'').includes(code) || (t.machine_code||'').toUpperCase().includes(`EXT${i+1}`));
    return { code, trs: m ? parseFloat(m.trs||0) : null };
  });
  const machinesSOU = Array.from({length:5}, (_,i) => {
    const code = `SOU${String(i+1).padStart(2,'0')}`;
    const m = trs.find(t => (t.machine_code||'').includes(code));
    return { code, trs: m ? parseFloat(m.trs||0) : null };
  });

  const nbQuar    = quarantaine.length;
  const nbStock   = stock.length;
  const nbCess    = cessions.filter(c=>c.statut==='soumis').length;
  const nbPannes  = pannes.equipements_en_panne || 0;
  const poidsStock = stock.reduce((s,p)=>s+parseFloat(p.poids_sacs_kg||0),0);

  return (
    <div>
      {/* ── ENTÊTE ── */}
      <div style={{
        background:'linear-gradient(135deg,#14532d,#166534)',
        borderRadius:14, padding:'16px 20px', marginBottom:16, color:'#fff',
        display:'flex', justifyContent:'space-between', alignItems:'center'
      }}>
        <div>
          <div style={{fontWeight:800, fontSize:17}}>🏭 Atelier 3 — Tableau de Bord</div>
          <div style={{fontSize:12, opacity:0.8, marginTop:2}}>
            Chef Atelier : {user?.prenom} {user?.nom} · {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </div>
        </div>
        <button onClick={charger} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:12}}>
          🔄 Actualiser
        </button>
      </div>

      {/* ── ALERTES PRIORITAIRES ── */}
      {(nbQuar > 0 || nbPannes > 0 || nbCess > 0) && (
        <div style={{background:'#fff',borderRadius:12,border:'2px solid #fecdd3',padding:'12px 16px',marginBottom:16}}>
          <div style={{fontWeight:700,color:'#dc2626',marginBottom:8,fontSize:13}}>🚨 Actions requises</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {nbQuar > 0 && (
              <div style={{background:'#fef3c7',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,color:'#92400e'}}>
                ⏳ {nbQuar} bobine(s) en quarantaine à valider
              </div>
            )}
            {nbPannes > 0 && (
              <div style={{background:'#fee2e2',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,color:'#dc2626'}}>
                🔧 {nbPannes} machine(s) en panne
              </div>
            )}
            {nbCess > 0 && (
              <div style={{background:'#dbeafe',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,color:'#1d4ed8'}}>
                📤 {nbCess} cession(s) en attente magasin
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ZONES AT3 EN TEMPS RÉEL ── */}
      <div style={{fontSize:11,fontWeight:700,color:'#6b7280',letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>
        Flux de production — État des zones
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
        {Object.entries(ZONE_CFG).map(([code, cfg]) => {
          const z = zones.find(z=>z.code===code) || {};
          return (
            <div key={code} style={{
              background:cfg.bg, borderRadius:12, padding:'12px 10px',
              textAlign:'center', border:`2px solid ${cfg.bg}`
            }}>
              <div style={{fontSize:20}}>{cfg.icon}</div>
              <div style={{fontSize:10,fontWeight:700,color:cfg.tx,margin:'4px 0'}}>{cfg.label}</div>
              <div style={{fontSize:26,fontWeight:800,color:cfg.tx}}>{z.nb_bobines||0}</div>
              <div style={{fontSize:10,color:cfg.tx}}>bobines</div>
              {z.poids_kg>0 && <div style={{fontSize:11,color:cfg.tx,marginTop:2,fontWeight:600}}>{parseFloat(z.poids_kg).toFixed(1)} kg</div>}
            </div>
          );
        })}
      </div>

      {/* ── MACHINES AT3 ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
        {/* Extrudeuses */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:14}}>
          <div style={{fontWeight:700,color:'#1d4ed8',marginBottom:10,fontSize:13}}>⚙ Extrudeuses (9)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
            {machinesEX.map(m => {
              const c = m.trs===null?'#9ca3af':trsColor(m.trs);
              return (
                <div key={m.code} style={{
                  background:m.trs===null?'#f9fafb':`${c}15`,
                  border:`2px solid ${c}`,
                  borderRadius:8,padding:'8px 4px',textAlign:'center'
                }}>
                  <div style={{fontSize:10,fontWeight:700,color:'#374151'}}>{m.code}</div>
                  <div style={{fontSize:18,fontWeight:800,color:c}}>
                    {m.trs!==null?`${m.trs.toFixed(0)}%`:'—'}
                  </div>
                  {m.trs!==null && <div style={{fontSize:9,color:c}}>{trsLabel(m.trs)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Soudeuses */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:14}}>
          <div style={{fontWeight:700,color:'#7c3aed',marginBottom:10,fontSize:13}}>🔥 Soudeuses (5)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
            {machinesSOU.map(m => {
              const c = m.trs===null?'#9ca3af':trsColor(m.trs);
              return (
                <div key={m.code} style={{
                  background:m.trs===null?'#f9fafb':`${c}15`,
                  border:`2px solid ${c}`,
                  borderRadius:8,padding:'10px 4px',textAlign:'center'
                }}>
                  <div style={{fontSize:10,fontWeight:700,color:'#374151'}}>{m.code}</div>
                  <div style={{fontSize:20,fontWeight:800,color:c}}>
                    {m.trs!==null?`${m.trs.toFixed(0)}%`:'—'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stock AT3 résumé */}
          <div style={{marginTop:14,background:'#f0fdf4',borderRadius:10,padding:'10px 12px'}}>
            <div style={{fontWeight:700,color:'#15803d',fontSize:12,marginBottom:6}}>🏗 Stock AT3</div>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:800,color:'#15803d'}}>{nbStock}</div>
                <div style={{fontSize:10,color:'#6b7280'}}>palettes</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:800,color:'#15803d'}}>{poidsStock.toFixed(0)}</div>
                <div style={{fontSize:10,color:'#6b7280'}}>kg net</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:800,color:'#15803d'}}>
                  {stock.reduce((s,p)=>s+(p.nb_sacs||0),0)}
                </div>
                <div style={{fontSize:10,color:'#6b7280'}}>sacs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── OF EN COURS ── */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16,marginBottom:16}}>
        <div style={{fontWeight:700,color:'#14532d',marginBottom:12,fontSize:13}}>
          📋 Ordres de Fabrication en cours
        </div>
        {flux.length === 0 ? (
          <div style={{textAlign:'center',color:'#9ca3af',padding:20,fontSize:13}}>
            Aucun OF en cours
          </div>
        ) : (
          flux.map(f => {
            const sc = STATUT_OF[f.at3_statut_zone] || STATUT_OF['nouveau'];
            const pct = f.at3_poids_cible_kg > 0
              ? Math.min(100, Math.round((f.poids_produit_kg / f.at3_poids_cible_kg) * 100))
              : 0;
            return (
              <div key={f.of_id} style={{
                borderBottom:'1px solid #f0fdf4',
                padding:'10px 0',
                display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8
              }}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontWeight:800,color:'#14532d'}}>{f.numero_of}</span>
                    <span style={{
                      background:sc.bg,color:sc.tx,
                      padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700
                    }}>{sc.label}</span>
                  </div>
                  <div style={{fontSize:12,color:'#374151'}}>{f.article_code} — {f.article_nom}</div>
                  {f.at3_poids_cible_kg > 0 && (
                    <div style={{marginTop:6}}>
                      <div style={{fontSize:10,color:'#6b7280',marginBottom:2}}>
                        {parseFloat(f.poids_produit_kg||0).toFixed(1)} / {f.at3_poids_cible_kg} kg — {pct}%
                      </div>
                      <div style={{background:'#e5e7eb',borderRadius:10,height:5,overflow:'hidden',width:200}}>
                        <div style={{
                          background:pct>=100?'#15803d':'#1d4ed8',
                          width:`${pct}%`,height:'100%',borderRadius:10
                        }}/>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{fontSize:12,color:'#374151',display:'flex',gap:12}}>
                  <span>⚙ {f.nb_bobines_total||0} bob.</span>
                  <span>📦 {f.nb_palettes||0} pal.</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── QUARANTAINE EN ATTENTE ── */}
      {nbQuar > 0 && (
        <div style={{background:'#fffbeb',borderRadius:12,border:'2px solid #fcd34d',padding:16,marginBottom:16}}>
          <div style={{fontWeight:700,color:'#92400e',marginBottom:10,fontSize:13}}>
            ⏳ Bobines en quarantaine — Validation requise ({nbQuar})
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
            {quarantaine.slice(0,6).map(b => {
              const mins = Math.round(b.minutes_en_quarantaine||0);
              return (
                <div key={b.id} style={{
                  background:'#fff',borderRadius:8,padding:'10px 12px',
                  border:`1px solid ${mins>120?'#fca5a5':'#fcd34d'}`
                }}>
                  <div style={{fontWeight:700,fontSize:12,fontFamily:'monospace',color:'#92400e'}}>{b.numero_bobine}</div>
                  <div style={{fontSize:11,color:'#6b7280'}}>{b.numero_of} | {b.machine_code}</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#15803d'}}>{parseFloat(b.poids_net_kg).toFixed(3)} kg</span>
                    <span style={{fontSize:10,color:mins>120?'#dc2626':'#9ca3af'}}>
                      {mins>60?`${Math.floor(mins/60)}h${mins%60}m`:`${mins}min`}
                    </span>
                  </div>
                </div>
              );
            })}
            {nbQuar > 6 && (
              <div style={{background:'#fef3c7',borderRadius:8,padding:'10px 12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#92400e'}}>
                +{nbQuar-6} autres → Flux AT3
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CESSIONS EN ATTENTE ── */}
      {cessions.length > 0 && (
        <div style={{background:'#f0f9ff',borderRadius:12,border:'1px solid #bae6fd',padding:16}}>
          <div style={{fontWeight:700,color:'#0369a1',marginBottom:10,fontSize:13}}>
            📤 Cessions vers Magasin Central ({cessions.length})
          </div>
          {cessions.map(c => (
            <div key={c.id} style={{
              display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'8px 0',borderBottom:'1px solid #e0f2fe',fontSize:13
            }}>
              <div>
                <span style={{fontWeight:700,fontFamily:'monospace',color:'#0369a1'}}>{c.numero_cession}</span>
                <span style={{color:'#6b7280',marginLeft:8}}>{c.numero_of}</span>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span style={{fontWeight:700}}>{c.nb_palettes} pal. — {c.nb_sacs_total} sacs</span>
                <span style={{
                  background:c.statut==='soumis'?'#dbeafe':'#dcfce7',
                  color:c.statut==='soumis'?'#1d4ed8':'#15803d',
                  padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700
                }}>{c.statut}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
