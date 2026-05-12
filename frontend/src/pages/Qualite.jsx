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
  { v:'mp',         l:'Matières Premières',   icon:'📦', ref:'Réception MP',      color:'#7c3aed', desc:'Contrôle à réception MP' },
  { v:'extrusion',  l:'Extrusion',            icon:'🏭', ref:'ENR.ALP1-013 v02',  color:'#0369a1', desc:'Contrôle bobines extrudées' },
  { v:'impression', l:'Impression',           icon:'🖨️', ref:'ENR.ALP1-018 v04',  color:'#0891b2', desc:'Contrôle qualité impression' },
  { v:'soudure',    l:'Découpe / Soudure',    icon:'⚡', ref:'ENR.ALP1-008 v02',  color:'#d97706', desc:'Contrôle soudure et découpe' },
  { v:'emballage',  l:'Emballage / Expéd.',   icon:'📫', ref:'ENR.ALP1-024 v01',  color:'#059669', desc:'Contrôle avant cession' },
];

// ══════════════════════════════════════════════════════════════
// DÉFINITIONS DES CRITÈRES PAR TYPE — basées sur fiches terrain
// ══════════════════════════════════════════════════════════════

// ENR.ALP1-013 v02 — Contrôle Qualité Extrusion
const SCHEMA_EXTRUSION = {
  sections: [
    {
      titre: '📋 Identification bobine',
      champs: [
        { key:'nom_controleur',  label:'Nom du contrôleur',   type:'text' },
        { key:'nom_operateur',   label:'Nom de l\'opérateur', type:'text' },
        { key:'machine',         label:'Machine',              type:'text' },
      ]
    },
    {
      titre: '🧪 Matières utilisées',
      champs: [
        { key:'mat_ref',       label:'Matière — Référence',   type:'text',   col:2 },
        { key:'mat_taux',      label:'Taux (%)',              type:'number', col:1 },
        { key:'mat_lot',       label:'N° de lot',             type:'text',   col:2 },
        { key:'col_ref',       label:'Colorant — Référence',  type:'text',   col:2 },
        { key:'col_taux',      label:'Taux (%)',              type:'number', col:1 },
        { key:'col_lot',       label:'N° de lot',             type:'text',   col:2 },
        { key:'add_ref',       label:'Additif — Référence',   type:'text',   col:2 },
        { key:'add_taux',      label:'Taux (%)',              type:'number', col:1 },
        { key:'add_lot',       label:'N° de lot',             type:'text',   col:2 },
      ]
    },
    {
      titre: '📐 Dimensions & Poids',
      champs: [
        { key:'largeur',    label:'Largeur (mm)',      type:'minmax', unite:'mm' },
        { key:'epaisseur',  label:'Épaisseur (µm)',    type:'minmax', unite:'µm' },
        { key:'soufflet',   label:'Soufflet (mm)',     type:'minmax', unite:'mm' },
        { key:'poids',      label:'Poids bobine (kg)', type:'minmax', unite:'kg' },
      ]
    },
    {
      titre: '✅ Contrôles qualitatifs',
      champs: [
        { key:'aspect',      label:'Aspect visuel',            type:'oknok' },
        { key:'dechirement', label:'Tenue au déchirement',     type:'oknok' },
        { key:'blocking',    label:'Contrôle de blocking',     type:'oknok' },
        { key:'corona',      label:'Traitement corona',        type:'oknok' },
        { key:'perforation', label:'Perforation / Imprimé',    type:'oknok' },
      ]
    },
  ]
};

// ENR.ALP1-008 v02 — Contrôle Qualité Découpe & Soudure
const SCHEMA_SOUDURE = {
  sections: [
    {
      titre: '📋 Identification',
      champs: [
        { key:'nom_controleur',   label:'Nom du contrôleur',     type:'text' },
        { key:'nom_operateur',    label:'Nom de l\'opérateur',   type:'text' },
        { key:'machine',          label:'Machine',               type:'text' },
        { key:'type_soudure',     label:'Type de soudure',       type:'select', options:['Latérale','Fond','Les deux'] },
        { key:'qte_par_colis',    label:'Quantité par colis',    type:'number' },
        { key:'numero_lot',       label:'N° de lot',             type:'text' },
      ]
    },
    {
      titre: '📐 Dimensions',
      champs: [
        { key:'longueur', label:'Longueur sac (mm)', type:'minmax', unite:'mm' },
        { key:'largeur',  label:'Largeur sac (mm)',  type:'minmax', unite:'mm' },
      ]
    },
    {
      titre: '✅ Contrôles mécaniques',
      champs: [
        { key:'dechirement',      label:'Tenue au déchirement',     type:'oknok' },
        { key:'soudure_lat',      label:'Tenue soudure latérale',   type:'oknok' },
        { key:'soudure_fond',     label:'Tenue soudure fond',       type:'oknok' },
        { key:'etancheite_lat',   label:'Étanchéité latérale',      type:'oknok' },
        { key:'etancheite_fond',  label:'Étanchéité fond',          type:'oknok' },
        { key:'ouverture',        label:'Ouverture du sac',         type:'oknok' },
      ]
    },
    {
      titre: '⚖️ Pesée colis',
      champs: [
        { key:'poids_colis', label:'Poids colis (kg)', type:'minmax', unite:'kg' },
      ]
    },
  ]
};

