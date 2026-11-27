// NAIdo - Arrivages import (conteneurs) : état des arrivages, zone de quarantaine et transfert vers le stock du magasin MP.
// Affiché chez le magasin MP, les achats et la direction ; seuls le magasin MP et les achats peuvent transférer.
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import { confirmer } from '../utils/confirmer.jsx';

const API = '/api';
const R_LECTURE = ['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', 'achat', 'directeur', 'super_admin'];

const PHASES = {
  en_route:    { l: 'En route',               c: '#0369a1', bg: '#e0f2fe' },
  quarantaine: { l: 'En quarantaine',         c: '#92400e', bg: '#fef3c7' },
  partiel:     { l: 'Reçu en partie',         c: '#6d28d9', bg: '#ede9fe' },
  transfere:   { l: 'Transféré au magasin',   c: '#166534', bg: '#dcfce7' },
};
const fmtKg = (v) => (parseFloat(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const fmtJour = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function ArrivagesImport() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const [data, setData] = useState({ arrivages: [], quarantaine: [], transferts: [], peut_transferer: false });
  const [qtes, setQtes] = useState({});
  const [ouvert, setOuvert] = useState(true);
  const [historique, setHistorique] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    if (!R_LECTURE.includes(role)) return;
    axios.get(`${API}/arrivages-import`).then(r => setData({ arrivages: [], quarantaine: [], transferts: [], peut_transferer: false, ...(r.data || {}) })).catch(() => {});
  }, [role]);
  useEffect(() => { charger(); }, [charger]);

  if (!R_LECTURE.includes(role)) return null;
  const { arrivages, quarantaine, transferts, peut_transferer } = data;
  if (!arrivages.length && !quarantaine.length) return (
    <div style={{ background: '#f0f9ff', border: '2px dashed #7dd3fc', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#0369a1' }}>
      <b>🚢 Arrivages conteneurs (import)</b> — aucun arrivage en cours.
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Quand une commande « Import (conteneur) » sera réceptionnée, la marchandise apparaîtra ici en zone de quarantaine, à transférer au stock du magasin MP.</div>
    </div>
  );

  const transferer = async (lots, libelle) => {
    if (!lots.length) return;
    const total = lots.reduce((s, l) => s + (l.qte === undefined ? parseFloat(l.dispo) : parseFloat(l.qte)), 0);
    if (!(await confirmer(`${libelle} : transférer ${fmtKg(total)} kg de la quarantaine vers le stock du magasin MP ?`))) return;
    setEnvoi(true);
    try {
      const { data: r } = await axios.post(`${API}/arrivages-import/transferer`, { transferts: lots.map(l => ({ lot_id: l.id, ...(l.qte !== undefined ? { qte: l.qte } : {}) })) });
      toast.success(r.message || 'Transfert effectué');
      setQtes({});
      charger();
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setEnvoi(false);
  };

  const transfererLigne = (l) => {
    const saisie = qtes[l.id];
    const dispo = parseFloat(l.qte_disponible) || 0;
    const q = saisie === undefined || saisie === '' ? dispo : parseFloat(saisie);
    if (!(q > 0)) return toast.error('Quantité invalide');
    if (q > dispo + 1e-6) return toast.error(`Maximum ${fmtKg(dispo)} kg`);
    transferer([{ id: l.id, dispo, qte: Math.abs(q - dispo) < 1e-6 ? undefined : q }], `${l.code}`);
  };
  const transfererCommande = (numero, lots) => transferer(lots.map(l => ({ id: l.id, dispo: l.qte_disponible })), `Arrivage ${numero}`);

  const parCommande = {};
  quarantaine.forEach(l => { (parCommande[l.numero_commande || '—'] = parCommande[l.numero_commande || '—'] || []).push(l); });
  const nbKgQuar = quarantaine.reduce((s, l) => s + (parseFloat(l.qte_disponible) || 0), 0);
  const btn = (couleur) => ({ background: couleur, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: envoi ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, opacity: envoi ? 0.6 : 1 });
  const th = { textAlign: 'left', padding: '5px 8px', fontSize: 10, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', whiteSpace: 'nowrap' };
  const td = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' };

  return (
    <div style={{ background: '#f0f9ff', border: '2px solid #7dd3fc', borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: ouvert ? 10 : 0 }}>
        <div style={{ fontWeight: 800, color: '#0369a1' }}>
          🚢 Arrivages conteneurs (import){nbKgQuar > 0 && <span style={{ marginLeft: 8, background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '1px 9px', fontSize: 11 }}>{fmtKg(nbKgQuar)} kg en quarantaine</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={charger} style={{ background: '#fff', border: '1px solid #7dd3fc', color: '#0369a1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>🔄</button>
          <button onClick={() => setOuvert(v => !v)} style={{ background: '#fff', border: '1px solid #7dd3fc', color: '#0369a1', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>{ouvert ? 'Réduire' : 'Afficher'}</button>
        </div>
      </div>

      {ouvert && (<>
        {/* Zone de quarantaine : ce qui attend d'être transféré */}
        {quarantaine.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 6, fontSize: 13 }}>⏳ Zone de quarantaine : matières reçues, pas encore en stock</div>
            {Object.entries(parCommande).map(([numero, lots]) => (
              <div key={numero} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <div style={{ fontSize: 12 }}>
                    <b style={{ fontFamily: 'monospace', color: '#92400e' }}>{numero}</b>
                    {lots[0].fournisseur_nom ? ` · ${lots[0].fournisseur_nom}` : ''}
                    {lots[0].numero_conteneur ? ` · conteneur ${lots[0].numero_conteneur}` : ''}
                  </div>
                  {peut_transferer && lots.length > 1 && <button disabled={envoi} style={btn('#15803d')} onClick={() => transfererCommande(numero, lots)}>Tout transférer au magasin MP</button>}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Matière</th><th style={th}>Lot</th><th style={th}>Reçu le</th><th style={th}>En quarantaine</th>{peut_transferer && <th style={th}>À transférer (kg)</th>}{peut_transferer && <th style={th}></th>}</tr></thead>
                  <tbody>
                    {lots.map(l => (
                      <tr key={l.id}>
                        <td style={td}><b>{l.code}</b> — {l.designation}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{l.numero_lot}</td>
                        <td style={td}>{fmtJour(l.date_reception)}{l.jours > 0 && <span style={{ color: l.jours > 7 ? '#b91c1c' : '#6b7280' }}> ({l.jours} j)</span>}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{fmtKg(l.qte_disponible)} kg</td>
                        {peut_transferer && <td style={td}>
                          <input type="number" min="0" step="0.1" max={l.qte_disponible} value={qtes[l.id] ?? ''} placeholder={fmtKg(l.qte_disponible)}
                            onChange={e => setQtes(p => ({ ...p, [l.id]: e.target.value }))}
                            style={{ width: 100, border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 6px', fontSize: 12, textAlign: 'right' }} />
                        </td>}
                        {peut_transferer && <td style={td}><button disabled={envoi} style={btn('#15803d')} onClick={() => transfererLigne(l)}>→ Magasin MP</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {!peut_transferer && <div style={{ fontSize: 11, color: '#6b7280' }}>Le transfert vers le stock est fait par le magasin MP ou les achats.</div>}
          </div>
        )}

        {/* Etat des arrivages */}
        <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 4, fontSize: 13 }}>État des arrivages</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
            <thead><tr>
              <th style={th}>Commande</th><th style={th}>Fournisseur</th><th style={th}>Conteneur / lot</th><th style={th}>Prévu le</th><th style={th}>Dernière étape</th>
              <th style={th}>Commandé</th><th style={th}>Reçu</th><th style={th}>En quarantaine</th><th style={th}>Transféré</th><th style={th}>État</th>
            </tr></thead>
            <tbody>
              {arrivages.map(a => {
                const p = PHASES[a.phase] || PHASES.en_route;
                return (
                  <tr key={a.id}>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{a.numero_commande}</td>
                    <td style={td}>{a.fournisseur || '—'}</td>
                    <td style={td}>{a.conteneurs || '—'}{a.numero_lot_conteneur ? <div style={{ fontSize: 10, color: '#6b7280' }}>lot {a.numero_lot_conteneur}</div> : null}</td>
                    <td style={td}>{fmtJour(a.date_livraison_prevue)}</td>
                    <td style={td}>{a.derniere_etape || '—'}{a.derniere_etape_at ? <div style={{ fontSize: 10, color: '#6b7280' }}>{fmtJour(a.derniere_etape_at)}</div> : null}</td>
                    <td style={td}>{fmtKg(a.qte_commandee)} kg</td>
                    <td style={td}>{fmtKg(a.qte_recue)} kg</td>
                    <td style={{ ...td, color: parseFloat(a.qte_quarantaine) > 0 ? '#92400e' : undefined, fontWeight: parseFloat(a.qte_quarantaine) > 0 ? 700 : 400 }}>{fmtKg(a.qte_quarantaine)} kg</td>
                    <td style={td}>{fmtKg(a.qte_transferee)} kg</td>
                    <td style={td}><span style={{ background: p.bg, color: p.c, borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{p.l}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {transferts.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setHistorique(v => !v)} style={{ background: '#fff', border: '1px solid #7dd3fc', color: '#0369a1', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
              {historique ? 'Masquer les transferts' : `Derniers transferts (${transferts.length})`}
            </button>
            {historique && (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', marginTop: 6 }}>
                <thead><tr><th style={th}>Date</th><th style={th}>Matière</th><th style={th}>Lot en stock</th><th style={th}>Quantité</th><th style={th}>Commande</th><th style={th}>Par</th></tr></thead>
                <tbody>{transferts.map(t => (
                  <tr key={t.id}>
                    <td style={td}>{fmtDate(t.at)}</td><td style={td}>{t.code} — {t.designation}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{t.numero_lot_stock}</td>
                    <td style={td}>{fmtKg(t.qte)} kg</td><td style={td}>{t.numero_commande || '—'}</td><td style={td}>{t.par_nom || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}
      </>)}
    </div>
  );
}
