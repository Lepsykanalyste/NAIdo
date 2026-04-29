import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = '/api';

export default function BilanMatiere() {
  const [onglet, setOnglet] = useState('bilan');
  const [bilan, setBilan] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [lots, setLots] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [ticketTrouve, setTicketTrouve] = useState(null);
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [dateFin, setDateFin] = useState(new Date().toISOString().split('T')[0]);
  const [showFormMatiere, setShowFormMatiere] = useState(false);
  const [showFormLot, setShowFormLot] = useState(false);
  const [formMatiere, setFormMatiere] = useState({ reference:'', designation:'', type:'granules', stock_minimum:'' });
  const [formLot, setFormLot] = useState({ matiere_id:'', numero_lot:'', fournisseur:'', quantite_recue_kg:'', date_reception:'' });

  const chargerBilan = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/tracabilite/bilan?date_debut=${dateDebut}&date_fin=${dateFin}`);
      setBilan(data);
    } catch {}
  }, [dateDebut, dateFin]);

  const chargerMatieres = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/tracabilite/matieres`);
      setMatieres(data);
    } catch {}
  }, []);

  const chargerLots = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/tracabilite/lots`);
      setLots(data);
    } catch {}
  }, []);

  useEffect(() => { chargerBilan(); }, [chargerBilan]);
  useEffect(() => { chargerMatieres(); chargerLots(); }, [chargerMatieres, chargerLots]);

  const rechercherTicket = async () => {
    if (!recherche) return;
    try {
      const { data } = await axios.get(`${API}/tracabilite/ticket/${recherche}`);
      setTicketTrouve(data);
    } catch { toast.error('Ticket introuvable'); setTicketTrouve(null); }
  };

  const creerMatiere = async () => {
    try {
      await axios.post(`${API}/tracabilite/matieres`, formMatiere);
      toast.success('Matière créée');
      setShowFormMatiere(false);
      setFormMatiere({ reference:'', designation:'', type:'granules', stock_minimum:'' });
      chargerMatieres();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const creerLot = async () => {
    try {
      await axios.post(`${API}/tracabilite/lots`, formLot);
      toast.success('Réception enregistrée');
      setShowFormLot(false);
      setFormLot({ matiere_id:'', numero_lot:'', fournisseur:'', quantite_recue_kg:'', date_reception:'' });
      chargerLots(); chargerMatieres();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  // Données graphe bilan
  const dataBilan = bilan.reduce((acc, row) => {
    const existing = acc.find(r => r.date === row.date_jour);
    if (existing) {
      existing.entree += parseFloat(row.matiere_entree_kg || 0);
      existing.fini += parseFloat(row.produit_fini_kg || 0);
      existing.dechets += parseFloat(row.dechets_kg || 0);
    } else {
      acc.push({ date: row.date_jour, entree: parseFloat(row.matiere_entree_kg || 0), fini: parseFloat(row.produit_fini_kg || 0), dechets: parseFloat(row.dechets_kg || 0) });
    }
    return acc;
  }, []).sort((a,b) => a.date.localeCompare(b.date));

  const totalEntree = bilan.reduce((s, r) => s + parseFloat(r.matiere_entree_kg || 0), 0);
  const totalFini = bilan.reduce((s, r) => s + parseFloat(r.produit_fini_kg || 0), 0);
  const totalDechets = bilan.reduce((s, r) => s + parseFloat(r.dechets_kg || 0), 0);

  return (
    <div>
      <nav style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'2px solid #e5e7eb' }}>
        {[
          { id:'bilan',      label:'Bilan Matière' },
          { id:'stocks',     label:'Stocks & Lots' },
          { id:'tracabilite',label:'Traçabilité ticket' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            padding:'12px 20px', border:'none', background:'none', cursor:'pointer',
            fontWeight: onglet===o.id ? 700 : 400,
            color: onglet===o.id ? '#15803d' : '#4b5563',
            borderBottom: onglet===o.id ? '3px solid #15803d' : '3px solid transparent',
            fontSize:14
          }}>{o.label}</button>
        ))}
      </nav>

      {/* ── BILAN MATIÈRE ── */}
      {onglet === 'bilan' && (
        <div>
          {/* Sélection période */}
          <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>Du</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13 }}/>
              <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>au</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13 }}/>
            </div>
          </div>

          {/* KPI bilan */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
            {[
              { label:'Matière entrée', value:`${totalEntree.toFixed(1)} kg`, color:'#1d4ed8', bg:'#dbeafe' },
              { label:'Produit fini', value:`${totalFini.toFixed(1)} kg`, color:'#15803d', bg:'#dcfce7' },
              { label:'Déchets', value:`${totalDechets.toFixed(1)} kg`, color:'#dc2626', bg:'#fee2e2' },
              { label:'Taux transformation', value:totalEntree > 0 ? `${(totalFini/totalEntree*100).toFixed(1)}%` : '—', color:'#7e22ce', bg:'#f3e8ff' },
            ].map(k => (
              <div key={k.label} style={{ background:k.bg, borderRadius:12, padding:'16px', border:`1px solid ${k.color}22` }}>
                <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>{k.label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Graphe */}
          {dataBilan.length > 0 && (
            <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb', marginBottom:20 }}>
              <h4 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'#374151' }}>Évolution sur la période</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dataBilan} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="date" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:11 }}/>
                  <Tooltip/>
                  <Legend/>
                  <Bar dataKey="entree" name="Matière entrée (kg)" fill="#3b82f6" radius={[4,4,0,0]}/>
                  <Bar dataKey="fini" name="Produit fini (kg)" fill="#16a34a" radius={[4,4,0,0]}/>
                  <Bar dataKey="dechets" name="Déchets (kg)" fill="#ef4444" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tableau détail */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  {['Date','Machine','OF','Article','Entrée kg','Fini kg','Déchets kg','Transfo %'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bilan.map((r,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb' }}>
                    <td style={{ padding:'8px 12px' }}>{r.date_jour}</td>
                    <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.machine_code}</td>
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:12 }}>{r.numero_of}</td>
                    <td style={{ padding:'8px 12px' }}>{r.article}</td>
                    <td style={{ padding:'8px 12px', color:'#1d4ed8', fontWeight:600 }}>{parseFloat(r.matiere_entree_kg||0).toFixed(1)}</td>
                    <td style={{ padding:'8px 12px', color:'#15803d', fontWeight:600 }}>{parseFloat(r.produit_fini_kg||0).toFixed(1)}</td>
                    <td style={{ padding:'8px 12px', color:'#dc2626' }}>{parseFloat(r.dechets_kg||0).toFixed(1)}</td>
                    <td style={{ padding:'8px 12px' }}>
                      <span style={{ background: r.taux_transformation_pct >= 90 ? '#dcfce7' : '#fef3c7', color: r.taux_transformation_pct >= 90 ? '#15803d' : '#92400e', padding:'2px 8px', borderRadius:20, fontWeight:600, fontSize:12 }}>
                        {r.taux_transformation_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bilan.length === 0 && <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Aucune donnée pour cette période</p>}
          </div>
        </div>
      )}

      {/* ── STOCKS & LOTS ── */}
      {onglet === 'stocks' && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            <button onClick={() => setShowFormMatiere(true)}
              style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 18px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13 }}>
              + Nouvelle matière
            </button>
            <button onClick={() => setShowFormLot(true)}
              style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'10px 18px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13 }}>
              + Réceptionner un lot
            </button>
          </div>

          {showFormMatiere && (
            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #86efac', marginBottom:16 }}>
              <h4 style={{ margin:'0 0 14px', color:'#14532d' }}>Nouvelle matière première</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                {[['Référence','reference','text'],['Désignation','designation','text'],['Stock min (kg)','stock_minimum','number']].map(([label,key,type]) => (
                  <div key={key}>
                    <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                    <input type={type} value={formMatiere[key]} onChange={e => setFormMatiere({...formMatiere,[key]:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:3 }}>Type</label>
                  <select value={formMatiere.type} onChange={e => setFormMatiere({...formMatiere,type:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                    <option value="granules">Granulés</option>
                    <option value="colorant">Colorant</option>
                    <option value="additif">Additif</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={creerMatiere} style={{ background:'#14532d', color:'#fff', border:'none', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Créer</button>
                <button onClick={() => setShowFormMatiere(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
              </div>
            </div>
          )}

          {showFormLot && (
            <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #93c5fd', marginBottom:16 }}>
              <h4 style={{ margin:'0 0 14px', color:'#1d4ed8' }}>Réception lot matière</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:3 }}>Matière *</label>
                  <select value={formLot.matiere_id} onChange={e => setFormLot({...formLot,matiere_id:e.target.value})}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13 }}>
                    <option value="">Sélectionner...</option>
                    {matieres.map(m => <option key={m.id} value={m.id}>{m.reference} — {m.designation}</option>)}
                  </select>
                </div>
                {[['N° Lot *','numero_lot','text'],['Fournisseur','fournisseur','text'],['Quantité (kg) *','quantite_recue_kg','number'],['Date réception','date_reception','date']].map(([label,key,type]) => (
                  <div key={key}>
                    <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                    <input type={type} value={formLot[key]} onChange={e => setFormLot({...formLot,[key]:e.target.value})}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, boxSizing:'border-box' }}/>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={creerLot} style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Réceptionner</button>
                <button onClick={() => setShowFormLot(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
              </div>
            </div>
          )}

          {/* Stocks matières */}
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f0fdf4' }}>
                  {['Référence','Désignation','Type','Stock actuel','Stock min','Lots','Statut'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#15803d', borderBottom:'2px solid #dcfce7' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matieres.map((m,i) => (
                  <tr key={m.id} style={{ borderBottom:'1px solid #f0fdf4', background:i%2===0?'#fff':'#f9fefb' }}>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12 }}>{m.reference}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>{m.designation}</td>
                    <td style={{ padding:'10px 14px' }}>{m.type}</td>
                    <td style={{ padding:'10px 14px', fontWeight:700, color: m.stock_total_kg < m.stock_minimum ? '#dc2626' : '#15803d' }}>
                      {parseFloat(m.stock_total_kg||0).toFixed(1)} kg
                    </td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{m.stock_minimum} kg</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{m.nb_lots}</td>
                    <td style={{ padding:'10px 14px' }}>
                      {m.stock_total_kg < m.stock_minimum ? (
                        <span style={{ background:'#fee2e2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>⚠ Stock bas</span>
                      ) : (
                        <span style={{ background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matieres.length === 0 && <p style={{ textAlign:'center', color:'#9ca3af', padding:40 }}>Aucune matière enregistrée</p>}
          </div>
        </div>
      )}

      {/* ── TRAÇABILITÉ TICKET ── */}
      {onglet === 'tracabilite' && (
        <div>
          <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #e5e7eb', marginBottom:20 }}>
            <h4 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>Rechercher un ticket par numéro ou QR Code</h4>
            <div style={{ display:'flex', gap:10 }}>
              <input type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
                onKeyDown={e => e.key==='Enter' && rechercherTicket()}
                placeholder="Ex: TK20260414-1024"
                style={{ flex:1, border:'2px solid #e5e7eb', borderRadius:10, padding:'12px', fontSize:15, outline:'none' }}/>
              <button onClick={rechercherTicket}
                style={{ background:'#14532d', color:'#fff', border:'none', padding:'12px 24px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:15 }}>
                🔍 Rechercher
              </button>
            </div>
          </div>

          {ticketTrouve && (
            <div style={{ background:'#fff', borderRadius:14, padding:24, border:'2px solid #86efac' }}>
              <h4 style={{ margin:'0 0 20px', fontSize:15, fontWeight:700, color:'#14532d' }}>
                Traçabilité complète — {ticketTrouve.numero_ticket}
              </h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
                {[
                  { label:'OF', value:ticketTrouve.numero_of },
                  { label:'Client', value:ticketTrouve.client },
                  { label:'Article', value:ticketTrouve.article },
                  { label:'Référence', value:ticketTrouve.article_ref },
                  { label:'Dimensions', value:ticketTrouve.dimensions },
                  { label:'Couleur', value:ticketTrouve.couleur },
                  { label:'Machine', value:ticketTrouve.machine_nom },
                  { label:'Opérateur', value:ticketTrouve.operateur },
                  { label:'Poids net', value:`${ticketTrouve.poids_net_kg} kg` },
                  { label:'Température réglage', value:ticketTrouve.regleur_temperature ? `${ticketTrouve.regleur_temperature}°C` : '—' },
                  { label:'Pression réglage', value:ticketTrouve.regleur_pression ? `${ticketTrouve.regleur_pression} bar` : '—' },
                  { label:'Date production', value:new Date(ticketTrouve.session_debut || ticketTrouve.created_at).toLocaleString('fr-FR') },
                  { label:'Lot matière', value:ticketTrouve.lot_matiere || '—' },
                  { label:'Fournisseur', value:ticketTrouve.fournisseur || '—' },
                  { label:'Matière', value:ticketTrouve.matiere || '—' },
                ].map(item => (
                  <div key={item.label} style={{ background:'#f9fafb', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontSize:11, color:'#9ca3af', marginBottom:2 }}>{item.label}</div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#374151' }}>{item.value || '—'}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'#f0fdf4', borderRadius:10, padding:'12px 16px', fontSize:12, color:'#15803d', fontFamily:'monospace' }}>
                QR Code : {ticketTrouve.qr_code_contenu}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
