import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';
const COULEURS_STATUT = {
  planifie:  { bg:'#dbeafe', border:'#3b82f6', text:'#1d4ed8' },
  en_cours:  { bg:'#dcfce7', border:'#16a34a', text:'#15803d' },
  termine:   { bg:'#f3f4f6', border:'#9ca3af', text:'#6b7280' },
  reporte:   { bg:'#fef3c7', border:'#f59e0b', text:'#92400e' },
};
const SHIFTS = [
  { id: 1, nom: 'Matin',       debut: 6,  fin: 14, couleur: '#fef9c3' },
  { id: 2, nom: 'Après-midi',  debut: 14, fin: 22, couleur: '#dbeafe' },
  { id: 3, nom: 'Nuit',        debut: 22, fin: 30, couleur: '#e0e7ff' },
];

export default function Planning({ machines = [], ofs = [] }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [planning, setPlanning] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ of_id:'', machine_id:'', shift_id:'1', date_planifiee:'', heure_debut_prevue:'06:00', duree_prevue_min:'', notes:'' });
  const [vue, setVue] = useState('gantt'); // gantt | liste

  const charger = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/planning?date=${date}`);
      setPlanning(data);
    } catch { toast.error('Erreur chargement planning'); }
  }, [date]);

  useEffect(() => { charger(); }, [charger]);

  const naviguerJour = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const creerPlanification = async () => {
    if (!form.of_id || !form.machine_id || !form.duree_prevue_min)
      return toast.error('OF, machine et durée obligatoires');
    try {
      await axios.post(`${API}/planning`, { ...form, date_planifiee: date });
      toast.success('Planifié');
      setShowForm(false);
      setForm({ of_id:'', machine_id:'', shift_id:'1', date_planifiee:'', heure_debut_prevue:'06:00', duree_prevue_min:'', notes:'' });
      charger();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
  };

  const changerStatut = async (id, statut) => {
    try {
      await axios.put(`${API}/planning/${id}`, { statut });
      charger();
    } catch { toast.error('Erreur mise à jour'); }
  };

  const supprimerPlanification = async (id) => {
    if (!confirm('Supprimer cette planification ?')) return;
    try {
      await axios.delete(`${API}/planning/${id}`);
      charger();
      toast.success('Supprimé');
    } catch { toast.error('Erreur suppression'); }
  };

  // Grouper par machine pour le Gantt
  const parMachine = machines.reduce((acc, m) => {
    acc[m.id] = { machine: m, items: planning.filter(p => p.machine_id === m.id) };
    return acc;
  }, {});

  // Calculer position Gantt (6h00 → 30h00 = 24h)
  const heureEnPct = (heure) => {
    const [h, min] = heure.split(':').map(Number);
    return ((h < 6 ? h + 24 : h) - 6) / 24 * 100;
  };
  const dureeEnPct = (min) => (parseInt(min) / (24 * 60)) * 100;

  return (
    <div>
      {/* Barre navigation date */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => naviguerJour(-1)} style={{ background:'#fff', border:'1px solid #d1d5db', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:16 }}>←</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:14 }}/>
          <button onClick={() => naviguerJour(1)} style={{ background:'#fff', border:'1px solid #d1d5db', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:16 }}>→</button>
          <button onClick={() => setDate(new Date().toISOString().split('T')[0])}
            style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            Aujourd'hui
          </button>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setVue(vue==='gantt'?'liste':'gantt')}
            style={{ background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            {vue==='gantt' ? '📋 Vue liste' : '📊 Vue Gantt'}
          </button>
          <button onClick={() => setShowForm(true)}
            style={{ background:'#14532d', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13 }}>
            + Planifier
          </button>
        </div>
      </div>

      {/* Formulaire de planification */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #86efac', marginBottom:20 }}>
          <h4 style={{ margin:'0 0 16px', color:'#14532d', fontSize:15, fontWeight:700 }}>Nouvelle planification — {date}</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>OF *</label>
              <select value={form.of_id} onChange={e => setForm({...form, of_id:e.target.value})}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                <option value="">Sélectionner...</option>
                {ofs.map(o => <option key={o.id} value={o.id}>{o.numero_of} — {o.client_nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Machine *</label>
              <select value={form.machine_id} onChange={e => setForm({...form, machine_id:e.target.value})}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                <option value="">Sélectionner...</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.code} — {m.nom}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Shift *</label>
              <select value={form.shift_id} onChange={e => setForm({...form, shift_id:e.target.value})}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}>
                <option value="1">Matin (6h-14h)</option>
                <option value="2">Après-midi (14h-22h)</option>
                <option value="3">Nuit (22h-6h)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Heure début</label>
              <input type="time" value={form.heure_debut_prevue} onChange={e => setForm({...form, heure_debut_prevue:e.target.value})}
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Durée (min) *</label>
              <input type="number" value={form.duree_prevue_min} onChange={e => setForm({...form, duree_prevue_min:e.target.value})}
                placeholder="ex: 480" style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}/>
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes:e.target.value})}
                placeholder="Instructions..." style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'10px', fontSize:13 }}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={creerPlanification} style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 24px', borderRadius:10, cursor:'pointer', fontWeight:600 }}>Planifier</button>
            <button onClick={() => setShowForm(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Vue Gantt */}
      {vue === 'gantt' && (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          {/* En-tête heures */}
          <div style={{ display:'flex', borderBottom:'2px solid #e5e7eb', background:'#f9fafb' }}>
            <div style={{ width:120, minWidth:120, padding:'8px 12px', fontSize:11, fontWeight:700, color:'#374151', borderRight:'1px solid #e5e7eb' }}>MACHINE</div>
            <div style={{ flex:1, position:'relative', height:32 }}>
              {[6,8,10,12,14,16,18,20,22,0,2,4].map(h => (
                <div key={h} style={{
                  position:'absolute', left:`${((h < 6 ? h+24 : h) - 6) / 24 * 100}%`,
                  fontSize:10, color:'#9ca3af', top:10, transform:'translateX(-50%)'
                }}>{String(h).padStart(2,'0')}h</div>
              ))}
              {/* Bandes shifts */}
              {SHIFTS.map(s => (
                <div key={s.id} style={{
                  position:'absolute', left:`${(s.debut - 6) / 24 * 100}%`,
                  width:`${(s.fin - s.debut) / 24 * 100}%`,
                  height:'100%', background:s.couleur, opacity:0.4
                }}/>
              ))}
            </div>
          </div>

          {/* Lignes machines */}
          {Object.values(parMachine).map(({ machine, items }) => (
            <div key={machine.id} style={{ display:'flex', borderBottom:'1px solid #f0f0f0', minHeight:48 }}>
              <div style={{ width:120, minWidth:120, padding:'8px 12px', fontSize:12, fontWeight:700, color:'#374151', borderRight:'1px solid #e5e7eb', display:'flex', alignItems:'center', background:'#fafafa' }}>
                <div>
                  <div style={{ fontSize:11, color:'#374151', fontWeight:700 }}>{machine.code}</div>
                  <div style={{ fontSize:10, color:'#9ca3af' }}>{machine.type}</div>
                </div>
              </div>
              <div style={{ flex:1, position:'relative', minHeight:48 }}>
                {SHIFTS.map(s => (
                  <div key={s.id} style={{
                    position:'absolute', left:`${(s.debut - 6) / 24 * 100}%`,
                    width:`${(s.fin - s.debut) / 24 * 100}%`,
                    height:'100%', background:s.couleur, opacity:0.2
                  }}/>
                ))}
                {items.map(item => {
                  const left = item.heure_debut_prevue ? heureEnPct(item.heure_debut_prevue) : 0;
                  const width = item.duree_prevue_min ? dureeEnPct(item.duree_prevue_min) : 10;
                  const colors = COULEURS_STATUT[item.statut_planning] || COULEURS_STATUT.planifie;
                  return (
                    <div key={item.id} title={`${item.numero_of} — ${item.article_nom} — ${item.client_nom}\nStatut: ${item.statut_planning}\nAvancement: ${item.avancement_pct || 0}%`}
                      style={{
                        position:'absolute', left:`${left}%`, width:`${Math.max(width, 3)}%`,
                        top:6, height:36, background:colors.bg, border:`2px solid ${colors.border}`,
                        borderRadius:6, padding:'2px 6px', overflow:'hidden', cursor:'pointer',
                        fontSize:10, color:colors.text, fontWeight:600
                      }}>
                      <div style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{item.numero_of}</div>
                      <div style={{ fontSize:9, fontWeight:400, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{item.article_nom}</div>
                      {item.avancement_pct > 0 && (
                        <div style={{ position:'absolute', bottom:0, left:0, height:3, width:`${item.avancement_pct}%`, background:colors.border, borderRadius:'0 0 0 4px' }}/>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {planning.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
              <p>Aucune planification pour ce jour</p>
              <button onClick={() => setShowForm(true)} style={{ background:'#14532d', color:'#fff', border:'none', padding:'10px 20px', borderRadius:8, cursor:'pointer', marginTop:8, fontWeight:600 }}>+ Planifier</button>
            </div>
          )}
        </div>
      )}

      {/* Vue Liste */}
      {vue === 'liste' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {planning.length === 0 && (
            <div style={{ background:'#fff', borderRadius:14, padding:'40px', textAlign:'center', border:'1px solid #e5e7eb' }}>
              <p style={{ color:'#9ca3af' }}>Aucune planification pour ce jour</p>
            </div>
          )}
          {planning.map(item => {
            const colors = COULEURS_STATUT[item.statut_planning] || COULEURS_STATUT.planifie;
            return (
              <div key={item.id} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:`2px solid ${colors.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:15 }}>{item.numero_of}</span>
                    <span style={{ background:colors.bg, color:colors.text, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{item.statut_planning}</span>
                    <span style={{ background:'#f3f4f6', color:'#374151', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{item.machine_code}</span>
                    <span style={{ background:'#f3f4f6', color:'#374151', padding:'2px 8px', borderRadius:20, fontSize:11 }}>{item.shift_nom}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#374151' }}>{item.article_nom} · {item.client_nom}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>
                    {item.heure_debut_prevue && `Début : ${item.heure_debut_prevue}`}
                    {item.duree_prevue_min && ` · Durée : ${item.duree_prevue_min} min`}
                    {item.avancement_pct > 0 && ` · Avancement : ${item.avancement_pct}%`}
                  </div>
                  {item.notes && <div style={{ fontSize:12, color:'#9ca3af', marginTop:4, fontStyle:'italic' }}>{item.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {item.statut_planning === 'planifie' && (
                    <button onClick={() => changerStatut(item.id, 'en_cours')}
                      style={{ background:'#dcfce7', color:'#15803d', border:'1px solid #86efac', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      ▶ Démarrer
                    </button>
                  )}
                  {item.statut_planning === 'en_cours' && (
                    <button onClick={() => changerStatut(item.id, 'termine')}
                      style={{ background:'#f3f4f6', color:'#374151', border:'1px solid #d1d5db', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      ✓ Terminer
                    </button>
                  )}
                  <button onClick={() => changerStatut(item.id, 'reporte')}
                    style={{ background:'#fef3c7', color:'#92400e', border:'1px solid #fcd34d', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                    Reporter
                  </button>
                  <button onClick={() => supprimerPlanification(item.id)}
                    style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Légende */}
      <div style={{ display:'flex', gap:16, marginTop:16, flexWrap:'wrap' }}>
        {Object.entries(COULEURS_STATUT).map(([statut, colors]) => (
          <div key={statut} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
            <div style={{ width:16, height:16, background:colors.bg, border:`2px solid ${colors.border}`, borderRadius:4 }}/>
            <span style={{ color:colors.text, fontWeight:600 }}>{statut}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
