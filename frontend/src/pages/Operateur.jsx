import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';

function fmt(n,d=3){if(!n&&n!==0)return'—';return parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});}
function fmtDate(d){return new Date(d||Date.now()).toLocaleDateString('fr-FR');}
function fmtTime(d){return new Date(d||Date.now()).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
function loadLS(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}}
function saveLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function clearLS(...keys){keys.forEach(k=>{try{localStorage.removeItem(k);}catch{}});}

// Détermine le type de poste depuis le login ou la machine
function getTypePoste(user, mach) {
  const login = user?.login || '';
  if (login.startsWith('op_ext') || mach?.type==='extrudeuse') return 'extrusion';
  if (login.startsWith('op_sou') || mach?.type==='soudeuse')   return 'soudure';
  if (login.startsWith('op_imp') || mach?.type==='impression') return 'impression';
  if (login.startsWith('op_dec') || mach?.type==='decoupe')    return 'emballage';
  return 'extrusion'; // défaut
}

// Destinations selon le flux AT3
const DESTINATIONS_PAR_POSTE = {
  extrusion:  [{ v:'AT3-QUAR', l:'→ Zone Quarantaine AT3' }],
  soudure:    [{ v:'AT3-QUAR', l:'→ Zone Quarantaine AT3' }],
  impression: [{ v:'AT3-QUAR', l:'→ Zone Quarantaine AT3' }, { v:'AT3-DEC', l:'→ Découpe/Emballage' }],
  emballage:  [{ v:'MAG',      l:'→ Stock Atelier'        }, { v:'AT3-EXP', l:'→ Expédition'       }],
};

