import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';
function fmtDate(d){return new Date(d||Date.now()).toLocaleDateString('fr-FR');}
function fmtDT(d){return new Date(d||Date.now()).toLocaleString('fr-FR');}

const MOTIFS_NC = [
  'Dimensions hors tolérance','Épaisseur non conforme','Soudure défectueuse',
  'Aspect / couleur non conforme','Problème de perforation','Tenue au déchirement insuffisante',
  'Problème de blocking','Corps étranger détecté','Étiquetage incorrect',
  'Poids hors tolérance','Autre (préciser)',
];

const DECISIONS_NC = [
  { v:'rebut',      l:'🗑️ Mise au rebut',         c:'#dc2626', bg:'#fee2e2' },
  { v:'retouche',   l:'🔧 Retouche / Réparation',  c:'#d97706', bg:'#fef3c7' },
  { v:'derogation', l:'✓ Dérogation client',        c:'#1d4ed8', bg:'#eff6ff' },
  { v:'triage',     l:'🔍 Triage',                  c:'#7c3aed', bg:'#ede9fe' },
];

function TicketNC({ nc, onClose }) {
  const [qr,setQr]=useState('');
  useEffect(()=>{
    import('qrcode').then(Q=>Q.default.toDataURL(
      `NC|${nc.numero_lot||''}|${nc.designation||''}|${nc.decision||''}|${fmtDate(nc.created_at)}`,
      {width:110,margin:1,color:{dark:'#dc2626',light:'#fff'}}
    )).then(setQr).catch(()=>{});
  },[nc]);

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>NC ${nc.numero_lot}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:10px;width:80mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:3px 0}.s{border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}
.sig{border:1px solid #000;padding:4px;min-height:12mm}.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
@media print{@page{size:80mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:14px;font-weight:900">NAI — AT3</div>
<div class="s"></div>
<div style="text-align:center;font-weight:800;font-size:12px">FICHE PRODUIT NON-CONFORME</div>
<div style="text-align:center;font-size:8px">ENR.ALP1-027 v01</div><hr/>
<div class="r"><span class="lbl">DATE</span><b>${fmtDate(nc.created_at)}</b></div>
<div class="r"><span class="lbl">HEURE</span><b>${new Date(nc.created_at||Date.now()).toLocaleTimeString('fr-FR')}</b></div>
<div class="r"><span class="lbl">N° LOT</span><b>${nc.numero_lot||'—'}</b></div>
<div class="r"><span class="lbl">QUANTITÉ</span><b>${nc.quantite||'—'}</b></div>
<div class="r"><span class="lbl">DÉSIGNATION</span><b>${nc.designation||'—'}</b></div>
<div class="r"><span class="lbl">CLIENT</span><b>${nc.client_nom||'—'}</b></div>
<hr/>
<div style="font-size:9px"><b>MOTIF DE NON-CONFORMITÉ:</b><br/>${nc.motif||'—'}</div>
${nc.description?`<div style="font-size:9px;margin-top:3px"><b>Description:</b><br/>${nc.description}</div>`:''}
<hr/>
<div style="font-size:9px"><b>DÉCISION:</b> ${nc.decision||'—'}</div>
${nc.actions?`<div style="font-size:9px;margin-top:3px"><b>Actions:</b><br/>${nc.actions}</div>`:''}
<div style="text-align:center;margin:4px 0">${qr?`<img src="${qr}" width="90" height="90"/>`:''}
</div><hr/>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm">
<div class="sig"><div style="font-size:7px;font-weight:bold">CHEF ATELIER</div><br/><br/>Signature:</div>
<div class="sig"><div style="font-size:7px;font-weight:bold">CONTRÔLEUR</div>${nc.controleur_nom||''}<br/><br/>Signature:</div>
</div>
<div class="foot">NAIdo — NAI · ${fmtDate(nc.created_at)}</div>
</body></html>`;

  const dec = DECISIONS_NC.find(d=>d.v===nc.decision)||{c:'#374151',bg:'#f3f4f6',l:nc.decision};

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:340,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#dc2626'}}>
          <div style={{fontWeight:800,fontSize:13,color:'#fff'}}>🖨️ Fiche Non-Conformité</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{const w=window.open('','_blank','width=420,height:700');w.document.write(html);w.document.close();}}
              style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11}}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>✕</button>
          </div>
        </div>
        <div style={{padding:'16px',fontFamily:'system-ui,sans-serif'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12,fontSize:13}}>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>N° LOT</div><div style={{fontWeight:700}}>{nc.numero_lot||'—'}</div></div>
            <div><div style={{fontSize:11,color:'#9ca3af'}}>Quantité</div><div style={{fontWeight:700}}>{nc.quantite||'—'}</div></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:11,color:'#9ca3af'}}>Désignation</div><div style={{fontWeight:600}}>{nc.designation||'—'}</div></div>
          </div>
          <div style={{marginBottom:10,padding:'8px 12px',background:'#fef2f2',borderRadius:8,fontSize:13}}>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:3}}>Motif</div>
            <strong>{nc.motif||'—'}</strong>
            {nc.description&&<div style={{marginTop:4,color:'#374151'}}>{nc.description}</div>}
          </div>
          <div style={{padding:'8px 12px',background:dec.bg,borderRadius:8,fontSize:13,fontWeight:700,color:dec.c}}>
            {dec.l}
          </div>
          {nc.actions&&<div style={{marginTop:8,padding:'8px 12px',background:'#fef9c3',borderRadius:8,fontSize:12}}>⚡ {nc.actions}</div>}
          <div style={{textAlign:'center',margin:'10px 0'}}>
            {qr?<img src={qr} width={90} height={90} alt="QR"/>:null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NonConformite() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [onglet,setOnglet]=useState('nouvelle');
  const [ofs,setOfs]=useState([]);
  const [lots,setLots]=useState([]);
  const [form,setForm]=useState({numero_lot:'',quantite:'',designation:'',client_nom:'',motif:'',description:'',decision:'',actions:''});
  const [submitting,setSubmitting]=useState(false);
  const [historique,setHistorique]=useState([]);
  const [ticketSel,setTicketSel]=useState(null);
  const [filtreDecision,setFiltreDecision]=useState('');

  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

  const charger=useCallback(async()=>{
    try{const{data}=await axios.get(`${API}/non-conformites`);setHistorique(Array.isArray(data)?data:[]);}catch{}
  },[]);

  useEffect(()=>{
    charger();
    axios.get(`${API}/of`).then(r=>setOfs(Array.isArray(r.data)?r.data:[])).catch(()=>{});
    axios.get(`${API}/lots-prod`).then(r=>setLots(Array.isArray(r.data)?r.data:[])).catch(()=>{});
  },[charger]);

  const soumettre=async()=>{
    if(!form.numero_lot||!form.designation||!form.motif||!form.decision)
      return toast.error('Complétez les champs obligatoires (lot, désignation, motif, décision)');
    setSubmitting(true);
    try{
      await axios.post(`${API}/non-conformites`,{...form,declarant_id:user.id});
      toast.success('Fiche NC enregistrée !');
      setForm({numero_lot:'',quantite:'',designation:'',client_nom:'',motif:'',description:'',decision:'',actions:''});
      charger();setOnglet('historique');
    }catch(e){toast.error(e.response?.data?.error||'Erreur');}
    finally{setSubmitting(false);}
  };

  const historiqueFiltré = filtreDecision ? historique.filter(h=>h.decision===filtreDecision) : historique;

  const S={
    page:{minHeight:'100vh',background:'#fff5f5',fontFamily:'system-ui,sans-serif'},
    header:{background:'#7f1d1d',color:'#fff',padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    card:{background:'#fff',borderRadius:14,padding:18,border:'1px solid #fecaca',marginBottom:14},
    lbl:{fontSize:11,fontWeight:700,color:'#374151',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:0.3},
    inp:{width:'100%',border:'1px solid #e5e7eb',borderRadius:8,padding:'11px 14px',fontSize:14,boxSizing:'border-box',fontFamily:'inherit'},
  };

  return(
    <div style={S.page}>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'#fca5a5',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#7f1d1d',fontSize:16}}>NC</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>NAIdo — Non-Conformité</div>
            <div style={{fontSize:11,color:'#fca5a5'}}>ENR.ALP1-027 · AT3 Sacherie</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:12,color:'#fca5a5'}}>{user?.prenom}</span>
          <button onClick={()=>{logout();navigate('/login');}} style={{background:'#991b1b',border:'none',color:'#fca5a5',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:12}}>Quitter</button>
        </div>
      </header>

      <nav style={{background:'#fff',borderBottom:'2px solid #fecaca',display:'flex'}}>
        {[{id:'nouvelle',l:'Nouvelle fiche NC'},{id:'historique',l:`Historique (${historique.length})`}].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)} style={{padding:'13px 20px',border:'none',background:'none',cursor:'pointer',fontWeight:onglet===o.id?700:400,color:onglet===o.id?'#dc2626':'#4b5563',borderBottom:onglet===o.id?'3px solid #dc2626':'3px solid transparent',fontSize:13}}>{o.l}</button>
        ))}
      </nav>

      <main style={{padding:'16px',maxWidth:720,margin:'0 auto'}}>
        {onglet==='nouvelle'&&(
          <div>
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#7f1d1d'}}>Identification du produit non-conforme</h3>
              {/* Sélection OF ou lot — auto-remplit les champs */}
              <div style={{marginBottom:12}}>
                <label style={S.lbl}>OF concerné (optionnel)</label>
                <select style={S.inp} onChange={e=>{
                  const of=ofs.find(o=>o.id===e.target.value);
                  if(of) setForm(p=>({...p,designation:of.article_nom||of.designation||'',client_nom:of.client_nom||''}));
                }}>
                  <option value="">-- Sélectionner un OF --</option>
                  {ofs.map(o=><option key={o.id} value={o.id}>{o.numero_of} — {o.article_nom} ({o.client_nom})</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={S.lbl}>N° Lot *</label>
                  <input value={form.numero_lot} onChange={e=>setF('numero_lot',e.target.value)} style={S.inp} placeholder="ex: LOT-2026-001"
                    list="liste-lots"/>
                  <datalist id="liste-lots">
                    {lots.map(l=><option key={l.id} value={l.numero_lot}>{l.nom_matiere} — {l.numero_lot}</option>)}
                  </datalist>
                </div>
                <div>
                  <label style={S.lbl}>Quantité</label>
                  <input value={form.quantite} onChange={e=>setF('quantite',e.target.value)} style={S.inp} placeholder="ex: 500 kg ou 1000 sacs"/>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={S.lbl}>Désignation *</label>
                  <input value={form.designation} onChange={e=>setF('designation',e.target.value)} style={S.inp} placeholder="Description de l'article"/>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={S.lbl}>Client</label>
                  <input value={form.client_nom} onChange={e=>setF('client_nom',e.target.value)} style={S.inp} placeholder="Nom du client"/>
                </div>
              </div>
            </div>

            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#7f1d1d'}}>Motif de non-conformité *</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                {MOTIFS_NC.map(m=>(
                  <button key={m} onClick={()=>setF('motif',m)}
                    style={{padding:'9px 12px',borderRadius:8,border:'2px solid',cursor:'pointer',textAlign:'left',fontSize:12,fontWeight:500,
                      borderColor:form.motif===m?'#dc2626':'#fecaca',
                      background:form.motif===m?'#fee2e2':'#fff',
                      color:form.motif===m?'#dc2626':'#374151'}}>
                    {m}
                  </button>
                ))}
              </div>
              <div>
                <label style={S.lbl}>Description détaillée</label>
                <textarea value={form.description} onChange={e=>setF('description',e.target.value)} rows={3}
                  style={{...S.inp,resize:'vertical'}} placeholder="Décrivez précisément la non-conformité observée..."/>
              </div>
            </div>

            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#7f1d1d'}}>Décision *</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                {DECISIONS_NC.map(d=>(
                  <button key={d.v} onClick={()=>setF('decision',d.v)}
                    style={{padding:'14px',borderRadius:12,border:'2px solid',cursor:'pointer',textAlign:'left',fontWeight:700,fontSize:14,
                      borderColor:form.decision===d.v?d.c:'#e5e7eb',background:form.decision===d.v?d.bg:'#fff',color:form.decision===d.v?d.c:'#374151'}}>
                    {d.l}
                  </button>
                ))}
              </div>
              <div>
                <label style={S.lbl}>Actions menées</label>
                <textarea value={form.actions} onChange={e=>setF('actions',e.target.value)} rows={3}
                  style={{...S.inp,resize:'vertical'}} placeholder="Actions correctives, responsable, délai..."/>
              </div>
            </div>

            <div style={{background:'#fff',borderRadius:14,padding:14,border:'1px solid #fecaca',marginBottom:14,fontSize:12,color:'#6b7280'}}>
              <strong style={{color:'#374151'}}>Déclarant : </strong>{user?.prenom} {user?.nom} · {fmtDate(Date.now())}
            </div>

            <button onClick={soumettre} disabled={submitting||!form.numero_lot||!form.designation||!form.motif||!form.decision}
              style={{background:(!form.numero_lot||!form.designation||!form.motif||!form.decision)?'#d1d5db':'#dc2626',color:'#fff',border:'none',padding:'17px',borderRadius:12,width:'100%',cursor:'pointer',fontWeight:700,fontSize:16}}>
              {submitting?'Enregistrement...':'⚠ Créer la fiche NC & Imprimer'}
            </button>
          </div>
        )}

        {onglet==='historique'&&(
          <div>
            {/* Filtre */}
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
              <button onClick={()=>setFiltreDecision('')} style={{padding:'6px 14px',borderRadius:20,border:'1px solid',cursor:'pointer',fontSize:12,fontWeight:filtreDecision===''?700:400,background:filtreDecision===''?'#dc2626':'#fff',color:filtreDecision===''?'#fff':'#374151',borderColor:filtreDecision===''?'#dc2626':'#e5e7eb'}}>Tous ({historique.length})</button>
              {DECISIONS_NC.map(d=>{
                const n=historique.filter(h=>h.decision===d.v).length;
                return n>0?(
                  <button key={d.v} onClick={()=>setFiltreDecision(d.v)}
                    style={{padding:'6px 14px',borderRadius:20,border:'1px solid',cursor:'pointer',fontSize:12,fontWeight:filtreDecision===d.v?700:400,
                      background:filtreDecision===d.v?d.c:'#fff',color:filtreDecision===d.v?'#fff':d.c,borderColor:d.c}}>
                    {d.l.split(' ').slice(-1)[0]} ({n})
                  </button>
                ):null;
              })}
            </div>

            {historiqueFiltré.length===0?(
              <div style={{...S.card,textAlign:'center',padding:48}}>
                <div style={{fontSize:40,marginBottom:12}}>✅</div>
                <p style={{color:'#9ca3af'}}>Aucune non-conformité enregistrée</p>
              </div>
            ):historiqueFiltré.map(nc=>{
              const dec=DECISIONS_NC.find(d=>d.v===nc.decision)||{c:'#374151',bg:'#f3f4f6',l:nc.decision};
              return(
                <div key={nc.id} style={{...S.card,borderLeft:`4px solid ${dec.c}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:8,marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:15}}>Lot : {nc.numero_lot||'—'}</div>
                      <div style={{fontSize:13,color:'#374151',marginTop:2}}>{nc.designation}</div>
                      <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{fmtDT(nc.created_at)}</div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:700,background:dec.bg,color:dec.c}}>{dec.l}</span>
                      <button onClick={()=>setTicketSel(nc)} style={{background:'#f3f4f6',color:'#374151',border:'1px solid #e5e7eb',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>🖨️</button>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:'#dc2626',fontWeight:600}}>⚠ {nc.motif}</div>
                  {nc.quantite&&<div style={{fontSize:12,color:'#6b7280',marginTop:3}}>Quantité : {nc.quantite}</div>}
                  {nc.actions&&<div style={{marginTop:6,fontSize:12,background:'#fef9c3',padding:'5px 8px',borderRadius:6}}>Actions : {nc.actions}</div>}
                </div>
              );
            })}
            <p style={{textAlign:'center',color:'#9ca3af',fontSize:11,marginTop:24}}>© 2026 NAIdo — NAI</p>
          </div>
        )}
      </main>

      {ticketSel&&<TicketNC nc={ticketSel} onClose={()=>setTicketSel(null)}/>}
    </div>
  );
}
