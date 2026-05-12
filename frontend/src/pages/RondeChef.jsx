import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';
function fmtDate(d){return new Date(d||Date.now()).toLocaleDateString('fr-FR');}
function fmtDT(d){return new Date(d||Date.now()).toLocaleString('fr-FR');}

// ENR.ALP1-030 — Points de contrôle de la ronde
const POINTS_RONDE = [
  { key:'dimensions',    label:'Dimension (largeur, soufflets)',         type:'oknok', obs:true },
  { key:'epaisseur',     label:'Épaisseur sur plusieurs points',         type:'oknok', obs:true },
  { key:'milieu_soufflets', label:'Milieu des soufflets',               type:'oknok', obs:true },
  { key:'resistance_gaine', label:'Résistance de la gaine',            type:'oknok', obs:true },
  { key:'bois_soufflet', label:'Vérification des bois de soufflet',     type:'oknok', obs:true },
  { key:'forme_bobine',  label:'Vérification de la forme de la bobine', type:'oknok', obs:true },
  { key:'aspect_bobine', label:'Vérification aspect (couleur) bobine',  type:'oknok', obs:true },
  { key:'tuyau_bobine',  label:'Vérification du tuyau de la bobine',    type:'oknok', obs:true },
];

function TicketRonde({ ronde, onClose }) {
  const [qr,setQr]=useState('');
  useEffect(()=>{
    import('qrcode').then(Q=>Q.default.toDataURL(
      `RONDE|${ronde.numero_of||''}|${ronde.chef_nom||''}|${fmtDate(ronde.created_at)}`,
      {width:110,margin:1,color:{dark:'#1c1917',light:'#fff'}}
    )).then(setQr).catch(()=>{});
  },[ronde]);

  const resultats=typeof ronde.resultats==='string'?JSON.parse(ronde.resultats||'{}'):(ronde.resultats||{});
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ronde ${fmtDate(ronde.created_at)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:10px;width:80mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:3px 0}.s{border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}
.ok{color:#15803d;font-weight:bold}.nok{color:#dc2626;font-weight:bold}
.sig{border:1px solid #000;padding:4px;min-height:12mm}.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:80mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:14px;font-weight:900">NAI — AT3</div>
<div class="s"></div>
<div style="text-align:center;font-weight:800;font-size:11px">FICHE DE RONDE DU CHEF DE QUART</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-030 v01</div><hr/>
<div class="r"><span class="lbl">Chef de quart</span><b>${ronde.chef_nom||'—'}</b></div>
<div class="r"><span class="lbl">OF</span><b>${ronde.numero_of||'—'}</b></div>
<div class="r"><span class="lbl">Machine</span><b>${ronde.machine||'—'}</b></div>
<div class="r"><span class="lbl">Date</span><b>${fmtDate(ronde.created_at)}</b></div>
<div class="r"><span class="lbl">Début</span><b>${ronde.heure_debut||'—'}</b></div>
<div class="r"><span class="lbl">Fin</span><b>${ronde.heure_fin||'—'}</b></div>
<hr/>
${POINTS_RONDE.map(p=>{
  const v=resultats[p.key];
  return `<div class="r"><span class="lbl">${p.label}</span><span class="${v==='OUI'?'ok':v==='NON'?'nok':''}">${v||'—'}</span></div>
${resultats[p.key+'_obs']?`<div style="font-size:8px;color:#555;padding-left:8px">→ ${resultats[p.key+'_obs']}</div>`:''}`;
}).join('')}
${ronde.actions?`<hr/><div style="font-size:9px"><b>Actions menées:</b> ${ronde.actions}</div>`:''}
<div style="text-align:center;margin:4px 0">${qr?`<img src="${qr}" width="90" height="90"/>`:''}
</div><hr/>
<div class="sig"><div style="font-size:7px;font-weight:bold">CHEF DE QUART</div>${ronde.chef_nom||''}<br/><br/>Signature:</div>
<div class="foot">NAIdo — NAI · ${fmtDate(ronde.created_at)}</div>
</body></html>`;

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:340,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#0f172a'}}>
          <div style={{fontWeight:800,fontSize:13,color:'#fff'}}>🖨️ Fiche de ronde</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{const w=window.open('','_blank','width=420,height:700');w.document.write(html);w.document.close();}}
              style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11}}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>✕</button>
          </div>
        </div>
        <div style={{padding:'16px',fontFamily:'system-ui,sans-serif'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14,fontSize:13}}>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>Chef de quart</div><div style={{fontWeight:700}}>{ronde.chef_nom||'—'}</div></div>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>OF</div><div style={{fontWeight:700}}>{ronde.numero_of||'—'}</div></div>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>Date</div><div style={{fontWeight:600}}>{fmtDT(ronde.created_at)}</div></div>
          </div>
          {POINTS_RONDE.map(p=>{
            const v=resultats[p.key];const obs=resultats[p.key+'_obs'];
            return(
              <div key={p.key} style={{padding:'7px 0',borderBottom:'1px solid #f3f4f6'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13}}>
                  <span style={{color:'#374151'}}>{p.label}</span>
                  {v&&<span style={{fontWeight:700,color:v==='OUI'?'#15803d':'#dc2626',fontSize:14}}>{v==='OUI'?'✅ OUI':'❌ NON'}</span>}
                </div>
                {obs&&<div style={{fontSize:11,color:'#6b7280',marginTop:2}}>→ {obs}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RondeChef() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [onglet, setOnglet]     = useState('nouvelle');
  const [ofs, setOfs]           = useState([]);
  const [ofSel, setOfSel]       = useState(null);
  const [machines, setMachines] = useState([]);
  const [machSel, setMachSel]   = useState('');
  const [heureDebut,setHeureDebut]=useState(new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  const [heureFin, setHeureFin] = useState('');
  const [resultats, setResultats]=useState({});
  const [actions, setActions]   = useState('');
  const [submitting,setSubmitting]=useState(false);
  const [historique,setHistorique]=useState([]);
  const [ticketSel,setTicketSel]=useState(null);

  const charger=useCallback(async()=>{
    try{
      const [r1,r2,r3]=await Promise.all([
        axios.get(`${API}/of`).catch(()=>({data:[]})),
        axios.get(`${API}/machines`).catch(()=>({data:[]})),
        axios.get(`${API}/rondes`).catch(()=>({data:[]})),
      ]);
      setOfs((Array.isArray(r1.data)?r1.data:[]).filter(o=>o.statut==='en_cours'));
      setMachines(Array.isArray(r2.data)?r2.data:[]);
      setHistorique(Array.isArray(r3.data)?r3.data:[]);
    }catch{}
  },[]);

  useEffect(()=>{charger();},[charger]);

  const setR=(key,val)=>setResultats(p=>({...p,[key]:val}));
  const nbControles=POINTS_RONDE.filter(p=>resultats[p.key]).length;

  const soumettre=async()=>{
    if(!ofSel)return toast.error('Sélectionnez un OF');
    if(nbControles<POINTS_RONDE.length)return toast.error('Complétez tous les points de contrôle');
    setSubmitting(true);
    try{
      await axios.post(`${API}/rondes`,{
        of_id:ofSel.id,machine_id:machSel||null,
        chef_id:user.id,heure_debut:heureDebut,heure_fin:heureFin,
        resultats:JSON.stringify(resultats),actions,
      });
      toast.success('Ronde enregistrée !');
      setResultats({});setActions('');setOfSel(null);
      charger();setOnglet('historique');
    }catch(e){toast.error(e.response?.data?.error||'Erreur');}
    finally{setSubmitting(false);}
  };

  const S={
    page:{minHeight:'100vh',background:'#f1f5f9',fontFamily:'system-ui,sans-serif'},
    header:{background:'#0f172a',color:'#fff',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    card:{background:'#fff',borderRadius:14,padding:18,border:'1px solid #e2e8f0',marginBottom:14},
    lbl:{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:0.3},
  };

  return(
    <div style={S.page}>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'#f59e0b',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#0f172a',fontSize:16}}>R</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>NAIdo — Ronde Chef de Quart</div>
            <div style={{fontSize:11,color:'#94a3b8'}}>ENR.ALP1-030 · AT3 Sacherie</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,color:'#94a3b8'}}>{user?.prenom}</span>
          <button onClick={()=>{logout();navigate('/login');}} style={{background:'#1e293b',border:'none',color:'#94a3b8',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:12}}>Quitter</button>
        </div>
      </header>

      <nav style={{background:'#fff',borderBottom:'2px solid #e2e8f0',display:'flex'}}>
        {[{id:'nouvelle',l:'Nouvelle ronde'},{id:'historique',l:`Historique (${historique.length})`}].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)} style={{padding:'13px 20px',border:'none',background:'none',cursor:'pointer',fontWeight:onglet===o.id?700:400,color:onglet===o.id?'#f59e0b':'#4b5563',borderBottom:onglet===o.id?'3px solid #f59e0b':'3px solid transparent',fontSize:13}}>{o.l}</button>
        ))}
      </nav>

      <main style={{padding:'16px',maxWidth:720,margin:'0 auto'}}>
        {onglet==='nouvelle'&&(
          <div>
            <div style={S.card}>
              <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:700}}>Identification</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={S.lbl}>Heure début</label>
                  <input type="time" value={heureDebut} onChange={e=>setHeureDebut(e.target.value)}
                    style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px',fontSize:15,boxSizing:'border-box'}}/>
                </div>
                <div>
                  <label style={S.lbl}>Heure fin</label>
                  <input type="time" value={heureFin} onChange={e=>setHeureFin(e.target.value)}
                    style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px',fontSize:15,boxSizing:'border-box'}}/>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={S.lbl}>OF en cours *</label>
                <select value={ofSel?.id||''} onChange={e=>{setOfSel(ofs.find(o=>o.id===e.target.value)||null);}}
                  style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px',fontSize:14}}>
                  <option value="">-- Sélectionner --</option>
                  {ofs.map(o=><option key={o.id} value={o.id}>{o.numero_of} — {o.article_nom}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Machine</label>
                <select value={machSel} onChange={e=>setMachSel(e.target.value)}
                  style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px',fontSize:14}}>
                  <option value="">-- Sélectionner --</option>
                  {machines.map(m=><option key={m.id} value={m.id}>{m.code} — {m.nom}</option>)}
                </select>
              </div>
            </div>

            <div style={S.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <h3 style={{margin:0,fontSize:14,fontWeight:700}}>Points de contrôle</h3>
                <span style={{fontSize:12,color:nbControles===POINTS_RONDE.length?'#15803d':'#9ca3af',fontWeight:600}}>{nbControles}/{POINTS_RONDE.length} contrôles</span>
              </div>
              {POINTS_RONDE.map((p,i)=>(
                <div key={p.key} style={{padding:'12px 0',borderBottom:i<POINTS_RONDE.length-1?'1px solid #f1f5f9':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:14,color:'#374151',fontWeight:500,flex:1,paddingRight:12}}>{p.label}</span>
                    <div style={{display:'flex',gap:8}}>
                      {['OUI','NON'].map(v=>(
                        <button key={v} onClick={()=>setR(p.key,v)}
                          style={{padding:'7px 16px',borderRadius:8,border:'2px solid',cursor:'pointer',fontWeight:700,fontSize:13,
                            borderColor:resultats[p.key]===v?(v==='OUI'?'#16a34a':'#dc2626'):'#e2e8f0',
                            background:resultats[p.key]===v?(v==='OUI'?'#dcfce7':'#fee2e2'):'#fff',
                            color:resultats[p.key]===v?(v==='OUI'?'#15803d':'#dc2626'):'#374151'}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {p.obs&&resultats[p.key]==='NON'&&(
                    <input placeholder="Observations..." value={resultats[p.key+'_obs']||''}
                      onChange={e=>setR(p.key+'_obs',e.target.value)}
                      style={{width:'100%',border:'1px solid #fca5a5',borderRadius:8,padding:'8px 12px',fontSize:13,boxSizing:'border-box',background:'#fef2f2'}}/>
                  )}
                </div>
              ))}
            </div>

            <div style={S.card}>
              <label style={S.lbl}>Actions menées</label>
              <textarea value={actions} onChange={e=>setActions(e.target.value)} rows={3}
                placeholder="Actions correctives, consignes pour le prochain shift..."
                style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px',fontSize:14,boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}/>
            </div>

            <button onClick={soumettre} disabled={submitting||nbControles<POINTS_RONDE.length||!ofSel}
              style={{background:(!ofSel||nbControles<POINTS_RONDE.length)?'#d1d5db':'#0f172a',color:(!ofSel||nbControles<POINTS_RONDE.length)?'#9ca3af':'#f59e0b',border:'none',padding:'17px',borderRadius:12,width:'100%',cursor:(!ofSel||nbControles<POINTS_RONDE.length)?'not-allowed':'pointer',fontWeight:700,fontSize:16}}>
              {submitting?'Enregistrement...':'✓ Valider la ronde & Imprimer'}
            </button>
          </div>
        )}

        {onglet==='historique'&&(
          <div>
            {historique.length===0?(
              <div style={{...S.card,textAlign:'center',padding:48}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <p style={{color:'#9ca3af'}}>Aucune ronde enregistrée</p>
              </div>
            ):historique.map(r=>{
              const res=typeof r.resultats==='string'?JSON.parse(r.resultats||'{}'):(r.resultats||{});
              const nbOK=POINTS_RONDE.filter(p=>res[p.key]==='OUI').length;
              const nbNOK=POINTS_RONDE.filter(p=>res[p.key]==='NON').length;
              return(
                <div key={r.id} style={{...S.card,borderLeft:`4px solid ${nbNOK>0?'#f59e0b':'#10b981'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8,marginBottom:10}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{r.numero_of||'—'}</div>
                      <div style={{fontSize:12,color:'#6b7280'}}>{fmtDT(r.created_at)}</div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>✅ {nbOK}</span>
                      {nbNOK>0&&<span style={{background:'#fee2e2',color:'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>❌ {nbNOK}</span>}
                      <button onClick={()=>setTicketSel(r)} style={{background:'#f1f5f9',color:'#374151',border:'1px solid #e2e8f0',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>🖨️ Fiche</button>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:'#6b7280'}}>Chef : {r.chef_nom||'—'} · {r.heure_debut||'—'} – {r.heure_fin||'—'}</div>
                  {r.actions&&<div style={{marginTop:6,fontSize:12,color:'#374151',background:'#fef9c3',padding:'6px 10px',borderRadius:6}}>⚡ {r.actions}</div>}
                </div>
              );
            })}
            <p style={{textAlign:'center',color:'#9ca3af',fontSize:11,marginTop:24}}>© 2026 NAIdo — NAI</p>
          </div>
        )}
      </main>

      {ticketSel&&<TicketRonde ronde={ticketSel} onClose={()=>setTicketSel(null)}/>}
    </div>
  );
}
