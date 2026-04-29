import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';

export default function Operateur() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [etape, setEtape] = useState('config');
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [ofs, setOfs] = useState([]);
  const [machineSelectionnee, setMachineSelectionnee] = useState(null);
  const [shiftSelectionne, setShiftSelectionne] = useState(null);
  const [ofSelectionne, setOfSelectionne] = useState(null);
  const [session, setSession] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [arretActif, setArretActif] = useState(null);
  const [poidsBrut, setPoidsBrut] = useState('');
  const [poidsMandrin, setPoidsMandrin] = useState('');
  const [poidsDechet, setPoidsDechet] = useState('');
  const [motifDechet, setMotifDechet] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [causeArret, setCauseArret] = useState('');
  const [detailsArret, setDetailsArret] = useState('');

  const chargerDonnees = useCallback(async () => {
    try {
      const [m, s, o] = await Promise.all([
        axios.get(`${API}/machines`),
        axios.get(`${API}/shifts`),
        axios.get(`${API}/of`),
      ]);
      setMachines(m.data);
      setShifts(s.data);
      setOfs(o.data.filter(o => ['en_attente_regleur','en_cours','planifie'].includes(o.statut)));
    } catch { toast.error('Erreur chargement données'); }
  }, []);

  const chargerTickets = useCallback(async () => {
    if (!session) return;
    try {
      const { data } = await axios.get(`${API}/tickets/session/${session.id}`);
      setTickets(data);
    } catch {}
  }, [session]);

  const chargerArrets = useCallback(async () => {
    if (!session) return;
    try {
      const { data } = await axios.get(`${API}/arrets/session/${session.id}`);
      const actif = data.find(a => a.statut === 'en_cours');
      setArretActif(actif || null);
    } catch {}
  }, [session]);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);
  useEffect(() => {
    if (session) {
      chargerTickets(); chargerArrets();
      const iv = setInterval(() => { chargerTickets(); chargerArrets(); }, 15000);
      return () => clearInterval(iv);
    }
  }, [session, chargerTickets, chargerArrets]);

  const poidsNet = poidsBrut
    ? (parseFloat(poidsBrut) - parseFloat(poidsMandrin || 0)).toFixed(3)
    : '';

  const demarrerSession = async () => {
    if (!ofSelectionne || !machineSelectionnee || !shiftSelectionne)
      return toast.error('Sélectionnez OF, machine et shift');
    try {
      const { data } = await axios.post(`${API}/sessions`, {
        of_id: ofSelectionne.id,
        machine_id: machineSelectionnee.id,
        shift_id: shiftSelectionne.id,
      });
      setSession(data);
      if (ofSelectionne.poids_mandrin_kg)
        setPoidsMandrin(ofSelectionne.poids_mandrin_kg.toString());
      setEtape('production');
      toast.success('Production démarrée !');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur démarrage');
    }
  };

  const enregistrerTicket = async () => {
    if (!poidsBrut) return toast.error('Saisissez le poids brut');
    setSubmittingTicket(true);
    try {
      const { data } = await axios.post(`${API}/tickets`, {
        session_id: session.id,
        of_id: ofSelectionne.id,
        machine_id: machineSelectionnee.id,
        poids_brut_kg: parseFloat(poidsBrut),
        poids_mandrin_kg: parseFloat(poidsMandrin || 0),
        poids_dechets_kg: parseFloat(poidsDechet || 0),
        motif_dechet: motifDechet,
      });
      toast.success('Ticket ' + data.numero_ticket + ' enregistré');
      setPoidsBrut(''); setPoidsDechet(''); setMotifDechet('');
      await axios.put(`${API}/tickets/${data.id}/imprime`);
      chargerTickets();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur ticket');
    } finally { setSubmittingTicket(false); }
  };

  const declarerArret = async () => {
    if (!causeArret) return toast.error('Choisissez une cause');
    try {
      const { data } = await axios.post(`${API}/arrets`, {
        session_id: session.id,
        machine_id: machineSelectionnee.id,
        cause: causeArret,
        details: detailsArret,
      });
      setArretActif(data);
      setCauseArret(''); setDetailsArret('');
      setEtape('production');
      toast.success('Arrêt déclaré');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur arrêt');
    }
  };

  const relancerMachine = async () => {
    try {
      await axios.put(`${API}/arrets/${arretActif.id}/relancer`);
      setArretActif(null);
      toast.success('Machine relancée');
    } catch { toast.error('Erreur relance'); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const typeMachine = (t) => ({ extrudeuse:'🏭', soudeuse:'⚡', impression:'🖨️' })[t] || '⚙️';

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:'system-ui,sans-serif' }}>
      <header style={{ background:'#1c1917', color:'#fff', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, background:'#f59e0b', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#1c1917', fontSize:16 }}>O</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>NAIdo — Opérateur</div>
            <div style={{ fontSize:11, color:'#a8a29e' }}>{machineSelectionnee ? machineSelectionnee.nom + ' · ' + (shiftSelectionne?.nom||'') : 'Atelier 3'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {arretActif && <span style={{ background:'#dc2626', color:'#fff', padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>⚠ ARRÊT</span>}
          <span style={{ fontSize:12, color:'#a8a29e' }}>{user?.prenom}</span>
          <button onClick={handleLogout} style={{ background:'#292524', border:'none', color:'#a8a29e', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:12 }}>Quitter</button>
        </div>
      </header>

      <main style={{ padding:'16px', maxWidth:700, margin:'0 auto' }}>

        {etape === 'config' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700 }}>Ma machine</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                {machines.map(m => (
                  <button key={m.id} onClick={() => setMachineSelectionnee(m)} style={{
                    padding:'12px 8px', borderRadius:10, border:'2px solid',
                    borderColor: machineSelectionnee?.id===m.id ? '#f59e0b' : '#e5e7eb',
                    background: machineSelectionnee?.id===m.id ? '#fffbeb' : '#fff',
                    cursor:'pointer', textAlign:'center'
                  }}>
                    <div style={{ fontSize:20 }}>{typeMachine(m.type)}</div>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1c1917' }}>{m.code}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:700 }}>Mon shift</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {shifts.map(s => (
                  <button key={s.id} onClick={() => setShiftSelectionne(s)} style={{
                    padding:'16px 8px', borderRadius:10, border:'2px solid',
                    borderColor: shiftSelectionne?.id===s.id ? '#f59e0b' : '#e5e7eb',
                    background: shiftSelectionne?.id===s.id ? '#fffbeb' : '#fff',
                    cursor:'pointer', textAlign:'center', fontWeight:600, fontSize:13
                  }}>
                    {s.nom==='Matin'?'🌅':s.nom==='Apres-midi'?'☀️':'🌙'} {s.nom}
                    <div style={{ fontSize:11, color:'#9ca3af', fontWeight:400, marginTop:2 }}>{s.heure_debut}-{s.heure_fin}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setEtape('of')} disabled={!machineSelectionnee || !shiftSelectionne}
              style={{ background:(!machineSelectionnee||!shiftSelectionne)?'#d1d5db':'#f59e0b', color:(!machineSelectionnee||!shiftSelectionne)?'#9ca3af':'#1c1917', border:'none', padding:'18px', borderRadius:12, cursor:(!machineSelectionnee||!shiftSelectionne)?'not-allowed':'pointer', fontWeight:700, fontSize:17, width:'100%' }}>
              Suivant →
            </button>
          </div>
        )}

        {etape === 'of' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e5e7eb' }}>
              <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:700 }}>Choisir l'Ordre de Fabrication</h3>
              <p style={{ margin:'0 0 16px', fontSize:13, color:'#6b7280' }}>Seuls les OF validés par le régleur sont disponibles</p>
              {ofs.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af' }}>
                  <div style={{ fontSize:36 }}>⏳</div>
                  <p>Aucun OF disponible — le régleur doit d'abord valider les paramètres</p>
                </div>
              ) : ofs.map(of => (
                <div key={of.id} onClick={() => setOfSelectionne(of)} style={{
                  padding:'14px 16px', borderRadius:10, border:'2px solid', cursor:'pointer', marginBottom:10,
                  borderColor: ofSelectionne?.id===of.id ? '#f59e0b' : '#e5e7eb',
                  background: ofSelectionne?.id===of.id ? '#fffbeb' : '#fff'
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
                    <span style={{ fontWeight:700, fontSize:16 }}>{of.numero_of}</span>
                    <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, fontSize:12, fontWeight:600 }}>{of.client_nom}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{of.article_nom} · {of.dimensions}</div>
                  <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>Cible : {of.quantite_cible} kg · Cadence : {of.cadence_heure} kg/h</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setEtape('config')} style={{ flex:1, background:'#f3f4f6', color:'#374151', border:'none', padding:'16px', borderRadius:12, cursor:'pointer', fontWeight:600 }}>← Retour</button>
              <button onClick={demarrerSession} disabled={!ofSelectionne} style={{
                flex:2, background:ofSelectionne?'#16a34a':'#d1d5db', color:'#fff', border:'none',
                padding:'16px', borderRadius:12, cursor:ofSelectionne?'pointer':'not-allowed', fontWeight:700, fontSize:16
              }}>▶ Démarrer la production</button>
            </div>
          </div>
        )}

        {etape === 'production' && session && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'#1c1917', color:'#fff', borderRadius:14, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:11, color:'#a8a29e' }}>OF en cours</div>
                <div style={{ fontWeight:700, fontSize:17 }}>{ofSelectionne.numero_of}</div>
                <div style={{ fontSize:12, color:'#d6d3d1' }}>{ofSelectionne.article_nom}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:11, color:'#a8a29e' }}>Tickets</div>
                <div style={{ fontWeight:800, fontSize:30, color:'#f59e0b' }}>{tickets.length}</div>
              </div>
            </div>

            {arretActif && (
              <div style={{ background:'#fef2f2', border:'2px solid #fca5a5', borderRadius:14, padding:'16px 18px' }}>
                <div style={{ fontWeight:700, color:'#dc2626', marginBottom:8 }}>⚠ Machine à l'arrêt — {arretActif.cause.replace(/_/g,' ')}</div>
                <div style={{ fontSize:13, color:'#6b7280', marginBottom:12 }}>Depuis {new Date(arretActif.heure_debut).toLocaleTimeString('fr-FR')}</div>
                <button onClick={relancerMachine} style={{ background:'#16a34a', color:'#fff', border:'none', padding:'14px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:16, width:'100%' }}>▶ Relancer la machine</button>
              </div>
            )}

            {!arretActif && (
              <div style={{ background:'#fff', borderRadius:14, padding:18, border:'1px solid #e5e7eb' }}>
                <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700 }}>Enregistrer une sortie</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Poids brut (kg) *</label>
                    <input type="number" step="0.001" value={poidsBrut} onChange={e => setPoidsBrut(e.target.value)} inputMode="decimal"
                      style={{ width:'100%', border:'2px solid #f59e0b', borderRadius:10, padding:'14px', fontSize:22, fontWeight:700, boxSizing:'border-box', textAlign:'center' }} placeholder="0.000"/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Poids mandrin (kg)</label>
                    <input type="number" step="0.001" value={poidsMandrin} onChange={e => setPoidsMandrin(e.target.value)} inputMode="decimal"
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:10, padding:'14px', fontSize:22, fontWeight:700, boxSizing:'border-box', textAlign:'center', color:'#6b7280' }} placeholder="0.000"/>
                  </div>
                </div>
                <div style={{ background:'#f0fdf4', border:'2px solid #86efac', borderRadius:10, padding:'10px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#15803d' }}>POIDS NET</span>
                  <span style={{ fontSize:26, fontWeight:800, color:'#15803d' }}>{poidsNet || '—'} kg</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Déchets (kg)</label>
                    <input type="number" step="0.001" value={poidsDechet} onChange={e => setPoidsDechet(e.target.value)} inputMode="decimal"
                      style={{ width:'100%', border:'1px solid #fca5a5', borderRadius:10, padding:'12px', fontSize:18, boxSizing:'border-box', textAlign:'center' }} placeholder="0.000"/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#374151', display:'block', marginBottom:3 }}>Motif déchet</label>
                    <select value={motifDechet} onChange={e => setMotifDechet(e.target.value)}
                      style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:10, padding:'12px', fontSize:13, boxSizing:'border-box' }}>
                      <option value="">Aucun</option>
                      <option>Démarrage</option>
                      <option>Changement couleur</option>
                      <option>Défaut matière</option>
                      <option>Réglage</option>
                      <option>Autre</option>
                    </select>
                  </div>
                </div>
                <button onClick={enregistrerTicket} disabled={submittingTicket || !poidsBrut}
                  style={{ background:(!poidsBrut||submittingTicket)?'#d1d5db':'#1c1917', color:(!poidsBrut||submittingTicket)?'#9ca3af':'#f59e0b', border:'none', padding:'16px', borderRadius:12, width:'100%', cursor:(!poidsBrut||submittingTicket)?'not-allowed':'pointer', fontWeight:700, fontSize:16 }}>
                  {submittingTicket ? 'Enregistrement...' : '🖨 Enregistrer & Imprimer ticket'}
                </button>
              </div>
            )}

            {!arretActif && (
              <button onClick={() => setEtape('arret')} style={{ background:'#fff', color:'#dc2626', border:'2px solid #fca5a5', padding:'14px', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:14, width:'100%' }}>
                ⏹ Déclarer un arrêt machine
              </button>
            )}

            {tickets.length > 0 && (
              <div style={{ background:'#fff', borderRadius:14, padding:16, border:'1px solid #e5e7eb' }}>
                <h4 style={{ margin:'0 0 10px', fontSize:13, fontWeight:700 }}>Tickets de la session ({tickets.length})</h4>
                {tickets.slice(0,5).map(t => (
                  <div key={t.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'#f9fafb', borderRadius:8, marginBottom:6, fontSize:13 }}>
                    <div><span style={{ fontWeight:600, fontFamily:'monospace' }}>{t.numero_ticket}</span> <span style={{ color:'#9ca3af' }}>{new Date(t.created_at).toLocaleTimeString('fr-FR')}</span></div>
                    <span style={{ fontWeight:700, color:'#15803d' }}>{t.poids_net_kg} kg</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:11 }}>© 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry</p>
          </div>
        )}

        {etape === 'arret' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'#fff', borderRadius:14, padding:20, border:'2px solid #fca5a5' }}>
              <h3 style={{ margin:'0 0 6px', fontSize:16, fontWeight:700, color:'#dc2626' }}>⏹ Déclarer un arrêt machine</h3>
              <p style={{ margin:'0 0 18px', fontSize:13, color:'#6b7280' }}>Quelle est la cause de l'arrêt ?</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[
                  { val:'panne_mecanique', label:'Panne mécanique', icon:'🔧' },
                  { val:'panne_electrique', label:'Panne électrique', icon:'⚡' },
                  { val:'changement_matiere', label:'Changement matière', icon:'📦' },
                  { val:'reglage', label:'Réglage', icon:'⚙️' },
                  { val:'coupure_electricite', label:'Coupure électricité', icon:'🔌' },
                  { val:'manque_personnel', label:'Manque personnel', icon:'👷' },
                ].map(c => (
                  <button key={c.val} onClick={() => setCauseArret(c.val)} style={{
                    padding:'14px 10px', borderRadius:10, border:'2px solid', cursor:'pointer',
                    borderColor: causeArret===c.val ? '#dc2626' : '#e5e7eb',
                    background: causeArret===c.val ? '#fee2e2' : '#fff', textAlign:'center'
                  }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{c.icon}</div>
                    <div style={{ fontSize:12, fontWeight:600, color:causeArret===c.val?'#dc2626':'#374151' }}>{c.label}</div>
                  </button>
                ))}
              </div>
              <textarea value={detailsArret} onChange={e => setDetailsArret(e.target.value)} rows={2} placeholder="Précisions (optionnel)..."
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:14, boxSizing:'border-box', resize:'none', marginBottom:14 }}/>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setEtape('production')} style={{ flex:1, background:'#f3f4f6', color:'#374151', border:'none', padding:'14px', borderRadius:12, cursor:'pointer', fontWeight:600 }}>← Annuler</button>
                <button onClick={declarerArret} disabled={!causeArret} style={{
                  flex:2, background:causeArret?'#dc2626':'#d1d5db', color:'#fff', border:'none',
                  padding:'14px', borderRadius:12, cursor:causeArret?'pointer':'not-allowed', fontWeight:700, fontSize:15
                }}>Confirmer l'arrêt</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
