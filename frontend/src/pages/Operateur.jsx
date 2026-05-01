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
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [causeArret, setCauseArret] = useState('');
  const [detailsArret, setDetailsArret] = useState('');
  const [lotsDispo, setLotsDispo] = useState([]);
  const [alertes, setAlertes] = useState([]);

  // Formulaire ticket
  const [form, setForm] = useState({
    poids_brut: '', poids_mandrin: '', poids_dechets: '', motif_dechet: '',
    type_ticket: 'extrusion', destination: '', lot_id: '', nom_matiere: '',
    qte_pieces: '', numero_colis: '', poids_carton: '', rebuts: '', motif_rebut: ''
  });

  const poidsNet = form.poids_brut
    ? Math.max(0, parseFloat(form.poids_brut) - parseFloat(form.poids_mandrin || 0)).toFixed(3)
    : '';

  const typeMachine = t => ({ extrudeuse:'🏭', soudeuse:'⚡', impression:'🖨️', table:'📦' })[t] || '⚙️';

  const typeTicketOptions = [
    { val:'extrusion', label:'Extrusion', icon:'🏭', color:'#0369a1' },
    { val:'soudure', label:'Soudure', icon:'⚡', color:'#d97706' },
    { val:'impression', label:'Impression', icon:'🖨', color:'#0891b2' },
    { val:'emballage', label:'Emballage', icon:'📦', color:'#7c3aed' },
  ];

  const destinations = [
    { val:'AT3-SOU', label:'→ Soudure' },
    { val:'AT3-IMP', label:'→ Impression' },
    { val:'AT3-DEC', label:'→ Découpe/Emballage' },
    { val:'MAG', label:'→ Magasin Central' },
    { val:'AT3-MAG', label:'→ Stock Atelier' },
  ];

  const chargerDonnees = useCallback(async () => {
    try {
      const [m, s, o, al] = await Promise.all([
        axios.get(`${API}/machines`),
        axios.get(`${API}/shifts`),
        axios.get(`${API}/of`),
        axios.get(`${API}/alertes`).catch(()=>({data:[]})),
      ]);
      setMachines(Array.isArray(m.data)?m.data:[]);
      setShifts(Array.isArray(s.data)?s.data:[]);
      setOfs((Array.isArray(o.data)?o.data:[]).filter(o=>['planifie','lance','en_cours','en_attente_regleur'].includes(o.statut)));
      setAlertes(Array.isArray(al.data)?al.data:[]);
    } catch { toast.error('Erreur chargement données'); }
  }, []);

  const chargerTickets = useCallback(async () => {
    if (!session) return;
    try {
      const { data } = await axios.get(`${API}/tickets/session/${session.id}`);
      setTickets(Array.isArray(data)?data:[]);
    } catch {}
  }, [session]);

  const chargerLots = useCallback(async () => {
    if (!ofSelectionne) return;
    try {
      const { data } = await axios.get(`${API}/lots-prod/of/${ofSelectionne.id}`);
      setLotsDispo(Array.isArray(data)?data:[]);
    } catch {}
  }, [ofSelectionne]);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  useEffect(() => {
    if (session) {
      chargerTickets();
      chargerLots();
      const iv = setInterval(() => { chargerTickets(); chargerDonnees(); }, 15000);
      return () => clearInterval(iv);
    }
  }, [session, chargerTickets, chargerLots, chargerDonnees]);

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
        setForm(prev=>({...prev, poids_mandrin: ofSelectionne.poids_mandrin_kg.toString()}));
      setEtape('production');
      toast.success('Production démarrée !');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur démarrage');
    }
  };

  const enregistrerTicket = async () => {
    if (!form.poids_brut && form.type_ticket !== 'emballage')
      return toast.error('Saisissez le poids brut');
    if (form.type_ticket === 'emballage' && !form.qte_pieces)
      return toast.error('Saisissez la quantité de pièces');
    setSubmittingTicket(true);
    try {
      const payload = {
        session_id: session.id,
        of_id: ofSelectionne.id,
        machine_id: machineSelectionnee.id,
        article_id: ofSelectionne.article_id,
        operateur_id: user.id,
        poids_brut_kg: parseFloat(form.poids_brut || 0),
        poids_mandrin_kg: parseFloat(form.poids_mandrin || 0),
        poids_net_kg: parseFloat(poidsNet || 0),
        poids_dechets_kg: parseFloat(form.poids_dechets || 0),
        poids_rebuts_kg: parseFloat(form.rebuts || 0),
        motif_dechet: form.motif_dechet,
        motif_rebut: form.motif_rebut,
        type_ticket: form.type_ticket,
        etape_source: form.type_ticket,
        etape_dest: form.destination || null,
        lot_id: form.lot_id || null,
        nom_matiere: form.nom_matiere || null,
        qte_pieces: parseInt(form.qte_pieces || 0),
        numero_colis: form.numero_colis || null,
        poids_carton_kg: parseFloat(form.poids_carton || 0),
        client_nom: ofSelectionne.client_nom || null,
        numero_sequence: tickets.length + 1,
      };

      const { data } = await axios.post(`${API}/tickets`, payload);
      toast.success('Ticket ' + data.numero_ticket + ' enregistré !');

      // Ouvrir PDF automatiquement
      window.open(`/api/ticket-prod/${data.id}/pdf`, '_blank');

      // Alerte vers département destination
      if (form.destination) {
        await axios.post(`${API}/alertes`, {
          type: 'cession_interne',
          titre: `${form.type_ticket.toUpperCase()} → ${form.destination}`,
          message: `OF ${ofSelectionne.numero_of} — ${ofSelectionne.article_nom} — ${poidsNet} kg prêt depuis ${machineSelectionnee.code}`,
          priorite: 'haute',
          destinataire_atelier: form.destination,
        }).catch(()=>{});
      }

      setForm(prev=>({...prev, poids_brut:'', poids_dechets:'', motif_dechet:'', rebuts:'', motif_rebut:'', lot_id:'', nom_matiere:'', qte_pieces:'', numero_colis:'', poids_carton:''}));
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

  const inp = {width:'100%',borderRadius:10,padding:'14px',fontSize:20,fontWeight:700,boxSizing:'border-box',textAlign:'center',border:'2px solid #e5e7eb'};
  const alertesNonLues = alertes.filter(a=>!a.lu).length;

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:'system-ui,sans-serif'}}>
      <header style={{background:'#1c1917',color:'#fff',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'#f59e0b',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#1c1917',fontSize:16}}>O</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>NAIdo — Opérateur</div>
            <div style={{fontSize:11,color:'#a8a29e'}}>{machineSelectionnee?machineSelectionnee.nom+' · '+(shiftSelectionne?.nom||''):'Atelier 3'}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {alertesNonLues>0 && <span style={{background:'#dc2626',color:'#fff',padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>🔔 {alertesNonLues}</span>}
          {arretActif && <span style={{background:'#dc2626',color:'#fff',padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>⚠ ARRÊT</span>}
          <span style={{fontSize:12,color:'#a8a29e'}}>{user?.prenom}</span>
          <button onClick={()=>{logout();navigate('/login');}} style={{background:'#292524',border:'none',color:'#a8a29e',padding:'5px 10px',borderRadius:6,cursor:'pointer',fontSize:12}}>Quitter</button>
        </div>
      </header>

      <main style={{padding:'16px',maxWidth:700,margin:'0 auto'}}>

        {/* ALERTES RECUES */}
        {alertes.filter(a=>!a.lu&&a.message).slice(0,3).map(al=>(
          <div key={al.id} style={{background:'#fef3c7',border:'2px solid #f59e0b',borderRadius:12,padding:'12px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:700,color:'#92400e',fontSize:13}}>🔔 {al.titre}</div>
              <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{al.message}</div>
            </div>
            <button onClick={()=>axios.put(`${API}/alertes/${al.id}/lire`).then(chargerDonnees)} style={{background:'#f59e0b',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>✓ Lu</button>
          </div>
        ))}

        {/* ETAPE CONFIG */}
        {etape==='config' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'#fff',borderRadius:14,padding:20,border:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>Ma machine</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:8}}>
                {machines.map(m=>(
                  <button key={m.id} onClick={()=>setMachineSelectionnee(m)} style={{padding:'12px 8px',borderRadius:10,border:'2px solid',borderColor:machineSelectionnee?.id===m.id?'#f59e0b':'#e5e7eb',background:machineSelectionnee?.id===m.id?'#fffbeb':'#fff',cursor:'pointer',textAlign:'center'}}>
                    <div style={{fontSize:20}}>{typeMachine(m.type)}</div>
                    <div style={{fontWeight:700,fontSize:13,color:'#1c1917'}}>{m.code}</div>
                    <div style={{fontSize:10,color:'#9ca3af'}}>{m.nom}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{background:'#fff',borderRadius:14,padding:20,border:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>Mon shift</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {shifts.map(s=>(
                  <button key={s.id} onClick={()=>setShiftSelectionne(s)} style={{padding:'16px 8px',borderRadius:10,border:'2px solid',borderColor:shiftSelectionne?.id===s.id?'#f59e0b':'#e5e7eb',background:shiftSelectionne?.id===s.id?'#fffbeb':'#fff',cursor:'pointer',textAlign:'center',fontWeight:600,fontSize:13}}>
                    {s.nom==='Matin'?'🌅':s.nom==='Apres-midi'?'☀️':'🌙'} {s.nom}
                    <div style={{fontSize:11,color:'#9ca3af',fontWeight:400,marginTop:2}}>{s.heure_debut}-{s.heure_fin}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>setEtape('of')} disabled={!machineSelectionnee||!shiftSelectionne}
              style={{background:(!machineSelectionnee||!shiftSelectionne)?'#d1d5db':'#f59e0b',color:(!machineSelectionnee||!shiftSelectionne)?'#9ca3af':'#1c1917',border:'none',padding:'18px',borderRadius:12,cursor:(!machineSelectionnee||!shiftSelectionne)?'not-allowed':'pointer',fontWeight:700,fontSize:17,width:'100%'}}>
              Suivant →
            </button>
          </div>
        )}

        {/* ETAPE OF */}
        {etape==='of' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'#fff',borderRadius:14,padding:20,border:'1px solid #e5e7eb'}}>
              <h3 style={{margin:'0 0 14px',fontSize:15,fontWeight:700}}>Choisir l'Ordre de Fabrication</h3>
              {ofs.length===0 ? (
                <div style={{textAlign:'center',padding:'32px 0',color:'#9ca3af'}}>
                  <div style={{fontSize:36}}>⏳</div>
                  <p>Aucun OF disponible</p>
                </div>
              ) : ofs.map(of=>(
                <div key={of.id} onClick={()=>setOfSelectionne(of)} style={{padding:'14px 16px',borderRadius:10,border:'2px solid',cursor:'pointer',marginBottom:10,borderColor:ofSelectionne?.id===of.id?'#f59e0b':'#e5e7eb',background:ofSelectionne?.id===of.id?'#fffbeb':'#fff'}}>
                  <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:6}}>
                    <span style={{fontWeight:700,fontSize:16}}>{of.numero_of}</span>
                    <span style={{background:'#fef3c7',color:'#92400e',padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:600}}>{of.client_nom}</span>
                  </div>
                  <div style={{fontSize:13,color:'#374151',fontWeight:600,marginTop:4}}>{of.article_nom}</div>
                  <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>Cible : {of.quantite_cible} kg</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setEtape('config')} style={{flex:1,background:'#f3f4f6',color:'#374151',border:'none',padding:'16px',borderRadius:12,cursor:'pointer',fontWeight:600}}>← Retour</button>
              <button onClick={demarrerSession} disabled={!ofSelectionne} style={{flex:2,background:ofSelectionne?'#16a34a':'#d1d5db',color:'#fff',border:'none',padding:'16px',borderRadius:12,cursor:ofSelectionne?'pointer':'not-allowed',fontWeight:700,fontSize:16}}>▶ Démarrer</button>
            </div>
          </div>
        )}

        {/* ETAPE PRODUCTION */}
        {etape==='production' && session && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* Bandeau OF */}
            <div style={{background:'#1c1917',color:'#fff',borderRadius:14,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:11,color:'#a8a29e'}}>OF en cours</div>
                <div style={{fontWeight:700,fontSize:17}}>{ofSelectionne.numero_of}</div>
                <div style={{fontSize:12,color:'#d6d3d1'}}>{ofSelectionne.article_nom}</div>
                <div style={{fontSize:11,color:'#a8a29e'}}>{ofSelectionne.client_nom}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:11,color:'#a8a29e'}}>Tickets</div>
                <div style={{fontWeight:800,fontSize:30,color:'#f59e0b'}}>{tickets.length}</div>
              </div>
            </div>

            {arretActif && (
              <div style={{background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:14,padding:'16px 18px'}}>
                <div style={{fontWeight:700,color:'#dc2626',marginBottom:8}}>⚠ Machine à l'arrêt — {arretActif.cause?.replace(/_/g,' ')}</div>
                <button onClick={relancerMachine} style={{background:'#16a34a',color:'#fff',border:'none',padding:'14px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:16,width:'100%'}}>▶ Relancer la machine</button>
              </div>
            )}

            {!arretActif && (
              <div style={{background:'#fff',borderRadius:14,padding:18,border:'1px solid #e5e7eb'}}>
                <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:700}}>Enregistrer une sortie</h3>

                {/* Type d'opération */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:6}}>Type d'opération</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                    {typeTicketOptions.map(t=>(
                      <button key={t.val} onClick={()=>setForm(prev=>({...prev,type_ticket:t.val}))}
                        style={{padding:'8px 4px',borderRadius:8,border:'2px solid',borderColor:form.type_ticket===t.val?t.color:'#e5e7eb',background:form.type_ticket===t.val?t.color+'15':'#fff',cursor:'pointer',textAlign:'center'}}>
                        <div style={{fontSize:18}}>{t.icon}</div>
                        <div style={{fontSize:10,fontWeight:700,color:form.type_ticket===t.val?t.color:'#374151'}}>{t.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pesée */}
                {form.type_ticket !== 'emballage' ? (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Poids brut (kg) *</label>
                        <input type="number" step="0.001" value={form.poids_brut}
                          onChange={e=>setForm(prev=>({...prev,poids_brut:e.target.value}))}
                          inputMode="decimal" style={{...inp,border:'2px solid #f59e0b'}} placeholder="0.000"/>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Tare / Mandrin (kg)</label>
                        <input type="number" step="0.001" value={form.poids_mandrin}
                          onChange={e=>setForm(prev=>({...prev,poids_mandrin:e.target.value}))}
                          inputMode="decimal" style={{...inp,color:'#6b7280'}} placeholder="0.000"/>
                      </div>
                    </div>
                    <div style={{background:'#f0fdf4',border:'2px solid #86efac',borderRadius:10,padding:'10px 14px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:13,fontWeight:600,color:'#15803d'}}>POIDS NET</span>
                      <span style={{fontSize:26,fontWeight:800,color:'#15803d'}}>{poidsNet||'—'} kg</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Déchets (kg)</label>
                        <input type="number" step="0.001" value={form.poids_dechets}
                          onChange={e=>setForm(prev=>({...prev,poids_dechets:e.target.value}))}
                          inputMode="decimal" style={{...inp,fontSize:16,border:'1px solid #fca5a5'}} placeholder="0.000"/>
                      </div>
                      <div>
                        <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Rebuts (kg)</label>
                        <input type="number" step="0.001" value={form.rebuts}
                          onChange={e=>setForm(prev=>({...prev,rebuts:e.target.value}))}
                          inputMode="decimal" style={{...inp,fontSize:16,border:'1px solid #fca5a5'}} placeholder="0.000"/>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>N° Colis</label>
                      <input value={form.numero_colis} onChange={e=>setForm(prev=>({...prev,numero_colis:e.target.value}))}
                        style={{...inp,fontSize:16}} placeholder="ex: COL-001"/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Qté pièces *</label>
                      <input type="number" value={form.qte_pieces} onChange={e=>setForm(prev=>({...prev,qte_pieces:e.target.value}))}
                        inputMode="numeric" style={{...inp,border:'2px solid #7c3aed'}} placeholder="0"/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Poids carton (kg)</label>
                      <input type="number" step="0.001" value={form.poids_carton} onChange={e=>setForm(prev=>({...prev,poids_carton:e.target.value}))}
                        inputMode="decimal" style={{...inp,fontSize:16}} placeholder="0.000"/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Poids net contenu (kg)</label>
                      <input type="number" step="0.001" value={form.poids_brut} onChange={e=>setForm(prev=>({...prev,poids_brut:e.target.value}))}
                        inputMode="decimal" style={{...inp,fontSize:16,border:'2px solid #86efac'}} placeholder="0.000"/>
                    </div>
                  </div>
                )}

                {/* Lot MP utilisé */}
                {lotsDispo.length > 0 && (
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:3}}>Lot MP utilisé (optionnel)</label>
                    <select value={form.lot_id} onChange={e=>{
                      const l=lotsDispo.find(x=>x.id===e.target.value);
                      setForm(prev=>({...prev,lot_id:e.target.value,nom_matiere:l?.nom_matiere||l?.mp_nom||''}));
                    }} style={{width:'100%',padding:'10px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13}}>
                      <option value="">-- Sélectionner lot --</option>
                      {lotsDispo.map(l=><option key={l.id} value={l.id}>{l.nom_matiere||l.mp_nom||l.mp_code} — lot {l.numero_lot}</option>)}
                    </select>
                  </div>
                )}

                {/* Destination */}
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:'#374151',display:'block',marginBottom:6}}>Envoyer vers (département suivant)</label>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                    {destinations.map(d=>(
                      <button key={d.val} onClick={()=>setForm(prev=>({...prev,destination:prev.destination===d.val?'':d.val}))}
                        style={{padding:'8px',borderRadius:8,border:'2px solid',borderColor:form.destination===d.val?'#15803d':'#e5e7eb',background:form.destination===d.val?'#dcfce7':'#fff',cursor:'pointer',fontSize:11,fontWeight:600,color:form.destination===d.val?'#15803d':'#374151'}}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {form.destination && <div style={{fontSize:11,color:'#15803d',marginTop:4}}>✓ Alerte envoyée à {form.destination}</div>}
                </div>

                <button onClick={enregistrerTicket} disabled={submittingTicket||(!form.poids_brut&&form.type_ticket!=='emballage')||(!form.qte_pieces&&form.type_ticket==='emballage')}
                  style={{background:submittingTicket?'#d1d5db':'#1c1917',color:submittingTicket?'#9ca3af':'#f59e0b',border:'none',padding:'16px',borderRadius:12,width:'100%',cursor:submittingTicket?'not-allowed':'pointer',fontWeight:700,fontSize:16}}>
                  {submittingTicket?'Enregistrement...':'🖨 Valider & Imprimer ticket PDF'}
                </button>
              </div>
            )}

            {!arretActif && (
              <button onClick={()=>setEtape('arret')} style={{background:'#fff',color:'#dc2626',border:'2px solid #fca5a5',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:700,fontSize:14,width:'100%'}}>
                ⏹ Déclarer un arrêt machine
              </button>
            )}

            {tickets.length>0 && (
              <div style={{background:'#fff',borderRadius:14,padding:16,border:'1px solid #e5e7eb'}}>
                <h4 style={{margin:'0 0 10px',fontSize:13,fontWeight:700}}>Tickets de la session ({tickets.length})</h4>
                {tickets.slice(0,5).map(t=>(
                  <div key={t.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'#f9fafb',borderRadius:8,marginBottom:6,fontSize:13,alignItems:'center'}}>
                    <div>
                      <span style={{fontWeight:600,fontFamily:'monospace'}}>{t.numero_ticket}</span>
                      <span style={{color:'#9ca3af',marginLeft:6}}>{new Date(t.created_at).toLocaleTimeString('fr-FR')}</span>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontWeight:700,color:'#15803d'}}>{t.poids_net_kg} kg</span>
                      <button onClick={()=>window.open(`/api/ticket-prod/${t.id}/pdf`,'_blank')}
                        style={{background:'#e0f2fe',color:'#0369a1',border:'none',borderRadius:6,padding:'2px 7px',cursor:'pointer',fontSize:11}}>🖨</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ETAPE ARRET */}
        {etape==='arret' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'#fff',borderRadius:14,padding:20,border:'2px solid #fca5a5'}}>
              <h3 style={{margin:'0 0 6px',fontSize:16,fontWeight:700,color:'#dc2626'}}>⏹ Déclarer un arrêt machine</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                {[
                  {val:'panne_mecanique',label:'Panne mécanique',icon:'🔧'},
                  {val:'panne_electrique',label:'Panne électrique',icon:'⚡'},
                  {val:'changement_matiere',label:'Changement matière',icon:'📦'},
                  {val:'reglage',label:'Réglage',icon:'⚙️'},
                  {val:'coupure_electricite',label:'Coupure électricité',icon:'🔌'},
                  {val:'manque_personnel',label:'Manque personnel',icon:'👷'},
                ].map(c=>(
                  <button key={c.val} onClick={()=>setCauseArret(c.val)} style={{padding:'14px 10px',borderRadius:10,border:'2px solid',cursor:'pointer',borderColor:causeArret===c.val?'#dc2626':'#e5e7eb',background:causeArret===c.val?'#fee2e2':'#fff',textAlign:'center'}}>
                    <div style={{fontSize:22,marginBottom:4}}>{c.icon}</div>
                    <div style={{fontSize:12,fontWeight:600,color:causeArret===c.val?'#dc2626':'#374151'}}>{c.label}</div>
                  </button>
                ))}
              </div>
              <textarea value={detailsArret} onChange={e=>setDetailsArret(e.target.value)} rows={2} placeholder="Précisions (optionnel)..."
                style={{width:'100%',border:'1px solid #d1d5db',borderRadius:8,padding:'10px',fontSize:14,boxSizing:'border-box',resize:'none',marginBottom:14}}/>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setEtape('production')} style={{flex:1,background:'#f3f4f6',color:'#374151',border:'none',padding:'14px',borderRadius:12,cursor:'pointer',fontWeight:600}}>← Annuler</button>
                <button onClick={declarerArret} disabled={!causeArret} style={{flex:2,background:causeArret?'#dc2626':'#d1d5db',color:'#fff',border:'none',padding:'14px',borderRadius:12,cursor:causeArret?'pointer':'not-allowed',fontWeight:700,fontSize:15}}>Confirmer</button>
              </div>
            </div>
          </div>
        )}

        <p style={{textAlign:'center',color:'#9ca3af',fontSize:11,marginTop:16}}>© 2026 NAIdo — SOPHOPSY pour NAI</p>
      </main>
    </div>
  );
}
