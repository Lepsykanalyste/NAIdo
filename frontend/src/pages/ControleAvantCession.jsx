import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';
function fmtDate(d){return new Date(d||Date.now()).toLocaleDateString('fr-FR');}
function fmtDT(d){return new Date(d||Date.now()).toLocaleString('fr-FR');}

// ENR.ALP1-024 — 10 points de contrôle avant cession au magasin
const POINTS_CESSION = [
  { key:'designation',       label:'Désignation conforme',                    requis:true  },
  { key:'fiche_qualite',     label:'Fiche de contrôle qualité (étiquette)',   requis:true  },
  { key:'etat_emballages',   label:'État des emballages',                     requis:true  },
  { key:'quantite_caisse',   label:'Quantité / Caisse conforme',              requis:true  },
  { key:'coloris',           label:'Coloris conforme',                        requis:true  },
  { key:'marquage',          label:'Marquage et étiquetage corrects',          requis:false },
  { key:'proprete',          label:'Propreté des cartons',                    requis:false },
  { key:'cerclage',          label:'Cerclage / filmage correct',              requis:false },
  { key:'lot_visible',       label:'N° de lot visible et lisible',            requis:false },
  { key:'conformite_finale', label:'Conformité générale validée',             requis:true  },
];

function TicketCession({ ctrl, onClose }) {
  const [qr,setQr]=useState('');
  useEffect(()=>{
    import('qrcode').then(Q=>Q.default.toDataURL(
      `CESSION|${ctrl.numero_of||''}|${ctrl.client_nom||''}|${fmtDate(ctrl.created_at)}`,
      {width:110,margin:1,color:{dark:'#059669',light:'#fff'}}
    )).then(setQr).catch(()=>{});
  },[ctrl]);

  const resultats=typeof ctrl.resultats==='string'?JSON.parse(ctrl.resultats||'{}'):(ctrl.resultats||{});
  const nbOK=POINTS_CESSION.filter(p=>resultats[p.key]==='OK').length;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cession ${ctrl.numero_of}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:10px;width:80mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:3px 0}.s{border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}
