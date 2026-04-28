import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API = '/api';

export default function Qualite() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState('controles');
  const [ofs, setOfs] = useState([]);
  const [ofSelectionne, setOfSelectionne] = useState(null);
  const [controles, setControles] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [qteApprouvee, setQteApprouvee] = useState('');
  const [qteRejetee, setQteRejetee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signeMode, setSigneMode] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);

  const chargerOFs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/of?statut=en_cours`);
      setOfs(data);
    } catch { toast.error('Erreur chargement OF'); }
  }, []);

  const chargerControles = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/qualite/of/${ofSelectionne?.id}`);
      setControles(data);
    } catch {}
  }, [ofSelectionne]);

  useEffect(() => { chargerOFs(); }, [chargerOFs]);
  useEffect(() => { if (ofSelectionne) chargerControles(); }, [ofSelectionne, chargerControles]);

  // ── Signature canvas ──
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; };

  const effacerSignature = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const validerSignature = () => {
    const data = canvasRef.current.toDataURL('image/png');
    setSignatureData(data);
    setSigneMode(false);
    toast.success('Signature enregistrée');
  };

  // ── Photos ──
  const ajouterPhotos = (e) => {
    const files = Array.from(e.target.files);
    const nouvelles = files.map(f => ({ file: f, preview: URL.createObjectURL(f), nom: f.name }));
    setPhotos(prev => [...prev, ...nouvelles]);
    e.target.value = '';
  };

  const supprimerPhoto = (i) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── Soumettre contrôle ──
  const soumettre = async () => {
    if (!ofSelectionne) return toast.error('Sélectionnez un OF');
    if (!decision) return toast.error('Choisissez une décision');
    if (!signatureData) return toast.error('Signature obligatoire');

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('of_id', ofSelectionne.id);
      fd.append('decision', decision);
      fd.append('notes', notes);
      fd.append('signature_base64', signatureData);
      fd.append('quantite_approuvee', qteApprouvee || 0);
      fd.append('quantite_rejetee', qteRejetee || 0);
      photos.forEach(p => fd.append('photos', p.file));

      const { data } = await axios.post(`${API}/qualite`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(`Contrôle enregistré — PDF généré`);
      // Reset
      setDecision(''); setNotes(''); setQteApprouvee(''); setQteRejetee('');
      setPhotos([]); setSignatureData(null);
      chargerControles();
      setOnglet('historique');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur soumission');
    } finally { setSubmitting(false); }
  };

  const telechargerPDF = async (controleId) => {
    try {
      const { data } = await axios.get(`${API}/qualite/${controleId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `qualite-${controleId}.pdf`; a.click();
    } catch { toast.error('PDF non disponible'); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ minHeight:'100vh', background:'#f8faff', fontFamily:'system-ui,sans-serif' }}>

      {/* Header */}
      <header style={{ background:'#1e3a5f', color:'#fff', padding:'0 24px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, background:'#60a5fa', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#1e3a5f', fontSize:18 }}>Q</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16 }}>NAIdo — Contrôle Qualité</div>
            <div style={{ fontSize:11, color:'#93c5fd' }}>Green Industry · Atelier 3</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:13, color:'#bfdbfe' }}>{user?.prenom} {user?.nom}</span>
          <button onClick={handleLogout} style={{ background:'#1e40af', border:'none', color:'#93c5fd', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:13 }}>Déconnexion</button>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background:'#fff', borderBottom:'2px solid #dbeafe', display:'flex' }}>
        {[
          { id:'controles', label:'Nouveau contrôle' },
          { id:'historique', label:'Historique' },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            padding:'14px 28px', border:'none', background:'none', cursor:'pointer',
            fontWeight: onglet===o.id ? 700 : 400,
            color: onglet===o.id ? '#1d4ed8' : '#4b5563',
            borderBottom: onglet===o.id ? '3px solid #1d4ed8' : '3px solid transparent',
            fontSize:14
          }}>{o.label}</button>
        ))}
      </nav>

      <main style={{ padding:'24px', maxWidth:900, margin:'0 auto' }}>

        {/* ── NOUVEAU CONTRÔLE ── */}
        {onglet === 'controles' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Sélection OF */}
            <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dbeafe' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1e3a5f' }}>1 — Sélectionner l'Ordre de Fabrication</h3>
              {ofs.length === 0 ? (
                <p style={{ color:'#9ca3af', fontSize:14 }}>Aucun OF en cours de production</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {ofs.map(of => (
                    <div key={of.id} onClick={() => setOfSelectionne(of)} style={{
                      padding:'14px 18px', borderRadius:10, cursor:'pointer', border:'2px solid',
                      borderColor: ofSelectionne?.id===of.id ? '#1d4ed8' : '#e5e7eb',
                      background: ofSelectionne?.id===of.id ? '#eff6ff' : '#fff',
                      transition:'all .15s'
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <span style={{ fontWeight:700, color:'#1e3a5f', fontSize:15 }}>{of.numero_of}</span>
                          <span style={{ marginLeft:12, color:'#6b7280', fontSize:13 }}>{of.client_nom}</span>
                        </div>
                        <span style={{ background:'#dbeafe', color:'#1d4ed8', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>
                          {of.quantite_produite?.toFixed(0)} / {of.quantite_cible} kg
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>
                        {of.article_nom} · {of.dimensions} · {of.couleur}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ofSelectionne && (<>

            {/* Décision */}
            <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dbeafe' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1e3a5f' }}>2 — Décision qualité</h3>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <button onClick={() => setDecision('approuve')} style={{
                  padding:'20px', borderRadius:12, border:'2px solid', cursor:'pointer', fontSize:16, fontWeight:700,
                  borderColor: decision==='approuve' ? '#16a34a' : '#e5e7eb',
                  background: decision==='approuve' ? '#dcfce7' : '#fff',
                  color: decision==='approuve' ? '#15803d' : '#374151'
                }}>✓ APPROUVÉ</button>
                <button onClick={() => setDecision('rejete')} style={{
                  padding:'20px', borderRadius:12, border:'2px solid', cursor:'pointer', fontSize:16, fontWeight:700,
                  borderColor: decision==='rejete' ? '#dc2626' : '#e5e7eb',
                  background: decision==='rejete' ? '#fee2e2' : '#fff',
                  color: decision==='rejete' ? '#dc2626' : '#374151'
                }}>✗ REJETÉ</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Quantité approuvée (kg)</label>
                  <input type="number" value={qteApprouvee} onChange={e => setQteApprouvee(e.target.value)}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'12px', fontSize:16, boxSizing:'border-box' }}
                    placeholder="0"/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Quantité rejetée (kg)</label>
                  <input type="number" value={qteRejetee} onChange={e => setQteRejetee(e.target.value)}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'12px', fontSize:16, boxSizing:'border-box' }}
                    placeholder="0"/>
                </div>
              </div>
              <div style={{ marginTop:12 }}>
                <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Notes / Observations</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'12px', fontSize:14, boxSizing:'border-box', resize:'vertical' }}
                  placeholder="Observations, non-conformités, actions correctives..."/>
              </div>
            </div>

            {/* Photos */}
            <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dbeafe' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1e3a5f' }}>3 — Photos du lot</h3>
              <label style={{ display:'inline-block', background:'#1d4ed8', color:'#fff', padding:'12px 24px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:14 }}>
                + Ajouter des photos
                <input type="file" accept="image/*" multiple capture="environment" onChange={ajouterPhotos} style={{ display:'none' }}/>
              </label>
              {photos.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:12, marginTop:16 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ position:'relative' }}>
                      <img src={p.preview} alt={p.nom} style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8, border:'1px solid #dbeafe' }}/>
                      <button onClick={() => supprimerPhoto(i)} style={{
                        position:'absolute', top:4, right:4, background:'#dc2626', color:'#fff',
                        border:'none', borderRadius:'50%', width:24, height:24, cursor:'pointer',
                        fontSize:14, display:'flex', alignItems:'center', justifyContent:'center'
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length === 0 && (
                <p style={{ color:'#9ca3af', fontSize:13, marginTop:12 }}>Aucune photo ajoutée — la caméra de la tablette sera utilisée</p>
              )}
            </div>

            {/* Signature */}
            <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dbeafe' }}>
              <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1e3a5f' }}>4 — Signature électronique</h3>
              {signatureData ? (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                    <div style={{ width:12, height:12, background:'#16a34a', borderRadius:'50%' }}/>
                    <span style={{ color:'#15803d', fontWeight:600 }}>Signature enregistrée</span>
                  </div>
                  <img src={signatureData} alt="Signature" style={{ border:'1px solid #dbeafe', borderRadius:8, maxWidth:300, background:'#f8faff' }}/>
                  <button onClick={() => { setSignatureData(null); setSigneMode(true); }}
                    style={{ display:'block', marginTop:10, background:'none', border:'1px solid #d1d5db', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, color:'#6b7280' }}>
                    Refaire la signature
                  </button>
                </div>
              ) : signeMode ? (
                <div>
                  <p style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>Signez dans le cadre ci-dessous avec votre doigt ou stylet</p>
                  <canvas ref={canvasRef} width={500} height={180}
                    style={{ border:'2px solid #1d4ed8', borderRadius:10, background:'#fff', touchAction:'none', cursor:'crosshair', maxWidth:'100%' }}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}/>
                  <div style={{ display:'flex', gap:10, marginTop:12 }}>
                    <button onClick={validerSignature} style={{ background:'#1d4ed8', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>
                      Valider la signature
                    </button>
                    <button onClick={effacerSignature} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'10px 16px', borderRadius:10, cursor:'pointer' }}>
                      Effacer
                    </button>
                    <button onClick={() => setSigneMode(false)} style={{ background:'none', color:'#9ca3af', border:'none', padding:'10px 16px', cursor:'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setSigneMode(true)} style={{
                  background:'#eff6ff', color:'#1d4ed8', border:'2px dashed #93c5fd',
                  padding:'24px 40px', borderRadius:12, cursor:'pointer', fontWeight:600, fontSize:15
                }}>
                  ✍ Signer maintenant
                </button>
              )}
            </div>

            {/* Bouton soumettre */}
            <button onClick={soumettre} disabled={submitting || !decision || !signatureData}
              style={{
                background: (!decision || !signatureData) ? '#9ca3af' : '#1d4ed8',
                color:'#fff', border:'none', padding:'20px', borderRadius:14,
                cursor: (!decision || !signatureData) ? 'not-allowed' : 'pointer',
                fontWeight:700, fontSize:18, width:'100%', transition:'background .2s'
              }}>
              {submitting ? 'Enregistrement...' : '✓ Valider le contrôle & Générer PDF'}
            </button>

            </>)}
          </div>
        )}

        {/* ── HISTORIQUE ── */}
        {onglet === 'historique' && (
          <div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:13, fontWeight:600, color:'#374151', marginRight:10 }}>Filtrer par OF :</label>
              <select onChange={e => setOfSelectionne(ofs.find(o => o.id===e.target.value) || null)}
                style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:14 }}>
                <option value="">Tous les OF</option>
                {ofs.map(o => <option key={o.id} value={o.id}>{o.numero_of} — {o.client_nom}</option>)}
              </select>
            </div>

            {controles.length === 0 ? (
              <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #dbeafe' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <p style={{ color:'#9ca3af' }}>Aucun contrôle qualité enregistré</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {controles.map(c => (
                  <div key={c.id} style={{ background:'#fff', borderRadius:14, padding:20, border:`2px solid ${c.decision==='approuve' ? '#86efac' : '#fca5a5'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                      <div>
                        <span style={{
                          background: c.decision==='approuve' ? '#dcfce7' : '#fee2e2',
                          color: c.decision==='approuve' ? '#15803d' : '#dc2626',
                          padding:'4px 14px', borderRadius:20, fontWeight:700, fontSize:14
                        }}>
                          {c.decision==='approuve' ? '✓ APPROUVÉ' : '✗ REJETÉ'}
                        </span>
                        <span style={{ marginLeft:12, color:'#6b7280', fontSize:13 }}>
                          {new Date(c.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:10 }}>
                        {c.pdf_path && (
                          <button onClick={() => telechargerPDF(c.id)} style={{
                            background:'#1d4ed8', color:'#fff', border:'none', padding:'8px 16px',
                            borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600
                          }}>📄 Télécharger PDF</button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, fontSize:13 }}>
                      <div><span style={{ color:'#9ca3af' }}>Contrôleur :</span> <strong>{c.controleur_nom}</strong></div>
                      <div><span style={{ color:'#9ca3af' }}>Approuvé :</span> <strong style={{ color:'#15803d' }}>{c.quantite_approuvee} kg</strong></div>
                      <div><span style={{ color:'#9ca3af' }}>Rejeté :</span> <strong style={{ color:'#dc2626' }}>{c.quantite_rejetee} kg</strong></div>
                    </div>
                    {c.notes && <div style={{ marginTop:10, fontSize:13, color:'#374151', background:'#f8faff', padding:'10px 14px', borderRadius:8 }}>{c.notes}</div>}
                    {c.photos && JSON.parse(c.photos || '[]').length > 0 && (
                      <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                        {JSON.parse(c.photos).map((p,i) => (
                          <img key={i} src={p} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:6, border:'1px solid #dbeafe' }}/>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p style={{ textAlign:'center', color:'#9ca3af', fontSize:12, marginTop:32 }}>
              © 2026 NAIdo — Logiciel créé par SOPHOPSY pour Green Industry
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
