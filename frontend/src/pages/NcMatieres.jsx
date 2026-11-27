// NAIdo - Non-conformités matières (réception) : zone commune affichée chez le QHSE, la direction, le magasin, l'atelier et les achats.
// Circuit : déclaration -> QHSE (valide / refuse) -> [direction] -> magasin (retour fournisseur) -> clôture QHSE.
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import { confirmer, saisir } from '../utils/confirmer.jsx';
import { ouvrirPdfSecurise } from '../utils/pdf';

const API = '/api';
const R_QHSE = ['qhse', 'responsable_qhse', 'qualite', 'super_admin'];
const R_DIRECTION = ['directeur', 'super_admin'];
const R_MAGASIN = ['magasinier', 'magasinier_at3', 'magasinier_central', 'magasinier_mp', 'super_admin'];
const R_ATELIER = ['chef_atelier', 'super_admin'];
const R_ACHAT = ['achat', 'super_admin'];
const R_VOIT = [...new Set([...R_QHSE, ...R_DIRECTION, ...R_MAGASIN, ...R_ATELIER, ...R_ACHAT])];

const STATUTS = {
  declaree:          { l: 'En attente du QHSE',                 c: '#92400e', bg: '#fef3c7' },
  attente_direction: { l: 'En attente de la direction',         c: '#6d28d9', bg: '#ede9fe' },
  a_traiter_magasin: { l: 'À retourner au fournisseur',         c: '#b91c1c', bg: '#fee2e2' },
  retour_effectue:   { l: 'Retour effectué : à clôturer',       c: '#0369a1', bg: '#e0f2fe' },
  close:             { l: 'Clôturée',                           c: '#166534', bg: '#dcfce7' },
  annulee:           { l: 'Annulée (matière rendue utilisable)', c: '#4b5563', bg: '#f3f4f6' },
};
const fmtKg = (v) => (parseFloat(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const fmtDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function Declaration({ onFini }) {
  const [mps, setMps] = useState([]);
  const [art, setArt] = useState('');
  const [lots, setLots] = useState([]);
  const [lot, setLot] = useState('');
  const [qte, setQte] = useState('');
  const [motif, setMotif] = useState('');
  const [cmd, setCmd] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { axios.get(`${API}/dbm/stock-mp/liste`).then(r => setMps(Array.isArray(r.data) ? r.data : [])).catch(() => setMps([])); }, []);
  useEffect(() => {
    setLot(''); setLots([]);
    if (art) axios.get(`${API}/dbm/lots/${art}`).then(r => setLots(Array.isArray(r.data) ? r.data : [])).catch(() => setLots([]));
  }, [art]);

  const lotSel = lots.find(x => x.numero_lot === lot);
  const q = parseFloat(qte) || 0;
  const erreur = lotSel && q > parseFloat(lotSel.qte_disponible || 0) + 1e-6 ? `Supérieur au stock du lot : maximum ${fmtKg(lotSel.qte_disponible)} kg` : null;

  const envoyer = async () => {
    if (!art) return toast.error('Choisissez la matière');
    if (!lot) return toast.error('Choisissez le lot');
    if (!(q > 0)) return toast.error('Indiquez la quantité non conforme');
    if (erreur) return toast.error(erreur);
    if (!motif.trim()) return toast.error('Le motif est obligatoire');
    setEnvoi(true);
    try {
      const { data } = await axios.post(`${API}/nc-matiere`, { article_id: art, numero_lot: lot, qte_nc: q, motif, numero_commande: cmd || undefined, fournisseur_nom: lotSel?.fournisseur_nom });
      toast.success(`Non-conformité ${data.numero_nc} envoyée au QHSE`);
      onFini(true);
    } catch (e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setEnvoi(false);
  };
  const champ = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
  const lbl = { fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 };
  return (
    <div style={{ background: '#fff', border: '2px solid #fca5a5', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ fontWeight: 800, color: '#b91c1c', marginBottom: 8 }}>Déclarer une non-conformité (réception fournisseur)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        <div><label style={lbl}>Matière</label>
          <select value={art} onChange={e => setArt(e.target.value)} style={champ}>
            <option value="">-- Choisir --</option>
            {mps.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
          </select></div>
        <div><label style={lbl}>Lot</label>
          <select value={lot} onChange={e => setLot(e.target.value)} style={champ} disabled={!art}>
            <option value="">-- Choisir --</option>
            {lots.map(l => <option key={l.id} value={l.numero_lot}>{l.numero_lot} ({fmtKg(l.qte_disponible)} kg){l.fournisseur_nom ? ' · ' + l.fournisseur_nom : ''}</option>)}
          </select></div>
        <div><label style={lbl}>Quantité non conforme (kg)</label>
          <input type="number" min="0" step="0.1" value={qte} onChange={e => setQte(e.target.value)} style={{ ...champ, border: erreur ? '2px solid #dc2626' : champ.border }} />
          {erreur && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, marginTop: 3 }}>⚠ {erreur}</div>}</div>
        <div><label style={lbl}>N° de commande (facultatif)</label>
          <input value={cmd} onChange={e => setCmd(e.target.value)} style={champ} placeholder="CMD-2026-..." /></div>
      </div>
      <div style={{ marginTop: 10 }}><label style={lbl}>Motif de la non-conformité (obligatoire)</label>
        <textarea rows={2} value={motif} onChange={e => setMotif(e.target.value)} style={{ ...champ, resize: 'vertical' }} placeholder="Ex. : sac déchiré, humidité, mauvaise référence..." /></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={envoyer} disabled={envoi} style={{ background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>{envoi ? '...' : 'Envoyer au QHSE'}</button>
        <button onClick={() => onFini(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Annuler</button>
      </div>
    </div>
  );
}

export default function NcMatieresPanel() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const [liste, setListe] = useState([]);
  const [historique, setHistorique] = useState(false);
  const [decl, setDecl] = useState(false);

  const charger = useCallback(() => {
    if (!R_VOIT.includes(role)) return;
    axios.get(`${API}/nc-matiere`).then(r => setListe(Array.isArray(r.data) ? r.data : [])).catch(() => setListe([]));
  }, [role]);
  useEffect(() => { charger(); }, [charger]);

  if (!R_VOIT.includes(role)) return null;
  const estQhse = R_QHSE.includes(role), estDir = R_DIRECTION.includes(role), estMag = R_MAGASIN.includes(role);
  const estAtelier = R_ATELIER.includes(role), estAchat = R_ACHAT.includes(role);

  const agir = async (id, chemin, corps, message) => {
    try { await axios.put(`${API}/nc-matiere/${id}/${chemin}`, corps || {}); toast.success(message); charger(); }
    catch (e) { toast.error(e.response?.data?.error || 'Erreur'); }
  };
  const refuser = async (nc, chemin) => {
    const motif = await saisir(`Motif du refus de ${nc.numero_nc} (la matière redevient utilisable) :`, '');
    if (!motif || !motif.trim()) return toast.error('Le motif du refus est obligatoire');
    agir(nc.id, chemin, { decision: 'refuser', motif }, 'Non-conformité refusée : matière rendue utilisable');
  };
  const retour = async (nc) => {
    const ref = await saisir(`Retour fournisseur de ${fmtKg(nc.qte_nc)} kg (${nc.code}) : référence ou commentaire (facultatif) :`, '');
    if (ref === null || ref === undefined) return;
    agir(nc.id, 'retour', { commentaire: ref }, 'Retour fournisseur enregistré');
  };
  const clore = async (nc) => { if (await confirmer(`Clôturer ${nc.numero_nc} ?`)) agir(nc.id, 'clore', {}, 'Non-conformité clôturée'); };

  const actives = liste.filter(n => !['close', 'annulee'].includes(n.statut));
  const terminees = liste.filter(n => ['close', 'annulee'].includes(n.statut));
  const affichees = historique ? [...actives, ...terminees] : actives;
  if (!affichees.length && !estMag && !terminees.length) return null;

  const btn = (couleur) => ({ background: couleur, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 });

  return (
    <div style={{ background: '#fff7ed', border: '2px solid #fdba74', borderRadius: 12, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, color: '#9a3412' }}>⚠ Non-conformités matières {actives.length > 0 && `(${actives.length} en cours)`}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {estMag && <button onClick={() => setDecl(v => !v)} style={btn('#b91c1c')}>+ Déclarer (réception fournisseur)</button>}
          {terminees.length > 0 && <button onClick={() => setHistorique(v => !v)} style={{ background: '#fff', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>{historique ? 'Masquer l\'historique' : `Historique (${terminees.length})`}</button>}
        </div>
      </div>
      {decl && <Declaration onFini={(ok) => { setDecl(false); if (ok) charger(); }} />}
      {!affichees.length && <div style={{ fontSize: 12, color: '#9a3412' }}>Aucune non-conformité en cours.</div>}
      {affichees.map(nc => {
        const s = STATUTS[nc.statut] || { l: nc.statut, c: '#374151', bg: '#f3f4f6' };
        const decisionVue = nc.qhse_decision && (estAtelier || estAchat);
        return (
          <div key={nc.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #fed7aa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#374151', minWidth: 0, flex: '1 1 320px' }}>
                <div>
                  <b style={{ fontFamily: 'monospace', color: '#9a3412' }}>{nc.numero_nc}</b>{' '}
                  <span style={{ background: s.bg, color: s.c, borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{s.l}</span>
                </div>
                <div style={{ marginTop: 3 }}><b>{nc.code}</b> — {nc.designation} · lot {nc.numero_lot || '—'} · <b style={{ color: '#dc2626' }}>{fmtKg(nc.qte_nc)} kg non conformes</b></div>
                <div style={{ color: '#92400e' }}>Motif : {nc.motif}</div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>
                  {nc.origine === 'dbm' ? `Réception atelier · DBM ${nc.numero_dbm || ''}${nc.numero_of ? ' · OF ' + nc.numero_of : ''}` : `Réception fournisseur${nc.fournisseur_nom ? ' · ' + nc.fournisseur_nom : ''}${nc.numero_commande ? ' · ' + nc.numero_commande : ''}`}
                  {' · déclarée par '}{nc.declarant_nom || '—'} le {fmtDate(nc.declare_at)}
                </div>
                {nc.qhse_decision && <div style={{ color: '#6b7280', fontSize: 11 }}>QHSE : {nc.qhse_decision === 'refusee' ? 'refusée' : nc.qhse_decision === 'transmise_direction' ? 'validée et transmise à la direction' : 'validée'}{nc.qhse_motif ? ` (${nc.qhse_motif})` : ''} — {nc.qhse_nom || ''} le {fmtDate(nc.qhse_at)}</div>}
                {nc.direction_decision && <div style={{ color: '#6b7280', fontSize: 11 }}>Direction : {nc.direction_decision === 'refusee' ? 'refusée' : 'validée'}{nc.direction_motif ? ` (${nc.direction_motif})` : ''} — {nc.direction_nom || ''} le {fmtDate(nc.direction_at)}</div>}
                {nc.retour_at && <div style={{ color: '#6b7280', fontSize: 11 }}>Retour fournisseur effectué le {fmtDate(nc.retour_at)}{nc.magasin_nom ? ' par ' + nc.magasin_nom : ''}{nc.retour_ref ? ` (${nc.retour_ref})` : ''}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {estQhse && nc.statut === 'declaree' && (<>
                  <button style={btn('#15803d')} onClick={() => agir(nc.id, 'qhse', { decision: 'valider' }, 'NC validée : envoyée au magasin')}>✓ Valider → magasin</button>
                  <button style={btn('#6d28d9')} onClick={() => agir(nc.id, 'qhse', { decision: 'valider', vers_direction: true }, 'NC validée : envoyée à la direction')}>↗ Valider → direction</button>
                  <button style={btn('#6b7280')} onClick={() => refuser(nc, 'qhse')}>✕ Refuser</button>
                </>)}
                {estDir && nc.statut === 'attente_direction' && (<>
                  <button style={btn('#15803d')} onClick={() => agir(nc.id, 'direction', { decision: 'valider' }, 'NC validée : envoyée au magasin')}>✓ Valider</button>
                  <button style={btn('#6b7280')} onClick={() => refuser(nc, 'direction')}>✕ Refuser</button>
                </>)}
                {estMag && nc.statut === 'a_traiter_magasin' && <button style={btn('#b91c1c')} onClick={() => retour(nc)}>↩ Retour fournisseur effectué</button>}
                {estQhse && nc.statut === 'retour_effectue' && <button style={btn('#0369a1')} onClick={() => clore(nc)}>✔ Clôturer</button>}
                {decisionVue && !(estAtelier ? nc.vu_atelier_at : nc.vu_achat_at) && nc.origine === (estAtelier ? 'dbm' : 'fournisseur') &&
                  <button style={btn('#15803d')} onClick={() => agir(nc.id, 'vu', { cote: estAchat && !estAtelier ? 'achat' : 'atelier' }, 'Pris en compte')}>✓ Vu</button>}
                <button style={{ ...btn('#fff'), color: '#9a3412', border: '1px solid #fdba74' }} onClick={() => ouvrirPdfSecurise(`/api/nc-matiere/${nc.id}/pdf?t=${Date.now()}`)}>🖨 PDF</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
