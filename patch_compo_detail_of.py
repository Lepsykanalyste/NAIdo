with open('/home/sophopsy-ia/NAIdo/frontend/src/pages/ChefAtelier.jsx','r') as f:
    c = f.read()

# ─────────────────────────────────────────────────────────────
# 1. Ajouter setOngletActif dans les props de DetailOF
# ─────────────────────────────────────────────────────────────
c = c.replace(
    "function DetailOF({ detail, machines, onClose, onRefresh, onStatut }) {\n  const { user } = useAuth();",
    "function DetailOF({ detail, machines, onClose, onRefresh, onStatut, setOngletActif }) {\n  const { user } = useAuth();"
)

# ─────────────────────────────────────────────────────────────
# 2. Ajouter les states composition dans DetailOF
# ─────────────────────────────────────────────────────────────
c = c.replace(
    "  const { user } = useAuth();\n  const [lots, setLots] = useState([]);",
    """  const { user } = useAuth();
  const [lots, setLots] = useState([]);
  // ── Composition par famille (chef_atelier) ──
  const [compoFamilles, setCompoFamilles] = useState([]);
  const [mpStock, setMpStock] = useState([]);
  const [configOf, setConfigOf] = useState({ at3_poids_cible_kg:'', at3_nb_bobines_cibles:'', at3_notes_regleur:'', at3_machine_assignee_id:'' });
  const [savingCompo, setSavingCompo] = useState(false);"""
)

# ─────────────────────────────────────────────────────────────
# 3. Charger composition familles quand on ouvre le détail
#    On l'ajoute dans le useEffect existant
# ─────────────────────────────────────────────────────────────
old_useeffect = "  useEffect(() => {\n    if (detail?.id) chargerLots();\n  }, [detail?.id]);"

new_useeffect = """  useEffect(() => {
    if (detail?.id) {
      chargerLots();
      if (user?.role === 'chef_atelier') chargerComposition();
    }
  }, [detail?.id]);

  const chargerComposition = async () => {
    try {
      // Charger MP en stock
      const { data: mp } = await axios.get(`${API}/articles?type_article=matiere_premiere`);
      const { data: stocks } = await axios.get(`${API}/stock/matieres`).catch(() => ({ data: [] }));
      const enriched = (mp || []).map(m => ({
        ...m,
        qte_disponible: parseFloat(stocks.find(s => s.article_id === m.id)?.qte_disponible || 0)
      }));
      setMpStock(enriched);
      // Charger composition familles de l'article
      const { data: art } = await axios.get(`${API}/articles/${detail.article_id}`);
      const savedCompo = detail.at3_composition_familles || [];
      const baseCompo = art.composition_familles || [];
      const src = Array.isArray(savedCompo) && savedCompo.length > 0 ? savedCompo : baseCompo;
      setCompoFamilles(src.map(f => ({
        famille_id:      f.famille_id,
        famille_code:    f.famille_code,
        famille_libelle: f.famille_libelle,
        pct_famille:     f.pct_famille || f.pct,
        mp_choisies:     f.mp_choisies || [],
      })));
      setConfigOf({
        at3_poids_cible_kg:      detail.at3_poids_cible_kg || '',
        at3_nb_bobines_cibles:   detail.at3_nb_bobines_cibles || '',
        at3_notes_regleur:       detail.at3_notes_regleur || '',
        at3_machine_assignee_id: detail.at3_machine_assignee_id || '',
      });
    } catch(e) { console.error(e); }
  };

  const mpDeFamille = (famille_id) => mpStock.filter(mp => mp.famille_id === famille_id);

  const ajouterMpDansFamille = (fi, mp_id) => {
    if (!mp_id) return;
    const mp = mpStock.find(m => m.id === mp_id);
    if (!mp) return;
    setCompoFamilles(prev => prev.map((f, i) => {
      if (i !== fi || f.mp_choisies.find(m => m.mp_id === mp_id)) return f;
      return { ...f, mp_choisies: [...f.mp_choisies, { mp_id: mp.id, code: mp.code, designation: mp.designation, pct: '', quantite: '', qte_dispo: mp.qte_disponible }] };
    }));
  };

  const majPctMpOf = (fi, mi, val) => {
    const poids = parseFloat(configOf.at3_poids_cible_kg || 0);
    setCompoFamilles(prev => prev.map((f, fii) => {
      if (fii !== fi) return f;
      return { ...f, mp_choisies: f.mp_choisies.map((m, mii) => {
        if (mii !== mi) return m;
        return { ...m, pct: val, quantite: poids > 0 ? ((parseFloat(val||0)/100)*poids).toFixed(3) : '' };
      })};
    }));
  };

  const supprimerMpOf = (fi, mi) => {
    setCompoFamilles(prev => prev.map((f, fii) => fii !== fi ? f : { ...f, mp_choisies: f.mp_choisies.filter((_, mii) => mii !== mi) }));
  };

  const totalPctOf = compoFamilles.reduce((s, f) => s + f.mp_choisies.reduce((sf, m) => sf + parseFloat(m.pct||0), 0), 0);

  const sauvegarderCompoOf = async (valider = false) => {
    if (valider && Math.abs(totalPctOf - 100) > 0.1) return toast.error(`Total ${totalPctOf.toFixed(1)}% — doit être 100%`);
    if (valider && !configOf.at3_poids_cible_kg) return toast.error('Poids cible requis');
    setSavingCompo(true);
    try {
      await axios.put(`${API}/at3/of/${detail.id}/configurer`, {
        ...configOf,
        composition_of: compoFamilles.flatMap(f => f.mp_choisies.map(m => ({
          mp_id: m.mp_id, code: m.code, designation: m.designation,
          pct: m.pct, quantite: m.quantite,
          famille_id: f.famille_id, famille_libelle: f.famille_libelle,
        }))),
        at3_composition_familles: compoFamilles,
        valider,
      });
      toast.success(valider ? '✅ Composition validée — Extrusion lancée !' : '💾 Sauvegardé');
      onRefresh();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setSavingCompo(false);
  };"""

