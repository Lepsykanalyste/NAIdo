import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';

export default function Regleur() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ofs, setOfs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [ofSelectionne, setOfSelectionne] = useState(null);
  const [sessionSelectionnee, setSessionSelectionnee] = useState(null);
  const [onglet, setOnglet] = useState('attente');
  const [params, setParams] = useState({ temperature:'', pression:'', vitesse:'', notes:'' });
  const [submitting, setSubmitting] = useState(false);
  const [valides, setValides] = useState([]);

  const chargerDonnees = useCallback(async () => {
    try {
      const [{ data: ofData }, { data: sessData }] = await Promise.all([
        axios.get(`${API}/of`),
        axios.get(`${API}/sessions/actives`),
      ]);
      setOfs(ofData.filter(o => o.statut === 'planifie'));
      setSessions(sessData.filter(s => !s.regleur_valide));
      setValides(sessData.filter(s => s.regleur_valide));
    } catch { toast.error('Erreur chargement'); }
  }, []);

  useEffect(() => {
    chargerDonnees();
    const iv = setInterval(chargerDonnees, 20000);
    return () => clearInterval(iv);
  }, [chargerDonnees]);

  const validerParametres = async () => {
    if (!params.temperature || !params.pression) return toast.error('Température et pression obligatoires');
    if (!sessionSelectionnee && !ofSelectionne) return toast.error('Sélectionnez un OF');
    setSubmitting(true);
    try {
      if (sessionSelectionnee) {
        await axios.post(`${API}/sessions/${sessionSelectionnee.id}/valider-regleur`, {
          temperature: parseFloat(params.temperature),
          pression: parseFloat(params.pression),
          vitesse: parseFloat(params.vitesse || 0),
          notes: params.notes,
          of_id: sessionSelectionnee.of_id,
        });
      } else {
        const { data: sess } = await axios.post(`${API}/sessions`, {
          of_id: ofSelectionne.id, machine_id: ofSelectionne.machine_id || 1, shift_id: 1,
        });
        await axios.post(`${API}/sessions/${sess.id}/valider-regleur`, {
          temperature: parseFloat(params.temperature), pression: parseFloat(params.pression),
          vitesse: parseFloat(params.vitesse || 0), notes: params.notes, of_id: ofSelectionne.id,
        });
      }
      toast.success("Paramètres validés — l'opérateur peut démarrer");
      setParams({ temperature:'', pression:'', vitesse:'', notes:'' });
      setOfSelectionne(null); setSessionSelectionnee(null); setOnglet('attente');
      chargerDonnees();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur validation'); }
    finally { setSubmitting(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ minHeight:'100vh', background:'#f5f3ff', fontFamily:'system-ui,sans-serif' }}>
      <header style={{ background:'#312e81', color:'#fff', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, background:'#a5b4fc', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#312e81', fontSize:16 }}>R</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>NAIdo — Régleur</div>
            <div style={{ fontSize:11, color:'#a5b4fc' }}>Validation paramètres machine</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:'#a5b4fc' }}>{user?.prenom}</span>
          <button onClick={handleLogout} style={{ background:'#3730a3', border:'none', color:'#a5b4fc', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:12 }}>Quitter</button>
        </div>
      </header>

      <nav style={{ background:'#fff', borderBottom:'2px solid #e0e7ff', display:'flex' }}>
        {[
          { id:'attente', label:'En attente (' + (ofs.length + sessions.length) + ')' },
          { id:'valider', label:'Saisir paramètres' },
          { id:'valides', label:'Validés (' + valides.length + ')' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            padding:'14px 20px', border:'none', background:'none', cursor:'pointer',
            fontWeight: onglet===o.id ? 700 : 400,
            color: onglet===o.id ? '#4338ca' : '#4b5563',
            borderBottom: onglet===o.id ? '3px solid #4338ca' : '3px solid transparent',
            fontSize:14, whiteSpace:'nowrap'
          }}>{o.label}</button>
        ))}
      </nav>

      <main style={{ padding:'20px', maxWidth:700, margin:'0 auto' }}>

        {onglet === 'attente' && (
          <div>
            <p style={{ color:'#6b7280', fontSize:14, marginBottom:16 }}>Ces OF attendent votre validation avant démarrage.</p>
            {sessions.map(s => (
              <div key={s.id} onClick={() => { setSessionSelectionnee(s); setOfSelectionne(null); setOnglet('valider'); }}
                style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'2px solid #fca5a5', marginBottom:10, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700 }}>{s.numero_of}</div>
                    <div style={{ fontSize:13, color:'#6b7280' }}>{s.article} · {s.machine_nom}</div>
                    <div style={{ fontSize:12, color:'#9ca3af' }}>Opérateur : {s.operateur_nom}</div>
                  </div>
                  <div style={{ background:'#fef2f2', color:'#dc2626', padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700 }}>⚠ Urgent →</div>
                </div>
              </div>
            ))}
            {ofs.map(of => (
              <div key={of.id} onClick={() => { setOfSelectionne(of); setSessionSelectionnee(null); setOnglet('valider'); }}
                style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #e0e7ff', marginBottom:10, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700 }}>{of.numero_of}</div>
                    <div style={{ fontSize:13, color:'#6b7280' }}>{of.article_nom} · {of.client_nom}</div>
                    <div style={{ fontSize:12, color:'#9ca3af' }}>Cible : {of.quantite_cible} kg</div>
                  </div>
                  <div style={{ background:'#ede9fe', color:'#4338ca', padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:700 }}>Valider →</div>
                </div>
              </div>
            ))}
            {ofs.length === 0 && sessions.length === 0 && (
              <div style={{ background:'#fff', borderRadius:14, padding:'48px 24px', textAlign:'center', border:'1px solid #e0e7ff' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                <p style={{ color:'#6b7280' }}>Aucun OF en attente de validation</p>
              </div>
            )}
          </div>
        )}

        {onglet === 'valider' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {(ofSelectionne || sessionSelectionnee) && (
              <div style={{ background:'#312e81', color:'#fff', borderRadius:14, padding:'14px 18px' }}>
                <div style={{ fontSize:11, color:'#a5b4fc' }}>Validation pour</div>
                <div style={{ fontWeight:700, fontSize:17 }}>{ofSelectionne?.numero_of || sessionSelectionnee?.numero_of}</div>
                <div style={{ fontSize:13, color:'#c7d2fe' }}>{ofSelectionne?.article_nom || sessionSelectionnee?.article}</div>
              </div>
            )}
            <div style={{ background:'#fff', borderRadius:14, padding:20, border:'1px solid #e0e7ff' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#312e81' }}>Paramètres machine</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                {[
                  { label:'Température *', key:'temperature', unite:'°C' },
                  { label:'Pression *', key:'pression', unite:'bar' },
                  { label:'Vitesse', key:'vitesse', unite:'tr/min' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>
                      {f.label} <span style={{ color:'#9ca3af', fontWeight:400 }}>({f.unite})</span>
                    </label>
                    <input type="number" step="0.1" value={params[f.key]} inputMode="decimal"
                      onChange={e => setParams({...params, [f.key]: e.target.value})}
                      style={{ width:'100%', border:'2px solid #e0e7ff', borderRadius:10, padding:'14px', fontSize:22, fontWeight:700, boxSizing:'border-box', textAlign:'center', color:'#312e81' }}
                      placeholder="—"/>
                  </div>
                ))}
              </div>
              <textarea value={params.notes} onChange={e => setParams({...params, notes: e.target.value})} rows={3}
                placeholder="Notes / consignes particulières..."
                style={{ width:'100%', border:'1px solid #e0e7ff', borderRadius:10, padding:'12px', fontSize:14, boxSizing:'border-box', resize:'vertical' }}/>
            </div>

            {params.temperature && params.pression && (
              <div style={{ background:'#ede9fe', borderRadius:12, padding:'12px 16px', border:'1px solid #c4b5fd', fontSize:13 }}>
                <strong style={{ color:'#4338ca' }}>Récap : </strong>
                T° {params.temperature}°C · P {params.pression} bar
                {params.vitesse && ` · V ${params.vitesse} tr/min`}
                <div style={{ color:'#7c3aed', fontSize:12, marginTop:4 }}>
                  Signé par {user?.prenom} {user?.nom} · {new Date().toLocaleString('fr-FR')}
                </div>
              </div>
            )}

            <button onClick={validerParametres}
              disabled={submitting || !params.temperature || !params.pression || (!ofSelectionne && !sessionSelectionnee)}
              style={{
                background: (!params.temperature || !params.pression || submitting) ? '#d1d5db' : '#4338ca',
                color: (!params.temperature || !params.pression || submitting) ? '#9ca3af' : '#fff',
                border:'none', padding:'18px', borderRadius:14, width:'100%', fontWeight:700, fontSize:17,
                cursor: (!params.temperature || !params.pression || submitting) ? 'not-allowed' : 'pointer'
              }}>
              {submitting ? 'Validation...' : '✓ Valider les paramètres machine'}
            </button>
            <button onClick={() => setOnglet('attente')}
              style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'14px', borderRadius:12, cursor:'pointer', fontWeight:600 }}>← Retour</button>
          </div>
        )}

        {onglet === 'valides' && (
          <div>
            {valides.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, padding:'48px 24px', textAlign:'center', border:'1px solid #e0e7ff' }}>
                <p style={{ color:'#9ca3af' }}>Aucune validation aujourd'hui</p>
              </div>
            ) : valides.map(s => (
              <div key={s.id} style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #c4b5fd', marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontWeight:700 }}>{s.numero_of}</div>
                    <div style={{ fontSize:13, color:'#6b7280' }}>{s.article} · {s.machine_nom}</div>
                  </div>
                  <span style={{ background:'#dcfce7', color:'#15803d', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>✓ Validé</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, fontSize:13 }}>
                  <div style={{ background:'#f5f3ff', padding:'8px 12px', borderRadius:8 }}>
                    <div style={{ color:'#9ca3af', fontSize:11 }}>T°</div>
                    <div style={{ fontWeight:700, color:'#312e81' }}>{s.regleur_temperature}°C</div>
                  </div>
                  <div style={{ background:'#f5f3ff', padding:'8px 12px', borderRadius:8 }}>
                    <div style={{ color:'#9ca3af', fontSize:11 }}>Pression</div>
                    <div style={{ fontWeight:700, color:'#312e81' }}>{s.regleur_pression} bar</div>
                  </div>
                  {s.regleur_vitesse > 0 && (
                    <div style={{ background:'#f5f3ff', padding:'8px 12px', borderRadius:8 }}>
                      <div style={{ color:'#9ca3af', fontSize:11 }}>Vitesse</div>
                      <div style={{ fontWeight:700, color:'#312e81' }}>{s.regleur_vitesse} tr/min</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:11, marginTop:24 }}>
              © 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
