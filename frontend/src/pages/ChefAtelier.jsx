import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API = '/api';
const PermissionsContext = React.createContext({});
const usePerms = () => React.useContext(PermissionsContext);

// ══════════════════════════════════════════════════════════════
// COMPOSANTS PARTAGÉS — évite le re-render / perte de focus
// ══════════════════════════════════════════════════════════════

const InputField = ({ label, value, onChange, type='text', placeholder='', note='', required=false }) => (
  <div>
    <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>
      {label}
      {required && <span style={{ color:'#dc2626' }}> *</span>}
      {note && <span style={{ fontSize:10, color:'#9ca3af', marginLeft:5 }}>{note}</span>}
    </label>
    <input
      type={type}
      value={value||''}
      placeholder={placeholder}
      onChange={onChange}
      style={{
        width:'100%', border:'1px solid #d1d5db', borderRadius:8,
        padding:'9px', fontSize:13, boxSizing:'border-box',
        textAlign: type==='number' ? 'center' : 'left'
      }}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, required=false }) => (
  <div>
    <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>
      {label}
      {required && <span style={{ color:'#dc2626' }}> *</span>}
      {required && !value && <span style={{ fontSize:10, color:'#dc2626', marginLeft:4 }}>requis</span>}
    </label>
    <select
      value={value||''}
      onChange={onChange}
      style={{
        width:'100%', border:`1px solid ${required&&!value?'#fca5a5':'#d1d5db'}`,
        borderRadius:8, padding:'9px', fontSize:13, background:'#fff'
      }}
    >
      <option value="">-- Sélectionner --</option>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

const FileField = ({ label, file, onFile, accept, icon }) => (
  <div>
    <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{icon} {label}</label>
    <label style={{
      display:'block', border:`2px dashed ${file ? '#16a34a' : '#d1d5db'}`,
      borderRadius:8, padding:'10px 14px', cursor:'pointer',
      background: file ? '#f0fdf4' : '#fafafa',
      fontSize:12, color: file ? '#15803d' : '#6b7280', textAlign:'center'
    }}>
      {file ? `✓ ${file.name}` : `Cliquez pour choisir (${accept})`}
      <input type="file" accept={accept} style={{ display:'none' }}
        onChange={e => onFile(e.target.files[0])}/>
    </label>
  </div>
);


// ── ICÔNES SVG ───────────────────────────────────────────────
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const ICONS = {
  dashboard:  "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  production: "M2 20h20M4 20V10l8-6 8 6v10",
  planning:   "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  articles:   "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  stock:      "M5 8h14M5 8a2 2 0 1 0-4 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8m-4 0V5a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v3",
  cession:    "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0-2-2",
  rapport:    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
  qhse:       "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  gmao:       "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  ia:         "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4l3 3",
  users:      "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  import:     "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  alertes:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  kpi:        "M18 20V10M12 20V4M6 20v-6",
  logout:     "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

const MENU = [
  { id:'dashboard',   label:'Tableau de bord',    icon:'dashboard',   color:'#14532d' },
  { id:'separator1',  label:'PRODUCTION',          separator:true },
  { id:'df',          label:'Demandes de Fabrication', icon:'clipboard', color:'#7c3aed' },
  { id:'of',          label:'Ordres de Fabrication', icon:'clipboard', color:'#0369a1' },
  { id:'production',  label:'Suivi Production',    icon:'production',  color:'#1d4ed8' },
  { id:'planning',    label:'Planning Machines',   icon:'planning',    color:'#0369a1' },
  { id:'rapportjour', label:'Rapports Journaliers',icon:'rapport',     color:'#0f766e' },
  { id:'separator2',  label:'STOCKS & ARTICLES',   separator:true },
  { id:'articles',    label:'Articles (Produits)',  icon:'articles',    color:'#7e22ce' },
  { id:'matieres',    label:'Matières Premières',   icon:'articles',    color:'#1d4ed8' },
  { id:'stock',       label:'Stock',               icon:'stock',       color:'#6d28d9' },
  { id:'cession',     label:'Bons de Cession',     icon:'cession',     color:'#4338ca' },
  { id:'separator2b', label:'VENTE & ACHAT',        separator:true },
  { id:'clients',     label:'Clients',             icon:'articles',    color:'#0369a1' },
  { id:'vente',       label:'Ventes',              icon:'stock',       color:'#15803d' },
  { id:'fournisseurs',label:'Fournisseurs',         icon:'articles',    color:'#6d28d9' },
  { id:'achat',       label:'Commandes Achat',     icon:'stock',       color:'#9333ea' },
  { id:'separator3',  label:'QHSE & MAINTENANCE',  separator:true },
  { id:'qhse',        label:'QHSE / NC',           icon:'qhse',        color:'#b45309' },
  { id:'gmao',        label:'GMAO / Maintenance',  icon:'gmao',        color:'#92400e' },

  { id:'separator4b', label:'RESSOURCES HUMAINES', separator:true },
  { id:'rh',          label:'RH — Employés & Paie',  icon:'users',       color:'#0891b2' },
  { id:'separator4',  label:'ADMIN & IA',          separator:true },
  { id:'kpi',         label:'KPI & Rapports',      icon:'kpi',         color:'#be185d' },
  { id:'ia',          label:'Assistant IA',        icon:'ia',          color:'#1e40af' },
  { id:'users',       label:'Utilisateurs',        icon:'users',       color:'#374151' },
  { id:'alertes',     label:'Alertes',             icon:'alertes',     color:'#dc2626' },


  { id:'parametres',  label:'⚙ Paramètres', icon:'settings', color:'#1e1b4b' },
  { id:'referentiels',label:'Référentiels',        icon:'articles',    color:'#6b7280' },
];

// ══════════════════════════════════════════════════════════════
// MENU PAR RÔLE
// ══════════════════════════════════════════════════════════════
const MENU_PAR_ROLE = {
  super_admin:   null, // tout
  directeur:     null, // tout
  chef_atelier:  ['dashboard','separator1','df','of','production','planning','rapportjour','separator2','articles','matieres','stock','cession','separator3','qhse','gmao','separator4','kpi','ia','alertes'],
  regleur:       ['dashboard','separator1','of','production','planning','alertes'],
  commercial:    ['dashboard','separator1','df','separator2b','clients','vente','alertes'],
  operateur:     ['dashboard','separator1','of','production','alertes'],
  operateur_ext: ['dashboard','separator1','of','production','alertes'],
  operateur_sou: ['dashboard','separator1','of','production','alertes'],
  operateur_imp: ['dashboard','separator1','of','production','alertes'],
  operateur_dec: ['dashboard','separator1','of','production','cession','alertes'],
  magasinier:    ['dashboard','separator2','stock','cession','alertes'],
  magasinier_at3:['dashboard','separator2','stock','cession','alertes'],
  magasinier_central:['dashboard','separator2','stock','cession','separator2b','vente','alertes'],
  qualite:       ['dashboard','separator1','of','production','separator3','qhse','alertes'],
  qhse:          ['dashboard','separator3','qhse','gmao','alertes'],
  rh:            ['dashboard','separator4b','rh','alertes'],
  technicien:    ['dashboard','separator3','gmao','alertes'],
  achat:         ['dashboard','separator2','articles','fournisseurs','achat','alertes'],
  vente:         ['dashboard','separator2b','clients','vente','alertes'],
};

function getMenuFiltre(role) {
  const autorise = MENU_PAR_ROLE[role];
  if (!autorise) return MENU; // super_admin et directeur voient tout
  return MENU.filter(item => autorise.includes(item.id));
}

// ══════════════════════════════════════════════════════════════
// COMPOSANTS DE SECTION
// ══════════════════════════════════════════════════════════════



// ══════════════════════════════════════════════════════════════
// MODULE DEMANDES DE FABRICATION
// ══════════════════════════════════════════════════════════════
function DemandesFabrication() {
  const { user } = useAuth();
  const [dfs, setDfs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showValider, setShowValider] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [form, setForm] = useState({
    article_id:'', client_id:'', quantite_demandee:'',
    description:'', specifications:'', date_livraison_souhaitee:'',
    priorite:'3', notes:''
  });
  const [valForm, setValForm] = useState({ machine_id:'', atelier_id:'AT3', date_debut_prevue:'' });
  const [machines, setMachines] = useState([]);

  const charger = async () => {
    try {
      const [d,a,c] = await Promise.all([
        axios.get(`${API}/df${filtreStatut?'?statut='+filtreStatut:''}`).catch(()=>({data:[]})),
        axios.get(`${API}/articles`).catch(()=>({data:[]})),
        axios.get(`${API}/vente/clients`).catch(()=>({data:[]})),
      ]);
      setDfs(Array.isArray(d.data)?d.data:[]);
      setArticles(Array.isArray(a.data)?a.data:[]);
      setClients(Array.isArray(c.data)?c.data:[]);
    } catch {}
  };

  useEffect(() => { charger(); }, [filtreStatut]);

  const chargerMachines = async (atelier) => {
    try {
      const {data} = await axios.get(`${API}/machines?atelier_id=${atelier}`);
      setMachines(data||[]);
    } catch {}
  };

  const creerDF = async () => {
    if (!form.article_id || !form.quantite_demandee) {
      toast.error('Article et quantité requis'); return;
    }
    try {
      await axios.post(`${API}/df`, {
        ...form,
        quantite_demandee: parseFloat(form.quantite_demandee),
        priorite: parseInt(form.priorite||3)
      });
      toast.success('Demande créée !');
      setShowForm(false);
      setForm({article_id:'',client_id:'',quantite_demandee:'',description:'',specifications:'',date_livraison_souhaitee:'',priorite:'3',notes:''});
      charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const valider = async () => {
    try {
      const res = await axios.put(`${API}/df/${showValider.id}/valider`, valForm);
      toast.success('DF validée — OF ' + res.data.of.numero_of + ' créé !');
      setShowValider(null);
      setDetail(null);
      charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur validation'); }
  };

  const refuser = async (id, motif) => {
    try {
      await axios.put(`${API}/df/${id}/refuser`, { motif_refus: motif });
      toast.success('DF refusée');
      setDetail(null);
      charger();
    } catch { toast.error('Erreur'); }
  };

  const couleurStatut = s => ({
    en_attente:'#d97706', validee:'#15803d', refusee:'#dc2626', annulee:'#6b7280'
  }[s]||'#6b7280');
  const bgStatut = s => ({
    en_attente:'#fef3c7', validee:'#dcfce7', refusee:'#fee2e2', annulee:'#f3f4f6'
  }[s]||'#f3f4f6');
  const labelStatut = s => ({
    en_attente:'En attente', validee:'Validée → OF', refusee:'Refusée', annulee:'Annulée'
  }[s]||s);

  const isDir = user?.role==='super_admin'||user?.role==='directeur'||user?.role==='chef_atelier';
  const sel = {width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13};

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',gap:8}}>
          {['','en_attente','validee','refusee'].map(s=>(
            <button key={s} onClick={()=>setFiltreStatut(s)}
              style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:filtreStatut===s?'#7c3aed':'#f3f4f6',color:filtreStatut===s?'#fff':'#374151'}}>
              {s===''?'Toutes':labelStatut(s)}
            </button>
          ))}
        </div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontWeight:700,fontSize:13}}>
          {showForm?'✕ Annuler':'+ Nouvelle demande'}
        </button>
      </div>

      {/* Formulaire création DF */}
      {showForm && (
        <div style={{background:'#faf5ff',borderRadius:14,padding:20,marginBottom:20,border:'1px solid #e9d5ff'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#7c3aed',marginBottom:16}}>📝 Nouvelle Demande de Fabrication</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Article à fabriquer *</div>
              <select value={form.article_id} onChange={e=>setForm({...form,article_id:e.target.value})} style={sel}>
                <option value="">-- Sélectionner --</option>
                {articles.filter(a=>a.type_article==='produit_fini').map(a=>(
                  <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Client</div>
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} style={sel}>
                <option value="">-- Sans client --</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.raison_sociale||c.nom}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Quantité demandée (kg) *</div>
              <input type="number" min="0" value={form.quantite_demandee}
                onChange={e=>setForm(prev=>({...prev,quantite_demandee:e.target.value}))}
                style={sel} placeholder="ex: 1000"/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Date livraison souhaitée</div>
              <input type="date" value={form.date_livraison_souhaitee}
                onChange={e=>setForm(prev=>({...prev,date_livraison_souhaitee:e.target.value}))} style={sel}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Priorité</div>
              <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={sel}>
                {[1,2,3,4,5].map(p=><option key={p} value={p}>{p} — {['Très basse','Basse','Normale','Haute','Urgente'][p-1]}</option>)}
              </select>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Description / Spécifications</div>
              <input value={form.description}
                onChange={e=>setForm(prev=>({...prev,description:e.target.value}))}
                style={sel} placeholder="Sac 38x63x8/100 naturel, impression 2 couleurs..."/>
            </div>
          </div>
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <button onClick={creerDF} style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontWeight:700}}>
              ✓ Envoyer la demande
            </button>
            <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer'}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modal validation (Direction) */}
      {showValider && isDir && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,width:480,maxWidth:'90vw'}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:'#15803d'}}>✓ Valider la demande</div>
            <div style={{fontSize:13,color:'#374151',marginBottom:16,background:'#f0fdf4',padding:12,borderRadius:8}}>
              <strong>{showValider.article_nom}</strong> — {showValider.quantite_demandee} kg<br/>
              Client : {showValider.client_nom||'—'}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Atelier de production</div>
                <select value={valForm.atelier_id}
                  onChange={e=>{setValForm({...valForm,atelier_id:e.target.value,machine_id:''});chargerMachines(e.target.value);}}
                  style={sel}>
                  <option value="AT3">Atelier 3 — Production</option>
                </select>
              </div>

              <div>
                <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Date début prévue</div>
                <input type="date" value={valForm.date_debut_prevue}
                  onChange={e=>setValForm({...valForm,date_debut_prevue:e.target.value})} style={sel}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={valider} style={{background:'#15803d',color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',cursor:'pointer',fontWeight:700,flex:1}}>
                ✓ Valider — Créer l'OF
              </button>
              <button onClick={()=>setShowValider(null)} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'10px 16px',cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste DF */}
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
        {dfs.length===0 ? (
          <div style={{padding:40,textAlign:'center',color:'#6b7280'}}>
            <div style={{fontSize:32,marginBottom:8}}>📝</div>
            Aucune demande — créez la première
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{background:'#faf5ff'}}>
              {['N° DF','Article','Client','Quantité','Livraison souhaitée','Priorité','Statut','OF créé','🖨','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#7c3aed',borderBottom:'2px solid #e9d5ff',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {dfs.map((df,i)=>(
                <tr key={df.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa'}}>
                  <td style={{padding:'9px 12px',fontWeight:700,color:'#7c3aed'}}>{df.numero_df}</td>
                  <td style={{padding:'9px 12px'}}>{df.article_nom}<br/><span style={{fontSize:10,color:'#6b7280'}}>{df.article_code}</span></td>
                  <td style={{padding:'9px 12px',fontSize:12}}>{df.client_nom||'—'}</td>
                  <td style={{padding:'9px 12px',fontWeight:600}}>{parseFloat(df.quantite_demandee).toFixed(0)} kg</td>
                  <td style={{padding:'9px 12px',fontSize:12}}>{df.date_livraison_souhaitee?new Date(df.date_livraison_souhaitee).toLocaleDateString('fr-FR'):'—'}</td>
                  <td style={{padding:'9px 12px',textAlign:'center'}}>{'⭐'.repeat(df.priorite||1)}</td>
                  <td style={{padding:'9px 12px'}}>
                    <span style={{background:bgStatut(df.statut),color:couleurStatut(df.statut),padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>
                      {labelStatut(df.statut)}
                    </span>
                  </td>
                  <td style={{padding:'9px 12px',fontSize:12,color:'#0369a1',fontWeight:600}}>{df.numero_of||'—'}</td>
                  <td style={{padding:'9px 12px',textAlign:'center'}}>
                    <button
                      onClick={()=>window.open(`/api/df/${df.id}/pdf`,'_blank')}
                      title="Imprimer document DF"
                      style={{background:'#f5f3ff',color:'#7c3aed',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11}}>
                      🖨
                    </button>
                  </td>
                  <td style={{padding:'9px 12px',display:'flex',gap:6}}>
                    {df.statut==='en_attente' && isDir && (
                      <button onClick={()=>{setShowValider(df);chargerMachines('AT3');}}
                        style={{background:'#dcfce7',color:'#15803d',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                        ✓ Valider
                      </button>
                    )}
                    {df.statut==='en_attente' && isDir && (
                      <button onClick={()=>{const m=window.prompt('Motif du refus:');if(m)refuser(df.id,m);}}
                        style={{background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11}}>
                        ✗ Refuser
                      </button>
                    )}
                    {df.description && (
                      <span title={df.description} style={{cursor:'help',fontSize:14}}>ℹ️</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// COMPOSANT DETAIL OF (avec composition lots)
// ══════════════════════════════════════════════════════════════
function DetailOF({ detail, machines, onClose, onRefresh, onStatut }) {
  const [lots, setLots] = useState([]);
  const [lotsDispo, setLotsDispo] = useState([]);
  const [mpArticles, setMpArticles] = useState([]);
  const [showAddLot, setShowAddLot] = useState(false);
  const [editMachine, setEditMachine] = useState(false);
  const [machineForm, setMachineForm] = useState({ machine_id: detail.machine_id||'', date_debut_prevue:'' });
  const [lotForm, setLotForm] = useState({
    article_mp_id:'', lot_id:'', nom_matiere:'', numero_lot:'',
    qte_prevue:'', pourcentage:'', unite_label:'kg'
  });

  const sel = {width:'100%',padding:'7px 10px',borderRadius:7,border:'1px solid #e5e7eb',fontSize:12};

  const chargerLots = async () => {
    try {
      const [l, mp] = await Promise.all([
        axios.get(`${API}/lots-prod/of/${detail.id}`).catch(()=>({data:[]})),
        axios.get(`${API}/articles?type_article=matiere_premiere`).catch(()=>({data:[]})),
      ]);
      setLots(Array.isArray(l.data)?l.data:[]);
      setMpArticles(Array.isArray(mp.data)?mp.data:[]);
    } catch {}
  };

  const chargerLotsDispo = async (article_mp_id) => {
    if (!article_mp_id) return;
    try {
      const {data} = await axios.get(`${API}/lots-prod?article_id=${article_mp_id}&atelier=${detail.atelier_id}`);
      setLotsDispo(data||[]);
    } catch {}
  };

  useEffect(() => { chargerLots(); }, [detail.id]);

  const saveMachine = async () => {
    try {
      await axios.put(`${API}/of/${detail.id}`, {
        machine_id: machineForm.machine_id||null,
        date_debut_prevue: machineForm.date_debut_prevue||null
      });
      toast.success('Machine mise à jour');
      setEditMachine(false);
      onRefresh();
    } catch { toast.error('Erreur'); }
  };

  const addLot = async () => {
    if (!lotForm.qte_prevue) { toast.error('Quantité requise'); return; }
    try {
      await axios.post(`${API}/lots-prod/of/${detail.id}`, {
        ...lotForm,
        qte_prevue: parseFloat(lotForm.qte_prevue),
        pourcentage: parseFloat(lotForm.pourcentage||0),
      });
      toast.success('Matière ajoutée');
      setShowAddLot(false);
      setLotForm({article_mp_id:'',lot_id:'',nom_matiere:'',numero_lot:'',qte_prevue:'',pourcentage:'',unite_label:'kg'});
      chargerLots();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const removeLot = async (id) => {
    try {
      await axios.delete(`${API}/lots-prod/${id}`);
      chargerLots();
    } catch { toast.error('Erreur'); }
  };

  const totalPoids = lots.reduce((s,l)=>s+parseFloat(l.qte_prevue||0),0);
  const totalPct = lots.reduce((s,l)=>s+parseFloat(l.pourcentage||0),0);

  return (
    <div style={{background:'#fff',borderRadius:14,padding:20,marginBottom:16,border:'2px solid #0369a1'}}>
      {/* En-tête */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16,color:'#0369a1'}}>📋 {detail.numero_of}</div>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:18,cursor:'pointer'}}>✕</button>
      </div>

      {/* Infos principales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16,fontSize:12}}>
        {[
          ['Article', detail.article_nom+' ('+detail.article_code+')'],
          ['Client', detail.client_nom||'—'],
          ['Atelier', detail.atelier_id||'—'],
          ['Statut', detail.statut],
          ['Qté cible', parseFloat(detail.quantite_cible||0).toFixed(0)+' kg'],
          ['Qté produite', parseFloat(detail.quantite_produite||0).toFixed(0)+' kg'],
          ['Temps prévu', detail.temps_prevu_min?detail.temps_prevu_min+' min':'—'],
          ['Livraison', detail.date_livraison_prevue?new Date(detail.date_livraison_prevue).toLocaleDateString('fr-FR'):'—'],
        ].map(([l,v])=>(
          <div key={l} style={{background:'#f0f9ff',borderRadius:8,padding:'8px 10px'}}>
            <div style={{fontSize:10,color:'#6b7280',fontWeight:600}}>{l}</div>
            <div style={{fontWeight:700,marginTop:2,color:'#1e3a5f'}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Machine — saisie par production */}
      <div style={{background:'#fffbeb',borderRadius:10,padding:14,marginBottom:16,border:'1px solid #fde68a'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:editMachine?10:0}}>
          <div style={{fontWeight:700,fontSize:13,color:'#92400e'}}>
            🏭 Machine : {detail.machine_nom||<span style={{color:'#d97706'}}>Non assignée — à définir par la production</span>}
          </div>
          {!editMachine && (
            <button onClick={()=>setEditMachine(true)}
              style={{background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:600}}>
              ✏ {detail.machine_nom?'Modifier':'Assigner machine'}
            </button>
          )}
        </div>
        {editMachine && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,alignItems:'end'}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Machine</div>
              <select value={machineForm.machine_id} onChange={e=>setMachineForm({...machineForm,machine_id:e.target.value})} style={sel}>
                <option value="">-- Sélectionner --</option>
                {machines.map(m=><option key={m.id} value={m.id}>{m.code} — {m.nom}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Date début prévue</div>
              <input type="date" value={machineForm.date_debut_prevue}
                onChange={e=>setMachineForm({...machineForm,date_debut_prevue:e.target.value})} style={sel}/>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={saveMachine} style={{background:'#15803d',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700}}>✓</button>
              <button onClick={()=>setEditMachine(false)} style={{background:'#f3f4f6',border:'none',borderRadius:6,padding:'7px 10px',cursor:'pointer'}}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Composition matières */}
      <div style={{background:'#f0fdf4',borderRadius:10,padding:14,marginBottom:16,border:'1px solid #bbf7d0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:13,color:'#15803d'}}>
            🧪 Composition matières premières
            {lots.length>0 && <span style={{marginLeft:8,fontSize:11,color:'#6b7280'}}>({totalPoids.toFixed(1)} kg total — {totalPct.toFixed(1)}%)</span>}
          </div>
          <button onClick={()=>setShowAddLot(!showAddLot)}
            style={{background:'#dcfce7',color:'#15803d',border:'1px solid #86efac',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:600}}>
            {showAddLot?'✕ Annuler':'+ Ajouter matière'}
          </button>
        </div>

        {/* Formulaire ajout lot - tout auto */}
        {showAddLot && (
          <div style={{background:'#fff',borderRadius:8,padding:14,marginBottom:10,border:'1px solid #bbf7d0'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'#6b7280',marginBottom:3}}>Type de matière (MP)</div>
                <select value={lotForm.article_mp_id}
                  onChange={e=>{setLotForm(prev=>({...prev,article_mp_id:e.target.value,lot_id:'',nom_matiere:'',numero_lot:'',qte_prevue:'',pourcentage:''}));chargerLotsDispo(e.target.value);}}
                  style={sel}>
                  <option value="">-- Choisir type MP --</option>
                  {mpArticles.map(a=><option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'#6b7280',marginBottom:3}}>
                  Lot disponible (FIFO — plus ancien en premier)
                </div>
                <select value={lotForm.lot_id}
                  onChange={e=>{
                    const l=lotsDispo.find(x=>x.id===e.target.value);
                    if(l) setLotForm(prev=>({...prev,
                      lot_id:e.target.value,
                      nom_matiere:l.fournisseur_nom||l.article_nom||'',
                      numero_lot:l.numero_lot||''
                    }));
                  }} style={sel}>
                  <option value="">-- Choisir lot --</option>
                  {lotsDispo.map(l=>(
                    <option key={l.id} value={l.id}>
                      {l.fournisseur_nom||l.article_nom} | lot {l.numero_lot} | {parseFloat(l.qte_disponible).toFixed(0)} kg dispo
                    </option>
                  ))}
                </select>
                {lotForm.lot_id && lotsDispo.find(x=>x.id===lotForm.lot_id) && (
                  <div style={{fontSize:10,color:'#15803d',marginTop:3}}>
                    ✓ {lotsDispo.find(x=>x.id===lotForm.lot_id)?.fournisseur_nom} — lot {lotForm.numero_lot} — {parseFloat(lotsDispo.find(x=>x.id===lotForm.lot_id)?.qte_disponible||0).toFixed(0)} kg disponibles
                  </div>
                )}
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'#6b7280',marginBottom:3}}>
                  Pourcentage dans l'OF (%)
                  <span style={{fontWeight:400,color:'#9ca3af',marginLeft:4}}>→ calcul poids auto</span>
                </div>
                <input type="number" min="0" max="100" step="0.1"
                  value={lotForm.pourcentage}
                  onChange={e=>{
                    const pct=parseFloat(e.target.value||0);
                    const qte_of=parseFloat(detail.quantite_cible||0);
                    const qte=qte_of>0?(qte_of*pct/100).toFixed(1):'';
                    setLotForm(prev=>({...prev,pourcentage:e.target.value,qte_prevue:qte}));
                  }}
                  style={sel} placeholder="ex: 70"/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'#6b7280',marginBottom:3}}>
                  Poids prévu (kg)
                  <span style={{fontWeight:400,color:'#9ca3af',marginLeft:4}}>→ calcul % auto</span>
                </div>
                <input type="number" min="0" step="0.1"
                  value={lotForm.qte_prevue}
                  onChange={e=>{
                    const qte=parseFloat(e.target.value||0);
                    const qte_of=parseFloat(detail.quantite_cible||0);
                    const pct=qte_of>0?(qte/qte_of*100).toFixed(1):'';
                    setLotForm(prev=>({...prev,qte_prevue:e.target.value,pourcentage:pct}));
                  }}
                  style={sel} placeholder="kg"/>
              </div>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                {lotForm.qte_prevue && (
                  <div style={{fontSize:11,color:'#0369a1',marginBottom:6,background:'#e0f2fe',padding:'4px 8px',borderRadius:6}}>
                    Reste à affecter : <strong>{(parseFloat(detail.quantite_cible||0)-totalPoids-parseFloat(lotForm.qte_prevue||0)).toFixed(1)} kg</strong>
                    {' '}({(100-totalPct-parseFloat(lotForm.pourcentage||0)).toFixed(1)}%)
                  </div>
                )}
                <button onClick={addLot}
                  disabled={!lotForm.lot_id || !lotForm.qte_prevue}
                  style={{background:lotForm.lot_id&&lotForm.qte_prevue?'#15803d':'#d1d5db',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',cursor:lotForm.lot_id&&lotForm.qte_prevue?'pointer':'not-allowed',fontSize:12,fontWeight:700}}>
                  + Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Liste lots */}
        {lots.length===0 ? (
          <div style={{color:'#6b7280',fontSize:12,fontStyle:'italic'}}>Aucune matière saisie — la production doit sélectionner les lots</div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#dcfce7'}}>
              {['Type MP','Marque/Fournisseur','N° Lot','Qté prévue','%','Stock dispo','Action'].map(h=>(
                <th key={h} style={{padding:'6px 10px',textAlign:'left',fontWeight:600,color:'#15803d'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {lots.map(l=>(
                <tr key={l.id} style={{borderBottom:'1px solid #dcfce7'}}>
                  <td style={{padding:'6px 10px'}}>{l.mp_code||l.mp_nom||'—'}</td>
                  <td style={{padding:'6px 10px',fontWeight:600}}>{l.nom_matiere||'—'}</td>
                  <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{l.numero_lot||'—'}</td>
                  <td style={{padding:'6px 10px',fontWeight:700}}>{parseFloat(l.qte_prevue||0).toFixed(1)} kg</td>
                  <td style={{padding:'6px 10px'}}>{parseFloat(l.pourcentage||0).toFixed(1)}%</td>
                  <td style={{padding:'6px 10px',color:parseFloat(l.lot_stock||0)<parseFloat(l.qte_prevue||0)?'#dc2626':'#15803d'}}>
                    {l.lot_stock?parseFloat(l.lot_stock).toFixed(0)+' kg':'—'}
                  </td>
                  <td style={{padding:'6px 10px'}}>
                    <button onClick={()=>removeLot(l.id)} style={{background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:10}}>✕</button>
                  </td>
                </tr>
              ))}
              <tr style={{background:'#f0fdf4',fontWeight:700}}>
                <td colSpan={3} style={{padding:'6px 10px',color:'#15803d'}}>TOTAL</td>
                <td style={{padding:'6px 10px'}}>{totalPoids.toFixed(1)} kg</td>
                <td style={{padding:'6px 10px',color:Math.abs(totalPct-100)<1?'#15803d':'#d97706'}}>{totalPct.toFixed(1)}%</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Actions statut */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {detail.statut==='planifie' && <button onClick={()=>{onStatut(detail.id,'lance');onClose();}} style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>▶ Lancer</button>}
        {detail.statut==='lance' && <button onClick={()=>{onStatut(detail.id,'en_cours');onClose();}} style={{background:'#d97706',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>⚙ Démarrer</button>}
        {detail.statut==='en_cours' && <button onClick={()=>{onStatut(detail.id,'pause');onClose();}} style={{background:'#6b7280',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>⏸ Pause</button>}
        {detail.statut==='pause' && <button onClick={()=>{onStatut(detail.id,'en_cours');onClose();}} style={{background:'#d97706',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>▶ Reprendre</button>}
        {detail.statut==='en_cours' && <button onClick={()=>{onStatut(detail.id,'termine');onClose();}} style={{background:'#15803d',color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>✓ Terminer</button>}
        {!['annule','termine'].includes(detail.statut) && <button onClick={()=>{onStatut(detail.id,'annule');onClose();}} style={{background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13}}>✕ Annuler</button>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE ORDRES DE FABRICATION
// ══════════════════════════════════════════════════════════════
function OrdresFabrication() {
  const [ofs, setOfs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [clients, setClients] = useState([]);
  const [machines, setMachines] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreAtelier, setFiltreAtelier] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({
    article_id:'', client_id:'', machine_id:'', atelier_id:'AT3',
    quantite_cible:'', date_livraison_prevue:'', priorite:'3',
    instructions:'', reference_sage:''
  });
  const [tempsCalc, setTempsCalc] = useState(null);

  const charger = async () => {
    setLoading(true);
    try {
      const [o,a,c,m,at] = await Promise.all([
        axios.get(`${API}/of${filtreStatut?'?statut='+filtreStatut:''}${filtreAtelier?'&atelier_id='+filtreAtelier:''}`),
        axios.get(`${API}/articles`),
        axios.get(`${API}/vente/clients`).catch(()=>({data:[]})),
        axios.get(`${API}/machines`),
        axios.get(`${API}/ateliers`),
      ]);
      setOfs(o.data||[]); setArticles(a.data||[]);
      setClients(c.data||[]); setMachines(m.data||[]);
      setAteliers(at.data||[]);
    } catch(e) { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [filtreStatut, filtreAtelier]);

  // Recalculer temps prévu quand article ou quantité change
  useEffect(() => {
    if (!form.article_id || !form.quantite_cible) { setTempsCalc(null); return; }
    const art = articles.find(a=>a.id===form.article_id);
    if (!art) return;
    const cadence = parseFloat(art.cadence_theorique_kg_h||art.cadence_heure||0);
    const reglage = parseFloat(art.temps_reglage_min||30);
    if (cadence > 0) {
      const qte = parseFloat(form.quantite_cible);
      const temps = Math.round((qte / cadence) * 60 + reglage);
      setTempsCalc({ temps_min: temps, temps_h: (temps/60).toFixed(1) });
    }
  }, [form.article_id, form.quantite_cible, articles]);

  // Filtrer machines selon atelier
  const machinesFiltrees = form.atelier_id ? machines.filter(m => m.atelier_id === form.atelier_id) : machines;

  const creerOF = async () => {
    if (!form.article_id || !form.quantite_cible) {
      toast.error('Article et quantité requis'); return;
    }
    try {
      await axios.post(`${API}/of`, {
        ...form,
        machine_id: form.machine_id || null,
        quantite_cible: parseFloat(form.quantite_cible),
        priorite: parseInt(form.priorite||3)
      });
      toast.success('OF créé !');
      setShowForm(false);
      setForm({article_id:'',client_id:'',machine_id:'',atelier_id:'AT3',quantite_cible:'',date_livraison_prevue:'',priorite:'3',instructions:'',reference_sage:''});
      charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur création'); }
  };

  const changerStatut = async (id, statut) => {
    try {
      await axios.put(`${API}/of/${id}/statut`, { statut });
      toast.success('Statut mis à jour');
      charger();
    } catch { toast.error('Erreur'); }
  };

  const couleurStatut = s => ({
    planifie:'#0369a1', lance:'#7c3aed', en_cours:'#d97706',
    termine:'#15803d', annule:'#dc2626'
  }[s]||'#6b7280');

  const bgStatut = s => ({
    planifie:'#e0f2fe', lance:'#f5f3ff', en_cours:'#fef3c7',
    termine:'#dcfce7', annule:'#fee2e2'
  }[s]||'#f3f4f6');

  const labelStatut = s => ({
    planifie:'Planifié', lance:'Lancé', en_cours:'En cours',
    termine:'Terminé', annule:'Annulé'
  }[s]||s);

  const F = ({label,children}) => (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>{label}</div>
      {children}
    </div>
  );
  const sel = {width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13};

  return (
    <div>
      {/* En-tête */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={filtreAtelier} onChange={e=>setFiltreAtelier(e.target.value)} style={{...sel,width:160}}>
            <option value="">Tous les ateliers</option>
            {ateliers.map(a=><option key={a.code} value={a.code}>{a.libelle}</option>)}
          </select>
          <select value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)} style={{...sel,width:140}}>
            <option value="">Tous statuts</option>
            {['planifie','lance','en_cours','termine','annule'].map(s=><option key={s} value={s}>{labelStatut(s)}</option>)}
          </select>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={{background:'#0369a1',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontWeight:700,fontSize:13}}>
          {showForm?'✕ Annuler':'+ Nouvel OF'}
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div style={{background:'#f0f9ff',borderRadius:14,padding:20,marginBottom:20,border:'1px solid #bae6fd'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#0369a1',marginBottom:16}}>📋 Nouvel Ordre de Fabrication</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <F label="Article * (produit à fabriquer)">
              <select value={form.article_id} onChange={e=>setForm({...form,article_id:e.target.value})} style={sel}>
                <option value="">-- Sélectionner article --</option>
                {articles.filter(a=>a.type_article==='produit_fini'||!a.type_article).map(a=>(
                  <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>
                ))}
              </select>
            </F>
            <F label="Client">
              <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} style={sel}>
                <option value="">-- Sans client --</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.raison_sociale||c.nom||c.code}</option>)}
              </select>
            </F>
            <F label="Atelier de production">
              <select value={form.atelier_id} onChange={e=>{ setForm({...form,atelier_id:e.target.value,machine_id:''}); axios.get(`${API}/machines?atelier_id=${e.target.value}`).then(r=>setMachines(r.data||[])).catch(()=>{}); }} style={sel}>
                {ateliers.filter(a=>a.type==='production'||a.code==='AT3').map(a=>(
                  <option key={a.code} value={a.code}>{a.libelle}</option>
                ))}
              </select>
            </F>
            <F label="Machine">
              <select value={form.machine_id} onChange={e=>setForm({...form,machine_id:e.target.value})} style={sel}>
                <option value="">-- Sélectionner machine --</option>
                {machinesFiltrees.map(m=><option key={m.id} value={m.id}>{m.code} — {m.nom}</option>)}
              </select>
            </F>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Quantité cible (kg)</div>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantite_cible}
                onChange={e => { const v=e.target.value; setForm(prev=>({...prev,quantite_cible:v})); }}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}
                placeholder="ex: 1000"
              />
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Date livraison prévue</div>
              <input
                type="date"
                value={form.date_livraison_prevue}
                onChange={e => setForm(prev=>({...prev,date_livraison_prevue:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}
              />
            </div>
            <F label="Priorité (1=basse, 5=urgente)">
              <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={sel}>
                {[1,2,3,4,5].map(p=><option key={p} value={p}>{p} — {['Très basse','Basse','Normale','Haute','Urgente'][p-1]}</option>)}
              </select>
            </F>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Référence Sage (optionnel)</div>
              <input
                value={form.reference_sage}
                onChange={e => setForm(prev=>({...prev,reference_sage:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}
                placeholder="Réf. commande Sage"
              />
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:4}}>Instructions spéciales</div>
              <input
                value={form.instructions}
                onChange={e => setForm(prev=>({...prev,instructions:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}
                placeholder="Couleur, dimensions, notes..."
              />
            </div>
          </div>

          {/* Calcul temps prévu */}
          {tempsCalc && (
            <div style={{background:'#dbeafe',borderRadius:8,padding:'10px 14px',marginTop:8,fontSize:13}}>
              ⏱ <strong>Temps de production estimé :</strong> {tempsCalc.temps_min} min ({tempsCalc.temps_h}h)
              {' '}<span style={{color:'#6b7280',fontSize:11}}>(formule : Qté/Cadence + Réglage)</span>
            </div>
          )}

          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button onClick={creerOF} style={{background:'#0369a1',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer',fontWeight:700}}>
              ✓ Créer l'OF
            </button>
            <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',borderRadius:8,padding:'10px 24px',cursor:'pointer'}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Détail OF complet */}
      {detail && <DetailOF detail={detail} machines={machines} onClose={()=>setDetail(null)} onRefresh={charger} onStatut={changerStatut}/>}

      {/* Liste OF */}
      <div style={{background:'#fff',borderRadius:14,border:'1px solid #e5e7eb',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr style={{background:'#f0f9ff'}}>
            {['N° OF','Article','Client','Machine','Atelier','Qté cible','Temps prévu','Livraison','Priorité','Statut','🖨','Actions'].map(h=>(
              <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#0369a1',borderBottom:'2px solid #bae6fd',whiteSpace:'nowrap'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={11} style={{padding:20,textAlign:'center',color:'#6b7280'}}>Chargement...</td></tr>}
            {!loading && ofs.length===0 && (
              <tr><td colSpan={11} style={{padding:40,textAlign:'center',color:'#6b7280'}}>
                <div style={{fontSize:32,marginBottom:8}}>📋</div>
                Aucun OF — créez le premier
              </td></tr>
            )}
            {ofs.map((of,i) => (
              <tr key={of.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'#fff':'#fafafa',cursor:'pointer'}}
                  onClick={()=>setDetail(detail?.id===of.id?null:of)}>
                <td style={{padding:'9px 12px',fontWeight:700,color:'#0369a1'}}>{of.numero_of}</td>
                <td style={{padding:'9px 12px'}}>{of.article_nom||'—'}<br/><span style={{fontSize:10,color:'#6b7280'}}>{of.article_code}</span></td>
                <td style={{padding:'9px 12px',fontSize:12}}>{of.client_nom||'—'}</td>
                <td style={{padding:'9px 12px',fontSize:12}}>{of.machine_nom||of.machine_code||'—'}</td>
                <td style={{padding:'9px 12px',fontSize:12}}>{of.atelier_id||'—'}</td>
                <td style={{padding:'9px 12px',fontWeight:600}}>{parseFloat(of.quantite_cible||0).toFixed(0)} kg</td>
                <td style={{padding:'9px 12px',fontSize:12}}>{of.temps_prevu_min?of.temps_prevu_min+'min':'—'}</td>
                <td style={{padding:'9px 12px',fontSize:12}}>{of.date_livraison_prevue?new Date(of.date_livraison_prevue).toLocaleDateString('fr-FR'):'—'}</td>
                <td style={{padding:'9px 12px',textAlign:'center'}}>
                  <span style={{fontSize:16}}>{'⭐'.repeat(parseInt(of.priorite||1))}</span>
                </td>
                <td style={{padding:'9px 12px'}}>
                  <span style={{background:bgStatut(of.statut),color:couleurStatut(of.statut),padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>
                    {labelStatut(of.statut)}
                  </span>
                </td>
                <td style={{padding:'9px 12px',textAlign:'center'}} onClick={e=>e.stopPropagation()}>
                  <button
onClick={()=>window.open(`/api/of/${of.id}/pdf`,'_blank')}
                    title="Voir tickets"
                    style={{background:'#e0f2fe',color:'#0369a1',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11}}>
                    🖨
                  </button>
                </td>
                <td style={{padding:'9px 12px'}} onClick={e=>e.stopPropagation()}>
                  {of.statut==='planifie' && <button onClick={()=>changerStatut(of.id,'lance')} style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11}}>▶</button>}
                  {of.statut==='lance' && <button onClick={()=>changerStatut(of.id,'en_cours')} style={{background:'#d97706',color:'#fff',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11}}>⚙</button>}
                  {of.statut==='en_cours' && <button onClick={()=>changerStatut(of.id,'termine')} style={{background:'#15803d',color:'#fff',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontSize:11}}>✓</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ sessions_actives:0, trs_moyen:0, poids_net_total:0, poids_dechets_total:0, nb_tickets:0, arrets_actifs:0, alertes_rebus:[] });
  const [trs, setTrs] = useState([]);
  const [kpi, setKpi] = useState({});
  const [vueMode, setVueMode] = useState('general'); // 'general' | 'at3'
  const [dashGeneral, setDashGeneral] = useState({});
  const [machinesStatut, setMachinesStatut] = useState([]);
  const [alertes, setAlertes] = useState([]);
  const [ateliersDash, setAteliersDash] = useState([]);
  const [dossiersOuverts, setDossiersOuverts] = useState({});

  const charger = async () => {
    try {
      const [d1, d2, d3] = await Promise.all([
        axios.get(`${API}/kpi/dashboard`),
        axios.get(`${API}/kpi/trs`),
        axios.get(`${API}/kpi/rebus`).catch(()=>({data:{}})),
      ]);
      setData(d1.data || {}); setTrs(d2.data || []); setKpi(d3.data || {});
    } catch {}
    try { const {data}=await axios.get(`${API}/alertes`); setAlertes(data||[]); } catch {}
    try { const {data}=await axios.get(`${API}/ateliers`); setAteliersDash((data||[]).map(a=>({...a,icon:a.type==='production'?'🏭':a.type==='magasin'?'🏪':a.type==='qhse'?'🛡':a.type==='rh'?'👥':a.type==='mecanique'?'🔧':a.type==='technique'?'⚙':a.type==='achat'?'🛒':a.type==='vente'?'💼':a.type==='transit'?'🚛':'🏢'}))); } catch {}
    try {
      const {data}=await axios.get(`${API}/gmao/dashboard`);
      setDashGeneral(prev=>({...prev, ...data}));
    } catch {}
    try {
      const {data}=await axios.get(`${API}/rh/dashboard`);
      setDashGeneral(prev=>({...prev, effectif:data.nb_employes, conges_attente:data.conges_en_attente}));
    } catch {}
    try {
      const {data}=await axios.get(`${API}/qhse/dashboard`);
      setDashGeneral(prev=>({...prev, nc_ouvertes:data.nc_ouvertes, risques:data.risques_eleves}));
    } catch {}
    try {
      const {data}=await axios.get(`${API}/stock/resume`);
      setDashGeneral(prev=>({...prev, valeur_stock:data.valeur_totale, alertes_stock:data.nb_alertes}));
    } catch {}
  };

  useEffect(() => { charger(); const t=setInterval(charger,30000); return()=>clearInterval(t); }, []);

  const trsColor = (v) => v>=85?'#15803d':v>=70?'#d97706':'#dc2626';
  const trsLabel = (v) => v>=85?'Excellent':v>=70?'Acceptable':'Critique';

  return (
    <div>
      {/* Navigation en dossiers ateliers */}
      {!['commercial','vente','achat','rh','qhse'].includes(user?.role||'') && (<div style={{marginBottom:20,display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
        {/* Vue générale */}
        <button onClick={()=>setVueMode('general')} style={{
          padding:'10px 18px',border:'2px solid',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700,
          borderColor:vueMode==='general'?'#1d4ed8':'#e5e7eb',
          background:vueMode==='general'?'#1d4ed8':'#fff',
          color:vueMode==='general'?'#fff':'#374151'
        }}>🏭 Vue Générale</button>

        {/* Dossiers ateliers depuis DB */}
        {(ateliersDash||[]).filter(a=>!a.parent_code).map(atelier => {
          const enfants = (ateliersDash||[]).filter(e=>e.parent_code===atelier.code);
          const iconeAtelier = atelier.type==='production'?'🏭':atelier.type==='magasin'?'🏪':atelier.type==='mecanique'?'🔧':atelier.type==='qhse'?'🛡':atelier.type==='rh'?'👥':atelier.type==='achat'?'🛒':atelier.type==='vente'?'💼':atelier.type==='transit'?'🚛':'🏢';
          const estActif = vueMode===atelier.code.toLowerCase() || enfants.some(e=>vueMode===e.code.toLowerCase());
          return (
            <div key={atelier.code} style={{
              border:'2px solid',borderRadius:10,overflow:'hidden',
              borderColor:estActif?'#0369a1':'#e5e7eb',
              minWidth:120
            }}>
              {/* En-tête dossier */}
              <button onClick={()=>{setVueMode(atelier.code.toLowerCase());setDossiersOuverts(prev=>({...prev,[atelier.code]:!prev[atelier.code]}));}} style={{
                width:'100%',padding:'8px 12px',border:'none',cursor:'pointer',
                background:vueMode===atelier.code.toLowerCase()?'#0369a1':estActif?'#e0f2fe':'#f9fafb',
                color:vueMode===atelier.code.toLowerCase()?'#fff':'#374151',
                fontWeight:700,fontSize:12,textAlign:'left',display:'flex',alignItems:'center',gap:6
              }}>
                <span>{iconeAtelier}</span>
                <span>{atelier.libelle}</span>
                {enfants.length>0 && <span style={{marginLeft:'auto',fontSize:10,opacity:0.7}}>{estActif?'▾':'▸'}</span>}
              </button>
              {/* Sous-départements */}
              {enfants.length>0 && (dossiersOuverts[atelier.code] || enfants.some(e=>vueMode===e.code.toLowerCase())) && (
                <div style={{background:'#fff',borderTop:'1px solid #e5e7eb'}}>
                  {enfants.map(dep => {
                    const iconeDep = dep.code.includes('EXT')?'🔥':dep.code.includes('SOU')?'⚡':dep.code.includes('IMP')?'🖨':dep.code.includes('DEC')?'📦':dep.code.includes('MAG')?'🏪':'⚙';
                    return (
                      <button key={dep.code} onClick={()=>setVueMode(dep.code.toLowerCase())} style={{
                        width:'100%',padding:'6px 12px 6px 24px',border:'none',borderBottom:'1px solid #f3f4f6',cursor:'pointer',
                        background:vueMode===dep.code.toLowerCase()?'#dbeafe':'#fff',
                        color:vueMode===dep.code.toLowerCase()?'#1d4ed8':'#6b7280',
                        fontSize:11,fontWeight:vueMode===dep.code.toLowerCase()?700:500,textAlign:'left'
                      }}>
                        {iconeDep} {dep.libelle.replace(/AT3 — /,'')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={charger} style={{padding:'10px 12px',border:'1px solid #e5e7eb',background:'#f3f4f6',cursor:'pointer',borderRadius:10,alignSelf:'flex-start'}}>🔄</button>
      </div>)}

      {/* ══ VUE COMMERCIAL ══ */}
      {vueMode==='general' && user?.role==='commercial' && (
        <DashboardCommercial />
      )}

      {/* ══ VUE GÉNÉRALE NAI ══ */}
      {vueMode==='general' && user?.role!=='commercial' && (
        <div>
          {/* KPIs production */}
          <div style={{fontSize:11,fontWeight:700,color:'#6b7280',letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>📊 Production temps réel</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:20}}>
            {[
              {icon:'⚙',label:'Sessions actives',value:data.sessions_actives||0,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'📊',label:'TRS moyen',value:`${parseFloat(data.trs_moyen||0).toFixed(1)}%`,color:trsColor(data.trs_moyen||0),bg:'#f0fdf4'},
              {icon:'⚖',label:'Production nette',value:`${parseFloat(data.poids_net_total||0).toFixed(1)} kg`,color:'#15803d',bg:'#dcfce7'},
              {icon:'🗑',label:'Déchets',value:`${parseFloat(data.poids_dechets_total||0).toFixed(1)} kg`,color:'#d97706',bg:'#fef3c7'},
              {icon:'🔴',label:'Arrêts actifs',value:data.arrets_actifs||0,color:data.arrets_actifs>0?'#dc2626':'#15803d',bg:data.arrets_actifs>0?'#fee2e2':'#dcfce7'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:10,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* KPIs transversaux */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
            {[
              ['👥 Effectif actif', dashGeneral.effectif||'—', '#0891b2','#e0f2fe'],
              ['🏭 Machines en panne', dashGeneral.equipements_en_panne||0, dashGeneral.equipements_en_panne>0?'#dc2626':'#15803d', dashGeneral.equipements_en_panne>0?'#fee2e2':'#dcfce7'],
              ['⚠ NC ouvertes', dashGeneral.nc_ouvertes||0, dashGeneral.nc_ouvertes>0?'#d97706':'#15803d', dashGeneral.nc_ouvertes>0?'#fef3c7':'#dcfce7'],
              ['📦 Valeur stock', dashGeneral.valeur_stock?`${parseFloat(dashGeneral.valeur_stock).toLocaleString('fr-FR')} FCFA`:'—', '#6d28d9','#f5f3ff'],
            ].map(([label,value,color,bg])=>(
              <div key={label} style={{background:bg,borderRadius:12,padding:'12px 14px'}}>
                <div style={{fontSize:10,color:'#6b7280',marginBottom:4}}>{label}</div>
                <div style={{fontSize:18,fontWeight:800,color}}>{value}</div>
              </div>
            ))}
          </div>

          {/* Alertes consolidées */}
          {(alertes.length > 0 || dashGeneral.nc_ouvertes > 0 || dashGeneral.equipements_en_panne > 0) && (
            <div style={{background:'#fff',borderRadius:12,border:'2px solid #fecdd3',padding:16,marginBottom:20}}>
              <div style={{fontWeight:700,color:'#dc2626',marginBottom:12,fontSize:13}}>🚨 Alertes actives</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                {dashGeneral.equipements_en_panne>0&&(
                  <div style={{background:'#fee2e2',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                    <strong>{dashGeneral.equipements_en_panne} machine(s) en panne</strong> — voir GMAO
                  </div>
                )}
                {dashGeneral.nc_ouvertes>0&&(
                  <div style={{background:'#fef3c7',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                    <strong>{dashGeneral.nc_ouvertes} NC ouvertes</strong> — voir QHSE
                  </div>
                )}
                {dashGeneral.conges_attente>0&&(
                  <div style={{background:'#dbeafe',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                    <strong>{dashGeneral.conges_attente} congé(s) en attente</strong> — voir RH
                  </div>
                )}
                {dashGeneral.alertes_stock>0&&(
                  <div style={{background:'#fee2e2',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                    <strong>{dashGeneral.alertes_stock} article(s) en rupture</strong> — voir Stock
                  </div>
                )}
                {(data.alertes_rebus||[]).map((a,i)=>(
                  <div key={i} style={{background:'#fef3c7',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                    ⚠ {a.machine_code} — Rebus {parseFloat(a.taux_rebus||0).toFixed(1)}%
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRS par machine */}
          {trs.length > 0 && (
            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
              <div style={{fontWeight:700,color:'#1d4ed8',marginBottom:12,fontSize:13}}>📊 TRS par machine (aujourd'hui)</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8}}>
                {trs.slice(0,12).map((m,i)=>{
                  const v = parseFloat(m.trs||0);
                  const c = trsColor(v);
                  return (
                    <div key={i} style={{background:'#f8fafc',borderRadius:10,padding:'10px 12px',border:`2px solid ${c}20`}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:4}}>{m.machine_code||m.machine}</div>
                      <div style={{fontSize:24,fontWeight:800,color:c}}>{v.toFixed(0)}%</div>
                      <div style={{fontSize:10,color:c,fontWeight:600}}>{trsLabel(v)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ VUE AT3 PRODUCTION ══ */}
      {vueMode==='at3' && (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'#6b7280',letterSpacing:1,textTransform:'uppercase',marginBottom:10}}>⚙ Atelier 3 — Tableau de bord production</div>

          {/* Status extrudeuses */}
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16,marginBottom:16}}>
            <div style={{fontWeight:700,color:'#1d4ed8',marginBottom:12,fontSize:13}}>🔵 9 Extrudeuses</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(9,1fr)',gap:6}}>
              {Array.from({length:9},(_,i)=>{
                const m = (trs||[]).find(t=>(t.machine_code||'').includes(`EX${String(i+1).padStart(2,'0')}`)||
                                            (t.machine_code||'').toLowerCase().includes(`ext${i+1}`)||
                                            (t.machine||'').includes(`${i+1}`));
                const v = m ? parseFloat(m.trs||0) : null;
                const c = v===null?'#9ca3af':trsColor(v);
                return (
                  <div key={i} style={{background:v===null?'#f3f4f6':c+'20',borderRadius:8,padding:'10px 6px',textAlign:'center',border:`2px solid ${c}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#374151'}}>EX{String(i+1).padStart(2,'0')}</div>
                    <div style={{fontSize:18,fontWeight:800,color:c}}>{v!==null?`${v.toFixed(0)}%`:'—'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status soudeuses */}
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16,marginBottom:16}}>
            <div style={{fontWeight:700,color:'#7c3aed',marginBottom:12,fontSize:13}}>🟣 5 Soudeuses</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
              {Array.from({length:5},(_,i)=>{
                const m = (trs||[]).find(t=>(t.machine_code||'').includes(`SO${String(i+1).padStart(2,'0')}`)||
                                            (t.machine||'').toLowerCase().includes(`soud${i+1}`));
                const v = m ? parseFloat(m.trs||0) : null;
                const c = v===null?'#9ca3af':trsColor(v);
                return (
                  <div key={i} style={{background:v===null?'#f3f4f6':c+'20',borderRadius:8,padding:'12px 8px',textAlign:'center',border:`2px solid ${c}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#374151'}}>SOU{String(i+1).padStart(2,'0')}</div>
                    <div style={{fontSize:22,fontWeight:800,color:c}}>{v!==null?`${v.toFixed(0)}%`:'—'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tables manuelles + postes */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
              <div style={{fontWeight:700,color:'#92400e',marginBottom:10,fontSize:13}}>🟤 3 Tables manuelles</div>
              {Array.from({length:3},(_,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:i<2?'1px solid #f3f4f6':'none'}}>
                  <span style={{fontWeight:600,fontSize:13}}>TABLE {String(i+1).padStart(2,'0')}</span>
                  <span style={{background:'#dcfce7',color:'#15803d',padding:'2px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>2 opér.</span>
                </div>
              ))}
            </div>
            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
              <div style={{fontWeight:700,color:'#0891b2',marginBottom:10,fontSize:13}}>👥 Postes transverses</div>
              {[['Emballeurs','3'],['Technicien Régleur','1'],['Contrôleur Qualité','1'],['Chef Atelier','1']].map(([p,n])=>(
                <div key={p} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <span style={{fontSize:12}}>{p}</span>
                  <span style={{background:'#dbeafe',color:'#1d4ed8',padding:'1px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* KPIs AT3 */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
            {[
              {icon:'⚙',label:'Sessions AT3',value:data.sessions_actives||0,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'📊',label:'TRS moyen AT3',value:`${parseFloat(data.trs_moyen||0).toFixed(1)}%`,color:trsColor(data.trs_moyen||0),bg:'#f0fdf4'},
              {icon:'⚖',label:'Production nette',value:`${parseFloat(data.poids_net_total||0).toFixed(1)} kg`,color:'#15803d',bg:'#dcfce7'},
              {icon:'🔴',label:'Arrêts',value:data.arrets_actifs||0,color:data.arrets_actifs>0?'#dc2626':'#15803d',bg:data.arrets_actifs>0?'#fee2e2':'#dcfce7'},
              {icon:'🏭',label:'Pannes GMAO',value:dashGeneral.equipements_en_panne||0,color:dashGeneral.equipements_en_panne>0?'#dc2626':'#15803d',bg:dashGeneral.equipements_en_panne>0?'#fee2e2':'#dcfce7'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:10,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuiviProduction() {
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    axios.get(`${API}/sessions/actives`).then(({data}) => setSessions(data)).catch(() => {});
  }, []);
  return (
    <div>
      <h3 style={{ margin:'0 0 20px', fontSize:15, fontWeight:700, color:'#1d4ed8' }}>Sessions de production en cours</h3>
      {sessions.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏭</div>
          <p style={{ color:'#9ca3af' }}>Aucune session active en ce moment</p>
        </div>
      ) : sessions.map(s => (
        <div key={s.id} style={{ background:'#fff', borderRadius:12, padding:18, border:'1px solid #dbeafe', marginBottom:12, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'#1d4ed8' }}>{s.numero_of}</div>
            <div style={{ fontSize:13, color:'#6b7280' }}>{s.article} · {s.machine_nom}</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>Opérateur : {s.operateur_nom} · Shift : {s.shift_nom}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ background:s.regleur_valide ? '#dcfce7' : '#fef3c7', color:s.regleur_valide ? '#15803d' : '#92400e', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600 }}>
              {s.regleur_valide ? '✓ Régleur validé' : '⏳ Attente régleur'}
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:6 }}>Depuis {new Date(s.heure_debut).toLocaleTimeString('fr-FR')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanningMachines() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [planning, setPlanning] = useState([]);
  const [machines, setMachines] = useState([]);
  const [ofs, setOfs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ of_id:'', machine_id:'', shift_id:'1', heure_debut_prevue:'06:00', duree_prevue_min:'', notes:'' });

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/planning?date=${date}`),
      axios.get(`${API}/machines`),
      axios.get(`${API}/of`),
    ]).then(([p,m,o]) => { setPlanning(p.data); setMachines(m.data); setOfs(o.data); }).catch(() => {});
  }, [date]);

  const creer = async () => {
    try {
      await axios.post(`${API}/planning`, { ...form, date_planifiee: date });
      toast.success('Planifié !');
      setShowForm(false);
      const { data } = await axios.get(`${API}/planning?date=${date}`);
      setPlanning(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const STATUT_COLOR = { planifie:'#dbeafe', en_cours:'#dcfce7', termine:'#f3f4f6', reporte:'#fef3c7' };
  const STATUT_TEXT  = { planifie:'#1d4ed8', en_cours:'#15803d', termine:'#6b7280', reporte:'#92400e' };

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={() => { const d=new Date(date); d.setDate(d.getDate()-1); setDate(d.toISOString().split('T')[0]); }}
          style={{ background:'#fff', border:'1px solid #d1d5db', padding:'8px 14px', borderRadius:8, cursor:'pointer' }}>←</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13 }}/>
        <button onClick={() => { const d=new Date(date); d.setDate(d.getDate()+1); setDate(d.toISOString().split('T')[0]); }}
          style={{ background:'#fff', border:'1px solid #d1d5db', padding:'8px 14px', borderRadius:8, cursor:'pointer' }}>→</button>
        <button onClick={() => setDate(new Date().toISOString().split('T')[0])}
          style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13 }}>Aujourd'hui</button>
        <button onClick={() => setShowForm(true)} style={{ background:'#14532d', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:600, marginLeft:'auto' }}>+ Planifier</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #86efac', marginBottom:16 }}>
          <h4 style={{ margin:'0 0 14px', color:'#14532d' }}>Nouvelle planification — {date}</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:12 }}>
            {[['OF','of_id','select-of'],['Machine','machine_id','select-machine'],['Shift','shift_id','select-shift'],['Heure début','heure_debut_prevue','time'],['Durée (min)','duree_prevue_min','number'],['Notes','notes','text']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                {type==='select-of' ? (
                  <select value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:12 }}>
                    <option value="">Sélectionner...</option>
                    {ofs.map(o => <option key={o.id} value={o.id}>{o.numero_of}</option>)}
                  </select>
                ) : type==='select-machine' ? (
                  <select value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:12 }}>
                    <option value="">Sélectionner...</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.code}</option>)}
                  </select>
                ) : type==='select-shift' ? (
                  <select value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:12 }}>
                    <option value="1">Matin</option><option value="2">Après-midi</option><option value="3">Nuit</option>
                  </select>
                ) : (
                  <input type={type} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:12, boxSizing:'border-box' }}/>
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={creer} style={{ background:'#14532d', color:'#fff', border:'none', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Créer</button>
            <button onClick={() => setShowForm(false)} style={{ background:'#f3f4f6', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {planning.map(p => (
          <div key={p.id} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:`2px solid ${STATUT_COLOR[p.statut_planning]||'#e5e7eb'}`, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                <span style={{ fontWeight:700 }}>{p.numero_of}</span>
                <span style={{ background:STATUT_COLOR[p.statut_planning]||'#f3f4f6', color:STATUT_TEXT[p.statut_planning]||'#374151', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{p.statut_planning}</span>
                <span style={{ background:'#f3f4f6', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{p.machine_code}</span>
                <span style={{ background:'#f3f4f6', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{p.shift_nom}</span>
              </div>
              <div style={{ fontSize:13, color:'#6b7280' }}>{p.article_nom} · {p.client_nom}</div>
              {p.heure_debut_prevue && <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>Début : {p.heure_debut_prevue} · {p.duree_prevue_min} min</div>}
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:'#14532d' }}>
              {p.avancement_pct > 0 && `${p.avancement_pct}%`}
            </div>
          </div>
        ))}
        {planning.length === 0 && (
          <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📅</div>
            <p style={{ color:'#9ca3af' }}>Aucune planification pour cette date</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RapportsJournaliers() {
  const [rapports, setRapports] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [ateliers, setAteliers] = useState([]);
  const [ofs, setOfs] = useState([]);
  const [form, setForm] = useState({ date_rapport:new Date().toISOString().split('T')[0], atelier_id:'', shift_id:'1', of_id:'', qte_produite:'', poids_net_kg:'', poids_brut_kg:'', matiere_prevue_kg:'', matiere_reelle_kg:'', qte_dechets:'', poids_dechets_kg:'', motif_dechets:'', qte_pertes:'', poids_pertes_kg:'', motif_pertes:'', qte_rebus:'', poids_rebus_kg:'', motif_rebus:'', temps_prod_prevu_min:'480', temps_prod_reel_min:'', temps_arret_min:'', nb_operateurs:'', observations:'', problemes_rencontres:'', actions_correctives:'' });

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/rapports-journaliers?date_debut=${date}&date_fin=${date}`),
      axios.get(`${API}/ateliers`),
      axios.get(`${API}/of`),
    ]).then(([r,a,o]) => { setRapports(r.data); setAteliers(a.data); setOfs(o.data); }).catch(() => {});
  }, [date]);

  const creer = async () => {
    try {
      await axios.post(`${API}/rapports-journaliers`, form);
      toast.success('Rapport créé');
      setShowForm(false);
      const { data } = await axios.get(`${API}/rapports-journaliers?date_debut=${date}&date_fin=${date}`);
      setRapports(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const valider = async (id) => {
    try {
      await axios.put(`${API}/rapports-journaliers/${id}/valider`);
      toast.success('Rapport validé');
      const { data } = await axios.get(`${API}/rapports-journaliers?date_debut=${date}&date_fin=${date}`);
      setRapports(data);
    } catch { toast.error('Erreur'); }
  };

  const SCOLOR = { brouillon:'#f3f4f6', soumis:'#dbeafe', valide:'#dcfce7', rejete:'#fee2e2' };
  const STEXT  = { brouillon:'#374151', soumis:'#1d4ed8', valide:'#15803d', rejete:'#dc2626' };

  const inp = (label,key,type='text') => (
    <div key={key}>
      <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})}
        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box', textAlign:type==='number'?'center':'left' }}/>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13 }}/>
        <button onClick={() => setShowForm(true)} style={{ background:'#14532d', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:600, marginLeft:'auto' }}>+ Nouveau rapport</button>
      </div>

      {/* KPI résumé */}
      {rapports.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
          {[
            ['Production nette', rapports.reduce((s,r)=>s+parseFloat(r.poids_net_kg||0),0).toFixed(1)+' kg', '#15803d','#dcfce7'],
            ['Déchets', rapports.reduce((s,r)=>s+parseFloat(r.poids_dechets_kg||0),0).toFixed(1)+' kg', '#d97706','#fef3c7'],
            ['Pertes', rapports.reduce((s,r)=>s+parseFloat(r.poids_pertes_kg||0),0).toFixed(1)+' kg', '#dc2626','#fee2e2'],
            ['TRS moyen', (rapports.length ? Math.round(rapports.reduce((s,r)=>s+parseFloat(r.trs_calcule||0),0)/rapports.length) : 0)+'%', '#0369a1','#e0f2fe'],
          ].map(([l,v,c,bg]) => (
            <div key={l} style={{ background:bg, borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:20, fontWeight:800, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #86efac', marginBottom:16 }}>
          <h4 style={{ margin:'0 0 16px', color:'#14532d', fontSize:15, fontWeight:700 }}>Nouveau Rapport Journalier</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, marginBottom:16 }}>
            {inp('Date','date_rapport','date')}
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Atelier *</label>
              <select value={form.atelier_id} onChange={e => setForm({...form,atelier_id:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                <option value="">Sélectionner...</option>
                {ateliers.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Shift</label>
              <select value={form.shift_id} onChange={e => setForm({...form,shift_id:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                <option value="1">Matin</option><option value="2">Après-midi</option><option value="3">Nuit</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>OF</label>
              <select value={form.of_id} onChange={e => setForm({...form,of_id:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                <option value="">Aucun</option>
                {ofs.map(o => <option key={o.id} value={o.id}>{o.numero_of}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
            {inp('Poids net (kg)','poids_net_kg','number')}
            {inp('Matière réelle (kg)','matiere_reelle_kg','number')}
            {inp('Poids déchets (kg)','poids_dechets_kg','number')}
            {inp('Motif déchets','motif_dechets')}
            {inp('Poids pertes (kg)','poids_pertes_kg','number')}
            {inp('Motif pertes','motif_pertes')}
            {inp('Poids rebus (kg)','poids_rebus_kg','number')}
            {inp('Temps prod. réel (min)','temps_prod_reel_min','number')}
            {inp('Temps arrêts (min)','temps_arret_min','number')}
            {inp('Nb opérateurs','nb_operateurs','number')}
          </div>
          <div style={{ display:'grid', gap:10, marginBottom:14 }}>
            {[['observations','Observations'],['problemes_rencontres','Problèmes'],['actions_correctives','Actions correctives']].map(([k,l]) => (
              <div key={k}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{l}</label>
                <textarea value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} rows={2}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }}/>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={creer} style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>✓ Enregistrer</button>
            <button onClick={() => setShowForm(false)} style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f0fdf4' }}>
              {['N° Rapport','Atelier','Prod. nette','Déchets','Pertes','TRS','Rebus','Statut','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rapports.map((r,i) => (
              <tr key={r.id} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb' }}>
                <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'#14532d' }}>{r.numero_rapport}</td>
                <td style={{ padding:'8px 12px' }}>{r.atelier_nom}</td>
                <td style={{ padding:'8px 12px', fontWeight:700, color:'#15803d' }}>{parseFloat(r.poids_net_kg||0).toFixed(1)} kg</td>
                <td style={{ padding:'8px 12px', color:'#d97706' }}>{parseFloat(r.poids_dechets_kg||0).toFixed(1)} kg</td>
                <td style={{ padding:'8px 12px', color:'#dc2626' }}>{parseFloat(r.poids_pertes_kg||0).toFixed(1)} kg</td>
                <td style={{ padding:'8px 12px' }}><span style={{ color:parseFloat(r.trs_calcule)>=80?'#15803d':'#dc2626', fontWeight:700 }}>{r.trs_calcule}%</span></td>
                <td style={{ padding:'8px 12px' }}>{r.taux_rebus_calcule}%</td>
                <td style={{ padding:'8px 12px' }}>
                  <span style={{ background:SCOLOR[r.statut]||'#f3f4f6', color:STEXT[r.statut]||'#374151', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{r.statut}</span>
                </td>
                <td style={{ padding:'8px 12px' }}>
                  {r.statut === 'soumis' && (
                    <button onClick={() => valider(r.id)} style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', padding:'3px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>✓ Valider</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rapports.length === 0 && (
          <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📊</div>
            <p>Aucun rapport pour cette date</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Articles() {
  const [articles, setArticles] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [matieresPremiers, setMatieresPremiers] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [modeEditArt, setModeEditArt] = useState(false);
  const [editArtId, setEditArtId] = useState(null);
  const [composition, setComposition] = useState([]);
  const [newComp, setNewComp] = useState({ mp_id:'', quantite:'', unite_id:'', pct:'' });
  const [form, setForm] = useState({
    code:'', designation:'', famille_id:'', unite_mesure_id:'',
    type_article:'produit_fini', tracabilite_type:'lot', format_lot:'LOT-YYYYMMDD-001', matieres_principales:[],
    couleur:'', longueur_mm:'', largeur_mm:'', hauteur_mm:'',
    poids_theorique_kg:'', poids_reel_kg:'', poids_mandrin_kg:'',
    cadence_theorique_kg_h:'', temps_reglage_min:'30',
    prix_achat:'0', prix_vente:'0', prix_cession_interne:'0',
    stock_mini:'0', dlc_jours:'', allergenes:'', normes_iso:'',
    points_ccp: false, atelier_production_id:'',
  });

  const chargerRefs = async () => {
    try {
      const [f, u, a] = await Promise.all([
        axios.get(`${API}/referentiels/familles`),
        axios.get(`${API}/referentiels/unites`),
        axios.get(`${API}/ateliers`),
      axios.get(`${API}/machines`),
      ]);
      setFamilles(f.data);
      setUnites(u.data);
      setAteliers(a.data);
    } catch {}
  };

  const chargerArticles = async () => {
    try {
      // Articles = tout SAUF matières premières (elles ont leur propre module)
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('exclure_mp', 'true');
      const { data } = await axios.get(`${API}/articles?${params}`);
      setArticles(data);
      // Charger les MP séparément pour la composition
      const { data: mp } = await axios.get(`${API}/articles?type_article=matiere_premiere`);
      setMatieresPremiers(mp);
    } catch {}
  };

  useEffect(() => { chargerRefs(); chargerArticles(); }, [search]);

  const modifierArticle = async (a) => {
    await chargerRefs();
    await chargerArticles();
    setModeEditArt(true);
    setEditArtId(a.id);
    setDetail(null);
    setComposition(Array.isArray(a.composition) ? a.composition : []);
    setForm({
      code: a.code || '',
      designation: a.designation || '',
      famille_id: a.famille_id ? String(a.famille_id) : '',
      unite_mesure_id: a.unite_mesure_id ? String(a.unite_mesure_id) : '',
      type_article: a.type_article || 'produit_fini',
      tracabilite_type: a.tracabilite_type || 'lot',
      format_lot: a.format_lot || 'LOT-YYYYMMDD-001',
      matieres_principales: a.matieres_principales || [],
      couleur: a.couleur || '',
      longueur_mm: a.longueur_mm || '',
      largeur_mm: a.largeur_mm || '',
      hauteur_mm: a.hauteur_mm || '',
      poids_theorique_kg: a.poids_theorique_kg || '',
      poids_reel_kg: a.poids_reel_kg || '',
      poids_mandrin_kg: a.poids_mandrin_kg || '',
      cadence_theorique_kg_h: a.cadence_theorique_kg_h || '',
      temps_reglage_min: a.temps_reglage_min || '30',
      prix_achat: a.prix_achat || '0',
      prix_vente: a.prix_vente || '0',
      prix_cession_interne: a.prix_cession_interne || '0',
      stock_mini: a.stock_mini || '0',
      dlc_jours: a.dlc_jours || '',
      allergenes: a.allergenes || '',
      normes_iso: a.normes_iso || '',
      points_ccp: a.points_ccp || false,
      atelier_production_id: a.atelier_production_id ? String(a.atelier_production_id) : '',
    });
    setShowForm(true);
    setTimeout(() => window.scrollTo(0, 0), 100);
  };

  const ouvrirFormulaire = async () => {
    await chargerRefs();
    await chargerArticles();
    setModeEditArt(false);
    setEditArtId(null);
    setComposition([]);
    setNewComp({ mp_id:'', quantite:'', unite_id:'', pct:'' });
    setForm({ code:'', designation:'', famille_id:'', unite_mesure_id:'', type_article:'produit_fini', tracabilite_type:'lot', format_lot:'LOT-YYYYMMDD-001', matieres_principales:[], couleur:'', longueur_mm:'', largeur_mm:'', hauteur_mm:'', poids_theorique_kg:'', poids_reel_kg:'', poids_mandrin_kg:'', cadence_theorique_kg_h:'', temps_reglage_min:'30', prix_achat:'0', prix_vente:'0', prix_cession_interne:'0', stock_mini:'0', dlc_jours:'', allergenes:'', normes_iso:'', points_ccp:false, atelier_production_id:'' });
    setShowForm(true);
    setTimeout(() => document.getElementById('art-code')?.focus(), 100);
  };

  const ajouterCompo = () => {
    if (!newComp.mp_id) return toast.error('Sélectionnez une matière première');
    if (!newComp.quantite && !newComp.pct) return toast.error('Indiquez une quantité ou un pourcentage');
    const mp = matieresPremiers.find(m => m.id === newComp.mp_id);
    if (!mp) return;
    if (composition.find(c => c.mp_id === newComp.mp_id)) return toast.error('Cette matière est déjà dans la composition');
    setComposition([...composition, { ...newComp, code: mp.code, designation: mp.designation }]);
    setNewComp({ mp_id:'', quantite:'', unite_id:'', pct:'' });
  };

  const totalPct = composition.reduce((s, c) => s + parseFloat(c.pct || 0), 0);

  const sauvegarderArticle = async () => {
    if (!form.code.trim()) return toast.error('Code obligatoire');
    if (!form.designation.trim()) return toast.error('Désignation obligatoire');
    try {
      // Envoyer en JSON (pas FormData) - évite les problèmes de type
      const payload = {
        ...Object.fromEntries(
          Object.entries(form).filter(([k,v]) => !Array.isArray(v) && v !== undefined)
        ),
        composition: composition.length > 0 ? composition : [],
        points_ccp: !!form.points_ccp,
      };
      // Convertir les champs numériques
      ['longueur_mm','largeur_mm','hauteur_mm','poids_theorique_kg','poids_reel_kg',
       'poids_mandrin_kg','cadence_theorique_kg_h','temps_reglage_min',
       'prix_achat','prix_vente','prix_cession_interne','stock_mini','dlc_jours'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
        else if (payload[k] !== null && payload[k] !== undefined) payload[k] = parseFloat(payload[k]) || 0;
      });
      // IDs en null si vide
      ['famille_id','unite_mesure_id','atelier_production_id'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });

      if (modeEditArt && editArtId) {
        await axios.put(`${API}/articles/${editArtId}`, payload);
        toast.success(`✓ ${form.designation} mis à jour`);
      } else {
        await axios.post(`${API}/articles`, payload);
        toast.success(`✓ Article ${form.code} créé`);
      }
      setShowForm(false);
      setModeEditArt(false);
      setEditArtId(null);
      chargerArticles();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const TYPE_C = {
    produit_fini:    { bg:'#dcfce7', tx:'#15803d', label:'Produit fini' },
    matiere_premiere:{ bg:'#dbeafe', tx:'#1d4ed8', label:'Matière première' },
    semi_fini:       { bg:'#f3e8ff', tx:'#7e22ce', label:'Semi-fini' },
    emballage:       { bg:'#fef3c7', tx:'#92400e', label:'Emballage' },
    consommable:     { bg:'#f3f4f6', tx:'#374151', label:'Consommable' },
    piece_detachee:  { bg:'#fce7f3', tx:'#9d174d', label:'Pièce détachée' },
  };

  // InputField global utilisé

  // SelectField global utilisé

  return (
    <div>
      {/* Barre actions */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Code, désignation..."
          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'9px 14px', fontSize:13 }}/>
        <button onClick={ouvrirFormulaire}
          style={{ background:'#7e22ce', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }}>
          + Nouvel article
        </button>
      </div>

      {/* ══ FORMULAIRE ══ */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #c4b5fd', marginBottom:20 }}>
          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#7e22ce,#4338ca)', padding:'14px 24px', borderRadius:'12px 12px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>{modeEditArt ? '✏ Modifier Article' : '📦 Nouvel Article — Fiche Technique'}</span>
            <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:6, padding:'4px 12px', cursor:'pointer' }}>✕</button>
          </div>

          <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>

            {/* BLOC 1 — Identification */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#7e22ce', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #e9d5ff', paddingBottom:6, marginBottom:14 }}>
                1 · Identification
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
                <InputField label="Code *" value={form.code} onChange={e => setForm({...form,code:e.target.value})} placeholder="EX: SAC-50KG"/>
                <InputField label="Désignation *" value={form.designation} onChange={e => setForm({...form,designation:e.target.value})} placeholder="Sac industriel PP 50kg"/>
                <SelectField label="Famille *" value={form.famille_id} onChange={e => setForm({...form,famille_id:e.target.value})} required={true}
                  options={familles.length ? familles.map(f => ({ v:String(f.id), l:f.libelle })) : [{v:'',l:'⚠ Créez des familles dans Référentiels'}]}/>
                <SelectField label="Type article" value={form.type_article} onChange={e => setForm({...form,type_article:e.target.value})}
                  options={[
                    { v:'produit_fini', l:'Produit fini' },
                    { v:'matiere_premiere', l:'Matière première' },
                    { v:'semi_fini', l:'Semi-fini' },
                    { v:'emballage', l:'Emballage' },
                    { v:'consommable', l:'Consommable' },
                    { v:'piece_detachee', l:'Pièce détachée' },
                  ]}/>
                <SelectField label="Unité de mesure *" value={form.unite_mesure_id} onChange={e => setForm({...form,unite_mesure_id:e.target.value})} required={true}
                  options={unites.length ? unites.map(u => ({ v:String(u.id), l:`${u.code} — ${u.libelle}` })) : [{v:'',l:'⚠ Activez des unités dans Référentiels'}]}/>
                <SelectField label="Atelier de production" value={form.atelier_production_id} onChange={e => setForm({...form,atelier_production_id:e.target.value})}
                  options={ateliers.length ? ateliers.map(a => ({ v:String(a.id), l:`${a.code} — ${a.libelle}` })) : [{v:'',l:'⚠ Créez des ateliers'}]}/>
              </div>
              {/* Traçabilité + format numéro */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                <SelectField label="Type de traçabilité" value={form.tracabilite_type} onChange={e => setForm({...form,tracabilite_type:e.target.value})}
                  options={[
                    { v:'lot', l:'🏷 Par numéro de lot (alimentaire, ISO)' },
                    { v:'serie', l:'🔢 Par numéro de série' },
                    { v:'aucune', l:'— Aucune traçabilité' },
                  ]}/>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>
                    Format numéro de lot / série
                    <span style={{ fontSize:10, color:'#9ca3af', marginLeft:6 }}>ex: LOT-YYYYMMDD-001</span>
                  </label>
                  <input value={form.format_lot||''} onChange={e => setForm({...form, format_lot:e.target.value})}
                    placeholder="LOT-YYYYMMDD-001 ou SN-XXXX"
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box', fontFamily:'monospace' }}/>
                </div>
              </div>
            </div>

            {/* BLOC 2 — Physique */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#0369a1', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #bae6fd', paddingBottom:6, marginBottom:14 }}>
                2 · Caractéristiques physiques
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
                <InputField label="Longueur (mm)" value={form.longueur_mm} onChange={e => setForm({...form,longueur_mm:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Largeur (mm)" value={form.largeur_mm} onChange={e => setForm({...form,largeur_mm:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Hauteur (mm)" value={form.hauteur_mm} onChange={e => setForm({...form,hauteur_mm:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Poids théorique (kg)" value={form.poids_theorique_kg} onChange={e => setForm({...form,poids_theorique_kg:e.target.value})} type="number" placeholder="0.000"/>
                <InputField label="Poids réel (kg)" value={form.poids_reel_kg} onChange={e => setForm({...form,poids_reel_kg:e.target.value})} type="number" placeholder="0.000"/>
                <InputField label="Poids mandrin (kg)" value={form.poids_mandrin_kg} onChange={e => setForm({...form,poids_mandrin_kg:e.target.value})} type="number" placeholder="0.000"/>
                <InputField label="Couleur" value={form.couleur} onChange={e => setForm({...form,couleur:e.target.value})} placeholder="Naturel, Blanc, Noir..."/>
                <InputField label="Cadence théorique (kg/h)" value={form.cadence_theorique_kg_h} onChange={e => setForm({...form,cadence_theorique_kg_h:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Temps réglage (min)" value={form.temps_reglage_min} onChange={e => setForm({...form,temps_reglage_min:e.target.value})} type="number" placeholder="30"/>
              </div>
            </div>

            {/* BLOC 3 — Commercial */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#15803d', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #bbf7d0', paddingBottom:6, marginBottom:14 }}>
                3 · Paramètres commerciaux & stock
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
                <InputField label="Prix achat (FCFA)" value={form.prix_achat} onChange={e => setForm({...form,prix_achat:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Prix vente (FCFA)" value={form.prix_vente} onChange={e => setForm({...form,prix_vente:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Prix cession interne" value={form.prix_cession_interne} onChange={e => setForm({...form,prix_cession_interne:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Stock minimum" value={form.stock_mini} onChange={e => setForm({...form,stock_mini:e.target.value})} type="number" placeholder="0"/>
                <InputField label="DLC — Durée de vie (jours)" value={form.dlc_jours} onChange={e => setForm({...form,dlc_jours:e.target.value})} type="number" placeholder="Ex: 365 = 1 an"/>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>
                    Normes / Certifications
                    <span style={{ fontSize:10, color:'#9ca3af', marginLeft:6 }}>La gestion des normes est dans QHSE</span>
                  </label>
                  <input value={form.normes_iso||''} onChange={e => setForm({...form,normes_iso:e.target.value})}
                    placeholder="ISO 9001, ISO 22000, EN 13432..."
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                </div>
                <InputField label="Allergènes (alimentaire)" value={form.allergenes} onChange={e => setForm({...form,allergenes:e.target.value})} placeholder="Gluten, Lait..."/>
              </div>
              <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8 }}>
                <input type="checkbox" id="chk-ccp" checked={!!form.points_ccp}
                  onChange={e => setForm({...form, points_ccp:e.target.checked})}
                  style={{ width:16, height:16, cursor:'pointer' }}/>
                <label htmlFor="chk-ccp" style={{ fontSize:13, cursor:'pointer', color:'#374151' }}>
                  Point Critique de Contrôle (CCP) — HACCP alimentaire
                </label>
              </div>
            </div>

            {/* BLOC 4 — Composition / Nomenclature */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#b45309', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #fde68a', paddingBottom:6, marginBottom:14 }}>
                4 · Composition / Nomenclature (matières premières)
              </div>

              {matieresPremiers.length === 0 ? (
                <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:10, padding:16, fontSize:13, color:'#92400e' }}>
                  ℹ Créez d'abord des articles de type <strong>Matière première</strong> pour les sélectionner ici.
                </div>
              ) : (
                <>
                  {/* Ligne ajout composition */}
                  <div style={{ background:'#fffbeb', borderRadius:10, padding:14, marginBottom:12, border:'1px solid #fde68a' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'2.5fr 1fr 1fr 1fr auto', gap:10, alignItems:'flex-end' }}>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Matière première *</label>
                        <select value={newComp.mp_id} onChange={e => setNewComp({...newComp, mp_id:e.target.value})}
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                          <option value="">-- Sélectionner --</option>
                          {matieresPremiers.map(m => <option key={m.id} value={m.id}>{m.code} — {m.designation}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Quantité</label>
                        <input type="number" step="0.001" value={newComp.quantite}
                          onChange={e => setNewComp({...newComp, quantite:e.target.value})}
                          placeholder="0.000" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, textAlign:'center', boxSizing:'border-box' }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Unité</label>
                        <select value={newComp.unite_id} onChange={e => setNewComp({...newComp, unite_id:e.target.value})}
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                          <option value="">—</option>
                          {unites.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>% dans prod.</label>
                        <input type="number" step="0.1" min="0" max="100" value={newComp.pct}
                          onChange={e => setNewComp({...newComp, pct:e.target.value})}
                          placeholder="0.0" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, textAlign:'center', boxSizing:'border-box' }}/>
                      </div>
                      <button onClick={ajouterCompo}
                        style={{ background:'#b45309', color:'#fff', border:'none', padding:'9px 14px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
                        + Ajouter
                      </button>
                    </div>
                  </div>

                  {/* Tableau composition */}
                  {composition.length > 0 && (
                    <div style={{ border:'1px solid #fde68a', borderRadius:10, overflow:'hidden' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                          <tr style={{ background:'#fef3c7' }}>
                            {['Code','Matière première','Quantité','Unité','% compo','Supprimer'].map(h => (
                              <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'#92400e', borderBottom:'1px solid #fde68a' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {composition.map((c, i) => (
                            <tr key={i} style={{ borderBottom:'1px solid #fefce8', background:i%2===0?'#fff':'#fffdf5' }}>
                              <td style={{ padding:'8px 12px', fontFamily:'monospace', fontWeight:700, color:'#b45309' }}>{c.code}</td>
                              <td style={{ padding:'8px 12px' }}>{c.designation}</td>
                              <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:600 }}>{c.quantite||'—'}</td>
                              <td style={{ padding:'8px 12px', textAlign:'center' }}>{unites.find(u=>String(u.id)===String(c.unite_id))?.code||'—'}</td>
                              <td style={{ padding:'8px 12px', textAlign:'center' }}>
                                {c.pct ? <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, fontWeight:700 }}>{c.pct}%</span> : '—'}
                              </td>
                              <td style={{ padding:'8px 12px' }}>
                                <button onClick={() => setComposition(composition.filter((_,j) => j!==i))}
                                  style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11 }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ padding:'10px 14px', fontSize:12, fontWeight:700,
                        background: totalPct > 100 ? '#fee2e2' : totalPct === 100 ? '#dcfce7' : '#fef3c7',
                        color: totalPct > 100 ? '#dc2626' : totalPct === 100 ? '#15803d' : '#92400e' }}>
                        Total : {totalPct.toFixed(1)}%
                        {totalPct > 100 && ' ⚠ Dépasse 100% !'}
                        {totalPct === 100 && ' ✓ Parfait'}
                        {totalPct < 100 && totalPct > 0 && ` — manque ${(100-totalPct).toFixed(1)}%`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Boutons finaux */}
            <div style={{ display:'flex', gap:12, paddingTop:16, borderTop:'2px solid #f3f4f6' }}>
              <button onClick={sauvegarderArticle}
                style={{ background:'#7e22ce', color:'#fff', border:'none', padding:'13px 36px', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:15 }}>
                {modeEditArt ? '✓ Enregistrer les modifications' : "✓ Créer l'article"}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'13px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LISTE ARTICLES ══ */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
          <thead>
            <tr style={{ background:'#faf5ff' }}>
              {['Code','Désignation','Famille','Unité','Poids théo.','Cadence','Stock','Type','Atelier','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#7e22ce', borderBottom:'2px solid #e9d5ff', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => {
              const tc = TYPE_C[a.type_article] || TYPE_C.consommable;
              return (
                <tr key={a.id}
                  onClick={() => setDetail(detail?.id === a.id ? null : a)}
                  style={{ borderBottom:'1px solid #faf5ff', background: detail?.id===a.id ? '#faf5ff' : i%2===0?'#fff':'#fdfcff', cursor:'pointer' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:800, color:'#7e22ce', fontSize:12 }}>{a.code}</td>
                  <td style={{ padding:'9px 14px', fontWeight:500, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.designation}</td>
                  <td style={{ padding:'9px 14px', color:'#6b7280', fontSize:12 }}>{a.famille_libelle||'—'}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ fontFamily:'monospace', background:'#f5f3ff', color:'#7e22ce', padding:'2px 6px', borderRadius:4, fontSize:12, fontWeight:700 }}>
                      {a.unite_code||'—'}
                    </span>
                  </td>
                  <td style={{ padding:'9px 14px', fontWeight:600 }}>{a.poids_theorique_kg ? `${a.poids_theorique_kg} kg` : '—'}</td>
                  <td style={{ padding:'9px 14px' }}>{a.cadence_theorique_kg_h ? `${a.cadence_theorique_kg_h} kg/h` : '—'}</td>
                  <td style={{ padding:'9px 14px', fontWeight:700,
                    color: parseFloat(a.stock_mini||0) > 0 && parseFloat(a.stock_total||0) <= parseFloat(a.stock_mini||0) ? '#dc2626' : '#15803d' }}>
                    {parseFloat(a.stock_total||0).toFixed(1)}
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ background:tc.bg, color:tc.tx, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>{tc.label}</span>
                  </td>
                  <td style={{ padding:'9px 14px', color:'#6b7280', fontSize:12 }}>
                    {ateliers.find(at => String(at.id) === String(a.atelier_production_id))?.code || '—'}
                  </td>
                  <td style={{ padding:'9px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => setDetail(detail?.id===a.id ? null : a)}
                        style={{ background:'#f5f3ff', color:'#7e22ce', border:'1px solid #c4b5fd', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                        {detail?.id===a.id ? '▲' : '👁'}
                      </button>
                      <button onClick={() => modifierArticle(a)}
                        style={{ background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                        ✏ Modifier
                      </button>
                      <button onClick={async e => {
                          e.stopPropagation();
                          if (!window.confirm('Supprimer "'+a.designation+'" ?')) return;
                          try { await axios.delete(`${API}/articles/${a.id}`); toast.success('Supprimé'); setDetail(null); chargerArticles(); }
                          catch { toast.error('Erreur suppression'); }
                        }}
                        style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {articles.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#9ca3af' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
            <p style={{ fontWeight:600, color:'#6b7280' }}>Aucun article</p>
            <p style={{ fontSize:12 }}>Commencez par créer des <strong>Matières premières</strong>, puis vos <strong>Produits finis</strong></p>
            <button onClick={ouvrirFormulaire} style={{ background:'#7e22ce', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', marginTop:12, fontWeight:600 }}>
              + Créer le premier article
            </button>
          </div>
        )}
      </div>

      {/* Détail au clic */}
      {detail && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'2px solid #c4b5fd', marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:16, color:'#7e22ce' }}>{detail.code}</span>
              <span style={{ marginLeft:12, fontSize:14, fontWeight:500 }}>{detail.designation}</span>
            </div>
            <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af' }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
            {[
              ['Famille', detail.famille_libelle],
              ['Type', detail.type_article?.replace(/_/g,' ')],
              ['Unité', detail.unite_code],
              ['Poids théo.', detail.poids_theorique_kg ? detail.poids_theorique_kg+' kg' : '—'],
              ['Poids réel', detail.poids_reel_kg ? detail.poids_reel_kg+' kg' : '—'],
              ['Cadence', detail.cadence_theorique_kg_h ? detail.cadence_theorique_kg_h+' kg/h' : '—'],
              ['Dimensions', detail.longueur_mm ? `${detail.longueur_mm}×${detail.largeur_mm} mm` : '—'],
              ['Couleur', detail.couleur||'—'],
              ['Matière', detail.matiere||'—'],
              ['Prix achat', detail.prix_achat ? detail.prix_achat+' FCFA' : '—'],
              ['Prix vente', detail.prix_vente ? detail.prix_vente+' FCFA' : '—'],
              ['Cession', detail.prix_cession_interne ? detail.prix_cession_interne+' FCFA' : '—'],
              ['Stock mini', detail.stock_mini||'0'],
              ['DLC', detail.dlc_jours ? detail.dlc_jours+' j' : '—'],
              ['Normes', detail.normes_iso||'—'],
              ['CCP', detail.points_ccp ? '✓ Oui' : 'Non'],
            ].map(([l, v]) => (
              <div key={l} style={{ background:'#faf5ff', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:'#9ca3af', marginBottom:2 }}>{l}</div>
                <div style={{ fontWeight:600, fontSize:13, color:'#374151' }}>{v||'—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


function MatieresPremières() {
  const [mps, setMps] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [modeEdition, setModeEdition] = useState(false);
  const [editId, setEditId] = useState(null);
  const [files, setFiles] = useState({ fiche_technique: null, fiche_securite: null, photo: null });
  const [form, setForm] = useState({
    code:'', designation:'', famille_id:'', unite_mesure_id:'',
    type_article:'matiere_premiere',
    fournisseur:'', reference_fournisseur:'',
    couleur:'', epaisseur_mm:'',
    poids_theorique_kg:'', densite:'',
    temperature_fusion:'', temperature_traitement:'',
    prix_achat:'0', devise:'FCFA',
    stock_mini:'0', stock_maxi:'', delai_appro_jours:'14',
    dlc_jours:'', dluo_jours:'',
    temperature_stockage_min:'', temperature_stockage_max:'',
    conditions_stockage:'',
    allergenes:'', points_ccp:false,
    normes_iso:'', certifications:'',
    risques_securite:'', epi_requis:'',
    tracabilite_type:'lot', format_lot:'LOT-YYYYMMDD-001',
    notes:'',
  });

  const chargerRefs = async () => {
    try {
      const [f, u] = await Promise.all([
        axios.get(`${API}/referentiels/familles`),
        axios.get(`${API}/referentiels/unites`),
      ]);
      setFamilles(f.data);
      setUnites(u.data);
    } catch {}
  };

  const charger = async () => {
    try {
      const { data } = await axios.get(`${API}/articles?type_article=matiere_premiere${search ? `&search=${search}` : ''}`);
      setMps(data);
    } catch {}
  };

  useEffect(() => { chargerRefs(); charger(); }, [search]);

  const ouvrir = async () => {
    await chargerRefs();
    setFiles({ fiche_technique: null, fiche_securite: null, photo: null });
    setModeEdition(false);
    setEditId(null);
    setForm({ code:'', designation:'', famille_id:'', unite_mesure_id:'', type_article:'matiere_premiere', fournisseur:'', reference_fournisseur:'', couleur:'', epaisseur_mm:'', poids_theorique_kg:'', densite:'', temperature_fusion:'', temperature_traitement:'', prix_achat:'0', devise:'FCFA', stock_mini:'0', stock_maxi:'', delai_appro_jours:'14', dlc_jours:'', dluo_jours:'', temperature_stockage_min:'', temperature_stockage_max:'', conditions_stockage:'', allergenes:'', points_ccp:false, normes_iso:'', certifications:'', risques_securite:'', epi_requis:'', tracabilite_type:'lot', format_lot:'LOT-YYYYMMDD-001', notes:'' });
    setShowForm(true);
  };

  const modifierMP = async (mp) => {
    await chargerRefs();
    setFiles({ fiche_technique: null, fiche_securite: null, photo: null });
    setModeEdition(true);
    setEditId(mp.id);
    setDetail(null);
    // Remplir le formulaire avec les données existantes
    setForm({
      code: mp.code || '',
      designation: mp.designation || '',
      famille_id: mp.famille_id ? String(mp.famille_id) : '',
      unite_mesure_id: mp.unite_mesure_id ? String(mp.unite_mesure_id) : '',
      type_article: 'matiere_premiere',
      fournisseur: mp.fournisseur || '',
      reference_fournisseur: mp.reference_fournisseur || '',
      couleur: mp.couleur || '',
      epaisseur_mm: mp.epaisseur_mm || '',
      poids_theorique_kg: mp.poids_theorique_kg || '',
      densite: mp.densite || '',
      temperature_fusion: mp.temperature_fusion || '',
      temperature_traitement: mp.temperature_traitement || '',
      prix_achat: mp.prix_achat || '0',
      devise: mp.devise || 'FCFA',
      stock_mini: mp.stock_mini || '0',
      stock_maxi: mp.stock_maxi || '',
      delai_appro_jours: mp.delai_appro_jours || '14',
      dlc_jours: mp.dlc_jours || '',
      dluo_jours: mp.dluo_jours || '',
      temperature_stockage_min: mp.temperature_stockage_min || '',
      temperature_stockage_max: mp.temperature_stockage_max || '',
      conditions_stockage: mp.conditions_stockage || '',
      allergenes: mp.allergenes || '',
      points_ccp: mp.points_ccp || false,
      normes_iso: mp.normes_iso || '',
      certifications: mp.certifications || '',
      risques_securite: mp.risques_securite || '',
      epi_requis: mp.epi_requis || '',
      tracabilite_type: mp.tracabilite_type || 'lot',
      format_lot: mp.format_lot || 'LOT-YYYYMMDD-001',
      notes: mp.notes || '',
    });
    setShowForm(true);
    setTimeout(() => window.scrollTo(0, 0), 100);
  };

  const sauvegarder = async () => {
    if (!form.code.trim()) return toast.error('Code obligatoire');
    if (!form.designation.trim()) return toast.error('Désignation obligatoire');
    try {
      // JSON direct sans FormData
      const fd = {
        ...Object.fromEntries(
          Object.entries(form).filter(([k,v]) => !Array.isArray(v) && v !== undefined)
        ),
        points_ccp: !!form.points_ccp,
        composition: [],
      };
      ['poids_theorique_kg','densite','temperature_fusion','temperature_traitement',
       'prix_achat','stock_mini','stock_maxi','delai_appro_jours','dlc_jours','dluo_jours',
       'temperature_stockage_min','temperature_stockage_max'].forEach(k => {
        if (fd[k] === '') fd[k] = null;
        else if (fd[k] !== null && fd[k] !== undefined) fd[k] = parseFloat(fd[k]) || null;
      });
      ['famille_id','unite_mesure_id'].forEach(k => { if (fd[k]==='') fd[k]=null; });
      const useFormData = files.fiche_technique || files.fiche_securite || files.photo;
      let response;
      if (useFormData) {
        const formData = new FormData();
        Object.entries(fd).forEach(([k,v]) => { if(v!==null&&v!==undefined) formData.append(k,String(v)); });
        if (files.fiche_technique) formData.append('fiche_technique', files.fiche_technique);
        if (files.fiche_securite) formData.append('fiche_securite', files.fiche_securite);
        if (files.photo) formData.append('photo', files.photo);
        if (modeEdition && editId) {
          await axios.put(`${API}/articles/${editId}`, formData, { headers:{'Content-Type':'multipart/form-data'} });
        } else {
          await axios.post(`${API}/articles`, formData, { headers:{'Content-Type':'multipart/form-data'} });
        }
      } else {
        // Pas de fichier : JSON pur
        if (modeEdition && editId) {
          await axios.put(`${API}/articles/${editId}`, fd);
        } else {
          await axios.post(`${API}/articles`, fd);
        }
      }
      toast.success(modeEdition ? `✓ ${form.designation} mis à jour` : `✓ Matière première ${form.code} créée`);
      setShowForm(false);
      setModeEdition(false);
      setEditId(null);
      charger();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // Utilise InputField, SelectField, FileField définis globalement

  const TYPES_MP = {
    plastique:   { bg:'#dbeafe', tx:'#1d4ed8' },
    colorant:    { bg:'#fce7f3', tx:'#9d174d' },
    additif:     { bg:'#fef3c7', tx:'#92400e' },
    chimique:    { bg:'#fee2e2', tx:'#dc2626' },
    emballage:   { bg:'#f3e8ff', tx:'#7e22ce' },
    autre:       { bg:'#f3f4f6', tx:'#374151' },
  };

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Code, désignation, fournisseur..."
          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'9px 14px', fontSize:13 }}/>
        <button onClick={ouvrir}
          style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }}>
          + Nouvelle matière première
        </button>
      </div>

      {/* ══ FORMULAIRE ══ */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #93c5fd', marginBottom:20 }}>
          <div style={{ background:'linear-gradient(135deg,#1d4ed8,#0369a1)', padding:'14px 24px', borderRadius:'12px 12px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>{modeEdition ? '✏ Modifier Matière Première' : '🧪 Nouvelle Matière Première'}</span>
            <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:6, padding:'4px 12px', cursor:'pointer' }}>✕</button>
          </div>

          <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>

            {/* BLOC 1 — Identification */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #bfdbfe', paddingBottom:6, marginBottom:14 }}>
                1 · Identification & Fournisseur
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:12 }}>
                <InputField label="Code *" value={form.code} onChange={e => setForm({...form,code:e.target.value})} placeholder="MP-PP-001"/>
                <InputField label="Désignation *" value={form.designation} onChange={e => setForm({...form,designation:e.target.value})} placeholder="Granulés PP Homopolymère"/>
                <SelectField label="Famille" value={form.famille_id} onChange={e => setForm({...form,famille_id:e.target.value})}
                  options={familles.length ? familles.map(f => ({ v:String(f.id), l:f.libelle })) : [{v:'',l:'⚠ Créez des familles'}]}/>
                <SelectField label="Unité de mesure" value={form.unite_mesure_id} onChange={e => setForm({...form,unite_mesure_id:e.target.value})}
                  options={unites.length ? unites.map(u => ({ v:String(u.id), l:`${u.code} — ${u.libelle}` })) : [{v:'',l:'⚠ Activez des unités'}]}/>
                <InputField label="Fournisseur" value={form.fournisseur} onChange={e => setForm({...form,fournisseur:e.target.value})} placeholder="Nom du fournisseur"/>
                <InputField label="Réf. fournisseur" value={form.reference_fournisseur} onChange={e => setForm({...form,reference_fournisseur:e.target.value})} placeholder="REF-FOUR-001"/>
                <SelectField label="Traçabilité" value={form.tracabilite_type} onChange={e => setForm({...form,tracabilite_type:e.target.value})}
                  options={[
                    { v:'lot', l:'Par numéro de lot' },
                    { v:'serie', l:'Par numéro de série' },
                    { v:'aucune', l:'Aucune' },
                  ]}/>
                <InputField label="Format n° lot" value={form.format_lot} onChange={e => setForm({...form,format_lot:e.target.value})} placeholder="LOT-YYYYMMDD-001"/>
              </div>
            </div>

            {/* BLOC 2 — Caractéristiques techniques */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#0369a1', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #bae6fd', paddingBottom:6, marginBottom:14 }}>
                2 · Caractéristiques techniques
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
                <InputField label="Couleur / Aspect" value={form.couleur} onChange={e => setForm({...form,couleur:e.target.value})} placeholder="Naturel, Blanc..."/>
                <InputField label="Densité (g/cm³)" value={form.densite} onChange={e => setForm({...form,densite:e.target.value})} type="number" placeholder="0.900"/>
                <InputField label="Poids unitaire (kg)" value={form.poids_theorique_kg} onChange={e => setForm({...form,poids_theorique_kg:e.target.value})} type="number" placeholder="0.000"/>
                <InputField label="Cadence standard (pcs/h)" value={form.cadence_heure} onChange={e => setForm({...form,cadence_heure:e.target.value})} type="number" placeholder="Ex: 500"/>
                <InputField label="Temps cycle (min)" value={form.temps_cycle_min} onChange={e => setForm({...form,temps_cycle_min:e.target.value})} type="number" placeholder="Ex: 0.12"/>
                <InputField label="Temps réglage (min)" value={form.temps_reglage_min} onChange={e => setForm({...form,temps_reglage_min:e.target.value})} type="number" placeholder="30"/>
                <InputField label="Conso MP/pièce (kg)" value={form.conso_mp_kg} onChange={e => setForm({...form,conso_mp_kg:e.target.value})} type="number" placeholder="0.000"/>
                <InputField label="Taux rebut std (%)" value={form.taux_rebut_std} onChange={e => setForm({...form,taux_rebut_std:e.target.value})} type="number" placeholder="2.0"/>
                <InputField label="Épaisseur (mm)" value={form.epaisseur_mm} onChange={e => setForm({...form,epaisseur_mm:e.target.value})} type="number" placeholder="0.00"/>
                <InputField label="Temp. fusion (°C)" value={form.temperature_fusion} onChange={e => setForm({...form,temperature_fusion:e.target.value})} type="number" placeholder="165"/>
                <InputField label="Temp. traitement (°C)" value={form.temperature_traitement} onChange={e => setForm({...form,temperature_traitement:e.target.value})} type="number" placeholder="220"/>
              </div>
            </div>

            {/* BLOC 3 — Stockage & Qualité */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#15803d', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #bbf7d0', paddingBottom:6, marginBottom:14 }}>
                3 · Stockage, Conservation & Qualité
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
                <InputField label="Prix achat (FCFA/unité)" value={form.prix_achat} onChange={e => setForm({...form,prix_achat:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Stock minimum" value={form.stock_mini} onChange={e => setForm({...form,stock_mini:e.target.value})} type="number" placeholder="0"/>
                <InputField label="Stock maximum" value={form.stock_maxi} onChange={e => setForm({...form,stock_maxi:e.target.value})} type="number"/>
                <InputField label="Délai appro. (jours)" value={form.delai_appro_jours} onChange={e => setForm({...form,delai_appro_jours:e.target.value})} type="number" placeholder="14"/>
                <InputField label="DLC (jours)" value={form.dlc_jours} onChange={e => setForm({...form,dlc_jours:e.target.value})} type="number" note="si périssable"/>
                <InputField label="DLUO (jours)" value={form.dluo_jours} onChange={e => setForm({...form,dluo_jours:e.target.value})} type="number" note="date limite utilisation"/>
                <InputField label="Temp. stockage min (°C)" value={form.temperature_stockage_min} onChange={e => setForm({...form,temperature_stockage_min:e.target.value})} type="number"/>
                <InputField label="Temp. stockage max (°C)" value={form.temperature_stockage_max} onChange={e => setForm({...form,temperature_stockage_max:e.target.value})} type="number"/>
              </div>
              <div style={{ marginTop:12 }}>
                <InputField label="Conditions de stockage" value={form.conditions_stockage} onChange={e => setForm({...form,conditions_stockage:e.target.value})} placeholder="À l"/>
              </div>
              <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <InputField label="Normes / Certifications" value={form.normes_iso} onChange={e => setForm({...form,normes_iso:e.target.value})} placeholder="ISO 9001, REACH, RoHS..."/>
                <InputField label="Certifications qualité" value={form.certifications} onChange={e => setForm({...form,certifications:e.target.value})} placeholder="COA, COC, FDA..."/>
              </div>
            </div>

            {/* BLOC 4 — Sécurité (QHSE) */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #fecaca', paddingBottom:6, marginBottom:14 }}>
                4 · Sécurité & QHSE
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <InputField label="Risques sécurité / Mentions H" value={form.risques_securite} onChange={e => setForm({...form,risques_securite:e.target.value})} placeholder="H351: Susceptible de provoquer le cancer..."/>
                </div>
                <div>
                  <InputField label="EPI requis" value={form.epi_requis} onChange={e => setForm({...form,epi_requis:e.target.value})} placeholder="Gants nitrile, lunettes, masque FFP2..."/>
                </div>
                <div>
                  <InputField label="Allergènes (alimentaire)" value={form.allergenes} onChange={e => setForm({...form,allergenes:e.target.value})} placeholder="Gluten, Lait, Arachides..."/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:20 }}>
                  <input type="checkbox" id="chk-mp-ccp" checked={!!form.points_ccp}
                    onChange={e => setForm({...form, points_ccp:e.target.checked})}
                    style={{ width:16, height:16, cursor:'pointer' }}/>
                  <label htmlFor="chk-mp-ccp" style={{ fontSize:13, cursor:'pointer' }}>
                    Point Critique de Contrôle (CCP) — HACCP
                  </label>
                </div>
              </div>
              <div style={{ marginTop:12 }}>
                <InputField label="Notes / Observations" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Informations complémentaires..."/>
              </div>
            </div>

            {/* BLOC 5 — Documents */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', letterSpacing:1, textTransform:'uppercase', borderBottom:'2px solid #e5e7eb', paddingBottom:6, marginBottom:14 }}>
                5 · Documents techniques
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                <FileField label="Fiche Technique (TDS)" file={files.fiche_technique} onFile={f => setFiles({...files,fiche_technique:f})} accept=".pdf,.doc,.docx" icon="📄"/>
                <FileField label="Fiche de Sécurité (FDS/SDS)" file={files.fiche_securite} onFile={f => setFiles({...files,fiche_securite:f})} accept=".pdf,.doc,.docx" icon="⚠"/>
                <FileField label="Photo / Image" file={files.photo} onFile={f => setFiles({...files,photo:f})} accept=".jpg,.jpeg,.png,.webp" icon="🖼"/>
              </div>
              <div style={{ marginTop:10, background:'#f0fdf4', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#15803d' }}>
                💡 La fiche de sécurité (FDS) est obligatoire pour les matières dangereuses — REACH, CLP. La fiche technique (TDS) contient les paramètres de mise en œuvre.
              </div>
            </div>

            {/* Boutons */}
            <div style={{ display:'flex', gap:12, paddingTop:16, borderTop:'2px solid #f3f4f6' }}>
              <button onClick={sauvegarder}
                style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'13px 36px', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:15 }}>
                {modeEdition ? '✓ Enregistrer les modifications' : '✓ Créer la matière première'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'13px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LISTE MATIÈRES ══ */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
          <thead>
            <tr style={{ background:'#eff6ff' }}>
              {['Code','Désignation','Fournisseur','Unité','Prix achat','Stock','Temp. fusion','Docs','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#1d4ed8', borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mps.map((m, i) => (
              <tr key={m.id}
                style={{ borderBottom:'1px solid #eff6ff', background: detail?.id===m.id ? '#eff6ff' : i%2===0?'#fff':'#f8faff', cursor:'pointer' }}
                onClick={() => setDetail(detail?.id === m.id ? null : m)}>
                <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:800, color:'#1d4ed8', fontSize:12 }}>{m.code}</td>
                <td style={{ padding:'9px 14px', fontWeight:500 }}>{m.designation}</td>
                <td style={{ padding:'9px 14px', color:'#6b7280', fontSize:12 }}>{m.fournisseur||'—'}</td>
                <td style={{ padding:'9px 14px' }}>
                  <span style={{ fontFamily:'monospace', background:'#dbeafe', color:'#1d4ed8', padding:'2px 6px', borderRadius:4, fontSize:12, fontWeight:700 }}>
                    {m.unite_code||'—'}
                  </span>
                </td>
                <td style={{ padding:'9px 14px', fontWeight:600 }}>{m.prix_achat ? `${m.prix_achat} FCFA` : '—'}</td>
                <td style={{ padding:'9px 14px', fontWeight:700,
                  color: parseFloat(m.stock_mini||0) > 0 && parseFloat(m.stock_total||0) <= parseFloat(m.stock_mini||0) ? '#dc2626' : '#15803d' }}>
                  {parseFloat(m.stock_total||0).toFixed(1)}
                </td>
                <td style={{ padding:'9px 14px', color:'#6b7280' }}>
                  {m.temperature_fusion ? `${m.temperature_fusion}°C` : '—'}
                </td>
                <td style={{ padding:'9px 14px' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    {m.fiche_technique_path && (
                      <a href={m.fiche_technique_path} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ background:'#dbeafe', color:'#1d4ed8', padding:'2px 8px', borderRadius:6, fontSize:11, textDecoration:'none', fontWeight:600 }}>
                        📄 TDS
                      </a>
                    )}
                    {m.fiche_securite_path && (
                      <a href={m.fiche_securite_path} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 8px', borderRadius:6, fontSize:11, textDecoration:'none', fontWeight:600 }}>
                        ⚠ FDS
                      </a>
                    )}
                  </div>
                </td>
                <td style={{ padding:'9px 14px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={e => { e.stopPropagation(); setDetail(detail?.id===m.id ? null : m); }}
                      style={{ background:'#dbeafe', color:'#1d4ed8', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      {detail?.id===m.id ? '▲ Fermer' : '▼ Voir'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); modifierMP(m); }}
                      style={{ background:'#fef3c7', color:'#92400e', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      ✏ Modifier
                    </button>
                    <button onClick={async e => {
                        e.stopPropagation();
                        if (!window.confirm('Supprimer "'+m.designation+'" ?')) return;
                        try { await axios.delete(`${API}/articles/${m.id}`); toast.success('Supprimé'); setDetail(null); charger(); }
                        catch { toast.error('Erreur suppression'); }
                      }}
                      style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      ✕ Suppr.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {mps.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#9ca3af' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🧪</div>
            <p style={{ fontWeight:600, color:'#6b7280' }}>Aucune matière première</p>
            <p style={{ fontSize:12 }}>Créez vos matières premières : granulés, colorants, additifs, emballages...</p>
            <button onClick={ouvrir} style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', marginTop:12, fontWeight:600 }}>
              + Créer la première
            </button>
          </div>
        )}
      </div>

      {/* Détail matière */}
      {detail && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'2px solid #93c5fd', marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:16, color:'#1d4ed8' }}>{detail.code}</span>
              <span style={{ marginLeft:12, fontSize:14, fontWeight:500 }}>{detail.designation}</span>
            </div>
            <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af' }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:14 }}>
            {[
              ['Fournisseur', detail.fournisseur],
              ['Réf. fournisseur', detail.reference_fournisseur],
              ['Unité', detail.unite_code],
              ['Densité', detail.densite ? detail.densite+' g/cm³' : null],
              ['Poids unitaire', detail.poids_theorique_kg ? detail.poids_theorique_kg+' kg' : null],
              ['Temp. fusion', detail.temperature_fusion ? detail.temperature_fusion+'°C' : null],
              ['Temp. traitement', detail.temperature_traitement ? detail.temperature_traitement+'°C' : null],
              ['Couleur', detail.couleur],
              ['Prix achat', detail.prix_achat ? detail.prix_achat+' FCFA' : null],
              ['Stock mini', detail.stock_mini||'0'],
              ['Délai appro.', detail.delai_appro_jours ? detail.delai_appro_jours+' j' : null],
              ['DLC', detail.dlc_jours ? detail.dlc_jours+' j' : null],
              ['Temp. stockage', detail.temperature_stockage_min ? `${detail.temperature_stockage_min}→${detail.temperature_stockage_max}°C` : null],
              ['Normes', detail.normes_iso],
              ['Certifications', detail.certifications],
              ['EPI requis', detail.epi_requis],
              ['CCP HACCP', detail.points_ccp ? '✓ Oui' : 'Non'],
              ['Traçabilité', detail.tracabilite_type],
            ].filter(([,v]) => v).map(([l, v]) => (
              <div key={l} style={{ background:'#eff6ff', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:'#93c5fd', marginBottom:2 }}>{l}</div>
                <div style={{ fontWeight:600, fontSize:12, color:'#1d4ed8' }}>{v}</div>
              </div>
            ))}
          </div>
          {detail.risques_securite && (
            <div style={{ background:'#fef2f2', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#dc2626', marginBottom:10 }}>
              <strong>⚠ Risques sécurité :</strong> {detail.risques_securite}
            </div>
          )}
          {detail.conditions_stockage && (
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#15803d' }}>
              <strong>📦 Conditions stockage :</strong> {detail.conditions_stockage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function BonsCession() {
  const [bons, setBons] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [lignes, setLignes] = useState([{ article_id:'', designation:'', qte_prevue:'', unite_id:'', poids_theorique_kg:'', notes:'' }]);
  const [form, setForm] = useState({
    type_mouvement:'cession_interne',
    atelier_source_id:'', atelier_dest_id:'',
    date_mouvement: new Date().toISOString().split('T')[0],
    demandeur:'', destinataire:'', motif:'', notes:''
  });

  const TYPE_LABELS = {
    cession_interne: '🔄 Cession interne',
    retour_production: '↩ Retour production',
    transfert_mp: '📦 Transfert MP',
    livraison_interne: '🚚 Livraison interne',
  };

  const STATUT_COLORS = {
    brouillon:   { bg:'#f3f4f6', tx:'#6b7280' },
    valide:      { bg:'#dcfce7', tx:'#15803d' },
    receptionne: { bg:'#dbeafe', tx:'#1d4ed8' },
    annule:      { bg:'#fee2e2', tx:'#dc2626' },
  };

  const charger = async () => {
    try {
      const [m, a, arts] = await Promise.all([
        axios.get(`${API}/mouvements${filtreStatut ? `?statut=${filtreStatut}` : ''}`),
        axios.get(`${API}/ateliers`),
        axios.get(`${API}/articles`),
      ]);
      setBons(m.data); setAteliers(a.data); setArticles(arts.data);
    } catch {}
  };

  useEffect(() => { charger(); }, [filtreStatut]);

  const creer = async () => {
    const lignesValides = lignes.filter(l => l.article_id && l.qte_prevue);
    if (!lignesValides.length) return toast.error('Ajoutez au moins une ligne');
    if (!form.atelier_source_id || !form.atelier_dest_id) return toast.error('Source et destination requises');
    try {
      await axios.post(`${API}/mouvements`, { ...form, lignes: lignesValides });
      toast.success('Bon de cession créé');
      setShowForm(false);
      setLignes([{ article_id:'', designation:'', qte_prevue:'', unite_id:'', poids_theorique_kg:'', notes:'' }]);
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
  };

  const valider = async (id) => {
    try {
      await axios.put(`${API}/mouvements/${id}/valider`);
      toast.success('Bon validé ✓');
      charger();
      if (detail?.id === id) setDetail({ ...detail, statut:'valide' });
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur validation'); }
  };

  const receptionner = async (id) => {
    try {
      await axios.put(`${API}/mouvements/${id}/receptionner`);
      toast.success('Réception confirmée ✓');
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
  };

  const voirDetail = async (bon) => {
    try {
      const { data } = await axios.get(`${API}/mouvements/${bon.id}`);
      setDetail(data);
    } catch { setDetail(bon); }
  };

  const imprimer = (bon) => {
    const lignesHtml = (bon.lignes || []).map(l => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-weight:bold">${l.article_code || '—'}</td>
        <td style="padding:8px;border:1px solid #ddd">${l.designation || l.article_designation || '—'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${l.unite_code || l.unite || '—'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:bold;font-size:14px">${parseFloat(l.qte_prevue||0).toFixed(3)}</td>
        <td style="padding:8px;border:1px solid #ddd;color:#666">${l.notes||'—'}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Bon de Cession ${bon.numero_bon}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 3px solid #4338ca; padding-bottom: 16px; }
        .title { font-size: 22px; font-weight: bold; color: #4338ca; }
        .subtitle { font-size: 13px; color: #666; margin-top: 4px; }
        .numero { font-size: 18px; font-weight: bold; color: #4338ca; text-align: right; }
        .date { font-size: 12px; color: #666; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8f9ff; padding: 16px; border-radius: 8px; }
        .info-item label { font-size: 11px; color: #666; font-weight: bold; text-transform: uppercase; }
        .info-item p { margin: 4px 0 0; font-size: 14px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead tr { background: #4338ca; color: white; }
        thead th { padding: 10px; text-align: left; font-size: 12px; }
        tbody tr:nth-child(even) { background: #f8f9ff; }
        .statut { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #dcfce7; color: #15803d; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; }
        .sig-box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; text-align: center; }
        .sig-box label { font-size: 11px; color: #666; font-weight: bold; }
        .sig-line { border-top: 1px solid #333; margin-top: 40px; }
        .footer { text-align: center; font-size: 11px; color: #999; margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; }
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="title">GREEN INDUSTRY</div>
          <div class="subtitle">BON DE CESSION / MOUVEMENT INTER-ATELIERS</div>
        </div>
        <div>
          <div class="numero">${bon.numero_bon}</div>
          <div class="date">Date : ${new Date(bon.date_mouvement||bon.created_at).toLocaleDateString('fr-FR')}</div>
          <div class="date">Statut : <span class="statut">${bon.statut?.toUpperCase()}</span></div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <label>Type de mouvement</label>
          <p>${TYPE_LABELS[bon.type_mouvement] || bon.type_mouvement}</p>
        </div>
        <div class="info-item">
          <label>Date</label>
          <p>${new Date(bon.date_mouvement||bon.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div class="info-item">
          <label>Atelier source</label>
          <p>${bon.source_code || '—'} — ${bon.source_libelle || '—'}</p>
        </div>
        <div class="info-item">
          <label>Atelier destination</label>
          <p>${bon.dest_code || '—'} — ${bon.dest_libelle || '—'}</p>
        </div>
        ${bon.demandeur ? `<div class="info-item"><label>Demandeur</label><p>${bon.demandeur}</p></div>` : ''}
        ${bon.destinataire ? `<div class="info-item"><label>Destinataire</label><p>${bon.destinataire}</p></div>` : ''}
        ${bon.motif ? `<div class="info-item" style="grid-column:1/-1"><label>Motif</label><p>${bon.motif}</p></div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Désignation</th>
            <th>Unité</th>
            <th>Quantité</th>
            <th>Observations</th>
          </tr>
        </thead>
        <tbody>${lignesHtml}</tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">
          <label>RESPONSABLE ATELIER EXPÉDITEUR</label>
          <p style="font-size:12px;font-weight:bold;margin:8px 0 4px">${bon.demandeur || '.................................'}</p>
          <div class="sig-line"></div>
          <p style="font-size:11px;color:#666;margin-top:4px">Signature électronique / Cachet</p>
        </div>
        <div class="sig-box">
          <label>RESPONSABLE RÉCEPTIONNAIRE</label>
          <p style="font-size:12px;font-weight:bold;margin:8px 0 4px">${bon.destinataire || '.................................'}</p>
          <div class="sig-line"></div>
          <p style="font-size:11px;color:#666;margin-top:4px">Signature électronique / Cachet</p>
        </div>
      </div>

      ${bon.notes ? `<p style="margin-top:20px;padding:12px;background:#fffbeb;border-radius:8px;font-size:13px"><strong>Notes :</strong> ${bon.notes}</p>` : ''}

      <div class="footer">
        NAIdo ERP/MES — NAI © ${new Date().getFullYear()} — Document généré le ${new Date().toLocaleString('fr-FR')}
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  return (
    <div>
      {/* Header + filtres */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:0 }}>
          {['','brouillon','valide','receptionne','annule'].map(s => (
            <button key={s} onClick={() => { setFiltreStatut(s); setDetail(null); }} style={{
              padding:'7px 14px', border:'1px solid #e5e7eb',
              background: filtreStatut===s ? '#4338ca' : '#fff',
              color: filtreStatut===s ? '#fff' : '#6b7280',
              cursor:'pointer', fontSize:12, fontWeight: filtreStatut===s ? 700 : 400,
              borderRadius: s==='' ? '8px 0 0 8px' : s==='annule' ? '0 8px 8px 0' : '0'
            }}>
              {s || 'Tous'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background:'#4338ca', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, cursor:'pointer', fontWeight:700, marginLeft:'auto' }}>
          + Nouveau bon de cession
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #a5b4fc', marginBottom:16 }}>
          <div style={{ background:'linear-gradient(135deg,#4338ca,#6366f1)', padding:'14px 24px', borderRadius:'12px 12px 0 0', display:'flex', justifyContent:'space-between' }}>
            <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>🔄 Nouveau Bon de Cession</span>
            <button onClick={() => setShowForm(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:6, padding:'4px 12px', cursor:'pointer' }}>✕</button>
          </div>
          <div style={{ padding:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Type de mouvement</label>
                <select value={form.type_mouvement} onChange={e => setForm({...form,type_mouvement:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                  {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Atelier Source *</label>
                <select value={form.atelier_source_id} onChange={e => setForm({...form,atelier_source_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                  <option value="">-- Sélectionner --</option>
                  {ateliers.map(a => <option key={a.id} value={a.id}>{a.code} — {a.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Atelier Destination *</label>
                <select value={form.atelier_dest_id} onChange={e => setForm({...form,atelier_dest_id:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                  <option value="">-- Sélectionner --</option>
                  {ateliers.map(a => <option key={a.id} value={a.id}>{a.code} — {a.libelle}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Date</label>
                <input type="date" value={form.date_mouvement} onChange={e => setForm({...form,date_mouvement:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Demandeur</label>
                <input value={form.demandeur} onChange={e => setForm({...form,demandeur:e.target.value})}
                  placeholder="Nom du demandeur"
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Destinataire</label>
                <input value={form.destinataire} onChange={e => setForm({...form,destinataire:e.target.value})}
                  placeholder="Nom du destinataire"
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Motif / Objet</label>
                <input value={form.motif} onChange={e => setForm({...form,motif:e.target.value})}
                  placeholder="Ex: Approvisionnement production semaine 18"
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
            </div>

            {/* Lignes articles */}
            <div style={{ background:'#f8f9ff', borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontWeight:700, color:'#4338ca', fontSize:13 }}>Articles à céder</span>
                <button onClick={() => setLignes([...lignes, { article_id:'', designation:'', qte_prevue:'', unite_id:'', poids_theorique_kg:'', notes:'' }])}
                  style={{ background:'#4338ca', color:'#fff', border:'none', padding:'5px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  + Ajouter ligne
                </button>
              </div>
              {lignes.map((l, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'end' }}>
                  <div>
                    <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Article</label>
                    <select value={l.article_id} onChange={e => {
                      const art = articles.find(a => a.id === e.target.value);
                      const nl = [...lignes];
                      nl[i] = { ...nl[i], article_id:e.target.value, designation:art?.designation||'', poids_theorique_kg:art?.poids_theorique_kg||'' };
                      setLignes(nl);
                    }} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px', fontSize:12 }}>
                      <option value="">-- Article --</option>
                      {articles.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Quantité</label>
                    <input type="number" value={l.qte_prevue} onChange={e => { const nl=[...lignes]; nl[i]={...nl[i],qte_prevue:e.target.value}; setLignes(nl); }}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px', fontSize:12, textAlign:'center', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Poids (kg)</label>
                    <input type="number" value={l.poids_theorique_kg} onChange={e => { const nl=[...lignes]; nl[i]={...nl[i],poids_theorique_kg:e.target.value}; setLignes(nl); }}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px', fontSize:12, textAlign:'center', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:'#6b7280', display:'block', marginBottom:2 }}>Obs.</label>
                    <input value={l.notes||''} onChange={e => { const nl=[...lignes]; nl[i]={...nl[i],notes:e.target.value}; setLignes(nl); }}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px', fontSize:12, boxSizing:'border-box' }}/>
                  </div>
                  <button onClick={() => setLignes(lignes.filter((_,j) => j!==i))}
                    style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'8px 10px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={creer}
                style={{ background:'#4338ca', color:'#fff', border:'none', padding:'12px 32px', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:14 }}>
                ✓ Créer le bon
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background:'#f3f4f6', border:'none', padding:'12px 20px', borderRadius:10, cursor:'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Détail bon sélectionné */}
      {detail && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #a5b4fc', marginBottom:16, padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:16, color:'#4338ca' }}>{detail.numero_bon}</span>
              <span style={{ marginLeft:10, fontSize:12, background: STATUT_COLORS[detail.statut]?.bg, color: STATUT_COLORS[detail.statut]?.tx, padding:'2px 10px', borderRadius:20, fontWeight:700 }}>
                {detail.statut}
              </span>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {detail.statut === 'brouillon' && (
                <button onClick={() => valider(detail.id)}
                  style={{ background:'#dcfce7', color:'#15803d', border:'none', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
                  ✓ Valider
                </button>
              )}
              {detail.statut === 'valide' && (
                <button onClick={() => receptionner(detail.id)}
                  style={{ background:'#dbeafe', color:'#1d4ed8', border:'none', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
                  📥 Réceptionner
                </button>
              )}
              <button onClick={() => imprimer(detail)}
                style={{ background:'#4338ca', color:'#fff', border:'none', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
                🖨 Imprimer
              </button>
              <button onClick={() => setDetail(null)}
                style={{ background:'#f3f4f6', border:'none', padding:'7px 14px', borderRadius:8, cursor:'pointer', color:'#6b7280' }}>✕</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
            {[
              ['Type', TYPE_LABELS[detail.type_mouvement] || detail.type_mouvement],
              ['Source', `${detail.source_code||''} — ${detail.source_libelle||''}`],
              ['Destination', `${detail.dest_code||''} — ${detail.dest_libelle||''}`],
              ['Date', detail.date_mouvement ? new Date(detail.date_mouvement).toLocaleDateString('fr-FR') : '—'],
              ['Demandeur', detail.demandeur],
              ['Destinataire', detail.destinataire],
              ['Motif', detail.motif],
              ['Poids total', detail.poids_total_kg ? `${detail.poids_total_kg} kg` : null],
            ].filter(([,v]) => v).map(([l,v]) => (
              <div key={l} style={{ background:'#f0f4ff', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:'#818cf8', marginBottom:2 }}>{l}</div>
                <div style={{ fontWeight:600, fontSize:12, color:'#4338ca' }}>{v}</div>
              </div>
            ))}
          </div>
          {detail.lignes?.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#eef2ff' }}>
                  {['Code','Article','Unité','Quantité','Obs.'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:700, color:'#4338ca', borderBottom:'2px solid #c7d2fe' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.lignes.map((l, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #eef2ff', background: i%2===0?'#fff':'#f8f9ff' }}>
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', color:'#4338ca', fontWeight:700 }}>{l.article_code || '—'}</td>
                    <td style={{ padding:'8px 12px' }}>{l.designation || l.article_designation || '—'}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>{l.unite_code || l.unite || '—'}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, fontSize:14 }}>{parseFloat(l.qte_prevue||0).toFixed(3)}</td>
                    <td style={{ padding:'8px 12px', color:'#6b7280' }}>{l.notes||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Liste bons */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
          <thead>
            <tr style={{ background:'#eef2ff' }}>
              {['N° Bon','Type','Source → Destination','Date','Articles','Statut','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#4338ca', borderBottom:'2px solid #c7d2fe', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bons.map((b, i) => {
              const sc = STATUT_COLORS[b.statut] || STATUT_COLORS.brouillon;
              return (
                <tr key={b.id} style={{ borderBottom:'1px solid #eef2ff', background: i%2===0?'#fff':'#f8f9ff', cursor:'pointer' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:800, color:'#4338ca', fontSize:12 }}>{b.numero_bon}</td>
                  <td style={{ padding:'9px 14px', fontSize:12 }}>{TYPE_LABELS[b.type_mouvement] || b.type_mouvement}</td>
                  <td style={{ padding:'9px 14px', fontSize:12 }}>
                    <span style={{ fontWeight:600 }}>{b.source_code || '—'}</span>
                    <span style={{ color:'#9ca3af', margin:'0 6px' }}>→</span>
                    <span style={{ fontWeight:600 }}>{b.dest_code || '—'}</span>
                  </td>
                  <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280' }}>
                    {b.date_mouvement ? new Date(b.date_mouvement).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ padding:'9px 14px', textAlign:'center' }}>
                    <span style={{ background:'#e0e7ff', color:'#4338ca', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {b.nb_lignes || 0}
                    </span>
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ background:sc.bg, color:sc.tx, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {b.statut}
                    </span>
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => voirDetail(b)}
                        style={{ background:'#e0e7ff', color:'#4338ca', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                        👁 Voir
                      </button>
                      <button onClick={() => imprimer(b)}
                        style={{ background:'#f5f3ff', color:'#6d28d9', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                        🖨
                      </button>
                      {b.statut === 'brouillon' && (
                        <button onClick={() => valider(b.id)}
                          style={{ background:'#dcfce7', color:'#15803d', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                          ✓
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bons.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#9ca3af' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔄</div>
            <p style={{ fontWeight:600 }}>Aucun bon de cession</p>
            <p style={{ fontSize:12 }}>Créez un bon pour tracer les mouvements inter-ateliers</p>
            <button onClick={() => setShowForm(true)}
              style={{ background:'#4338ca', color:'#fff', border:'none', padding:'10px 24px', borderRadius:8, cursor:'pointer', marginTop:12, fontWeight:600 }}>
              + Créer le premier bon
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QHSE() {
  const [onglet, setOnglet] = useState('dashboard');
  const [dashboard, setDashboard] = useState({});
  const [processus, setProcessus] = useState([]);
  const [ncs, setNcs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [audits, setAudits] = useState([]);
  const [risques, setRisques] = useState([]);
  const [indicateurs, setIndicateurs] = useState([]);
  const [accidents, setAccidents] = useState([]);
  const [habilitations, setHabilitations] = useState([]);
  const [normes, setNormes] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [form, setForm] = useState({});
  const [detail, setDetail] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreNorme, setFiltreNorme] = useState('');

  const charger = async () => {
    try { const {data} = await axios.get(`${API}/qhse/dashboard`); setDashboard(data); } catch {}
    try { const {data} = await axios.get(`${API}/qhse/normes`); setNormes(data); } catch {}
    try { const {data} = await axios.get(`${API}/users`); setUtilisateurs(data); } catch {}
    try { const {data} = await axios.get(`${API}/ateliers`); setAteliers(data); } catch {}
  };

  const chargerOnglet = async (tab) => {
    setOnglet(tab);
    try {
      if (tab === 'processus') { const {data} = await axios.get(`${API}/qhse/processus`); setProcessus(data); }
      else if (tab === 'nc') { const {data} = await axios.get(`${API}/qhse/nc${filtreStatut?`?statut=${filtreStatut}`:''}`); setNcs(data); }
      else if (tab === 'documents') { const {data} = await axios.get(`${API}/qhse/documents`); setDocuments(data); }
      else if (tab === 'audits') { const {data} = await axios.get(`${API}/qhse/audits`); setAudits(data); }
      else if (tab === 'risques') { const {data} = await axios.get(`${API}/qhse/risques`); setRisques(data); }
      else if (tab === 'indicateurs') { const {data} = await axios.get(`${API}/qhse/indicateurs`); setIndicateurs(data); }
      else if (tab === 'sst') { const {data} = await axios.get(`${API}/qhse/accidents`); setAccidents(data); }
      else if (tab === 'habilitations') { const {data} = await axios.get(`${API}/qhse/habilitations`); setHabilitations(data); }
    } catch(e) { toast.error('Erreur chargement: ' + e.message); }
  };

  useEffect(() => { charger(); chargerOnglet('dashboard'); }, []);

  const ouvrir = (type, data={}) => { setFormType(type); setForm(data); setShowForm(true); };

  const sauvegarder = async () => {
    try {
      const urls = {
        processus: '/qhse/processus', nc: '/qhse/nc',
        document: '/qhse/documents', audit: '/qhse/audits',
        risque: '/qhse/risques', indicateur: '/qhse/indicateurs',
        accident: '/qhse/accidents', habilitation: '/qhse/habilitations'
      };
      const url = urls[formType];
      if (!url) return;
      if (form.id) await axios.put(`${API}${url}/${form.id}`, form);
      else await axios.post(`${API}${url}`, form);
      toast.success('Enregistré ✓');
      setShowForm(false);
      chargerOnglet(
        formType === 'nc' ? 'nc' :
        formType === 'document' ? 'documents' :
        formType === 'audit' ? 'audits' :
        formType === 'risque' ? 'risques' :
        formType === 'indicateur' ? 'indicateurs' :
        formType === 'accident' ? 'sst' :
        formType === 'habilitation' ? 'habilitations' : 'processus'
      );
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
  };

  const NORMES_COLORS = {
    ISO9001:   { bg:'#dbeafe', tx:'#1d4ed8' },
    ISO14001:  { bg:'#dcfce7', tx:'#15803d' },
    ISO45001:  { bg:'#fef3c7', tx:'#92400e' },
    FSSC22000: { bg:'#fce7f3', tx:'#9d174d' },
  };

  const GRAVITE_COLORS = {
    observation: { bg:'#f3f4f6', tx:'#6b7280' },
    mineure:     { bg:'#fef3c7', tx:'#92400e' },
    majeure:     { bg:'#fed7aa', tx:'#c2410c' },
    critique:    { bg:'#fee2e2', tx:'#dc2626' },
  };

  const STATUT_COLORS = {
    ouverte:        { bg:'#fee2e2', tx:'#dc2626' },
    en_cours:       { bg:'#fef3c7', tx:'#92400e' },
    en_verification:{ bg:'#dbeafe', tx:'#1d4ed8' },
    clos:           { bg:'#dcfce7', tx:'#15803d' },
    planifie:       { bg:'#f3f4f6', tx:'#6b7280' },
    realise:        { bg:'#dcfce7', tx:'#15803d' },
    approuve:       { bg:'#dcfce7', tx:'#15803d' },
    brouillon:      { bg:'#f3f4f6', tx:'#6b7280' },
    identifie:      { bg:'#fef3c7', tx:'#92400e' },
    traite:         { bg:'#dcfce7', tx:'#15803d' },
  };

  const NormesBadges = ({normes_applicables}) => {
    const ns = Array.isArray(normes_applicables) ? normes_applicables : [];
    return (
      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
        {ns.map(n => {
          const c = NORMES_COLORS[n] || {bg:'#f3f4f6',tx:'#374151'};
          return <span key={n} style={{background:c.bg,color:c.tx,padding:'1px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{n}</span>;
        })}
      </div>
    );
  };

  const IPRBadge = ({ipr}) => {
    const v = parseInt(ipr||0);
    const c = v >= 100 ? '#dc2626' : v >= 50 ? '#d97706' : v >= 20 ? '#f59e0b' : '#15803d';
    return <span style={{fontWeight:800,color:c,fontSize:13}}>{v}</span>;
  };

  const F = ({label, k, type='text', ph='', required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <input type={type} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
    </div>
  );

  const S = ({label, k, opts, required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <select value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
        <option value="">-- Sélectionner --</option>
        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  const ONGLETS = [
    {id:'dashboard', label:'📊 Tableau de bord'},
    {id:'processus', label:'🗺 Processus'},
    {id:'nc', label:'⚠ Non-conformités'},
    {id:'documents', label:'📄 Documents'},
    {id:'audits', label:'🔍 Audits'},
    {id:'risques', label:'🎯 Risques'},
    {id:'indicateurs', label:'📈 Indicateurs'},
    {id:'sst', label:'🦺 SST'},
    {id:'habilitations', label:'🏅 Habilitations'},
  ];

  return (
    <div>
      {/* Navigation onglets */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #e5e7eb',overflowX:'auto'}}>
        {ONGLETS.map(o=>(
          <button key={o.id} onClick={()=>chargerOnglet(o.id)} style={{
            padding:'10px 16px',border:'none',background:'none',cursor:'pointer',
            fontSize:12,whiteSpace:'nowrap',
            fontWeight:onglet===o.id?700:400,
            color:onglet===o.id?'#b45309':'#6b7280',
            borderBottom:onglet===o.id?'3px solid #b45309':'3px solid transparent',
          }}>{o.label}</button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {onglet==='dashboard' && (
        <div>
          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:24}}>
            {[
              {icon:'⚠',label:'NC ouvertes',value:dashboard.nc_ouvertes||0,color:'#dc2626',bg:'#fee2e2'},
              {icon:'🔴',label:'NC critiques',value:dashboard.nc_critiques||0,color:'#dc2626',bg:'#fee2e2'},
              {icon:'🔍',label:'Audits planifiés',value:dashboard.audits_planifies||0,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'🎯',label:'Risques élevés',value:dashboard.risques_eleves||0,color:'#d97706',bg:'#fef3c7'},
              {icon:'🏅',label:'Habilitations expirantes',value:dashboard.habilitations_expiration||0,color:'#9d174d',bg:'#fce7f3'},
              {icon:'🦺',label:'Accidents (année)',value:dashboard.accidents_annee||0,color:'#92400e',bg:'#fed7aa'},
              {icon:'📄',label:'Docs à réviser',value:dashboard.docs_revision||0,color:'#6d28d9',bg:'#f5f3ff'},
              {icon:'🗺',label:'Processus actifs',value:dashboard.nb_processus||0,color:'#15803d',bg:'#dcfce7'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:28,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>
          {/* Normes */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
            {[
              {code:'ISO9001',label:'Qualité',color:'#1d4ed8',bg:'#dbeafe',icone:'✅',desc:'Satisfaction client, amélioration continue'},
              {code:'ISO14001',label:'Environnement',color:'#15803d',bg:'#dcfce7',icone:'🌿',desc:'Impacts environnementaux, conformité réglementaire'},
              {code:'ISO45001',label:'Santé & Sécurité',color:'#92400e',bg:'#fef3c7',icone:'🦺',desc:'Prévention accidents, bien-être au travail'},
              {code:'FSSC22000',label:'Sécurité Alimentaire',color:'#9d174d',bg:'#fce7f3',icone:'🍽',desc:'HACCP, sécurité des denrées alimentaires'},
            ].map(n=>(
              <div key={n.code} style={{background:'#fff',borderRadius:12,border:`2px solid ${n.bg}`,padding:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <span style={{fontSize:24}}>{n.icone}</span>
                  <div>
                    <div style={{fontWeight:800,color:n.color,fontSize:14}}>{n.code}</div>
                    <div style={{fontSize:11,color:'#6b7280'}}>{n.label}</div>
                  </div>
                </div>
                <p style={{fontSize:11,color:'#6b7280',margin:0}}>{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ PROCESSUS ══ */}
      {onglet==='processus' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('processus',{type_processus:'realisation',normes_applicables:['ISO9001']})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouveau processus
            </button>
          </div>
          {['management','realisation','support'].map(type=>(
            <div key={type} style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:'#6b7280',letterSpacing:1,textTransform:'uppercase',marginBottom:10,borderBottom:'2px solid #f3f4f6',paddingBottom:6}}>
                {type==='management'?'🎯 Processus de Management':type==='realisation'?'⚙ Processus de Réalisation':'🔧 Processus Support'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
                {processus.filter(p=>p.type_processus===type).map(p=>(
                  <div key={p.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16,cursor:'pointer'}}
                    onClick={()=>setDetail(detail?.id===p.id?null:p)}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <span style={{fontFamily:'monospace',fontWeight:800,color:'#b45309',fontSize:13}}>{p.code}</span>
                        <div style={{fontWeight:600,fontSize:14,marginTop:2}}>{p.libelle}</div>
                      </div>
                      <span style={{background:STATUT_COLORS[p.statut]?.bg||'#f3f4f6',color:STATUT_COLORS[p.statut]?.tx||'#374151',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{p.statut}</span>
                    </div>
                    <NormesBadges normes_applicables={p.normes_applicables}/>
                    <div style={{display:'flex',gap:12,marginTop:8,fontSize:11,color:'#6b7280'}}>
                      <span>👤 {p.pilote_nom||'—'}</span>
                      <span>📄 {p.nb_documents||0} docs</span>
                      <span>⚠ {p.nb_nc_ouvertes||0} NC</span>
                    </div>
                    {detail?.id===p.id && (
                      <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #f3f4f6'}}>
                        {p.finalite&&<p style={{fontSize:12,color:'#374151',margin:'0 0 8px'}}><strong>Finalité :</strong> {p.finalite}</p>}
                        {p.donnees_entree&&<p style={{fontSize:12,color:'#374151',margin:'0 0 4px'}}><strong>Entrées :</strong> {p.donnees_entree}</p>}
                        {p.donnees_sortie&&<p style={{fontSize:12,color:'#374151',margin:'0 0 8px'}}><strong>Sorties :</strong> {p.donnees_sortie}</p>}
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={e=>{e.stopPropagation();ouvrir('processus',p);}}
                            style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏ Modifier</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {processus.filter(p=>p.type_processus===type).length===0&&(
                  <div style={{color:'#9ca3af',fontSize:12,padding:16}}>Aucun processus de ce type</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ NON-CONFORMITÉS ══ */}
      {onglet==='nc' && (
        <div>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:0}}>
              {['','ouverte','en_cours','en_verification','clos'].map(s=>(
                <button key={s} onClick={()=>{setFiltreStatut(s);chargerOnglet('nc');}} style={{
                  padding:'7px 12px',border:'1px solid #e5e7eb',
                  background:filtreStatut===s?'#b45309':'#fff',
                  color:filtreStatut===s?'#fff':'#6b7280',
                  cursor:'pointer',fontSize:11,fontWeight:filtreStatut===s?700:400,
                  borderRadius:s===''?'8px 0 0 8px':s==='clos'?'0 8px 8px 0':'0'
                }}>{s||'Toutes'}</button>
              ))}
            </div>
            <button onClick={()=>ouvrir('nc',{source:'interne',type_nc:'qualite',gravite:'mineure'})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,marginLeft:'auto'}}>
              + Nouvelle NC
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
              <thead>
                <tr style={{background:'#fffbeb'}}>
                  {['N° NC','Titre','Type','Gravité','Source','Processus','IPR','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#92400e',borderBottom:'2px solid #fde68a',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ncs.map((nc,i)=>{
                  const gs=GRAVITE_COLORS[nc.gravite]||{bg:'#f3f4f6',tx:'#374151'};
                  const ss=STATUT_COLORS[nc.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={nc.id} style={{borderBottom:'1px solid #fffbeb',background:i%2===0?'#fff':'#fffdf5'}}>
                      <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#b45309',fontSize:11}}>{nc.numero_nc}</td>
                      <td style={{padding:'9px 14px',fontWeight:500,maxWidth:200}}>{nc.titre}</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{nc.type_nc}</td>
                      <td style={{padding:'9px 14px'}}><span style={{background:gs.bg,color:gs.tx,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{nc.gravite}</span></td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{nc.source}</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{nc.processus_libelle||'—'}</td>
                      <td style={{padding:'9px 14px',textAlign:'center'}}><IPRBadge ipr={nc.ipr_amdec}/></td>
                      <td style={{padding:'9px 14px'}}><span style={{background:ss.bg,color:ss.tx,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{nc.statut}</span></td>
                      <td style={{padding:'9px 14px'}}>
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>ouvrir('nc',{...nc})}
                            style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✏</button>
                          {nc.statut==='ouverte'&&<button onClick={async()=>{await axios.put(`${API}/qhse/nc/${nc.id}`,{statut:'en_cours'});chargerOnglet('nc');toast.success('NC en cours');}}
                            style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Traiter</button>}
                          {nc.statut==='en_cours'&&<button onClick={async()=>{await axios.put(`${API}/qhse/nc/${nc.id}`,{statut:'clos',date_cloture:new Date().toISOString().split('T')[0]});chargerOnglet('nc');toast.success('NC clôturée');}}
                            style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Clôturer</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ncs.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>✅</div><p>Aucune non-conformité — tout va bien !</p></div>}
          </div>
        </div>
      )}

      {/* ══ DOCUMENTS GED ══ */}
      {onglet==='documents' && (
        <div>
          {/* Barre d'outils */}
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <input id="ged-search" placeholder="🔍 Recherche full-text dans les documents..."
              style={{flex:1,minWidth:200,border:'2px solid #d1d5db',borderRadius:8,padding:'9px 14px',fontSize:13}}
              onKeyDown={async e=>{
                if (e.key!=='Enter') return;
                const q = e.target.value.trim();
                if (!q || q.length<2) return;
                try {
                  const {data}=await axios.get(`${API}/qhse/documents/recherche?q=${encodeURIComponent(q)}`);
                  setDocuments(data.resultats||[]);
                  toast.info(`${data.nb_resultats} résultat(s) pour "${q}"`);
                } catch { toast.error('Erreur recherche'); }
              }}/>
            <button onClick={()=>chargerOnglet('documents')}
              style={{background:'#f3f4f6',border:'1px solid #d1d5db',padding:'9px 12px',borderRadius:8,cursor:'pointer'}}>🔄</button>
            
            {/* Upload fichier unique */}
            <label style={{background:'#059669',color:'#fff',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
              📄 Ajouter document
              <input type="file" accept=".docx,.doc,.pdf,.xlsx,.xls,.pptx" style={{display:'none'}}
                onChange={e=>{
                  const file = e.target.files[0];
                  if (!file) return;
                  ouvrir('document_upload', {_file: file, file_name: file.name});
                }}/>
            </label>
            
            {/* Import ZIP en masse */}
            <label style={{background:'#1d4ed8',color:'#fff',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
              📦 Import ZIP
              <input type="file" accept=".zip" style={{display:'none'}} onChange={async e=>{
                const file = e.target.files[0]; if (!file) return;
                const fd = new FormData(); fd.append('file', file);
                try {
                  toast.info('⏳ Import en cours...');
                  const {data}=await axios.post(`${API}/qhse/import-zip`, fd, {headers:{'Content-Type':'multipart/form-data'}});
                  toast.success(`✓ ${data.importes} docs importés, ${data.ignores} ignorés, ${data.erreurs} erreurs`);
                  chargerOnglet('documents');
                } catch(err) { toast.error('Erreur: '+(err.response?.data?.detail||err.message)); }
              }}/>
            </label>
            
            <button onClick={()=>ouvrir('document',{type_document:'procedure',version:'v1'})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
              + Saisie manuelle
            </button>
          </div>

          {/* Modal upload document */}
          {showForm && formType==='document_upload' && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{background:'#fff',borderRadius:14,width:'95%',maxWidth:600,padding:24}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
                  <h3 style={{margin:0,color:'#b45309',fontSize:15,fontWeight:800}}>📄 Upload Document QHSE</h3>
                  <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer'}}>✕</button>
                </div>
                <div style={{background:'#f0fdf4',borderRadius:10,padding:12,marginBottom:16,border:'2px solid #bbf7d0'}}>
                  <div style={{fontWeight:600,color:'#15803d',marginBottom:4}}>📎 {form._file?.name}</div>
                  <div style={{fontSize:12,color:'#6b7280'}}>
                    Les champs sont pré-remplis depuis le nom du fichier. Vérifiez et complétez.
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                  {[['Code','code','PRO-QUA-001'],['Titre','titre','Contrôle réception'],['Version','version','v1'],['Type','type','']].map(([l,k,ph])=>
                    k==='type' ? (
                      <div key={k}>
                        <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{l}</label>
                        <select value={form.type_document||'procedure'} onChange={e=>setForm({...form,type_document:e.target.value})}
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                          {[['procedure','Procédure'],['instruction','Instruction'],['formulaire','Formulaire'],['enregistrement','Enregistrement'],['manuel','Manuel'],['specification','Spécification'],['autre','Autre']].map(([v,l])=>
                            <option key={v} value={v}>{l}</option>
                          )}
                        </select>
                      </div>
                    ) : (
                      <div key={k}>
                        <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{l}</label>
                        <input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph}
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
                      </div>
                    )
                  )}
                  <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:10,background:'#fffbeb',borderRadius:8,padding:10}}>
                    <input type="checkbox" id="analyserIA" checked={!!form.analyser_ia}
                      onChange={e=>setForm({...form,analyser_ia:e.target.checked})}/>
                    <label htmlFor="analyserIA" style={{fontSize:13,fontWeight:600,cursor:'pointer'}}>
                      🤖 Analyser avec l'IA (génère un résumé automatique)
                    </label>
                  </div>
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={async()=>{
                    const fd = new FormData();
                    fd.append('file', form._file);
                    fd.append('code', form.code||'');
                    fd.append('titre', form.titre||'');
                    fd.append('type_document', form.type_document||'procedure');
                    fd.append('version', form.version||'v1');
                    fd.append('analyser_ia', form.analyser_ia?'true':'false');
                    try {
                      toast.info('⏳ Upload en cours...');
                      const {data}=await axios.post(`${API}/qhse/documents/upload`, fd, {headers:{'Content-Type':'multipart/form-data'}});
                      toast.success(`✓ ${data.action==='creation'?'Créé':'Mis à jour'}: ${data.code} — ${data.nb_mots} mots extraits`);
                      if (data.resume_ia) toast.info('🤖 Résumé IA généré !');
                      setShowForm(false); chargerOnglet('documents');
                    } catch(err) { toast.error(err.response?.data?.detail||'Erreur upload'); }
                  }} style={{background:'#059669',color:'#fff',border:'none',padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:800,flex:1}}>
                    ✓ Importer
                  </button>
                  <button onClick={()=>setShowForm(false)}
                    style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tableau documents */}
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:800}}>
              <thead>
                <tr style={{background:'#fffbeb'}}>
                  {['Code','Titre','Type','Processus','Version','Mots','Normes','IA','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#92400e',borderBottom:'2px solid #fde68a',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((d,i)=>{
                  const ss=STATUT_COLORS[d.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={d.id} style={{borderBottom:'1px solid #fffbeb',background:i%2===0?'#fff':'#fffdf5'}}>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,color:'#b45309',fontSize:11}}>{d.code}</td>
                      <td style={{padding:'9px 12px',fontWeight:500,maxWidth:200}}>
                        <div>{d.titre}</div>
                        {d.extrait&&<div style={{fontSize:10,color:'#9ca3af',marginTop:2}} dangerouslySetInnerHTML={{__html:d.extrait}}/>}
                      </td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{d.type_document}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{d.processus_libelle||'—'}</td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}><span style={{fontFamily:'monospace',background:'#f3f4f6',padding:'2px 6px',borderRadius:4,fontSize:11}}>{d.version}</span></td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontSize:11,color:'#9ca3af'}}>{d.nb_mots||'—'}</td>
                      <td style={{padding:'9px 12px'}}><NormesBadges normes_applicables={d.normes_applicables}/></td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}>
                        {d.resume_ia ? <span title={d.resume_ia} style={{cursor:'help',fontSize:16}}>🤖</span> : 
                         d.file_path ? <button onClick={async()=>{
                           try{toast.info('IA analyse...');await axios.post(`${API}/qhse/documents/${d.id}/analyser-ia`);chargerOnglet('documents');toast.success('Résumé généré !');}
                           catch{toast.error('Erreur IA');}
                         }} style={{background:'none',border:'1px solid #c7d2fe',borderRadius:6,padding:'2px 6px',cursor:'pointer',fontSize:10,color:'#4338ca'}}>Analyser</button> : '—'}
                      </td>
                      <td style={{padding:'9px 12px'}}><span style={{background:ss.bg,color:ss.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{d.statut}</span></td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',gap:5}}>
                          {d.file_path&&<button onClick={async()=>{
                            try{window.open(`${API}/qhse/documents/${d.id}/telecharger`,'_blank');}
                            catch{toast.error('Erreur téléchargement');}
                          }} style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>⬇</button>}
                          {d.statut==='brouillon'&&<button onClick={async()=>{await axios.put(`${API}/qhse/documents/${d.id}/statut`,{statut:'approuve'});chargerOnglet('documents');toast.success('Approuvé');}}
                            style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✓</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {documents.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}>
              <div style={{fontSize:36,marginBottom:8}}>📄</div>
              <p style={{fontWeight:600}}>Aucun document</p>
              <p style={{fontSize:12}}>Importez votre ZIP existant ou uploadez un fichier</p>
            </div>}
          </div>
        </div>
      )}

      {/* ══ AUDITS ══ */}
      {onglet==='audits' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('audit',{type_audit:'interne'})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Planifier un audit
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
            {audits.map(a=>{
              const ss=STATUT_COLORS[a.statut]||{bg:'#f3f4f6',tx:'#374151'};
              const nc=NORMES_COLORS[a.norme_auditee]||{bg:'#f3f4f6',tx:'#374151'};
              return (
                <div key={a.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                    <div>
                      <span style={{fontFamily:'monospace',fontWeight:800,color:'#b45309',fontSize:12}}>{a.numero_audit}</span>
                      <div style={{fontWeight:600,fontSize:13,marginTop:2}}>{a.titre}</div>
                    </div>
                    <span style={{background:ss.bg,color:ss.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{a.statut}</span>
                  </div>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    {a.norme_auditee&&<span style={{background:nc.bg,color:nc.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{a.norme_auditee}</span>}
                    <span style={{background:'#f3f4f6',color:'#374151',padding:'2px 8px',borderRadius:20,fontSize:10}}>{a.type_audit}</span>
                  </div>
                  <div style={{fontSize:11,color:'#6b7280',display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                    <span>📅 {a.date_planifiee?new Date(a.date_planifiee).toLocaleDateString('fr-FR'):'Non planifié'}</span>
                    <span>⏱ {a.duree_jours}j</span>
                    <span>🔴 {a.nb_ecarts_majeurs||0} majeurs</span>
                    <span>🟡 {a.nb_ecarts_mineurs||0} mineurs</span>
                  </div>
                  <div style={{marginTop:10}}>
                    <button onClick={()=>ouvrir('audit',{...a})}
                      style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'5px 12px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏ Modifier</button>
                  </div>
                </div>
              );
            })}
            {audits.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af',gridColumn:'1/-1'}}><div style={{fontSize:36,marginBottom:8}}>🔍</div><p>Aucun audit planifié</p></div>}
          </div>
        </div>
      )}

      {/* ══ RISQUES ══ */}
      {onglet==='risques' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('risque',{type:'risque',categorie:'qualite',probabilite:'1',gravite:'1',detectabilite:'1'})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouveau risque/opportunité
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{background:'#fffbeb'}}>
                  {['Type','Titre','Catégorie','P','G','D','IPR','Criticité','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#92400e',borderBottom:'2px solid #fde68a'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risques.map((r,i)=>{
                  const ss=STATUT_COLORS[r.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={r.id} style={{borderBottom:'1px solid #fffbeb',background:i%2===0?'#fff':'#fffdf5'}}>
                      <td style={{padding:'9px 12px'}}>
                        <span style={{background:r.type==='risque'?'#fee2e2':'#dcfce7',color:r.type==='risque'?'#dc2626':'#15803d',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>
                          {r.type==='risque'?'⚠ Risque':'💡 Opportunité'}
                        </span>
                      </td>
                      <td style={{padding:'9px 12px',fontWeight:500,maxWidth:180}}>{r.titre}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{r.categorie}</td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontWeight:700}}>{r.probabilite}</td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontWeight:700}}>{r.gravite}</td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontWeight:700}}>{r.detectabilite}</td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}><IPRBadge ipr={r.ipr}/></td>
                      <td style={{padding:'9px 12px',textAlign:'center'}}>
                        <span style={{fontWeight:700,color:parseInt(r.criticite||0)>=12?'#dc2626':parseInt(r.criticite||0)>=6?'#d97706':'#15803d'}}>
                          {r.criticite}
                        </span>
                      </td>
                      <td style={{padding:'9px 12px'}}><span style={{background:ss.bg,color:ss.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{r.statut}</span></td>
                      <td style={{padding:'9px 12px'}}>
                        <button onClick={()=>ouvrir('risque',{...r})}
                          style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✏</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {risques.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🎯</div><p>Aucun risque identifié</p></div>}
          </div>
        </div>
      )}

      {/* ══ INDICATEURS ══ */}
      {onglet==='indicateurs' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('indicateur',{frequence_mesure:'mensuel',sens:'hausse'})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouvel indicateur
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
            {indicateurs.map(ind=>{
              const val = parseFloat(ind.derniere_valeur||0);
              const obj = parseFloat(ind.objectif_valeur||0);
              const pct = obj > 0 ? Math.min(100, (val/obj)*100) : 0;
              const ok = ind.sens==='hausse' ? val >= obj : val <= obj;
              return (
                <div key={ind.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <div>
                      <span style={{fontFamily:'monospace',fontWeight:800,color:'#b45309',fontSize:11}}>{ind.code}</span>
                      <div style={{fontWeight:600,fontSize:13,marginTop:2}}>{ind.libelle}</div>
                    </div>
                    {ind.norme_associee&&<span style={{background:NORMES_COLORS[ind.norme_associee]?.bg||'#f3f4f6',color:NORMES_COLORS[ind.norme_associee]?.tx||'#374151',padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{ind.norme_associee}</span>}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:22,fontWeight:800,color:ok?'#15803d':'#dc2626'}}>{val.toFixed(1)}</div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>{ind.unite||'—'}</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:14,fontWeight:600,color:'#6b7280'}}>/{obj.toFixed(1)}</div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>objectif</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:14,fontWeight:700,color:ok?'#15803d':'#dc2626'}}>{ok?'✓':'✗'}</div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>{pct.toFixed(0)}%</div>
                    </div>
                  </div>
                  <div style={{background:'#f3f4f6',borderRadius:20,height:6,marginBottom:8}}>
                    <div style={{background:ok?'#15803d':'#dc2626',borderRadius:20,height:6,width:`${Math.min(100,pct)}%`,transition:'width 0.3s'}}/>
                  </div>
                  <div style={{fontSize:10,color:'#9ca3af'}}>{ind.frequence_mesure} | {ind.processus_libelle||'—'}</div>
                </div>
              );
            })}
            {indicateurs.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af',gridColumn:'1/-1'}}><div style={{fontSize:36,marginBottom:8}}>📈</div><p>Aucun indicateur — définissez vos KPIs QHSE</p></div>}
          </div>
        </div>
      )}

      {/* ══ SST ══ */}
      {onglet==='sst' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('accident',{type:'incident',gravite_sst:'leger'})}
              style={{background:'#dc2626',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              🚨 Déclarer un accident/incident
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{background:'#fef2f2'}}>
                  {['N°','Type','Gravité','Titre','Date','Victime','Jours arrêt','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#dc2626',borderBottom:'2px solid #fecaca',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accidents.map((a,i)=>{
                  const gs = {
                    leger:{bg:'#fef3c7',tx:'#92400e'},
                    moyen:{bg:'#fed7aa',tx:'#c2410c'},
                    grave:{bg:'#fee2e2',tx:'#dc2626'},
                    mortel:{bg:'#7f1d1d',tx:'#fff'},
                    sans_arret:{bg:'#f3f4f6',tx:'#6b7280'},
                  }[a.gravite_sst]||{bg:'#f3f4f6',tx:'#374151'};
                  const ss=STATUT_COLORS[a.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={a.id} style={{borderBottom:'1px solid #fef2f2',background:i%2===0?'#fff':'#fff5f5'}}>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,color:'#dc2626',fontSize:11}}>{a.numero}</td>
                      <td style={{padding:'9px 12px',fontSize:11}}>{a.type}</td>
                      <td style={{padding:'9px 12px'}}><span style={{background:gs.bg,color:gs.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{a.gravite_sst}</span></td>
                      <td style={{padding:'9px 12px',fontWeight:500}}>{a.titre}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{new Date(a.date_accident).toLocaleDateString('fr-FR')}</td>
                      <td style={{padding:'9px 12px',fontSize:11}}>{a.victime_nom||a.victime_nom_user||'—'}</td>
                      <td style={{padding:'9px 12px',textAlign:'center',fontWeight:700,color:a.nb_jours_arret>0?'#dc2626':'#6b7280'}}>{a.nb_jours_arret||0}</td>
                      <td style={{padding:'9px 12px'}}><span style={{background:ss.bg,color:ss.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{a.statut}</span></td>
                      <td style={{padding:'9px 12px'}}>
                        <button onClick={()=>ouvrir('accident',{...a})}
                          style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✏</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {accidents.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🦺</div><p>Aucun accident/incident déclaré</p></div>}
          </div>
        </div>
      )}

      {/* ══ HABILITATIONS ══ */}
      {onglet==='habilitations' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('habilitation',{})}
              style={{background:'#b45309',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouvelle habilitation
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{background:'#fffbeb'}}>
                  {['Employé','Type habilitation','N°','Organisme','Obtention','Expiration','Statut'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#92400e',borderBottom:'2px solid #fde68a'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habilitations.map((h,i)=>{
                  const exp = h.date_expiration ? new Date(h.date_expiration) : null;
                  const joursRestants = exp ? Math.ceil((exp - new Date())/86400000) : null;
                  const expColor = joursRestants !== null ? (joursRestants < 0 ? '#dc2626' : joursRestants < 30 ? '#d97706' : '#15803d') : '#9ca3af';
                  const ss=STATUT_COLORS[h.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={h.id} style={{borderBottom:'1px solid #fffbeb',background:i%2===0?'#fff':'#fffdf5'}}>
                      <td style={{padding:'9px 12px',fontWeight:600}}>{h.nom} {h.prenom}</td>
                      <td style={{padding:'9px 12px'}}>{h.type_habilitation}</td>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11}}>{h.numero||'—'}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{h.organisme_delivrant||'—'}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{h.date_obtention?new Date(h.date_obtention).toLocaleDateString('fr-FR'):'—'}</td>
                      <td style={{padding:'9px 12px',fontWeight:700,color:expColor}}>
                        {exp?exp.toLocaleDateString('fr-FR'):'—'}
                        {joursRestants!==null&&<span style={{fontSize:10,marginLeft:4}}>({joursRestants}j)</span>}
                      </td>
                      <td style={{padding:'9px 12px'}}><span style={{background:ss.bg,color:ss.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{h.statut}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {habilitations.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🏅</div><p>Aucune habilitation enregistrée</p></div>}
          </div>
        </div>
      )}

      {/* ══ FORMULAIRES MODAUX ══ */}
      {showForm && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:60,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:14,width:'95%',maxWidth:700,padding:24,maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{margin:0,color:'#b45309',fontSize:16,fontWeight:800}}>
                {formType==='processus'?'🗺 Processus':
                 formType==='nc'?'⚠ Non-conformité':
                 formType==='document'?'📄 Document':
                 formType==='audit'?'🔍 Audit':
                 formType==='risque'?'🎯 Risque/Opportunité':
                 formType==='indicateur'?'📈 Indicateur':
                 formType==='accident'?'🚨 Accident/Incident':
                 '🏅 Habilitation'}
              </h3>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:16}}>

              {/* PROCESSUS */}
              {formType==='processus' && <>
                <F label="Code *" k="code" ph="PROC-001" required/>
                <F label="Libellé *" k="libelle" ph="Management de la qualité" required/>
                <S label="Type *" k="type_processus" required opts={[
                  {v:'management',l:'🎯 Management'},{v:'realisation',l:'⚙ Réalisation'},{v:'support',l:'🔧 Support'}
                ]}/>
                <S label="Pilote" k="pilote_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <S label="Co-pilote" k="copilote_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <F label="Version" k="version" ph="v1"/>
                <div style={{gridColumn:'1/-1'}}><F label="Finalité" k="finalite" ph="Décrire la finalité du processus"/></div>
                <div style={{gridColumn:'1/-1'}}><F label="Données d'entrée" k="donnees_entree" ph="Commandes clients, exigences réglementaires..."/></div>
                <div style={{gridColumn:'1/-1'}}><F label="Données de sortie" k="donnees_sortie" ph="Produits conformes, rapports, enregistrements..."/></div>
              </>}

              {/* NON-CONFORMITÉ */}
              {formType==='nc' && <>
                <F label="Titre *" k="titre" ph="Description courte de la NC" required/>
                <S label="Source" k="source" opts={[
                  {v:'interne',l:'Interne'},{v:'client',l:'Client'},{v:'audit_interne',l:'Audit interne'},
                  {v:'audit_externe',l:'Audit externe'},{v:'fournisseur',l:'Fournisseur'},
                  {v:'accident',l:'Accident'},{v:'inspection',l:'Inspection'}
                ]}/>
                <S label="Type" k="type_nc" opts={[
                  {v:'qualite',l:'Qualité'},{v:'securite',l:'Sécurité'},
                  {v:'environnement',l:'Environnement'},{v:'alimentaire',l:'Alimentaire'},{v:'reglementaire',l:'Réglementaire'}
                ]}/>
                <S label="Gravité" k="gravite" opts={[
                  {v:'observation',l:'Observation'},{v:'mineure',l:'Mineure'},{v:'majeure',l:'Majeure'},{v:'critique',l:'Critique'}
                ]}/>
                <S label="Processus" k="processus_id" opts={processus.map(p=>({v:p.id,l:`${p.code} — ${p.libelle}`}))}/>
                <F label="Produit concerné" k="produit_concerne" ph="Réf. produit"/>
                <F label="N° Lot" k="lot_concerne" ph="LOT-2026-001"/>
                <F label="Date détection" k="date_detection" type="date"/>
                <S label="Responsable traitement" k="responsable_traitement_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Description</label>
                  <textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} rows={3}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Action immédiate</label>
                  <textarea value={form.action_immediate||''} onChange={e=>setForm({...form,action_immediate:e.target.value})} rows={2}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Action corrective</label>
                  <textarea value={form.action_corrective||''} onChange={e=>setForm({...form,action_corrective:e.target.value})} rows={2}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                <div style={{background:'#f8f9ff',borderRadius:8,padding:12,gridColumn:'1/-1'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#4338ca',marginBottom:10}}>Cotation AMDEC (IPR = G × O × D)</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[['Gravité (1-5)','gravite_score'],['Occurrence (1-5)','occurrence_score'],['Détectabilité (1-5)','detectabilite_score']].map(([label,k])=>(
                      <div key={k}>
                        <label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:3}}>{label}</label>
                        <input type="number" min="1" max="5" value={form[k]||1} onChange={e=>setForm({...form,[k]:parseInt(e.target.value)||1})}
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:13,textAlign:'center',boxSizing:'border-box'}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{textAlign:'center',marginTop:8,fontSize:13,fontWeight:800,color:'#4338ca'}}>
                    IPR = {(form.gravite_score||1)*(form.occurrence_score||1)*(form.detectabilite_score||1)}
                  </div>
                </div>
              </>}

              {/* DOCUMENT */}
              {formType==='document' && <>
                <F label="Code *" k="code" ph="PRO-QUA-001" required/>
                <F label="Titre *" k="titre" ph="Procédure de contrôle qualité" required/>
                <S label="Type" k="type_document" opts={[
                  {v:'procedure',l:'Procédure'},{v:'instruction',l:'Instruction de travail'},
                  {v:'formulaire',l:'Formulaire'},{v:'enregistrement',l:'Enregistrement'},
                  {v:'plan',l:'Plan'},{v:'manuel',l:'Manuel'},{v:'specification',l:'Spécification'},{v:'autre',l:'Autre'}
                ]}/>
                <S label="Processus" k="processus_id" opts={processus.map(p=>({v:p.id,l:`${p.code} — ${p.libelle}`}))}/>
                <F label="Version" k="version" ph="v1"/>
                <F label="Date prochaine révision" k="date_prochaine_revision" type="date"/>
                <S label="Rédacteur" k="redacteur_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <S label="Approbateur" k="approbateur_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <div style={{gridColumn:'1/-1'}}><F label="Mots-clés" k="mots_cles" ph="qualité, contrôle, réception..."/></div>
              </>}

              {/* AUDIT */}
              {formType==='audit' && <>
                <F label="Titre *" k="titre" ph="Audit ISO 9001 — Production" required/>
                <S label="Type" k="type_audit" opts={[
                  {v:'interne',l:'Interne'},{v:'externe',l:'Externe'},{v:'fournisseur',l:'Fournisseur'},
                  {v:'certification',l:'Certification'},{v:'surveillance',l:'Surveillance'}
                ]}/>
                <S label="Norme auditée" k="norme_auditee" opts={normes.map(n=>({v:n.code,l:`${n.code} — ${n.libelle}`}))}/>
                <F label="Date planifiée" k="date_planifiee" type="date"/>
                <F label="Durée (jours)" k="duree_jours" type="number" ph="1"/>
                <S label="Chef auditeur" k="auditeur_chef_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                {form.id && <>
                  <S label="Statut" k="statut" opts={[
                    {v:'planifie',l:'Planifié'},{v:'en_cours',l:'En cours'},{v:'realise',l:'Réalisé'},{v:'clos',l:'Clos'}
                  ]}/>
                  <F label="Écarts majeurs" k="nb_ecarts_majeurs" type="number" ph="0"/>
                  <F label="Écarts mineurs" k="nb_ecarts_mineurs" type="number" ph="0"/>
                  <F label="Observations" k="nb_observations" type="number" ph="0"/>
                  <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Conclusion</label>
                    <textarea value={form.conclusion||''} onChange={e=>setForm({...form,conclusion:e.target.value})} rows={3}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                </>}
              </>}

              {/* RISQUE */}
              {formType==='risque' && <>
                <S label="Type" k="type" opts={[{v:'risque',l:'⚠ Risque'},{v:'opportunite',l:'💡 Opportunité'}]}/>
                <S label="Catégorie" k="categorie" opts={[
                  {v:'qualite',l:'Qualité'},{v:'securite',l:'Sécurité'},{v:'environnement',l:'Environnement'},
                  {v:'alimentaire',l:'Alimentaire'},{v:'strategique',l:'Stratégique'},{v:'operationnel',l:'Opérationnel'}
                ]}/>
                <F label="Titre *" k="titre" ph="Description du risque" required/>
                <S label="Norme" k="norme_ref" opts={normes.map(n=>({v:n.code,l:n.code}))}/>
                <S label="Processus" k="processus_id" opts={processus.map(p=>({v:p.id,l:`${p.code} — ${p.libelle}`}))}/>
                <S label="Responsable" k="responsable_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <F label="Échéance" k="date_echeance" type="date"/>
                <div style={{background:'#f8f9ff',borderRadius:8,padding:12,gridColumn:'1/-1'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#4338ca',marginBottom:10}}>Cotation (1 à 5)</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[['Probabilité','probabilite'],['Gravité','gravite'],['Détectabilité','detectabilite']].map(([l,k])=>(
                      <div key={k}>
                        <label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:3}}>{l}</label>
                        <input type="number" min="1" max="5" value={form[k]||1} onChange={e=>setForm({...form,[k]:parseInt(e.target.value)||1})}
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:13,textAlign:'center',boxSizing:'border-box'}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{textAlign:'center',marginTop:8,fontSize:13,fontWeight:800,color:'#4338ca'}}>
                    Criticité = {(form.probabilite||1)*(form.gravite||1)} | IPR = {(form.probabilite||1)*(form.gravite||1)*(form.detectabilite||1)}
                  </div>
                </div>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Plan de traitement</label>
                  <textarea value={form.plan_traitement||''} onChange={e=>setForm({...form,plan_traitement:e.target.value})} rows={3}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
              </>}

              {/* INDICATEUR */}
              {formType==='indicateur' && <>
                <F label="Code *" k="code" ph="IND-QUA-001" required/>
                <F label="Libellé *" k="libelle" ph="Taux de conformité produit" required/>
                <S label="Norme" k="norme_associee" opts={normes.map(n=>({v:n.code,l:n.code}))}/>
                <S label="Processus" k="processus_id" opts={processus.map(p=>({v:p.id,l:`${p.code} — ${p.libelle}`}))}/>
                <F label="Unité" k="unite" ph="%, ppm, nombre..."/>
                <F label="Objectif" k="objectif_valeur" type="number" ph="0"/>
                <F label="Seuil alerte" k="seuil_alerte" type="number" ph="0"/>
                <S label="Sens" k="sens" opts={[{v:'hausse',l:'↑ Hausse = Bon'},{v:'baisse',l:'↓ Baisse = Bon'}]}/>
                <S label="Fréquence" k="frequence_mesure" opts={[
                  {v:'journalier',l:'Journalier'},{v:'hebdo',l:'Hebdomadaire'},
                  {v:'mensuel',l:'Mensuel'},{v:'trimestriel',l:'Trimestriel'},{v:'annuel',l:'Annuel'}
                ]}/>
                <S label="Responsable" k="responsable_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <F label="Formule de calcul" k="formule" ph="NC closes / NC totales * 100"/>
              </>}

              {/* ACCIDENT */}
              {formType==='accident' && <>
                <S label="Type" k="type" opts={[
                  {v:'accident',l:'🔴 Accident'},{v:'incident',l:'🟡 Incident'},
                  {v:'presqu_accident',l:'🟠 Presqu-accident'},{v:'maladie_pro',l:'🔵 Maladie pro'},
                  {v:'danger_grave',l:'⛔ Danger grave'}
                ]}/>
                <S label="Gravité" k="gravite_sst" opts={[
                  {v:'sans_arret',l:'Sans arrêt'},{v:'leger',l:'Léger'},{v:'moyen',l:'Moyen'},
                  {v:'grave',l:'Grave'},{v:'mortel',l:'Mortel'}
                ]}/>
                <F label="Titre *" k="titre" ph="Description courte" required/>
                <F label="Date" k="date_accident" type="datetime-local"/>
                <S label="Atelier" k="atelier_id" opts={ateliers.map(a=>({v:String(a.id),l:`${a.code} — ${a.libelle}`}))}/>
                <F label="Victime" k="victime_nom" ph="Nom de la victime"/>
                <F label="Jours d'arrêt" k="nb_jours_arret" type="number" ph="0"/>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Description</label>
                  <textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} rows={3}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Cause immédiate</label>
                  <textarea value={form.cause_immediate||''} onChange={e=>setForm({...form,cause_immediate:e.target.value})} rows={2}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Action immédiate</label>
                  <textarea value={form.action_immediate||''} onChange={e=>setForm({...form,action_immediate:e.target.value})} rows={2}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
              </>}

              {/* HABILITATION */}
              {formType==='habilitation' && <>
                <S label="Employé *" k="utilisateur_id" required opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <F label="Type habilitation *" k="type_habilitation" ph="CACES R489, Habilitation électrique..." required/>
                <F label="N° habilitation" k="numero" ph="HE-B1-2026-001"/>
                <F label="Organisme" k="organisme_delivrant" ph="AFPA, APAVE..."/>
                <F label="Date obtention" k="date_obtention" type="date"/>
                <F label="Date expiration" k="date_expiration" type="date"/>
                <div style={{gridColumn:'1/-1'}}><F label="Notes" k="notes" ph="Conditions, restrictions..."/></div>
              </>}

            </div>

            <div style={{display:'flex',gap:10,paddingTop:16,borderTop:'1px solid #f3f4f6'}}>
              <button onClick={sauvegarder}
                style={{background:'#b45309',color:'#fff',border:'none',padding:'12px 32px',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:14}}>
                ✓ Enregistrer
              </button>
              <button onClick={()=>setShowForm(false)}
                style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantIA() {
  const [conversations, setConversations] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('naido_ia_convs') || '[]'); } catch { return []; }
  });
  const [convActuelle, setConvActuelle] = React.useState(null);
  const [messages, setMessages] = React.useState([
    { role:'assistant', content:"Bonjour ! Je suis l'assistant IA de NAI. J'ai accès à toutes les données de l'application en temps réel. Posez-moi votre question !" }
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  // Sauvegarder conversation dans localStorage
  const sauvegarderConv = (msgs) => {
    if (msgs.length <= 1) return;
    const titre = msgs[1]?.content?.slice(0,50) || 'Conversation';
    const conv = {
      id: convActuelle || Date.now(),
      titre,
      date: new Date().toLocaleDateString('fr-FR'),
      messages: msgs
    };
    setConvActuelle(conv.id);
    setConversations(prev => {
      const updated = [conv, ...prev.filter(c => c.id !== conv.id)].slice(0,20);
      try { localStorage.setItem('naido_ia_convs', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const ACTIONS_RAPIDES = [
    { label:'📊 Rapport journalier', endpoint:'/ia/rapport-journalier', payload:{} },
    { label:'📦 Analyse stock',       endpoint:'/ia/analyser-stock',     payload:{} },
    { label:'🏭 État production',     endpoint:'/ia/chat', payload:{message:"Donne-moi un bilan complet de la production AT3 aujourd'hui avec les KPIs."} },
    { label:'⚠ Risques QHSE',        endpoint:'/ia/chat', payload:{message:"Quels sont les risques QHSE prioritaires à traiter selon nos données actuelles ?"} },
    { label:'🔧 Maintenance',         endpoint:'/ia/chat', payload:{message:"Quelles maintenances préventives sont urgentes cette semaine ?"} },
    { label:'📈 Améliorer TRS',       endpoint:'/ia/chat', payload:{message:"Comment améliorer notre TRS sur les extrudeuses AT3 ?"} },
  ];

  const envoyer = async (msgText=null, endpoint='/ia/chat', payload=null) => {
    const texte = msgText || input.trim();
    if (!texte && !payload) return;
    setLoading(true);
    const userMsg = { role:'user', content: texte || 'Action rapide' };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    try {
      const body = payload || { 
        message: texte, 
        historique: messages.slice(-8),  // Envoyer les 8 derniers pour la mémoire
        avec_contexte_production: true 
      };
      const { data } = await axios.post(`${API}${endpoint}`, body);
      if (data.erreur) {
        const errMsg = { role:'assistant', content:`❌ ${data.erreur}

💡 Configurez les clés API dans ⚙ Paramètres Système.` };
        const finalMsgs = [...newMessages, errMsg];
        setMessages(finalMsgs);
      } else {
        const assistantMsg = { role:'assistant', content: data.reponse || data };
        const finalMsgs = [...newMessages, assistantMsg];
        setMessages(finalMsgs);
        sauvegarderConv(finalMsgs);
      }
    } catch(e) {
      setMessages(prev => [...prev, { role:'assistant', content:`❌ Erreur: ${e.response?.data?.detail || e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const nouvelleConv = () => {
    setMessages([{ role:'assistant', content:"Nouvelle conversation. Comment puis-je vous aider ?" }]);
    setConvActuelle(null);
    setShowHistory(false);
  };

  const chargerConv = (conv) => {
    setMessages(conv.messages);
    setConvActuelle(conv.id);
    setShowHistory(false);
  };

  const formater = (texte) => {
    if (!texte) return '';
    return String(texte)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>')
      .replace(/^(\d+)\.\s/gm, '<br/><strong>$1.</strong> ');
  };

  return (
    <div style={{display:'flex',gap:12,height:'calc(100vh - 120px)'}}>
      
      {/* Panneau historique */}
      {showHistory && (
        <div style={{width:260,background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #e5e7eb',fontWeight:700,color:'#4338ca',fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            📋 Historique
            <button onClick={nouvelleConv} style={{background:'#4338ca',color:'#fff',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>+ Nouveau</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:8}}>
            {conversations.length === 0 ? (
              <div style={{textAlign:'center',padding:20,color:'#9ca3af',fontSize:12}}>Aucune conversation</div>
            ) : conversations.map(c=>(
              <div key={c.id} onClick={()=>chargerConv(c)}
                style={{padding:'8px 10px',borderRadius:8,cursor:'pointer',marginBottom:4,
                  background:convActuelle===c.id?'#eff6ff':'#f8f9ff',
                  border:convActuelle===c.id?'1px solid #bfdbfe':'1px solid transparent'}}>
                <div style={{fontSize:12,fontWeight:600,color:'#1d4ed8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.titre}</div>
                <div style={{fontSize:10,color:'#9ca3af',marginTop:2}}>{c.date} · {c.messages?.length} messages</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone principale */}
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#4338ca,#6366f1)',borderRadius:12,padding:'12px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:800,color:'#fff',fontSize:14}}>🤖 Assistant IA NAI</div>
            <div style={{color:'#c7d2fe',fontSize:11}}>Accès complet aux données · Mémoire de conversation</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowHistory(!showHistory)}
              style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600}}>
              📋 {conversations.length}
            </button>
            <button onClick={nouvelleConv}
              style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:11}}>
              ✨ Nouveau
            </button>
          </div>
        </div>

        {/* Actions rapides */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
          {ACTIONS_RAPIDES.map((a,i)=>(
            <button key={i} onClick={()=>envoyer(a.label.replace(/^[^\s]+\s/,''), a.endpoint, a.payload)}
              style={{background:'#f0f4ff',color:'#4338ca',border:'1px solid #c7d2fe',padding:'5px 10px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',background:'#f8f9ff',borderRadius:12,border:'1px solid #e5e7eb',padding:12,display:'flex',flexDirection:'column',gap:10}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{
                maxWidth:'82%',
                background:m.role==='user'?'#4338ca':'#fff',
                color:m.role==='user'?'#fff':'#1f2937',
                borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',
                padding:'10px 14px',
                boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
                border:m.role==='user'?'none':'1px solid #e5e7eb',
                fontSize:13, lineHeight:1.6
              }}>
                <div dangerouslySetInnerHTML={{__html:formater(m.content)}}/>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{background:'#fff',borderRadius:'14px 14px 14px 4px',padding:'10px 14px',border:'1px solid #e5e7eb',fontSize:13,color:'#9ca3af',display:'flex',gap:4,alignItems:'center'}}>
                <span>L'IA analyse vos données</span>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:6,height:6,borderRadius:'50%',background:'#6366f1',opacity:0.6}}/>
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>

        {/* Saisie */}
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&envoyer()}
            placeholder="Posez votre question... (Entrée pour envoyer)"
            style={{flex:1,border:'2px solid #c7d2fe',borderRadius:10,padding:'10px 14px',fontSize:13,outline:'none'}}
            disabled={loading}/>
          <button onClick={()=>envoyer()} disabled={loading||!input.trim()}
            style={{background:loading||!input.trim()?'#d1d5db':'#4338ca',color:'#fff',border:'none',padding:'10px 18px',borderRadius:10,cursor:loading||!input.trim()?'default':'pointer',fontWeight:700,fontSize:13}}>
            {loading?'⏳':'▶'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Utilisateurs() {
  const [users, setUsers] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [postes, setPostes] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showReset, setShowReset] = useState(null);
  const [form, setForm] = useState({});
  const [newPwd, setNewPwd] = useState('');
  const [search, setSearch] = useState('');
  const [filtreRole, setFiltreRole] = useState('');

  const charger = async () => {
    try {
      const [u, e, p, at, r] = await Promise.all([
        axios.get(`${API}/utilisateurs`),
        axios.get(`${API}/rh/employes`),
        axios.get(`${API}/rh/postes`),
        axios.get(`${API}/ateliers`),
        axios.get(`${API}/utilisateurs/roles`),
      ]);
      setUsers(u.data); setEmployes(e.data); setPostes(p.data);
      setAteliers(at.data); setRoles(r.data);
    } catch(e) { toast.error('Erreur chargement'); }
  };

  useEffect(() => { charger(); }, []);

  // Quand on sélectionne un employé, on prérempli
  const selectionnerEmploye = (empId) => {
    const emp = employes.find(e => e.id === empId);
    if (!emp) return setForm({...form, employe_id:''});
    // Déduire le rôle depuis le poste
    const poste = postes.find(p => p.id === emp.poste_id);
    const roleDevine = deduireRole(poste?.intitule || '');
    const loginAuto = `${emp.prenom.toLowerCase().replace(/\s/g,'.')}.${emp.nom.toLowerCase().replace(/\s/g,'').substring(0,8)}`;
    setForm({
      ...form,
      employe_id: empId,
      nom: emp.nom,
      prenom: emp.prenom,
      email: emp.email || '',
      atelier_id: emp.atelier_id ? String(emp.atelier_id) : '',
      role: roleDevine,
      login: loginAuto,
    });
  };

  const deduireRole = (intitule) => {
    const i = intitule.toLowerCase();
    if (i.includes('directeur') || i.includes('dg')) return 'directeur';
    if (i.includes('chef') && i.includes('atelier')) return 'chef_atelier';
    if (i.includes('qhse') || i.includes('qualité')) return 'responsable_qhse';
    if (i.includes('rh') || i.includes('ressources humaines')) return 'responsable_rh';
    if (i.includes('r\u00e9gleur') || i.includes('regleur')) return 'technicien_regleur';
    if (i.includes('contrôleur') || i.includes('qualit')) return 'controleur_qualite';
    if (i.includes('comptable') || i.includes('finance')) return 'comptable';
    if (i.includes('gmao') || i.includes('maintenance')) return 'technicien_gmao';
    if (i.includes('commercial') || i.includes('vente')) return 'commercial';
    if (i.includes('emballeur')) return 'emballeur';
    if (i.includes('opérateur') || i.includes('operateur')) return 'operateur';
    return 'operateur';
  };

  const sauvegarder = async () => {
    try {
      if (form.id) {
        await axios.put(`${API}/utilisateurs/${form.id}`, form);
        toast.success('Utilisateur modifié ✓');
      } else {
        if (!form.password || form.password.length < 6)
          return toast.error('Mot de passe min. 6 caractères');
        await axios.post(`${API}/utilisateurs`, form);
        toast.success('Utilisateur créé ✓');
      }
      setShowForm(false); charger();
    } catch(e) { toast.error(e.response?.data?.detail || e.response?.data?.error || 'Erreur'); }
  };

  const resetPwd = async () => {
    if (!newPwd || newPwd.length < 6) return toast.error('Mot de passe trop court');
    try {
      await axios.post(`${API}/utilisateurs/${showReset}/reset-password`, {password:newPwd});
      toast.success('Mot de passe réinitialisé ✓');
      setShowReset(null); setNewPwd('');
    } catch { toast.error('Erreur'); }
  };

  const ROLE_COLORS = {
    super_admin:'#7f1d1d', directeur:'#1e3a5f', chef_atelier:'#1d4ed8',
    responsable_qhse:'#92400e', responsable_rh:'#0891b2', technicien_regleur:'#059669',
    operateur:'#374151', controleur_qualite:'#6d28d9', comptable:'#9d174d',
    responsable_stock:'#065f46', commercial:'#b45309', technicien_gmao:'#7c3aed',
    emballeur:'#6b7280',
  };

  const usersFiltres = users.filter(u =>
    (!filtreRole || u.role === filtreRole) &&
    (!search || `${u.nom} ${u.prenom} ${u.login}`.toLowerCase().includes(search.toLowerCase()))
  );

  const F = ({label,k,type='text',ph='',required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <input type={type} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nom, prénom, login..."
          style={{flex:1,minWidth:200,border:'1px solid #d1d5db',borderRadius:8,padding:'9px 14px',fontSize:13}}/>
        <select value={filtreRole} onChange={e=>setFiltreRole(e.target.value)}
          style={{border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:12}}>
          <option value="">Tous les rôles</option>
          {roles.map(r=><option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <button onClick={()=>{setForm({role:'operateur',actif:true});setShowForm(true);}}
          style={{background:'#1d4ed8',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
          + Nouvel utilisateur
        </button>
      </div>

      {/* Stats par rôle */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {roles.slice(0,6).map(r=>{
          const count = users.filter(u=>u.role===r.code).length;
          if (!count) return null;
          return (
            <div key={r.code} style={{background:'#f8fafc',border:'1px solid #e5e7eb',borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:600,cursor:'pointer',borderLeft:`4px solid ${ROLE_COLORS[r.code]||'#374151'}`}}
              onClick={()=>setFiltreRole(filtreRole===r.code?'':r.code)}>
              <span style={{color:ROLE_COLORS[r.code]||'#374151'}}>{r.label}</span>
              <span style={{marginLeft:6,background:'#e5e7eb',borderRadius:20,padding:'1px 6px'}}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Tableau */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:800}}>
          <thead>
            <tr style={{background:'#f0f4ff'}}>
              {['Login','Nom Prénom','Employé lié','Poste','Rôle','Atelier','Dernière connexion','Statut','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#1d4ed8',borderBottom:'2px solid #c7d2fe',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usersFiltres.map((u,i)=>(
              <tr key={u.id} style={{borderBottom:'1px solid #f0f4ff',background:i%2===0?'#fff':'#f8f9ff'}}>
                <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#1d4ed8',fontSize:12}}>{u.login}</td>
                <td style={{padding:'9px 14px',fontWeight:600}}>{u.nom} {u.prenom}</td>
                <td style={{padding:'9px 14px',fontSize:11}}>
                  {u.matricule ? (
                    <span style={{background:'#e0f2fe',color:'#0891b2',padding:'2px 8px',borderRadius:20,fontWeight:700,fontFamily:'monospace'}}>{u.matricule}</span>
                  ) : <span style={{color:'#d1d5db'}}>—</span>}
                </td>
                <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{u.poste_libelle||'—'}</td>
                <td style={{padding:'9px 14px'}}>
                  <span style={{background:(ROLE_COLORS[u.role]||'#374151')+'20',color:ROLE_COLORS[u.role]||'#374151',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                    {roles.find(r=>r.code===u.role)?.label || u.role}
                  </span>
                </td>
                <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{u.atelier_code||'—'}</td>
                <td style={{padding:'9px 14px',fontSize:11,color:'#9ca3af'}}>
                  {u.derniere_connexion ? new Date(u.derniere_connexion).toLocaleDateString('fr-FR') : 'Jamais'}
                </td>
                <td style={{padding:'9px 14px'}}>
                  <span style={{background:u.actif?'#dcfce7':'#fee2e2',color:u.actif?'#15803d':'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>
                    {u.actif?'Actif':'Inactif'}
                  </span>
                </td>
                <td style={{padding:'9px 14px'}}>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>{setForm({...u,atelier_id:u.atelier_id?String(u.atelier_id):'',employe_id:u.employe_id||''});setShowForm(true);}}
                      style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✏</button>
                    <button onClick={()=>setShowReset(u.id)}
                      style={{background:'#fee2e2',color:'#dc2626',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>🔑</button>
                    <button onClick={async()=>{await axios.put(`${API}/utilisateurs/${u.id}`,{...u,actif:!u.actif,atelier_id:u.atelier_id?String(u.atelier_id):''}); charger(); toast.success(u.actif?'Désactivé':'Activé');}}
                      style={{background:u.actif?'#f3f4f6':'#dcfce7',color:u.actif?'#6b7280':'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>
                      {u.actif?'Désactiver':'Activer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usersFiltres.length===0&&(
          <div style={{textAlign:'center',padding:40,color:'#9ca3af'}}>
            <div style={{fontSize:36,marginBottom:8}}>👥</div>
            <p>Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>

      {/* Formulaire création/édition */}
      {showForm && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:40,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:14,width:'95%',maxWidth:700,padding:24,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{margin:0,color:'#1d4ed8',fontSize:16,fontWeight:800}}>
                {form.id ? '✏ Modifier utilisateur' : '+ Nouvel utilisateur'}
              </h3>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer'}}>✕</button>
            </div>

            {/* Sélection employé → préremplissage automatique */}
            {!form.id && (
              <div style={{background:'#eff6ff',borderRadius:10,padding:14,marginBottom:16,border:'2px solid #bfdbfe'}}>
                <div style={{fontWeight:700,color:'#1d4ed8',marginBottom:8,fontSize:13}}>👤 Lier à un employé existant (recommandé)</div>
                <select value={form.employe_id||''} onChange={e=>selectionnerEmploye(e.target.value)}
                  style={{width:'100%',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px',fontSize:13}}>
                  <option value="">-- Sélectionner un employé --</option>
                  {employes.filter(e=>!users.find(u=>u.employe_id===e.id)).map(e=>(
                    <option key={e.id} value={e.id}>
                      {e.matricule} — {e.nom} {e.prenom} ({e.poste_libelle||'Sans poste'})
                    </option>
                  ))}
                </select>
                <div style={{fontSize:11,color:'#6b7280',marginTop:6}}>
                  💡 Seuls les employés sans compte utilisateur sont listés. La sélection prérempli automatiquement les champs ci-dessous.
                </div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:16}}>
              <F label="Nom *" k="nom" ph="NOM" required/>
              <F label="Prénom *" k="prenom" ph="Prénom" required/>
              <F label="Login *" k="login" ph="ali.kone" required/>
              {!form.id && <F label="Mot de passe *" k="password" type="password" ph="Min. 6 caractères" required/>}
              <F label="Email" k="email" type="email" ph="ali.kone@nai.ci"/>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Rôle *</label>
                <select value={form.role||'operateur'} onChange={e=>setForm({...form,role:e.target.value})}
                  style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                  {roles.map(r=><option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
                {form.role && (
                  <div style={{marginTop:6,fontSize:10,color:'#6b7280'}}>
                    Accès : {(roles.find(r=>r.code===form.role)?.acces||[]).join(', ')}
                  </div>
                )}
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Atelier</label>
                <select value={form.atelier_id||''} onChange={e=>setForm({...form,atelier_id:e.target.value})}
                  style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                  <option value="">-- Tous ateliers --</option>
                  {ateliers.map(a=><option key={a.id} value={String(a.id)}>{a.code} — {a.libelle}</option>)}
                </select>
              </div>
              {form.id && (
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="checkbox" id="actifCheck" checked={!!form.actif}
                    onChange={e=>setForm({...form,actif:e.target.checked})}/>
                  <label htmlFor="actifCheck" style={{fontSize:13,fontWeight:600}}>Compte actif</label>
                </div>
              )}
            </div>

            {/* Prévisualisation rôle */}
            {form.role && (
              <div style={{background:'#f0f4ff',borderRadius:10,padding:12,marginBottom:16,border:'1px solid #c7d2fe'}}>
                <div style={{fontSize:12,color:'#1d4ed8',fontWeight:700,marginBottom:4}}>
                  🔐 Permissions du rôle : {roles.find(r=>r.code===form.role)?.label}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(roles.find(r=>r.code===form.role)?.acces||[]).map(a=>(
                    <span key={a} style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:10,paddingTop:16,borderTop:'1px solid #f3f4f6'}}>
              <button onClick={sauvegarder}
                style={{background:'#1d4ed8',color:'#fff',border:'none',padding:'12px 32px',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:14}}>
                ✓ Enregistrer
              </button>
              <button onClick={()=>setShowForm(false)}
                style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset mot de passe */}
      {showReset && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1001,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:14,padding:24,width:380,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <h3 style={{margin:'0 0 16px',color:'#dc2626',fontSize:15,fontWeight:800}}>🔑 Réinitialiser le mot de passe</h3>
            <p style={{fontSize:13,color:'#6b7280',marginBottom:12}}>
              Utilisateur : <strong>{users.find(u=>u.id===showReset)?.login}</strong>
            </p>
            <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)}
              placeholder="Nouveau mot de passe (min. 6 caractères)"
              style={{width:'100%',border:'2px solid #fecdd3',borderRadius:8,padding:'10px',fontSize:13,boxSizing:'border-box',marginBottom:12}}/>
            <div style={{display:'flex',gap:8}}>
              <button onClick={resetPwd}
                style={{background:'#dc2626',color:'#fff',border:'none',padding:'10px 24px',borderRadius:8,cursor:'pointer',fontWeight:700,flex:1}}>
                Confirmer
              </button>
              <button onClick={()=>{setShowReset(null);setNewPwd('');}}
                style={{background:'#f3f4f6',border:'none',padding:'10px 16px',borderRadius:8,cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportSage() {
  const [loading, setLoading] = useState(false);
  const [historique, setHistorique] = useState([]);

  useEffect(() => {
    axios.get(`${API}/import/historique`).then(({data}) => setHistorique(data)).catch(() => {});
  }, []);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('fichier', file);
    try {
      const { data } = await axios.post(`${API}/import/sage`, fd);
      toast.success(`Import réussi — ${data.nb_of_importes} OF importés`);
      const h = await axios.get(`${API}/import/historique`);
      setHistorique(h.data);
    } catch { toast.error('Erreur import'); }
    finally { setLoading(false); e.target.value=''; }
  };

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ background:'#fff', borderRadius:14, padding:32, border:'1px solid #dcfce7', marginBottom:20 }}>
        <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:'#14532d' }}>Import commandes depuis Sage 100</h3>
        <p style={{ color:'#6b7280', fontSize:14, margin:'0 0 24px' }}>
          Exportez vos OF depuis Sage en Excel, puis importez-les ici.<br/>
          Colonnes : N° OF · Code client · Nom client · Réf article · Désignation · Cadence/h · Temps réglage · Quantité · Date livraison
        </p>
        <label style={{ display:'block', border:'2px dashed #86efac', borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background: loading ? '#f9fafb' : '#f0fdf4' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
          <div style={{ fontWeight:600, color:'#15803d', marginBottom:4 }}>{loading ? 'Import en cours...' : 'Cliquez pour choisir le fichier Excel'}</div>
          <div style={{ fontSize:12, color:'#9ca3af' }}>.xlsx ou .xls</div>
          <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display:'none' }} disabled={loading}/>
        </label>
      </div>

      {historique.length > 0 && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', fontWeight:700, fontSize:14 }}>Historique des imports</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Fichier','OF importés','Statut','Date','Par'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historique.map((h,i) => (
                <tr key={h.id} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'#fff':'#fafafa' }}>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{h.nom_fichier}</td>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'#15803d' }}>{h.nb_of_importes}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{h.statut}</span></td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>{new Date(h.created_at).toLocaleString('fr-FR')}</td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>{h.importe_par_nom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Referentiels() {
  const [onglet, setOnglet] = useState('familles');
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [formF, setFormF] = useState({ code:'', libelle:'' });
  const [formU, setFormU] = useState({ code:'', libelle:'', type:'masse' });
  const [formA, setFormA] = useState({ code:'', libelle:'', type:'production', localisation:'' });

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/referentiels/familles`),
      axios.get(`${API}/referentiels/unites`),
      axios.get(`${API}/ateliers`),
    ]).then(([f,u,a]) => { setFamilles(f.data); setUnites(u.data); setAteliers(a.data); }).catch(() => {});
  }, []);

  const creerFamille = async () => {
    try { await axios.post(`${API}/referentiels/familles`, formF); toast.success('Famille créée'); setFormF({code:'',libelle:''}); const {data}=await axios.get(`${API}/referentiels/familles`); setFamilles(data); } catch(e){ toast.error(e.response?.data?.error||'Erreur'); }
  };
  const creerAtelier = async () => {
    try { await axios.post(`${API}/ateliers`, formA); toast.success('Atelier créé'); setFormA({code:'',libelle:'',type:'production',localisation:''}); const {data}=await axios.get(`${API}/ateliers`); setAteliers(data); } catch(e){ toast.error(e.response?.data?.error||'Erreur'); }
  };
  const creerUnite = async () => {
    try { await axios.post(`${API}/referentiels/unites`, formU); toast.success('Unité créée'); setFormU({code:'',libelle:'',type:'masse'}); const {data}=await axios.get(`${API}/referentiels/unites`); setUnites(data); } catch(e){ toast.error(e.response?.data?.error||'Erreur'); }
  };

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:20, borderBottom:'2px solid #e5e7eb', paddingBottom:0 }}>
        {['familles','unites','ateliers'].map(t => (
          <button key={t} onClick={() => setOnglet(t)} style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontWeight:onglet===t?700:400, color:onglet===t?'#14532d':'#6b7280', borderBottom:onglet===t?'3px solid #14532d':'3px solid transparent', fontSize:13 }}>
            {t==='familles'?'Familles articles':t==='unites'?'Unités de mesure':'Ateliers / Services'}
          </button>
        ))}
      </div>

      {onglet === 'familles' && (
        <div>
          <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #e5e7eb', marginBottom:14, display:'flex', gap:10, alignItems:'flex-end' }}>
            {[['Code','code'],['Libellé','libelle']].map(([label,key]) => (
              <div key={key} style={{ flex:1 }}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                <input value={formF[key]} onChange={e => setFormF({...formF,[key]:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
            ))}
            <button onClick={creerFamille} style={{ background:'#14532d', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:600, flexShrink:0 }}>+ Ajouter</button>
          </div>
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#f0fdf4' }}>{['Code','Libellé','Nb articles'].map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#14532d', borderBottom:'2px solid #dcfce7' }}>{h}</th>)}</tr></thead>
              <tbody>{familles.map((f,i) => <tr key={f.id} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb' }}><td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700 }}>{f.code}</td><td style={{ padding:'10px 14px' }}>{f.libelle}</td><td style={{ padding:'10px 14px', color:'#6b7280' }}>{f.nb_articles}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {onglet === 'unites' && (
        <div>
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'12px 18px', marginBottom:18, fontSize:13, color:'#92400e' }}>
            <strong>⚠ Important :</strong> Les unités sont prédéfinies et standardisées. Activez uniquement celles que vous utilisez. Cela garantit que tous les calculs (poids, stocks, bilan matière) sont cohérents.
          </div>

          {[
            { type:'masse', label:'⚖️ Masse', couleur:'#dbeafe', texte:'#1d4ed8', unites:[
              { code:'KG', libelle:'Kilogramme' },
              { code:'G',  libelle:'Gramme' },
              { code:'T',  libelle:'Tonne' },
              { code:'MG', libelle:'Milligramme' },
              { code:'LB', libelle:'Livre (lb)' },
            ]},
            { type:'longueur', label:'📏 Longueur', couleur:'#dcfce7', texte:'#15803d', unites:[
              { code:'M',  libelle:'Mètre' },
              { code:'ML', libelle:'Mètre linéaire' },
              { code:'CM', libelle:'Centimètre' },
              { code:'MM', libelle:'Millimètre' },
              { code:'KM', libelle:'Kilomètre' },
            ]},
            { type:'surface', label:'📐 Surface', couleur:'#fef3c7', texte:'#92400e', unites:[
              { code:'M2',  libelle:'Mètre carré' },
              { code:'CM2', libelle:'Centimètre carré' },
              { code:'MM2', libelle:'Millimètre carré' },
              { code:'HA',  libelle:'Hectare' },
            ]},
            { type:'volume', label:'🧴 Volume', couleur:'#e0e7ff', texte:'#4338ca', unites:[
              { code:'L',   libelle:'Litre' },
              { code:'ML2', libelle:'Millilitre' },
              { code:'M3',  libelle:'Mètre cube' },
              { code:'CL',  libelle:'Centilitre' },
            ]},
            { type:'piece', label:'📦 Pièce / Colis', couleur:'#fce7f3', texte:'#9d174d', unites:[
              { code:'PC',     libelle:'Pièce' },
              { code:'SAC',    libelle:'Sac' },
              { code:'BOB',    libelle:'Bobine' },
              { code:'ROUL',   libelle:'Rouleau' },
              { code:'CARTON', libelle:'Carton' },
              { code:'PALETTE',libelle:'Palette' },
              { code:'BOTTE',  libelle:'Botte' },
              { code:'PACK',   libelle:'Pack' },
            ]},
            { type:'temps', label:'⏱ Temps', couleur:'#f0fdf4', texte:'#14532d', unites:[
              { code:'H',   libelle:'Heure' },
              { code:'MIN', libelle:'Minute' },
              { code:'J',   libelle:'Jour' },
            ]},
          ].map(groupe => {
            const actives = unites.filter(u => u.type === groupe.type).map(u => u.code);
            return (
              <div key={groupe.type} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', marginBottom:14, overflow:'hidden' }}>
                <div style={{ background:groupe.couleur, padding:'10px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:13, color:groupe.texte }}>{groupe.label}</span>
                  <span style={{ fontSize:12, color:groupe.texte, opacity:0.7 }}>{actives.length} activée{actives.length > 1 ? 's' : ''}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', padding:'12px 16px', gap:8 }}>
                  {groupe.unites.map(u => {
                    const active = actives.includes(u.code);
                    const toggle = async () => {
                      try {
                        // Chercher dans TOUTES les unités (actives et inactives)
                        const { data: toutesUnites } = await axios.get(`${API}/referentiels/unites/toutes`);
                        const existante = toutesUnites.find(x => x.code === u.code);
                        if (active) {
                          // Désactiver
                          if (existante) await axios.put(`${API}/referentiels/unites/${existante.id}`, { libelle:existante.libelle, type:existante.type, actif:false });
                        } else {
                          if (existante) {
                            // Réactiver (existe déjà en base)
                            await axios.put(`${API}/referentiels/unites/${existante.id}`, { libelle:u.libelle, type:groupe.type, actif:true });
                          } else {
                            // Créer (n'existe pas encore)
                            await axios.post(`${API}/referentiels/unites`, { code:u.code, libelle:u.libelle, type:groupe.type });
                          }
                        }
                        const { data } = await axios.get(`${API}/referentiels/unites`);
                        setUnites(data);
                      } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
                    };
                    return (
                      <div key={u.code} onClick={toggle} style={{
                        display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                        borderRadius:8, cursor:'pointer', border:'2px solid',
                        borderColor: active ? groupe.texte : '#e5e7eb',
                        background: active ? groupe.couleur : '#fafafa',
                        transition:'all .15s'
                      }}>
                        <div style={{
                          width:20, height:20, borderRadius:4, border:`2px solid ${active ? groupe.texte : '#d1d5db'}`,
                          background: active ? groupe.texte : '#fff',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
                        }}>
                          {active && <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color: active ? groupe.texte : '#374151' }}>{u.code}</div>
                          <div style={{ fontSize:11, color:'#6b7280' }}>{u.libelle}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 16px', fontSize:12, color:'#15803d', border:'1px solid #86efac' }}>
            ✓ <strong>Unités activées ({unites.length}) :</strong> {unites.map(u => u.code).join(' · ') || 'Aucune — cliquez sur les unités pour les activer'}
          </div>
        </div>
      )}

            {onglet === 'ateliers' && (
        <div>
          {/* Formulaire ajout */}
          <div style={{ background:'#fff', borderRadius:12, padding:16, border:'1px solid #e5e7eb', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:10 }}>Ajouter un atelier / service</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div style={{ flex:'0 0 90px' }}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Code *</label>
                <input value={formA?.code||''} onChange={e => setFormA({...formA, code:e.target.value})} placeholder="AT3" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box', textTransform:'uppercase' }}/>
              </div>
              <div style={{ flex:'1 1 180px' }}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Libellé *</label>
                <input value={formA?.libelle||''} onChange={e => setFormA({...formA, libelle:e.target.value})} placeholder="Atelier 3 — Production" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <div style={{ flex:'0 0 150px' }}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Type</label>
                <select value={formA?.type||'production'} onChange={e => setFormA({...formA, type:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                  <option value="production">Production</option>
                  <option value="mecanique">Mécanique</option>
                  <option value="technique">Technique</option>
                  <option value="achat">Achat</option>
                  <option value="vente">Vente</option>
                  <option value="transit">Transit</option>
                  <option value="qhse">QHSE</option>
                  <option value="magasin">Magasin</option>
                  <option value="rh">RH</option>
                  <option value="direction">Direction</option>
                </select>
              </div>
              <div style={{ flex:'1 1 140px' }}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Localisation</label>
                <input value={formA?.localisation||''} onChange={e => setFormA({...formA, localisation:e.target.value})} placeholder="Bâtiment A..." style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <button onClick={creerAtelier} style={{ background:'#14532d', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:600, flexShrink:0 }}>+ Ajouter</button>
            </div>
          </div>

          {/* Charger tous les ateliers (actifs + inactifs) */}
          {(() => {
            const chargerTous = () => axios.get(`${API}/ateliers?actif=tous`).then(({data}) => setAteliers(data)).catch(() => {});
            const toggleAtelier = async (a) => {
              try {
                await axios.put(`${API}/ateliers/${a.id}`, { ...a, actif: !a.actif });
                toast.success(a.actif ? 'Atelier désactivé' : 'Atelier réactivé');
                const { data } = await axios.get(`${API}/ateliers?actif=tous`);
                setAteliers(data);
              } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
            };

            const TYPE_COLORS2 = {
              production:'#dcfce7', mecanique:'#dbeafe', technique:'#e0e7ff',
              achat:'#fef3c7', vente:'#fce7f3', transit:'#f3f4f6',
              qhse:'#fee2e2', magasin:'#f0fdf4', rh:'#ede9fe', direction:'#fff7ed'
            };
            const TYPE_TEXTS2 = {
              production:'#15803d', mecanique:'#1d4ed8', technique:'#4338ca',
              achat:'#92400e', vente:'#9d174d', transit:'#374151',
              qhse:'#b91c1c', magasin:'#14532d', rh:'#7c3aed', direction:'#c2410c'
            };

            return (
              <div>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
                  <button onClick={chargerTous} style={{ background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                    Afficher tous (actifs + inactifs)
                  </button>
                </div>
                <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f0fdf4' }}>
                        {['Code','Libellé','Type','Localisation','Statut','Action'].map(h => (
                          <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#14532d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ateliers.map((a,i) => (
                        <tr key={a.id} style={{ borderBottom:'1px solid #f0fdf4', background: !a.actif ? '#f9f9f9' : i%2===0?'#fff':'#f9fefb', opacity: a.actif ? 1 : 0.6 }}>
                          <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color: a.actif ? '#14532d' : '#9ca3af' }}>{a.code}</td>
                          <td style={{ padding:'10px 14px', fontWeight:500 }}>{a.libelle}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:TYPE_COLORS2[a.type]||'#f3f4f6', color:TYPE_TEXTS2[a.type]||'#374151', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                              {a.type}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{a.localisation||'—'}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ color: a.actif ? '#16a34a' : '#dc2626', fontWeight:700, fontSize:12 }}>
                              {a.actif ? '● Actif' : '○ Inactif'}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            <button onClick={() => toggleAtelier(a)} style={{
                              background: a.actif ? '#fee2e2' : '#dcfce7',
                              color: a.actif ? '#dc2626' : '#15803d',
                              border: `1px solid ${a.actif ? '#fca5a5' : '#86efac'}`,
                              padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600
                            }}>
                              {a.actif ? 'Désactiver' : '✓ Réactiver'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ateliers.length === 0 && (
                    <div style={{ textAlign:'center', padding:32, color:'#9ca3af' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🏭</div>
                      <p>Aucun atelier — créez le premier ci-dessus</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function KPIRapports() {
  const perms = usePerms();
  const { user } = useAuth();
  const hasFinance = () => perms.has_finance || perms.is_super_admin || (user && user.role === "super_admin");
  const [trs, setTrs] = useState([]);
  const [rapports, setRapports] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    debut: (() => { const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().split('T')[0]; })(),
    fin: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/kpi/trs`),
      axios.get(`${API}/rapports`),
    ]).then(([t,r]) => { setTrs(t.data); setRapports(r.data); }).catch(() => {});
  }, []);

  const generer = async () => {
    setGenerating(true);
    try {
      await axios.post(`${API}/rapports/generer`, form);
      toast.success('Rapport généré !');
      const { data } = await axios.get(`${API}/rapports`);
      setRapports(data);
    } catch { toast.error('Erreur génération'); }
    finally { setGenerating(false); }
  };

  const couleurTRS = v => v >= 80 ? '#16a34a' : v >= 60 ? '#d97706' : '#dc2626';

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'#be185d' }}>Générer un rapport</h3>
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Du</label>
              <input type="date" value={form.debut} onChange={e => setForm({...form,debut:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Au</label>
              <input type="date" value={form.fin} onChange={e => setForm({...form,fin:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
            </div>
          </div>
          <button onClick={generer} disabled={generating} style={{ background:generating?'#d1d5db':'#be185d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer', fontWeight:700, width:'100%' }}>
            {generating ? '⏳ Génération...' : '📄 Générer PDF + Excel'}
          </button>
        </div>

        {trs.length > 0 && (
          <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
            <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700, color:'#14532d' }}>TRS par machine</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trs.slice(0,8)}>
                <XAxis dataKey="machine_code" tick={{ fontSize:10 }}/>
                <YAxis domain={[0,100]} tick={{ fontSize:10 }}/>
                <Tooltip formatter={v => v+'%'}/>
                <Bar dataKey="trs_pct" radius={[4,4,0,0]}>
                  {trs.slice(0,8).map((e,i) => <Cell key={i} fill={couleurTRS(e.trs_pct)}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {rapports.length > 0 && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden', marginTop:20 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', fontWeight:700, fontSize:14 }}>Rapports générés</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#fdf2f8' }}>{['Type','Période','Généré le','Télécharger'].map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#be185d', borderBottom:'2px solid #fbcfe8' }}>{h}</th>)}</tr></thead>
            <tbody>
              {Object.values(rapports.reduce((acc,r)=>{
                const key=r.periode_debut+'_'+r.periode_fin;
                if(!acc[key]) acc[key]={...r,pdf_id:null,excel_id:null};
                if(r.pdf_path) acc[key].pdf_id=r.id;
                if(r.excel_path) acc[key].excel_id=r.id;
                return acc;
              },{})).map((r,i) => (
                <tr key={i} style={{ borderBottom:'1px solid #fdf2f8', background:i%2===0?'#fff':'#fdfafc' }}>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:'#fce7f3', color:'#be185d', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{r.type}</span></td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12 }}>{r.periode_debut} → {r.periode_fin}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                  <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                    {r.pdf_id && <button onClick={async()=>{const {data}=await axios.get(`${API}/rapports/${r.pdf_id}/pdf`,{responseType:'blob'});const url=URL.createObjectURL(data);window.open(url,'_blank');}} style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', padding:'3px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>📄 PDF</button>}
                    {r.excel_id && <button onClick={async()=>{const {data}=await axios.get(`${API}/rapports/${r.excel_id}/excel`,{responseType:'blob'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download='rapport.xlsx';a.click();}} style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', padding:'3px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>📊 Excel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stock() {
  const [onglet, setOnglet] = useState('inventaire');
  const [inventaire, setInventaire] = useState([]);
  const [resume, setResume] = useState({});
  const [lots, setLots] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  // Filtres
  const [filtreArt, setFiltreArt] = useState('');
  const [filtreEmpl, setFiltreEmpl] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('disponible');
  // Formulaire entrée/sortie rapide
  const [showMvt, setShowMvt] = useState(false);
  const [typeMvt, setTypeMvt] = useState('entree');
  const [formMvt, setFormMvt] = useState({
    article_id:'', emplacement_id:'', qte:'', numero_lot:'',
    date_dlc:'', prix_unitaire:'', notes:'', type_mouvement:'reception_achat'
  });
  // Formulaire nouveau lot
  const [showLot, setShowLot] = useState(false);
  const [formLot, setFormLot] = useState({
    article_id:'', emplacement_id:'', numero_lot:'',
    qte_initiale:'', prix_unitaire:'0',
    date_fabrication:'', date_dlc:'', date_dluo:'',
    fournisseur_id:'', certificat_path:''
  });

  const charger = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtreArt) params.append('search', filtreArt);
    if (filtreEmpl) params.append('emplacement_id', filtreEmpl);
    try { const {data} = await axios.get(`${API}/stock/inventaire?${params}`); setInventaire(data); } 
    catch(e) { console.error('inventaire:',e.message); setInventaire([]); }
    try { const {data} = await axios.get(`${API}/stock/resume`); setResume(data); }
    catch(e) { console.error('resume:',e.message); }
    try { const {data} = await axios.get(`${API}/stock/lots?statut=${filtreStatut}${filtreArt?`&search=${filtreArt}`:''}`); setLots(data); }
    catch(e) { console.error('lots:',e.message); setLots([]); }
    try { const {data} = await axios.get(`${API}/emplacements`); setEmplacements(data); }
    catch(e) { console.error('emplacements:',e.message); setEmplacements([]); }
    try { const {data} = await axios.get(`${API}/articles`); setArticles(data); }
    catch(e) { console.error('articles:',e.message); setArticles([]); }
    finally { setLoading(false); }
  };

  const chargerMouvements = async () => {
    try {
      const { data } = await axios.get(`${API}/stock/mouvements?limit=50`);
      setMouvements(data);
    } catch {}
  };

  useEffect(() => { charger(); }, [filtreArt, filtreStatut, filtreEmpl]);
  useEffect(() => { if (onglet === 'mouvements') chargerMouvements(); }, [onglet]);

  const creerLot = async () => {
    if (!formLot.article_id) return toast.error('Article requis');
    if (!formLot.numero_lot) return toast.error('Numéro de lot requis');
    if (!formLot.qte_initiale) return toast.error('Quantité requise');
    try {
      await axios.post(`${API}/stock/lots`, formLot);
      toast.success(`Lot ${formLot.numero_lot} créé`);
      setShowLot(false);
      setFormLot({ article_id:'', emplacement_id:'', numero_lot:'', qte_initiale:'', prix_unitaire:'0', date_fabrication:'', date_dlc:'', date_dluo:'', fournisseur_id:'', certificat_path:'' });
      charger();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const mvtRapide = async () => {
    if (!formMvt.article_id) return toast.error('Sélectionnez un article');
    if (!formMvt.qte || parseFloat(formMvt.qte) <= 0) return toast.error('Quantité invalide');
    try {
      const endpoint = typeMvt === 'entree' ? `${API}/stock/entree` : `${API}/stock/sortie`;
      // Envoyer en JSON avec types corrects
      const payload = {
        article_id: formMvt.article_id,
        emplacement_id: formMvt.emplacement_id || null,
        qte: parseFloat(formMvt.qte),
        notes: formMvt.notes || null,
        type_mouvement: typeMvt === 'entree' ? 'entree_manuelle' : 'sortie_manuelle',
      };
      if (typeMvt === 'entree') {
        payload.numero_lot = formMvt.numero_lot || null;
        payload.date_dlc = formMvt.date_dlc || null;
        payload.prix_unitaire = parseFloat(formMvt.prix_unitaire) || 0;
      }
      await axios.post(endpoint, payload);
      toast.success(typeMvt === 'entree' ? '✓ Entrée enregistrée' : '✓ Sortie enregistrée');
      setShowMvt(false);
      setFormMvt({ article_id:'', emplacement_id:'', qte:'', numero_lot:'', date_dlc:'', prix_unitaire:'', notes:'' });
      charger();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur entrée/sortie'); }
  };

  const STATUT_LOT = {
    disponible: { bg:'#dcfce7', tx:'#15803d' },
    quarantaine: { bg:'#fef3c7', tx:'#92400e' },
    bloque:      { bg:'#fee2e2', tx:'#dc2626' },
    perime:      { bg:'#f3f4f6', tx:'#6b7280' },
    epuise:      { bg:'#f3f4f6', tx:'#9ca3af' },
  };

  const stockTotal = inventaire.reduce((s, i) => s + parseFloat(i.stock_total_dispo || 0), 0);
  const alertesBas = inventaire.filter(i => i.alerte_stock_bas).length;
  const lotsExpires = lots.filter(l => l.date_dlc && new Date(l.date_dlc) < new Date()).length;
  const lotsProches = lots.filter(l => {
    if (!l.date_dlc) return false;
    const diff = (new Date(l.date_dlc) - new Date()) / 86400000;
    return diff >= 0 && diff <= 30;
  }).length;

  return (
    <div>
      {/* KPI résumé */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Articles en stock', value: resume.nb_articles || inventaire.length, color:'#1d4ed8', bg:'#dbeafe', icon:'📦' },
          { label:'Valeur totale', value: hasFinance() ? `${parseFloat(resume.valeur_totale||0).toLocaleString('fr-FR')} FCFA` : '••••', color:'#15803d', bg:'#dcfce7', icon:'💰' },
          { label:'Alertes stock bas', value: resume.nb_alertes || alertesBas, color: (resume.nb_alertes||alertesBas)>0?'#dc2626':'#15803d', bg: (resume.nb_alertes||alertesBas)>0?'#fee2e2':'#dcfce7', icon:'⚠' },
          { label:'Lots actifs', value: resume.nb_lots_actifs || lots.filter(l=>l.statut==='disponible').length, color:'#15803d', bg:'#dcfce7', icon:'🏷' },
          { label:'Lots expirés', value: resume.nb_lots_expires || lotsExpires, color: (resume.nb_lots_expires||lotsExpires)>0?'#dc2626':'#15803d', bg: (resume.nb_lots_expires||lotsExpires)>0?'#fee2e2':'#dcfce7', icon:'⏰' },
          { label:'DLC < 30 jours', value: resume.nb_lots_proches || lotsProches, color: (resume.nb_lots_proches||lotsProches)>0?'#d97706':'#15803d', bg: (resume.nb_lots_proches||lotsProches)>0?'#fef3c7':'#dcfce7', icon:'📅' },
        ].map(k => (
          <div key={k.label} style={{ background:k.bg, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize:k.label==='Valeur totale'?14:26, fontWeight:800, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barre actions */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input value={filtreArt} onChange={e => setFiltreArt(e.target.value)}
          placeholder="🔍 Filtrer par article..."
          style={{ flex:1, minWidth:200, border:'1px solid #d1d5db', borderRadius:8, padding:'9px 14px', fontSize:13 }}/>
        <button onClick={() => { setTypeMvt('entree'); setShowMvt(true); }}
          style={{ background:'#15803d', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
          + Entrée
        </button>
        <button onClick={() => { setTypeMvt('sortie'); setShowMvt(true); }}
          style={{ background:'#dc2626', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
          − Sortie
        </button>
        <button onClick={() => setShowLot(true)}
          style={{ background:'#0369a1', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>
          🏷 Nouveau lot
        </button>
        <button onClick={charger} style={{ background:'#f3f4f6', color:'#374151', border:'1px solid #d1d5db', padding:'9px 14px', borderRadius:8, cursor:'pointer' }}>
          🔄
        </button>
      </div>

      {/* Formulaire entrée/sortie rapide */}
      {showMvt && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, border:`2px solid ${typeMvt==='entree'?'#86efac':'#fca5a5'}`, marginBottom:16, position:'relative', zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <h4 style={{ margin:0, color:typeMvt==='entree'?'#15803d':'#dc2626', fontWeight:700, fontSize:15 }}>
              {typeMvt==='entree' ? '+ Entrée stock' : '− Sortie stock'}
            </h4>
            <button onClick={() => setShowMvt(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Article *</label>
              <select value={formMvt.article_id} onChange={e => setFormMvt({...formMvt,article_id:e.target.value})}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                <option value="">-- Sélectionner --</option>
                {articles.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Emplacement</label>
              <select value={formMvt.emplacement_id} onChange={e => setFormMvt({...formMvt,emplacement_id:e.target.value})}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                <option value="">-- Sélectionner --</option>
                {emplacements.map(e => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Quantité *</label>
              <input type="number" step="0.001" value={formMvt.qte} onChange={e => setFormMvt({...formMvt,qte:e.target.value})}
                placeholder="0.000" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, textAlign:'center', boxSizing:'border-box' }}/>
            </div>
            {typeMvt === 'entree' && (
              <>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>N° Lot</label>
                  <input value={formMvt.numero_lot} onChange={e => setFormMvt({...formMvt,numero_lot:e.target.value})}
                    placeholder="LOT-20260429-001"
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, fontFamily:'monospace', boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Date DLC</label>
                  <input type="date" value={formMvt.date_dlc} onChange={e => setFormMvt({...formMvt,date_dlc:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Prix unitaire</label>
                  <input type="number" value={formMvt.prix_unitaire} onChange={e => setFormMvt({...formMvt,prix_unitaire:e.target.value})}
                    placeholder="0" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, textAlign:'center', boxSizing:'border-box' }}/>
                </div>
              </>
            )}
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Notes</label>
              <input value={formMvt.notes} onChange={e => setFormMvt({...formMvt,notes:e.target.value})}
                placeholder="Motif, référence..."
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13, boxSizing:'border-box' }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={mvtRapide}
              style={{ background:typeMvt==='entree'?'#15803d':'#dc2626', color:'#fff', border:'none', padding:'10px 28px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:14 }}>
              ✓ Confirmer {typeMvt==='entree'?'l\'entrée':'la sortie'}
            </button>
            <button onClick={() => setShowMvt(false)} style={{ background:'#f3f4f6', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Formulaire nouveau lot */}
      {showLot && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'2px solid #93c5fd', marginBottom:16, position:'relative', zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
            <h4 style={{ margin:0, color:'#0369a1', fontWeight:700, fontSize:15 }}>🏷 Créer un nouveau lot</h4>
            <button onClick={() => setShowLot(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:14 }}>
            {[
              ['Article *','article_id','select-art'],
              ['Emplacement','emplacement_id','select-empl'],
              ['N° Lot *','numero_lot','text'],
              ['Quantité initiale *','qte_initiale','number'],
              ['Prix unitaire','prix_unitaire','number'],
              ['Date fabrication','date_fabrication','date'],
              ['Date DLC','date_dlc','date'],
              ['Date DLUO','date_dluo','date'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                {type === 'select-art' ? (
                  <select value={formLot[key]} onChange={e => setFormLot({...formLot,[key]:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                    <option value="">-- Sélectionner --</option>
                    {articles.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
                  </select>
                ) : type === 'select-empl' ? (
                  <select value={formLot[key]} onChange={e => setFormLot({...formLot,[key]:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13 }}>
                    <option value="">-- Sélectionner --</option>
                    {emplacements.map(e => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
                  </select>
                ) : (
                  <input type={type} value={formLot[key]} onChange={e => setFormLot({...formLot,[key]:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'9px', fontSize:13,
                      boxSizing:'border-box', textAlign:type==='number'?'center':'left',
                      fontFamily:key==='numero_lot'?'monospace':'inherit' }}/>
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={creerLot} style={{ background:'#0369a1', color:'#fff', border:'none', padding:'10px 28px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>
              ✓ Créer le lot
            </button>
            <button onClick={() => setShowLot(false)} style={{ background:'#f3f4f6', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Navigation onglets */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'2px solid #e5e7eb' }}>
        {[
          ['inventaire','📊 Inventaire','État du stock par article'],
          ['lots','🏷 Lots','Chaque livraison reçue = 1 lot traçable'],
          ['mouvements','📋 Mouvements','Journal de toutes les entrées/sorties'],
          ['emplacements','🏭 Emplacements','Magasin MP, PF, Quarantaine...'],
        ].map(([id, label, tooltip]) => (
          <button key={id} onClick={() => setOnglet(id)} title={tooltip} style={{
            padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontSize:13,
            fontWeight: onglet===id ? 700 : 400,
            color: onglet===id ? '#1d4ed8' : '#6b7280',
            borderBottom: onglet===id ? '3px solid #1d4ed8' : '3px solid transparent',
          }}>
            {label}
            {onglet!==id && <div style={{fontSize:9,color:'#9ca3af',marginTop:2}}>{tooltip}</div>}
          </button>
        ))}
      </div>

      {/* ── INVENTAIRE ── */}
      {onglet === 'inventaire' && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
            <thead>
              <tr style={{ background:'#eff6ff' }}>
                {['Code','Article','Emplacement','Atelier','Unité','Stock dispo','Valeur','⚠','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#1d4ed8', borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventaire.map((a, i) => (
                <tr key={a.id} style={{ borderBottom:'1px solid #eff6ff', background: a.alerte_stock_bas ? '#fff7ed' : i%2===0?'#fff':'#f8faff' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8', fontSize:12 }}>{a.article_code||a.code}</td>
                  <td style={{ padding:'9px 14px', fontWeight:500, fontSize:12 }}>{a.designation}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ fontFamily:'monospace', background:'#e0e7ff', color:'#4338ca', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>
                      {a.emplacement_code||'—'}
                    </span>
                    <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{a.emplacement_libelle||''}</div>
                  </td>
                  <td style={{ padding:'9px 14px', fontSize:11, color:'#6b7280' }}>{a.atelier_code||'—'}</td>
                  <td style={{ padding:'9px 14px' }}><span style={{ fontFamily:'monospace', background:'#dbeafe', color:'#1d4ed8', padding:'2px 6px', borderRadius:4, fontSize:12 }}>{a.unite||'—'}</span></td>
                  <td style={{ padding:'9px 14px', fontWeight:800, fontSize:15, color: parseFloat(a.qte_disponible||0) === 0 ? '#dc2626' : '#15803d' }}>
                    {parseFloat(a.qte_disponible||0).toFixed(3)}
                  </td>
                  <td style={{ padding:'9px 14px', fontWeight:600 }}>
                    {hasFinance() ? `${parseFloat(a.valeur_stock||0).toLocaleString('fr-FR')} FCFA` : <span style={{color:'#d1d5db'}}>••••</span>}
                  </td>
                  <td style={{ padding:'9px 14px', textAlign:'center' }}>
                    {a.alerte_stock_bas && <span style={{ color:'#d97706', fontWeight:700 }}>⚠</span>}
                  </td>
                  <td style={{ padding:'9px 14px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>{ setTypeMvt('entree'); setFormMvt({...formMvt, article_id:a.id}); setShowMvt(true); }}
                        style={{ background:'#dcfce7', color:'#15803d', border:'none', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700 }}>
                        + Entrée
                      </button>
                      <button onClick={()=>{ setTypeMvt('sortie'); setFormMvt({...formMvt, article_id:a.id}); setShowMvt(true); }}
                        style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700 }}>
                        − Sortie
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {inventaire.length === 0 && (
            <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📦</div>
              <p>Aucun article en stock — faites une entrée pour commencer</p>
            </div>
          )}
        </div>
      )}

      {/* ── LOTS ── */}
      {onglet === 'lots' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            {['disponible','quarantaine','bloque','perime','epuise'].map(s => (
              <button key={s} onClick={() => setFiltreStatut(s)} style={{
                padding:'6px 14px', borderRadius:20, border:'2px solid',
                borderColor: filtreStatut===s ? STATUT_LOT[s]?.tx||'#374151' : '#e5e7eb',
                background: filtreStatut===s ? STATUT_LOT[s]?.bg||'#f3f4f6' : '#fff',
                color: filtreStatut===s ? STATUT_LOT[s]?.tx||'#374151' : '#6b7280',
                cursor:'pointer', fontSize:12, fontWeight: filtreStatut===s ? 700 : 400,
              }}>{s}</button>
            ))}
          </div>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:800 }}>
              <thead>
                <tr style={{ background:'#eff6ff' }}>
                  {['N° Lot','Article','Emplacement','Qté dispo','Qté init.','DLC','DLUO','Statut','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#1d4ed8', borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lots.map((l, i) => {
                  const sc = STATUT_LOT[l.statut] || STATUT_LOT.disponible;
                  const dlcDate = l.date_dlc ? new Date(l.date_dlc) : null;
                  const joursRestants = dlcDate ? Math.ceil((dlcDate - new Date()) / 86400000) : null;
                  const dlcColor = joursRestants !== null ? (joursRestants < 0 ? '#dc2626' : joursRestants < 30 ? '#d97706' : '#15803d') : '#9ca3af';
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid #eff6ff', background:i%2===0?'#fff':'#f8faff' }}>
                      <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:700, color:'#0369a1', fontSize:12 }}>{l.numero_lot}</td>
                      <td style={{ padding:'9px 14px', fontSize:12 }}>{l.article_code} — {l.article_designation?.substring(0,25)}</td>
                      <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280' }}>{l.emplacement_code||'—'}</td>
                      <td style={{ padding:'9px 14px', fontWeight:700, color: parseFloat(l.qte_disponible||0)===0?'#dc2626':'#15803d' }}>
                        {parseFloat(l.qte_disponible||0).toFixed(3)}
                      </td>
                      <td style={{ padding:'9px 14px', color:'#6b7280' }}>{parseFloat(l.qte_initiale||0).toFixed(3)}</td>
                      <td style={{ padding:'9px 14px', color:dlcColor, fontWeight: joursRestants!==null&&joursRestants<30?700:400 }}>
                        {dlcDate ? dlcDate.toLocaleDateString('fr-FR') : '—'}
                        {joursRestants !== null && <span style={{ fontSize:10, marginLeft:4 }}>({joursRestants}j)</span>}
                      </td>
                      <td style={{ padding:'9px 14px', color:'#6b7280', fontSize:12 }}>
                        {l.date_dluo ? new Date(l.date_dluo).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ padding:'9px 14px' }}>
                        <span style={{ background:sc.bg, color:sc.tx, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{l.statut}</span>
                      </td>
                      <td style={{ padding:'9px 14px' }}>
                        <div style={{ display:'flex', gap:5 }}>
                          {l.statut === 'disponible' && (
                            <button onClick={async () => {
                              try { await axios.put(`${API}/stock/lots/${l.id}`, { statut:'quarantaine' }); toast.success('Mis en quarantaine'); charger(); }
                              catch { toast.error('Erreur'); }
                            }} style={{ background:'#fef3c7', color:'#92400e', border:'none', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:10 }}>
                              Quarantaine
                            </button>
                          )}
                          {l.statut === 'quarantaine' && (
                            <button onClick={async () => {
                              try { await axios.put(`${API}/stock/lots/${l.id}`, { statut:'disponible' }); toast.success('Libéré'); charger(); }
                              catch { toast.error('Erreur'); }
                            }} style={{ background:'#dcfce7', color:'#15803d', border:'none', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:10 }}>
                              Libérer
                            </button>
                          )}
                          <button onClick={async () => {
                            if (!window.confirm('Bloquer ce lot ?')) return;
                            try { await axios.put(`${API}/stock/lots/${l.id}`, { statut:'bloque' }); toast.success('Lot bloqué'); charger(); }
                            catch { toast.error('Erreur'); }
                          }} style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:10 }}>
                            Bloquer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lots.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
                <p>Aucun lot avec le statut "{filtreStatut}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MOUVEMENTS ── */}
      {onglet === 'mouvements' && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
            <thead>
              <tr style={{ background:'#eff6ff' }}>
                {['Date','Article','Type','Emplacement','Quantité','N° Lot','Notes','Par'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#1d4ed8', borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m, i) => (
                <tr key={m.id} style={{ borderBottom:'1px solid #eff6ff', background:i%2===0?'#fff':'#f8faff' }}>
                  <td style={{ padding:'9px 14px', fontSize:12, whiteSpace:'nowrap' }}>{new Date(m.created_at).toLocaleString('fr-FR')}</td>
                  <td style={{ padding:'9px 14px', fontSize:12 }}>{m.article_code} — {m.article_designation?.substring(0,20)}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ background: m.type==='entree'?'#dcfce7':'#fee2e2', color: m.type==='entree'?'#15803d':'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {m.type==='entree'?'+ Entrée':'− Sortie'}
                    </span>
                  </td>
                  <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280' }}>{m.emplacement_code||'—'}</td>
                  <td style={{ padding:'9px 14px', fontWeight:700, color: m.type==='entree'?'#15803d':'#dc2626' }}>
                    {m.type==='entree'?'+':'-'}{parseFloat(m.qte||0).toFixed(3)}
                  </td>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11, color:'#0369a1' }}>{m.numero_lot||'—'}</td>
                  <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280' }}>{m.notes||'—'}</td>
                  <td style={{ padding:'9px 14px', fontSize:11, color:'#9ca3af' }}>{m.cree_par_nom||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mouvements.length === 0 && (
            <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
              <p>Aucun mouvement enregistré</p>
            </div>
          )}
        </div>
      )}

      {/* ── EMPLACEMENTS ── */}
      {onglet === 'emplacements' && (
        <div>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#eff6ff' }}>
                  {['Code','Libellé','Atelier','Type','Capacité max','Articles stockés'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#1d4ed8', borderBottom:'2px solid #bfdbfe' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emplacements.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom:'1px solid #eff6ff', background:i%2===0?'#fff':'#f8faff' }}>
                    <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8' }}>{e.code}</td>
                    <td style={{ padding:'9px 14px', fontWeight:500 }}>{e.libelle}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'#6b7280' }}>{e.atelier_libelle||e.atelier_code||'—'}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <span style={{ background:'#dbeafe', color:'#1d4ed8', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{e.type}</span>
                    </td>
                    <td style={{ padding:'9px 14px', color:'#6b7280' }}>{e.capacite_max_kg ? `${e.capacite_max_kg} kg` : '—'}</td>
                    <td style={{ padding:'9px 14px', color:'#374151' }}>
                      {inventaire.filter(a => a.emplacement_id === e.id).length} articles
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {emplacements.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
                <p>Aucun emplacement — créez-en dans Référentiels</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function Alertes() {
  const [alertes, setAlertes] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/alertes`),
      axios.get(`${API}/alertes/count`),
    ]).then(([a,c]) => { setAlertes(a.data); setCount(c.data.count); }).catch(() => {});
    const iv = setInterval(() => {
      axios.get(`${API}/alertes`).then(({data}) => setAlertes(data)).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const lire = async (id) => {
    await axios.put(`${API}/alertes/${id}/lire`);
    setAlertes(prev => prev.map(a => a.id===id ? {...a,lue:true} : a));
  };

  const lireTout = async () => {
    await axios.put(`${API}/alertes/lire-tout`);
    setAlertes(prev => prev.map(a => ({...a,lue:true})));
    toast.success('Toutes les alertes marquées comme lues');
  };

  const TYPE_CONFIG = {
    trs_bas:         { label:'TRS Bas',         icon:'📉', color:'#dc2626', bg:'#fee2e2' },
    rebus_eleve:     { label:'Rebus Élevé',      icon:'⚠️',  color:'#d97706', bg:'#fef3c7' },
    arret_long:      { label:'Arrêt Long',       icon:'⏹',  color:'#7c3aed', bg:'#ede9fe' },
    stock_bas:       { label:'Stock Bas',        icon:'📦',  color:'#0369a1', bg:'#e0f2fe' },
    objectif_atteint:{ label:'Objectif Atteint', icon:'🎯',  color:'#15803d', bg:'#dcfce7' },
  };

  const nonLues = alertes.filter(a => !a.lue).length;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>
          Alertes {nonLues > 0 && <span style={{ background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius:20, fontSize:12, marginLeft:8 }}>{nonLues}</span>}
        </h3>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => axios.post(`${API}/alertes/verifier`).then(() => toast.success('Vérification effectuée')).catch(() => {})}
            style={{ background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
            🔄 Vérifier
          </button>
          {nonLues > 0 && (
            <button onClick={lireTout} style={{ background:'#f3f4f6', border:'1px solid #d1d5db', color:'#374151', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
              Tout marquer lu
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {alertes.map(a => {
          const cfg = TYPE_CONFIG[a.type] || { label:a.type, icon:'⚡', color:'#374151', bg:'#f3f4f6' };
          return (
            <div key={a.id} style={{ background:a.lue?'#fafafa':cfg.bg, borderRadius:12, padding:'12px 16px', border:`1px solid ${a.lue?'#e5e7eb':cfg.color}`, opacity:a.lue?0.7:1, display:'flex', alignItems:'flex-start', gap:12 }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{cfg.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontWeight:700, color:cfg.color, fontSize:13 }}>{cfg.label}</span>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>{new Date(a.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div style={{ fontSize:13, color:'#374151', marginTop:4 }}>{a.message}</div>
              </div>
              {!a.lue && (
                <button onClick={() => lire(a.id)} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:18, padding:4 }}>✓</button>
              )}
            </div>
          );
        })}
        {alertes.length === 0 && (
          <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
            <p style={{ color:'#6b7280' }}>Aucune alerte — tout fonctionne normalement</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — CHEF ATELIER
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// PAGE PARAMÈTRES SYSTÈME (Super Admin)
// ══════════════════════════════════════════════════════════════
function ParametresSysteme() {
  const perms = usePerms();
  const { user } = useAuth();
  const [params, setParams] = useState([]);
  const [permRoles, setPermRoles] = useState([]);
  const [onglet, setOnglet] = useState('systeme');
  const [editing, setEditing] = useState({});
  const [logs, setLogs] = useState([]);

  const MODULES = ['dashboard','production','planning','stock','articles','bons_cession',
    'vente','achat','qhse','gmao','rh','kpi','ia','utilisateurs','parametres'];
  const ROLES = ['directeur','chef_atelier','responsable_qhse','responsable_rh',
    'technicien_regleur','operateur','controleur_qualite','comptable',
    'responsable_stock','commercial','technicien_gmao','emballeur'];
  const ROLE_LABELS = {
    directeur:'Directeur', chef_atelier:'Chef Atelier', responsable_qhse:'Resp. QHSE',
    responsable_rh:'Resp. RH', technicien_regleur:'Tech. Régleur', operateur:'Opérateur',
    controleur_qualite:'Ctrl. Qualité', comptable:'Comptable',
    responsable_stock:'Resp. Stock', commercial:'Commercial',
    technicien_gmao:'Tech. GMAO', emballeur:'Emballeur',
  };

  const charger = async () => {
    try {
      const [p, pr] = await Promise.all([
        axios.get(`${API}/parametres`),
        axios.get(`${API}/permissions/roles`),
      ]);
      setParams(p.data);
      setPermRoles(pr.data);
    } catch(e) { toast.error('Erreur chargement'); }
  };

  const chargerLogs = async () => {
    try { const {data}=await axios.get(`${API}/logs?limit=50`); setLogs(data); } catch {}
  };

  useEffect(() => { charger(); }, []);
  useEffect(() => { if (onglet==='logs') chargerLogs(); }, [onglet]);

  const sauverParam = async (cle, valeur) => {
    try {
      await axios.put(`${API}/parametres/${cle}`, {valeur});
      toast.success('Paramètre sauvegardé ✓');
      setEditing(prev => ({...prev, [cle]:false}));
      charger();
    } catch(e) { toast.error(e.response?.data?.detail || 'Erreur'); }
  };

  const togglePerm = async (role, module, field, currentVal) => {
    const perm = permRoles.find(p=>p.role===role&&p.module===module) || {
      role, module, peut_voir:false, peut_creer:false, peut_modifier:false, peut_supprimer:false, voir_finance:false
    };
    const updated = {...perm, [field]: !currentVal};
    try {
      await axios.put(`${API}/permissions/roles/${role}/${module}`, updated);
      charger();
    } catch { toast.error('Erreur'); }
  };

  const getPerm = (role, module, field) => {
    const p = permRoles.find(r=>r.role===role&&r.module===module);
    return p?.[field] || false;
  };

  if (!perms.is_super_admin && user && user.role !== 'super_admin') {
    return (
      <div style={{textAlign:'center',padding:80}}>
        <div style={{fontSize:60,marginBottom:16}}>🔒</div>
        <h2 style={{color:'#dc2626'}}>Accès Restreint</h2>
        <p style={{color:'#6b7280'}}>Cette page est réservée au Super Administrateur Sophopsy</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',borderRadius:14,padding:'20px 24px',marginBottom:20,display:'flex',gap:16,alignItems:'center'}}>
        <span style={{fontSize:32}}>⚙</span>
        <div>
          <div style={{fontWeight:800,color:'#fff',fontSize:18}}>Paramètres Système NAIdo</div>
          <div style={{color:'#a5b4fc',fontSize:13}}>Configuration réservée à Sophopsy — Super Administrateur</div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #e5e7eb',overflowX:'auto'}}>
        {[
          {id:'systeme',label:'⚙ Paramètres système'},
          {id:'permissions',label:'🔐 Permissions par rôle'},
          {id:'ia',label:'🤖 IA & Assistant'},
          {id:'logs',label:'📋 Logs activité'},
        ].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)} style={{
            padding:'10px 18px',border:'none',background:'none',cursor:'pointer',
            fontSize:12,whiteSpace:'nowrap',fontWeight:onglet===o.id?700:400,
            color:onglet===o.id?'#4338ca':'#6b7280',
            borderBottom:onglet===o.id?'3px solid #4338ca':'3px solid transparent',
          }}>{o.label}</button>
        ))}
      </div>

      {/* ══ PARAMÈTRES SYSTÈME ══ */}
      {onglet==='systeme' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(350px,1fr))',gap:12}}>
          {params.map(p=>(
            <div key={p.cle} style={{background:'#fff',borderRadius:10,border:'1px solid #e5e7eb',padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:'#1e1b4b'}}>{p.cle.replace(/_/g,' ')}</div>
                  <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{p.description}</div>
                </div>
                <span style={{background:'#f0f0ff',color:'#4338ca',padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{p.type_valeur}</span>
              </div>
              {editing[p.cle] ? (
                <div style={{display:'flex',gap:8}}>
                  <input defaultValue={p.valeur}
                    id={`param-${p.cle}`}
                    style={{flex:1,border:'2px solid #818cf8',borderRadius:6,padding:'7px',fontSize:13}}/>
                  <button onClick={()=>sauverParam(p.cle, document.getElementById(`param-${p.cle}`).value)}
                    style={{background:'#4338ca',color:'#fff',border:'none',padding:'7px 14px',borderRadius:6,cursor:'pointer',fontWeight:700}}>✓</button>
                  <button onClick={()=>setEditing(prev=>({...prev,[p.cle]:false}))}
                    style={{background:'#f3f4f6',border:'none',padding:'7px 10px',borderRadius:6,cursor:'pointer'}}>✕</button>
                </div>
              ) : (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontFamily:'monospace',fontSize:14,fontWeight:700,color:'#1e1b4b'}}>
                    {p.valeur==='***'?'•••••':p.valeur}
                  </span>
                  <button onClick={()=>setEditing(prev=>({...prev,[p.cle]:true}))}
                    style={{background:'#f0f0ff',color:'#4338ca',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏ Modifier</button>
                </div>
              )}
              <div style={{fontSize:10,color:'#d1d5db',marginTop:6}}>Modifiable par : {p.modifiable_par}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ PERMISSIONS PAR RÔLE ══ */}
      {onglet==='permissions' && (
        <div style={{overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:900}}>
            <thead>
              <tr style={{background:'#1e1b4b'}}>
                <th style={{padding:'10px 12px',textAlign:'left',color:'#fff',fontWeight:700,position:'sticky',left:0,background:'#1e1b4b',zIndex:10}}>Module</th>
                {ROLES.map(r=>(
                  <th key={r} style={{padding:'8px 6px',color:'#a5b4fc',fontWeight:600,textAlign:'center',whiteSpace:'nowrap',fontSize:10}}>
                    {ROLE_LABELS[r]||r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod,mi)=>(
                <tr key={mod} style={{background:mi%2===0?'#fff':'#f8f9ff'}}>
                  <td style={{padding:'8px 12px',fontWeight:700,color:'#1e1b4b',position:'sticky',left:0,background:mi%2===0?'#fff':'#f8f9ff',borderRight:'2px solid #e5e7eb'}}>
                    {mod}
                  </td>
                  {ROLES.map(role=>{
                    const voir = getPerm(role, mod, 'peut_voir');
                    const creer = getPerm(role, mod, 'peut_creer');
                    const fin = getPerm(role, mod, 'voir_finance');
                    return (
                      <td key={role} style={{padding:'6px',textAlign:'center',borderRight:'1px solid #f0f0ff'}}>
                        <div style={{display:'flex',gap:2,justifyContent:'center',flexDirection:'column',alignItems:'center'}}>
                          <button onClick={()=>togglePerm(role,mod,'peut_voir',voir)}
                            title="Voir" style={{
                              background:voir?'#dcfce7':'#fee2e2',color:voir?'#15803d':'#dc2626',
                              border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',fontSize:9,fontWeight:700,width:36
                            }}>{voir?'👁 Oui':'✗ Non'}</button>
                          {voir && <button onClick={()=>togglePerm(role,mod,'peut_creer',creer)}
                            title="Créer" style={{
                              background:creer?'#dbeafe':'#f3f4f6',color:creer?'#1d4ed8':'#9ca3af',
                              border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',fontSize:9,width:36
                            }}>{creer?'✏+':'✏-'}</button>}
                          {voir && <button onClick={()=>togglePerm(role,mod,'voir_finance',fin)}
                            title="Finance" style={{
                              background:fin?'#fef3c7':'#f3f4f6',color:fin?'#92400e':'#9ca3af',
                              border:'none',borderRadius:4,padding:'2px 5px',cursor:'pointer',fontSize:9,width:36
                            }}>{fin?'💰+':'💰-'}</button>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{marginTop:12,fontSize:11,color:'#9ca3af'}}>
            👁 = Voir le module | ✏± = Créer/Modifier | 💰± = Voir les données financières
          </div>
        </div>
      )}

      {/* ══ PARAMÈTRES IA ══ */}
      {onglet==='ia' && (
        <div style={{maxWidth:600}}>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,color:'#4338ca',marginBottom:16,fontSize:15}}>🤖 Configuration Assistant IA</div>
            {params.filter(p=>['ia_enabled','ia_modele','ia_contexte_entreprise'].includes(p.cle)).map(p=>(
              <div key={p.cle} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid #f3f4f6'}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{p.description}</div>
                {editing[p.cle] ? (
                  <div style={{display:'flex',gap:8}}>
                    {p.type_valeur==='boolean' ? (
                      <select id={`param-${p.cle}`} defaultValue={p.valeur}
                        style={{flex:1,border:'2px solid #818cf8',borderRadius:6,padding:'7px',fontSize:13}}>
                        <option value="true">Activé</option>
                        <option value="false">Désactivé</option>
                      </select>
                    ) : p.cle==='ia_contexte_entreprise' ? (
                      <textarea id={`param-${p.cle}`} defaultValue={p.valeur} rows={4}
                        style={{flex:1,border:'2px solid #818cf8',borderRadius:6,padding:'7px',fontSize:13,resize:'vertical'}}/>
                    ) : (
                      <input id={`param-${p.cle}`} defaultValue={p.valeur}
                        style={{flex:1,border:'2px solid #818cf8',borderRadius:6,padding:'7px',fontSize:13}}/>
                    )}
                    <button onClick={()=>sauverParam(p.cle, document.getElementById(`param-${p.cle}`).value)}
                      style={{background:'#4338ca',color:'#fff',border:'none',padding:'7px 14px',borderRadius:6,cursor:'pointer',fontWeight:700}}>✓</button>
                  </div>
                ) : (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8f9ff',borderRadius:8,padding:'10px 14px'}}>
                    <span style={{fontSize:13,color:'#1e1b4b'}}>{p.valeur}</span>
                    <button onClick={()=>setEditing(prev=>({...prev,[p.cle]:true}))}
                      style={{background:'#e0e7ff',color:'#4338ca',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{background:'#fffbeb',borderRadius:12,border:'1px solid #fde68a',padding:16,fontSize:12,color:'#92400e'}}>
            ⚠ L'assistant IA utilise l'API Anthropic Claude. Assurez-vous que la clé API est configurée côté serveur.
            Le contexte entreprise aide l'IA à donner des réponses adaptées à NAI.
          </div>
        </div>
      )}

      {/* ══ LOGS ACTIVITÉ ══ */}
      {onglet==='logs' && (
        <div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:700}}>
              <thead>
                <tr style={{background:'#1e1b4b'}}>
                  {['Date/Heure','Utilisateur','Action','Module','Détails'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',color:'#a5b4fc',fontWeight:700}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l,i)=>(
                  <tr key={l.id} style={{borderBottom:'1px solid #f0f0ff',background:i%2===0?'#fff':'#f8f9ff'}}>
                    <td style={{padding:'8px 12px',fontSize:11,color:'#6b7280',whiteSpace:'nowrap'}}>{new Date(l.created_at).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'8px 12px',fontWeight:600}}>{l.login} <span style={{fontSize:10,color:'#9ca3af'}}>{l.nom}</span></td>
                    <td style={{padding:'8px 12px'}}><span style={{background:'#e0e7ff',color:'#4338ca',padding:'1px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{l.action}</span></td>
                    <td style={{padding:'8px 12px',fontSize:11}}>{l.module||'—'}</td>
                    <td style={{padding:'8px 12px',fontSize:10,color:'#6b7280',maxWidth:200}}>{l.details?JSON.stringify(l.details).slice(0,100):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>📋</div><p>Aucun log d'activité</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}


export default function ChefAtelier() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ongletActif, setOngletActif] = useState('dashboard');
  const [sidebarOuverte, setSidebarOuverte] = useState(true);
  const [nbAlertes, setNbAlertes] = useState(0);
  const [perms, setPerms] = useState({ permissions:{}, is_super_admin:false, has_finance:false, role:'' });

  useEffect(() => {
    const chargerAlertes = () => {
      axios.get(`${API}/alertes/count`).then(({data}) => setNbAlertes(data.count)).catch(() => {});
    };
    const chargerPerms = async () => {
      try {
        const {data} = await axios.get(`${API}/permissions/moi`);
        setPerms(data);
        // Rediriger si pas accès au module actuel
        if (data.permissions && !data.is_super_admin) {
          const allowed = Object.keys(data.permissions).filter(k=>data.permissions[k]?.voir);
          if (!allowed.includes(ongletActif) && !allowed.includes('*')) {
            setOngletActif(allowed[0] || 'dashboard');
          }
        }
      } catch {}
    };
    chargerAlertes();
    chargerPerms();
    const iv = setInterval(chargerAlertes, 30000);
    return () => clearInterval(iv);
  }, []);

  const canAccess = (module) => {
    if (perms.is_super_admin) return true;
    if (perms.permissions?.['*']?.voir) return true;
    return perms.permissions?.[module]?.voir || false;
  };
  const hasFinance = () => perms.has_finance || perms.is_super_admin;

  const handleLogout = () => { logout(); navigate('/login'); };



  const MENU_ITEMS = [
    { id:'separator1',  label:'PRODUCTION',               separator:true },
    { id:'dashboard',   label:'Tableau de bord',           icon:'home',        color:'#1d4ed8' },
    { id:'df',          label:'Demandes de Fabrication', icon:'clipboard', color:'#7c3aed' },
  { id:'of',          label:'Ordres de Fabrication', icon:'clipboard', color:'#0369a1' },
  { id:'production',  label:'Suivi Production',          icon:'activity',    color:'#059669' },
    { id:'planning',    label:'Planning Machines',          icon:'calendar',    color:'#7c3aed' },
    { id:'rapportjour', label:'Rapports Journaliers',       icon:'file-text',   color:'#0891b2' },
    { id:'separator2',  label:'STOCKS & ARTICLES',          separator:true },
    { id:'articles',    label:'Articles (Produits)',        icon:'package',     color:'#b45309' },
    { id:'matieres',    label:'Matières Premières',        icon:'layers',      color:'#92400e' },
    { id:'stock',       label:'Stock',                     icon:'archive',     color:'#15803d' },
    { id:'cession',     label:'Bons de Cession',           icon:'shuffle',     color:'#1d4ed8' },
    { id:'separator3',  label:'VENTE & ACHAT',             separator:true },
    { id:'clients',     label:'Clients',                   icon:'users',       color:'#dc2626' },
    { id:'vente',       label:'Ventes',                    icon:'trending-up', color:'#059669' },
    { id:'fournisseurs',label:'Fournisseurs',              icon:'truck',       color:'#7c3aed' },
    { id:'achats',      label:'Commandes Achat',           icon:'shopping-cart',color:'#0891b2' },
    { id:'separator3b', label:'GMAO & MAINTENANCE',        separator:true },
    { id:'gmao',        label:'GMAO / Maintenance',        icon:'tool',        color:'#059669' },
    { id:'separator4',  label:'QHSE & MAINTENANCE',        separator:true },
    { id:'qhse',        label:'QHSE / NC',                 icon:'qhse',        color:'#b45309' },
    { id:'separator4b', label:'RESSOURCES HUMAINES',       separator:true },
    { id:'rh',          label:'RH — Employés & Paie',      icon:'users',       color:'#0891b2' },
    { id:'separator5',  label:'ADMIN & IA',                separator:true },
    { id:'kpi',         label:'KPI & Rapports',            icon:'bar-chart',   color:'#1d4ed8' },
    { id:'ia',          label:'Assistant IA',              icon:'cpu',         color:'#7c3aed' },
    { id:'utilisateurs',label:'Utilisateurs',              icon:'users',       color:'#6d28d9' },
    { id:'parametres',  label:'⚙ Paramètres Système',     separator:false,    icon:'settings',    color:'#1e1b4b' },
    { id:'separator6',  label:'RÉFÉRENTIELS',              separator:true },
    { id:'alertes',     label:'Alertes',                   icon:'bell',        color:'#dc2626' },
    { id:'parametres',  label:'⚙ Paramètres',  icon:'settings',    color:'#1e1b4b' },
  { id:'parametres',  label:'⚙ Paramètres', icon:'settings', color:'#1e1b4b' },
  { id:'referentiels',label:'Référentiels',              icon:'database',    color:'#374151' },
  ].filter(item => {
    if (item.separator) return true;
    if (perms.is_super_admin) return true;
    const moduleMap = {
      dashboard:'dashboard', production:'production', planning:'planning',
      rapportjour:'production', articles:'articles', matieres:'stock',
      stock:'stock', cession:'bons_cession', clients:'vente',
      vente:'vente', fournisseurs:'achat', achats:'achat',
      qhse:'qhse', gmao:'gmao', rh:'rh', kpi:'kpi', ia:'ia',
      utilisateurs:'utilisateurs', parametres:'parametres',
    };
    const mod = moduleMap[item.id];
    if (!mod) return true;
    return !perms.permissions || perms.permissions[mod]?.voir !== false;
  });

  const SECTIONS = {
    df:          <DemandesFabrication />,
    of:          <OrdresFabrication />,
    dashboard:   <Dashboard />,
    production:  <SuiviProduction />,
    planning:    <PlanningMachines />,
    rapportjour: <RapportsJournaliers />,
    articles:    <Articles />,
    matieres:    <MatieresPremières />,
    stock:       <Stock />,
    clients:     <Clients />,
    vente:       <Vente />,
    fournisseurs:<Fournisseurs />,
    achat:       <Achat />,
    cession:     <BonsCession />,
    qhse:        <QHSE />,
    rh:          <RH />,
    gmao:        <GMAO />,
    kpi:         <KPIRapports />,
    parametres:  <ParametresSysteme />,
    ia:          <AssistantIA />,
    users:       <Utilisateurs />,
    import:      <ImportSage />,
    alertes:     <Alertes />,
    referentiels:<Referentiels />,
  };

  const menuItem = MENU.find(m => m.id === ongletActif);

  return (
    <PermissionsContext.Provider value={perms}>
    <div style={{ display:'flex', height:'100vh', fontFamily:'system-ui,sans-serif', background:'#f8fafc' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: sidebarOuverte ? 240 : 60, flexShrink:0,
        background:'#111827', color:'#fff',
        display:'flex', flexDirection:'column',
        transition:'width .2s ease', overflow:'hidden'
      }}>
        {/* Logo */}
        <div style={{ padding:'16px 14px', borderBottom:'1px solid #1f2937', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, background:'#4ade80', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#14532d', fontSize:16, flexShrink:0 }}>N</div>
          {sidebarOuverte && (
            <div>
              <div style={{ fontWeight:700, fontSize:14, whiteSpace:'nowrap' }}>NAIdo ERP/MES</div>
              <div style={{ fontSize:10, color:'#6b7280', whiteSpace:'nowrap' }}>NAI</div>
            </div>
          )}
          <button onClick={() => setSidebarOuverte(!sidebarOuverte)}
            style={{ marginLeft:'auto', background:'none', border:'none', color:'#6b7280', cursor:'pointer', padding:4, flexShrink:0 }}>
            {sidebarOuverte ? '◀' : '▶'}
          </button>
        </div>

        {/* Menu */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {getMenuFiltre(user?.role).map(item => {
            if (item.separator) {
              return sidebarOuverte ? (
                <div key={item.id} style={{ padding:'12px 14px 4px', fontSize:10, fontWeight:700, color:'#4b5563', letterSpacing:1, textTransform:'uppercase', whiteSpace:'nowrap' }}>
                  {item.label}
                </div>
              ) : <div key={item.id} style={{ height:8 }}/>;
            }
            const actif = ongletActif === item.id;
            return (
              <button key={item.id} onClick={() => setOngletActif(item.id)}
                title={!sidebarOuverte ? item.label : ''}
                style={{
                  width:'100%', display:'flex', alignItems:'center', gap:10,
                  padding:'9px 14px', border:'none', background: actif ? '#1f2937' : 'none',
                  borderLeft: actif ? `3px solid ${item.color}` : '3px solid transparent',
                  color: actif ? '#fff' : '#9ca3af', cursor:'pointer',
                  fontSize:13, fontWeight: actif ? 600 : 400,
                  textAlign:'left', transition:'all .15s', position:'relative'
                }}>
                <span style={{ color: actif ? item.color : '#6b7280', flexShrink:0 }}>
                  <Icon d={ICONS[item.icon]} size={16}/>
                </span>
                {sidebarOuverte && <span style={{ whiteSpace:'nowrap', flex:1 }}>{item.label}</span>}
                {item.id === 'alertes' && nbAlertes > 0 && (
                  <span style={{ background:'#dc2626', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0 }}>
                    {nbAlertes > 9 ? '9+' : nbAlertes}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid #1f2937', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:30, height:30, background:'#374151', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          {sidebarOuverte && (
            <>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:12, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.prenom} {user?.nom}</div>
                <div style={{ fontSize:10, color:'#6b7280' }}>{user?.role}</div>
              </div>
              <button onClick={handleLogout} title="Déconnexion" style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', padding:4 }}>
                <Icon d={ICONS.logout} size={16}/>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <header style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <span style={{ fontWeight:700, fontSize:16, color:'#111827' }}>
              {menuItem && !menuItem.separator ? menuItem.label : ''}
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12, color:'#9ca3af' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </span>
            {nbAlertes > 0 && (
              <button onClick={() => setOngletActif('alertes')}
                style={{ background:'#fee2e2', border:'1px solid #fca5a5', color:'#dc2626', padding:'4px 12px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                ⚠ {nbAlertes} alerte{nbAlertes > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </header>

        {/* Zone de contenu */}
        <main style={{ flex:1, overflow:'auto', padding:24 }}>
          {SECTIONS[ongletActif] || <Dashboard />}
        </main>

        {/* Footer */}
        <footer style={{ background:'#fff', borderTop:'1px solid #e5e7eb', padding:'8px 24px', fontSize:11, color:'#9ca3af', textAlign:'center', flexShrink:0 }}>
          © 2026 NAIdo v3.0 — Logiciel créé par SOPHOPSY pour NAI
        </footer>
      </div>
    </div>
  </PermissionsContext.Provider>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE CLIENTS
// ══════════════════════════════════════════════════════════════
function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code:'',type:'B2B',raison_sociale:'',contact_nom:'',telephone:'',email:'',adresse:'',ville:'',pays:'Algérie',nif:'',rc:'',condition_paiement:'30_jours',delai_paiement_jours:'30',credit_limite:'0',notes:'' });

  const charger = async () => {
    try { const {data} = await axios.get(`${API}/vente/clients${search?`?search=${search}`:''}`); setClients(data); }
    catch {}
  };
  useEffect(() => { charger(); }, [search]);

  const ouvrir = (c=null) => {
    setEditing(c);
    setForm(c ? { code:c.code,type:c.type,raison_sociale:c.raison_sociale,contact_nom:c.contact_nom||'',telephone:c.telephone||'',email:c.email||'',adresse:c.adresse||'',ville:c.ville||'',pays:c.pays||'Algérie',nif:c.nif||'',rc:c.rc||'',condition_paiement:c.condition_paiement||'30_jours',delai_paiement_jours:c.delai_paiement_jours||30,credit_limite:c.credit_limite||0,notes:c.notes||'' }
      : { code:'',type:'B2B',raison_sociale:'',contact_nom:'',telephone:'',email:'',adresse:'',ville:'',pays:'Algérie',nif:'',rc:'',condition_paiement:'30_jours',delai_paiement_jours:'30',credit_limite:'0',notes:'' });
    setShowForm(true);
  };

  const sauvegarder = async () => {
    if (!form.code||!form.raison_sociale) return toast.error('Code et raison sociale requis');
    try {
      if (editing) await axios.put(`${API}/vente/clients/${editing.id}`, form);
      else await axios.post(`${API}/vente/clients`, form);
      toast.success(editing ? 'Client mis à jour' : 'Client créé');
      setShowForm(false); charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const TYPE_COLORS = { B2B:{bg:'#dbeafe',tx:'#1d4ed8'}, B2C:{bg:'#dcfce7',tx:'#15803d'}, B2G:{bg:'#fef3c7',tx:'#92400e'} };

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un client..."
          style={{flex:1,border:'1px solid #d1d5db',borderRadius:8,padding:'9px 14px',fontSize:13}}/>
        <button onClick={()=>ouvrir()} style={{background:'#0369a1',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
          + Nouveau client
        </button>
      </div>

      {showForm && (
        <div style={{background:'#fff',borderRadius:12,border:'2px solid #93c5fd',marginBottom:16}}>
          <div style={{background:'linear-gradient(135deg,#0369a1,#1d4ed8)',padding:'14px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'#fff',fontWeight:800,fontSize:15}}>{editing?'✏ Modifier client':'👤 Nouveau client'}</span>
            <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>✕</button>
          </div>
          <div style={{padding:20,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
            {[['Code *','code','text'],['Raison sociale *','raison_sociale','text'],['Type','type','select-type'],['Contact','contact_nom','text'],['Téléphone','telephone','text'],['Email','email','email'],['Adresse','adresse','text'],['Ville','ville','text'],['Pays','pays','text'],['NIF','nif','text'],['RC','rc','text'],['Crédit limite','credit_limite','number'],['Notes','notes','text']].map(([label,key,type])=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}</label>
                {type==='select-type'?(
                  <select value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                    <option value="B2B">B2B — Entreprise</option>
                    <option value="B2C">B2C — Particulier</option>
                    <option value="B2G">B2G — Gouvernement</option>
                  </select>
                ):(
                  <input type={type} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
                )}
              </div>
            ))}
          </div>
          <div style={{padding:'0 20px 20px',display:'flex',gap:10}}>
            <button onClick={sauvegarder} style={{background:'#0369a1',color:'#fff',border:'none',padding:'11px 32px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:14}}>
              {editing?'✓ Enregistrer':'✓ Créer'}
            </button>
            <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',padding:'11px 20px',borderRadius:10,cursor:'pointer'}}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
          <thead>
            <tr style={{background:'#eff6ff'}}>
              {['Code','Raison sociale','Type','Téléphone','Ville','Solde','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#0369a1',borderBottom:'2px solid #bfdbfe',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c,i)=>(
              <tr key={c.id} style={{borderBottom:'1px solid #eff6ff',background:i%2===0?'#fff':'#f8faff'}}>
                <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#0369a1',fontSize:12}}>{c.code}</td>
                <td style={{padding:'9px 14px',fontWeight:500}}>{c.raison_sociale}</td>
                <td style={{padding:'9px 14px'}}>
                  <span style={{background:TYPE_COLORS[c.type]?.bg||'#f3f4f6',color:TYPE_COLORS[c.type]?.tx||'#374151',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{c.type}</span>
                </td>
                <td style={{padding:'9px 14px',color:'#6b7280'}}>{c.telephone||'—'}</td>
                <td style={{padding:'9px 14px',color:'#6b7280'}}>{c.ville||'—'}</td>
                <td style={{padding:'9px 14px',fontWeight:700,color:parseFloat(c.solde_actuel||0)<0?'#dc2626':'#374151'}}>
                  {parseFloat(c.solde_actuel||0).toFixed(2)} FCFA
                </td>
                <td style={{padding:'9px 14px'}}>
                  <button onClick={()=>ouvrir(c)} style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏ Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>👤</div><p>Aucun client — créez le premier</p></div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE FOURNISSEURS
// ══════════════════════════════════════════════════════════════
function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code:'',raison_sociale:'',contact_nom:'',telephone:'',email:'',adresse:'',ville:'',pays:'Algérie',nif:'',condition_paiement:'30_jours',delai_paiement_jours:'30',notes:'' });

  const charger = async () => {
    try { const {data} = await axios.get(`${API}/achat/fournisseurs${search?`?search=${search}`:''}`); setFournisseurs(data); }
    catch {}
  };
  useEffect(() => { charger(); }, [search]);

  const ouvrir = (f=null) => {
    setEditing(f);
    setForm(f ? { code:f.code,raison_sociale:f.raison_sociale,contact_nom:f.contact_nom||'',telephone:f.telephone||'',email:f.email||'',adresse:f.adresse||'',ville:f.ville||'',pays:f.pays||'Algérie',nif:f.nif||'',condition_paiement:f.condition_paiement||'30_jours',delai_paiement_jours:f.delai_paiement_jours||30,notes:f.notes||'' }
      : { code:'',raison_sociale:'',contact_nom:'',telephone:'',email:'',adresse:'',ville:'',pays:'Algérie',nif:'',condition_paiement:'30_jours',delai_paiement_jours:'30',notes:'' });
    setShowForm(true);
  };

  const sauvegarder = async () => {
    if (!form.code||!form.raison_sociale) return toast.error('Code et raison sociale requis');
    try {
      if (editing) await axios.put(`${API}/achat/fournisseurs/${editing.id}`, form);
      else await axios.post(`${API}/achat/fournisseurs`, form);
      toast.success(editing ? 'Fournisseur mis à jour' : 'Fournisseur créé');
      setShowForm(false); charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un fournisseur..."
          style={{flex:1,border:'1px solid #d1d5db',borderRadius:8,padding:'9px 14px',fontSize:13}}/>
        <button onClick={()=>ouvrir()} style={{background:'#6d28d9',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
          + Nouveau fournisseur
        </button>
      </div>

      {showForm && (
        <div style={{background:'#fff',borderRadius:12,border:'2px solid #c4b5fd',marginBottom:16}}>
          <div style={{background:'linear-gradient(135deg,#6d28d9,#7c3aed)',padding:'14px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'#fff',fontWeight:800,fontSize:15}}>{editing?'✏ Modifier fournisseur':'🏭 Nouveau fournisseur'}</span>
            <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>✕</button>
          </div>
          <div style={{padding:20,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
            {[['Code *','code'],['Raison sociale *','raison_sociale'],['Contact','contact_nom'],['Téléphone','telephone'],['Email','email'],['Adresse','adresse'],['Ville','ville'],['NIF','nif'],['Notes','notes']].map(([label,key])=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}</label>
                <input value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}
                  style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
            ))}
          </div>
          <div style={{padding:'0 20px 20px',display:'flex',gap:10}}>
            <button onClick={sauvegarder} style={{background:'#6d28d9',color:'#fff',border:'none',padding:'11px 32px',borderRadius:10,cursor:'pointer',fontWeight:700}}>{editing?'✓ Enregistrer':'✓ Créer'}</button>
            <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',padding:'11px 20px',borderRadius:10,cursor:'pointer'}}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#f5f3ff'}}>
              {['Code','Raison sociale','Contact','Téléphone','Ville','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#6d28d9',borderBottom:'2px solid #c4b5fd'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fournisseurs.map((f,i)=>(
              <tr key={f.id} style={{borderBottom:'1px solid #f5f3ff',background:i%2===0?'#fff':'#faf5ff'}}>
                <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#6d28d9',fontSize:12}}>{f.code}</td>
                <td style={{padding:'9px 14px',fontWeight:500}}>{f.raison_sociale}</td>
                <td style={{padding:'9px 14px',color:'#6b7280'}}>{f.contact_nom||'—'}</td>
                <td style={{padding:'9px 14px',color:'#6b7280'}}>{f.telephone||'—'}</td>
                <td style={{padding:'9px 14px',color:'#6b7280'}}>{f.ville||'—'}</td>
                <td style={{padding:'9px 14px'}}>
                  <button onClick={()=>ouvrir(f)} style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏ Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {fournisseurs.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🏭</div><p>Aucun fournisseur — créez le premier</p></div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE VENTE — inspiré de Leinad Sale
// ══════════════════════════════════════════════════════════════
function Vente() {
  const [onglet, setOnglet] = useState('liste');
  const [ventes, setVentes] = useState([]);
  const [clients, setClients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState({});
  const [filtreStatut, setFiltreStatut] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [lignes, setLignes] = useState([]);
  const [form, setForm] = useState({ type_vente:'B2B',client_id:'',date_livraison_prevue:'',mode_paiement:'virement',taux_tva:'19',montant_remise:'0',reference_client:'',notes:'' });

  const charger = async () => {
    try {
      const [v,c,a,s] = await Promise.all([
        axios.get(`${API}/vente/ventes${filtreStatut?`?statut=${filtreStatut}`:''}`),
        axios.get(`${API}/vente/clients`),
        axios.get(`${API}/articles`),
        axios.get(`${API}/vente/ventes/stats/resume`),
      ]);
      setVentes(v.data); setClients(c.data); setArticles(a.data); setStats(s.data);
    } catch {}
  };
  useEffect(()=>{ charger(); },[filtreStatut]);

  const ajouterLigne = () => setLignes([...lignes,{article_id:'',designation:'',quantite:'1',prix_unitaire_ht:'0',taux_remise:'0',taux_tva:'19'}]);

  const creerVente = async () => {
    if (!lignes.length) return toast.error('Ajoutez au moins un article');
    try {
      await axios.post(`${API}/vente/ventes`,{...form,lignes});
      toast.success('Vente créée');
      setShowForm(false); setLignes([]); charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const changerStatut = async (id, statut) => {
    try { await axios.put(`${API}/vente/ventes/${id}/statut`,{statut}); toast.success(`Statut → ${statut}`); charger(); }
    catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const STATUT = { brouillon:{bg:'#f3f4f6',tx:'#6b7280'}, confirme:{bg:'#dbeafe',tx:'#1d4ed8'}, livre:{bg:'#fef3c7',tx:'#92400e'}, facture:{bg:'#f5f3ff',tx:'#7e22ce'}, paye:{bg:'#dcfce7',tx:'#15803d'}, annule:{bg:'#fee2e2',tx:'#dc2626'} };

  const totalLignes = lignes.reduce((s,l)=>{
    const ht = (parseFloat(l.quantite)||0)*(parseFloat(l.prix_unitaire_ht)||0)*(1-(parseFloat(l.taux_remise)||0)/100);
    return s + ht*(1+(parseFloat(l.taux_tva)||19)/100);
  },0);

  return (
    <div>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'CA TTC (année)',value:`${parseFloat(stats.ca_ttc||0).toLocaleString('fr-FR')} FCFA`,color:'#15803d',bg:'#dcfce7',icon:'💰'},
          {label:'Nb ventes',value:stats.nb_ventes||0,color:'#1d4ed8',bg:'#dbeafe',icon:'📋'},
          {label:'Encaissé',value:`${parseFloat(stats.total_encaisse||0).toLocaleString('fr-FR')} FCFA`,color:'#0369a1',bg:'#e0f2fe',icon:'✅'},
          {label:'Restant dû',value:`${parseFloat(stats.total_restant||0).toLocaleString('fr-FR')} FCFA`,color:parseFloat(stats.total_restant||0)>0?'#dc2626':'#15803d',bg:'#fee2e2',icon:'⏳'},
          {label:'Brouillons',value:stats.nb_brouillon||0,color:'#6b7280',bg:'#f3f4f6',icon:'📝'},
        ].map(k=>(
          <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:0,flex:1}}>
          {['','brouillon','confirme','livre','facture','paye','annule'].map(s=>(
            <button key={s} onClick={()=>setFiltreStatut(s)} style={{padding:'7px 14px',border:'1px solid #e5e7eb',background:filtreStatut===s?'#1d4ed8':'#fff',color:filtreStatut===s?'#fff':'#6b7280',cursor:'pointer',fontSize:12,fontWeight:filtreStatut===s?700:400,borderRadius:s===''?'8px 0 0 8px':s==='annule'?'0 8px 8px 0':'0'}}>
              {s||'Tous'}
            </button>
          ))}
        </div>
        <button onClick={()=>{ setShowForm(true); setLignes([]); }} style={{background:'#15803d',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,whiteSpace:'nowrap'}}>
          + Nouvelle vente
        </button>
      </div>

      {/* Formulaire création vente */}
      {showForm && (
        <div style={{background:'#fff',borderRadius:12,border:'2px solid #86efac',marginBottom:16}}>
          <div style={{background:'linear-gradient(135deg,#15803d,#16a34a)',padding:'14px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'#fff',fontWeight:800,fontSize:15}}>🧾 Nouvelle Vente</span>
            <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>✕</button>
          </div>
          <div style={{padding:20}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:16}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Client</label>
                <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                  <option value="">-- Client --</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.code} — {c.raison_sociale}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Type</label>
                <select value={form.type_vente} onChange={e=>setForm({...form,type_vente:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                  {['B2B','B2C','B2G'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Mode paiement</label>
                <select value={form.mode_paiement} onChange={e=>setForm({...form,mode_paiement:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                  {[['especes','Espèces'],['cheque','Chèque'],['virement','Virement'],['traite','Traite'],['mixte','Mixte']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Date livraison prévue</label>
                <input type="date" value={form.date_livraison_prevue} onChange={e=>setForm({...form,date_livraison_prevue:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Référence client</label>
                <input value={form.reference_client} onChange={e=>setForm({...form,reference_client:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Notes</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
            </div>

            {/* Lignes de vente */}
            <div style={{background:'#f8faff',borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontWeight:700,color:'#1d4ed8',fontSize:13}}>Lignes de vente</span>
                <button onClick={ajouterLigne} style={{background:'#1d4ed8',color:'#fff',border:'none',padding:'5px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700}}>+ Ajouter ligne</button>
              </div>
              {lignes.map((l,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,marginBottom:8,alignItems:'end'}}>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>Article</label>
                    <select value={l.article_id} onChange={e=>{
                      const art = articles.find(a=>a.id===e.target.value);
                      const nl=[...lignes]; nl[i]={...nl[i],article_id:e.target.value,designation:art?.designation||'',prix_unitaire_ht:art?.prix_vente||'0'};
                      setLignes(nl);
                    }} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12}}>
                      <option value="">-- Article --</option>
                      {articles.map(a=><option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>Qté</label>
                    <input type="number" value={l.quantite} onChange={e=>{const nl=[...lignes];nl[i]={...nl[i],quantite:e.target.value};setLignes(nl);}} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12,textAlign:'center',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>Prix HT</label>
                    <input type="number" value={l.prix_unitaire_ht} onChange={e=>{const nl=[...lignes];nl[i]={...nl[i],prix_unitaire_ht:e.target.value};setLignes(nl);}} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12,textAlign:'center',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>TVA %</label>
                    <input type="number" value={l.taux_tva} onChange={e=>{const nl=[...lignes];nl[i]={...nl[i],taux_tva:e.target.value};setLignes(nl);}} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12,textAlign:'center',boxSizing:'border-box'}}/>
                  </div>
                  <button onClick={()=>setLignes(lignes.filter((_,j)=>j!==i))} style={{background:'#fee2e2',color:'#dc2626',border:'none',padding:'8px 10px',borderRadius:6,cursor:'pointer',fontWeight:700}}>✕</button>
                </div>
              ))}
              {lignes.length>0&&(
                <div style={{textAlign:'right',fontWeight:800,fontSize:15,color:'#15803d',marginTop:8,paddingTop:8,borderTop:'2px solid #dcfce7'}}>
                  Total TTC : {totalLignes.toLocaleString('fr-FR',{minimumFractionDigits:2})} FCFA
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:10}}>
              <button onClick={creerVente} style={{background:'#15803d',color:'#fff',border:'none',padding:'12px 32px',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:14}}>✓ Créer la vente</button>
              <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Liste ventes */}
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
          <thead>
            <tr style={{background:'#f0fdf4'}}>
              {['N° Vente','Client','Type','Date','Montant TTC','Payé','Statut','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#15803d',borderBottom:'2px solid #86efac',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ventes.map((v,i)=>{
              const sc=STATUT[v.statut]||STATUT.brouillon;
              return (
                <tr key={v.id} style={{borderBottom:'1px solid #f0fdf4',background:i%2===0?'#fff':'#f8fff8'}}>
                  <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#15803d',fontSize:12}}>{v.numero_vente}</td>
                  <td style={{padding:'9px 14px',fontSize:12}}>{v.client_nom||<span style={{color:'#9ca3af'}}>—</span>}</td>
                  <td style={{padding:'9px 14px'}}><span style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 6px',borderRadius:20,fontSize:11,fontWeight:700}}>{v.type_vente}</span></td>
                  <td style={{padding:'9px 14px',fontSize:12,color:'#6b7280'}}>{new Date(v.date_vente).toLocaleDateString('fr-FR')}</td>
                  <td style={{padding:'9px 14px',fontWeight:700}}>{parseFloat(v.montant_ttc||0).toLocaleString('fr-FR')} FCFA</td>
                  <td style={{padding:'9px 14px',fontWeight:700,color:parseFloat(v.solde_restant||0)>0?'#dc2626':'#15803d'}}>
                    {parseFloat(v.montant_paye||0).toLocaleString('fr-FR')} FCFA
                  </td>
                  <td style={{padding:'9px 14px'}}><span style={{background:sc.bg,color:sc.tx,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{v.statut}</span></td>
                  <td style={{padding:'9px 14px'}}>
                    <div style={{display:'flex',gap:4}}>
                      {v.statut==='brouillon'&&<button onClick={()=>changerStatut(v.id,'confirme')} style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Confirmer</button>}
                      {v.statut==='confirme'&&<button onClick={()=>changerStatut(v.id,'livre')} style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Livrer</button>}
                      {v.statut==='livre'&&<button onClick={()=>changerStatut(v.id,'paye')} style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Payer</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ventes.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🧾</div><p>Aucune vente — créez la première</p></div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE ACHAT — inspiré de Leinad PurchaseOrder
// ══════════════════════════════════════════════════════════════
function Achat() {
  const [commandes, setCommandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [lignes, setLignes] = useState([]);
  const [form, setForm] = useState({ fournisseur_id:'',date_commande:new Date().toISOString().split('T')[0],date_livraison_prevue:'',taux_tva:'19',reference_fournisseur:'',notes:'' });

  const charger = async () => {
    try {
      const [c,f,a] = await Promise.all([
        axios.get(`${API}/achat/commandes${filtreStatut?`?statut=${filtreStatut}`:''}`),
        axios.get(`${API}/achat/fournisseurs`),
        axios.get(`${API}/articles`),
      ]);
      setCommandes(c.data); setFournisseurs(f.data); setArticles(a.data);
    } catch {}
  };
  useEffect(()=>{ charger(); },[filtreStatut]);

  const ajouterLigne = () => setLignes([...lignes,{article_id:'',designation:'',quantite_commandee:'1',prix_unitaire_ht:'0',taux_tva:'19'}]);

  const creerCommande = async () => {
    if (!lignes.length) return toast.error('Ajoutez au moins un article');
    try {
      await axios.post(`${API}/achat/commandes`,{...form,lignes});
      toast.success('Commande créée');
      setShowForm(false); setLignes([]); charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const changerStatut = async (id,statut) => {
    try { await axios.put(`${API}/achat/commandes/${id}/statut`,{statut}); toast.success(`Statut → ${statut}`); charger(); }
    catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const STATUT = { brouillon:{bg:'#f3f4f6',tx:'#6b7280'}, envoye:{bg:'#dbeafe',tx:'#1d4ed8'}, confirme:{bg:'#fef3c7',tx:'#92400e'}, receptionne_partiel:{bg:'#f5f3ff',tx:'#7e22ce'}, receptionne:{bg:'#dcfce7',tx:'#15803d'}, annule:{bg:'#fee2e2',tx:'#dc2626'} };

  const totalLignes = lignes.reduce((s,l)=>{
    const ht=(parseFloat(l.quantite_commandee)||0)*(parseFloat(l.prix_unitaire_ht)||0);
    return s+ht*(1+(parseFloat(l.taux_tva)||19)/100);
  },0);

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:0,flex:1}}>
          {['','brouillon','envoye','confirme','receptionne','annule'].map(s=>(
            <button key={s} onClick={()=>setFiltreStatut(s)} style={{padding:'7px 14px',border:'1px solid #e5e7eb',background:filtreStatut===s?'#6d28d9':'#fff',color:filtreStatut===s?'#fff':'#6b7280',cursor:'pointer',fontSize:12,fontWeight:filtreStatut===s?700:400,borderRadius:s===''?'8px 0 0 8px':s==='annule'?'0 8px 8px 0':'0'}}>
              {s||'Tous'}
            </button>
          ))}
        </div>
        <button onClick={()=>{ setShowForm(true); setLignes([]); }} style={{background:'#6d28d9',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,whiteSpace:'nowrap'}}>
          + Nouvelle commande
        </button>
      </div>

      {showForm && (
        <div style={{background:'#fff',borderRadius:12,border:'2px solid #c4b5fd',marginBottom:16}}>
          <div style={{background:'linear-gradient(135deg,#6d28d9,#7c3aed)',padding:'14px 24px',borderRadius:'12px 12px 0 0',display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'#fff',fontWeight:800,fontSize:15}}>🛒 Nouvelle Commande Achat</span>
            <button onClick={()=>setShowForm(false)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',borderRadius:6,padding:'4px 12px',cursor:'pointer'}}>✕</button>
          </div>
          <div style={{padding:20}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:16}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Fournisseur</label>
                <select value={form.fournisseur_id} onChange={e=>setForm({...form,fournisseur_id:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
                  <option value="">-- Fournisseur --</option>
                  {fournisseurs.map(f=><option key={f.id} value={f.id}>{f.code} — {f.raison_sociale}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Date commande</label>
                <input type="date" value={form.date_commande} onChange={e=>setForm({...form,date_commande:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Livraison prévue</label>
                <input type="date" value={form.date_livraison_prevue} onChange={e=>setForm({...form,date_livraison_prevue:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Réf. fournisseur</label>
                <input value={form.reference_fournisseur} onChange={e=>setForm({...form,reference_fournisseur:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Notes</label>
                <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
              </div>
            </div>

            <div style={{background:'#f5f3ff',borderRadius:10,padding:14,marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontWeight:700,color:'#6d28d9',fontSize:13}}>Lignes de commande</span>
                <button onClick={ajouterLigne} style={{background:'#6d28d9',color:'#fff',border:'none',padding:'5px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700}}>+ Ajouter ligne</button>
              </div>
              {lignes.map((l,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:8,marginBottom:8,alignItems:'end'}}>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>Article</label>
                    <select value={l.article_id} onChange={e=>{
                      const art=articles.find(a=>a.id===e.target.value);
                      const nl=[...lignes]; nl[i]={...nl[i],article_id:e.target.value,designation:art?.designation||'',prix_unitaire_ht:art?.prix_achat||'0'};
                      setLignes(nl);
                    }} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12}}>
                      <option value="">-- Article / MP --</option>
                      {articles.map(a=><option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>Qté commandée</label>
                    <input type="number" value={l.quantite_commandee} onChange={e=>{const nl=[...lignes];nl[i]={...nl[i],quantite_commandee:e.target.value};setLignes(nl);}} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12,textAlign:'center',boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:'#6b7280',display:'block',marginBottom:2}}>Prix HT</label>
                    <input type="number" value={l.prix_unitaire_ht} onChange={e=>{const nl=[...lignes];nl[i]={...nl[i],prix_unitaire_ht:e.target.value};setLignes(nl);}} style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px',fontSize:12,textAlign:'center',boxSizing:'border-box'}}/>
                  </div>
                  <button onClick={()=>setLignes(lignes.filter((_,j)=>j!==i))} style={{background:'#fee2e2',color:'#dc2626',border:'none',padding:'8px 10px',borderRadius:6,cursor:'pointer',fontWeight:700}}>✕</button>
                </div>
              ))}
              {lignes.length>0&&(
                <div style={{textAlign:'right',fontWeight:800,fontSize:15,color:'#6d28d9',marginTop:8,paddingTop:8,borderTop:'2px solid #c4b5fd'}}>
                  Total TTC : {totalLignes.toLocaleString('fr-FR',{minimumFractionDigits:2})} FCFA
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={creerCommande} style={{background:'#6d28d9',color:'#fff',border:'none',padding:'12px 32px',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:14}}>✓ Créer la commande</button>
              <button onClick={()=>setShowForm(false)} style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
          <thead>
            <tr style={{background:'#f5f3ff'}}>
              {['N° Commande','Fournisseur','Date','Livraison','Montant TTC','Statut','Actions'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#6d28d9',borderBottom:'2px solid #c4b5fd',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {commandes.map((c,i)=>{
              const sc=STATUT[c.statut]||STATUT.brouillon;
              return (
                <tr key={c.id} style={{borderBottom:'1px solid #f5f3ff',background:i%2===0?'#fff':'#faf5ff'}}>
                  <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#6d28d9',fontSize:12}}>{c.numero_commande}</td>
                  <td style={{padding:'9px 14px',fontSize:12}}>{c.fournisseur_nom||'—'}</td>
                  <td style={{padding:'9px 14px',fontSize:12,color:'#6b7280'}}>{c.date_commande?new Date(c.date_commande).toLocaleDateString('fr-FR'):'—'}</td>
                  <td style={{padding:'9px 14px',fontSize:12,color:'#6b7280'}}>{c.date_livraison_prevue?new Date(c.date_livraison_prevue).toLocaleDateString('fr-FR'):'—'}</td>
                  <td style={{padding:'9px 14px',fontWeight:700}}>{parseFloat(c.montant_ttc||0).toLocaleString('fr-FR')} FCFA</td>
                  <td style={{padding:'9px 14px'}}><span style={{background:sc.bg,color:sc.tx,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{c.statut}</span></td>
                  <td style={{padding:'9px 14px'}}>
                    <div style={{display:'flex',gap:4}}>
                      {c.statut==='brouillon'&&<button onClick={()=>changerStatut(c.id,'envoye')} style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Envoyer</button>}
                      {c.statut==='envoye'&&<button onClick={()=>changerStatut(c.id,'confirme')} style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Confirmer</button>}
                      {c.statut==='confirme'&&<button onClick={()=>changerStatut(c.id,'receptionne')} style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Réceptionner</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {commandes.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🛒</div><p>Aucune commande — créez la première</p></div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE RH
// ══════════════════════════════════════════════════════════════
function RH() {
  const [onglet, setOnglet] = useState('dashboard');
  const [dashboard, setDashboard] = useState({});
  const [employes, setEmployes] = useState([]);
  const [postes, setPostes] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [contrats, setContrats] = useState([]);
  const [conges, setConges] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const charger = async () => {
    try { const {data} = await axios.get(`${API}/rh/dashboard`); setDashboard(data); } catch {}
    try { const {data} = await axios.get(`${API}/rh/postes`); setPostes(data); } catch {}
    try { const {data} = await axios.get(`${API}/ateliers`); setAteliers(data); } catch {}
  };

  const chargerOnglet = async (tab) => {
    setOnglet(tab); setDetail(null);
    try {
      if (tab==='employes') { const {data}=await axios.get(`${API}/rh/employes${search?`?search=${search}`:''}`); setEmployes(data); }
      else if (tab==='contrats') { const {data}=await axios.get(`${API}/rh/contrats`); setContrats(data); }
      else if (tab==='conges') { const {data}=await axios.get(`${API}/rh/conges`); setConges(data); }
      else if (tab==='paie') { const {data}=await axios.get(`${API}/rh/bulletins`); setBulletins(data); }
    } catch(e) { toast.error('Erreur: '+e.message); }
  };

  useEffect(() => { charger(); chargerOnglet('dashboard'); }, []);

  const ouvrir = (type, data={}) => { setFormType(type); setForm(data); setShowForm(true); };

  const sauvegarder = async () => {
    try {
      const urls = { employe:'/rh/employes', contrat:'/rh/contrats', conge:'/rh/conges', bulletin:'/rh/bulletins', poste:'/rh/postes' };
      const url = urls[formType];
      if (!url) return;
      if (form.id) await axios.put(`${API}${url}/${form.id}`, form);
      else await axios.post(`${API}${url}`, form);
      toast.success('Enregistré ✓');
      setShowForm(false);
      chargerOnglet(formType==='employe'?'employes':formType==='contrat'?'contrats':formType==='conge'?'conges':formType==='bulletin'?'paie':'employes');
      charger();
    } catch(e) { toast.error(e.response?.data?.error||'Erreur'); }
  };

  const F = ({label,k,type='text',ph='',required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <input type={type} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
    </div>
  );
  const S = ({label,k,opts,required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <select value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
        <option value="">-- Sélectionner --</option>
        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  const STATUT_EMP = {
    actif:{bg:'#dcfce7',tx:'#15803d'}, conge:{bg:'#dbeafe',tx:'#1d4ed8'},
    suspendu:{bg:'#fef3c7',tx:'#92400e'}, demissionne:{bg:'#fee2e2',tx:'#dc2626'},
    licencie:{bg:'#fee2e2',tx:'#dc2626'}, retraite:{bg:'#f3f4f6',tx:'#6b7280'}
  };
  const STATUT_CONGE = {
    en_attente:{bg:'#fef3c7',tx:'#92400e'}, approuve:{bg:'#dcfce7',tx:'#15803d'},
    refuse:{bg:'#fee2e2',tx:'#dc2626'}, annule:{bg:'#f3f4f6',tx:'#6b7280'}
  };

  return (
    <div>
      {/* Navigation */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #e5e7eb',overflowX:'auto'}}>
        {[
          {id:'dashboard',label:'📊 Tableau de bord'},
          {id:'employes',label:'👥 Employés'},
          {id:'contrats',label:'📋 Contrats'},
          {id:'conges',label:'🏖 Congés'},
          {id:'paie',label:'💰 Paie'},
        ].map(o=>(
          <button key={o.id} onClick={()=>chargerOnglet(o.id)} style={{
            padding:'10px 18px',border:'none',background:'none',cursor:'pointer',
            fontSize:12,whiteSpace:'nowrap',
            fontWeight:onglet===o.id?700:400,
            color:onglet===o.id?'#0891b2':'#6b7280',
            borderBottom:onglet===o.id?'3px solid #0891b2':'3px solid transparent',
          }}>{o.label}</button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {onglet==='dashboard' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:24}}>
            {[
              {icon:'👥',label:'Employés actifs',value:dashboard.nb_employes||0,color:'#0891b2',bg:'#e0f2fe'},
              {icon:'♂',label:'Hommes',value:dashboard.nb_hommes||0,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'♀',label:'Femmes',value:dashboard.nb_femmes||0,color:'#9d174d',bg:'#fce7f3'},
              {icon:'📋',label:'CDI',value:dashboard.nb_cdi||0,color:'#15803d',bg:'#dcfce7'},
              {icon:'⏳',label:'CDD',value:dashboard.nb_cdd||0,color:'#92400e',bg:'#fef3c7'},
              {icon:'🏖',label:'Congés en attente',value:dashboard.conges_en_attente||0,color:dashboard.conges_en_attente>0?'#d97706':'#15803d',bg:dashboard.conges_en_attente>0?'#fef3c7':'#dcfce7'},
              {icon:'⚠',label:'Contrats expirant',value:dashboard.contrats_expiration||0,color:dashboard.contrats_expiration>0?'#dc2626':'#15803d',bg:dashboard.contrats_expiration>0?'#fee2e2':'#dcfce7'},
              {icon:'💰',label:'Masse salariale mois',value:`${parseFloat(dashboard.masse_salariale_mois||0).toLocaleString('fr-FR')} FCFA`,color:'#0891b2',bg:'#e0f2fe'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:k.label.includes('salariale')?13:26,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            {[
              {label:'+ Nouvel employé',color:'#0891b2',action:()=>ouvrir('employe',{statut:'actif'})},
              {label:'+ Nouveau poste',color:'#6d28d9',action:()=>ouvrir('poste',{})},
              {label:'+ Demande congé',color:'#15803d',action:()=>ouvrir('conge',{type_conge:'annuel'})},
              {label:'+ Générer bulletin',color:'#92400e',action:()=>ouvrir('bulletin',{})},
            ].map(b=>(
              <button key={b.label} onClick={b.action}
                style={{background:b.color,color:'#fff',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ EMPLOYÉS ══ */}
      {onglet==='employes' && (
        <div>
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
            <input value={search} onChange={e=>{setSearch(e.target.value);}} onKeyDown={e=>e.key==='Enter'&&chargerOnglet('employes')}
              placeholder="🔍 Nom, prénom, matricule..."
              style={{flex:1,border:'1px solid #d1d5db',borderRadius:8,padding:'9px 14px',fontSize:13}}/>
            <button onClick={()=>chargerOnglet('employes')} style={{background:'#f3f4f6',border:'1px solid #d1d5db',padding:'9px 14px',borderRadius:8,cursor:'pointer'}}>🔍</button>
            <button onClick={()=>ouvrir('employe',{statut:'actif',nationalite:'Ivoirienne'})}
              style={{background:'#0891b2',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouvel employé
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
              <thead>
                <tr style={{background:'#e0f2fe'}}>
                  {['Matricule','Nom Prénom','Poste','Département','Atelier','Contrat','Ancienneté','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#0891b2',borderBottom:'2px solid #bae6fd',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employes.map((e,i)=>{
                  const sc=STATUT_EMP[e.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={e.id} style={{borderBottom:'1px solid #e0f2fe',background:i%2===0?'#fff':'#f0f9ff'}}>
                      <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'#0891b2',fontSize:12}}>{e.matricule}</td>
                      <td style={{padding:'9px 14px',fontWeight:600}}>{e.nom} {e.prenom}</td>
                      <td style={{padding:'9px 14px',fontSize:12}}>{e.poste_libelle||'—'}</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{e.departement||'—'}</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>{e.atelier_code||'—'}</td>
                      <td style={{padding:'9px 14px'}}>{e.type_contrat?<span style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 6px',borderRadius:20,fontSize:11,fontWeight:700}}>{e.type_contrat}</span>:'—'}</td>
                      <td style={{padding:'9px 14px',fontSize:12,color:'#6b7280'}}>{e.anciennete_ans!=null?`${e.anciennete_ans} an(s)`:'—'}</td>
                      <td style={{padding:'9px 14px'}}><span style={{background:sc.bg,color:sc.tx,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{e.statut}</span></td>
                      <td style={{padding:'9px 14px'}}>
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>ouvrir('employe',{...e})}
                            style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✏</button>
                          <button onClick={()=>ouvrir('contrat',{employe_id:e.id,type_contrat:'CDI',salaire_base:e.salaire_base||''})}
                            style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>📋</button>
                          <button onClick={()=>ouvrir('bulletin',{employe_id:e.id,salaire_base:e.salaire_base||'',prime_transport:e.prime_transport||'',prime_logement:e.prime_logement||''})}
                            style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>💰</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {employes.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>👥</div><p>Aucun employé — créez le premier</p></div>}
          </div>
        </div>
      )}

      {/* ══ CONTRATS ══ */}
      {onglet==='contrats' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('contrat',{type_contrat:'CDI'})}
              style={{background:'#0891b2',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouveau contrat
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{background:'#e0f2fe'}}>
                  {['Employé','Type','Début','Fin','Salaire base','Avantages','Statut'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#0891b2',borderBottom:'2px solid #bae6fd'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contrats.map((c,i)=>{
                  const finDate = c.date_fin ? new Date(c.date_fin) : null;
                  const joursRestants = finDate ? Math.ceil((finDate-new Date())/86400000) : null;
                  return (
                    <tr key={c.id} style={{borderBottom:'1px solid #e0f2fe',background:i%2===0?'#fff':'#f0f9ff'}}>
                      <td style={{padding:'9px 14px',fontWeight:600}}>{c.employe_nom}</td>
                      <td style={{padding:'9px 14px'}}><span style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{c.type_contrat}</span></td>
                      <td style={{padding:'9px 14px',fontSize:12}}>{c.date_debut?new Date(c.date_debut).toLocaleDateString('fr-FR'):'—'}</td>
                      <td style={{padding:'9px 14px',fontSize:12,color:joursRestants!==null&&joursRestants<30?'#dc2626':'#374151',fontWeight:joursRestants!==null&&joursRestants<30?700:400}}>
                        {finDate?finDate.toLocaleDateString('fr-FR'):'Indéterminée'}
                        {joursRestants!==null&&joursRestants<30&&<span style={{fontSize:10,marginLeft:4}}>({joursRestants}j)</span>}
                      </td>
                      <td style={{padding:'9px 14px',fontWeight:700}}>{parseFloat(c.salaire_base||0).toLocaleString('fr-FR')} FCFA</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280'}}>
                        {c.prime_transport>0?`Transport: ${c.prime_transport} `:''}
                        {c.prime_logement>0?`Logement: ${c.prime_logement}`:''}
                        {!c.prime_transport&&!c.prime_logement?'—':''}
                      </td>
                      <td style={{padding:'9px 14px'}}><span style={{background:c.statut==='actif'?'#dcfce7':'#fee2e2',color:c.statut==='actif'?'#15803d':'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{c.statut}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {contrats.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>📋</div><p>Aucun contrat</p></div>}
          </div>
        </div>
      )}

      {/* ══ CONGÉS ══ */}
      {onglet==='conges' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('conge',{type_conge:'annuel'})}
              style={{background:'#0891b2',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Demande de congé
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{background:'#e0f2fe'}}>
                  {['Employé','Type','Début','Fin','Jours','Motif','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#0891b2',borderBottom:'2px solid #bae6fd'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conges.map((c,i)=>{
                  const sc=STATUT_CONGE[c.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={c.id} style={{borderBottom:'1px solid #e0f2fe',background:i%2===0?'#fff':'#f0f9ff'}}>
                      <td style={{padding:'9px 14px',fontWeight:600}}>{c.employe_nom}</td>
                      <td style={{padding:'9px 14px',fontSize:11}}>{c.type_conge}</td>
                      <td style={{padding:'9px 14px',fontSize:12}}>{new Date(c.date_debut).toLocaleDateString('fr-FR')}</td>
                      <td style={{padding:'9px 14px',fontSize:12}}>{new Date(c.date_fin).toLocaleDateString('fr-FR')}</td>
                      <td style={{padding:'9px 14px',textAlign:'center',fontWeight:700}}>{c.nb_jours}</td>
                      <td style={{padding:'9px 14px',fontSize:11,color:'#6b7280',maxWidth:150}}>{c.motif||'—'}</td>
                      <td style={{padding:'9px 14px'}}><span style={{background:sc.bg,color:sc.tx,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{c.statut}</span></td>
                      <td style={{padding:'9px 14px'}}>
                        {c.statut==='en_attente'&&(
                          <div style={{display:'flex',gap:4}}>
                            <button onClick={async()=>{await axios.put(`${API}/rh/conges/${c.id}/valider`,{statut:'approuve'});chargerOnglet('conges');toast.success('Congé approuvé');}}
                              style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✓</button>
                            <button onClick={async()=>{await axios.put(`${API}/rh/conges/${c.id}/valider`,{statut:'refuse'});chargerOnglet('conges');toast.success('Congé refusé');}}
                              style={{background:'#fee2e2',color:'#dc2626',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✗</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {conges.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🏖</div><p>Aucune demande de congé</p></div>}
          </div>
        </div>
      )}

      {/* ══ PAIE ══ */}
      {onglet==='paie' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('bulletin',{periode:new Date().toISOString().slice(0,7)+'-01'})}
              style={{background:'#0891b2',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Générer bulletin
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
              <thead>
                <tr style={{background:'#e0f2fe'}}>
                  {['Employé','Période','Salaire brut','CNPS','ITS','Net à payer','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:700,color:'#0891b2',borderBottom:'2px solid #bae6fd',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bulletins.map((b,i)=>(
                  <tr key={b.id} style={{borderBottom:'1px solid #e0f2fe',background:i%2===0?'#fff':'#f0f9ff'}}>
                    <td style={{padding:'9px 14px',fontWeight:600}}>{b.employe_nom}</td>
                    <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:12}}>{b.periode?new Date(b.periode).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}):'—'}</td>
                    <td style={{padding:'9px 14px'}}>{parseFloat(b.salaire_brut||0).toLocaleString('fr-FR')} FCFA</td>
                    <td style={{padding:'9px 14px',color:'#dc2626'}}>{parseFloat(b.cotisation_cnps||0).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'9px 14px',color:'#dc2626'}}>{parseFloat(b.impot_sur_salaire||0).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'9px 14px',fontWeight:800,color:'#15803d',fontSize:14}}>{parseFloat(b.salaire_net||0).toLocaleString('fr-FR')} FCFA</td>
                    <td style={{padding:'9px 14px'}}><span style={{background:b.statut==='paye'?'#dcfce7':b.statut==='valide'?'#dbeafe':'#f3f4f6',color:b.statut==='paye'?'#15803d':b.statut==='valide'?'#1d4ed8':'#6b7280',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{b.statut}</span></td>
                    <td style={{padding:'9px 14px'}}>
                      <div style={{display:'flex',gap:4}}>
                        {b.statut==='brouillon'&&<button onClick={async()=>{await axios.put(`${API}/rh/bulletins/${b.id}/statut`,{statut:'valide'});chargerOnglet('paie');toast.success('Validé');}}
                          style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Valider</button>}
                        {b.statut==='valide'&&<button onClick={async()=>{await axios.put(`${API}/rh/bulletins/${b.id}/statut`,{statut:'paye'});chargerOnglet('paie');toast.success('Payé');}}
                          style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>Marquer payé</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bulletins.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>💰</div><p>Aucun bulletin — générez les bulletins de paie</p></div>}
          </div>
        </div>
      )}

      {/* ══ ÉNERGIE / kWh ══ */}
      {onglet==='energie' && (
        <div>
          {/* KPIs énergie mois en cours */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
            {[
              {icon:'⚡',label:'Consommation mois',value:`${parseFloat(energieDash.total_kwh||0).toLocaleString('fr-FR')} kWh`,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'💰',label:'Coût électricité',value:`${parseFloat(energieDash.cout_fcfa||0).toLocaleString('fr-FR')} FCFA`,color:'#15803d',bg:'#dcfce7'},
              {icon:'🏭',label:'Machines suivies',value:energieDash.nb_equipements||0,color:'#059669',bg:'#f0fdf4'},
              {icon:'📋',label:'Relevés saisis',value:energieDash.nb_releves||0,color:'#6d28d9',bg:'#f5f3ff'},
              {icon:'⏱',label:'Heures de marche',value:`${parseFloat(energieDash.total_heures||0).toLocaleString('fr-FR')} h`,color:'#92400e',bg:'#fef3c7'},
              {icon:'📊',label:'Tarif kWh',value:`${parseFloat(energieDash.tarif_kwh||105).toFixed(0)} FCFA`,color:'#374151',bg:'#f3f4f6'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:k.label.includes('Consommation')||k.label.includes('Coût')||k.label.includes('Heures')?13:24,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Top consommateurs */}
          {energieDash.top5_consommateurs?.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
              <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
                <div style={{fontWeight:700,color:'#1d4ed8',marginBottom:12,fontSize:13}}>🏆 Top consommateurs (mois)</div>
                {energieDash.top5_consommateurs.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:600}}>{m.code} — {m.designation}</span>
                    <span style={{fontWeight:800,color:'#1d4ed8',fontSize:13}}>{parseFloat(m.kwh||0).toLocaleString('fr-FR')} kWh</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
                <div style={{fontWeight:700,color:'#059669',marginBottom:12,fontSize:13}}>🏭 Par atelier (mois)</div>
                {(energieDash.par_atelier||[]).map((a,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:600}}>{a.atelier_code} — {a.atelier}</span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:800,color:'#059669',fontSize:13}}>{parseFloat(a.kwh||0).toLocaleString('fr-FR')} kWh</div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>{parseFloat(a.heures||0).toFixed(1)} h</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
            <button onClick={()=>ouvrir('releve',{shift:'journee',date_releve:new Date().toISOString().split('T')[0],index_debut:'0',index_fin:'0',heures_marche:'8'})}
              style={{background:'#059669',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Saisir relevé
            </button>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,color:'#9ca3af'}}>Tarif CIE :</span>
              {editTarif ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input type="number" value={newTarif} onChange={e=>setNewTarif(e.target.value)}
                    style={{width:80,border:'1px solid #bfdbfe',borderRadius:6,padding:'4px 8px',fontSize:13,fontWeight:700}}/>
                  <span style={{fontSize:11,color:'#6b7280'}}>FCFA/kWh</span>
                  <button onClick={async()=>{
                    await axios.put(`${API}/gmao/energie/parametres`,{tarif_kwh:parseFloat(newTarif)});
                    toast.success('Tarif mis à jour');setEditTarif(false);
                    const {data}=await axios.get(`${API}/gmao/energie/dashboard`);setEnergieDash(data);
                  }} style={{background:'#059669',color:'#fff',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>✓</button>
                  <button onClick={()=>setEditTarif(false)} style={{background:'#f3f4f6',border:'none',padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11}}>✕</button>
                </div>
              ) : (
                <span onClick={()=>{setNewTarif(energieDash.tarif_kwh||105);setEditTarif(true);}}
                  style={{fontSize:13,fontWeight:700,color:'#1d4ed8',cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted'}}>
                  {parseFloat(energieDash.tarif_kwh||105).toFixed(0)} FCFA/kWh ✏
                </span>
              )}
            </div>
          </div>

          {/* Tableau des relevés */}
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto',marginBottom:20}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
              <thead>
                <tr style={{background:'#eff6ff'}}>
                  {['Date','Shift','Machine','Index début','Index fin','Consommation','Heures','Puissance moy.','Opérateur'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#1d4ed8',borderBottom:'2px solid #bfdbfe',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {releves.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:'1px solid #eff6ff',background:i%2===0?'#fff':'#f8fbff'}}>
                    <td style={{padding:'9px 12px',fontSize:12}}>{new Date(r.date_releve).toLocaleDateString('fr-FR')}</td>
                    <td style={{padding:'9px 12px'}}><span style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{r.shift}</span></td>
                    <td style={{padding:'9px 12px',fontWeight:600,color:'#059669'}}>{r.eq_code} <span style={{color:'#9ca3af',fontWeight:400,fontSize:11}}>{r.eq_designation}</span></td>
                    <td style={{padding:'9px 12px',fontFamily:'monospace'}}>{parseFloat(r.index_debut||0).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'9px 12px',fontFamily:'monospace'}}>{parseFloat(r.index_fin||0).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'9px 12px',fontWeight:800,color:'#1d4ed8',fontSize:14}}>{parseFloat(r.consommation_kwh||0).toLocaleString('fr-FR')} kWh</td>
                    <td style={{padding:'9px 12px'}}>{parseFloat(r.heures_marche||0).toFixed(1)} h</td>
                    <td style={{padding:'9px 12px',color:'#6b7280'}}>{r.puissance_moyenne_kw?`${parseFloat(r.puissance_moyenne_kw).toFixed(2)} kW`:'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{r.operateur_nom||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {releves.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>💡</div><p>Aucun relevé — commencez la saisie quotidienne</p></div>}
          </div>

          {/* Historique mensuel */}
          {consoMensuelle.length > 0 && (
            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
              <div style={{padding:'14px 16px',fontWeight:700,color:'#1d4ed8',borderBottom:'1px solid #e5e7eb'}}>📅 Historique mensuel par machine</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:600}}>
                <thead>
                  <tr style={{background:'#eff6ff'}}>
                    {['Mois','Machine','Atelier','kWh total','Heures','P. moy. kW','Coût FCFA'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:700,color:'#1d4ed8',borderBottom:'1px solid #bfdbfe'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consoMensuelle.slice(0,20).map((c,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #eff6ff',background:i%2===0?'#fff':'#f8fbff'}}>
                      <td style={{padding:'8px 12px',fontWeight:600}}>{new Date(c.mois).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</td>
                      <td style={{padding:'8px 12px',color:'#059669',fontWeight:600}}>{c.equipement_code}</td>
                      <td style={{padding:'8px 12px',color:'#6b7280'}}>{c.atelier||'—'}</td>
                      <td style={{padding:'8px 12px',fontWeight:800,color:'#1d4ed8'}}>{parseFloat(c.total_kwh||0).toLocaleString('fr-FR')}</td>
                      <td style={{padding:'8px 12px'}}>{parseFloat(c.total_heures||0).toFixed(1)}</td>
                      <td style={{padding:'8px 12px'}}>{parseFloat(c.puissance_moyenne_kw||0).toFixed(2)}</td>
                      <td style={{padding:'8px 12px',fontWeight:700,color:'#15803d'}}>{parseFloat(c.cout_fcfa||0).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ FORMULAIRES ══ */}
      {showForm && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:60,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:14,width:'95%',maxWidth:700,padding:24,maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{margin:0,color:'#0891b2',fontSize:16,fontWeight:800}}>
                {formType==='employe'?'👤 Fiche Employé':formType==='contrat'?'📋 Contrat':formType==='conge'?'🏖 Congé':formType==='bulletin'?'💰 Bulletin de paie':'📌 Poste'}
              </h3>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:16}}>

              {formType==='employe' && <>
                <F label="Nom *" k="nom" ph="NOM" required/>
                <F label="Prénom *" k="prenom" ph="Prénom" required/>
                <F label="Date naissance" k="date_naissance" type="date"/>
                <F label="Lieu naissance" k="lieu_naissance" ph="Abidjan"/>
                <S label="Sexe" k="sexe" opts={[{v:'M',l:'Masculin'},{v:'F',l:'Féminin'}]}/>
                <S label="Situation familiale" k="situation_familiale" opts={[{v:'celibataire',l:'Célibataire'},{v:'marie',l:'Marié(e)'},{v:'divorce',l:'Divorcé(e)'},{v:'veuf',l:'Veuf/Veuve'}]}/>
                <F label="Nb enfants" k="nb_enfants" type="number" ph="0"/>
                <F label="Téléphone" k="telephone" ph="+225..."/>
                <F label="Email" k="email" type="email" ph="email@nai.ci"/>
                <S label="Poste" k="poste_id" opts={postes.map(p=>({v:String(p.id),l:`${p.intitule} — ${p.departement||''}`.trim()}))}/>
                <S label="Atelier" k="atelier_id" opts={ateliers.map(a=>({v:String(a.id),l:`${a.code} — ${a.libelle}`}))}/>
                <F label="Date embauche" k="date_embauche" type="date"/>
                <S label="Statut" k="statut" opts={[{v:'actif',l:'Actif'},{v:'conge',l:'En congé'},{v:'suspendu',l:'Suspendu'},{v:'demissionne',l:'Démissionné'},{v:'licencie',l:'Licencié'},{v:'retraite',l:'Retraite'}]}/>
                <F label="N° CNI" k="num_cni" ph="CI-..."/>
                <F label="N° CNPS" k="num_cnps" ph="CNPS-..."/>
                <div style={{gridColumn:'1/-1'}}><F label="Adresse" k="adresse" ph="Quartier, Commune..."/></div>
              </>}

              {formType==='contrat' && <>
                <S label="Employé *" k="employe_id" required opts={employes.map(e=>({v:e.id,l:`${e.matricule} — ${e.nom} ${e.prenom}`}))}/>
                <S label="Type contrat *" k="type_contrat" required opts={[{v:'CDI',l:'CDI'},{v:'CDD',l:'CDD'},{v:'Stage',l:'Stage'},{v:'Apprentissage',l:'Apprentissage'},{v:'Interim',l:'Intérim'},{v:'Prestation',l:'Prestation'}]}/>
                <F label="Date début *" k="date_debut" type="date" required/>
                <F label="Date fin" k="date_fin" type="date"/>
                <F label="Salaire base (FCFA)" k="salaire_base" type="number" ph="0"/>
                <S label="Temps de travail" k="temps_travail" opts={[{v:'plein',l:'Temps plein'},{v:'partiel',l:'Temps partiel'},{v:'mi_temps',l:'Mi-temps'}]}/>
                <F label="Prime transport (FCFA)" k="prime_transport" type="number" ph="0"/>
                <F label="Prime logement (FCFA)" k="prime_logement" type="number" ph="0"/>
                <F label="Période d'essai (mois)" k="periode_essai_mois" type="number" ph="0"/>
              </>}

              {formType==='conge' && <>
                <S label="Employé *" k="employe_id" required opts={employes.map(e=>({v:e.id,l:`${e.matricule} — ${e.nom} ${e.prenom}`}))}/>
                <S label="Type congé" k="type_conge" opts={[{v:'annuel',l:'Congé annuel'},{v:'maladie',l:'Maladie'},{v:'maternite',l:'Maternité'},{v:'paternite',l:'Paternité'},{v:'sans_solde',l:'Sans solde'},{v:'exceptionnel',l:'Exceptionnel'},{v:'recuperation',l:'Récupération'}]}/>
                <F label="Date début *" k="date_debut" type="date" required/>
                <F label="Date fin *" k="date_fin" type="date" required/>
                <div style={{gridColumn:'1/-1'}}><F label="Motif" k="motif" ph="Motif de la demande..."/></div>
              </>}

              {formType==='bulletin' && <>
                <S label="Employé *" k="employe_id" required opts={employes.map(e=>({v:e.id,l:`${e.matricule} — ${e.nom} ${e.prenom}`}))}/>
                <F label="Période *" k="periode" type="date" ph="2026-04-01" required/>
                <F label="Salaire base (FCFA)" k="salaire_base" type="number" ph="0"/>
                <F label="Prime transport" k="prime_transport" type="number" ph="0"/>
                <F label="Prime logement" k="prime_logement" type="number" ph="0"/>
                <F label="Prime performance" k="prime_performance" type="number" ph="0"/>
                <F label="Heures supp." k="heures_supp" type="number" ph="0"/>
                <F label="Taux heure supp." k="taux_heures_supp" type="number" ph="0"/>
                <F label="Autres retenues" k="autres_retenues" type="number" ph="0"/>
                <div style={{gridColumn:'1/-1',background:'#f0f9ff',borderRadius:8,padding:12,fontSize:12,color:'#0891b2'}}>
                  💡 Les cotisations CNPS (6.3%) et l'ITS seront calculés automatiquement selon la législation ivoirienne.
                </div>
              </>}

              {formType==='poste' && <>
                <F label="Code *" k="code" ph="RH-001" required/>
                <F label="Intitulé *" k="intitule" ph="Responsable Production" required/>
                <F label="Département" k="departement" ph="Production, RH, Finance..."/>
                <F label="Niveau" k="niveau" ph="Cadre, Agent de maîtrise..."/>
                <div style={{gridColumn:'1/-1'}}><F label="Description" k="description" ph="Description du poste..."/></div>
              </>}

            </div>
            <div style={{display:'flex',gap:10,paddingTop:16,borderTop:'1px solid #f3f4f6'}}>
              <button onClick={sauvegarder}
                style={{background:'#0891b2',color:'#fff',border:'none',padding:'12px 32px',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:14}}>
                ✓ Enregistrer
              </button>
              <button onClick={()=>setShowForm(false)}
                style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MODULE GMAO
// ══════════════════════════════════════════════════════════════
function GMAO() {
  const [onglet, setOnglet] = useState('dashboard');
  const [dashboard, setDashboard] = useState({});
  const [equipements, setEquipements] = useState([]);
  const [ots, setOts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [pannes, setPannes] = useState([]);
  const [energieDash, setEnergieDash] = useState({});
  const [releves, setReleves] = useState([]);
  const [consoMensuelle, setConsoMensuelle] = useState([]);
  const [editTarif, setEditTarif] = useState(false);
  const [newTarif, setNewTarif] = useState(105);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [ateliers, setAteliers] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [form, setForm] = useState({});
  const [detail, setDetail] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [search, setSearch] = useState('');

  const charger = async () => {
    try { const {data}=await axios.get(`${API}/gmao/dashboard`); setDashboard(data); } catch {}
    try { const {data}=await axios.get(`${API}/users`); setUtilisateurs(data); } catch {}
    try { const {data}=await axios.get(`${API}/ateliers`); setAteliers(data); } catch {}
    try { const {data}=await axios.get(`${API}/fournisseurs`); setFournisseurs(data); } catch {}
  };

  const chargerOnglet = async (tab) => {
    setOnglet(tab); setDetail(null);
    try {
      if (tab==='equipements') { const {data}=await axios.get(`${API}/gmao/equipements${filtreStatut?`?statut=${filtreStatut}`:''}`); setEquipements(data); }
      else if (tab==='ots') { const {data}=await axios.get(`${API}/gmao/ots${filtreStatut?`?statut=${filtreStatut}`:''}`); setOts(data); }
      else if (tab==='plans') { const {data}=await axios.get(`${API}/gmao/plans`); setPlans(data); }
      else if (tab==='pieces') { const {data}=await axios.get(`${API}/gmao/pieces`); setPieces(data); }
      else if (tab==='pannes') { const {data}=await axios.get(`${API}/gmao/pannes`); setPannes(data); }
      else if (tab==='energie') {
        const [d1,d2,d3] = await Promise.all([
          axios.get(`${API}/gmao/energie/dashboard`),
          axios.get(`${API}/gmao/energie/releves`),
          axios.get(`${API}/gmao/energie/mensuel`),
        ]);
        setEnergieDash(d1.data); setReleves(d2.data); setConsoMensuelle(d3.data);
      }
    } catch(e) { toast.error('Erreur: '+e.message); }
  };

  useEffect(() => { charger(); chargerOnglet('dashboard'); }, []);

  const ouvrir = (type, data={}) => { setFormType(type); setForm({...data}); setShowForm(true); };

  const sauvegarder = async () => {
    try {
      const urls = { equipement:'/gmao/equipements', ot:'/gmao/ots', plan:'/gmao/plans', piece:'/gmao/pieces', releve:'/gmao/energie/releves' };
      const url = urls[formType];
      if (!url) return;
      if (form.id) await axios.put(`${API}${url}/${form.id}`, form);
      else await axios.post(`${API}${url}`, form);
      toast.success('Enregistré ✓');
      setShowForm(false);
      const tabs = { equipement:'equipements', ot:'ots', plan:'plans', piece:'pieces', releve:'energie' };
      chargerOnglet(tabs[formType]);
      charger();
    } catch(e) { toast.error(e.response?.data?.detail||e.response?.data?.error||'Erreur'); }
  };

  const changerStatutOT = async (ot, newStatut) => {
    try {
      await axios.put(`${API}/gmao/ots/${ot.id}`, {...ot, statut:newStatut});
      toast.success(`OT ${newStatut}`);
      chargerOnglet('ots');
      charger();
    } catch(e) { toast.error('Erreur'); }
  };

  const genererOT = async (planId) => {
    try {
      await axios.post(`${API}/gmao/plans/${planId}/generer-ot`);
      toast.success('OT généré depuis le plan ✓');
      chargerOnglet('ots');
    } catch(e) { toast.error(e.response?.data?.detail||'Erreur'); }
  };

  const PRIORITE_COLORS = {
    urgente:{bg:'#fee2e2',tx:'#dc2626'},
    haute:{bg:'#fed7aa',tx:'#c2410c'},
    normale:{bg:'#fef3c7',tx:'#92400e'},
    basse:{bg:'#f3f4f6',tx:'#6b7280'},
  };
  const STATUT_OT = {
    ouvert:{bg:'#fef3c7',tx:'#92400e'},
    planifie:{bg:'#dbeafe',tx:'#1d4ed8'},
    en_cours:{bg:'#dcfce7',tx:'#15803d'},
    en_attente_pieces:{bg:'#fee2e2',tx:'#dc2626'},
    termine:{bg:'#f3f4f6',tx:'#6b7280'},
    annule:{bg:'#f3f4f6',tx:'#9ca3af'},
  };
  const STATUT_EQ = {
    en_service:{bg:'#dcfce7',tx:'#15803d'},
    en_panne:{bg:'#fee2e2',tx:'#dc2626'},
    en_maintenance:{bg:'#fef3c7',tx:'#92400e'},
    hors_service:{bg:'#f3f4f6',tx:'#6b7280'},
    reforme:{bg:'#f3f4f6',tx:'#9ca3af'},
  };
  const CRITICITE_COLORS = {
    critique:{bg:'#fee2e2',tx:'#dc2626'},
    importante:{bg:'#fed7aa',tx:'#c2410c'},
    normale:{bg:'#dbeafe',tx:'#1d4ed8'},
    faible:{bg:'#f3f4f6',tx:'#6b7280'},
  };

  const F = ({label,k,type='text',ph='',required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <input type={type} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={ph}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box'}}/>
    </div>
  );
  const S = ({label,k,opts,required=false}) => (
    <div>
      <label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>{label}{required&&<span style={{color:'#dc2626'}}> *</span>}</label>
      <select value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}
        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13}}>
        <option value="">-- Sélectionner --</option>
        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  const ONGLETS = [
    {id:'dashboard',label:'📊 Tableau de bord'},
    {id:'equipements',label:'🏭 Équipements'},
    {id:'ots',label:'🔧 Ordres de travail'},
    {id:'plans',label:'📅 Maintenance préventive'},
    {id:'pieces',label:'🔩 Pièces détachées'},
    {id:'pannes',label:'⚡ Historique pannes'},
    {id:'energie',label:'💡 Énergie / kWh'},
  ];

  return (
    <div>
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #e5e7eb',overflowX:'auto'}}>
        {ONGLETS.map(o=>(
          <button key={o.id} onClick={()=>chargerOnglet(o.id)} style={{
            padding:'10px 16px',border:'none',background:'none',cursor:'pointer',
            fontSize:12,whiteSpace:'nowrap',
            fontWeight:onglet===o.id?700:400,
            color:onglet===o.id?'#059669':'#6b7280',
            borderBottom:onglet===o.id?'3px solid #059669':'3px solid transparent',
          }}>{o.label}</button>
        ))}
      </div>

      {/* ══ DASHBOARD ══ */}
      {onglet==='dashboard' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:24}}>
            {[
              {icon:'✅',label:'En service',value:dashboard.equipements_en_service||0,color:'#15803d',bg:'#dcfce7'},
              {icon:'🔴',label:'En panne',value:dashboard.equipements_en_panne||0,color:'#dc2626',bg:'#fee2e2'},
              {icon:'🔧',label:'En maintenance',value:dashboard.equipements_maintenance||0,color:'#d97706',bg:'#fef3c7'},
              {icon:'📋',label:'OT ouverts',value:dashboard.ot_ouverts||0,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'🚨',label:'OT urgents',value:dashboard.ot_urgents||0,color:'#dc2626',bg:'#fee2e2'},
              {icon:'⏳',label:'Attente pièces',value:dashboard.ot_attente_pieces||0,color:'#d97706',bg:'#fef3c7'},
              {icon:'📅',label:'MP à planifier',value:dashboard.maintenances_a_planifier||0,color:dashboard.maintenances_a_planifier>0?'#d97706':'#15803d',bg:dashboard.maintenances_a_planifier>0?'#fef3c7':'#dcfce7'},
              {icon:'🔩',label:'Pièces en alerte',value:dashboard.pieces_en_alerte||0,color:dashboard.pieces_en_alerte>0?'#dc2626':'#15803d',bg:dashboard.pieces_en_alerte>0?'#fee2e2':'#dcfce7'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:26,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{background:'#f0fdf4',borderRadius:12,padding:16,marginBottom:16,border:'1px solid #bbf7d0'}}>
            <div style={{fontWeight:700,color:'#059669',marginBottom:8,fontSize:13}}>💰 Coût maintenance année en cours</div>
            <div style={{fontSize:28,fontWeight:800,color:'#059669'}}>{parseFloat(dashboard.cout_maintenance_annee||0).toLocaleString('fr-FR')} FCFA</div>
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {[
              {label:'+ Nouvel équipement',action:()=>ouvrir('equipement',{statut:'en_service',criticite:'normale',type_equipement:'machine'})},
              {label:'🚨 Déclarer une panne',action:()=>ouvrir('ot',{type_ot:'urgence',priorite:'urgente',arret_machine:true})},
              {label:'+ Ordre de travail',action:()=>ouvrir('ot',{type_ot:'curatif',priorite:'normale'})},
              {label:'+ Plan maintenance',action:()=>ouvrir('plan',{periodicite_type:'jours',periodicite_valeur:30})},
            ].map(b=>(
              <button key={b.label} onClick={b.action}
                style={{background:'#059669',color:'#fff',border:'none',padding:'10px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ ÉQUIPEMENTS ══ */}
      {onglet==='equipements' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:0}}>
              {['','en_service','en_panne','en_maintenance','hors_service'].map(s=>(
                <button key={s} onClick={()=>{setFiltreStatut(s);setTimeout(()=>chargerOnglet('equipements'),50);}} style={{
                  padding:'7px 12px',border:'1px solid #e5e7eb',
                  background:filtreStatut===s?'#059669':'#fff',
                  color:filtreStatut===s?'#fff':'#6b7280',
                  cursor:'pointer',fontSize:11,fontWeight:filtreStatut===s?700:400,
                  borderRadius:s===''?'8px 0 0 8px':s==='hors_service'?'0 8px 8px 0':'0'
                }}>{s||'Tous'}</button>
              ))}
            </div>
            <button onClick={()=>ouvrir('equipement',{statut:'en_service',criticite:'normale',type_equipement:'machine'})}
              style={{background:'#059669',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,marginLeft:'auto'}}>
              + Nouvel équipement
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
            {equipements.map(eq=>{
              const sc=STATUT_EQ[eq.statut]||{bg:'#f3f4f6',tx:'#374151'};
              const cc=CRITICITE_COLORS[eq.criticite]||{bg:'#f3f4f6',tx:'#374151'};
              const maintenanceDate = eq.prochaine_maintenance ? new Date(eq.prochaine_maintenance) : null;
              const joursMP = maintenanceDate ? Math.ceil((maintenanceDate-new Date())/86400000) : null;
              return (
                <div key={eq.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16,cursor:'pointer',borderTop:`3px solid ${cc.tx}`}}
                  onClick={()=>setDetail(detail?.id===eq.id?null:eq)}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div>
                      <span style={{fontFamily:'monospace',fontWeight:800,color:'#059669',fontSize:13}}>{eq.code}</span>
                      <div style={{fontWeight:600,fontSize:14,marginTop:2}}>{eq.designation}</div>
                      <div style={{fontSize:11,color:'#9ca3af'}}>{eq.marque||''} {eq.modele||''}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                      <span style={{background:sc.bg,color:sc.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{eq.statut}</span>
                      <span style={{background:cc.bg,color:cc.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{eq.criticite}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:12,fontSize:11,color:'#6b7280',marginBottom:8}}>
                    <span>🏭 {eq.atelier_libelle||'—'}</span>
                    <span>📍 {eq.localisation||'—'}</span>
                  </div>
                  <div style={{display:'flex',gap:8,fontSize:11}}>
                    <span style={{background:'#f3f4f6',padding:'2px 6px',borderRadius:20}}>🔧 {eq.ot_en_cours||0} OT</span>
                    <span style={{background:'#f3f4f6',padding:'2px 6px',borderRadius:20}}>⚡ {eq.nb_pannes_total||0} pannes</span>
                    {joursMP!==null&&<span style={{background:joursMP<7?'#fee2e2':joursMP<30?'#fef3c7':'#dcfce7',color:joursMP<7?'#dc2626':joursMP<30?'#92400e':'#15803d',padding:'2px 6px',borderRadius:20,fontWeight:700}}>
                      MP: {joursMP}j
                    </span>}
                  </div>
                  {detail?.id===eq.id&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #f3f4f6'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10,fontSize:11}}>
                        {[['N° série',eq.numero_serie],['Type',eq.type_equipement],['Mise en service',eq.date_mise_en_service?new Date(eq.date_mise_en_service).toLocaleDateString('fr-FR'):'—'],['Garantie',eq.date_fin_garantie?new Date(eq.date_fin_garantie).toLocaleDateString('fr-FR'):'—'],['Compteur',`${eq.compteur_heures||0}h`],['Valeur',`${parseFloat(eq.valeur_acquisition||0).toLocaleString('fr-FR')} FCFA`]].map(([l,v])=>v&&(
                          <div key={l} style={{background:'#f8fdf9',borderRadius:6,padding:'6px 8px'}}>
                            <div style={{color:'#9ca3af',fontSize:10}}>{l}</div>
                            <div style={{fontWeight:600,color:'#059669'}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={e=>{e.stopPropagation();ouvrir('equipement',{...eq});}}
                          style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>✏ Modifier</button>
                        <button onClick={e=>{e.stopPropagation();ouvrir('ot',{equipement_id:eq.id,type_ot:'curatif',priorite:'normale',arret_machine:false});}}
                          style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>+ OT curatif</button>
                        <button onClick={e=>{e.stopPropagation();ouvrir('ot',{equipement_id:eq.id,type_ot:'urgence',priorite:'urgente',arret_machine:true});}}
                          style={{background:'#fee2e2',color:'#dc2626',border:'none',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:600}}>🚨 Panne</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {equipements.length===0&&<div style={{textAlign:'center',padding:60,color:'#9ca3af',gridColumn:'1/-1'}}><div style={{fontSize:40,marginBottom:12}}>🏭</div><p>Aucun équipement — créez votre parc machines</p></div>}
          </div>
        </div>
      )}

      {/* ══ ORDRES DE TRAVAIL ══ */}
      {onglet==='ots' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{display:'flex',gap:0}}>
              {['','ouvert','planifie','en_cours','en_attente_pieces','termine'].map(s=>(
                <button key={s} onClick={()=>{setFiltreStatut(s);setTimeout(()=>chargerOnglet('ots'),50);}} style={{
                  padding:'7px 12px',border:'1px solid #e5e7eb',
                  background:filtreStatut===s?'#059669':'#fff',
                  color:filtreStatut===s?'#fff':'#6b7280',
                  cursor:'pointer',fontSize:11,fontWeight:filtreStatut===s?700:400,
                  borderRadius:s===''?'8px 0 0 8px':s==='termine'?'0 8px 8px 0':'0'
                }}>{s||'Tous'}</button>
              ))}
            </div>
            <button onClick={()=>ouvrir('ot',{type_ot:'curatif',priorite:'normale'})}
              style={{background:'#059669',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,marginLeft:'auto'}}>
              + Nouvel OT
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:800}}>
              <thead>
                <tr style={{background:'#f0fdf4'}}>
                  {['N° OT','Type','Équipement','Titre','Priorité','Technicien','Date','Coût','Statut','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#059669',borderBottom:'2px solid #bbf7d0',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ots.map((ot,i)=>{
                  const pc=PRIORITE_COLORS[ot.priorite]||{bg:'#f3f4f6',tx:'#374151'};
                  const sc=STATUT_OT[ot.statut]||{bg:'#f3f4f6',tx:'#374151'};
                  return (
                    <tr key={ot.id} style={{borderBottom:'1px solid #f0fdf4',background:i%2===0?'#fff':'#f9fefe'}}>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:800,color:'#059669',fontSize:11}}>{ot.numero_ot}</td>
                      <td style={{padding:'9px 12px'}}><span style={{background:ot.type_ot==='urgence'?'#fee2e2':ot.type_ot==='preventif'?'#dbeafe':'#f3f4f6',color:ot.type_ot==='urgence'?'#dc2626':ot.type_ot==='preventif'?'#1d4ed8':'#374151',padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{ot.type_ot}</span></td>
                      <td style={{padding:'9px 12px',fontSize:11}}>
                        <div style={{fontWeight:600,color:'#059669'}}>{ot.equipement_code||'—'}</div>
                        <div style={{fontSize:10,color:'#9ca3af'}}>{ot.equipement_designation||''}</div>
                      </td>
                      <td style={{padding:'9px 12px',fontWeight:500,maxWidth:200}}>{ot.titre}</td>
                      <td style={{padding:'9px 12px'}}><span style={{background:pc.bg,color:pc.tx,padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{ot.priorite}</span></td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{ot.technicien_nom||'—'}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{ot.date_planifiee?new Date(ot.date_planifiee).toLocaleDateString('fr-FR'):new Date(ot.date_demande).toLocaleDateString('fr-FR')}</td>
                      <td style={{padding:'9px 12px',fontSize:12,fontWeight:600}}>{ot.cout_total>0?`${parseFloat(ot.cout_total).toLocaleString('fr-FR')} FCFA`:'—'}</td>
                      <td style={{padding:'9px 12px'}}><span style={{background:sc.bg,color:sc.tx,padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>{ot.statut}</span></td>
                      <td style={{padding:'9px 12px'}}>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>ouvrir('ot',{...ot})}
                            style={{background:'#fef3c7',color:'#92400e',border:'none',padding:'3px 7px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✏</button>
                          {ot.statut==='ouvert'&&<button onClick={()=>changerStatutOT(ot,'en_cours')}
                            style={{background:'#dcfce7',color:'#15803d',border:'none',padding:'3px 7px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>▶</button>}
                          {ot.statut==='en_cours'&&<button onClick={()=>ouvrir('ot',{...ot,statut:'termine'})}
                            style={{background:'#dbeafe',color:'#1d4ed8',border:'none',padding:'3px 7px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:600}}>✓</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {ots.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🔧</div><p>Aucun ordre de travail</p></div>}
          </div>
        </div>
      )}

      {/* ══ PLANS MAINTENANCE ══ */}
      {onglet==='plans' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
            <button onClick={()=>ouvrir('plan',{periodicite_type:'jours',periodicite_valeur:'30',type_maintenance:'preventive'})}
              style={{background:'#059669',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Nouveau plan MP
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:12}}>
            {plans.map(pm=>{
              const echeance = pm.prochaine_echeance ? new Date(pm.prochaine_echeance) : null;
              const jours = echeance ? Math.ceil((echeance-new Date())/86400000) : null;
              const urgent = jours!==null && jours<=7;
              const proche = jours!==null && jours<=30;
              return (
                <div key={pm.id} style={{background:'#fff',borderRadius:12,border:`2px solid ${urgent?'#fca5a5':proche?'#fde68a':'#bbf7d0'}`,padding:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:700,color:'#059669',fontSize:13}}>{pm.equipement_code}</div>
                      <div style={{fontWeight:600,fontSize:14}}>{pm.titre}</div>
                    </div>
                    <span style={{background:urgent?'#fee2e2':proche?'#fef3c7':'#dcfce7',color:urgent?'#dc2626':proche?'#92400e':'#15803d',padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:800,whiteSpace:'nowrap'}}>
                      {jours!==null?`J${jours>0?'+':''}${jours}`:'—'}
                    </span>
                  </div>
                  <div style={{fontSize:11,color:'#6b7280',marginBottom:8}}>
                    <div>⏱ Tous les {pm.periodicite_valeur} {pm.periodicite_type} | {pm.duree_estimee_h}h</div>
                    <div>👤 {pm.technicien_nom||'Non assigné'}</div>
                    <div>📅 Prochaine: {echeance?echeance.toLocaleDateString('fr-FR'):'—'}</div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>genererOT(pm.id)}
                      style={{background:'#059669',color:'#fff',border:'none',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
                      ▶ Générer OT
                    </button>
                    <button onClick={()=>ouvrir('plan',{...pm})}
                      style={{background:'#f3f4f6',border:'none',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:11}}>
                      ✏ Modifier
                    </button>
                  </div>
                </div>
              );
            })}
            {plans.length===0&&<div style={{textAlign:'center',padding:60,color:'#9ca3af',gridColumn:'1/-1'}}><div style={{fontSize:40,marginBottom:12}}>📅</div><p>Aucun plan de maintenance</p></div>}
          </div>
        </div>
      )}

      {/* ══ PIÈCES DÉTACHÉES ══ */}
      {onglet==='pieces' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
            <button onClick={()=>ouvrir('piece',{unite:'pcs',qte_minimum:'2'})}
              style={{background:'#059669',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,marginLeft:'auto'}}>
              + Nouvelle pièce
            </button>
          </div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:600}}>
              <thead>
                <tr style={{background:'#f0fdf4'}}>
                  {['Code','Désignation','Famille','Stock','Mini','Prix unit.','Valeur stock','Emplacement','Alerte'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#059669',borderBottom:'2px solid #bbf7d0'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pieces.map((p,i)=>{
                  const alerte = p.qte_stock <= p.qte_minimum;
                  const valeur = parseFloat(p.qte_stock||0) * parseFloat(p.prix_unitaire||0);
                  return (
                    <tr key={p.id} style={{borderBottom:'1px solid #f0fdf4',background:alerte?'#fff5f5':i%2===0?'#fff':'#f9fefe'}}>
                      <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:700,color:'#059669',fontSize:11}}>{p.code}</td>
                      <td style={{padding:'9px 12px',fontWeight:500}}>{p.designation}</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{p.famille||'—'}</td>
                      <td style={{padding:'9px 12px',fontWeight:800,color:alerte?'#dc2626':'#15803d',fontSize:14}}>{p.qte_stock} {p.unite}</td>
                      <td style={{padding:'9px 12px',color:'#6b7280'}}>{p.qte_minimum}</td>
                      <td style={{padding:'9px 12px'}}>{parseFloat(p.prix_unitaire||0).toLocaleString('fr-FR')} FCFA</td>
                      <td style={{padding:'9px 12px',fontWeight:600}}>{valeur.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{p.emplacement_magasin||'—'}</td>
                      <td style={{padding:'9px 12px'}}>
                        {alerte&&<span style={{background:'#fee2e2',color:'#dc2626',padding:'2px 8px',borderRadius:20,fontSize:10,fontWeight:700}}>⚠ Stock bas</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pieces.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>🔩</div><p>Aucune pièce détachée</p></div>}
          </div>
        </div>
      )}

      {/* ══ HISTORIQUE PANNES ══ */}
      {onglet==='pannes' && (
        <div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
              <thead>
                <tr style={{background:'#fef2f2'}}>
                  {['Date','Équipement','Symptômes','Cause','Arrêt (h)','MTTR (h)','Coût','OT'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#dc2626',borderBottom:'2px solid #fecaca',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pannes.map((p,i)=>(
                  <tr key={p.id} style={{borderBottom:'1px solid #fef2f2',background:i%2===0?'#fff':'#fff5f5'}}>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{new Date(p.date_panne).toLocaleDateString('fr-FR')}</td>
                    <td style={{padding:'9px 12px',fontWeight:600,color:'#059669'}}>{p.eq_code}</td>
                    <td style={{padding:'9px 12px',maxWidth:200,fontSize:12}}>{p.symptomes}</td>
                    <td style={{padding:'9px 12px',fontSize:12,color:'#6b7280'}}>{p.cause||'—'}</td>
                    <td style={{padding:'9px 12px',fontWeight:700,color:'#dc2626'}}>{parseFloat(p.duree_arret_h||0).toFixed(1)}</td>
                    <td style={{padding:'9px 12px',color:'#92400e'}}>{p.mttr?parseFloat(p.mttr).toFixed(1):'—'}</td>
                    <td style={{padding:'9px 12px'}}>{p.cout_panne>0?`${parseFloat(p.cout_panne).toLocaleString('fr-FR')} FCFA`:'—'}</td>
                    <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#059669'}}>{p.ot_id?'Lié':'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pannes.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>⚡</div><p>Aucune panne enregistrée</p></div>}
          </div>
        </div>
      )}

      {/* ══ ÉNERGIE / kWh ══ */}
      {onglet==='energie' && (
        <div>
          {/* KPIs énergie mois en cours */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
            {[
              {icon:'⚡',label:'Consommation mois',value:`${parseFloat(energieDash.total_kwh||0).toLocaleString('fr-FR')} kWh`,color:'#1d4ed8',bg:'#dbeafe'},
              {icon:'💰',label:'Coût électricité',value:`${parseFloat(energieDash.cout_fcfa||0).toLocaleString('fr-FR')} FCFA`,color:'#15803d',bg:'#dcfce7'},
              {icon:'🏭',label:'Machines suivies',value:energieDash.nb_equipements||0,color:'#059669',bg:'#f0fdf4'},
              {icon:'📋',label:'Relevés saisis',value:energieDash.nb_releves||0,color:'#6d28d9',bg:'#f5f3ff'},
              {icon:'⏱',label:'Heures de marche',value:`${parseFloat(energieDash.total_heures||0).toLocaleString('fr-FR')} h`,color:'#92400e',bg:'#fef3c7'},
              {icon:'📊',label:'Tarif kWh',value:`${parseFloat(energieDash.tarif_kwh||105).toFixed(0)} FCFA`,color:'#374151',bg:'#f3f4f6'},
            ].map(k=>(
              <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px'}}>
                <div style={{fontSize:11,color:'#6b7280',marginBottom:4}}>{k.icon} {k.label}</div>
                <div style={{fontSize:k.label.includes('Consommation')||k.label.includes('Coût')||k.label.includes('Heures')?13:24,fontWeight:800,color:k.color}}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Top consommateurs */}
          {energieDash.top5_consommateurs?.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
              <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
                <div style={{fontWeight:700,color:'#1d4ed8',marginBottom:12,fontSize:13}}>🏆 Top consommateurs (mois)</div>
                {energieDash.top5_consommateurs.map((m,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:600}}>{m.code} — {m.designation}</span>
                    <span style={{fontWeight:800,color:'#1d4ed8',fontSize:13}}>{parseFloat(m.kwh||0).toLocaleString('fr-FR')} kWh</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',padding:16}}>
                <div style={{fontWeight:700,color:'#059669',marginBottom:12,fontSize:13}}>🏭 Par atelier (mois)</div>
                {(energieDash.par_atelier||[]).map((a,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:600}}>{a.atelier_code} — {a.atelier}</span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:800,color:'#059669',fontSize:13}}>{parseFloat(a.kwh||0).toLocaleString('fr-FR')} kWh</div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>{parseFloat(a.heures||0).toFixed(1)} h</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
            <button onClick={()=>ouvrir('releve',{shift:'journee',date_releve:new Date().toISOString().split('T')[0],index_debut:'0',index_fin:'0',heures_marche:'8'})}
              style={{background:'#059669',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontWeight:700}}>
              + Saisir relevé
            </button>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:12,color:'#9ca3af'}}>Tarif CIE :</span>
              {editTarif ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input type="number" value={newTarif} onChange={e=>setNewTarif(e.target.value)}
                    style={{width:80,border:'1px solid #bfdbfe',borderRadius:6,padding:'4px 8px',fontSize:13,fontWeight:700}}/>
                  <span style={{fontSize:11,color:'#6b7280'}}>FCFA/kWh</span>
                  <button onClick={async()=>{
                    await axios.put(`${API}/gmao/energie/parametres`,{tarif_kwh:parseFloat(newTarif)});
                    toast.success('Tarif mis à jour');setEditTarif(false);
                    const {data}=await axios.get(`${API}/gmao/energie/dashboard`);setEnergieDash(data);
                  }} style={{background:'#059669',color:'#fff',border:'none',padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>✓</button>
                  <button onClick={()=>setEditTarif(false)} style={{background:'#f3f4f6',border:'none',padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11}}>✕</button>
                </div>
              ) : (
                <span onClick={()=>{setNewTarif(energieDash.tarif_kwh||105);setEditTarif(true);}}
                  style={{fontSize:13,fontWeight:700,color:'#1d4ed8',cursor:'pointer',textDecoration:'underline',textDecorationStyle:'dotted'}}>
                  {parseFloat(energieDash.tarif_kwh||105).toFixed(0)} FCFA/kWh ✏
                </span>
              )}
            </div>
          </div>

          {/* Tableau des relevés */}
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto',marginBottom:20}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:700}}>
              <thead>
                <tr style={{background:'#eff6ff'}}>
                  {['Date','Shift','Machine','Index début','Index fin','Consommation','Heures','Puissance moy.','Opérateur'].map(h=>(
                    <th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:700,color:'#1d4ed8',borderBottom:'2px solid #bfdbfe',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {releves.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:'1px solid #eff6ff',background:i%2===0?'#fff':'#f8fbff'}}>
                    <td style={{padding:'9px 12px',fontSize:12}}>{new Date(r.date_releve).toLocaleDateString('fr-FR')}</td>
                    <td style={{padding:'9px 12px'}}><span style={{background:'#dbeafe',color:'#1d4ed8',padding:'2px 6px',borderRadius:20,fontSize:10,fontWeight:700}}>{r.shift}</span></td>
                    <td style={{padding:'9px 12px',fontWeight:600,color:'#059669'}}>{r.eq_code} <span style={{color:'#9ca3af',fontWeight:400,fontSize:11}}>{r.eq_designation}</span></td>
                    <td style={{padding:'9px 12px',fontFamily:'monospace'}}>{parseFloat(r.index_debut||0).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'9px 12px',fontFamily:'monospace'}}>{parseFloat(r.index_fin||0).toLocaleString('fr-FR')}</td>
                    <td style={{padding:'9px 12px',fontWeight:800,color:'#1d4ed8',fontSize:14}}>{parseFloat(r.consommation_kwh||0).toLocaleString('fr-FR')} kWh</td>
                    <td style={{padding:'9px 12px'}}>{parseFloat(r.heures_marche||0).toFixed(1)} h</td>
                    <td style={{padding:'9px 12px',color:'#6b7280'}}>{r.puissance_moyenne_kw?`${parseFloat(r.puissance_moyenne_kw).toFixed(2)} kW`:'—'}</td>
                    <td style={{padding:'9px 12px',fontSize:11,color:'#6b7280'}}>{r.operateur_nom||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {releves.length===0&&<div style={{textAlign:'center',padding:40,color:'#9ca3af'}}><div style={{fontSize:36,marginBottom:8}}>💡</div><p>Aucun relevé — commencez la saisie quotidienne</p></div>}
          </div>

          {/* Historique mensuel */}
          {consoMensuelle.length > 0 && (
            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'auto'}}>
              <div style={{padding:'14px 16px',fontWeight:700,color:'#1d4ed8',borderBottom:'1px solid #e5e7eb'}}>📅 Historique mensuel par machine</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:600}}>
                <thead>
                  <tr style={{background:'#eff6ff'}}>
                    {['Mois','Machine','Atelier','kWh total','Heures','P. moy. kW','Coût FCFA'].map(h=>(
                      <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:700,color:'#1d4ed8',borderBottom:'1px solid #bfdbfe'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consoMensuelle.slice(0,20).map((c,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid #eff6ff',background:i%2===0?'#fff':'#f8fbff'}}>
                      <td style={{padding:'8px 12px',fontWeight:600}}>{new Date(c.mois).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</td>
                      <td style={{padding:'8px 12px',color:'#059669',fontWeight:600}}>{c.equipement_code}</td>
                      <td style={{padding:'8px 12px',color:'#6b7280'}}>{c.atelier||'—'}</td>
                      <td style={{padding:'8px 12px',fontWeight:800,color:'#1d4ed8'}}>{parseFloat(c.total_kwh||0).toLocaleString('fr-FR')}</td>
                      <td style={{padding:'8px 12px'}}>{parseFloat(c.total_heures||0).toFixed(1)}</td>
                      <td style={{padding:'8px 12px'}}>{parseFloat(c.puissance_moyenne_kw||0).toFixed(2)}</td>
                      <td style={{padding:'8px 12px',fontWeight:700,color:'#15803d'}}>{parseFloat(c.cout_fcfa||0).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ FORMULAIRES ══ */}
      {showForm && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:60,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:14,width:'95%',maxWidth:720,padding:24,maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
              <h3 style={{margin:0,color:'#059669',fontSize:16,fontWeight:800}}>
                {formType==='equipement'?'🏭 Équipement':formType==='ot'?'🔧 Ordre de travail':formType==='plan'?'📅 Plan de maintenance':'🔩 Pièce détachée'}
              </h3>
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#9ca3af'}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:16}}>

              {formType==='equipement' && <>
                <F label="Code *" k="code" ph="EQ-001" required/>
                <F label="Désignation *" k="designation" ph="Extrudeuse PP" required/>
                <S label="Type" k="type_equipement" opts={[{v:'machine',l:'Machine'},{v:'installation',l:'Installation'},{v:'vehicule',l:'Véhicule'},{v:'outillage',l:'Outillage'},{v:'informatique',l:'Informatique'},{v:'autre',l:'Autre'}]}/>
                <S label="Criticité" k="criticite" opts={[{v:'critique',l:'🔴 Critique'},{v:'importante',l:'🟠 Importante'},{v:'normale',l:'🔵 Normale'},{v:'faible',l:'⚪ Faible'}]}/>
                <S label="Statut" k="statut" opts={[{v:'en_service',l:'✅ En service'},{v:'en_panne',l:'🔴 En panne'},{v:'en_maintenance',l:'🔧 En maintenance'},{v:'hors_service',l:'⛔ Hors service'}]}/>
                <S label="Atelier" k="atelier_id" opts={ateliers.map(a=>({v:String(a.id),l:`${a.code} — ${a.libelle}`}))}/>
                <F label="Localisation" k="localisation" ph="Zone A, Ligne 2..."/>
                <F label="Marque" k="marque" ph="Battenfeld, Engel..."/>
                <F label="Modèle" k="modele" ph="EM 80/350"/>
                <F label="N° Série" k="numero_serie" ph="SN-2021-001"/>
                <F label="Puissance nominale (kW)" k="puissance_kw" type="number" ph="55"/>
                <F label="Facteur de puissance" k="facteur_puissance" type="number" ph="0.85"/>
                <F label="Tension (V)" k="tension_v" type="number" ph="380"/>
                <F label="Intensité (A)" k="intensite_a" type="number" ph="100"/>
                <F label="Date acquisition" k="date_acquisition" type="date"/>
                <F label="Date mise en service" k="date_mise_en_service" type="date"/>
                <F label="Date fin garantie" k="date_fin_garantie" type="date"/>
                <F label="Valeur acquisition (FCFA)" k="valeur_acquisition" type="number"/>
                <F label="Compteur heures" k="compteur_heures" type="number" ph="0"/>
                <S label="Responsable" k="responsable_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <div style={{gridColumn:'1/-1'}}><F label="Notes" k="notes" ph="Informations complémentaires..."/></div>
              </>}

              {formType==='ot' && <>
                <S label="Type OT *" k="type_ot" required opts={[{v:'curatif',l:'🔧 Curatif'},{v:'preventif',l:'📅 Préventif'},{v:'amelioratif',l:'⬆ Amélioratif'},{v:'urgence',l:'🚨 Urgence'}]}/>
                <S label="Priorité" k="priorite" opts={[{v:'urgente',l:'🔴 Urgente'},{v:'haute',l:'🟠 Haute'},{v:'normale',l:'🟡 Normale'},{v:'basse',l:'⚪ Basse'}]}/>
                <S label="Équipement" k="equipement_id" opts={equipements.map(e=>({v:e.id,l:`${e.code} — ${e.designation}`}))}/>
                <F label="Titre *" k="titre" ph="Remplacement joint..." required/>
                <F label="Date planifiée" k="date_planifiee" type="date"/>
                <F label="Durée estimée (h)" k="duree_estimee_h" type="number" ph="1"/>
                <S label="Technicien" k="technicien_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <S label="Statut" k="statut" opts={[{v:'ouvert',l:'Ouvert'},{v:'planifie',l:'Planifié'},{v:'en_cours',l:'En cours'},{v:'en_attente_pieces',l:'Attente pièces'},{v:'termine',l:'Terminé'},{v:'annule',l:'Annulé'}]}/>
                <div style={{gridColumn:'1/-1',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Symptômes</label>
                    <textarea value={form.symptomes||''} onChange={e=>setForm({...form,symptomes:e.target.value})} rows={2}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                  <div><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Description</label>
                    <textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} rows={2}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                </div>
                {form.statut==='termine'&&<>
                  <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Travaux réalisés</label>
                    <textarea value={form.travaux_realises||''} onChange={e=>setForm({...form,travaux_realises:e.target.value})} rows={2}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                  <div style={{gridColumn:'1/-1'}}><label style={{fontSize:11,fontWeight:600,display:'block',marginBottom:3}}>Cause de la panne</label>
                    <textarea value={form.cause_panne||''} onChange={e=>setForm({...form,cause_panne:e.target.value})} rows={2}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'9px',fontSize:13,boxSizing:'border-box',resize:'vertical'}}/></div>
                  <F label="Coût MO (FCFA)" k="cout_main_oeuvre" type="number" ph="0"/>
                  <F label="Coût pièces (FCFA)" k="cout_pieces" type="number" ph="0"/>
                  <F label="Durée arrêt (h)" k="duree_arret_h" type="number" ph="0"/>
                </>}
                <div style={{display:'flex',alignItems:'center',gap:8,gridColumn:'1/-1'}}>
                  <input type="checkbox" id="arretMachine" checked={!!form.arret_machine}
                    onChange={e=>setForm({...form,arret_machine:e.target.checked})}/>
                  <label htmlFor="arretMachine" style={{fontSize:13,fontWeight:600,color:'#dc2626'}}>⚠ Arrêt machine (impact production)</label>
                </div>
              </>}

              {formType==='plan' && <>
                <S label="Équipement *" k="equipement_id" required opts={equipements.map(e=>({v:e.id,l:`${e.code} — ${e.designation}`}))}/>
                <F label="Titre *" k="titre" ph="Vidange huile, Graissage..." required/>
                <S label="Type" k="type_maintenance" opts={[{v:'preventive',l:'Préventive'},{v:'predictive',l:'Prédictive'},{v:'conditionnelle',l:'Conditionnelle'}]}/>
                <S label="Périodicité" k="periodicite_type" opts={[{v:'jours',l:'Jours'},{v:'semaines',l:'Semaines'},{v:'mois',l:'Mois'},{v:'heures',l:'Heures compteur'}]}/>
                <F label="Valeur période" k="periodicite_valeur" type="number" ph="30"/>
                <F label="Durée estimée (h)" k="duree_estimee_h" type="number" ph="1"/>
                <F label="Coût estimé (FCFA)" k="cout_estime" type="number" ph="0"/>
                <S label="Technicien" k="technicien_id" opts={utilisateurs.map(u=>({v:u.id,l:`${u.prenom} ${u.nom}`}))}/>
                <F label="Dernière réalisation" k="derniere_realisation" type="date"/>
                <div style={{gridColumn:'1/-1'}}><F label="Description / Procédure" k="description" ph="Étapes à suivre..."/></div>
              </>}

              {formType==='releve' && <>
                <S label="Équipement *" k="equipement_id" required opts={equipements.map(e=>({v:e.id,l:`${e.code} — ${e.designation}`}))}/>
                <S label="Atelier" k="atelier_id" opts={ateliers.map(a=>({v:String(a.id),l:`${a.code} — ${a.libelle}`}))}/>
                <F label="Date *" k="date_releve" type="date" required/>
                <S label="Shift" k="shift" opts={[{v:'matin',l:'🌅 Matin'},{v:'apres_midi',l:'🌞 Après-midi'},{v:'nuit',l:'🌙 Nuit'},{v:'journee',l:'☀ Journée complète'}]}/>
                <F label="Index début (kWh)" k="index_debut" type="number" ph="0"/>
                <F label="Index fin (kWh)" k="index_fin" type="number" ph="0"/>
                <div style={{gridColumn:'1/-1',background:'#eff6ff',borderRadius:8,padding:12,fontSize:13,color:'#1d4ed8',fontWeight:700,textAlign:'center'}}>
                  ⚡ Consommation = {Math.max(0,parseFloat(form.index_fin||0)-parseFloat(form.index_debut||0)).toLocaleString('fr-FR')} kWh
                </div>
                <F label="Heures de marche" k="heures_marche" type="number" ph="8"/>
                <F label="Quantité produite" k="quantite_produite" type="number" ph="0"/>
                <F label="Unité production" k="unite_production" ph="kg, sacs, m..."/>
                <div style={{gridColumn:'1/-1'}}><F label="Notes" k="notes" ph="Observations..."/></div>
              </>}

              {formType==='piece' && <>
                <F label="Code *" k="code" ph="PD-001" required/>
                <F label="Désignation *" k="designation" ph="Joint torique 50x3" required/>
                <F label="Famille" k="famille" ph="Joint, Roulement, Courroie..."/>
                <S label="Unité" k="unite" opts={[{v:'pcs',l:'Pièces'},{v:'kg',l:'Kg'},{v:'m',l:'Mètre'},{v:'l',l:'Litre'},{v:'boite',l:'Boîte'}]}/>
                <F label="Stock actuel" k="qte_stock" type="number" ph="0"/>
                <F label="Stock minimum" k="qte_minimum" type="number" ph="2"/>
                <F label="Prix unitaire (FCFA)" k="prix_unitaire" type="number" ph="0"/>
                <F label="Emplacement magasin" k="emplacement_magasin" ph="Étagère A2, Case 3..."/>
                <S label="Fournisseur" k="fournisseur_id" opts={fournisseurs.map(f=>({v:f.id,l:f.nom}))}/>
                <F label="Réf. fournisseur" k="reference_fournisseur" ph="REF-FRN-001"/>
                <F label="Délai livraison (j)" k="delai_livraison_jours" type="number" ph="7"/>
              </>}

            </div>
            <div style={{display:'flex',gap:10,paddingTop:16,borderTop:'1px solid #f3f4f6'}}>
              <button onClick={sauvegarder}
                style={{background:'#059669',color:'#fff',border:'none',padding:'12px 32px',borderRadius:10,cursor:'pointer',fontWeight:800,fontSize:14}}>
                ✓ Enregistrer
              </button>
              <button onClick={()=>setShowForm(false)}
                style={{background:'#f3f4f6',border:'none',padding:'12px 20px',borderRadius:10,cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
