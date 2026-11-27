import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { EcranReglage, TicketImprimable as TicketReglage, MonProfilRegleur } from './Regleur';

const API = '/api';

function fmt(n,d=3){if(!n&&n!==0)return'—';return parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});}
function fmtDate(d){return new Date(d||Date.now()).toLocaleDateString('fr-FR');}
function fmtTime(d){return new Date(d||Date.now()).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});}
function libShift(s){if(!s)return'—';const h=x=>{const[a,b]=String(x||'').split(':');return parseInt(a,10)+'h'+(b&&b!=='00'?b:'');};return(s.heure_debut&&s.heure_fin)?`${s.nom} (${h(s.heure_debut)}-${h(s.heure_fin)})`:(s.nom||'—');}
// poids d'un ticket : bobine = poids net ; colis soudure/decoupe = poids net du colis (pese - emballage)
function poidsTicket(t){const c=parseFloat(t&&t.poids_colis_net_kg);return c>0?c:parseFloat((t&&t.poids_net_kg)||0);}
function loadLS(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}}
function saveLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function clearLS(...keys){keys.forEach(k=>{try{localStorage.removeItem(k);}catch{}});}

// Détermine le type de poste depuis le login ou la machine
function getTypePoste(user, mach) {
  const login = user?.login || '';
  if (login.startsWith('op_ext')) return 'extrusion';
  if (login.startsWith('op_imp')) return 'impression';
  if (login.startsWith('op_sou') || login.startsWith('op_dec')) return 'soudure_decoupe';
  if (mach?.type==='extrudeuse') return 'extrusion';
  if (mach?.type==='impression') return 'impression';
  if (mach?.type==='soudeuse' || mach?.type==='decoupe') return 'soudure_decoupe';
  return 'extrusion'; // défaut
}

// Destinations selon le flux AT3
const DESTINATIONS_PAR_POSTE = {
  extrusion:        [{ v:'AT3-QUAR', l:'→ Zone Quarantaine AT3' }],
  impression:       [{ v:'AT3-QUAR', l:'→ Zone Quarantaine AT3' }, { v:'AT3-SOUD', l:'→ Soudure/Découpe' }],
  soudure_decoupe:  [{ v:'AT3-FOND', l:'→ Fond carré' }, { v:'AT3-STOCK-PF', l:'→ Zone de stockage PF' }],
};