.ok{color:#15803d;font-weight:bold}.nok{color:#dc2626;font-weight:bold}
.sig{border:1px solid #000;padding:4px;min-height:12mm}.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:80mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:14px;font-weight:900">NAI — AT3</div>
<div class="s"></div>
<div style="text-align:center;font-weight:800;font-size:11px">CONTRÔLE AVANT CESSION AU MAGASIN</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-024 v01</div><hr/>
<div class="r"><span class="lbl">DATE</span><b>${fmtDate(ctrl.created_at)}</b></div>
<div class="r"><span class="lbl">HEURE</span><b>${new Date(ctrl.created_at||Date.now()).toLocaleTimeString('fr-FR')}</b></div>
<div class="r"><span class="lbl">N° OF</span><b>${ctrl.numero_of||'—'}</b></div>
<div class="r"><span class="lbl">CLIENT</span><b>${ctrl.client_nom||'—'}</b></div>
<div class="r"><span class="lbl">ARTICLE</span><b>${ctrl.article||'—'}</b></div>
<div class="r"><span class="lbl">QUANTITÉ</span><b>${ctrl.quantite||'—'}</b></div>
<hr/>
${POINTS_CESSION.map((p,i)=>{
  const v=resultats[p.key];
  return `<div class="r"><span class="lbl">${i+1}. ${p.label}</span><span class="${v==='OK'?'ok':'nok'}">${v||'—'}</span></div>
${resultats[p.key+'_obs']?`<div style="font-size:8px;color:#555;padding-left:8px">→ ${resultats[p.key+'_obs']}</div>`:''}`;
}).join('')}
${ctrl.observations?`<hr/><div style="font-size:9px"><b>Observations:</b> ${ctrl.observations}</div>`:''}
<hr/>
<div style="text-align:center;font-weight:900;font-size:13px">${nbOK===POINTS_CESSION.length?'✓ CESSION AUTORISÉE':'⚠ CESSION EN ATTENTE'}</div>
<div style="text-align:center;margin:4px 0">${qr?`<img src="${qr}" width="90" height="90"/>`:''}
</div><hr/>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm">
<div class="sig"><div style="font-size:7px;font-weight:bold">CONTRÔLEUR</div>${ctrl.controleur_nom||''}<br/><br/>Sig:</div>
<div class="sig"><div style="font-size:7px;font-weight:bold">RESP. PRODUITS FINIS</div><br/><br/>Sig:</div>
</div>
<div class="foot">NAIdo — NAI · ${fmtDate(ctrl.created_at)}</div>
</body></html>`;

  const nbOKDisp = Object.values(resultats).filter(v=>v==='OK').length;
  const autorise = nbOKDisp >= POINTS_CESSION.filter(p=>p.requis).length;

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:340,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#064e3b'}}>
          <div style={{fontWeight:800,fontSize:13,color:'#fff'}}>🖨️ Contrôle avant cession</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{const w=window.open('','_blank','width=420,height:700');w.document.write(html);w.document.close();}}
              style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11}}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>✕</button>
          </div>
        </div>
        <div style={{padding:'16px',fontFamily:'system-ui,sans-serif'}}>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <span style={{padding:'4px 14px',borderRadius:20,fontWeight:700,fontSize:13,background:autorise?'#dcfce7':'#fef3c7',color:autorise?'#15803d':'#d97706'}}>
              {autorise?'✓ CESSION AUTORISÉE':'⚠ EN ATTENTE'}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12,fontSize:13}}>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>OF</div><div style={{fontWeight:700}}>{ctrl.numero_of||'—'}</div></div>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>Client</div><div style={{fontWeight:600}}>{ctrl.client_nom||'—'}</div></div>
          </div>
          {POINTS_CESSION.map((p,i)=>{
            const v=resultats[p.key];const obs=resultats[p.key+'_obs'];
            return(
              <div key={p.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #f3f4f6',fontSize:12}}>
                <span style={{color:'#374151',flex:1}}>{i+1}. {p.label}{p.requis&&<span style={{color:'#ef4444'}}> *</span>}</span>
                <div>
                  {v?<span style={{fontWeight:700,color:v==='OK'?'#15803d':'#dc2626',fontSize:13}}>{v==='OK'?'✅':'❌'} {v}</span>:<span style={{color:'#d1d5db'}}>—</span>}
                </div>
              </div>
            );
          })}
          {ctrl.observations&&<div style={{marginTop:10,padding:'8px 12px',background:'#f0fdf4',borderRadius:8,fontSize:12,color:'#374151'}}>{ctrl.observations}</div>}
        </div>
      </div>
    </div>
  );
}

export default function ControleAvantCession() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [onglet,setOnglet]=useState('nouveau');
  const [ofs,setOfs]=useState([]);
  const [ofSel,setOfSel]=useState(null);
  const [resultats,setResultats]=useState({});
  const [observations,setObservations]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [historique,setHistorique]=useState([]);
  const [ticketSel,setTicketSel]=useState(null);

  const charger=useCallback(async()=>{
    try{
      const [r1,r2]=await Promise.all([
        axios.get(`${API}/of`).catch(()=>({data:[]})),
        axios.get(`${API}/cessions`).catch(()=>({data:[]})),
      ]);
      setOfs((Array.isArray(r1.data)?r1.data:[]).filter(o=>['en_cours','termine'].includes(o.statut)));
      setHistorique(Array.isArray(r2.data)?r2.data:[]);
    }catch{}
  },[]);

  useEffect(()=>{charger();},[charger]);

  const setR=(key,val)=>setResultats(p=>({...p,[key]:val}));
  const nbControles=POINTS_CESSION.filter(p=>resultats[p.key]).length;
  const nbRequis=POINTS_CESSION.filter(p=>p.requis&&resultats[p.key]==='OK').length;
  const totalRequis=POINTS_CESSION.filter(p=>p.requis).length;

  const soumettre=async()=>{
    if(!ofSel)return toast.error('Sélectionnez un OF');
    if(nbControles<POINTS_CESSION.length)return toast.error('Complétez tous les points de contrôle');
    setSubmitting(true);
    try{
      await axios.post(`${API}/cessions`,{
        of_id:ofSel.id,controleur_id:user.id,
        resultats:JSON.stringify(resultats),observations,
      });
      toast.success('Contrôle avant cession enregistré !');
      setResultats({});setObservations('');setOfSel(null);
      charger();setOnglet('historique');
    }catch(e){toast.error(e.response?.data?.error||'Erreur');}
    finally{setSubmitting(false);}
  };

  const S={
    page:{minHeight:'100vh',background:'#f0fdf4',fontFamily:'system-ui,sans-serif'},
    header:{background:'#064e3b',color:'#fff',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    card:{background:'#fff',borderRadius:14,padding:18,border:'1px solid #bbf7d0',marginBottom:14},
    lbl:{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:0.3},
  };

  return(
    <div style={S.page}>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'#6ee7b7',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#064e3b',fontSize:14}}>CC</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>NAIdo — Contrôle Avant Cession</div>
            <div style={{fontSize:11,color:'#6ee7b7'}}>ENR.ALP1-024 · AT3 Sacherie</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,color:'#6ee7b7'}}>{user?.prenom}</span>
          <button onClick={()=>{logout();navigate('/login');}} style={{background:'#065f46',border:'none',color:'#6ee7b7',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:12}}>Quitter</button>
        </div>
      </header>

      <nav style={{background:'#fff',borderBottom:'2px solid #bbf7d0',display:'flex'}}>
        {[{id:'nouveau',l:'Nouveau contrôle'},{id:'historique',l:`Historique (${historique.length})`}].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)} style={{padding:'13px 20px',border:'none',background:'none',cursor:'pointer',fontWeight:onglet===o.id?700:400,color:onglet===o.id?'#059669':'#4b5563',borderBottom:onglet===o.id?'3px solid #059669':'3px solid transparent',fontSize:13}}>{o.l}</button>
        ))}
      </nav>

      <main style={{padding:'16px',maxWidth:720,margin:'0 auto'}}>
        {onglet==='nouveau'&&(
          <div>
            <div style={S.card}>
              <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:700,color:'#064e3b'}}>Sélectionner l'OF</h3>
              {ofs.length===0?<p style={{color:'#9ca3af',fontSize:14}}>Aucun OF disponible</p>
              :ofs.map(of=>(
                <div key={of.id} onClick={()=>setOfSel(of)}
                  style={{padding:'12px',borderRadius:10,cursor:'pointer',border:'2px solid',marginBottom:8,
                    borderColor:ofSel?.id===of.id?'#059669':'#e5e7eb',background:ofSel?.id===of.id?'#f0fdf4':'#fff'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontWeight:700,fontSize:14}}>{of.numero_of}</span>
                    <span style={{fontSize:11,color:'#6b7280'}}>{of.client_nom}</span>
                  </div>
                  <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{of.article_nom}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <h3 style={{margin:0,fontSize:14,fontWeight:700,color:'#064e3b'}}>Points de contrôle</h3>
                <span style={{fontSize:12,fontWeight:600,color:nbControles===POINTS_CESSION.length?'#15803d':'#9ca3af'}}>{nbControles}/{POINTS_CESSION.length}</span>
              </div>
              {POINTS_CESSION.map((p,i)=>(
                <div key={p.key} style={{padding:'10px 0',borderBottom:i<POINTS_CESSION.length-1?'1px solid #f0fdf4':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <span style={{fontSize:13,color:'#374151',flex:1,paddingRight:10}}>
                      {i+1}. {p.label}{p.requis&&<span style={{color:'#ef4444'}}> *</span>}
                    </span>
                    <div style={{display:'flex',gap:6}}>
                      {['OK','NOK'].map(v=>(
                        <button key={v} onClick={()=>setR(p.key,v)}
                          style={{padding:'6px 14px',borderRadius:8,border:'2px solid',cursor:'pointer',fontWeight:700,fontSize:12,
                            borderColor:resultats[p.key]===v?(v==='OK'?'#16a34a':'#dc2626'):'#e5e7eb',
                            background:resultats[p.key]===v?(v==='OK'?'#dcfce7':'#fee2e2'):'#fff',
                            color:resultats[p.key]===v?(v==='OK'?'#15803d':'#dc2626'):'#374151'}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  {resultats[p.key]==='NOK'&&(
                    <input placeholder="Observations..." value={resultats[p.key+'_obs']||''}
                      onChange={e=>setR(p.key+'_obs',e.target.value)}
                      style={{width:'100%',border:'1px solid #fca5a5',borderRadius:8,padding:'7px 12px',fontSize:13,boxSizing:'border-box',background:'#fef2f2'}}/>
                  )}
                </div>
              ))}
            </div>

            {/* Bilan */}
            {nbControles===POINTS_CESSION.length&&(
              <div style={{padding:'12px 16px',borderRadius:12,marginBottom:14,background:nbRequis===totalRequis?'#dcfce7':'#fef3c7',border:`1px solid ${nbRequis===totalRequis?'#86efac':'#fde047'}`,fontWeight:700,fontSize:14,color:nbRequis===totalRequis?'#15803d':'#d97706',textAlign:'center'}}>
                {nbRequis===totalRequis?'✅ Cession autorisée — tous les points requis sont conformes':'⚠ Points non conformes détectés — vérifier avant cession'}
              </div>
            )}

            <div style={S.card}>
              <label style={S.lbl}>Observations générales</label>
              <textarea value={observations} onChange={e=>setObservations(e.target.value)} rows={3}
                style={{width:'100%',border:'1px solid #e5e7eb',borderRadius:10,padding:'11px',fontSize:14,boxSizing:'border-box',resize:'vertical',fontFamily:'inherit'}}
                placeholder="Remarques, conditions particulières de cession..."/>
            </div>

            <button onClick={soumettre} disabled={submitting||nbControles<POINTS_CESSION.length||!ofSel}
              style={{background:(!ofSel||nbControles<POINTS_CESSION.length)?'#d1d5db':'#059669',color:'#fff',border:'none',padding:'17px',borderRadius:12,width:'100%',cursor:'pointer',fontWeight:700,fontSize:16}}>
              {submitting?'Enregistrement...':'✓ Valider la cession & Imprimer'}
            </button>
          </div>
        )}

        {onglet==='historique'&&(
          <div>
            {historique.length===0?(
              <div style={{...S.card,textAlign:'center',padding:48}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <p style={{color:'#9ca3af'}}>Aucun contrôle enregistré</p>
              </div>
            ):historique.map(c=>{
              const res=typeof c.resultats==='string'?JSON.parse(c.resultats||'{}'):(c.resultats||{});
              const nbOK=POINTS_CESSION.filter(p=>res[p.key]==='OK').length;
              const auto=nbOK>=totalRequis;
              return(
                <div key={c.id} style={{...S.card,borderLeft:`4px solid ${auto?'#10b981':'#f59e0b'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8,marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>{c.numero_of}</div>
                      <div style={{fontSize:12,color:'#6b7280'}}>{c.article} · {c.client_nom}</div>
                      <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{fmtDT(c.created_at)} · {c.controleur_nom}</div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:auto?'#dcfce7':'#fef3c7',color:auto?'#15803d':'#d97706'}}>
                        {auto?'✓ Autorisée':'⚠ En attente'}
                      </span>
                      <button onClick={()=>setTicketSel(c)} style={{background:'#f0fdf4',color:'#059669',border:'1px solid #bbf7d0',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>🖨️</button>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:'#6b7280'}}>{nbOK}/{POINTS_CESSION.length} points conformes</div>
                </div>
              );
            })}
            <p style={{textAlign:'center',color:'#9ca3af',fontSize:11,marginTop:24}}>© 2026 NAIdo — NAI</p>
          </div>
        )}
      </main>

      {ticketSel&&<TicketCession ctrl={ticketSel} onClose={()=>setTicketSel(null)}/>}
    </div>
  );
}
