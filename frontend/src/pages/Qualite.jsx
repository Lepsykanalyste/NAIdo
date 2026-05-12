import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';
function fmtDate(d){return new Date(d||Date.now()).toLocaleDateString('fr-FR');}
function fmtDT(d){return new Date(d||Date.now()).toLocaleString('fr-FR');}

// ─── TYPES DE CONTRÔLE ────────────────────────────────────────────────────
const TYPES_CONTROLE = [
  { v:'mp',         l:'Matieres premieres', icon:'📦', ref:'Reception MP',     color:'#7c3aed' },
  { v:'extrusion',  l:'Extrusion',          icon:'🏭', ref:'ENR.ALP1-013 v02', color:'#0369a1' },
  { v:'impression', l:'Impression',         icon:'🖨️', ref:'ENR.ALP1-018',     color:'#0891b2' },
  { v:'soudure',    l:'Decoupe / Soudure',  icon:'⚡', ref:'ENR.ALP1-008 v02', color:'#d97706' },
  { v:'emballage',  l:'Emballage / Exped.', icon:'📫', ref:'Avant livraison',   color:'#059669' },
];

// ENR.ALP1-013 v02
const CRITERES_EXTRUSION = [
  { key:'largeur',     label:'Largeur',              type:'minmax', unite:'mm' },
  { key:'epaisseur',   label:'Epaisseur',            type:'minmax', unite:'um' },
  { key:'soufflet',    label:'Soufflet',              type:'minmax', unite:'mm' },
  { key:'poids',       label:'Poids bobine',          type:'minmax', unite:'kg' },
  { key:'aspect',      label:'Aspect',                type:'oknok' },
  { key:'dechirement', label:'Tenue au dechirement',  type:'oknok' },
  { key:'blocking',    label:'Controle blocking',     type:'oknok' },
  { key:'corona',      label:'Traitement corona',     type:'oknok' },
  { key:'perforation', label:'Perforation / Imprime', type:'oknok' },
];

// ENR.ALP1-008 v02
const CRITERES_SOUDURE = [
  { key:'longueur',         label:'Longueur',              type:'minmax', unite:'mm' },
  { key:'dechirement',      label:'Tenue au dechirement',  type:'oknok' },
  { key:'soudure_lat',      label:'Soudure laterale',      type:'oknok' },
  { key:'soudure_fond',     label:'Soudure fond',          type:'oknok' },
  { key:'etancheite_lat',   label:'Etancheite laterale',   type:'oknok' },
  { key:'etancheite_fond',  label:'Etancheite fond',       type:'oknok' },
  { key:'ouverture',        label:'Ouverture du sac',      type:'oknok' },
  { key:'poids_colis',      label:'Poids colis',           type:'minmax', unite:'kg' },
];

// ENR.ALP1-018
const CRITERES_IMPRESSION = [
  { key:'conformite_maquette', label:'Conformite maquette / BAT',  type:'oknok' },
  { key:'lisibilite',          label:'Lisibilite du texte',         type:'oknok' },
  { key:'couleurs',            label:'Conformite couleurs',         type:'oknok' },
  { key:'calage',              label:'Calage / alignement',         type:'oknok' },
  { key:'encrage',             label:'Encrage uniforme',            type:'oknok' },
  { key:'bavures',             label:'Absence de bavures',          type:'oknok' },
  { key:'adherence_encre',     label:'Adherence de encre',          type:'oknok' },
  { key:'largeur_imp',         label:'Largeur apres impression',    type:'minmax', unite:'mm' },
  { key:'poids_imp',           label:'Poids bobine imprimee',       type:'minmax', unite:'kg' },
];

// Reception MP
const CRITERES_MP = [
  { key:'conformite_bl',   label:'Conformite bon de livraison',  type:'oknok' },
  { key:'etat_emballage',  label:'Etat emballages / palettes',   type:'oknok' },
  { key:'etiquetage',      label:'Etiquetage et lot visible',    type:'oknok' },
  { key:'aspect_mp',       label:'Aspect visuel matiere',        type:'oknok' },
  { key:'odeur',           label:'Absence odeur anormale',       type:'oknok' },
  { key:'humidite',        label:'Absence humidite',             type:'oknok' },
  { key:'corps_etrangers', label:'Absence corps etrangers',      type:'oknok' },
  { key:'poids_recu',      label:'Poids recu vs commande',       type:'oknok' },
  { key:'certificat',      label:'Certificat analyse present',   type:'oknok' },
];