if old_useeffect in c:
    c = c.replace(old_useeffect, new_useeffect)
    print("✓ useEffect et fonctions composition ajoutés")
else:
    # Cherche une variante
    import re
    match = re.search(r'useEffect\(\s*\(\)\s*=>\s*\{\s*if \(detail\?\.id\) chargerLots\(\);\s*\},\s*\[detail\?\.id\]\);', c)
    if match:
        c = c[:match.start()] + new_useeffect + c[match.end():]
        print("✓ useEffect trouvé via regex et remplacé")
    else:
        print("⚠ useEffect non trouvé — ajout manuel nécessaire")

# ─────────────────────────────────────────────────────────────
# 4. Remplacer le bloc "Aller au Flux AT3" par la vraie composition
# ─────────────────────────────────────────────────────────────
old_bloc = """      {/* Composition matières */}
      <div style={{background:'#f0fdf4',borderRadius:10,padding:14,marginBottom:16,border:'1px solid #bbf7d0'}}>
        {user?.role==='chef_atelier' && (
          <div style={{background:'#dbeafe',borderRadius:8,padding:'12px 16px',marginBottom:10,border:'1px solid #93c5fd',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:700,color:'#1d4ed8',fontSize:13}}>🏭 Composition par famille MP</div>
              <div style={{fontSize:11,color:'#6b7280',marginTop:2}}>Utilisez le module Flux AT3 pour configurer la composition par famille de matières premières</div>
            </div>
            <button onClick={()=>{onClose();}}
              style={{background:'#1d4ed8',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontWeight:700,fontSize:12}}>
              → Aller au Flux AT3
            </button>
          </div>
        )}"""

