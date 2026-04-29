import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

export default function Rapports() {
  const [rapports, setRapports] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    debut: (() => { const d = new Date(); d.setDate(d.getDate()-6); return d.toISOString().split('T')[0]; })(),
    fin: new Date().toISOString().split('T')[0]
  });

  const charger = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/rapports`);
      setRapports(data);
    } catch {}
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const generer = async () => {
    setGenerating(true);
    try {
      await axios.post(`${API}/rapports/generer`, form);
      toast.success('Rapport généré avec succès !');
      charger();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur génération'); }
    finally { setGenerating(false); }
  };

  const telecharger = async (id, type) => {
    try {
      const { data } = await axios.get(`${API}/rapports/${id}/${type}`, { responseType:'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-naido-${type}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
    } catch { toast.error('Fichier non disponible'); }
  };

  // Raccourcis périodes
  const setPeriode = (type) => {
    const fin = new Date();
    const debut = new Date();
    if (type === 'semaine') debut.setDate(debut.getDate() - 6);
    if (type === 'mois') debut.setDate(1);
    if (type === 'mois_dernier') {
      fin.setDate(0); debut.setDate(1); debut.setMonth(debut.getMonth() - 1);
    }
    setForm({ debut: debut.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] });
  };

  return (
    <div>
      {/* Générateur */}
      <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #e5e7eb', marginBottom:24 }}>
        <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:'#14532d' }}>Générer un rapport</h3>
        <p style={{ margin:'0 0 18px', fontSize:13, color:'#6b7280' }}>
          Le rapport inclut : TRS par machine · Taux de rebus · Bilan matière · Alertes déclenchées
        </p>

        {/* Raccourcis */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { label:'7 derniers jours', type:'semaine' },
            { label:'Ce mois', type:'mois' },
            { label:'Mois dernier', type:'mois_dernier' },
          ].map(p => (
            <button key={p.type} onClick={() => setPeriode(p.type)} style={{
              background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d',
              padding:'6px 14px', borderRadius:20, cursor:'pointer', fontSize:13, fontWeight:600
            }}>{p.label}</button>
          ))}
        </div>

        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>Du</label>
            <input type="date" value={form.debut} onChange={e => setForm({...form, debut:e.target.value})}
              style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13 }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ fontSize:13, fontWeight:600, color:'#374151' }}>au</label>
            <input type="date" value={form.fin} onChange={e => setForm({...form, fin:e.target.value})}
              style={{ border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13 }}/>
          </div>
        </div>

        <button onClick={generer} disabled={generating} style={{
          background: generating ? '#d1d5db' : '#14532d', color:'#fff', border:'none',
          padding:'14px 28px', borderRadius:12, cursor: generating ? 'not-allowed' : 'pointer',
          fontWeight:700, fontSize:15, display:'flex', alignItems:'center', gap:8
        }}>
          {generating ? '⏳ Génération en cours...' : '📄 Générer PDF + Excel'}
        </button>

        <p style={{ margin:'12px 0 0', fontSize:12, color:'#9ca3af' }}>
          📅 Rapport hebdomadaire automatique généré chaque lundi à 6h00
        </p>
      </div>

      {/* Liste rapports */}
      <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:'#374151' }}>Rapports générés ({rapports.length})</h4>
        </div>
        {rapports.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 24px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
            <p style={{ color:'#9ca3af' }}>Aucun rapport généré pour l'instant</p>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Type','Période','Généré le','Par','Télécharger'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rapports.map((r, i) => (
                <tr key={r.id} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'#fff':'#fafafa' }}>
                  <td style={{ padding:'10px 16px' }}>
                    <span style={{ background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {r.type.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding:'10px 16px', fontFamily:'monospace', fontSize:12 }}>
                    {r.periode_debut} → {r.periode_fin}
                  </td>
                  <td style={{ padding:'10px 16px', color:'#6b7280' }}>
                    {new Date(r.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td style={{ padding:'10px 16px' }}>{r.genere_par_nom}</td>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', gap:8' }}>
                      {r.pdf_path && (
                        <button onClick={() => telecharger(r.id, 'pdf')} style={{
                          background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5',
                          padding:'5px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600
                        }}>📄 PDF</button>
                      )}
                      {r.excel_path && (
                        <button onClick={() => telecharger(r.id, 'excel')} style={{
                          background:'#dcfce7', color:'#15803d', border:'1px solid #86efac',
                          padding:'5px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600
                        }}>📊 Excel</button>
                      )}
                    </div>
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
