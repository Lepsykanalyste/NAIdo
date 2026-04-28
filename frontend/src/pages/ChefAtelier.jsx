import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const API = '/api';

export default function ChefAtelier() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [trs, setTrs] = useState([]);
  const [rebus, setRebus] = useState([]);
  const [users, setUsers] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ nom:'', prenom:'', login:'', password:'', role_nom:'operateur', badge_qr:'' });

  const chargerDashboard = useCallback(async () => {
    try {
      const [d, t, r] = await Promise.all([
        axios.get(`${API}/kpi/dashboard`),
        axios.get(`${API}/kpi/trs`),
        axios.get(`${API}/kpi/rebus`),
      ]);
      setDashboard(d.data);
      setTrs(t.data.slice(0, 10));
      setRebus(r.data.slice(0, 8));
    } catch { toast.error('Erreur chargement KPI'); }
  }, []);

  const chargerUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/users`);
      setUsers(data);
    } catch {}
  }, []);

  useEffect(() => {
    chargerDashboard();
    const iv = setInterval(chargerDashboard, 30000);
    return () => clearInterval(iv);
  }, [chargerDashboard]);

  useEffect(() => {
    if (onglet === 'users') chargerUsers();
  }, [onglet, chargerUsers]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportLoading(true);
    const fd = new FormData();
    fd.append('fichier', file);
    try {
      const { data } = await axios.post(`${API}/import/sage`, fd);
      toast.success(`Import réussi — ${data.nb_of_importes} OF importés`);
      chargerDashboard();
    } catch { toast.error('Erreur import'); }
    finally { setImportLoading(false); e.target.value = ''; }
  };

  const handleCreateUser = async () => {
    try {
      await axios.post(`${API}/users`, userForm);
      toast.success('Utilisateur créé');
      setShowUserForm(false);
      setUserForm({ nom:'', prenom:'', login:'', password:'', role_nom:'operateur', badge_qr:'' });
      chargerUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const couleurTRS = (v) => v >= 80 ? '#16a34a' : v >= 60 ? '#d97706' : '#dc2626';

  return (
    <div style={{ minHeight:'100vh', background:'#f0fdf4', fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <header style={{ background:'#14532d', color:'#fff', padding:'0 24px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, background:'#4ade80', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#14532d', fontSize:18 }}>N</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>NAIdo — Chef Atelier</div>
            <div style={{ fontSize:11, color:'#86efac' }}>Green Industry · Atelier 3</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:13, color:'#bbf7d0' }}>{user?.prenom} {user?.nom}</span>
          <button onClick={handleLogout} style={{ background:'#166534', border:'none', color:'#4ade80', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:13 }}>Déconnexion</button>
        </div>
      </header>

      {/* Nav onglets */}
      <nav style={{ background:'#fff', borderBottom:'2px solid #dcfce7', display:'flex', gap:0, overflowX:'auto' }}>
        {[
          { id:'dashboard', label:'Tableau de bord' },
          { id:'trs',       label:'TRS Machines' },
          { id:'rebus',     label:'Taux de Rebus' },
          { id:'import',    label:'Import Sage' },
          { id:'users',     label:'Utilisateurs' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            padding:'14px 24px', border:'none', background:'none', cursor:'pointer',
            fontWeight: onglet===o.id ? 700 : 400,
            color: onglet===o.id ? '#15803d' : '#4b5563',
            borderBottom: onglet===o.id ? '3px solid #15803d' : '3px solid transparent',
            fontSize:14, whiteSpace:'nowrap', transition:'all .15s'
          }}>{o.label}</button>
        ))}
      </nav>

      <main style={{ padding:'24px', maxWidth:1200, margin:'0 auto' }}>

        {/* ── DASHBOARD ── */}
        {onglet === 'dashboard' && dashboard && (
          <div>
            {/* Alertes rebus */}
            {dashboard.alertes_rebus?.length > 0 && (
              <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'14px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:10, height:10, background:'#ef4444', borderRadius:'50%', flexShrink:0 }}/>
                <div>
                  <strong style={{ color:'#dc2626' }}>Alerte rebus &gt; 5% :</strong>
                  {dashboard.alertes_rebus.map(a => (
                    <span key={a.machine_code} style={{ marginLeft:8, background:'#fee2e2', color:'#991b1b', padding:'2px 8px', borderRadius:4, fontSize:13 }}>
                      {a.machine_code} — {a.taux_rebus_pct}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:28 }}>
              {[
                { label:'Sessions actives',    value: dashboard.sessions_actives,                    unit:'',   color:'#15803d', bg:'#dcfce7' },
                { label:'TRS moyen',           value: dashboard.trs_moyen + '%',                     unit:'',   color:'#0369a1', bg:'#e0f2fe' },
                { label:'Production du jour',  value: dashboard.poids_net_total?.toFixed(1),         unit:'kg', color:'#7e22ce', bg:'#f3e8ff' },
                { label:'Déchets du jour',     value: dashboard.poids_dechets_total?.toFixed(1),     unit:'kg', color:'#c2410c', bg:'#fff7ed' },
                { label:'Tickets imprimés',    value: dashboard.nb_tickets,                          unit:'',   color:'#0f766e', bg:'#f0fdfa' },
                { label:'Arrêts en cours',     value: dashboard.arrets_actifs,                       unit:'',   color:'#b91c1c', bg:'#fef2f2' },
              ].map(k => (
                <div key={k.label} style={{ background:k.bg, borderRadius:14, padding:'20px 18px', border:`1px solid ${k.color}22` }}>
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:6, fontWeight:500 }}>{k.label}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:k.color }}>{k.value ?? '—'}<span style={{ fontSize:14, marginLeft:4 }}>{k.unit}</span></div>
                </div>
              ))}
            </div>

            {/* Graphe TRS du jour */}
            {trs.length > 0 && (
              <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dcfce7' }}>
                <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#14532d' }}>TRS par machine — aujourd'hui</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trs} margin={{ top:5, right:10, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4"/>
                    <XAxis dataKey="machine_code" tick={{ fontSize:12 }}/>
                    <YAxis domain={[0,100]} tick={{ fontSize:12 }}/>
                    <Tooltip formatter={(v) => v + '%'}/>
                    <Bar dataKey="trs_pct" radius={[6,6,0,0]}>
                      {trs.map((e,i) => <Cell key={i} fill={couleurTRS(e.trs_pct)}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── TRS ── */}
        {onglet === 'trs' && (
          <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dcfce7' }}>
            <h3 style={{ margin:'0 0 20px', fontSize:15, fontWeight:700, color:'#14532d' }}>TRS détaillé — 7 derniers jours</h3>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead>
                  <tr style={{ background:'#f0fdf4' }}>
                    {['Date','Machine','Shift','Temps prod','Temps arrêt','TRS %','Poids net','Rebus %'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trs.map((r,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #f0fdf4', background: i%2===0 ? '#fff' : '#f9fefb' }}>
                      <td style={{ padding:'10px 14px' }}>{r.date_session}</td>
                      <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.machine_code}</td>
                      <td style={{ padding:'10px 14px' }}>{r.shift_nom}</td>
                      <td style={{ padding:'10px 14px' }}>{r.temps_prod_min} min</td>
                      <td style={{ padding:'10px 14px', color:'#dc2626' }}>{r.temps_arret_min} min</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ background: couleurTRS(r.trs_pct)+'22', color: couleurTRS(r.trs_pct), padding:'3px 10px', borderRadius:20, fontWeight:700, fontSize:13 }}>
                          {r.trs_pct}%
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px' }}>{r.poids_net_total_kg} kg</td>
                      <td style={{ padding:'10px 14px', color: r.taux_rebus_pct > 5 ? '#dc2626' : '#16a34a', fontWeight:600 }}>{r.taux_rebus_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trs.length === 0 && <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Aucune donnée disponible</p>}
            </div>
          </div>
        )}

        {/* ── REBUS ── */}
        {onglet === 'rebus' && (
          <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dcfce7' }}>
            <h3 style={{ margin:'0 0 20px', fontSize:15, fontWeight:700, color:'#14532d' }}>Taux de rebus — 7 derniers jours</h3>
            {rebus.length > 0 && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rebus} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fef2f2"/>
                  <XAxis dataKey="machine" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:12 }}/>
                  <Tooltip formatter={(v) => v + '%'}/>
                  <Bar dataKey="taux_rebus_pct" radius={[6,6,0,0]} fill="#ef4444"/>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ overflowX:'auto', marginTop:24 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead>
                  <tr style={{ background:'#fff7ed' }}>
                    {['Machine','Article','Shift','Taux rebus','Déchets kg','Produit kg'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#c2410c', borderBottom:'2px solid #fed7aa' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rebus.map((r,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid #fff7ed', background: i%2===0 ? '#fff' : '#fffbf7' }}>
                      <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.machine}</td>
                      <td style={{ padding:'10px 14px' }}>{r.article_nom}</td>
                      <td style={{ padding:'10px 14px' }}>{r.shift}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ background: r.taux_rebus_pct > 5 ? '#fee2e2' : '#dcfce7', color: r.taux_rebus_pct > 5 ? '#dc2626' : '#16a34a', padding:'3px 10px', borderRadius:20, fontWeight:700, fontSize:13 }}>
                          {r.taux_rebus_pct}%
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', color:'#dc2626' }}>{r.total_dechets_kg} kg</td>
                      <td style={{ padding:'10px 14px' }}>{r.total_produit_kg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rebus.length === 0 && <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Aucune donnée disponible</p>}
            </div>
          </div>
        )}

        {/* ── IMPORT SAGE ── */}
        {onglet === 'import' && (
          <div style={{ maxWidth:600 }}>
            <div style={{ background:'#fff', borderRadius:14, padding:32, border:'1px solid #dcfce7' }}>
              <h3 style={{ margin:'0 0 8px', fontSize:16, fontWeight:700, color:'#14532d' }}>Import commandes depuis Sage 100</h3>
              <p style={{ color:'#6b7280', fontSize:14, margin:'0 0 24px' }}>
                Exportez vos OF depuis Sage en Excel, puis importez-les ici.<br/>
                Colonnes attendues : N° OF · Code client · Nom client · Réf article · Désignation · Cadence/h · Temps réglage · Quantité · Date livraison
              </p>
              <label style={{
                display:'block', border:'2px dashed #86efac', borderRadius:12,
                padding:'40px 24px', textAlign:'center', cursor:'pointer',
                background: importLoading ? '#f9fafb' : '#f0fdf4', transition:'background .2s'
              }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📂</div>
                <div style={{ fontWeight:600, color:'#15803d', marginBottom:4 }}>
                  {importLoading ? 'Import en cours...' : 'Cliquez pour choisir le fichier Excel'}
                </div>
                <div style={{ fontSize:12, color:'#9ca3af' }}>.xlsx ou .xls — Max 10 Mo</div>
                <input type="file" accept=".xlsx,.xls" onChange={handleImport} style={{ display:'none' }} disabled={importLoading}/>
              </label>

              <div style={{ marginTop:24, padding:16, background:'#f0fdf4', borderRadius:10, fontSize:13, color:'#374151' }}>
                <strong style={{ color:'#15803d' }}>Comment exporter depuis Sage 100 :</strong>
                <ol style={{ margin:'8px 0 0', paddingLeft:20, lineHeight:2 }}>
                  <li>Fichier → Exporter</li>
                  <li>Choisir "Commandes clients" ou "OF"</li>
                  <li>Format : Excel (.xlsx)</li>
                  <li>Importer le fichier ici</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {onglet === 'users' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#14532d' }}>Gestion des utilisateurs</h3>
              <button onClick={() => setShowUserForm(true)} style={{ background:'#15803d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:14 }}>
                + Nouvel utilisateur
              </button>
            </div>

            {/* Formulaire création */}
            {showUserForm && (
              <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #86efac', marginBottom:24 }}>
                <h4 style={{ margin:'0 0 16px', color:'#14532d' }}>Créer un utilisateur</h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[
                    { label:'Nom',      key:'nom',      type:'text' },
                    { label:'Prénom',   key:'prenom',   type:'text' },
                    { label:'Login',    key:'login',    type:'text' },
                    { label:'Mot de passe', key:'password', type:'password' },
                    { label:'Badge QR (optionnel)', key:'badge_qr', type:'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>{f.label}</label>
                      <input type={f.type} value={userForm[f.key]} onChange={e => setUserForm({...userForm, [f.key]:e.target.value})}
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 12px', fontSize:14, boxSizing:'border-box' }}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Rôle</label>
                    <select value={userForm.role_nom} onChange={e => setUserForm({...userForm, role_nom:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px 12px', fontSize:14 }}>
                      <option value="operateur">Opérateur</option>
                      <option value="regleur">Régleur</option>
                      <option value="qualite">Contrôleur Qualité</option>
                      <option value="chef_atelier">Chef Atelier</option>
                    </select>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:16 }}>
                  <button onClick={handleCreateUser} style={{ background:'#15803d', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>Créer</button>
                  <button onClick={() => setShowUserForm(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Liste utilisateurs */}
            <div style={{ background:'#fff', borderRadius:14, border:'1px solid #dcfce7', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead>
                  <tr style={{ background:'#f0fdf4' }}>
                    {['Nom','Login','Rôle','Badge QR','Statut'].map(h => (
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u,i) => (
                    <tr key={u.id} style={{ borderBottom:'1px solid #f0fdf4', background: i%2===0 ? '#fff' : '#f9fefb' }}>
                      <td style={{ padding:'12px 16px', fontWeight:600 }}>{u.prenom} {u.nom}</td>
                      <td style={{ padding:'12px 16px', fontFamily:'monospace', color:'#6b7280' }}>{u.login}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ background: {operateur:'#dbeafe',regleur:'#fef9c3',qualite:'#f3e8ff',chef_atelier:'#dcfce7'}[u.role]||'#f3f4f6',
                          color: {operateur:'#1d4ed8',regleur:'#a16207',qualite:'#7e22ce',chef_atelier:'#15803d'}[u.role]||'#374151',
                          padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:12, color:'#9ca3af' }}>{u.badge_qr || '—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ color: u.actif ? '#16a34a' : '#dc2626', fontWeight:600 }}>{u.actif ? 'Actif' : 'Inactif'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Aucun utilisateur</p>}
            </div>

            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:12, marginTop:32 }}>
              © 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