new_bloc = """      {/* Composition matières */}
      <div style={{background:'#f0fdf4',borderRadius:10,padding:14,marginBottom:16,border:'1px solid #bbf7d0'}}>
        {user?.role==='chef_atelier' && (
          <div style={{marginBottom:12}}>
            {/* Paramètres production */}
            <div style={{background:'#f8fafc',borderRadius:8,padding:12,marginBottom:12,border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#1d4ed8',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>⚙ Paramètres production</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                {[['Poids cible (kg)','at3_poids_cible_kg'],['Nb bobines','at3_nb_bobines_cibles'],['Machine (ID)','at3_machine_assignee_id']].map(([label,key])=>(
                  <div key={key}>
                    <label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>{label}</label>
                    <input type="number" value={configOf[key]||''} onChange={e=>setConfigOf(prev=>({...prev,[key]:e.target.value}))}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'6px',fontSize:13,textAlign:'center',fontWeight:700,boxSizing:'border-box'}}/>
                  </div>
                ))}
              </div>
              <div>
                <label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Instructions régleur</label>
                <textarea value={configOf.at3_notes_regleur||''} onChange={e=>setConfigOf(prev=>({...prev,at3_notes_regleur:e.target.value}))}
                  rows={2} placeholder="Températures, vitesses, consignes..."
                  style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'6px',fontSize:12,resize:'vertical',boxSizing:'border-box'}}/>
              </div>
            </div>
            {/* Composition par famille */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:13,color:'#92400e'}}>🧪 Composition par famille</div>
              <div style={{background:Math.abs(totalPctOf-100)<0.1?'#dcfce7':totalPctOf>100?'#fee2e2':'#fef3c7',
                color:Math.abs(totalPctOf-100)<0.1?'#15803d':totalPctOf>100?'#dc2626':'#92400e',
                padding:'2px 12px',borderRadius:20,fontSize:12,fontWeight:800}}>
                {totalPctOf.toFixed(1)}% {Math.abs(totalPctOf-100)<0.1?'✓':''}
              </div>
            </div>
            {compoFamilles.length===0 ? (
              <div style={{background:'#fef3c7',borderRadius:8,padding:12,fontSize:12,color:'#92400e'}}>
                ⚠ Cet article n'a pas de composition famille définie — configurez-la dans la fiche article (admin)
              </div>
            ) : compoFamilles.map((f,fi)=>{
              const clrs=[{bg:'#dbeafe',tx:'#1d4ed8',bd:'#93c5fd'},{bg:'#fef3c7',tx:'#92400e',bd:'#fcd34d'},{bg:'#f3e8ff',tx:'#6d28d9',bd:'#c4b5fd'},{bg:'#dcfce7',tx:'#15803d',bd:'#86efac'},{bg:'#fce7f3',tx:'#9d174d',bd:'#f9a8d4'}];
              const clr=clrs[fi%clrs.length];
              const totalF=f.mp_choisies.reduce((s,m)=>s+parseFloat(m.pct||0),0);
              const mpDispo=mpDeFamille(f.famille_id);
              return (
                <div key={fi} style={{border:`2px solid ${clr.bd}`,borderRadius:10,overflow:'hidden',marginBottom:8}}>
                  <div style={{background:clr.bg,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontWeight:800,color:clr.tx,fontSize:13}}>{f.famille_libelle}</span>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{background:'#fff',color:clr.tx,padding:'1px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{f.pct_famille}% OF</span>
                      <span style={{background:Math.abs(totalF-f.pct_famille)<0.1?'#15803d':'#dc2626',color:'#fff',padding:'1px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>
                        {totalF.toFixed(1)}% {Math.abs(totalF-f.pct_famille)<0.1?'✓':''}
                      </span>
                    </div>
                  </div>
                  <div style={{padding:'10px 12px',background:'#fff'}}>
                    {f.mp_choisies.length>0 && (
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,marginBottom:8}}>
                        <thead><tr style={{background:clr.bg}}>
                          {['MP','Stock AT3','%','Kg',''].map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',fontSize:10,fontWeight:600,color:clr.tx}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {f.mp_choisies.map((m,mi)=>{
                            const insuf=parseFloat(m.quantite||0)>m.qte_dispo&&m.qte_dispo>0;
                            return (<tr key={mi} style={{borderBottom:`1px solid ${clr.bd}`}}>
                              <td style={{padding:'5px 8px',fontWeight:700,color:clr.tx}}>{m.code}<div style={{fontSize:10,color:'#6b7280'}}>{m.designation}</div></td>
                              <td style={{padding:'5px 8px',color:insuf?'#dc2626':'#15803d',fontSize:11,fontWeight:600}}>{m.qte_dispo>0?`${m.qte_dispo.toFixed(1)} kg`:'—'}{insuf?' ⚠':''}</td>
                              <td style={{padding:'5px 8px',width:80}}>
                                <input type="number" value={m.pct} min="0" max="100" step="0.1" onChange={e=>majPctMpOf(fi,mi,e.target.value)}
                                  style={{width:60,border:`1px solid ${clr.bd}`,borderRadius:5,padding:'4px',fontSize:12,textAlign:'center',fontWeight:700}}/>
                                <span style={{fontSize:10,marginLeft:2}}>%</span>
                              </td>
                              <td style={{padding:'5px 8px',fontWeight:700,color:clr.tx,fontSize:12}}>{m.quantite?`${m.quantite} kg`:'—'}</td>
                              <td style={{padding:'5px 8px'}}>
                                <button onClick={()=>supprimerMpOf(fi,mi)} style={{background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:5,padding:'3px 7px',cursor:'pointer',fontSize:11}}>🗑</button>
                              </td>
                            </tr>);
                          })}
                        </tbody>
                      </table>
                    )}
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                      <span style={{fontSize:10,fontWeight:600,color:'#6b7280'}}>+ Ajouter :</span>
                      {mpDispo.filter(mp=>!f.mp_choisies.find(m=>m.mp_id===mp.id)).map(mp=>(
                        <button key={mp.id} onClick={()=>ajouterMpDansFamille(fi,mp.id)} style={{
                          background:mp.qte_disponible>0?clr.bg:'#f3f4f6',color:mp.qte_disponible>0?clr.tx:'#9ca3af',
                          border:`1px solid ${clr.bd}`,borderRadius:20,padding:'3px 10px',cursor:'pointer',fontSize:11,fontWeight:600
                        }}>
                          + {mp.code} ({mp.qte_disponible>0?`${mp.qte_disponible.toFixed(0)} kg`:'rupture'})
                        </button>
                      ))}
                      {mpDispo.length===0&&<span style={{fontSize:11,color:'#dc2626'}}>⚠ Aucune MP dans cette famille</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {compoFamilles.length>0 && (
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={()=>sauvegarderCompoOf(false)} disabled={savingCompo}
                  style={{background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',padding:'8px 16px',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:12}}>
                  💾 Sauvegarder
                </button>
                <button onClick={()=>sauvegarderCompoOf(true)} disabled={savingCompo||detail.at3_statut_zone==='extrusion'}
                  style={{background:Math.abs(totalPctOf-100)<0.1&&configOf.at3_poids_cible_kg?'#14532d':'#9ca3af',
                  color:'#fff',border:'none',padding:'8px 20px',borderRadius:8,
                  cursor:Math.abs(totalPctOf-100)<0.1&&configOf.at3_poids_cible_kg?'pointer':'not-allowed',fontWeight:700,fontSize:13}}>
                  {savingCompo?'...':'✅ Valider & Lancer Extrusion'}
                </button>
              </div>
            )}
          </div>
        )}"""

if old_bloc in c:
    c = c.replace(old_bloc, new_bloc)
    print("✓ Bloc composition remplacé")
else:
    print("⚠ Bloc non trouvé exactement")

# ─────────────────────────────────────────────────────────────
# 5. Passer setOngletActif dans l'appel DetailOF
# ─────────────────────────────────────────────────────────────
c = c.replace(
    "{detail && <DetailOF detail={detail} machines={machines} onClose={()=>setDetail(null)} onRefresh={charger} onStatut={changerStatut}/>}",
    "{detail && <DetailOF detail={detail} machines={machines} onClose={()=>setDetail(null)} onRefresh={charger} onStatut={changerStatut} setOngletActif={setOngletActif}/>}"
)

with open('/home/sophopsy-ia/NAIdo/frontend/src/pages/ChefAtelier.jsx','w') as f:
    f.write(c)
print("✅ Patch appliqué")
