import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

const TYPE_CONFIG = {
  trs_bas:        { label:'TRS Bas',          icon:'📉', color:'#dc2626', bg:'#fee2e2' },
  rebus_eleve:    { label:'Rebus Élevé',       icon:'⚠️',  color:'#d97706', bg:'#fef3c7' },
  arret_long:     { label:'Arrêt Long',        icon:'⏹',  color:'#7c3aed', bg:'#ede9fe' },
  stock_bas:      { label:'Stock Bas',         icon:'📦',  color:'#0369a1', bg:'#e0f2fe' },
  of_retard:      { label:'OF en Retard',      icon:'🕐',  color:'#b91c1c', bg:'#fef2f2' },
  objectif_atteint:{ label:'Objectif Atteint', icon:'🎯',  color:'#15803d', bg:'#dcfce7' },
};

export function BadgeAlertes() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const charger = async () => {
      try {
        const { data } = await axios.get(`${API}/alertes/count`);
        setCount(data.count);
      } catch {}
    };
    charger();
    const iv = setInterval(charger, 30000);
    return () => clearInterval(iv);
  }, []);

  if (count === 0) return null;
  return (
    <span style={{
      background:'#dc2626', color:'#fff', borderRadius:'50%',
      width:20, height:20, fontSize:11, fontWeight:700,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      marginLeft:6
    }}>{count > 99 ? '99+' : count}</span>
  );
}

export default function Alertes({ configMode = false }) {
  const [alertes, setAlertes] = useState([]);
  const [config, setConfig] = useState([]);
  const [filtre, setFiltre] = useState('toutes');
  const [loading, setLoading] = useState(false);

  const charger = useCallback(async () => {
    try {
      const params = filtre !== 'toutes' ? `?lue=${filtre === 'lues'}` : '';
      const { data } = await axios.get(`${API}/alertes${params}`);
      setAlertes(data);
    } catch {}
  }, [filtre]);

  const chargerConfig = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/alertes/config`);
      setConfig(data);
    } catch {}
  }, []);

  useEffect(() => {
    charger();
    if (configMode) chargerConfig();
    const iv = setInterval(charger, 30000);
    return () => clearInterval(iv);
  }, [charger, chargerConfig, configMode]);

  const lireAlerte = async (id) => {
    try {
      await axios.put(`${API}/alertes/${id}/lire`);
      charger();
    } catch {}
  };

  const lireTout = async () => {
    try {
      await axios.put(`${API}/alertes/lire-tout`);
      toast.success('Toutes les alertes marquées comme lues');
      charger();
    } catch {}
  };

  const verifierMaintenant = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/alertes/verifier`);
      toast.success('Vérification effectuée');
      charger();
    } catch { toast.error('Erreur vérification'); }
    finally { setLoading(false); }
  };

  const sauvegarderConfig = async (id, seuil, actif) => {
    try {
      await axios.put(`${API}/alertes/config/${id}`, { seuil, actif });
      toast.success('Seuil mis à jour');
    } catch { toast.error('Erreur'); }
  };

  const nonLues = alertes.filter(a => !a.lue).length;

  return (
    <div>
      {/* En-tête */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#1c1917' }}>
            Centre d'alertes
            {nonLues > 0 && (
              <span style={{ marginLeft:8, background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius:20, fontSize:12 }}>{nonLues} non lues</span>
            )}
          </h3>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={verifierMaintenant} disabled={loading}
            style={{ background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            {loading ? 'Vérification...' : '🔄 Vérifier maintenant'}
          </button>
          {nonLues > 0 && (
            <button onClick={lireTout}
              style={{ background:'#f3f4f6', border:'1px solid #d1d5db', color:'#374151', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
              Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { val:'toutes',   label:'Toutes' },
          { val:'nonlues',  label:'Non lues' },
          { val:'lues',     label:'Lues' },
        ].map(f => (
          <button key={f.val} onClick={() => setFiltre(f.val)} style={{
            padding:'6px 14px', borderRadius:20, border:'1px solid',
            borderColor: filtre===f.val ? '#14532d' : '#d1d5db',
            background: filtre===f.val ? '#14532d' : '#fff',
            color: filtre===f.val ? '#fff' : '#374151',
            cursor:'pointer', fontSize:13, fontWeight: filtre===f.val ? 600 : 400
          }}>{f.label}</button>
        ))}
      </div>

      {/* Liste alertes */}
      {alertes.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:14, padding:'48px 24px', textAlign:'center', border:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <p style={{ color:'#6b7280', fontSize:15 }}>Aucune alerte</p>
          <p style={{ color:'#9ca3af', fontSize:13 }}>Tout fonctionne normalement</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
          {alertes.map(a => {
            const cfg = TYPE_CONFIG[a.type] || { label:a.type, icon:'⚡', color:'#374151', bg:'#f3f4f6' };
            return (
              <div key={a.id} style={{
                background: a.lue ? '#fafafa' : cfg.bg,
                borderRadius:12, padding:'14px 16px',
                border:`1px solid ${a.lue ? '#e5e7eb' : cfg.color}`,
                opacity: a.lue ? 0.7 : 1,
                display:'flex', alignItems:'flex-start', gap:12
              }}>
                <div style={{ fontSize:22, flexShrink:0 }}>{cfg.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <span style={{ fontWeight:700, color:cfg.color, fontSize:13 }}>{cfg.label}</span>
                      {a.machine_code && <span style={{ marginLeft:8, background:'#f3f4f6', padding:'1px 8px', borderRadius:20, fontSize:11, color:'#374151' }}>{a.machine_code}</span>}
                      {a.numero_of && <span style={{ marginLeft:6, background:'#f3f4f6', padding:'1px 8px', borderRadius:20, fontSize:11, color:'#374151' }}>{a.numero_of}</span>}
                    </div>
                    <span style={{ fontSize:11, color:'#9ca3af', flexShrink:0 }}>
                      {new Date(a.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'#374151', marginTop:4 }}>{a.message}</div>
                  {a.valeur_declenchante && (
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>
                      Valeur : <strong>{a.valeur_declenchante}</strong> · Seuil : <strong>{a.seuil}</strong>
                    </div>
                  )}
                </div>
                {!a.lue && (
                  <button onClick={() => lireAlerte(a.id)}
                    style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:18, flexShrink:0, padding:4 }}
                    title="Marquer comme lu">✓</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Configuration seuils */}
      {configMode && config.length > 0 && (
        <div style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #e5e7eb' }}>
          <h4 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:'#374151' }}>Configuration des seuils d'alerte</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {config.map(c => {
              const cfg = TYPE_CONFIG[c.type] || { label:c.type, icon:'⚡', color:'#374151' };
              return (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#f9fafb', borderRadius:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:16 }}>{cfg.icon}</span>
                  <span style={{ fontWeight:600, fontSize:13, color:'#374151', minWidth:140 }}>{cfg.label}</span>
                  <input type="number" defaultValue={c.seuil} step="0.1"
                    onBlur={e => sauvegarderConfig(c.id, parseFloat(e.target.value), c.actif)}
                    style={{ width:80, border:'1px solid #d1d5db', borderRadius:8, padding:'6px 10px', fontSize:13, textAlign:'center' }}/>
                  <span style={{ fontSize:12, color:'#9ca3af' }}>
                    {c.type === 'arret_long' ? 'minutes' : '%'}
                  </span>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', marginLeft:'auto' }}>
                    <input type="checkbox" defaultChecked={c.actif}
                      onChange={e => sauvegarderConfig(c.id, c.seuil, e.target.checked)}/>
                    Actif
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