// ═══════════════════════════════════════════════════════════════════════════
// TICKET BOBINE
// ═══════════════════════════════════════════════════════════════════════════
function TicketBobine({ ticket, of, machine, shift, user, onClose }) {
  const [qr, setQr] = useState('');
  useEffect(()=>{
    const str=window.location.origin+'/api/tickets/'+ticket.id+'/view';
    import('qrcode').then(Q=>Q.default.toDataURL(str,{width:130,margin:1,color:{dark:'#1c1917',light:'#fff'}})).then(setQr).catch(()=>{});
  },[ticket]);

  let reglageP={};try{reglageP=JSON.parse(of?.regleur_notes||'{}').params_complets||{};}catch{}

  const isSD=ticket.type_ticket==='soudure_decoupe';
  const rows=isSD?[
    {l:'N° TICKET',v:ticket.numero_ticket||'—',bold:true},null,
    {l:'OF',v:of?.numero_of||'—'},{l:'ARTICLE',v:of?.article_nom||of?.article||'—'},
    {l:'CLIENT',v:of?.client_nom||'—'},{l:'MACHINE',v:machine?.code||machine?.nom||'—'},{l:'SHIFT',v:libShift(shift)},null,
    {l:'QTE PIECES ★',v:`${fmt(ticket.qte_pieces,0)}`,bold:true,big:true},
    ...(ticket.numero_colis?[{l:'N° COLIS',v:ticket.numero_colis}]:[]),
    ...(parseFloat(ticket.poids_colis_brut_kg)>0?[{l:'COLIS PESÉ',v:`${fmt(ticket.poids_colis_brut_kg)} kg`},{l:'EMBALLAGE',v:`${fmt(ticket.poids_emballage_kg)} kg${ticket.type_emballage?' ('+ticket.type_emballage+')':''}`},{l:'POIDS NET COLIS ★',v:`${fmt(ticket.poids_colis_net_kg)} kg`,bold:true,big:true}]
      :(parseFloat(ticket.poids_carton_kg)>0?[{l:'POIDS COLIS',v:`${fmt(ticket.poids_carton_kg)} kg`}]:[])),
    ...(parseFloat(ticket.reliquat_repris_kg)>0?[{l:'RELIQUAT REPRIS',v:`${fmt(ticket.reliquat_repris_kg)} kg`}]:[]),
    ...(parseFloat(ticket.poids_dechets_kg)>0?[{l:'DÉCHETS',v:`${fmt(ticket.poids_dechets_kg)} kg`}]:[]),
    ...(ticket.etape_dest?[null,{l:'DESTINATION',v:ticket.etape_dest,bold:true}]:[]),null,
    {l:'OPÉRATEUR',v:`${user?.prenom||''} ${user?.nom||''}`.trim()},
    {l:'DATE',v:fmtDate(ticket.created_at)},{l:'HEURE',v:fmtTime(ticket.created_at)},
  ].filter(x=>x!==undefined):[
    {l:'N° BOBINE',v:ticket.numero_ticket||'—',bold:true},null,
    {l:'OF',v:of?.numero_of||'—'},{l:'ARTICLE',v:of?.article_nom||of?.article||'—'},
    {l:'CLIENT',v:of?.client_nom||'—'},{l:'MACHINE',v:machine?.code||machine?.nom||'—'},{l:'SHIFT',v:libShift(shift)},null,
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
<div style="text-align:center;font-size:9px;color:#555">AT3 — ${isSD?'SOUDURE/DECOUPE':'EXTRUSION'}</div>
<div class="s"></div><div style="text-align:center;font-weight:800;font-size:12px">${isSD?'TICKET SOUDURE/DECOUPE':'TICKET BOBINE'}</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-005</div><hr/>
${rows.map(r=>r===null?'<hr/>':
  `<div class="r${r.bold?' bold':''}"><span class="lbl">${r.l}</span><span class="val${r.big?' big':''}">${r.v}</span></div>`
).join('')}
<div class="qr">${qr?`<img src="${qr}" width="120" height="120"/>`:''}
<div style="font-size:8px;color:#666">${ticket.numero_ticket}</div></div><hr/>
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
          <div style={{fontWeight:800,fontSize:13}}>🖨️ {isSD?'Ticket soudure/decoupe':'Ticket bobine'}</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={imprimer} style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12}}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{background:'#f3f4f6',border:'none',padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>✕</button>
          </div>
        </div>
        <div style={{padding:'12px 14px',fontSize:11,color:'#000'}}>
          <div style={{textAlign:'center',fontWeight:900,fontSize:15}}>NAI</div>
          <div style={{textAlign:'center',fontSize:9,color:'#555'}}>AT3 — {isSD?'SOUDURE/DECOUPE':'EXTRUSION'}</div>
          <div style={{borderTop:'2px solid #000',margin:'5px 0'}}/>
          <div style={{textAlign:'center',fontWeight:800,fontSize:12}}>{isSD?'TICKET SOUDURE/DECOUPE':'TICKET BOBINE'}</div>
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
  const ofs = recap.ofs || [];
  const unite = recap.unite || 'bobines';
  const tot = ofs.reduce((a, o) => ({ nb: a.nb + (o.nb_bobines || 0), kg: a.kg + parseFloat(o.poids_total || 0), dech: a.dech + parseFloat(o.poids_dechets || 0), pcs: a.pcs + (o.pieces || 0) }), { nb: 0, kg: 0, dech: 0, pcs: 0 });
  const duree = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  React.useEffect(() => {
    const str = `NAI-SHIFT|${ofs.map(o => o.numero_of).join(',')}|${recap.shift}|${recap.operateur}|${recap.date}|${unite.toUpperCase()}:${tot.nb}|${tot.kg.toFixed(3)}kg`;
    import('qrcode').then(Q => Q.default.toDataURL(str, { width:120, margin:1, color:{dark:'#1c1917',light:'#fff'} })).then(setQrRecap).catch(()=>{});
  }, [recap]);

  const imprimer=()=>{
    const r=recap;
    const w=window.open('','_blank','width=400,height=600');
    const blocs = ofs.map(o => `<hr/>
<div class="r"><span>OF</span><b>${o.numero_of}</b></div>
<div class="r"><span>ARTICLE</span><b>${o.article}</b></div>
<div class="r"><span>MACHINE</span><b>${o.machine}</b></div>
<div class="r"><span>${unite.toUpperCase()}</span><b>${o.nb_bobines}</b></div>
${o.pieces?`<div class="r"><span>PIÈCES</span><b>${o.pieces}</b></div>`:''}
<div class="r"><span>POIDS NET</span><b>${o.poids_total} kg</b></div>
${o.prevues?`<div class="r"><span>CUMUL OF</span><b>${o.cumul_of} / ${o.prevues}</b></div>`:''}
<div class="r"><span>DÉCHETS</span><b>${o.poids_dechets} kg</b></div>
${o.duree_min?`<div class="r"><span>DURÉE</span><b>${duree(o.duree_min)}</b></div>`:''}`).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Récap</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:11px;width:72mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:4px 0}.r{display:flex;justify-content:space-between;padding:1.5px 0}
.sig{border:1px solid #000;padding:4px;min-height:14mm}.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:72mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:15px;font-weight:900">NAI</div>
<div style="text-align:center;font-size:9px;color:#555">AT3 — ${unite==='colis'?'SOUDURE/DECOUPE':'PRODUCTION'}</div>
<hr/><div style="text-align:center;font-weight:800;font-size:12px">RÉCAP DE SHIFT</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-007</div><hr/>
<div class="r"><span>SHIFT</span><b>${r.shift}</b></div>
<div class="r"><span>OPÉRATEUR</span><b>${r.operateur}</b></div>
<div class="r"><span>DATE</span><b>${r.date}</b></div>
${blocs}
<hr/>
<div class="r" style="font-size:14px;font-weight:900"><span>TOTAL ${unite.toUpperCase()}</span><b>${tot.nb}</b></div>
<div class="r" style="font-size:14px;font-weight:900"><span>POIDS NET</span><b>${tot.kg.toFixed(3)} kg</b></div>
<div class="r"><span>DÉCHETS</span><b>${tot.dech.toFixed(3)} kg</b></div>
${r.sacs_vides>0?`<div class="r"><span>SACS VIDES (quarantaine)</span><b>${r.sacs_vides} kg</b></div>`:''}
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
          <div style={{textAlign:'center',fontSize:9,color:'#555'}}>AT3 — {unite==='colis'?'SOUDURE/DECOUPE':'PRODUCTION'}</div>
          <div style={{borderTop:'2px solid #000',margin:'5px 0'}}/>
          <div style={{textAlign:'center',fontWeight:800,fontSize:13}}>RÉCAP DE SHIFT</div>
          <div style={{textAlign:'center',fontSize:8,color:'#666'}}>ENR.ALP1-007</div>
          <div style={{borderTop:'1px dashed #000',margin:'5px 0'}}/>
          {[['SHIFT',recap.shift],['OPÉRATEUR',recap.operateur],['DATE',recap.date]].map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'1.5px 0'}}><span style={{color:'#444'}}>{l}</span><strong>{v}</strong></div>
          ))}
          {ofs.map((o,i)=>(
            <div key={i} data-recap-of={o.numero_of} style={{borderTop:'1px dashed #000',marginTop:6,paddingTop:5}}>
              {[['OF',o.numero_of],['ARTICLE',o.article],['MACHINE',o.machine]].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'1.5px 0'}}><span style={{color:'#444'}}>{l}</span><strong style={{textAlign:'right'}}>{v}</strong></div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>{unite.toUpperCase()}</span><strong>{o.nb_bobines}</strong></div>
              {o.pieces>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>PIÈCES</span><strong>{o.pieces}</strong></div>}
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>POIDS NET</span><strong>{o.poids_total} kg</strong></div>
              {o.prevues&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>CUMUL OF</span><strong>{o.cumul_of} / {o.prevues}</strong></div>}
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>DÉCHETS</span><strong>{o.poids_dechets} kg</strong></div>
              {o.duree_min>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>DURÉE</span><strong>{duree(o.duree_min)}</strong></div>}
            </div>
          ))}
          <div style={{borderTop:'2px solid #000',margin:'8px 0 5px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:15}}><span>TOTAL {unite.toUpperCase()}</span><strong>{tot.nb}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:15}}><span>POIDS NET</span><strong>{tot.kg.toFixed(3)} kg</strong></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>DÉCHETS</span><strong>{tot.dech.toFixed(3)} kg</strong></div>
          {recap.sacs_vides>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#444'}}>SACS VIDES (quarantaine)</span><strong>{recap.sacs_vides} kg</strong></div>}
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
              <div style={{fontSize:8,color:'#666',marginTop:2}}>{ofs.map(o=>o.numero_of).join(' · ')} · {recap.shift}</div>
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
          <div style={{fontSize:11,color:'#9ca3af',marginBottom:8}}>{bobines.length} tickets — {bobines.reduce((s,b)=>s+poidsTicket(b),0).toFixed(3)} kg net</div>
          {bobines.map(b=>(
            <div key={b.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid #f3f4f6',fontSize:12}}>
              <div>
                <span style={{fontFamily:'monospace',fontWeight:700,color:'#1c1917'}}>{b.numero_ticket}</span>
                <span style={{color:'#9ca3af',marginLeft:6,fontSize:10}}>{b.created_at?new Date(b.created_at).toLocaleDateString('fr-FR'):''}</span>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontWeight:700,color:'#15803d'}}>{fmt(poidsTicket(b))} kg{parseInt(b.qte_pieces)>0?` · ${b.qte_pieces} pcs`:''}</span>
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
  const [machChoisie,setMachChoisie]=useState(()=>loadLS('naido_mach_choisie'));   // machine choisie par l'operateur quand l'OF n'en a pas
  const [machinesListe,setMachinesListe]=useState([]);
  const [etape,    setEtape]    = useState(()=>loadLS('naido_session')?'production':'config');

  const [shifts,    setShifts]    = useState([]);
  const [ofs,       setOfs]       = useState([]);
  const [alertes,   setAlertes]   = useState([]);
  const [tickets,   setTickets]   = useState([]);
  const [lotsDispo, setLotsDispo] = useState([]);
  const [bobinesDispo, setBobinesDispo] = useState([]);
  const [arretActif,setArretActif]= useState(null);
  const [ticketAff, setTicketAff] = useState(null);
  const [recap,     setRecap]     = useState(null);
  const [submitting,setSubmitting]= useState(false);
  const [cloturant, setCloturant] = useState(false);
  const [causeArret,setCauseArret]= useState('');
  const [detailsArr,setDetailsArr]= useState('');
  // Réglage (AT3 : l'opérateur d'extrusion fait lui-même le réglage)
  const [reglageMode,setReglageMode]=useState(null);   // null | 'premier' | 'reprise' | 'modif' | 'pendant'
  const [reglagesOf,setReglagesOf]=useState([]);
  const [ticketReglageAff,setTicketReglageAff]=useState(null);
  const [cumulOf,setCumulOf]=useState(null);           // bobines de l'OF, tous quarts confondus
  const [monProfil,setMonProfil]=useState(false);     // photo et signature de l'opérateur
  const [shiftOfs,setShiftOfs]=useState(()=>loadLS('naido_shift_ofs')||[]);   // OF déjà terminés pendant ce shift (récap multi-OF)
  const [finShift,setFinShift]=useState(false);       // fenêtre de fin de shift (poids des sacs vides)
  const [sacsVides,setSacsVides]=useState('');
  const [rechBobine,setRechBobine]=useState('');      // soudure : recherche d'une bobine
  const [reliquatDispo,setReliquatDispo]=useState(0);  // soudure : reliquat des bobines précédentes à reprendre

  // Type de poste de l'opérateur (détermine ce qu'il voit)
  const typePoste = getTypePoste(user, machSel || ofSel);
  // Machine du poste : soudure/decoupe = SO01..SO05 choisie par l'operateur (jamais la machine d'extrusion de l'OF) ;
  // autres postes = machine de l'OF, ou celle choisie ici si l'OF n'en a pas
  const machSD=(machSel&&machSel.id>=10&&machSel.id<=14)?machSel:null;
  const machChoisieValide=(machChoisie&&ofSel&&machChoisie.of_id===ofSel.id)?machChoisie:null;
  const machineId=typePoste==='soudure_decoupe'?(machSD?.id||null):(ofSel?.machine_id||machChoisieValide?.id||null);
  const machineTicket=typePoste==='soudure_decoupe'?machSD:(ofSel?.machine_id?machSel:machChoisieValide);
  useEffect(()=>{
    if(!ofSel||ofSel.machine_id||typePoste==='soudure_decoupe')return;
    axios.get(`${API}/machines`).then(r=>{
      const l=Array.isArray(r.data)?r.data:[]; const pre={extrusion:'EX',impression:'IM'}[typePoste];
      const f=pre?l.filter(m=>String(m.code||'').toUpperCase().startsWith(pre)):l; setMachinesListe(f.length?f:l);
    }).catch(()=>{});
  },[ofSel,typePoste]);
  const destinations = DESTINATIONS_PAR_POSTE[typePoste] || DESTINATIONS_PAR_POSTE.extrusion;

  const [form,setForm]=useState({
    poids_brut:'',poids_mandrin:'',poids_dechets:'',motif_dechet:'',
    destination: destinations[0]?.v || '',
    lot_id:'',nom_matiere:'',qte_pieces:'',numero_colis:'',poids_carton:'',rebuts:'',motif_rebut:'',
    poids_colis:'',poids_emballage:(loadLS('naido_emballage')||{}).poids||'',type_emballage:(loadLS('naido_emballage')||{}).type||''
  });

  const poidsNet = form.poids_brut ? Math.max(0,parseFloat(form.poids_brut)-parseFloat(form.poids_mandrin||0)).toFixed(3) : '';
  // Soudure/découpe : poids net du colis = poids pesé - emballage ; c'est lui qui est déduit de la bobine (moins le reliquat repris)
  const bobinesFiltrees=bobinesDispo.filter(b=>!rechBobine.trim()||String(b.numero_ticket||'').toLowerCase().includes(rechBobine.trim().toLowerCase()));
  const parentSel=bobinesDispo.find(b=>b.id===form.bobine_parent_id)||null;
  const colisNet=Math.max(0,(parseFloat(form.poids_colis)||0)-(parseFloat(form.poids_emballage)||0));
  const reprisPrevu=parentSel?Math.min(reliquatDispo,colisNet):0;
  const deduitBobine=Math.max(0,colisNet-reprisPrevu);
  const restantApres=parentSel?parseFloat(parentSel.poids_restant_kg)-deduitBobine:null;

  // Décompte production
  // Poids cible : celui fixé par le chef d'atelier ; à défaut, quantité x poids théorique de l'article
  const cibleKg   = parseFloat(ofSel?.at3_poids_cible_kg)||parseFloat(ofSel?.poids_theorique_total_kg)||0;
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
    try{const{data}=await axios.get(`${API}/tickets/of/${session.of_id}/resume`);setCumulOf(data);}catch{}
  },[session]);

  const chargerBobines=useCallback(()=>{
    if(typePoste==='soudure_decoupe'&&ofSel?.id){
      axios.get(`${API}/tickets/disponibles`,{params:{of_id:ofSel.id,zone:'AT3-SOUD'}}).then(r=>setBobinesDispo(Array.isArray(r.data)?r.data:[])).catch(()=>{});
      axios.get(`${API}/tickets/reliquats`,{params:{of_id:ofSel.id}}).then(r=>setReliquatDispo(parseFloat(r.data&&r.data.total_kg)||0)).catch(()=>{});
    }
  },[typePoste,ofSel]);

  useEffect(()=>{chargerDonnees();},[chargerDonnees]);
  // la bobine choisie disparaît de la liste quand elle est terminée
  useEffect(()=>{if(form.bobine_parent_id&&bobinesDispo.length&&!bobinesDispo.find(b=>b.id===form.bobine_parent_id))setForm(p=>({...p,bobine_parent_id:''}));},[bobinesDispo]);
  useEffect(()=>{
    if(session){
      chargerTickets();
      axios.get(`${API}/lots-prod/of/${ofSel?.id}`).then(r=>setLotsDispo(Array.isArray(r.data)?r.data:[])).catch(()=>{});
      chargerBobines();
      const iv=setInterval(()=>{chargerTickets();chargerDonnees();chargerBobines();},15000);
      return()=>clearInterval(iv);
    }
  },[session,chargerTickets,chargerDonnees,chargerBobines,ofSel]);

  // Reset destination quand le type de poste change
  useEffect(()=>{
    setForm(p=>({...p,destination:DESTINATIONS_PAR_POSTE[typePoste]?.[0]?.v||''}));
  },[typePoste]);

  const resetSession=()=>{
    clearLS('naido_session','naido_of','naido_shift','naido_mach','naido_mach_choisie','naido_shift_ofs');
    setSession(null);setOfSel(null);setShiftSel(null);setMachSel(null);setShiftOfs([]);setSacsVides('');setFinShift(false);
    setEtape('config');setTickets([]);setArretActif(null);setRecap(null);
  };

  const ouvrirTicketReglage=async(num,sessionId)=>{
    const n=num||ofSel?.numero_ticket_reglage;
    if(!n){toast.error('Aucun ticket de réglage pour cet OF');return;}
    try{const{data}=await axios.get(`${API}/regleur/ticket/${encodeURIComponent(n)}/record`);setTicketReglageAff({...data,session_id:sessionId||session?.id||null});}
    catch{toast.error('Ticket de réglage introuvable');}
  };
  const rafraichirOf=async(id)=>{
    try{const{data}=await axios.get(`${API}/of/${id}`);const m={...ofSel,...data};setOfSel(m);saveLS('naido_of',m);return m;}
    catch{return ofSel;}
  };
  // Démarre la session de l'opérateur. Extrusion : il a fait, modifié ou repris le réglage (un seul ticket par réglage, tracé à son nom et à son quart)
  const demarrerSession=async(modeReglage,numeroTicket)=>{
    try{
      const{data}=await axios.post(`${API}/sessions`,{of_id:ofSel.id,machine_id:machineId,shift_id:shiftSel.id});
      setSession(data);saveLS('naido_session',data);
      if(ofSel.poids_mandrin_kg)setForm(p=>({...p,poids_mandrin:ofSel.poids_mandrin_kg.toString()}));
      if(typePoste==='extrusion'){
        if(modeReglage){try{await axios.post(`${API}/sessions/${data.id}/reglage-repris`,{of_id:ofSel.id,mode:modeReglage});}catch{}}
        await rafraichirOf(ofSel.id);   // numéro et valeurs du réglage en vigueur
      }
      setEtape('production');toast.success('Production démarrée !');
      if(modeReglage&&modeReglage!=='reprise')ouvrirTicketReglage(numeroTicket,data.id);
    }catch(e){toast.error(e.response?.data?.error||'Erreur démarrage');}
  };
  const demarrer=async()=>{
    if(!ofSel||!shiftSel){toast.error('Sélectionnez un OF et un shift');return;}
    if(typePoste!=='extrusion'){demarrerSession();return;}
    // Extrusion : pas de réglage sur l'OF -> l'opérateur le fait ; déjà réglé (autre quart) -> il le reprend ou le modifie
    try{
      const{data}=await axios.get(`${API}/regleur/of/${ofSel.id}/reglages`);
      const liste=Array.isArray(data)?data:[];
      setReglagesOf(liste);
      setReglageMode(liste.length?'reprise':'premier');
    }catch{toast.error('Lecture des réglages impossible');}
  };

  // Soudure : la bobine est finie ; ce qui n'a pas été colisé devient un reliquat repris sur la bobine suivante
  const cloturerBobine=async()=>{
    if(!parentSel)return;
    try{
      const{data}=await axios.post(`${API}/tickets/${parentSel.id}/cloturer-bobine`,{session_id:session?.id});
      toast.success(data.reliquat_kg>0?`Bobine terminée — reliquat de ${fmt(data.reliquat_kg)} kg repris sur la prochaine bobine`:'Bobine terminée');
      setForm(p=>({...p,bobine_parent_id:''}));chargerBobines();
    }catch(e){toast.error(e.response?.data?.error||'Erreur clôture bobine');}
  };
  const validerTicket=async()=>{
    if(typePoste==='soudure_decoupe'){if(!form.qte_pieces)return toast.error('Saisissez le nombre de pieces');if(!form.poids_colis)return toast.error('Saisissez le poids du colis pesé');if(!machSD?.id)return toast.error('Selectionnez la machine soudeuse');}else if(!machineId)return toast.error('Choisissez la machine (elle n\'est pas assignee a cet OF)');else if(!form.poids_brut)return toast.error('Saisissez le poids brut');
    setSubmitting(true);
    try{
      const isSD=typePoste==='soudure_decoupe';
      const payload={
        session_id:session.id,of_id:ofSel.id,
        machine_id:machineId,
        article_id:ofSel.article_id||null,
        poids_brut_kg:parseFloat(form.poids_brut||0),poids_mandrin_kg:parseFloat(form.poids_mandrin||0),
        poids_dechets_kg:parseFloat(form.poids_dechets||0),poids_rebuts_kg:0,
        motif_dechet:form.motif_dechet||null,motif_rebut:form.motif_rebut||null,
        type_ticket:typePoste,etape_source:isSD?'AT3-SOUD':typePoste,etape_dest:form.destination||null,
        zone_actuelle:isSD?'AT3-SOUD':undefined,
        ticket_parent_id:isSD?(form.bobine_parent_id||null):undefined,
        lot_id:form.lot_id||null,nom_matiere:form.nom_matiere||null,
        qte_pieces:parseInt(form.qte_pieces||0),numero_sequence:tickets.length+1,
        numero_colis:isSD?(form.numero_colis||String(tickets.length+1)):(form.numero_colis||null),
        poids_carton_kg:isSD?colisNet:0,
        poids_colis_brut_kg:isSD?parseFloat(form.poids_colis||0):undefined,poids_emballage_kg:isSD?parseFloat(form.poids_emballage||0):undefined,type_emballage:isSD?(form.type_emballage||null):undefined,
      };
      const{data}=await axios.post(`${API}/tickets`,payload);
      toast.success(`Bobine ${data.numero_ticket} enregistrée !`);
      setTicketAff({...data,etape_dest:form.destination});
      if(isSD)saveLS('naido_emballage',{poids:form.poids_emballage,type:form.type_emballage});
      setForm(p=>({...p,poids_brut:'',poids_mandrin:'',poids_dechets:'',motif_dechet:'',rebuts:'',motif_rebut:'',lot_id:'',nom_matiere:'',qte_pieces:'',numero_colis:'',poids_carton:'',poids_colis:'',bobine_parent_id:isSD?p.bobine_parent_id:'',bobine_manuelle:''}));
      chargerTickets();chargerBobines();
    }catch(e){toast.error(e.response?.data?.error||e.message||'Erreur enregistrement');}
    finally{setSubmitting(false);}
  };

  const declarerArret=async()=>{
    if(!causeArret)return toast.error('Choisissez une cause');
    try{
      const{data}=await axios.post(`${API}/arrets`,{session_id:session.id,machine_id:machineId,cause:causeArret,details:detailsArr});
      setArretActif(data);setCauseArret('');setDetailsArr('');setEtape('production');toast.success('Arrêt déclaré');
    }catch(e){toast.error(e.response?.data?.error||'Erreur arrêt');}
  };

  const relancer=async()=>{
    try{await axios.put(`${API}/arrets/${arretActif.id}/relancer`);setArretActif(null);toast.success('Machine relancée');}
    catch{toast.error('Erreur relance');}
  };

  // Résumé de l'OF en cours pour le récap de shift (un shift peut compter plusieurs OF)
  const resumeOfCourant=()=>{
    const isSD=typePoste==='soudure_decoupe';
    const poids=tickets.reduce((s,t)=>s+(isSD?poidsTicket(t):parseFloat(t.poids_net_kg||0)),0);
    const dech=tickets.reduce((s,t)=>s+parseFloat(t.poids_dechets_kg||0),0);
    const pieces=tickets.reduce((s,t)=>s+parseInt(t.qte_pieces||0),0);
    const dureeMin=session?.created_at?Math.round((Date.now()-new Date(session.created_at).getTime())/60000):null;
    return{numero_of:ofSel?.numero_of||'—',article:ofSel?.article_nom||'—',machine:machineTicket?.code||machineTicket?.nom||'NC',nb_bobines:tickets.length,cumul_of:cumulOf?cumulOf.nb_bobines:null,prevues:isSD?null:(ofSel?.at3_nb_bobines_cibles||null),poids_total:poids.toFixed(3),poids_dechets:dech.toFixed(3),pieces,duree_min:dureeMin,session_id:session?.id||null};
  };
  // Fin d'OF : la session de cet OF est terminée, l'opérateur choisit un autre OF (le shift continue)
  const finirOf=async()=>{
    if(!session)return;setCloturant(true);
    try{
      await axios.put(`${API}/sessions/${session.id}/terminer`);
      const liste=[...shiftOfs,resumeOfCourant()];
      setShiftOfs(liste);saveLS('naido_shift_ofs',liste);
      clearLS('naido_session','naido_of','naido_mach','naido_mach_choisie');
      setSession(null);setOfSel(null);setMachSel(null);setTickets([]);setCumulOf(null);setArretActif(null);setBobinesDispo([]);
      setEtape('of');chargerDonnees();
      toast.success('OF terminé — choisissez le prochain OF');
    }catch{toast.error("Erreur fin d'OF");}
    finally{setCloturant(false);}
  };
  // Fin de shift : récap de tous les OF du shift + poids des sacs vides de matière (mis en quarantaine pour le recyclage)
  const cloturerShift=async()=>{
    if(!session&&!shiftOfs.length)return;setCloturant(true);
    try{
      const liste=[...shiftOfs];
      if(session){await axios.put(`${API}/sessions/${session.id}/terminer`);liste.push(resumeOfCourant());}
      const sv=parseFloat(sacsVides)||0;
      if(sv>0){
        try{await axios.post(`${API}/sessions/sacs-vides`,{poids_kg:sv,session_id:session?.id||liste[liste.length-1]?.session_id||null,of_id:ofSel?.id||null,shift_id:shiftSel?.id||null});}
        catch{toast.error('Poids des sacs vides non enregistré');}
      }
      setRecap({shift:libShift(shiftSel),operateur:`${user?.prenom||''} ${user?.nom||''}`.trim(),date:new Date().toLocaleDateString('fr-FR'),ofs:liste,unite:typePoste==='soudure_decoupe'?'colis':'bobines',sacs_vides:sv});
      setFinShift(false);
    }catch{toast.error('Erreur clôture');}
    finally{setCloturant(false);}
  };

  const alertesNonLues=alertes.filter(a=>!a.lu).length;
  const inp={width:'100%',borderRadius:10,padding:'14px',fontSize:20,fontWeight:700,boxSizing:'border-box',textAlign:'center',border:'2px solid #e5e7eb',outline:'none',fontFamily:'inherit'};

  // Labels du type de poste
  const POSTE_LABELS = {extrusion:{icon:'🏭',label:'Extrusion',color:'#0369a1'},impression:{icon:'🖨',label:'Impression',color:'#0891b2'},soudure_decoupe:{icon:'🧵',label:'Soudure/Découpe',color:'#be123c'}};
  const posteInfo = POSTE_LABELS[typePoste] || POSTE_LABELS.extrusion;

  // Réglage fait par l'opérateur lui-même (premier réglage, modification à la reprise, ou nouveau réglage pendant la production)
  if(reglageMode==='premier'||reglageMode==='modif'||reglageMode==='pendant'){
    const avant=reglageMode;
    return <EcranReglage cible={{type:'of',data:ofSel,reprise:avant!=='premier'}} user={user}
      onBack={()=>setReglageMode(avant==='modif'?'reprise':null)}
      onSuccess={async(res)=>{
        setReglageMode(null);
        await rafraichirOf(ofSel.id);
        const num=res&&res.numero_ticket_reglage;
        if(avant==='pendant'){toast.success('Nouveau réglage enregistré');ouvrirTicketReglage(num,session?.id);}
        else demarrerSession(avant,num);
      }}/>;
  }

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
          <button onClick={()=>setMonProfil(true)} style={{background:'#292524',border:'none',color:'#a8a29e',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:12}}>👤 Mon profil</button>
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

        {/* ══ REPRISE DU RÉGLAGE (changement de quart) ══ */}
        {reglageMode==='reprise'&&ofSel&&(()=>{
          const dernier=reglagesOf[reglagesOf.length-1]||{};
          let p={};try{p=JSON.parse(dernier.notes||'{}').params_complets||{};}catch{}
          return(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
              <div style={{background:'#fff',borderRadius:16,padding:20,width:'100%',maxWidth:440}}>
                <div style={{fontWeight:800,fontSize:16,marginBottom:2}}>⚙️ Reprise du réglage</div>
                <div style={{fontSize:13,color:'#6b7280',marginBottom:10}}>{ofSel.numero_of} · {ofSel.article_nom}</div>
                <div style={{fontSize:12,color:'#374151',marginBottom:8,lineHeight:1.6}}>
                  Réglage n°{dernier.rang} · ticket <b>{dernier.numero_ticket_reglage}</b><br/>
                  par {dernier.regleur_nom||'—'}{dernier.valide_at?` le ${new Date(dernier.valide_at).toLocaleString('fr-FR')}`:''}
                  {dernier.motif?<><br/>Motif : {dernier.motif}</>:null}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
                  {p.temp_zone1&&<Pill l="T°Z1" v={`${p.temp_zone1}°C`}/>}
                  {p.pression_bar&&<Pill l="P" v={`${p.pression_bar}bar`}/>}
                  {p.largeur_mm&&<Pill l="L" v={`${p.largeur_mm}mm`}/>}
                  {p.epaisseur_um&&<Pill l="Ép" v={`${p.epaisseur_um}µm`}/>}
                  {p.vitesse_vis&&<Pill l="V" v={`${p.vitesse_vis}tr/min`}/>}
                  {p.corona==='Oui'&&<Pill l="Corona" v="✓"/>}
                </div>
                <button onClick={()=>{setReglageMode(null);demarrerSession('reprise',dernier.numero_ticket_reglage);}}
                  style={{background:'#16a34a',color:'#fff',border:'none',padding:'14px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:15,width:'100%',marginBottom:8}}>✓ Je reprends ce réglage</button>
                <button onClick={()=>setReglageMode('modif')}
                  style={{background:'#f59e0b',color:'#1c1917',border:'none',padding:'14px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:15,width:'100%',marginBottom:8}}>✎ Je modifie le réglage</button>
                <button onClick={()=>setReglageMode(null)}
                  style={{background:'#f3f4f6',color:'#374151',border:'none',padding:'12px',borderRadius:10,cursor:'pointer',fontWeight:600,width:'100%'}}>← Annuler</button>
              </div>
            </div>
          );
        })()}

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
            {shiftOfs.length>0&&(
              <div style={{background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:12,padding:'10px 14px',fontSize:12,color:'#065f46'}}>
                <b>OF terminés pendant ce shift :</b> {shiftOfs.map(o=>`${o.numero_of} (${o.nb_bobines})`).join(' · ')}
                <button onClick={()=>setFinShift(true)} style={{display:'block',marginTop:8,background:'#1c1917',color:'#f59e0b',border:'none',padding:'10px 14px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:13}}>🏁 Fin de shift</button>
              </div>
            )}
            <div style={{background:'#fff',borderRadius:14,padding:18,border:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>Choisir l'Ordre de Fabrication</h3>
              {ofs.length===0
                ?<div style={{textAlign:'center',padding:'32px 0',color:'#9ca3af'}}><div style={{fontSize:36}}>⏳</div><p>Aucun OF disponible</p></div>
                :ofs.map(of=>(
                  <div key={of.id} onClick={()=>{
                    setOfSel(of);saveLS('naido_of',of);
                    if(of.machine_id&&typePoste!=='soudure_decoupe'){const m={id:of.machine_id,code:of.machine_code||'',nom:of.machine_nom||'',type:of.machine_type||'extrudeuse'};setMachSel(m);saveLS('naido_mach',m);}
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
                  <div style={{fontSize:11,color:'#a8a29e'}}>{typePoste==='soudure_decoupe'?'Colis':'Bobines'}</div>
                  <div style={{fontWeight:800,fontSize:30,color:'#f59e0b'}}>{tickets.length}</div>
                  {cumulOf&&typePoste==='extrusion'&&<div style={{fontSize:11,color:'#d6d3d1'}}>OF : {cumulOf.nb_bobines}{ofSel.at3_nb_bobines_cibles?` / ${ofSel.at3_nb_bobines_cibles}`:''} bobines</div>}
                </div>
              </div>
              {/* Décompte */}
              {cibleKg>0&&typePoste!=='soudure_decoupe'&&(
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

            {/* OF terminé : passer à un autre OF */}
            {(atteint||depasse)&&typePoste!=='soudure_decoupe'&&!arretActif&&(
              <div style={{background:'#ecfdf5',border:'2px solid #34d399',borderRadius:14,padding:'14px 16px'}}>
                <div style={{fontWeight:800,color:'#047857',fontSize:15}}>🏁 L'OF {ofSel.numero_of} est terminé</div>
                <div style={{fontSize:12,color:'#065f46',margin:'4px 0 10px'}}>La quantité de l'OF est atteinte. Terminez cet OF et passez à un autre OF.</div>
                <button onClick={finirOf} disabled={cloturant} style={{background:'#059669',color:'#fff',border:'none',padding:'14px',borderRadius:10,cursor:cloturant?'not-allowed':'pointer',fontWeight:700,fontSize:15,width:'100%'}}>➡ Terminer l'OF et choisir un autre OF</button>
              </div>
            )}

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

                {typePoste !== 'soudure_decoupe' && (
                <>
                {!ofSel?.machine_id&&(
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Machine * <span style={{fontWeight:400,color:'#9ca3af'}}>(non assignee a cet OF)</span></label>
                  <select value={machChoisieValide?.id||''} onChange={e=>{const m=machinesListe.find(x=>String(x.id)===e.target.value);const v=m?{id:m.id,code:m.code,nom:m.nom,type:m.type,of_id:ofSel.id}:null;setMachChoisie(v);saveLS('naido_mach_choisie',v);}}
                    style={{width:'100%',padding:'10px',borderRadius:8,border:'2px solid #f59e0b',fontSize:13}}>
                    <option value=''>-- Choisir la machine --</option>
                    {machinesListe.map(m=><option key={m.id} value={m.id}>{m.code}{m.nom?` — ${m.nom}`:''}</option>)}
                  </select>
                </div>)}
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
                {/* Déchet (un seul type de déchet) */}
                <div style={{display:'grid',gridTemplateColumns:'1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Déchets (kg)</label>
                    <input type="number" step="0.001" value={form.poids_dechets} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,poids_dechets:e.target.value}))}
                      style={{...inp,fontSize:16,border:'1px solid #fca5a5'}} placeholder="0.000"/>
                  </div>
                </div>
                </>
                )}
                {typePoste === 'soudure_decoupe' && (
                <>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Machine (Soudeuse) *</label>
                  <select value={machSD?.id||''} onChange={e=>{const opts=[{id:10,code:'SO01'},{id:11,code:'SO02'},{id:12,code:'SO03'},{id:13,code:'SO04'},{id:14,code:'SO05'}];const m=opts.find(x=>x.id===parseInt(e.target.value));setMachSel(m||null);saveLS('naido_mach',m||null);}}
                    style={{width:'100%',padding:'10px',borderRadius:8,border:'2px solid #be123c',fontSize:13}}>
                    <option value=''>-- Choisir machine --</option>
                    <option value='10'>SO01</option>
                    <option value='11'>SO02</option>
                    <option value='12'>SO03</option>
                    <option value='13'>SO04</option>
                    <option value='14'>SO05</option>
                  </select>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Bobine source <span style={{fontWeight:400,color:'#9ca3af'}}>({bobinesDispo.length} disponible{bobinesDispo.length>1?'s':''})</span></label>
                  <input type='search' placeholder='🔍 Rechercher une bobine (n° du ticket)' value={rechBobine} onChange={e=>setRechBobine(e.target.value)}
                    style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13,marginBottom:6,boxSizing:'border-box'}}/>
                  <select value={form.bobine_parent_id||''} onChange={e=>setForm(p=>({...p,bobine_parent_id:e.target.value}))}
                    style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
                    <option value=''>-- Saisir manuellement --</option>
                    {bobinesFiltrees.map(b=><option key={b.id} value={b.id}>{b.numero_ticket} — {parseFloat(b.poids_restant_kg!==undefined?b.poids_restant_kg:b.poids_net_kg).toFixed(3)} kg restant</option>)}
                  </select>
                  {rechBobine.trim()&&bobinesFiltrees.length===0&&<div style={{fontSize:12,color:'#dc2626',marginTop:4}}>Aucune bobine ne correspond à « {rechBobine} »</div>}
                  {!form.bobine_parent_id && (
                    <input type='text' placeholder='Ou saisir le numero de bobine manuellement' value={form.bobine_manuelle||''}
                      onChange={e=>setForm(p=>({...p,bobine_manuelle:e.target.value}))}
                      style={{...inp,marginTop:6}}/>
                  )}
                  {parentSel&&(
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6,fontSize:12,color:'#374151'}}>
                      <span>Restant sur la bobine : <b>{fmt(parentSel.poids_restant_kg)} kg</b></span>
                      <button onClick={cloturerBobine} style={{background:'#fff7ed',color:'#c2410c',border:'1px solid #fdba74',borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:11,fontWeight:700}}>✓ Bobine terminée</button>
                    </div>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Nombre de pieces *</label>
                    <input type="number" step="1" value={form.qte_pieces} inputMode="numeric"
                      onChange={e=>setForm(p=>({...p,qte_pieces:e.target.value}))}
                      style={{...inp,border:'2px solid #be123c'}} placeholder="0"/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>N° du colis <span style={{fontWeight:400,color:'#9ca3af'}}>(auto)</span></label>
                    <input type="number" step="1" value={form.numero_colis} inputMode="numeric"
                      onChange={e=>setForm(p=>({...p,numero_colis:e.target.value}))}
                      style={{...inp,color:'#6b7280'}} placeholder="0"/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Poids du colis pesé (kg) *</label>
                    <input type="number" step="0.001" value={form.poids_colis} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,poids_colis:e.target.value}))}
                      style={{...inp,border:'2px solid #be123c'}} placeholder="0.000"/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Poids de l'emballage (kg)</label>
                    <input type="number" step="0.001" value={form.poids_emballage} inputMode="decimal"
                      onChange={e=>setForm(p=>({...p,poids_emballage:e.target.value}))}
                      style={{...inp,color:'#6b7280'}} placeholder="0.000"/>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Type d'emballage</label>
                  <input type="text" value={form.type_emballage} onChange={e=>setForm(p=>({...p,type_emballage:e.target.value}))} placeholder="Carton, sac, film…"
                    style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13,boxSizing:'border-box'}}/>
                </div>
                <div style={{background:'#fff1f2',border:'2px solid #fda4af',borderRadius:10,padding:'10px 14px',marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:13,fontWeight:600,color:'#be123c'}}>POIDS NET DU COLIS</span>
                    <span style={{fontSize:24,fontWeight:800,color:'#be123c'}}>{form.poids_colis?colisNet.toFixed(3):'—'} kg</span>
                  </div>
                  {form.poids_colis&&<div style={{fontSize:11,color:'#6b7280',marginTop:4,lineHeight:1.5}}>
                    {reprisPrevu>0&&<div>Reliquat de la bobine précédente repris : <b>{reprisPrevu.toFixed(3)} kg</b></div>}
                    {parentSel&&<div>Déduit de la bobine : <b>{deduitBobine.toFixed(3)} kg</b> · restant après : <b style={{color:restantApres<-0.001?'#dc2626':'#374151'}}>{restantApres.toFixed(3)} kg</b></div>}
                    {parentSel&&restantApres<-0.001&&<div style={{color:'#dc2626',fontWeight:600}}>⚠ Le colis dépasse le poids restant de la bobine</div>}
                  </div>}
                  {!parentSel&&reliquatDispo>0&&<div style={{fontSize:11,color:'#92400e',marginTop:4}}>Reliquat à reprendre sur la prochaine bobine : <b>{reliquatDispo.toFixed(3)} kg</b></div>}
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Déchets (kg)</label>
                  <input type="number" step="0.001" value={form.poids_dechets} inputMode="decimal"
                    onChange={e=>setForm(p=>({...p,poids_dechets:e.target.value}))}
                    style={{...inp,fontSize:16,border:'1px solid #fca5a5'}} placeholder="0.000"/>
                </div>
                </>
                )}
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
                  disabled={submitting||depasse||(typePoste==='soudure_decoupe'?!form.qte_pieces:!form.poids_brut)}
                  style={{background:depasse?'#dc2626':submitting?'#d1d5db':'#1c1917',color:submitting?'#9ca3af':'#f59e0b',border:'none',padding:'16px',borderRadius:12,width:'100%',cursor:submitting||depasse?'not-allowed':'pointer',fontWeight:700,fontSize:16}}>
                  {depasse?'⛔ OF terminé (+2%)':submitting?'Enregistrement...':'🖨️ Valider & Imprimer ticket bobine'}
                </button>
              </div>
            )}

            {/* Réglage : nouveau réglage pendant la production, ticket de réglage */}
            {!arretActif&&typePoste==='extrusion'&&(
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setReglageMode('pendant')} style={{flex:1,background:'#fff',color:'#4338ca',border:'2px solid #c7d2fe',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:13}}>⚙️ Nouveau réglage</button>
                <button onClick={()=>ouvrirTicketReglage()} style={{flex:1,background:'#fff',color:'#4338ca',border:'2px solid #c7d2fe',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:13}}>🖨️ Ticket de réglage</button>
              </div>
            )}

            {/* Arrêt + fin shift */}
            {!arretActif&&(
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setEtape('arret')} style={{flex:1,background:'#fff',color:'#dc2626',border:'2px solid #fca5a5',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:13}}>⏹ Arrêt machine</button>
                <button onClick={finirOf} disabled={cloturant} style={{flex:1,background:'#fff',color:'#047857',border:'2px solid #6ee7b7',padding:'14px',borderRadius:12,cursor:cloturant?'not-allowed':'pointer',fontWeight:700,fontSize:13}}>✅ Fin d'OF</button>
                <button onClick={()=>setFinShift(true)} disabled={cloturant} style={{flex:1,background:'#1c1917',color:'#f59e0b',border:'none',padding:'14px',borderRadius:12,cursor:cloturant?'not-allowed':'pointer',fontWeight:700,fontSize:13}}>
                  {cloturant?'Clôture...':'🏁 Fin de shift'}
                </button>
              </div>
            )}

            {/* Liste bobines */}
            {tickets.length>0&&(
              <div style={{background:'#fff',borderRadius:14,padding:14,border:'1px solid #e5e7eb'}}>
                <h4 style={{margin:'0 0 10px',fontSize:13,fontWeight:700}}>
                  {typePoste==='soudure_decoupe'?'Colis':'Bobines'} session ({tickets.length}) — {tickets.reduce((s,t)=>s+poidsTicket(t),0).toFixed(3)} kg net
                </h4>
                {tickets.slice(0,8).map(t=>(
                  <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:'#f9fafb',borderRadius:8,marginBottom:6,fontSize:13,alignItems:'center'}}>
                    <div>
                      <span style={{fontWeight:600,fontFamily:'monospace'}}>{t.numero_ticket}</span>
                      <span style={{color:'#9ca3af',marginLeft:6}}>{new Date(t.created_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontWeight:700,color:'#15803d'}}>{fmt(poidsTicket(t))} kg{parseInt(t.qte_pieces)>0?` · ${t.qte_pieces} pcs`:''}</span>
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

      {finShift&&!recap&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:20,width:'100%',maxWidth:420}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:4}}>🏁 Fin de shift</div>
            <div style={{fontSize:12,color:'#6b7280',marginBottom:12}}>Le récap reprendra {session?(shiftOfs.length?`l'OF en cours et ${shiftOfs.length} OF terminé${shiftOfs.length>1?'s':''}`:"l'OF en cours"):`${shiftOfs.length} OF terminé${shiftOfs.length>1?'s':''}`} pendant ce shift.</div>
            <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:3}}>Poids des sacs vides de matière (kg)</label>
            <input type="number" step="0.001" inputMode="decimal" value={sacsVides} onChange={e=>setSacsVides(e.target.value)} placeholder="0.000"
              style={{...inp,border:'2px solid #f59e0b',marginBottom:4}}/>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:14}}>Ces sacs vides partent en zone de quarantaine, en attente de recyclage.</div>
            <button onClick={cloturerShift} disabled={cloturant} style={{background:'#1c1917',color:'#f59e0b',border:'none',padding:'14px',borderRadius:10,cursor:cloturant?'not-allowed':'pointer',fontWeight:700,fontSize:15,width:'100%',marginBottom:8}}>{cloturant?'Clôture...':'Terminer mon shift'}</button>
            <button onClick={()=>setFinShift(false)} style={{background:'#f3f4f6',color:'#374151',border:'none',padding:'12px',borderRadius:10,cursor:'pointer',fontWeight:600,width:'100%'}}>← Annuler</button>
          </div>
        </div>
      )}
      {recap&&<RecapShift recap={recap} onNouveau={resetSession}/>}
      {ticketAff&&<TicketBobine ticket={ticketAff} of={ofSel} machine={machineTicket} shift={shiftSel} user={user} onClose={()=>setTicketAff(null)}/>}
      {ticketReglageAff&&<TicketReglage record={ticketReglageAff} onClose={()=>setTicketReglageAff(null)}/>}
      {monProfil&&<MonProfilRegleur user={user} onClose={()=>setMonProfil(false)}/>}
    </div>
  );
}

function Pill({l,v}){return(<div style={{background:'#292524',borderRadius:6,padding:'3px 7px',display:'flex',alignItems:'center',gap:3}}><span style={{fontSize:9,color:'#a8a29e',textTransform:'uppercase'}}>{l}</span><span style={{fontSize:11,fontWeight:700,color:'#f59e0b'}}>{v}</span></div>);}