// ENR.ALP1-018 v04 — Contrôle Qualité Impression
const SCHEMA_IMPRESSION = {
  sections: [
    {
      titre: '📋 Identification',
      champs: [
        { key:'nom_controleur',  label:'Nom du contrôleur',         type:'text' },
        { key:'specifications',  label:'Spécifications bobine',     type:'text' },
        { key:'imp_ref',         label:'Référence impression (IMP)',type:'text' },
      ]
    },
    {
      titre: '🔬 Tests techniques',
      champs: [
        { key:'corona',         label:'Test traitement corona',           type:'oknok' },
        { key:'spec_bobine',    label:'Spécification bobine conforme',    type:'oknok' },
        { key:'qualite_couleur',label:'Qualité couleur d\'impression',    type:'oknok' },
      ]
    },
    {
      titre: '✅ Contrôles visuels',
      champs: [
        { key:'conformite_bat',   label:'Conformité maquette / BAT',   type:'oknok' },
        { key:'lisibilite',       label:'Lisibilité du texte',          type:'oknok' },
        { key:'calage',           label:'Calage / alignement',          type:'oknok' },
        { key:'encrage',          label:'Encrage uniforme',             type:'oknok' },
        { key:'bavures',          label:'Absence de bavures',           type:'oknok' },
        { key:'adherence',        label:'Adhérence de l\'encre',        type:'oknok' },
      ]
    },
    {
      titre: '📐 Dimensions après impression',
      champs: [
        { key:'largeur_imp', label:'Largeur après impression (mm)', type:'minmax', unite:'mm' },
        { key:'poids_imp',   label:'Poids bobine imprimée (kg)',    type:'minmax', unite:'kg' },
      ]
    },
  ]
};

// Réception MP
const SCHEMA_MP = {
  sections: [
    {
      titre: '📋 Identification livraison',
      champs: [
        { key:'nom_controleur',  label:'Nom du contrôleur',    type:'text' },
        { key:'fournisseur',     label:'Fournisseur',          type:'text' },
        { key:'numero_bl',       label:'N° Bon de livraison',  type:'text' },
        { key:'numero_lot',      label:'N° Lot matière',       type:'text' },
        { key:'poids_livre',     label:'Poids reçu (kg)',      type:'number' },
        { key:'poids_commande',  label:'Poids commandé (kg)',  type:'number' },
      ]
    },
    {
      titre: '✅ Contrôles à réception',
      champs: [
        { key:'conformite_bl',    label:'Conformité bon de livraison',    type:'oknok' },
        { key:'etat_emballage',   label:'État emballages / palettes',     type:'oknok' },
        { key:'etiquetage',       label:'Étiquetage et lot visible',      type:'oknok' },
        { key:'aspect_mp',        label:'Aspect visuel matière',          type:'oknok' },
        { key:'odeur',            label:'Absence odeur anormale',         type:'oknok' },
        { key:'humidite',         label:'Absence humidité',               type:'oknok' },
        { key:'corps_etrangers',  label:'Absence corps étrangers',        type:'oknok' },
        { key:'poids_conforme',   label:'Poids reçu vs commande',         type:'oknok' },
        { key:'certificat',       label:'Certificat d\'analyse présent',  type:'oknok' },
      ]
    },
  ]
};

// ENR.ALP1-024 v01 — Contrôle Avant Cession
const SCHEMA_EMBALLAGE = {
  sections: [
    {
      titre: '📋 Identification',
      champs: [
        { key:'nom_controleur',   label:'Nom du contrôleur',         type:'text' },
        { key:'nom_client',       label:'Nom du client',             type:'text' },
        { key:'numero_lot',       label:'N° Lot produit fini',       type:'text' },
        { key:'designation',      label:'Désignation produit',       type:'text' },
        { key:'colisage',         label:'Colisage (pcs/carton)',     type:'number' },
      ]
    },
    {
      titre: '✅ Paramètres à contrôler (ENR.ALP1-024)',
      champs: [
        { key:'designation_ok',   label:'1. Désignation conforme',              type:'oknok' },
        { key:'fiche_qualite',    label:'2. Fiche contrôle qualité (étiquette)',type:'oknok' },
        { key:'etat_emballage',   label:'3. État des emballages',               type:'oknok' },
        { key:'quantite_caisse',  label:'4. Quantité / Caisse conforme',        type:'oknok' },
        { key:'coloris',          label:'5. Coloris conforme',                  type:'oknok' },
        { key:'etiquette_client', label:'6. Étiquettes client correctes',       type:'oknok' },
        { key:'colisage_filmage', label:'7. Colisage et filmage corrects',      type:'oknok' },
        { key:'lot_tracabilite',  label:'8. Lot traçabilité visible',           type:'oknok' },
        { key:'aspect_final',     label:'9. Aspect final du produit',           type:'oknok' },
        { key:'conformite_cmd',   label:'10. Conformité commande client',       type:'oknok' },
      ]
    },
    {
      titre: '⚖️ Pesée',
      champs: [
        { key:'poids_carton', label:'Poids carton (kg)', type:'minmax', unite:'kg' },
      ]
    },
  ]
};