// ═══════════════════════════════════════════════════════════════════════════
// TICKET BOBINE
// ═══════════════════════════════════════════════════════════════════════════
function TicketBobine({ ticket, of, machine, shift, user, onClose }) {
  const [qr, setQr] = useState('');
  useEffect(()=>{
    const str=['BOB',ticket.numero_ticket||'','OF:'+(of?.numero_of||''),'ART:'+(of?.article_nom||of?.article||'').substring(0,10),'MACH:'+(machine?.code||'NC'),'KG:'+ticket.poids_net_kg,fmtDate(ticket.created_at)].join('|');
    import('qrcode').then(Q=>Q.default.toDataURL(str,{width:130,margin:1,color:{dark:'#1c1917',light:'#fff'}})).then(setQr).catch(()=>{});
  },[ticket]);

  let reglageP={};try{reglageP=JSON.parse(of?.regleur_notes||'{}').params_complets||{};}catch{}

  const rows=[
    {l:'N° BOBINE',v:ticket.numero_ticket||'—',bold:true},null,
    {l:'OF',v:of?.numero_of||'—'},{l:'ARTICLE',v:of?.article_nom||of?.article||'—'},
    {l:'CLIENT',v:of?.client_nom||'—'},{l:'MACHINE',v:machine?.code||machine?.nom||'—'},{l:'SHIFT',v:shift?.nom||'—'},null,
    {l:'LARGEUR',v:(reglageP.largeur_mm||of?.largeur_mm)?`${reglageP.largeur_mm||of?.largeur_mm} mm`:'—'},
    {l:'SOUFFLET',v:(reglageP.soufflet_mm||of?.soufflet_mm)?`${reglageP.soufflet_mm||of?.soufflet_mm} mm`:'—'},
    {l:'ÉPAISSEUR',v:(reglageP.epaisseur_um||of?.epaisseur_um)?`${reglageP.epaisseur_um||of?.epaisseur_um} µm`:'—'},null,
    {l:'POIDS BRUT',v:`${fmt(ticket.poids_brut_kg)} kg`},
    {l:'TARE / MAND.',v:`${fmt(ticket.poids_mandrin_kg)} kg`},
    {l:'POIDS NET ★',v:`${fmt(ticket.poids_net_kg)} kg`,bold:true,big:true},
    ...(parseFloat(ticket.poids_dechets_kg)>0?[{l:'DÉCHETS',v:`${fmt(ticket.poids_dechets_kg)} kg`}]:[]),
    ...(parseFloat(ticket.poids_rebuts_kg)>0?[{l:'REBUTS',v:`${fmt(ticket.poids_rebuts_kg)} kg`}]:[]),
    ...(ticket.etape_dest?[null,{l:'DESTINATION',v:ticket.etape_dest,bold:true}]:[]),null,
    {l:'OPÉRATEUR',v:`${user?.prenom||''} ${user?.nom||''}`.trim()},
    {l:'DATE',v:fmtDate(ticket.created_at)},{l:'HEURE',v:fmtTime(ticket.created_at)},
  ].filter(x=>x!==undefined);

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${ticket.numero_ticket}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:4px 0}.s{border:none;border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}.val{font-weight:bold;text-align:right}
.big{font-size:15px}.qr{text-align:center;margin:5px 0}.sig{border:1px solid #000;padding:4px;min-height:14mm}
.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:72mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:15px;font-weight:900">NAI</div>
<div style="text-align:center;font-size:9px;color:#555">AT3 — EXTRUSION</div>
<div class="s"></div><div style="text-align:center;font-weight:800;font-size:12px">TICKET BOBINE</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-005</div><hr/>
${rows.map(r=>r===null?'<hr/>':
  `<div class="r${r.bold?' bold':''}"><span class="lbl">${r.l}</span><span class="val${r.big?' big':''}">${r.v}</span></div>`
).join('')}
<div class="qr">${qr?`<img src="${qr}" width="120" height="120"/>`:''}
<div style="font-size:8px;color:#666">${ticket.numero_ticket}</div></div><hr/>
${qrRecap?`<div style="text-align:center;margin:4px 0"><img src="${qrRecap}" width="100" height="100"/><div style="font-size:8px;color:#666;margin-top:2px">${r.numero_of} · ${r.shift}</div></div><hr/>`:''}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm">
<div class="sig"><div style="font-size:8px;font-weight:bold">OPÉRATEUR</div>${user?.prenom||''} ${user?.nom||''}<br/><br/>Signature:</div>
<div class="sig"><div style="font-size:8px;font-weight:bold">CHEF DE QUART</div><br/><br/>Signature:</div>
</div><div class="foot">NAIdo — NAI · ${fmtDate(ticket.created_at)}</div>
</body></html>`;

  const imprimer=()=>{const w=window.open('','_blank','width=400,height=700');w.document.write(html);w.document.close();};

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:300,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',fontFamily:"'Courier New',monospace"}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid #e5e7eb',position:'sticky',top:0,background:'#fff'}}>
          <div style={{fontWeight:800,fontSize:13}}>🖨️ Ticket bobine</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={imprimer} style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12}}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{background:'#f3f4f6',border:'none',padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>✕</button>
          </div>
        </div>
        <div style={{padding:'12px 14px',fontSize:11,color:'#000'}}>
          <div style={{textAlign:'center',fontWeight:900,fontSize:15}}>NAI</div>
          <div style={{textAlign:'center',fontSize:9,color:'#555'}}>AT3 — EXTRUSION</div>
          <div style={{borderTop:'2px solid #000',margin:'5px 0'}}/>
          <div style={{textAlign:'center',fontWeight:800,fontSize:12}}>TICKET BOBINE</div>
          <div style={{textAlign:'center',fontSize:8,color:'#666'}}>ENR.ALP1-005</div>
          <div style={{borderTop:'1px dashed #000',margin:'5px 0'}}/>
          {rows.map((r,i)=>r===null?<div key={i} style={{borderTop:'1px dashed #ccc',margin:'4px 0'}}/>
            :<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'1.5px 0',fontWeight:r.bold?700:400,fontSize:r.big?14:11}}>
              <span style={{color:'#444'}}>{r.l}</span><span style={{fontWeight:700,textAlign:'right'}}>{r.v}</span>
            </div>
          )}
          <div style={{textAlign:'center',margin:'8px 0'}}>
            {qr?<img src={qr} width={110} height={110} alt="QR"/>
              :<div style={{width:110,height:110,background:'#f3f4f6',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#9ca3af',borderRadius:4}}>QR...</div>}
            <div style={{fontSize:8,color:'#666',marginTop:2}}>{ticket.numero_ticket}</div>
          </div>
          <div style={{borderTop:'1px dashed #ccc',margin:'5px 0'}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {['Opérateur','Chef de quart'].map(s=>(
              <div key={s} style={{border:'1px solid #000',borderRadius:3,padding:'4px 5px',minHeight:36}}>
                <div style={{fontSize:8,fontWeight:700,textTransform:'uppercase'}}>{s}</div>
                {s==='Opérateur'&&<div style={{fontSize:9,marginTop:1}}>{user?.prenom} {user?.nom}</div>}
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',fontSize:8,color:'#666',marginTop:6,borderTop:'1px dashed #999',paddingTop:3}}>NAIdo — NAI · {fmtDate(ticket.created_at)}</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RÉCAP FIN DE SHIFT
// ═══════════════════════════════════════════════════════════════════════════
function RecapShift({ recap, onNouveau }) {
  const [qrRecap, setQrRecap] = React.useState('');
  React.useEffect(() => {
    const str = `NAI-SHIFT|${recap.numero_of}|${recap.shift}|${recap.operateur}|${recap.date}|BOB:${recap.nb_bobines}|${recap.poids_total}kg`;
    import('qrcode').then(Q => Q.default.toDataURL(str, { width:120, margin:1, color:{dark:'#1c1917',light:'#fff'} })).then(setQrRecap).catch(()=>{});
  }, [recap]);

  const imprimer=()=>{
    const r=recap;
    const w=window.open('','_blank','width=400,height=600');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Récap</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:4px 0}.r{display:flex;justify-content:space-between;padding:1.5px 0}
.sig{border:1px solid #000;padding:4px;min-height:14mm}.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:72mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:15px;font-weight:900">NAI</div>
<div style="text-align:center;font-size:9px;color:#555">AT3 — EXTRUSION</div>
<hr/><div style="text-align:center;font-weight:800;font-size:12px">RÉCAP DE SHIFT</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-007</div><hr/>
<div class="r"><span>OF</span><b>${r.numero_of}</b></div>
<div class="r"><span>ARTICLE</span><b>${r.article}</b></div>
<div class="r"><span>MACHINE</span><b>${r.machine}</b></div>
<div class="r"><span>SHIFT</span><b>${r.shift}</b></div>
<div class="r"><span>OPÉRATEUR</span><b>${r.operateur}</b></div><hr/>
<div class="r" style="font-size:15px;font-weight:900"><span>NB BOBINES</span><b>${r.nb_bobines}</b></div>
<div class="r" style="font-size:15px;font-weight:900"><span>POIDS NET</span><b>${r.poids_total} kg</b></div>
<div class="r"><span>DÉCHETS</span><b>${r.poids_dechets} kg</b></div>
${r.duree_min?`<div class="r"><span>DURÉE</span><b>${Math.floor(r.duree_min/60)}h${String(r.duree_min%60).padStart(2,'0')}</b></div>`:''}
<hr/>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm">
<div class="sig"><div style="font-size:8px;font-weight:bold">OPÉRATEUR</div>${r.operateur}<br/><br/>Signature:</div>
<div class="sig"><div style="font-size:8px;font-weight:bold">CHEF ATELIER</div><br/><br/>Signature:</div>
</div><div class="foot">NAIdo — NAI · ${r.date}</div>
</body></html>`);
    w.document.close();
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:320,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)',fontFamily:"'Courier New',monospace"}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#1c1917'}}>
          <div style={{fontWeight:800,fontSize:14,color:'#f59e0b'}}>🏁 Récap de shift</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={imprimer} style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11}}>🖨️ Imprimer</button>
            <button onClick={onNouveau} style={{background:'#f59e0b',color:'#1c1917',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11}}>Nouveau shift →</button>
          </div>
        </div>
        <div style={{padding:'14px 16px',fontSize:11}}>
          <div style={{textAlign:'center',fontWeight:900,fontSize:15}}>NAI</div>
          <div style={{textAlign:'center',fontSize:9,color:'#555'}}>AT3 — EXTRUSION</div>
          <div style={{borderTop:'2px solid #000',margin:'5px 0'}}/>
          <div style={{textAlign:'center',fontWeight:800,fontSize:13}}>RÉCAP DE SHIFT</div>
          <div style={{textAlign:'center',fontSize:8,color:'#666'}}>ENR.ALP1-007</div>
          <div style={{borderTop:'1px dashed #000',margin:'5px 0'}}/>
          {[['OF',recap.numero_of],['ARTICLE',recap.article],['MACHINE',recap.machine],['SHIFT',recap.shift],['OPÉRATEUR',recap.operateur]].map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'1.5px 0'}}><span style={{color:'#444'}}>{l}</span><strong>{v}</strong></div>
          ))}
          <div style={{borderTop:'1px dashed #000',margin:'5px 0'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:16}}><span>NB BOBINES</span><strong>{recap.nb_bobines}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:16}}><span>POIDS NET</span><strong>{recap.poids_total} kg</strong></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>DÉCHETS</span><strong>{recap.poids_dechets} kg</strong></div>
          {recap.duree_min&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>DURÉE</span><strong>{Math.floor(recap.duree_min/60)}h{String(recap.duree_min%60).padStart(2,'0')}</strong></div>}
          <div style={{borderTop:'1px dashed #000',margin:'5px 0'}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {['Opérateur','Chef atelier'].map(s=>(
              <div key={s} style={{border:'1px solid #000',borderRadius:3,padding:'4px 5px',minHeight:36}}>
                <div style={{fontSize:8,fontWeight:700,textTransform:'uppercase'}}>{s}</div>
                {s==='Opérateur'&&<div style={{fontSize:9}}>{recap.operateur}</div>}
              </div>
            ))}
          </div>
          {qrRecap&&(
            <div style={{textAlign:'center',marginTop:8}}>
              <img src={qrRecap} width={90} height={90} alt="QR" style={{borderRadius:4}}/>
              <div style={{fontSize:8,color:'#666',marginTop:2}}>{recap.numero_of} · {recap.shift}</div>
            </div>
          )}
          <div style={{textAlign:'center',fontSize:8,color:'#666',marginTop:6,borderTop:'1px dashed #999',paddingTop:3}}>NAIdo — NAI · {recap.date}</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIQUE BOBINES
// ═══════════════════════════════════════════════════════════════════════════
function HistoriqueBobines({ user }) {
  const [bobines,setBobines]=useState([]);
  const [loading,setLoading]=useState(true);
  const [ouvert,setOuvert]=useState(false);
  const [ticketSel,setTicketSel]=useState(null);

  useEffect(()=>{
    axios.get(`${API}/tickets?limit=20`).then(r=>setBobines(Array.isArray(r.data)?r.data:[])).catch(()=>setBobines([])).finally(()=>setLoading(false));
  },[user]);

  if(ticketSel) return <TicketBobine ticket={ticketSel} of={{numero_of:ticketSel.numero_of}} machine={{code:ticketSel.machine_code}} shift={null} user={user} onClose={()=>setTicketSel(null)}/>;

  if(!ouvert) return(
    <button onClick={()=>setOuvert(true)} style={{background:'#1c1917',color:'#a8a29e',border:'none',padding:'12px 16px',borderRadius:12,cursor:'pointer',fontWeight:600,fontSize:13,textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%'}}>
      <span>📋 Mes bobines récentes</span>
      <span style={{background:'#f59e0b',color:'#1c1917',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:700}}>{bobines.length}</span>
    </button>
  );

  return(
    <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
      <div style={{background:'#1c1917',color:'#fff',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:700,fontSize:13,color:'#f59e0b'}}>📋 Mes bobines récentes</div>
        <button onClick={()=>setOuvert(false)} style={{background:'transparent',border:'none',color:'#a8a29e',cursor:'pointer',fontSize:16}}>✕</button>
      </div>
      <div style={{padding:'12px 16px'}}>
        {loading?<div style={{textAlign:'center',color:'#9ca3af',padding:16}}>Chargement...</div>
        :bobines.length===0?<div style={{textAlign:'center',color:'#9ca3af',padding:16}}>Aucune bobine</div>
        :<>
          <div style={{fontSize:11,color:'#9ca3af',marginBottom:8}}>{bobines.length} bobines — {bobines.reduce((s,b)=>s+parseFloat(b.poids_net_kg||0),0).toFixed(3)} kg net</div>
          {bobines.map(b=>(
            <div key={b.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid #f3f4f6',fontSize:12}}>
              <div>
                <span style={{fontFamily:'monospace',fontWeight:700,color:'#1c1917'}}>{b.numero_ticket}</span>
                <span style={{color:'#9ca3af',marginLeft:6,fontSize:10}}>{b.created_at?new Date(b.created_at).toLocaleDateString('fr-FR'):''}</span>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontWeight:700,color:'#15803d'}}>{b.poids_net_kg} kg</span>
                <button onClick={()=>setTicketSel(b)} style={{background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',borderRadius:5,padding:'1px 6px',cursor:'pointer',fontSize:10,fontWeight:700}}>🖨️</button>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════
export default function Operateur() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [session,  setSession]  = useState(()=>loadLS('naido_session'));
  const [ofSel,    setOfSel]    = useState(()=>loadLS('naido_of'));
  const [shiftSel, setShiftSel] = useState(()=>loadLS('naido_shift'));
  const [machSel,  setMachSel]  = useState(()=>loadLS('naido_mach'));
  const [etape,    setEtape]    = useState(()=>loadLS('naido_session')?'production':'config');

  const [shifts,    setShifts]    = useState([]);
  const [ofs,       setOfs]       = useState([]);
  const [alertes,   setAlertes]   = useState([]);
  const [tickets,   setTickets]   = useState([]);
  const [lotsDispo, setLotsDispo] = useState([]);
  const [arretActif,setArretActif]= useState(null);
  const [ticketAff, setTicketAff] = useState(null);
  const [recap,     setRecap]     = useState(null);
  const [submitting,setSubmitting]= useState(false);
  const [cloturant, setCloturant] = useState(false);
  const [causeArret,setCauseArret]= useState('');
  const [detailsArr,setDetailsArr]= useState('');

  // Type de poste de l'opérateur (détermine ce qu'il voit)
  const typePoste = getTypePoste(user, machSel || ofSel);
  const destinations = DESTINATIONS_PAR_POSTE[typePoste] || DESTINATIONS_PAR_POSTE.extrusion;

  const [form,setForm]=useState({
    poids_brut:'',poids_mandrin:'',poids_dechets:'',motif_dechet:'',
    destination: destinations[0]?.v || '',
    lot_id:'',nom_matiere:'',qte_pieces:'',numero_colis:'',poids_carton:'',rebuts:'',motif_rebut:''
  });

  const poidsNet = form.poids_brut ? Math.max(0,parseFloat(form.poids_brut)-parseFloat(form.poids_mandrin||0)).toFixed(3) : '';

  // Décompte production
  const cibleKg   = parseFloat(ofSel?.poids_theorique_total_kg||0);
  const produitKg = tickets.reduce((s,t)=>s+parseFloat(t.poids_net_kg||0),0);
  const restantKg = Math.max(0,cibleKg-produitKg);
  const pctProd   = cibleKg>0?Math.min(100,Math.round(produitKg/cibleKg*100)):0;
  const depasse   = cibleKg>0&&produitKg>cibleKg*1.02;
  const atteint   = cibleKg>0&&produitKg>=cibleKg*0.98;

  const chargerDonnees=useCallback(async()=>{
    try{
      const [s,o,al]=await Promise.all([
        axios.get(`${API}/shifts`).catch(()=>({data:[]})),
        axios.get(`${API}/of`).catch(()=>({data:[]})),
        axios.get(`${API}/alertes`).catch(()=>({data:[]})),
      ]);
      setShifts(Array.isArray(s.data)?s.data:[]);
      setOfs((Array.isArray(o.data)?o.data:[]).filter(o=>['planifie','lance','en_cours','en_attente_regleur','en_attente_operateur'].includes(o.statut)));
      setAlertes(Array.isArray(al.data)?al.data:[]);
    }catch{toast.error('Erreur chargement données');}
  },[]);

  const chargerTickets=useCallback(async()=>{
    if(!session?.id)return;
    try{const{data}=await axios.get(`${API}/tickets/session/${session.id}`);setTickets(Array.isArray(data)?data:[]);}catch{}
  },[session]);

  useEffect(()=>{chargerDonnees();},[chargerDonnees]);
  useEffect(()=>{
    if(session){
      chargerTickets();
      axios.get(`${API}/lots-prod/of/${ofSel?.id}`).then(r=>setLotsDispo(Array.isArray(r.data)?r.data:[])).catch(()=>{});
      const iv=setInterval(()=>{chargerTickets();chargerDonnees();},15000);
      return()=>clearInterval(iv);
    }
  },[session,chargerTickets,chargerDonnees,ofSel]);

  // Reset destination quand le type de poste change
  useEffect(()=>{
    setForm(p=>({...p,destination:DESTINATIONS_PAR_POSTE[typePoste]?.[0]?.v||''}));
  },[typePoste]);

  const resetSession=()=>{
    clearLS('naido_session','naido_of','naido_shift','naido_mach');
    setSession(null);setOfSel(null);setShiftSel(null);setMachSel(null);
    setEtape('config');setTickets([]);setArretActif(null);setRecap(null);
  };

  const demarrer=async()=>{
    if(!ofSel||!shiftSel){toast.error('Sélectionnez un OF et un shift');return;}
    try{
      const{data}=await axios.post(`${API}/sessions`,{of_id:ofSel.id,machine_id:ofSel.machine_id||null,shift_id:shiftSel.id});
      setSession(data);saveLS('naido_session',data);
      if(ofSel.poids_mandrin_kg)setForm(p=>({...p,poids_mandrin:ofSel.poids_mandrin_kg.toString()}));
      setEtape('production');toast.success('Production démarrée !');
    }catch(e){toast.error(e.response?.data?.error||'Erreur démarrage');}
  };

  const validerTicket=async()=>{
    if(!form.poids_brut)return toast.error('Saisissez le poids brut');
    setSubmitting(true);
    try{
      const payload={
        session_id:session.id,of_id:ofSel.id,machine_id:ofSel.machine_id||null,article_id:ofSel.article_id||null,
        poids_brut_kg:parseFloat(form.poids_brut||0),poids_mandrin_kg:parseFloat(form.poids_mandrin||0),
        poids_dechets_kg:parseFloat(form.poids_dechets||0),poids_rebuts_kg:parseFloat(form.rebuts||0),
        motif_dechet:form.motif_dechet||null,motif_rebut:form.motif_rebut||null,
        type_ticket:typePoste,etape_source:typePoste,etape_dest:form.destination||null,
        lot_id:form.lot_id||null,nom_matiere:form.nom_matiere||null,
        qte_pieces:parseInt(form.qte_pieces||0),numero_sequence:tickets.length+1,
      };
      const{data}=await axios.post(`${API}/tickets`,payload);
      toast.success(`Bobine ${data.numero_ticket} enregistrée !`);
      setTicketAff({...data,etape_dest:form.destination});
      setForm(p=>({...p,poids_brut:'',poids_mandrin:'',poids_dechets:'',motif_dechet:'',rebuts:'',motif_rebut:'',lot_id:'',nom_matiere:''}));
      chargerTickets();
    }catch(e){toast.error(e.response?.data?.error||e.message||'Erreur enregistrement');}
    finally{setSubmitting(false);}
  };

  const declarerArret=async()=>{
    if(!causeArret)return toast.error('Choisissez une cause');
    try{
      const{data}=await axios.post(`${API}/arrets`,{session_id:session.id,machine_id:ofSel?.machine_id||null,cause:causeArret,details:detailsArr});
      setArretActif(data);setCauseArret('');setDetailsArr('');setEtape('production');toast.success('Arrêt déclaré');
    }catch(e){toast.error(e.response?.data?.error||'Erreur arrêt');}
  };

  const relancer=async()=>{
    try{await axios.put(`${API}/arrets/${arretActif.id}/relancer`);setArretActif(null);toast.success('Machine relancée');}
    catch{toast.error('Erreur relance');}
  };

  const cloturerShift=async()=>{
    if(!session)return;setCloturant(true);
    try{
      await axios.put(`${API}/sessions/${session.id}/terminer`);
      const poidsTotal=tickets.reduce((s,t)=>s+parseFloat(t.poids_net_kg||0),0);
      const poidsDechet=tickets.reduce((s,t)=>s+parseFloat(t.poids_dechets_kg||0),0);
      const dureeMin=session.created_at?Math.round((Date.now()-new Date(session.created_at).getTime())/60000):null;
      setRecap({numero_of:ofSel?.numero_of||'—',article:ofSel?.article_nom||'—',machine:machSel?.code||machSel?.nom||'NC',shift:shiftSel?.nom||'—',operateur:`${user?.prenom||''} ${user?.nom||''}`.trim(),nb_bobines:tickets.length,poids_total:poidsTotal.toFixed(3),poids_dechets:poidsDechet.toFixed(3),duree_min:dureeMin,date:new Date().toLocaleDateString('fr-FR')});
    }catch{toast.error('Erreur clôture');}
    finally{setCloturant(false);}
  };

  const alertesNonLues=alertes.filter(a=>!a.lu).length;
  const inp={width:'100%',borderRadius:10,padding:'14px',fontSize:20,fontWeight:700,boxSizing:'border-box',textAlign:'center',border:'2px solid #e5e7eb',outline:'none',fontFamily:'inherit'};

  // Labels du type de poste
  const POSTE_LABELS = {extrusion:{icon:'🏭',label:'Extrusion',color:'#0369a1'},soudure:{icon:'⚡',label:'Soudure',color:'#d97706'},impression:{icon:'🖨',label:'Impression',color:'#0891b2'},emballage:{icon:'📦',label:'Emballage',color:'#7c3aed'}};
  const posteInfo = POSTE_LABELS[typePoste] || POSTE_LABELS.extrusion;

  return(
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:'system-ui,sans-serif'}}>
      <header style={{background:'#1c1917',color:'#fff',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'#f59e0b',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#1c1917',fontSize:16}}>O</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>NAIdo — Opérateur</div>
            <div style={{fontSize:11,color:'#a8a29e'}}>{posteInfo.icon} {posteInfo.label} · {shiftSel?.nom||'AT3'}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {alertesNonLues>0&&<span style={{background:'#dc2626',color:'#fff',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>🔔 {alertesNonLues}</span>}
          {arretActif&&<span style={{background:'#dc2626',color:'#fff',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>⚠ ARRÊT</span>}
          <span style={{fontSize:12,color:'#a8a29e'}}>{user?.prenom}</span>
          <button onClick={()=>{logout();navigate('/login');}} style={{background:'#292524',border:'none',color:'#a8a29e',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:12}}>Quitter</button>
        </div>
      </header>

      <main style={{padding:'16px',maxWidth:700,margin:'0 auto'}}>
        {alertes.filter(a=>!a.lu&&a.message).slice(0,2).map(al=>(
          <div key={al.id} style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:12,padding:'10px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{fontWeight:700,color:'#92400e',fontSize:13}}>🔔 {al.titre}</div><div style={{fontSize:12,color:'#6b7280',marginTop:1}}>{al.message}</div></div>
            <button onClick={()=>axios.put(`${API}/alertes/${al.id}/lire`).then(chargerDonnees)} style={{background:'#f59e0b',border:'none',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:700}}>✓ Lu</button>
          </div>
        ))}

        {/* ══ CONFIG ══ */}
        {etape==='config'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'#fff',borderRadius:14,padding:20,border:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700}}>Mon shift</h3>
              <p style={{fontSize:12,color:'#9ca3af',marginBottom:14}}>Poste : {posteInfo.icon} {posteInfo.label}</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {shifts.map(s=>(
                  <button key={s.id} onClick={()=>{setShiftSel(s);saveLS('naido_shift',s);}}
                    style={{padding:'18px 8px',borderRadius:10,border:'2px solid',cursor:'pointer',textAlign:'center',fontWeight:600,fontSize:13,
                      borderColor:shiftSel?.id===s.id?'#f59e0b':'#e5e7eb',background:shiftSel?.id===s.id?'#fffbeb':'#fff'}}>
                    <div style={{fontSize:26,marginBottom:5}}>{s.nom==='Matin'?'🌅':s.nom==='Apres-midi'?'☀️':'🌙'}</div>
                    {s.nom}<div style={{fontSize:10,color:'#9ca3af',fontWeight:400,marginTop:2}}>{s.heure_debut?.substring(0,5)}–{s.heure_fin?.substring(0,5)}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>setEtape('of')} disabled={!shiftSel}
              style={{background:!shiftSel?'#d1d5db':'#f59e0b',color:!shiftSel?'#9ca3af':'#1c1917',border:'none',padding:'18px',borderRadius:12,cursor:!shiftSel?'not-allowed':'pointer',fontWeight:700,fontSize:17,width:'100%'}}>
              Voir les OFs disponibles →
            </button>
          </div>
        )}

        {/* ══ OF ══ */}
        {etape==='of'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <HistoriqueBobines user={user}/>
            <div style={{background:'#fff',borderRadius:14,padding:18,border:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>Choisir l'Ordre de Fabrication</h3>
              {ofs.length===0
                ?<div style={{textAlign:'center',padding:'32px 0',color:'#9ca3af'}}><div style={{fontSize:36}}>⏳</div><p>Aucun OF disponible</p></div>
                :ofs.map(of=>(
                  <div key={of.id} onClick={()=>{
                    setOfSel(of);saveLS('naido_of',of);
                    if(of.machine_id){const m={id:of.machine_id,code:of.machine_code||'',nom:of.machine_nom||'',type:of.machine_type||'extrudeuse'};setMachSel(m);saveLS('naido_mach',m);}
                  }}
                    style={{padding:'14px',borderRadius:10,border:'2px solid',cursor:'pointer',marginBottom:10,
                      borderColor:ofSel?.id===of.id?'#f59e0b':'#e5e7eb',background:ofSel?.id===of.id?'#fffbeb':'#fff'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
                      <span style={{fontWeight:700,fontSize:16}}>{of.numero_of}</span>
                      <div style={{display:'flex',gap:6}}>
                        {of.regleur_valide&&<span style={{background:'#dcfce7',color:'#15803d',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>✓ Réglé</span>}
                        {of.client_nom&&<span style={{background:'#fef3c7',color:'#92400e',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{of.client_nom}</span>}
                      </div>
                    </div>
                    <div style={{fontSize:13,color:'#374151',fontWeight:600,marginTop:4}}>{of.article_nom}</div>
                    <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>
                      Cible : {parseFloat(of.quantite_cible||0).toLocaleString('fr-FR',{maximumFractionDigits:0})} {of.unite_code||'kg'}
                      {of.poids_theorique_total_kg?` · ${parseFloat(of.poids_theorique_total_kg).toLocaleString('fr-FR',{maximumFractionDigits:1})} kg`:''}
                      {of.largeur_mm?` · L${of.largeur_mm}mm`:''}
                    </div>
                    {!of.regleur_valide&&<div style={{fontSize:11,color:'#dc2626',marginTop:4,fontWeight:600}}>⚠ Réglage non validé</div>}
                  </div>
                ))
              }
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setEtape('config')} style={{flex:1,background:'#f3f4f6',color:'#374151',border:'none',padding:'16px',borderRadius:12,cursor:'pointer',fontWeight:600}}>← Retour</button>
              <button onClick={demarrer} disabled={!ofSel}
                style={{flex:2,background:ofSel?'#16a34a':'#d1d5db',color:'#fff',border:'none',padding:'16px',borderRadius:12,cursor:ofSel?'pointer':'not-allowed',fontWeight:700,fontSize:16}}>
                ▶ Démarrer
              </button>
            </div>
          </div>
        )}

        {/* ══ PRODUCTION ══ */}
        {etape==='production'&&session&&ofSel&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* Bandeau OF */}
            <div style={{background:'#1c1917',color:'#fff',borderRadius:14,padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                <div>
                  <div style={{fontSize:11,color:'#a8a29e'}}>OF en cours · {posteInfo.icon} {posteInfo.label}</div>
                  <div style={{fontWeight:700,fontSize:17}}>{ofSel.numero_of}</div>
                  <div style={{fontSize:12,color:'#d6d3d1'}}>{ofSel.article_nom}</div>
                  <div style={{fontSize:11,color:'#a8a29e'}}>{ofSel.client_nom}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:'#a8a29e'}}>Bobines</div>
                  <div style={{fontWeight:800,fontSize:30,color:'#f59e0b'}}>{tickets.length}</div>
                </div>
              </div>
              {/* Décompte */}
              {cibleKg>0&&(
                <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid #292524'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
                    <span style={{color:'#a8a29e'}}>Production</span>
                    <span style={{fontWeight:700,color:depasse?'#ef4444':atteint?'#34d399':'#f59e0b'}}>
                      {produitKg.toFixed(1)} / {cibleKg.toFixed(1)} kg ({pctProd}%)
                    </span>
                  </div>
                  <div style={{height:8,background:'#292524',borderRadius:8,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${pctProd}%`,borderRadius:8,transition:'width 0.4s',background:depasse?'#ef4444':atteint?'#34d399':'#f59e0b'}}/>
                  </div>
                  <div style={{fontSize:10,color:depasse?'#ef4444':atteint?'#34d399':'#a8a29e',marginTop:3}}>
                    {depasse?'⚠ Dépassement +2% — OF terminé':atteint?'✅ Objectif atteint':`Restant : ${restantKg.toFixed(1)} kg`}
                  </div>
                </div>
              )}
              {/* Params régleur */}
              {ofSel.regleur_valide&&(()=>{let p={};try{p=JSON.parse(ofSel.regleur_notes||'{}').params_complets||{};}catch{}return Object.keys(p).length>0?(
                <div style={{marginTop:8,paddingTop:6,borderTop:'1px solid #292524',display:'flex',gap:6,flexWrap:'wrap'}}>
                  {p.temp_zone1&&<Pill l="T°Z1" v={`${p.temp_zone1}°C`}/>}
                  {p.pression_bar&&<Pill l="P" v={`${p.pression_bar}bar`}/>}
                  {p.largeur_mm&&<Pill l="L" v={`${p.largeur_mm}mm`}/>}
                  {p.epaisseur_um&&<Pill l="Ép" v={`${p.epaisseur_um}µm`}/>}
                  {p.vitesse_vis&&<Pill l="V" v={`${p.vitesse_vis}tr/min`}/>}
                  {p.corona==='Oui'&&<Pill l="Corona" v="✓"/>}
                </div>
              ):null;})()}
            </div>

            {/* Arrêt actif */}
            {arretActif&&(
              <div style={{background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:14,padding:'14px 16px'}}>
                <div style={{fontWeight:700,color:'#dc2626',marginBottom:8}}>⚠ Machine à l'arrêt — {arretActif.cause?.replace(/_/g,' ')}</div>
                <button onClick={relancer} style={{background:'#16a34a',color:'#fff',border:'none',padding:'14px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:16,width:'100%'}}>▶ Relancer la machine</button>
              </div>
            )}

            {/* Formulaire bobine */}
            {!arretActif&&(
              <div style={{background:'#fff',borderRadius:14,padding:16,border:'1px solid #e5e7eb'}}>
                {/* Indicateur de type (lecture seule) */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 12px',background:posteInfo.color+'15',borderRadius:8,border:`1px solid ${posteInfo.color}44`}}>
                  <span style={{fontSize:20}}>{posteInfo.icon}</span>
                  <span style={{fontWeight:700,color:posteInfo.color,fontSize:14}}>{posteInfo.label}</span>
                  <span style={{fontSize:11,color:'#9ca3af',marginLeft:'auto'}}>Poste assigné</span>
                </div>

                {/* Pesée */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Poids brut (kg) *</label>
                    <input type="number" step="0.001" value={form.poids_brut} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,poids_brut:e.target.value}))}
                      style={{...inp,border:'2px solid #f59e0b'}} placeholder="0.000"/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Tare / Mandrin (kg)</label>
                    <input type="number" step="0.001" value={form.poids_mandrin} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,poids_mandrin:e.target.value}))}
                      style={{...inp,color:'#6b7280'}} placeholder="0.000"/>
                  </div>
                </div>
                {/* Poids net */}
                <div style={{background:'#f0fdf4',border:'2px solid #86efac',borderRadius:10,padding:'10px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:13,fontWeight:600,color:'#15803d'}}>POIDS NET</span>
                  <span style={{fontSize:26,fontWeight:800,color:'#15803d'}}>{poidsNet||'—'} kg</span>
                </div>
                {/* Déchets/Rebuts */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Déchets (kg)</label>
                    <input type="number" step="0.001" value={form.poids_dechets} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,poids_dechets:e.target.value}))}
                      style={{...inp,fontSize:16,border:'1px solid #fca5a5'}} placeholder="0.000"/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Rebuts (kg)</label>
                    <input type="number" step="0.001" value={form.rebuts} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,rebuts:e.target.value}))}
                      style={{...inp,fontSize:16,border:'1px solid #fca5a5'}} placeholder="0.000"/>
                  </div>
                </div>
                {/* Lots MP */}
                {lotsDispo.length>0&&(
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Lot MP (optionnel)</label>
                    <select value={form.lot_id} onChange={e=>{const l=lotsDispo.find(x=>x.id===e.target.value);setForm(p=>({...p,lot_id:e.target.value,nom_matiere:l?.nom_matiere||l?.mp_nom||''}));}}
                      style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
                      <option value="">-- Sélectionner lot --</option>
                      {lotsDispo.map(l=><option key={l.id} value={l.id}>{l.nom_matiere||l.mp_nom||l.mp_code} — lot {l.numero_lot}</option>)}
                    </select>
                  </div>
                )}
                {/* Destination (selon le poste) */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Destination</label>
                  {destinations.length===1
                    ?<div style={{padding:'10px 14px',background:'#dcfce7',borderRadius:8,border:'1px solid #86efac',fontWeight:700,color:'#15803d',fontSize:14}}>
                      ✓ {destinations[0].l}
                    </div>
                    :<div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                      {destinations.map(d=>(
                        <button key={d.v} onClick={()=>setForm(p=>({...p,destination:d.v}))}
                          style={{padding:'10px',borderRadius:8,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:600,
                            borderColor:form.destination===d.v?'#15803d':'#e5e7eb',
                            background:form.destination===d.v?'#dcfce7':'#fff',
                            color:form.destination===d.v?'#15803d':'#374151'}}>
                          {d.l}
                        </button>
                      ))}
                    </div>
                  }
                </div>
                <button onClick={validerTicket}
                  disabled={submitting||depasse||!form.poids_brut}
                  style={{background:depasse?'#dc2626':submitting?'#d1d5db':'#1c1917',color:submitting?'#9ca3af':'#f59e0b',border:'none',padding:'16px',borderRadius:12,width:'100%',cursor:submitting||depasse?'not-allowed':'pointer',fontWeight:700,fontSize:16}}>
                  {depasse?'⛔ OF terminé (+2%)':submitting?'Enregistrement...':'🖨️ Valider & Imprimer ticket bobine'}
                </button>
              </div>
            )}

            {/* Arrêt + fin shift */}
            {!arretActif&&(
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setEtape('arret')} style={{flex:1,background:'#fff',color:'#dc2626',border:'2px solid #fca5a5',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:13}}>⏹ Arrêt machine</button>
                <button onClick={cloturerShift} disabled={cloturant} style={{flex:1,background:'#1c1917',color:'#f59e0b',border:'none',padding:'14px',borderRadius:12,cursor:cloturant?'not-allowed':'pointer',fontWeight:700,fontSize:13}}>
                  {cloturant?'Clôture...':'🏁 Fin de shift'}
                </button>
              </div>
            )}

            {/* Liste bobines */}
            {tickets.length>0&&(
              <div style={{background:'#fff',borderRadius:14,padding:14,border:'1px solid #e5e7eb'}}>
                <h4 style={{margin:'0 0 10px',fontSize:13,fontWeight:700}}>
                  Bobines session ({tickets.length}) — {tickets.reduce((s,t)=>s+parseFloat(t.poids_net_kg||0),0).toFixed(3)} kg net
                </h4>
                {tickets.slice(0,8).map(t=>(
                  <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:'#f9fafb',borderRadius:8,marginBottom:6,fontSize:13,alignItems:'center'}}>
                    <div>
                      <span style={{fontWeight:600,fontFamily:'monospace'}}>{t.numero_ticket}</span>
                      <span style={{color:'#9ca3af',marginLeft:6}}>{new Date(t.created_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontWeight:700,color:'#15803d'}}>{t.poids_net_kg} kg</span>
                      <button onClick={()=>setTicketAff({...t})} style={{background:'#f0fdf4',color:'#15803d',border:'1px solid #86efac',borderRadius:6,padding:'2px 7px',cursor:'pointer',fontSize:11,fontWeight:700}}>🖨️ Ticket</button>
                    </div>
                  </div>
                ))}
                {tickets.length>8&&<div style={{textAlign:'center',fontSize:11,color:'#9ca3af',marginTop:4}}>+{tickets.length-8} autres</div>}
              </div>
            )}
          </div>
        )}

        {/* ══ ARRÊT ══ */}
        {etape==='arret'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'#fff',borderRadius:14,padding:20,border:'2px solid #fca5a5'}}>
              <h3 style={{margin:'0 0 14px',fontSize:16,fontWeight:700,color:'#dc2626'}}>⏹ Déclarer un arrêt machine</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                {[['panne_mecanique','Panne mécanique','🔧'],['panne_electrique','Panne électrique','⚡'],
                  ['changement_matiere','Changement matière','📦'],['reglage','Réglage','⚙️'],
                  ['coupure_electricite','Coupure électricité','🔌'],['manque_personnel','Manque personnel','👷'],
                  ['fin_shift','Fin de shift','🏁'],['autre','Autre','📝']].map(([v,l,i])=>(
                  <button key={v} onClick={()=>setCauseArret(v)}
                    style={{padding:'12px 8px',borderRadius:10,border:'2px solid',cursor:'pointer',textAlign:'center',
                      borderColor:causeArret===v?'#dc2626':'#e5e7eb',background:causeArret===v?'#fee2e2':'#fff'}}>
                    <div style={{fontSize:20,marginBottom:3}}>{i}</div>
                    <div style={{fontSize:11,fontWeight:600,color:causeArret===v?'#dc2626':'#374151'}}>{l}</div>
                  </button>
                ))}
              </div>
              <textarea value={detailsArr} onChange={e=>setDetailsArr(e.target.value)} rows={2}
                placeholder="Précisions (optionnel)..."
                style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'10px',fontSize:14,boxSizing:'border-box',resize:'none',marginBottom:14,fontFamily:'inherit'}}/>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setEtape('production')} style={{flex:1,background:'#f3f4f6',color:'#374151',border:'none',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:600}}>← Annuler</button>
                <button onClick={declarerArret} disabled={!causeArret}
                  style={{flex:2,background:causeArret?'#dc2626':'#d1d5db',color:'#fff',border:'none',padding:'14px',borderRadius:12,cursor:causeArret?'pointer':'not-allowed',fontWeight:700,fontSize:15}}>
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        <p style={{textAlign:'center',color:'#9ca3af',fontSize:11,marginTop:16}}>© 2026 NAIdo — NAI</p>
      </main>

      {recap&&<RecapShift recap={recap} onNouveau={resetSession}/>}
      {ticketAff&&<TicketBobine ticket={ticketAff} of={ofSel} machine={machSel} shift={shiftSel} user={user} onClose={()=>setTicketAff(null)}/>}
    </div>
  );
}

function Pill({l,v}){return(<div style={{background:'#292524',borderRadius:6,padding:'3px 7px',display:'flex',alignItems:'center',gap:3}}><span style={{fontSize:9,color:'#a8a29e',textTransform:'uppercase'}}>{l}</span><span style={{fontSize:11,fontWeight:700,color:'#f59e0b'}}>{v}</span></div>);}
