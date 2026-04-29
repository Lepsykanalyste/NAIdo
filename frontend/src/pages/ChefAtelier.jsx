import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API = '/api';

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
  { id:'separator4',  label:'ADMIN & IA',          separator:true },
  { id:'kpi',         label:'KPI & Rapports',      icon:'kpi',         color:'#be185d' },
  { id:'ia',          label:'Assistant IA',        icon:'ia',          color:'#1e40af' },
  { id:'users',       label:'Utilisateurs',        icon:'users',       color:'#374151' },
  { id:'import',      label:'Import Sage',         icon:'import',      color:'#15803d' },
  { id:'alertes',     label:'Alertes',             icon:'alertes',     color:'#dc2626' },
  { id:'referentiels',label:'Référentiels',        icon:'articles',    color:'#6b7280' },
];

// ══════════════════════════════════════════════════════════════
// COMPOSANTS DE SECTION
// ══════════════════════════════════════════════════════════════

function Dashboard() {
  const [data, setData] = useState({ sessions_actives:0, trs_moyen:0, poids_net_total:0, poids_dechets_total:0, nb_tickets:0, arrets_actifs:0, alertes_rebus:[] });
  const [trs, setTrs] = useState([]);
  const [rebus, setRebus] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [d, t, r] = await Promise.all([
          axios.get(`${API}/kpi/dashboard`),
          axios.get(`${API}/kpi/trs`),
          axios.get(`${API}/kpi/rebus`),
        ]);
        setData(d.data);
        setTrs(t.data.slice(0, 10));
        setRebus(r.data.slice(0, 8));
      } catch {}
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const couleurTRS = (v) => v >= 80 ? '#16a34a' : v >= 60 ? '#d97706' : '#dc2626';


  return (
    <div>
      {data.alertes_rebus?.length > 0 && (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'12px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚠</span>
          <strong style={{ color:'#dc2626' }}>Alerte rebus &gt; 5% :</strong>
          {data.alertes_rebus.map(a => (
            <span key={a.machine_code} style={{ background:'#fee2e2', color:'#991b1b', padding:'2px 8px', borderRadius:20, fontSize:12 }}>
              {a.machine_code} — {a.taux_rebus_pct}%
            </span>
          ))}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Sessions actives',   value:data.sessions_actives,                       unit:'',   color:'#15803d', bg:'#dcfce7' },
          { label:'TRS moyen',          value:(data.trs_moyen||0)+'%',                     unit:'',   color:'#0369a1', bg:'#e0f2fe' },
          { label:'Production du jour', value:(data.poids_net_total||0).toFixed(1),        unit:'kg', color:'#7e22ce', bg:'#f3e8ff' },
          { label:'Déchets du jour',    value:(data.poids_dechets_total||0).toFixed(1),    unit:'kg', color:'#c2410c', bg:'#fff7ed' },
          { label:'Tickets imprimés',   value:data.nb_tickets,                             unit:'',   color:'#0f766e', bg:'#f0fdfa' },
          { label:'Arrêts en cours',    value:data.arrets_actifs,                          unit:'',   color:'#b91c1c', bg:'#fef2f2' },
        ].map(k => (
          <div key={k.label} style={{ background:k.bg, borderRadius:12, padding:'18px 16px' }}>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:k.color }}>{k.value}<span style={{ fontSize:13, marginLeft:3 }}>{k.unit}</span></div>
          </div>
        ))}
      </div>

      {trs.length > 0 && (
        <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb', marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'#14532d' }}>TRS par machine — aujourd'hui</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trs}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4"/>
              <XAxis dataKey="machine_code" tick={{ fontSize:11 }}/>
              <YAxis domain={[0,100]} tick={{ fontSize:11 }}/>
              <Tooltip formatter={v => v+'%'}/>
              <Bar dataKey="trs_pct" radius={[6,6,0,0]}>
                {trs.map((e,i) => <Cell key={i} fill={couleurTRS(e.trs_pct)}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {rebus.length > 0 && (
        <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'#dc2626' }}>Taux de rebus — 7 jours</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={rebus}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="machine" tick={{ fontSize:11 }}/>
              <YAxis tick={{ fontSize:11 }}/>
              <Tooltip formatter={v => v+'%'}/>
              <Bar dataKey="taux_rebus_pct" fill="#ef4444" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {trs.length === 0 && rebus.length === 0 && (
        <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
          <p style={{ color:'#6b7280', fontSize:15 }}>Aucune donnée de production encore</p>
          <p style={{ color:'#9ca3af', fontSize:13 }}>Les KPI s'afficheront dès qu'un opérateur saisira de la production</p>
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
  const [ncs, setNcs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [ateliers, setAteliers] = useState([]);
  const [form, setForm] = useState({ type:'interne', gravite:'mineure', atelier_id:'', titre:'', description:'', causes_identifiees:'', action_immediate:'', gravite_amdec:'', occurrence_amdec:'', detectabilite_amdec:'' });

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/nc`),
      axios.get(`${API}/ateliers`),
    ]).then(([n,a]) => { setNcs(n.data); setAteliers(a.data); }).catch(() => {});
  }, []);

  const creer = async () => {
    if (!form.titre || !form.description) return toast.error('Titre et description requis');
    try {
      await axios.post(`${API}/nc`, form);
      toast.success('NC créée');
      setShowForm(false);
      const { data } = await axios.get(`${API}/nc`);
      setNcs(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const analyserIA = async (id) => {
    try {
      toast('Analyse IA en cours...', { icon:'🤖' });
      await axios.post(`${API}/ia/analyser-nc`, { nc_id: id });
      toast.success('Analyse IA effectuée — consultez la NC');
    } catch { toast.error('IA non disponible'); }
  };

  const GCOLOR = { mineure:'#dbeafe', majeure:'#fef3c7', critique:'#fee2e2', bloquante:'#fce7f3' };
  const GTEXT  = { mineure:'#1d4ed8', majeure:'#92400e', critique:'#dc2626', bloquante:'#9d174d' };
  const SCOLOR = { ouvert:'#fef3c7', en_cours:'#dbeafe', clos:'#dcfce7', annule:'#f3f4f6' };
  const STEXT  = { ouvert:'#92400e', en_cours:'#1d4ed8', clos:'#15803d', annule:'#6b7280' };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <button onClick={() => setShowForm(true)} style={{ background:'#b45309', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>+ Nouvelle NC</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #fcd34d', marginBottom:16 }}>
          <h4 style={{ margin:'0 0 16px', color:'#b45309', fontSize:15, fontWeight:700 }}>Nouvelle Non-Conformité</h4>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Type</label>
              <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                {['interne','client','fournisseur','produit','processus','equipement','securite'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Gravité</label>
              <select value={form.gravite} onChange={e => setForm({...form,gravite:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                {['mineure','majeure','critique','bloquante'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Atelier</label>
              <select value={form.atelier_id} onChange={e => setForm({...form,atelier_id:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                <option value="">Sélectionner...</option>
                {ateliers.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
              </select>
            </div>
            {[['G AMDEC (1-10)','gravite_amdec'],['O AMDEC (1-10)','occurrence_amdec'],['D AMDEC (1-10)','detectabilite_amdec']].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                <input type="number" min="1" max="10" value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, textAlign:'center', boxSizing:'border-box' }}/>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gap:10, marginBottom:14 }}>
            {[['Titre *','titre'],['Description *','description'],['Causes identifiées','causes_identifiees'],['Action immédiate','action_immediate']].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                <textarea value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} rows={2}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }}/>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={creer} style={{ background:'#b45309', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>✓ Créer NC</button>
            <button onClick={() => setShowForm(false)} style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#fffbeb' }}>
              {['N° NC','Type','Titre','Atelier','Gravité','IPR','Statut','IA','Date'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#b45309', borderBottom:'2px solid #fde68a', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ncs.map((n,i) => (
              <tr key={n.id} style={{ borderBottom:'1px solid #fffbeb', background:i%2===0?'#fff':'#fffdf5' }}>
                <td style={{ padding:'8px 12px', fontFamily:'monospace', fontWeight:700, color:'#b45309', fontSize:12 }}>{n.numero_nc}</td>
                <td style={{ padding:'8px 12px', fontSize:12 }}>{n.type}</td>
                <td style={{ padding:'8px 12px', fontWeight:500 }}>{n.titre?.substring(0,40)}</td>
                <td style={{ padding:'8px 12px', fontSize:12, color:'#6b7280' }}>{n.atelier_libelle||'—'}</td>
                <td style={{ padding:'8px 12px' }}>
                  <span style={{ background:GCOLOR[n.gravite]||'#f3f4f6', color:GTEXT[n.gravite]||'#374151', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{n.gravite}</span>
                </td>
                <td style={{ padding:'8px 12px', fontWeight:700, color:n.ipr_amdec>100?'#dc2626':'#374151' }}>{n.ipr_amdec||'—'}</td>
                <td style={{ padding:'8px 12px' }}>
                  <span style={{ background:SCOLOR[n.statut]||'#f3f4f6', color:STEXT[n.statut]||'#374151', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{n.statut}</span>
                </td>
                <td style={{ padding:'8px 12px' }}>
                  <button onClick={() => analyserIA(n.id)} title="Analyser avec IA" style={{ background:'#ede9fe', color:'#7e22ce', border:'1px solid #c4b5fd', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>🤖</button>
                </td>
                <td style={{ padding:'8px 12px', fontSize:11, color:'#9ca3af' }}>{new Date(n.date_detection||n.created_at).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ncs.length === 0 && (
          <div style={{ textAlign:'center', padding:48, color:'#9ca3af' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>✅</div>
            <p>Aucune non-conformité enregistrée</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantIA() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [iaStatus, setIaStatus] = useState(null);

  useEffect(() => {
    axios.get(`${API}/ia/status`).then(({data}) => setIaStatus(data)).catch(() => setIaStatus({disponible:false}));
  }, []);

  const envoyer = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role:'user', content:msg }]);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/ia/chat`, {
        message: msg,
        historique: messages.map(m => ({ role:m.role, content:m.content }))
      });
      setMessages(prev => [...prev, { role:'assistant', content:data.reponse, modele:data.modele }]);
    } catch {
      setMessages(prev => [...prev, { role:'assistant', content:'❌ IA non disponible. Vérifiez qu\'Ollama est démarré sur le serveur.' }]);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 200px)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:iaStatus?.disponible?'#16a34a':'#dc2626' }}/>
        <span style={{ fontSize:13, fontWeight:600, color:iaStatus?.disponible?'#15803d':'#dc2626' }}>
          {iaStatus?.disponible ? `IA disponible — ${iaStatus.modele_actif}` : 'IA hors ligne — démarrez Ollama sur le serveur'}
        </span>
      </div>

      <div style={{ flex:1, background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:14 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:'center', margin:'auto', color:'#9ca3af' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🤖</div>
            <p style={{ fontSize:15, fontWeight:600, color:'#374151' }}>Assistant IA NAIdo</p>
            <p style={{ fontSize:13 }}>Propulsé par Ollama · modèle local · données privées</p>
            <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap', marginTop:16 }}>
              {['Analyse mon TRS','Causes de rebus élevé','Génère une procédure ISO','Optimiser la cadence'].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'8px 14px', borderRadius:20, cursor:'pointer', fontSize:12 }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'80%', padding:'12px 16px', borderRadius:12, background:m.role==='user'?'#14532d':'#f9fafb', color:m.role==='user'?'#fff':'#374151', border:m.role==='assistant'?'1px solid #e5e7eb':'none', fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
              {m.role==='assistant' && <div style={{ fontSize:11, color:'#9ca3af', marginBottom:6 }}>🤖 {m.modele||'IA'}</div>}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#9ca3af' }}>🤖 Réflexion en cours... ⏳</div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:10, marginTop:12, alignItems:'flex-end' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();envoyer();} }}
          placeholder="Posez votre question... (Entrée pour envoyer)"
          rows={2} style={{ flex:1, border:'1px solid #d1d5db', borderRadius:10, padding:'10px 14px', fontSize:13, resize:'none', outline:'none' }}/>
        <button onClick={envoyer} disabled={loading||!input.trim()}
          style={{ background:(!input.trim()||loading)?'#d1d5db':'#14532d', color:'#fff', border:'none', padding:'12px 20px', borderRadius:10, cursor:'pointer', fontWeight:700 }}>
          {loading?'...':'↑'}
        </button>
      </div>
    </div>
  );
}

function Utilisateurs() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom:'', prenom:'', login:'', password:'', role_nom:'operateur', badge_qr:'' });

  useEffect(() => {
    axios.get(`${API}/users`).then(({data}) => setUsers(data)).catch(() => {});
  }, []);

  const creer = async () => {
    try {
      await axios.post(`${API}/users`, form);
      toast.success('Utilisateur créé');
      setShowForm(false);
      const { data } = await axios.get(`${API}/users`);
      setUsers(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const ROLE_COLOR = { operateur:'#dbeafe', regleur:'#fef9c3', qualite:'#f3e8ff', chef_atelier:'#dcfce7', super_admin:'#fce7f3' };
  const ROLE_TEXT  = { operateur:'#1d4ed8', regleur:'#a16207', qualite:'#7e22ce', chef_atelier:'#15803d', super_admin:'#9d174d' };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
        <button onClick={() => setShowForm(true)} style={{ background:'#374151', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>+ Nouvel utilisateur</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #d1d5db', marginBottom:16 }}>
          <h4 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700 }}>Créer un utilisateur</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            {[['Nom','nom'],['Prénom','prenom'],['Login','login'],['Mot de passe','password'],['Badge QR (optionnel)','badge_qr']].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>{label}</label>
                <input type={key==='password'?'password':'text'} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 12px', fontSize:14, boxSizing:'border-box' }}/>
              </div>
            ))}
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Rôle</label>
              <select value={form.role_nom} onChange={e => setForm({...form,role_nom:e.target.value})} style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 12px', fontSize:14 }}>
                <option value="operateur">Opérateur</option>
                <option value="regleur">Régleur</option>
                <option value="qualite">Contrôleur Qualité</option>
                <option value="chef_atelier">Chef Atelier</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={creer} style={{ background:'#374151', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>Créer</button>
            <button onClick={() => setShowForm(false)} style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Nom','Login','Rôle','Badge QR','Statut'].map(h => (
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u,i) => (
              <tr key={u.id} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'#fff':'#fafafa' }}>
                <td style={{ padding:'12px 16px', fontWeight:600 }}>{u.prenom} {u.nom}</td>
                <td style={{ padding:'12px 16px', fontFamily:'monospace', color:'#6b7280' }}>{u.login}</td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ background:ROLE_COLOR[u.role]||'#f3f4f6', color:ROLE_TEXT[u.role]||'#374151', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{u.role}</span>
                </td>
                <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:12, color:'#9ca3af' }}>{u.badge_qr||'—'}</td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ color:u.actif?'#16a34a':'#dc2626', fontWeight:600 }}>{u.actif?'Actif':'Inactif'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            <thead><tr style={{ background:'#fdf2f8' }}>{['Type','Période','Date génération','PDF','Excel'].map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#be185d', borderBottom:'2px solid #fbcfe8' }}>{h}</th>)}</tr></thead>
            <tbody>
              {rapports.map((r,i) => (
                <tr key={r.id} style={{ borderBottom:'1px solid #fdf2f8', background:i%2===0?'#fff':'#fdfafc' }}>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:'#fce7f3', color:'#be185d', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{r.type}</span></td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12 }}>{r.periode_debut} → {r.periode_fin}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                  <td style={{ padding:'10px 14px' }}>{r.pdf_path && <button onClick={async()=>{const {data}=await axios.get(`${API}/rapports/${r.id}/pdf`,{responseType:'blob'});const url=URL.createObjectURL(data);window.open(url,'_blank');}} style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', padding:'3px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>📄 PDF</button>}</td>
                  <td style={{ padding:'10px 14px' }}>{r.excel_path && <button onClick={async()=>{const {data}=await axios.get(`${API}/rapports/${r.id}/excel`,{responseType:'blob'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download='rapport.xlsx';a.click();}} style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', padding:'3px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}>📊 Excel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GMAO() {
  return (
    <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #fde68a' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
      <h3 style={{ color:'#92400e', margin:'0 0 8px' }}>Module GMAO — En développement</h3>
      <p style={{ color:'#6b7280' }}>Gestion des équipements, plans de maintenance, ordres de travail</p>
      <p style={{ color:'#9ca3af', fontSize:13 }}>Les tables sont créées en base de données — interface en cours</p>
    </div>
  );
}

function Stock() {
  const [onglet, setOnglet] = useState('inventaire');
  const [inventaire, setInventaire] = useState([]);
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
    // Chaque requête indépendante pour isoler les erreurs
    try { const {data} = await axios.get(`${API}/stock/inventaire${filtreArt?`?search=${filtreArt}`:''}`); setInventaire(data); } 
    catch(e) { console.error('inventaire:',e.message); setInventaire([]); }
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
          { label:'Articles en stock', value:inventaire.length, color:'#1d4ed8', bg:'#dbeafe', icon:'📦' },
          { label:'Alertes stock bas', value:alertesBas, color: alertesBas>0?'#dc2626':'#15803d', bg: alertesBas>0?'#fee2e2':'#dcfce7', icon:'⚠' },
          { label:'Lots actifs', value:lots.filter(l=>l.statut==='disponible').length, color:'#15803d', bg:'#dcfce7', icon:'🏷' },
          { label:'Lots expirés', value:lotsExpires, color: lotsExpires>0?'#dc2626':'#15803d', bg: lotsExpires>0?'#fee2e2':'#dcfce7', icon:'⏰' },
          { label:'DLC < 30 jours', value:lotsProches, color: lotsProches>0?'#d97706':'#15803d', bg: lotsProches>0?'#fef3c7':'#dcfce7', icon:'📅' },
        ].map(k => (
          <div key={k.label} style={{ background:k.bg, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:k.color }}>{k.value}</div>
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
        <div style={{ background:'#fff', borderRadius:12, padding:20, border:`2px solid ${typeMvt==='entree'?'#86efac':'#fca5a5'}`, marginBottom:16 }}>
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
        <div style={{ background:'#fff', borderRadius:12, padding:20, border:'2px solid #93c5fd', marginBottom:16 }}>
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
                {['Code','Article','Famille','Unité','Stock dispo','Réservé','Stock mini','Valeur','⚠','Actions'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#1d4ed8', borderBottom:'2px solid #bfdbfe', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventaire.map((a, i) => (
                <tr key={a.id} style={{ borderBottom:'1px solid #eff6ff', background: a.alerte_stock_bas ? '#fff7ed' : i%2===0?'#fff':'#f8faff' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:700, color:'#1d4ed8', fontSize:12 }}>{a.code}</td>
                  <td style={{ padding:'9px 14px', fontWeight:500 }}>{a.designation}</td>
                  <td style={{ padding:'9px 14px', color:'#6b7280', fontSize:12 }}>{a.famille||'—'}</td>
                  <td style={{ padding:'9px 14px' }}><span style={{ fontFamily:'monospace', background:'#dbeafe', color:'#1d4ed8', padding:'2px 6px', borderRadius:4, fontSize:12 }}>{a.unite||'—'}</span></td>
                  <td style={{ padding:'9px 14px', fontWeight:800, fontSize:15, color: parseFloat(a.stock_total_dispo||0) === 0 ? '#dc2626' : '#15803d' }}>
                    {parseFloat(a.stock_total_dispo||0).toFixed(3)}
                  </td>
                  <td style={{ padding:'9px 14px', color:'#6b7280' }}>{parseFloat(a.stock_total_reserve||0).toFixed(3)}</td>
                  <td style={{ padding:'9px 14px', color:'#9ca3af' }}>{parseFloat(a.stock_mini||0).toFixed(3)}</td>
                  <td style={{ padding:'9px 14px', fontWeight:600 }}>{parseFloat(a.valeur_totale||0).toFixed(2)} FCFA</td>
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

export default function ChefAtelier() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ongletActif, setOngletActif] = useState('dashboard');
  const [sidebarOuverte, setSidebarOuverte] = useState(true);
  const [nbAlertes, setNbAlertes] = useState(0);

  useEffect(() => {
    const chargerAlertes = () => {
      axios.get(`${API}/alertes/count`).then(({data}) => setNbAlertes(data.count)).catch(() => {});
    };
    chargerAlertes();
    const iv = setInterval(chargerAlertes, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SECTIONS = {
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
    gmao:        <GMAO />,
    kpi:         <KPIRapports />,
    ia:          <AssistantIA />,
    users:       <Utilisateurs />,
    import:      <ImportSage />,
    alertes:     <Alertes />,
    referentiels:<Referentiels />,
  };

  const menuItem = MENU.find(m => m.id === ongletActif);

  return (
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
          {MENU.map(item => {
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