function getSchema(type) {
  switch(type) {
    case 'mp':         return SCHEMA_MP;
    case 'extrusion':  return SCHEMA_EXTRUSION;
    case 'impression': return SCHEMA_IMPRESSION;
    case 'soudure':    return SCHEMA_SOUDURE;
    case 'emballage':  return SCHEMA_EMBALLAGE;
    default:           return SCHEMA_EXTRUSION;
  }
}

// Aplatir les critères pour la fiche ticket (impression)
function getCriteres(type) {
  const schema = getSchema(type);
  const criteres = [];
  for (const section of schema.sections) {
    for (const c of section.champs) {
      if (c.type === 'oknok' || c.type === 'minmax') criteres.push(c);
    }
  }
  return criteres;
}

// ─── COMPOSANT CHAMP INDIVIDUEL ──────────────────────────────────────────
function ChampControle({ champ, value, onChange }) {
  const S = {
    inp: { width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 12px', fontSize:14, boxSizing:'border-box', background:'#fff' },
    lbl: { fontSize:11, fontWeight:700, color:'#374151', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.3px' },
  };

  if (champ.type === 'oknok') {
    return (
      <div>
        <label style={S.lbl}>{champ.label}</label>
        <div style={{ display:'flex', gap:8 }}>
          {['OK','NOK','NA'].map(v => (
            <button key={v} onClick={() => onChange(champ.key, v)}
              style={{
                flex:1, padding:'10px 6px', borderRadius:8, border:'2px solid', cursor:'pointer',
                fontWeight:800, fontSize:13,
                borderColor: value === v ? (v==='OK'?'#16a34a':v==='NOK'?'#dc2626':'#6b7280') : '#e5e7eb',
                background:  value === v ? (v==='OK'?'#dcfce7':v==='NOK'?'#fee2e2':'#f3f4f6') : '#fff',
                color:       value === v ? (v==='OK'?'#15803d':v==='NOK'?'#dc2626':'#374151') : '#9ca3af',
              }}>
              {v === 'OK' ? '✓ OK' : v === 'NOK' ? '✗ NOK' : '— N/A'}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (champ.type === 'minmax') {
    return (
      <div>
        <label style={S.lbl}>{champ.label}</label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'#9ca3af', marginBottom:3 }}>Mesure mini</div>
            <input type="number" step="0.01" placeholder="Mini"
              value={value?.mini || ''}
              onChange={e => onChange(champ.key, { ...(value||{}), mini: e.target.value })}
              style={{ ...S.inp, textAlign:'center', fontWeight:700 }} />
          </div>
          <div style={{ color:'#9ca3af', fontWeight:700, marginTop:14 }}>↔</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:'#9ca3af', marginBottom:3 }}>Mesure maxi</div>
            <input type="number" step="0.01" placeholder="Maxi"
              value={value?.maxi || ''}
              onChange={e => onChange(champ.key, { ...(value||{}), maxi: e.target.value })}
              style={{ ...S.inp, textAlign:'center', fontWeight:700 }} />
          </div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:14, minWidth:24 }}>{champ.unite}</div>
        </div>
        {value?.mini && value?.maxi && (
          <div style={{ fontSize:10, color:'#6b7280', marginTop:3 }}>
            Écart : {(parseFloat(value.maxi) - parseFloat(value.mini)).toFixed(2)} {champ.unite}
          </div>
        )}
      </div>
    );
  }

  if (champ.type === 'select') {
    return (
      <div>
        <label style={S.lbl}>{champ.label}</label>
        <select value={value || ''} onChange={e => onChange(champ.key, e.target.value)} style={S.inp}>
          <option value="">-- Choisir --</option>
          {champ.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label style={S.lbl}>{champ.label}</label>
      <input type={champ.type === 'number' ? 'number' : 'text'}
        value={value || ''}
        onChange={e => onChange(champ.key, e.target.value)}
        style={S.inp}
        placeholder={champ.label} />
    </div>
  );
}

// ─── TICKET CONTRÔLE (impression) ────────────────────────────────────────
function TicketControle({ ctrl, onClose }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    import('qrcode').then(Q => Q.default.toDataURL(
      'QC|' + (ctrl.numero_of||'') + '|' + (ctrl.type_controle||'') + '|' + (ctrl.decision||'') + '|' + fmtDate(ctrl.created_at),
      { width:120, margin:1, color:{ dark:'#1e3a5f', light:'#fff' } }
    )).then(setQr).catch(() => {});
  }, [ctrl]);

  const resultats = typeof ctrl.resultats === 'string' ? JSON.parse(ctrl.resultats || '{}') : (ctrl.resultats || {});
  const criteres  = getCriteres(ctrl.type_controle || 'extrusion');
  const typeInfo  = TYPES_CONTROLE.find(t => t.v === ctrl.type_controle) || TYPES_CONTROLE[1];
  const approuve  = ctrl.decision === 'approuve';

  const lignesHtml = criteres.map(c => {
    const v = resultats[c.key];
    if (!v) return '';
    if (c.type === 'minmax') return `<div class="r"><span class="lbl">${c.label}</span><span>${v.mini||'--'} → ${v.maxi||'--'} ${c.unite}</span></div>`;
    return `<div class="r"><span class="lbl">${c.label}</span><span class="${v==='OK'?'ok':v==='NOK'?'nok':'na'}">${v}</span></div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CQ ${ctrl.numero_of}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:10px;width:80mm;margin:0 auto;padding:4mm}
hr{border:none;border-top:1px dashed #000;margin:4px 0}.s{border:none;border-top:2px solid #000;margin:4px 0}
.r{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #eee}.lbl{color:#444;max-width:55%}
.ok{color:#15803d;font-weight:bold}.nok{color:#dc2626;font-weight:bold}.na{color:#6b7280}
.sig{border:1px solid #000;padding:4px;min-height:16mm}.foot{font-size:8px;color:#666;text-align:center;margin-top:3mm;border-top:1px dashed #999;padding-top:2mm}
.decision{text-align:center;padding:5px;font-size:14px;font-weight:900;margin:4px 0}
@media print{@page{size:80mm auto;margin:0}}</style></head>
<body onload="window.print()">
<div style="text-align:center;font-size:15px;font-weight:900">NAI</div>
<div style="text-align:center;font-size:9px;color:#555">AT3 — CONTRÔLE QUALITÉ</div>
<div class="s"></div>
<div style="text-align:center;font-weight:800;font-size:11px">${typeInfo.icon} ${typeInfo.l.toUpperCase()}</div>
<div style="text-align:center;font-size:8px;color:#666">Réf. ${typeInfo.ref}</div><hr/>
<div class="r"><span class="lbl">N° OF</span><b>${ctrl.numero_of||'--'}</b></div>
<div class="r"><span class="lbl">ARTICLE</span><b>${ctrl.article||'--'}</b></div>
<div class="r"><span class="lbl">CLIENT</span><b>${ctrl.client_nom||'--'}</b></div>
<div class="r"><span class="lbl">CONTRÔLEUR</span><b>${ctrl.controleur_nom||'--'}</b></div>
<div class="r"><span class="lbl">DATE</span><b>${fmtDate(ctrl.created_at)}</b></div>
<hr/>${lignesHtml}<hr/>
<div class="decision" style="background:${approuve?'#dcfce7':'#fee2e2'};color:${approuve?'#15803d':'#dc2626'}">${approuve?'✓ APPROUVÉ':'✗ REJETÉ'}</div>
${ctrl.quantite_approuvee?`<div class="r"><span class="lbl">Qté approuvée</span><b>${ctrl.quantite_approuvee} kg</b></div>`:''}
${ctrl.quantite_rejetee?`<div class="r"><span class="lbl">Qté rejetée</span><b>${ctrl.quantite_rejetee} kg</b></div>`:''}
${ctrl.notes?`<hr/><div style="font-size:9px"><b>Obs:</b> ${ctrl.notes}</div>`:''}
<hr/>
<div style="text-align:center;margin:5px 0">${qr?`<img src="${qr}" width="100" height="100"/>`:''}
<div style="font-size:8px;color:#666;margin-top:2px">${ctrl.numero_of} · ${typeInfo.ref}</div></div><hr/>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:2mm">
<div class="sig"><div style="font-size:7px;font-weight:bold">CONTRÔLEUR</div>${ctrl.controleur_nom||''}<br/><br/>Sig:</div>
<div class="sig"><div style="font-size:7px;font-weight:bold">OPÉRATEUR</div><br/><br/>Sig:</div>
<div class="sig"><div style="font-size:7px;font-weight:bold">RESP. ATELIER</div><br/><br/>Sig:</div>
</div>
<div class="foot">NAIdo — NAI · ${fmtDate(ctrl.created_at)}</div>
</body></html>`;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:16, width:360, maxHeight:'92vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'#1e3a5f', borderRadius:'16px 16px 0 0' }}>
          <div style={{ fontWeight:800, fontSize:13, color:'#fff' }}>🔍 Fiche contrôle qualité</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { const w = window.open('','_blank','width=420,height=700'); w.document.write(html); w.document.close(); }}
              style={{ background:'#14532d', color:'#fff', border:'none', padding:'7px 12px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:11 }}>🖨️ Imprimer</button>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', padding:'7px 10px', borderRadius:8, cursor:'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ padding:16, fontFamily:'system-ui,sans-serif' }}>
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#9ca3af' }}>OF</div>
              <div style={{ fontWeight:700, fontSize:15 }}>{ctrl.numero_of}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#9ca3af' }}>Type</div>
              <div style={{ fontWeight:700 }}>{typeInfo.icon} {typeInfo.l}</div>
            </div>
            <span style={{ padding:'5px 14px', borderRadius:20, fontWeight:800, fontSize:13, background:approuve?'#dcfce7':'#fee2e2', color:approuve?'#15803d':'#dc2626' }}>
              {approuve ? '✓ APPROUVÉ' : '✗ REJETÉ'}
            </span>
          </div>
          {criteres.map(c => {
            const v = resultats[c.key];
            if (!v) return null;
            return (
              <div key={c.key} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
                <span style={{ color:'#6b7280', maxWidth:'60%' }}>{c.label}</span>
                {c.type === 'minmax'
                  ? <span style={{ fontWeight:600 }}>{v.mini||'--'} → {v.maxi||'--'} {c.unite}</span>
                  : <span style={{ fontWeight:800, color:v==='OK'?'#15803d':v==='NOK'?'#dc2626':'#6b7280' }}>{v==='OK'?'✓ OK':v==='NOK'?'✗ NOK':'— N/A'}</span>
                }
              </div>
            );
          })}
          {ctrl.notes && <div style={{ marginTop:10, padding:'8px 12px', background:'#f8faff', borderRadius:8, fontSize:12, color:'#374151' }}>{ctrl.notes}</div>}
          <div style={{ textAlign:'center', margin:'12px 0' }}>
            {qr ? <img src={qr} width={90} height={90} alt="QR" style={{ borderRadius:4 }} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────
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
  const [filtreHisto, setFiltreHisto] = useState('');

  const schema  = getSchema(typeCtrl);
  const typeInfo = TYPES_CONTROLE.find(t => t.v === typeCtrl);

  // Score de complétion
  const totalCriteres = schema.sections.flatMap(s => s.champs.filter(c => c.type === 'oknok' || c.type === 'minmax')).length;
  const remplis = Object.keys(resultats).filter(k => {
    const v = resultats[k];
    if (typeof v === 'string') return v !== '';
    if (typeof v === 'object' && v !== null) return v.mini || v.maxi;
    return false;
  }).length;
  const pct = totalCriteres > 0 ? Math.round((remplis / totalCriteres) * 100) : 0;

  const chargerOFs = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        axios.get(`${API}/of?statut=en_cours`),
        axios.get(`${API}/of?statut=lance`),
        axios.get(`${API}/of?statut=planifie`),
      ]);
      const tous = [...(r1.data||[]), ...(r2.data||[]), ...(r3.data||[])];
      const uniq = tous.filter((o, i, a) => a.findIndex(x => x.id === o.id) === i);
      setOfs(uniq);
    } catch {}
  }, []);

  const chargerHistorique = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/qualite`); setHistorique(Array.isArray(data) ? data : []); } catch {}
  }, []);

  useEffect(() => { chargerOFs(); chargerHistorique(); }, [chargerOFs, chargerHistorique]);

  const setR = (key, val) => setResultats(p => ({ ...p, [key]: val }));

  const getPos = (e, canvas) => { const rect = canvas.getBoundingClientRect(); const src = e.touches ? e.touches[0] : e; return { x: src.clientX - rect.left, y: src.clientY - rect.top }; };
  const startDraw = (e) => { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e, canvasRef.current); };
  const draw = (e) => { e.preventDefault(); if (!isDrawing.current) return; const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); const pos = getPos(e, canvas); ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); lastPos.current = pos; };
  const stopDraw = () => { isDrawing.current = false; };

  const soumettre = async () => {
    if (!ofSel)    return toast.error('Sélectionnez un OF');
    if (!decision) return toast.error('Choisissez une décision');
    if (!sigData)  return toast.error('Signature obligatoire');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('of_id', ofSel.id);
      fd.append('type_controle', typeCtrl);
      fd.append('decision', decision);
      fd.append('resultats', JSON.stringify(resultats));
      fd.append('notes', notes);
      fd.append('signature_base64', sigData);
      fd.append('quantite_approuvee', qteApp || 0);
      fd.append('quantite_rejetee', qteRej || 0);
      photos.forEach(p => fd.append('photos', p.file));
      await axios.post(`${API}/qualite`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Contrôle enregistré !');
      setDecision(''); setNotes(''); setQteApp(''); setQteRej('');
      setPhotos([]); setSigData(null); setResultats({});
      chargerHistorique(); setOnglet('historique');
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur soumission'); }
    finally { setSubmitting(false); }
  };

  const S = {
    page:   { minHeight:'100vh', background:'#f0f4ff', fontFamily:'system-ui,sans-serif' },
    header: { background:'#1e3a5f', color:'#fff', padding:'0 20px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.2)' },
    card:   { background:'#fff', borderRadius:14, padding:20, border:'1px solid #dbeafe', marginBottom:16, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' },
    lbl:    { fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:4 },
    inp:    { width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 12px', fontSize:14, boxSizing:'border-box' },
  };

  const histoFiltré = historique.filter(c =>
    !filtreHisto || c.type_controle === filtreHisto
  );

  return (
    <div style={S.page}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, background:'#60a5fa', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#1e3a5f', fontSize:18 }}>Q</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>NAIdo - Contrôle Qualité AT3</div>
            <div style={{ fontSize:11, color:'#93c5fd' }}>Sacherie {user?.prenom} {user?.nom}</div>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }}
          style={{ background:'#1e40af', border:'none', color:'#93c5fd', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
          Quitter
        </button>
      </header>

      {/* ONGLETS */}
      <nav style={{ background:'#fff', borderBottom:'2px solid #dbeafe', display:'flex' }}>
        {[{ id:'controle', l:'Nouveau contrôle' }, { id:'historique', l:`Historique (${historique.length})` }].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)}
            style={{ padding:'14px 24px', border:'none', background:'none', cursor:'pointer', fontWeight:onglet===o.id?700:400, color:onglet===o.id?'#1d4ed8':'#4b5563', borderBottom:onglet===o.id?'3px solid #1d4ed8':'3px solid transparent', fontSize:14 }}>
            {o.l}
          </button>
        ))}
      </nav>

      <main style={{ padding:'20px', maxWidth:860, margin:'0 auto' }}>

        {/* ══ FORMULAIRE CONTRÔLE ══ */}
        {onglet === 'controle' && (
          <div>

            {/* Barre de progression */}
            <div style={{ ...S.card, padding:'14px 20px', marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#1e3a5f' }}>Progression du contrôle</span>
                <span style={{ fontSize:13, fontWeight:800, color: pct === 100 ? '#15803d' : '#1d4ed8' }}>{pct}%</span>
              </div>
              <div style={{ height:8, background:'#e0e7ff', borderRadius:4, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background: pct===100?'#16a34a':'#1d4ed8', borderRadius:4, transition:'width 0.3s' }} />
              </div>
              <div style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>{remplis} / {totalCriteres} critères renseignés</div>
            </div>

            {/* 1 — Type de contrôle */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>1 — Type de contrôle</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {TYPES_CONTROLE.map(t => (
                  <button key={t.v} onClick={() => { setTypeCtrl(t.v); setResultats({}); }}
                    style={{ padding:'14px 16px', borderRadius:12, border:'2px solid', cursor:'pointer', textAlign:'left',
                      borderColor: typeCtrl===t.v ? t.color : '#e5e7eb',
                      background:  typeCtrl===t.v ? t.color+'18' : '#fff' }}>
                    <div style={{ fontWeight:800, fontSize:14, color:typeCtrl===t.v?t.color:'#374151' }}>{t.icon} {t.l}</div>
                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>Réf. {t.ref}</div>
                    <div style={{ fontSize:10, color: typeCtrl===t.v?t.color:'#9ca3af', marginTop:1 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2 — OF */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>2 — Ordre de Fabrication</h3>
              {ofs.length === 0
                ? <div style={{ padding:20, textAlign:'center', color:'#9ca3af', background:'#f8faff', borderRadius:10 }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>📋</div>
                    <p style={{ fontSize:13 }}>Aucun OF en cours — vérifiez que des OFs sont lancés</p>
                  </div>
                : ofs.map(of => (
                  <div key={of.id} onClick={() => setOfSel(of)}
                    style={{ padding:'12px 16px', borderRadius:10, cursor:'pointer', border:'2px solid', marginBottom:8,
                      borderColor: ofSel?.id===of.id ? '#1d4ed8' : '#e5e7eb',
                      background:  ofSel?.id===of.id ? '#eff6ff' : '#fff' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <span style={{ fontWeight:800, color:'#1e3a5f', fontSize:15 }}>{of.numero_of}</span>
                        <span style={{ marginLeft:8, fontSize:12, color:'#6b7280' }}>{of.article_nom}</span>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {of.machine_code && <span style={{ background:'#f0f9ff', color:'#0369a1', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600 }}>{of.machine_code}</span>}
                        <span style={{ background:'#dbeafe', color:'#1d4ed8', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{of.statut}</span>
                      </div>
                    </div>
                    {of.client_nom && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Client : {of.client_nom}</div>}
                  </div>
                ))
              }
            </div>

            {/* SECTIONS DYNAMIQUES par type */}
            {schema.sections.map((section, si) => (
              <div key={si} style={S.card}>
                <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>
                  {si + 3} — {section.titre}
                </h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  {section.champs.map(champ => (
                    <div key={champ.key}
                      style={{ gridColumn: champ.type === 'oknok' || champ.type === 'minmax' || champ.col === 2 ? 'span 2' : 'span 1' }}>
                      <ChampControle
                        champ={champ}
                        value={resultats[champ.key]}
                        onChange={setR}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* DÉCISION */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>
                {schema.sections.length + 3} — Décision finale
              </h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  { v:'approuve', l:'✓ APPROUVÉ',  c:'#16a34a', bg:'#dcfce7' },
                  { v:'rejete',   l:'✗ REJETÉ',    c:'#dc2626', bg:'#fee2e2' }
                ].map(d => (
                  <button key={d.v} onClick={() => setDecision(d.v)}
                    style={{ padding:'20px', borderRadius:12, border:'3px solid', cursor:'pointer', fontSize:17, fontWeight:900,
                      borderColor: decision===d.v ? d.c : '#e5e7eb',
                      background:  decision===d.v ? d.bg : '#fff',
                      color:       decision===d.v ? d.c : '#9ca3af' }}>
                    {d.l}
                  </button>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={S.lbl}>Quantité approuvée (kg)</label>
                  <input type="number" value={qteApp} onChange={e => setQteApp(e.target.value)} style={S.inp} placeholder="0" />
                </div>
                <div>
                  <label style={S.lbl}>Quantité rejetée (kg)</label>
                  <input type="number" value={qteRej} onChange={e => setQteRej(e.target.value)} style={S.inp} placeholder="0" />
                </div>
              </div>
              <div>
                <label style={S.lbl}>Observations / Actions correctives</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  style={{ ...S.inp, resize:'vertical' }} placeholder="Non-conformités détectées, actions à prendre..." />
              </div>
            </div>

            {/* PHOTOS */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>
                {schema.sections.length + 4} — Photos
              </h3>
              <label style={{ display:'inline-block', background:'#1d4ed8', color:'#fff', padding:'10px 20px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13 }}>
                + Ajouter photos
                <input type="file" accept="image/*" multiple capture="environment" onChange={e => {
                  const files = Array.from(e.target.files);
                  setPhotos(p => [...p, ...files.map(f => ({ file:f, preview:URL.createObjectURL(f) }))]);
                  e.target.value = '';
                }} style={{ display:'none' }} />
              </label>
              {photos.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:10, marginTop:14 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ position:'relative' }}>
                      <img src={p.preview} alt="" style={{ width:'100%', height:90, objectFit:'cover', borderRadius:8, border:'1px solid #dbeafe' }} />
                      <button onClick={() => setPhotos(prev => prev.filter((_,idx) => idx !== i))}
                        style={{ position:'absolute', top:3, right:3, background:'#dc2626', color:'#fff', border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', fontSize:11 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SIGNATURE */}
            <div style={S.card}>
              <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:800, color:'#1e3a5f' }}>
                {schema.sections.length + 5} — Signature
              </h3>
              {sigData ? (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <div style={{ width:10, height:10, background:'#16a34a', borderRadius:'50%' }} />
                    <span style={{ color:'#15803d', fontWeight:700, fontSize:13 }}>Signature enregistrée — {user?.prenom} {user?.nom}</span>
                  </div>
                  <img src={sigData} alt="Sig" style={{ border:'1px solid #dbeafe', borderRadius:8, maxWidth:280 }} />
                  <button onClick={() => { setSigData(null); setSigMode(true); }}
                    style={{ display:'block', marginTop:8, background:'none', border:'1px solid #d1d5db', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, color:'#6b7280' }}>
                    Refaire la signature
                  </button>
                </div>
              ) : sigMode ? (
                <div>
                  <p style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>Signez dans le cadre avec votre doigt ou stylet</p>
                  <canvas ref={canvasRef} width={480} height={150}
                    style={{ border:'2px solid #1d4ed8', borderRadius:10, background:'#fff', touchAction:'none', cursor:'crosshair', maxWidth:'100%' }}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                  <div style={{ display:'flex', gap:10, marginTop:10 }}>
                    <button onClick={() => { setSigData(canvasRef.current.toDataURL('image/png')); setSigMode(false); toast.success('Signature enregistrée'); }}
                      style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'9px 20px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>Valider</button>
                    <button onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,480,150); setSigData(null); }}
                      style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'9px 14px', borderRadius:10, cursor:'pointer' }}>Effacer</button>
                    <button onClick={() => setSigMode(false)} style={{ background:'none', color:'#9ca3af', border:'none', padding:'9px', cursor:'pointer' }}>Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setSigMode(true)}
                  style={{ background:'#eff6ff', color:'#1d4ed8', border:'2px dashed #93c5fd', padding:'20px 36px', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:14 }}>
                  ✍️ Signer maintenant
                </button>
              )}
            </div>

            {/* BOUTON VALIDER */}
            <button onClick={soumettre} disabled={submitting || !decision || !sigData}
              style={{
                background: (!decision||!sigData) ? '#9ca3af' : '#1d4ed8',
                color:'#fff', border:'none', padding:'18px', borderRadius:14,
                cursor: (!decision||!sigData) ? 'not-allowed' : 'pointer',
                fontWeight:800, fontSize:17, width:'100%', boxShadow: (!decision||!sigData)?'none':'0 4px 12px rgba(29,78,216,0.3)'
              }}>
              {submitting ? '⏳ Enregistrement...' : '✅ Valider le contrôle et Générer PDF'}
            </button>

          </div>
        )}

        {/* ══ HISTORIQUE ══ */}
        {onglet === 'historique' && (
          <div>
            {/* Filtre par type */}
            <div style={{ ...S.card, padding:'12px 16px', marginBottom:12 }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Filtrer :</span>
                <button onClick={() => setFiltreHisto('')}
                  style={{ padding:'5px 12px', borderRadius:20, border:'2px solid', cursor:'pointer', fontSize:11, fontWeight:700,
                    borderColor: filtreHisto===''?'#1d4ed8':'#e5e7eb', background: filtreHisto===''?'#1d4ed8':'#fff',
                    color: filtreHisto===''?'#fff':'#6b7280' }}>Tous ({historique.length})</button>
                {TYPES_CONTROLE.map(t => {
                  const nb = historique.filter(c => c.type_controle === t.v).length;
                  return (
                    <button key={t.v} onClick={() => setFiltreHisto(t.v)}
                      style={{ padding:'5px 12px', borderRadius:20, border:'2px solid', cursor:'pointer', fontSize:11, fontWeight:700,
                        borderColor: filtreHisto===t.v?t.color:'#e5e7eb',
                        background:  filtreHisto===t.v?t.color+'18':'#fff',
                        color:       filtreHisto===t.v?t.color:'#6b7280' }}>
                      {t.icon} {t.l} ({nb})
                    </button>
                  );
                })}
              </div>
            </div>

            {histoFiltré.length === 0 ? (
              <div style={{ ...S.card, textAlign:'center', padding:48 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <p style={{ color:'#9ca3af' }}>Aucun contrôle enregistré</p>
              </div>
            ) : histoFiltré.map(c => {
              const ti = TYPES_CONTROLE.find(t => t.v === c.type_controle) || TYPES_CONTROLE[1];
              const approuve = c.decision === 'approuve';
              return (
                <div key={c.id} style={{ ...S.card, borderLeft:`4px solid ${approuve?'#86efac':'#fca5a5'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10, marginBottom:10 }}>
                    <div>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontWeight:800, fontSize:15, color:'#1e3a5f' }}>{c.numero_of}</span>
                        <span style={{ background: ti.color+'18', color: ti.color, padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{ti.icon} {ti.l}</span>
                        <span style={{ fontSize:10, color:'#9ca3af' }}>Réf. {ti.ref}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{c.article}</div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ background:approuve?'#dcfce7':'#fee2e2', color:approuve?'#15803d':'#dc2626', padding:'4px 12px', borderRadius:20, fontWeight:800, fontSize:13 }}>
                        {approuve ? '✓ APPROUVÉ' : '✗ REJETÉ'}
                      </span>
                      <button onClick={() => setTicketSel(c)}
                        style={{ background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        🔍 Fiche
                      </button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8, fontSize:12 }}>
                    <div><span style={{ color:'#9ca3af' }}>Contrôleur : </span><strong>{c.controleur_nom}</strong></div>
                    <div><span style={{ color:'#9ca3af' }}>Approuvé : </span><strong style={{ color:'#15803d' }}>{c.quantite_approuvee||0} kg</strong></div>
                    <div><span style={{ color:'#9ca3af' }}>Rejeté : </span><strong style={{ color:'#dc2626' }}>{c.quantite_rejetee||0} kg</strong></div>
                    <div><span style={{ color:'#9ca3af' }}>Date : </span><strong>{fmtDT(c.created_at)}</strong></div>
                  </div>
                  {c.notes && <div style={{ marginTop:8, fontSize:12, color:'#374151', background:'#f8faff', padding:'8px 12px', borderRadius:8 }}>{c.notes}</div>}
                </div>
              );
            })}
            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:11, marginTop:24 }}>© 2026 NAIdo — NAI</p>
          </div>
        )}
      </main>

      {ticketSel && <TicketControle ctrl={ticketSel} onClose={() => setTicketSel(null)} />}
    </div>
  );
}