// Emballage / Expedition
const CRITERES_EMBALLAGE = [
  { key:'designation',     label:'Designation conforme',         type:'oknok' },
  { key:'quantite',        label:'Quantite conforme au BL',      type:'oknok' },
  { key:'etiquette',       label:'Etiquettes client correctes',  type:'oknok' },
  { key:'colisage',        label:'Colisage et filmage corrects', type:'oknok' },
  { key:'poids_carton',    label:'Poids carton conforme',        type:'minmax', unite:'kg' },
  { key:'aspect_final',    label:'Aspect final du produit',      type:'oknok' },
  { key:'lot_tracabilite', label:'Lot tracabilite visible',      type:'oknok' },
  { key:'conformite_cmd',  label:'Conformite commande client',   type:'oknok' },
];

function getCriteres(type) {
  switch(type) {
    case 'mp':         return CRITERES_MP;
    case 'extrusion':  return CRITERES_EXTRUSION;
    case 'impression': return CRITERES_IMPRESSION;
    case 'soudure':    return CRITERES_SOUDURE;
    case 'emballage':  return CRITERES_EMBALLAGE;
    default:           return CRITERES_EXTRUSION;
  }
}

// ─── TICKET CONTRÔLE ─────────────────────────────────────────────────────
function TicketControle({ ctrl, onClose }) {
  const [qr,setQr]=useState('');
  useEffect(()=>{
    import('qrcode').then(Q=>Q.default.toDataURL(
      'QC|'+(ctrl.numero_of||'')+'|'+(ctrl.type_controle||'')+'|'+(ctrl.decision||'')+'|'+fmtDate(ctrl.created_at),
      {width:120,margin:1,color:{dark:'#1e3a5f',light:'#fff'}}
    )).then(setQr).catch(()=>{});
  },[ctrl]);

  const resultats = typeof ctrl.resultats==='string' ? JSON.parse(ctrl.resultats||'{}') : (ctrl.resultats||{});
  const criteres = getCriteres(ctrl.type_controle||'extrusion');
  const typeInfo = TYPES_CONTROLE.find(t=>t.v===ctrl.type_controle)||TYPES_CONTROLE[1];
  const approuve = ctrl.decision==='approuve';

  const lignesHtml = criteres.map(c=>{
    const v=resultats[c.key];
    if(!v) return '';
    if(c.type==='minmax') return '<div class="r"><span class="lbl">'+c.label+'</span><span>'+(v.min||'--')+' - '+(v.max||'--')+' '+c.unite+'</span></div>';
    return '<div class="r"><span class="lbl">'+c.label+'</span><span class="'+(v==='OK'?'ok':'nok')+'">'+v+'</span></div>';
  }).join('');

  const html='<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Controle '+ctrl.numero_of+'</title>'
    +'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:\'Courier New\',monospace;font-size:10px;width:80mm;margin:0 auto;padding:4mm}'
    +'hr{border:none;border-top:1px dashed #000;margin:4px 0}.s{border:none;border-top:2px solid #000;margin:4px 0}'
    +'.r{display:flex;justify-content:space-between;padding:1.5px 0}.lbl{color:#444}'
    +'.ok{color:#15803d;font-weight:bold}.nok{color:#dc2626;font-weight:bold}'
    +'.sig{border:1px solid #000;padding:4px;min-height:14mm}'
    +'.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}'
    +'@media print{@page{size:80mm auto;margin:0}}</style></head>'
    +'<body onload="window.print()">'
    +'<div style="text-align:center;font-size:14px;font-weight:900">NAI</div>'
    +'<div style="text-align:center;font-size:9px;color:#555">AT3 — CONTROLE QUALITE</div>'
    +'<div class="s"></div>'
    +'<div style="text-align:center;font-weight:800;font-size:11px">FICHE DE CONTROLE '+typeInfo.l.toUpperCase()+'</div>'
    +'<div style="text-align:center;font-size:8px">Ref. '+typeInfo.ref+'</div><hr/>'
    +'<div class="r"><span class="lbl">N OF</span><b>'+(ctrl.numero_of||'--')+'</b></div>'
    +'<div class="r"><span class="lbl">ARTICLE</span><b>'+(ctrl.article||'--')+'</b></div>'
    +'<div class="r"><span class="lbl">CLIENT</span><b>'+(ctrl.client_nom||'--')+'</b></div>'
    +'<div class="r"><span class="lbl">DATE</span><b>'+fmtDate(ctrl.created_at)+'</b></div>'
    +'<div class="r"><span class="lbl">CONTROLEUR</span><b>'+(ctrl.controleur_nom||'--')+'</b></div>'
    +'<hr/>'+lignesHtml+'<hr/>'
    +'<div style="text-align:center;padding:4px;font-size:13px;font-weight:900;background:'+(approuve?'#dcfce7':'#fee2e2')+'">'+( approuve?'APPROUVE':'REJETE')+'</div>'
    +(ctrl.notes?'<hr/><div style="font-size:9px"><b>Obs:</b> '+ctrl.notes+'</div>':'')
    +'<div style="text-align:center;margin:5px 0">'+(qr?'<img src="'+qr+'" width="100" height="100"/>':'')+'</div><hr/>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2mm">'
    +'<div class="sig"><div style="font-size:7px;font-weight:bold">CONTROLEUR</div>'+(ctrl.controleur_nom||'')+'<br/><br/>Sig:</div>'
    +'<div class="sig"><div style="font-size:7px;font-weight:bold">OPERATEUR</div><br/><br/>Sig:</div>'
    +'<div class="sig"><div style="font-size:7px;font-weight:bold">RESP. ATELIER</div><br/><br/>Sig:</div>'
    +'</div><div class="foot">NAIdo - NAI - '+fmtDate(ctrl.created_at)+'</div></body></html>';

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:340,maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#1e3a5f'}}>
          <div style={{fontWeight:800,fontSize:13,color:'#fff'}}>Fiche controle qualite</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{const w=window.open('','_blank','width=420,height=700');w.document.write(html);w.document.close();}}
              style={{background:'#14532d',color:'#fff',border:'none',padding:'7px 12px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:11}}>Imprimer</button>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>X</button>
          </div>
        </div>
        <div style={{padding:'16px',fontFamily:'system-ui,sans-serif'}}>
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            <div style={{flex:1}}><div style={{fontSize:11,color:'#9ca3af'}}>OF</div><div style={{fontWeight:700}}>{ctrl.numero_of}</div></div>
            <div style={{flex:1}}><div style={{fontSize:11,color:'#9ca3af'}}>Type</div><div style={{fontWeight:700}}>{typeInfo.icon} {typeInfo.l}</div></div>
            <div><span style={{padding:'4px 12px',borderRadius:20,fontWeight:700,fontSize:13,background:approuve?'#dcfce7':'#fee2e2',color:approuve?'#15803d':'#dc2626'}}>{approuve?'APPROUVE':'REJETE'}</span></div>
          </div>
          {criteres.map(c=>{
            const v=resultats[c.key];
            if(!v) return null;
            return(
              <div key={c.key} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #f3f4f6',fontSize:13}}>
                <span style={{color:'#6b7280'}}>{c.label}</span>
                {c.type==='minmax'
                  ?<span style={{fontWeight:600}}>{v.min||'--'} - {v.max||'--'} {c.unite}</span>
                  :<span style={{fontWeight:700,color:v==='OK'?'#15803d':'#dc2626'}}>{v}</span>
                }
              </div>
            );
          })}
          {ctrl.notes&&<div style={{marginTop:10,padding:'8px 12px',background:'#f8faff',borderRadius:8,fontSize:12,color:'#374151'}}>{ctrl.notes}</div>}
          <div style={{textAlign:'center',margin:'12px 0'}}>
            {qr?<img src={qr} width={100} height={100} alt="QR"/>:null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Qualite() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);

  const [onglet, setOnglet]         = useState('controle');
  const [typeCtrl, setTypeCtrl]     = useState('extrusion');
  const [ofs, setOfs]               = useState([]);
  const [ofSel, setOfSel]           = useState(null);
  const [resultats, setResultats]   = useState({});
  const [decision, setDecision]     = useState('');
  const [notes, setNotes]           = useState('');
  const [qteApp, setQteApp]         = useState('');
  const [qteRej, setQteRej]         = useState('');
  const [photos, setPhotos]         = useState([]);
  const [sigData, setSigData]       = useState(null);
  const [sigMode, setSigMode]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historique, setHistorique] = useState([]);
  const [ticketSel, setTicketSel]   = useState(null);

  const criteres = getCriteres(typeCtrl);

  const chargerOFs=useCallback(async()=>{
    try{
      const [r1,r2,r3] = await Promise.all([
        axios.get(`${API}/of?statut=en_cours`),
        axios.get(`${API}/of?statut=lance`),
        axios.get(`${API}/of?statut=planifie`),
      ]);
      const tous = [...(r1.data||[]),...(r2.data||[]),...(r3.data||[])];
      // dédoublonner par id
      const uniq = tous.filter((o,i,a)=>a.findIndex(x=>x.id===o.id)===i);
      setOfs(uniq);
    }catch{}
  },[]);

  const chargerHistorique=useCallback(async()=>{
    try{const{data}=await axios.get(`${API}/qualite`);setHistorique(Array.isArray(data)?data:[]);}catch{}
  },[]);

  useEffect(()=>{chargerOFs();chargerHistorique();},[chargerOFs,chargerHistorique]);

  const setR=(key,val)=>setResultats(p=>({...p,[key]:val}));
  const setRMinMax=(key,field,val)=>setResultats(p=>({...p,[key]:{...(p[key]||{}),[field]:val}}));

  const getPos=(e,canvas)=>{const rect=canvas.getBoundingClientRect();const src=e.touches?e.touches[0]:e;return{x:src.clientX-rect.left,y:src.clientY-rect.top};};
  const startDraw=(e)=>{e.preventDefault();isDrawing.current=true;lastPos.current=getPos(e,canvasRef.current);};
  const draw=(e)=>{e.preventDefault();if(!isDrawing.current)return;const canvas=canvasRef.current;const ctx=canvas.getContext('2d');const pos=getPos(e,canvas);ctx.beginPath();ctx.moveTo(lastPos.current.x,lastPos.current.y);ctx.lineTo(pos.x,pos.y);ctx.strokeStyle='#1e3a5f';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();lastPos.current=pos;};
  const stopDraw=()=>{isDrawing.current=false;};

  const soumettre=async()=>{
    if(!ofSel) return toast.error('Selectionnez un OF');
    if(!decision) return toast.error('Choisissez une decision');
    if(!sigData) return toast.error('Signature obligatoire');
    setSubmitting(true);
    try{
      const fd=new FormData();
      fd.append('of_id',ofSel.id);
      fd.append('type_controle',typeCtrl);
      fd.append('decision',decision);
      fd.append('resultats',JSON.stringify(resultats));
      fd.append('notes',notes);
      fd.append('signature_base64',sigData);
      fd.append('quantite_approuvee',qteApp||0);
      fd.append('quantite_rejetee',qteRej||0);
      photos.forEach(p=>fd.append('photos',p.file));
      await axios.post(`${API}/qualite`,fd,{headers:{'Content-Type':'multipart/form-data'}});
      toast.success('Controle enregistre !');
      setDecision('');setNotes('');setQteApp('');setQteRej('');setPhotos([]);setSigData(null);setResultats({});
      chargerHistorique();setOnglet('historique');
    }catch(e){toast.error(e.response?.data?.error||'Erreur soumission');}
    finally{setSubmitting(false);}
  };

  const S={
    page:{minHeight:'100vh',background:'#f8faff',fontFamily:'system-ui,sans-serif'},
    header:{background:'#1e3a5f',color:'#fff',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    card:{background:'#fff',borderRadius:14,padding:20,border:'1px solid #dbeafe',marginBottom:16},
    inp:{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'10px 12px',fontSize:15,boxSizing:'border-box'},
    lbl:{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4},
  };

  return(
    <div style={S.page}>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:34,height:34,background:'#60a5fa',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#1e3a5f',fontSize:16}}>Q</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>NAIdo - Controle Qualite</div>
            <div style={{fontSize:11,color:'#93c5fd'}}>AT3 Sacherie</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:12,color:'#bfdbfe'}}>{user?.prenom} {user?.nom}</span>
          <button onClick={()=>{logout();navigate('/login');}} style={{background:'#1e40af',border:'none',color:'#93c5fd',padding:'6px 12px',borderRadius:6,cursor:'pointer',fontSize:12}}>Quitter</button>
        </div>
      </header>

      <nav style={{background:'#fff',borderBottom:'2px solid #dbeafe',display:'flex'}}>
        {[{id:'controle',l:'Nouveau controle'},{id:'historique',l:'Historique ('+historique.length+')'}].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)} style={{padding:'14px 24px',border:'none',background:'none',cursor:'pointer',fontWeight:onglet===o.id?700:400,color:onglet===o.id?'#1d4ed8':'#4b5563',borderBottom:onglet===o.id?'3px solid #1d4ed8':'3px solid transparent',fontSize:14}}>{o.l}</button>
        ))}
      </nav>

      <main style={{padding:'20px',maxWidth:800,margin:'0 auto'}}>
        {onglet==='controle'&&(
          <div>
            {/* Type controle */}
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>1 - Type de controle</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {TYPES_CONTROLE.map(t=>(
                  <button key={t.v} onClick={()=>{setTypeCtrl(t.v);setResultats({});}}
                    style={{padding:'14px',borderRadius:12,border:'2px solid',cursor:'pointer',textAlign:'left',
                      borderColor:typeCtrl===t.v?t.color:'#e5e7eb',
                      background:typeCtrl===t.v?t.color+'22':'#fff'}}>
                    <div style={{fontWeight:700,fontSize:14,color:typeCtrl===t.v?t.color:'#374151'}}>{t.icon} {t.l}</div>
                    <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>Ref. {t.ref}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* OF */}
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>2 - Ordre de Fabrication</h3>
              {ofs.length===0?<p style={{color:'#9ca3af',fontSize:14}}>Aucun OF en cours</p>
              :ofs.map(of=>(
                <div key={of.id} onClick={()=>setOfSel(of)}
                  style={{padding:'12px 16px',borderRadius:10,cursor:'pointer',border:'2px solid',marginBottom:8,
                    borderColor:ofSel?.id===of.id?'#1d4ed8':'#e5e7eb',background:ofSel?.id===of.id?'#eff6ff':'#fff'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontWeight:700,color:'#1e3a5f',fontSize:15}}>{of.numero_of}</span>
                    <span style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{of.client_nom}</span>
                  </div>
                  <div style={{fontSize:13,color:'#6b7280',marginTop:3}}>{of.article_nom}</div>
                </div>
              ))}
            </div>

            {/* Matieres */}
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>3 - Matieres / Lots</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {['Matiere','Colorant','Additif'].map(m=>(
                  <div key={m}>
                    <label style={S.lbl}>{m}</label>
                    <input style={S.inp} placeholder="Reference / lot" onChange={e=>setR(m.toLowerCase(),{ref:e.target.value})}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Criteres */}
            {ofSel&&(
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>4 - Criteres de controle ({criteres.length} points)</h3>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'#eff6ff'}}>
                      <th style={{padding:'8px 12px',textAlign:'left',fontWeight:600,color:'#1e3a5f',borderBottom:'2px solid #dbeafe'}}>Parametre</th>
                      <th style={{padding:'8px',textAlign:'center',fontWeight:600,color:'#1e3a5f',borderBottom:'2px solid #dbeafe'}}>Resultat</th>
                      <th style={{padding:'8px',textAlign:'center',fontWeight:600,color:'#1e3a5f',borderBottom:'2px solid #dbeafe'}}>Conforme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteres.map((c,i)=>(
                      <tr key={c.key} style={{background:i%2===0?'#fff':'#f8faff'}}>
                        <td style={{padding:'8px 12px',fontWeight:500,borderBottom:'1px solid #f1f5f9'}}>{c.label}</td>
                        <td style={{padding:'6px 8px',borderBottom:'1px solid #f1f5f9'}}>
                          {c.type==='minmax'?(
                            <div style={{display:'flex',gap:6,alignItems:'center'}}>
                              <input type="number" step="0.01" placeholder="Min" value={resultats[c.key]?.min||''}
                                onChange={e=>setRMinMax(c.key,'min',e.target.value)}
                                style={{width:70,border:'1px solid #d1d5db',borderRadius:6,padding:'5px 8px',fontSize:13,textAlign:'center'}}/>
                              <span style={{color:'#9ca3af'}}>-</span>
                              <input type="number" step="0.01" placeholder="Max" value={resultats[c.key]?.max||''}
                                onChange={e=>setRMinMax(c.key,'max',e.target.value)}
                                style={{width:70,border:'1px solid #d1d5db',borderRadius:6,padding:'5px 8px',fontSize:13,textAlign:'center'}}/>
                              <span style={{fontSize:11,color:'#9ca3af'}}>{c.unite}</span>
                            </div>
                          ):(
                            <div style={{display:'flex',gap:6}}>
                              {['OK','NOK'].map(v=>(
                                <button key={v} onClick={()=>setR(c.key,v)}
                                  style={{padding:'5px 12px',borderRadius:6,border:'1px solid',cursor:'pointer',fontWeight:700,fontSize:12,
                                    borderColor:resultats[c.key]===v?(v==='OK'?'#16a34a':'#dc2626'):'#e5e7eb',
                                    background:resultats[c.key]===v?(v==='OK'?'#dcfce7':'#fee2e2'):'#fff',
                                    color:resultats[c.key]===v?(v==='OK'?'#15803d':'#dc2626'):'#374151'}}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{padding:'6px 8px',textAlign:'center',borderBottom:'1px solid #f1f5f9'}}>
                          {resultats[c.key]&&(
                            <span style={{fontSize:16}}>
                              {c.type==='oknok'?(resultats[c.key]==='OK'?'✅':'❌'):(resultats[c.key]?.min&&resultats[c.key]?.max?'✅':'⏳')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Decision */}
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>5 - Decision</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                {[{v:'approuve',l:'APPROUVE',c:'#16a34a',bg:'#dcfce7'},{v:'rejete',l:'REJETE',c:'#dc2626',bg:'#fee2e2'}].map(d=>(
                  <button key={d.v} onClick={()=>setDecision(d.v)}
                    style={{padding:'18px',borderRadius:12,border:'2px solid',cursor:'pointer',fontSize:16,fontWeight:700,
                      borderColor:decision===d.v?d.c:'#e5e7eb',background:decision===d.v?d.bg:'#fff',color:decision===d.v?d.c:'#374151'}}>
                    {d.l}
                  </button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={S.lbl}>Quantite approuvee (kg)</label>
                  <input type="number" value={qteApp} onChange={e=>setQteApp(e.target.value)} style={S.inp} placeholder="0"/>
                </div>
                <div>
                  <label style={S.lbl}>Quantite rejetee (kg)</label>
                  <input type="number" value={qteRej} onChange={e=>setQteRej(e.target.value)} style={S.inp} placeholder="0"/>
                </div>
              </div>
              <div>
                <label style={S.lbl}>Observations</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
                  style={{...S.inp,resize:'vertical'}} placeholder="Non-conformites, actions correctives..."/>
              </div>
            </div>

            {/* Photos */}
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>6 - Photos</h3>
              <label style={{display:'inline-block',background:'#1d4ed8',color:'#fff',padding:'10px 20px',borderRadius:10,cursor:'pointer',fontWeight:600,fontSize:13}}>
                + Ajouter photos
                <input type="file" accept="image/*" multiple capture="environment" onChange={e=>{
                  const files=Array.from(e.target.files);
                  setPhotos(p=>[...p,...files.map(f=>({file:f,preview:URL.createObjectURL(f)}))]);
                  e.target.value='';
                }} style={{display:'none'}}/>
              </label>
              {photos.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:10,marginTop:14}}>
                  {photos.map((p,i)=>(
                    <div key={i} style={{position:'relative'}}>
                      <img src={p.preview} alt="" style={{width:'100%',height:90,objectFit:'cover',borderRadius:8,border:'1px solid #dbeafe'}}/>
                      <button onClick={()=>setPhotos(prev=>prev.filter((_,idx)=>idx!==i))}
                        style={{position:'absolute',top:3,right:3,background:'#dc2626',color:'#fff',border:'none',borderRadius:'50%',width:20,height:20,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signature */}
            <div style={S.card}>
              <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700,color:'#1e3a5f'}}>7 - Signature</h3>
              {sigData?(
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <div style={{width:10,height:10,background:'#16a34a',borderRadius:'50%'}}/>
                    <span style={{color:'#15803d',fontWeight:600,fontSize:13}}>Signature enregistree - {user?.prenom} {user?.nom}</span>
                  </div>
                  <img src={sigData} alt="Sig" style={{border:'1px solid #dbeafe',borderRadius:8,maxWidth:280}}/>
                  <button onClick={()=>{setSigData(null);setSigMode(true);}} style={{display:'block',marginTop:8,background:'none',border:'1px solid #d1d5db',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:12,color:'#6b7280'}}>Refaire</button>
                </div>
              ):sigMode?(
                <div>
                  <p style={{fontSize:12,color:'#6b7280',marginBottom:8}}>Signez dans le cadre avec votre doigt ou stylet</p>
                  <canvas ref={canvasRef} width={480} height={150}
                    style={{border:'2px solid #1d4ed8',borderRadius:10,background:'#fff',touchAction:'none',cursor:'crosshair',maxWidth:'100%'}}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}/>
                  <div style={{display:'flex',gap:10,marginTop:10}}>
                    <button onClick={()=>{setSigData(canvasRef.current.toDataURL('image/png'));setSigMode(false);toast.success('Signature enregistree');}}
                      style={{background:'#1d4ed8',color:'#fff',border:'none',padding:'9px 20px',borderRadius:10,cursor:'pointer',fontWeight:600}}>Valider</button>
                    <button onClick={()=>{canvasRef.current.getContext('2d').clearRect(0,0,480,150);setSigData(null);}}
                      style={{background:'#f3f4f6',color:'#374151',border:'none',padding:'9px 14px',borderRadius:10,cursor:'pointer'}}>Effacer</button>
                    <button onClick={()=>setSigMode(false)} style={{background:'none',color:'#9ca3af',border:'none',padding:'9px',cursor:'pointer'}}>Annuler</button>
                  </div>
                </div>
              ):(
                <button onClick={()=>setSigMode(true)}
                  style={{background:'#eff6ff',color:'#1d4ed8',border:'2px dashed #93c5fd',padding:'20px 36px',borderRadius:12,cursor:'pointer',fontWeight:600,fontSize:14}}>
                  Signer maintenant
                </button>
              )}
            </div>

            <button onClick={soumettre} disabled={submitting||!decision||!sigData}
              style={{background:(!decision||!sigData)?'#9ca3af':'#1d4ed8',color:'#fff',border:'none',padding:'18px',borderRadius:14,cursor:(!decision||!sigData)?'not-allowed':'pointer',fontWeight:700,fontSize:17,width:'100%'}}>
              {submitting?'Enregistrement...':'Valider le controle et Generer PDF'}
            </button>
          </div>
        )}

        {onglet==='historique'&&(
          <div>
            {historique.length===0?(
              <div style={{...S.card,textAlign:'center',padding:48}}>
                <div style={{fontSize:40,marginBottom:12}}>📋</div>
                <p style={{color:'#9ca3af'}}>Aucun controle enregistre</p>
              </div>
            ):historique.map(c=>{
              const typeInfo=TYPES_CONTROLE.find(t=>t.v===c.type_controle)||TYPES_CONTROLE[1];
              return(
              <div key={c.id} style={{...S.card,borderLeft:'4px solid '+(c.decision==='approuve'?'#86efac':'#fca5a5')}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10,marginBottom:10}}>
                  <div>
                    <span style={{fontWeight:700,fontSize:16,color:'#1e3a5f'}}>{c.numero_of}</span>
                    <span style={{marginLeft:10,fontSize:12,color:'#6b7280'}}>{c.article}</span>
                    <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{typeInfo.icon} {typeInfo.l} - Ref. {typeInfo.ref}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{background:c.decision==='approuve'?'#dcfce7':'#fee2e2',color:c.decision==='approuve'?'#15803d':'#dc2626',padding:'3px 10px',borderRadius:20,fontWeight:700,fontSize:13}}>
                      {c.decision==='approuve'?'APPROUVE':'REJETE'}
                    </span>
                    <button onClick={()=>setTicketSel(c)} style={{background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:8,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:600}}>Fiche</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,fontSize:12}}>
                  <div><span style={{color:'#9ca3af'}}>Controleur : </span><strong>{c.controleur_nom}</strong></div>
                  <div><span style={{color:'#9ca3af'}}>Approuve : </span><strong style={{color:'#15803d'}}>{c.quantite_approuvee||0} kg</strong></div>
                  <div><span style={{color:'#9ca3af'}}>Rejete : </span><strong style={{color:'#dc2626'}}>{c.quantite_rejetee||0} kg</strong></div>
                  <div><span style={{color:'#9ca3af'}}>Date : </span><strong>{fmtDT(c.created_at)}</strong></div>
                </div>
                {c.notes&&<div style={{marginTop:8,fontSize:12,color:'#374151',background:'#f8faff',padding:'8px 12px',borderRadius:8}}>{c.notes}</div>}
              </div>
              );
            })}
            <p style={{textAlign:'center',color:'#9ca3af',fontSize:11,marginTop:24}}>2026 NAIdo - NAI</p>
          </div>
        )}
      </main>

      {ticketSel&&<TicketControle ctrl={ticketSel} onClose={()=>setTicketSel(null)}/>}
    </div>
  );
}
