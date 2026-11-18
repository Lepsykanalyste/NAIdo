// ============================================================
// NAIdo — Ecrans Achats (v2)
// Fichier : frontend/src/pages/Achats.jsx
//   export default AchatsV2         Commandes d'achat + Demandes d'achat (onglets)
//   export DemandesAchatAtelier     Demandes d'achat vues par l'atelier
//   export ArticlesDivers           Articles divers (fournitures, pieces, ...)
//   export DashboardAchat           Tableau de bord achat (cartes cliquables)
//   export SectionStockBas          Articles sous stock mini (page Alertes)
// ============================================================
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import { ouvrirPdfSecurise } from '../utils/pdf';

const API = '/api';
const ROLES_DIRECTION = ['directeur', 'super_admin'];
const ROLES_ACHAT = ['achat', 'directeur', 'super_admin'];

const nb = v => parseFloat(v) || 0;
const fcfa = v => `${nb(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`;
const qte = v => nb(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const jour = d => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const msg = e => e?.response?.data?.error || e?.response?.data?.detail || 'Erreur';
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const STATUTS = {
  brouillon:           { label: 'Brouillon',            bg: '#f3f4f6', color: '#374151' },
  envoye:              { label: 'En attente direction', bg: '#fef3c7', color: '#92400e' },
  confirme:            { label: 'Confirmée',            bg: '#dbeafe', color: '#1d4ed8' },
  receptionne_partiel: { label: 'Réception partielle',  bg: '#ede9fe', color: '#6d28d9' },
  receptionne:         { label: 'Réceptionnée',         bg: '#dcfce7', color: '#15803d' },
  annule:              { label: 'Annulée',              bg: '#fee2e2', color: '#dc2626' },
  en_attente:          { label: 'En attente',           bg: '#fef3c7', color: '#92400e' },
  traite:              { label: 'Transformée en BC',    bg: '#dcfce7', color: '#15803d' },
};

const inputStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' };
const thStyle = { padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#6d28d9', borderBottom: '2px solid #ede9fe', whiteSpace: 'nowrap', fontSize: 12 };
const tdStyle = { padding: '9px 12px', fontSize: 13, borderBottom: '1px solid #f3f4f6' };

const Badge = ({ s }) => {
  const c = STATUTS[s] || { label: s, bg: '#f3f4f6', color: '#374151' };
  return <span style={{ background: c.bg, color: c.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.label}</span>;
};

const Btn = ({ onClick, bg = '#ede9fe', color = '#6d28d9', children, disabled, title, plein }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    style={{ background: plein ? color : bg, color: plein ? '#fff' : color, border: 'none', padding: plein ? '9px 18px' : '4px 9px', borderRadius: 7,
             cursor: disabled ? 'not-allowed' : 'pointer', fontSize: plein ? 13 : 11, fontWeight: 700, opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap' }}>
    {children}
  </button>
);

const Modal = ({ titre, onClose, largeur = 780, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
    <div style={{ background: '#fff', borderRadius: 14, width: largeur, maxWidth: '100%', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{titre}</div>
        <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  </div>
);

const Champ = ({ label, children, note }) => (
  <div>
    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3, color: '#374151' }}>{label}{note && <span style={{ color: '#9ca3af', fontWeight: 400 }}> {note}</span>}</label>
    {children}
  </div>
);

// ── Choix d'un article : liste complete au clic, filtre en tapant ─────────────
function ArticleChoix({ articles, valeur, onChoisir, placeholder = 'Cliquez ou tapez pour chercher...' }) {
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const choisi = valeur ? articles.find(a => a.id === valeur) : null;
  const q = texte.trim().toLowerCase();
  const liste = articles.filter(a => !q || (a.code || '').toLowerCase().includes(q) || (a.designation || '').toLowerCase().includes(q)).slice(0, 60);
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={choisi ? `${choisi.code} — ${choisi.designation}` : texte}
        placeholder={placeholder}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onChange={e => { setTexte(e.target.value); if (valeur) onChoisir(null); setOuvert(true); }}
        style={inputStyle} />
      {ouvert && !choisi && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: 220, overflow: 'auto' }}>
          {liste.map(a => (
            <div key={a.id} onMouseDown={() => { onChoisir(a); setTexte(''); }}
              style={{ padding: '7px 11px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onMouseOver={e => { e.currentTarget.style.background = '#f5f3ff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6d28d9' }}>{a.code}</span> — {a.designation}
            </div>
          ))}
          {liste.length === 0 && <div style={{ padding: '8px 11px', fontSize: 12, color: '#9ca3af' }}>Aucun résultat</div>}
        </div>
      )}
    </div>
  );
}

// ── Chargement partage des listes ─────────────────────────────────────────────
function useListes() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [articles, setArticles] = useState([]);
  useEffect(() => {
    axios.get(`${API}/achat/fournisseurs`).then(r => setFournisseurs(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    axios.get(`${API}/articles`).then(r => setArticles(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);
  return { fournisseurs, articles };
}

// ══════════════════════════════════════════════════════════════
// NOUVELLE COMMANDE
// ══════════════════════════════════════════════════════════════
function NouvelleCommande({ fournisseurs, articles, onClose, onCree }) {
  const [form, setForm] = useState({ fournisseur_id: '', date_commande: aujourdhui(), date_livraison_prevue: '', reference_fournisseur: '', notes: '', taux_tva: '19' });
  const [lignes, setLignes] = useState([{ article_id: '', designation: '', quantite_commandee: '1', prix_unitaire_ht: '' }]);
  const [envoi, setEnvoi] = useState(false);
  const majLigne = (i, patch) => setLignes(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const ht = lignes.reduce((s, l) => s + nb(l.quantite_commandee) * nb(l.prix_unitaire_ht), 0);
  const ttc = ht * (1 + nb(form.taux_tva) / 100);

  const creer = async () => {
    if (!form.fournisseur_id) return toast.error('Choisissez un fournisseur');
    const ok = lignes.filter(l => nb(l.quantite_commandee) > 0 && (l.article_id || l.designation.trim()));
    if (!ok.length) return toast.error('Ajoutez au moins un article avec une quantité');
    setEnvoi(true);
    try {
      await axios.post(`${API}/achat/commandes`, { ...form, lignes: ok.map(l => ({ ...l, taux_tva: form.taux_tva })) });
      toast.success('Bon de commande créé : en attente de validation de la direction');
      onCree();
    } catch (e) { toast.error(msg(e)); }
    setEnvoi(false);
  };

  return (
    <Modal titre="🛒 Nouvelle commande d'achat" onClose={onClose} largeur={860}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Champ label="Fournisseur *">
          <select value={form.fournisseur_id} onChange={e => setForm({ ...form, fournisseur_id: e.target.value })} style={inputStyle}>
            <option value="">-- Fournisseur --</option>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.raison_sociale}</option>)}
          </select>
        </Champ>
        <Champ label="Date commande"><input type="date" value={form.date_commande} onChange={e => setForm({ ...form, date_commande: e.target.value })} style={inputStyle} /></Champ>
        <Champ label="Livraison prévue"><input type="date" value={form.date_livraison_prevue} onChange={e => setForm({ ...form, date_livraison_prevue: e.target.value })} style={inputStyle} /></Champ>
        <Champ label="TVA %"><input type="number" value={form.taux_tva} onChange={e => setForm({ ...form, taux_tva: e.target.value })} style={inputStyle} /></Champ>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 14 }}>
        <Champ label="Réf. fournisseur"><input value={form.reference_fournisseur} onChange={e => setForm({ ...form, reference_fournisseur: e.target.value })} style={inputStyle} /></Champ>
        <Champ label="Notes"><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={inputStyle} /></Champ>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: 13 }}>Lignes de commande</span>
        <Btn plein onClick={() => setLignes([...lignes, { article_id: '', designation: '', quantite_commandee: '1', prix_unitaire_ht: '' }])}>+ Ajouter ligne</Btn>
      </div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <Champ label={i === 0 ? 'Article' : ''}>
            <ArticleChoix articles={articles} valeur={l.article_id}
              onChoisir={a => majLigne(i, a ? { article_id: a.id, designation: a.designation, prix_unitaire_ht: l.prix_unitaire_ht || String(a.prix_achat || '') } : { article_id: '', designation: '' })} />
          </Champ>
          <Champ label={i === 0 ? 'Quantité' : ''}><input type="number" value={l.quantite_commandee} onChange={e => majLigne(i, { quantite_commandee: e.target.value })} style={{ ...inputStyle, textAlign: 'center' }} /></Champ>
          <Champ label={i === 0 ? 'Prix HT' : ''}><input type="number" value={l.prix_unitaire_ht} onChange={e => majLigne(i, { prix_unitaire_ht: e.target.value })} style={{ ...inputStyle, textAlign: 'center' }} /></Champ>
          <Btn bg="#fee2e2" color="#dc2626" disabled={lignes.length === 1} onClick={() => setLignes(lignes.filter((_, k) => k !== i))}>✕</Btn>
        </div>
      ))}
      {lignes.some(l => !l.article_id) && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Une ligne sans article du catalogue doit avoir sa désignation saisie dans le champ.</div>}
      <div style={{ textAlign: 'right', fontSize: 13, margin: '10px 0' }}>
        <div>Total HT : <b>{fcfa(ht)}</b></div>
        <div style={{ fontSize: 15, color: '#6d28d9', fontWeight: 800 }}>Total TTC : {fcfa(ttc)}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn plein onClick={creer} disabled={envoi}>{envoi ? 'Création...' : '✓ Créer la commande'}</Btn>
        <Btn plein bg="#f3f4f6" color="#374151" onClick={onClose}>Annuler</Btn>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// DETAIL, RECEPTION, HISTORIQUE
// ══════════════════════════════════════════════════════════════
function DetailCommande({ id, role, onClose, onChange, onReceptionner, onHistorique }) {
  const [c, setC] = useState(null);
  const charger = () => axios.get(`${API}/achat/commandes/${id}`).then(r => setC(r.data)).catch(e => toast.error(msg(e)));
  useEffect(() => { charger(); }, [id]);
  const statut = async s => {
    try { await axios.put(`${API}/achat/commandes/${id}/statut`, { statut: s }); toast.success('Statut mis à jour'); await charger(); onChange(); }
    catch (e) { toast.error(msg(e)); }
  };
  if (!c) return <Modal titre="Commande" onClose={onClose}><div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div></Modal>;
  const direction = ROLES_DIRECTION.includes(role), achat = ROLES_ACHAT.includes(role);
  return (
    <Modal titre={`📋 ${c.numero_commande || 'Commande'}`} onClose={onClose} largeur={860}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        {[['Fournisseur', c.raison_sociale || '—'], ['Date', jour(c.date_commande)], ['Livraison prévue', jour(c.date_livraison_prevue)], ['Réf. fournisseur', c.reference_fournisseur || '—']].map(([l, v]) => (
          <div key={l} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{v}</div></div>
        ))}
      </div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge s={c.statut} />
        {c.confirme_at && <span style={{ fontSize: 12, color: '#15803d' }}>✓ Validée par la direction le {jour(c.confirme_at)}</span>}
        {c.statut === 'envoye' && <span style={{ fontSize: 12, color: '#92400e' }}>En attente de validation de la direction</span>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead><tr>{['Article', 'Désignation', 'Commandé', 'Reçu', 'Reste', 'Prix HT', 'Total HT'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
        <tbody>
          {(c.lignes || []).map(l => {
            const reste = Math.max(0, nb(l.quantite_commandee) - nb(l.quantite_recue));
            return (
              <tr key={l.id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{l.article_code || '—'}</td>
                <td style={tdStyle}>{l.designation}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{qte(l.quantite_commandee)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{qte(l.quantite_recue)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: reste > 0 ? '#d97706' : '#15803d', fontWeight: 700 }}>{qte(reste)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fcfa(l.prix_unitaire_ht)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fcfa(l.montant_ht)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ textAlign: 'right', fontSize: 13, marginBottom: 12 }}>
        <div>HT : <b>{fcfa(c.montant_ht)}</b> · TVA : <b>{fcfa(c.montant_tva)}</b></div>
        <div style={{ fontSize: 15, color: '#6d28d9', fontWeight: 800 }}>TTC : {fcfa(c.montant_ttc)}</div>
      </div>
      {c.notes && <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginBottom: 12 }}><b>Notes :</b> {c.notes}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn plein onClick={() => ouvrirPdfSecurise(`${API}/achat/commandes/${id}/pdf`)}>📄 PDF</Btn>
        {c.statut === 'envoye' && direction && <Btn plein color="#15803d" onClick={() => statut('confirme')}>✓ Confirmer (direction)</Btn>}
        {['envoye', 'confirme', 'brouillon'].includes(c.statut) && achat && <Btn plein bg="#fee2e2" color="#dc2626" onClick={() => { if (window.confirm('Annuler cette commande ?')) statut('annule'); }}>Annuler la commande</Btn>}
        {['confirme', 'receptionne_partiel'].includes(c.statut) && achat && <Btn plein color="#0369a1" onClick={() => onReceptionner(c)}>📥 Réceptionner</Btn>}
        {['receptionne_partiel', 'receptionne'].includes(c.statut) && <Btn plein bg="#f3f4f6" color="#374151" onClick={() => onHistorique(c)}>📋 Historique des réceptions</Btn>}
      </div>
    </Modal>
  );
}

function Reception({ commande, onClose, onFait }) {
  const [c, setC] = useState(null);
  const [date, setDate] = useState(aujourdhui());
  const [bl, setBl] = useState('');
  const [notes, setNotes] = useState('');
  const [saisie, setSaisie] = useState({});
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    axios.get(`${API}/achat/commandes/${commande.id}`).then(r => {
      setC(r.data);
      const s = {};
      (r.data.lignes || []).forEach(l => { s[l.id] = { q: String(Math.max(0, nb(l.quantite_commandee) - nb(l.quantite_recue))), prix: String(l.prix_unitaire_ht ?? '') }; });
      setSaisie(s);
    }).catch(e => toast.error(msg(e)));
  }, [commande.id]);
  if (!c) return <Modal titre="Réception" onClose={onClose} largeur={860}><div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div></Modal>;

  const valider = async () => {
    const lignes = (c.lignes || []).filter(l => nb(saisie[l.id]?.q) > 0).map(l => ({ ligne_id: l.id, quantite_recue: nb(saisie[l.id].q), prix_unitaire_ht: nb(saisie[l.id].prix) }));
    if (!lignes.length) return toast.error('Saisissez au moins une quantité reçue');
    setEnvoi(true);
    try {
      const { data } = await axios.put(`${API}/achat/commandes/${c.id}/receptionner`, { date_reception: date, reference_bl: bl, notes, lignes });
      toast.success(data.message || 'Réception enregistrée');
      if (data.plafonnees?.length) toast(`Quantité limitée au reste à recevoir : ${data.plafonnees.join(', ')}`, { icon: '⚠️' });
      if (data.stock_non_mis_a_jour?.length) toast.error(`Stock non mis à jour (aucun emplacement) : ${data.stock_non_mis_a_jour.join(', ')}`);
      if (data.reception_id) ouvrirPdfSecurise(`${API}/achat/receptions/${data.reception_id}/pdf`);
      onFait();
    } catch (e) { toast.error(msg(e)); }
    setEnvoi(false);
  };

  return (
    <Modal titre={`📥 Réception — ${c.numero_commande}`} onClose={onClose} largeur={900}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 14 }}>
        <Champ label="Date de réception"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></Champ>
        <Champ label="N° bon de livraison"><input value={bl} onChange={e => setBl(e.target.value)} style={inputStyle} /></Champ>
        <Champ label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} /></Champ>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead><tr>{['Article', 'Commandé', 'Déjà reçu', 'Reste', 'À recevoir', 'Prix réel HT'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
        <tbody>
          {(c.lignes || []).map(l => {
            const reste = Math.max(0, nb(l.quantite_commandee) - nb(l.quantite_recue));
            return (
              <tr key={l.id} style={{ opacity: reste <= 0 ? 0.5 : 1 }}>
                <td style={tdStyle}><b>{l.article_code || ''}</b> {l.designation}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{qte(l.quantite_commandee)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{qte(l.quantite_recue)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#d97706' }}>{qte(reste)}</td>
                <td style={tdStyle}><input type="number" disabled={reste <= 0} value={saisie[l.id]?.q ?? ''} onChange={e => setSaisie({ ...saisie, [l.id]: { ...saisie[l.id], q: e.target.value } })} style={{ ...inputStyle, width: 110, textAlign: 'center' }} /></td>
                <td style={tdStyle}><input type="number" disabled={reste <= 0} value={saisie[l.id]?.prix ?? ''} onChange={e => setSaisie({ ...saisie, [l.id]: { ...saisie[l.id], prix: e.target.value } })} style={{ ...inputStyle, width: 120, textAlign: 'center' }} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>Une quantité supérieure au reste à recevoir est automatiquement limitée. Le stock est mis à jour à la validation.</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn plein color="#0369a1" onClick={valider} disabled={envoi}>{envoi ? 'Enregistrement...' : '✓ Valider la réception'}</Btn>
        <Btn plein bg="#f3f4f6" color="#374151" onClick={onClose}>Annuler</Btn>
      </div>
    </Modal>
  );
}

function Historique({ commande, onClose }) {
  const [recs, setRecs] = useState(null);
  useEffect(() => { axios.get(`${API}/achat/commandes/${commande.id}/receptions`).then(r => setRecs(r.data)).catch(e => { toast.error(msg(e)); setRecs([]); }); }, [commande.id]);
  return (
    <Modal titre={`📋 Réceptions — ${commande.numero_commande}`} onClose={onClose} largeur={760}>
      {recs === null && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div>}
      {recs && recs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Aucune réception enregistrée</div>}
      {recs && recs.map(r => (
        <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div><b style={{ fontFamily: 'monospace', color: '#6d28d9' }}>{r.numero_reception}</b> <span style={{ fontSize: 12, color: '#6b7280' }}>· {jour(r.date_reception)} · BL : {r.reference_bl || '—'} · {r.cree_par_nom || ''}</span></div>
            <Btn onClick={() => ouvrirPdfSecurise(`${API}/achat/receptions/${r.id}/pdf`)}>📄 PDF</Btn>
          </div>
          {(r.lignes || []).map(l => <div key={l.id} style={{ fontSize: 12 }}>{l.article_code || ''} {l.designation} : <b>{qte(l.quantite_recue)}</b> à {fcfa(l.prix_unitaire_ht)}</div>)}
          {r.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{r.notes}</div>}
        </div>
      ))}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// DEMANDES D'ACHAT
// ══════════════════════════════════════════════════════════════
function NouvelleDemande({ articles, onClose, onCree }) {
  const [lignes, setLignes] = useState([{ article_id: '', designation: '', quantite_demandee: '1' }]);
  const [notes, setNotes] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const maj = (i, patch) => setLignes(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const envoyer = async () => {
    const ok = lignes.filter(l => nb(l.quantite_demandee) > 0 && (l.article_id || l.designation.trim()));
    if (!ok.length) return toast.error('Ajoutez au moins un article avec une quantité');
    setEnvoi(true);
    try { await axios.post(`${API}/achat/demandes`, { notes, lignes: ok }); toast.success("Demande d'achat envoyée au service achat"); onCree(); }
    catch (e) { toast.error(msg(e)); }
    setEnvoi(false);
  };
  return (
    <Modal titre="📝 Nouvelle demande d'achat" onClose={onClose} largeur={760}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Indiquez ce dont vous avez besoin. Le service achat choisira le fournisseur et le prix.</div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <Champ label={i === 0 ? 'Article du catalogue (ou saisissez un libellé libre)' : ''}>
            <div>
              <ArticleChoix articles={articles} valeur={l.article_id} onChoisir={a => maj(i, a ? { article_id: a.id, designation: a.designation } : { article_id: '', designation: '' })} />
              {!l.article_id && <input placeholder="Libellé libre si l'article n'est pas au catalogue" value={l.designation} onChange={e => maj(i, { designation: e.target.value })} style={{ ...inputStyle, marginTop: 4, fontSize: 12 }} />}
            </div>
          </Champ>
          <Champ label={i === 0 ? 'Quantité' : ''}><input type="number" value={l.quantite_demandee} onChange={e => maj(i, { quantite_demandee: e.target.value })} style={{ ...inputStyle, textAlign: 'center' }} /></Champ>
          <Btn bg="#fee2e2" color="#dc2626" disabled={lignes.length === 1} onClick={() => setLignes(lignes.filter((_, k) => k !== i))}>✕</Btn>
        </div>
      ))}
      <div style={{ marginBottom: 12 }}><Btn onClick={() => setLignes([...lignes, { article_id: '', designation: '', quantite_demandee: '1' }])}>+ Ajouter un article</Btn></div>
      <Champ label="Motif / notes"><input value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} /></Champ>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Btn plein onClick={envoyer} disabled={envoi}>{envoi ? 'Envoi...' : '✓ Envoyer la demande'}</Btn>
        <Btn plein bg="#f3f4f6" color="#374151" onClick={onClose}>Annuler</Btn>
      </div>
    </Modal>
  );
}

function Transformer({ id, fournisseurs, articles, onClose, onFait }) {
  const [d, setD] = useState(null);
  const [fournisseur, setFournisseur] = useState('');
  const [livraison, setLivraison] = useState('');
  const [tva, setTva] = useState('19');
  const [lignes, setLignes] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    axios.get(`${API}/achat/demandes/${id}`).then(r => {
      setD(r.data);
      setLignes((r.data.lignes || []).map(l => ({ article_id: l.article_id || '', designation: l.designation || '', quantite_commandee: String(l.quantite_demandee), prix_unitaire_ht: l.prix_achat ? String(l.prix_achat) : '' })));
    }).catch(e => toast.error(msg(e)));
  }, [id]);
  if (!d) return <Modal titre="Demande d'achat" onClose={onClose}><div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div></Modal>;
  const ht = lignes.reduce((s, l) => s + nb(l.quantite_commandee) * nb(l.prix_unitaire_ht), 0);
  const maj = (i, patch) => setLignes(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const nomArticle = l => { const a = articles.find(x => x.id === l.article_id); return a ? `${a.code} — ${a.designation}` : l.designation; };
  const valider = async () => {
    if (!fournisseur) return toast.error('Choisissez un fournisseur');
    setEnvoi(true);
    try {
      await axios.post(`${API}/achat/demandes/${id}/transformer`, { fournisseur_id: fournisseur, date_livraison_prevue: livraison || null, taux_tva: tva, lignes });
      toast.success('Bon de commande créé : en attente de validation de la direction');
      onFait();
    } catch (e) { toast.error(msg(e)); }
    setEnvoi(false);
  };
  return (
    <Modal titre={`🔁 ${d.numero_demande} → bon de commande`} onClose={onClose} largeur={860}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Demandeur : <b>{d.demandeur_nom || '—'}</b>{d.notes ? ` · ${d.notes}` : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Champ label="Fournisseur *">
          <select value={fournisseur} onChange={e => setFournisseur(e.target.value)} style={inputStyle}>
            <option value="">-- Fournisseur --</option>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.raison_sociale}</option>)}
          </select>
        </Champ>
        <Champ label="Livraison prévue"><input type="date" value={livraison} onChange={e => setLivraison(e.target.value)} style={inputStyle} /></Champ>
        <Champ label="TVA %"><input type="number" value={tva} onChange={e => setTva(e.target.value)} style={inputStyle} /></Champ>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr>{['Article', 'Quantité', 'Prix HT', 'Total HT'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td style={tdStyle}>{nomArticle(l)}</td>
              <td style={tdStyle}><input type="number" value={l.quantite_commandee} onChange={e => maj(i, { quantite_commandee: e.target.value })} style={{ ...inputStyle, width: 110, textAlign: 'center' }} /></td>
              <td style={tdStyle}><input type="number" value={l.prix_unitaire_ht} onChange={e => maj(i, { prix_unitaire_ht: e.target.value })} style={{ ...inputStyle, width: 120, textAlign: 'center' }} /></td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fcfa(nb(l.quantite_commandee) * nb(l.prix_unitaire_ht))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'right', fontSize: 15, color: '#6d28d9', fontWeight: 800, marginBottom: 12 }}>Total TTC : {fcfa(ht * (1 + nb(tva) / 100))}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Btn plein onClick={valider} disabled={envoi}>{envoi ? 'Création...' : '✓ Créer le bon de commande'}</Btn>
        <Btn plein bg="#f3f4f6" color="#374151" onClick={onClose}>Annuler</Btn>
      </div>
    </Modal>
  );
}

function PanneauDemandes({ peutTransformer, onBonCree }) {
  const { fournisseurs, articles } = useListes();
  const [demandes, setDemandes] = useState([]);
  const [filtre, setFiltre] = useState('en_attente');
  const [nouvelle, setNouvelle] = useState(false);
  const [aTransformer, setATransformer] = useState(null);
  const [vue, setVue] = useState(null);
  const charger = () => axios.get(`${API}/achat/demandes${filtre ? `?statut=${filtre}` : ''}`).then(r => setDemandes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { charger(); }, [filtre]);
  const annuler = async d => {
    if (!window.confirm(`Annuler la demande ${d.numero_demande} ?`)) return;
    try { await axios.put(`${API}/achat/demandes/${d.id}/annuler`); toast.success('Demande annulée'); charger(); } catch (e) { toast.error(msg(e)); }
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['', 'Toutes'], ['en_attente', 'En attente'], ['traite', 'Transformées'], ['annule', 'Annulées']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltre(v)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: filtre === v ? '#6d28d9' : '#f3f4f6', color: filtre === v ? '#fff' : '#374151' }}>{l}</button>
          ))}
        </div>
        <Btn plein onClick={() => setNouvelle(true)}>+ Nouvelle demande</Btn>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['N° demande', 'Demandeur', 'Date', 'Articles', 'Statut', 'Bon de commande', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {demandes.map(d => (
              <tr key={d.id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: '#6d28d9' }}>{d.numero_demande}</td>
                <td style={tdStyle}>{d.demandeur_nom || '—'}</td>
                <td style={tdStyle}>{jour(d.created_at)}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{d.nb_lignes}</td>
                <td style={tdStyle}><Badge s={d.statut} /></td>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{d.numero_commande || '—'}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Btn onClick={() => setVue(d.id)}>👁 Voir</Btn>
                    {d.statut === 'en_attente' && peutTransformer && <Btn bg="#dcfce7" color="#15803d" onClick={() => setATransformer(d.id)}>🔁 Transformer en BC</Btn>}
                    {d.statut === 'en_attente' && <Btn bg="#fee2e2" color="#dc2626" onClick={() => annuler(d)}>Annuler</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {demandes.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af' }}>Aucune demande d'achat</div>}
      </div>
      {nouvelle && <NouvelleDemande articles={articles} onClose={() => setNouvelle(false)} onCree={() => { setNouvelle(false); charger(); }} />}
      {aTransformer && <Transformer id={aTransformer} fournisseurs={fournisseurs} articles={articles} onClose={() => setATransformer(null)} onFait={() => { setATransformer(null); charger(); if (onBonCree) onBonCree(); }} />}
      {vue && <DetailDemande id={vue} onClose={() => setVue(null)} />}
    </div>
  );
}

function DetailDemande({ id, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { axios.get(`${API}/achat/demandes/${id}`).then(r => setD(r.data)).catch(e => toast.error(msg(e))); }, [id]);
  return (
    <Modal titre={d ? `📝 ${d.numero_demande}` : 'Demande'} onClose={onClose} largeur={640}>
      {!d ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div> : (
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Demandeur : <b>{d.demandeur_nom || '—'}</b> · {jour(d.created_at)} · <Badge s={d.statut} /></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Article', 'Quantité demandée'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{(d.lignes || []).map(l => <tr key={l.id}><td style={tdStyle}><b>{l.article_code || ''}</b> {l.designation}</td><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{qte(l.quantite_demandee)}</td></tr>)}</tbody>
          </table>
          {d.notes && <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginTop: 10 }}><b>Notes :</b> {d.notes}</div>}
        </div>
      )}
    </Modal>
  );
}

export function DemandesAchatAtelier() {
  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>📝 Demandes d'achat</h3>
      <PanneauDemandes peutTransformer={false} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMMANDES D'ACHAT (page principale)
// ══════════════════════════════════════════════════════════════
export default function AchatsV2() {
  const { user } = useAuth();
  const role = user?.role;
  const direction = ROLES_DIRECTION.includes(role), achat = ROLES_ACHAT.includes(role);
  const { fournisseurs, articles } = useListes();
  const [onglet, setOnglet] = useState('commandes');
  const [commandes, setCommandes] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [nouvelle, setNouvelle] = useState(false);
  const [detail, setDetail] = useState(null);
  const [recep, setRecep] = useState(null);
  const [histo, setHisto] = useState(null);
  const [rafraichir, setRafraichir] = useState(0);

  const charger = () => axios.get(`${API}/achat/commandes${filtre ? `?statut=${filtre}` : ''}`).then(r => setCommandes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { charger(); }, [filtre, rafraichir]);
  const recharger = () => setRafraichir(n => n + 1);

  const statut = async (c, s, question) => {
    if (question && !window.confirm(question)) return;
    try { await axios.put(`${API}/achat/commandes/${c.id}/statut`, { statut: s }); toast.success('Statut mis à jour'); recharger(); }
    catch (e) { toast.error(msg(e)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['commandes', '🛒 Commandes'], ['demandes', "📝 Demandes d'achat"]].map(([v, l]) => (
          <button key={v} onClick={() => setOnglet(v)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: onglet === v ? '#6d28d9' : '#f3f4f6', color: onglet === v ? '#fff' : '#374151' }}>{l}</button>
        ))}
      </div>

      {onglet === 'demandes' && <PanneauDemandes peutTransformer={achat} onBonCree={recharger} />}

      {onglet === 'commandes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['', 'Tous'], ['envoye', 'En attente direction'], ['confirme', 'Confirmées'], ['receptionne_partiel', 'Réception partielle'], ['receptionne', 'Réceptionnées'], ['annule', 'Annulées']].map(([v, l]) => (
                <button key={v} onClick={() => setFiltre(v)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: filtre === v ? '#6d28d9' : '#f3f4f6', color: filtre === v ? '#fff' : '#374151' }}>{l}</button>
              ))}
            </div>
            {achat && <Btn plein onClick={() => setNouvelle(true)}>+ Nouvelle commande</Btn>}
          </div>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['N° commande', 'Fournisseur', 'Date', 'Livraison', 'Montant TTC', 'Statut', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {commandes.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: '#6d28d9' }}>{c.numero_commande}</td>
                    <td style={tdStyle}>{c.fournisseur_nom || '—'}</td>
                    <td style={tdStyle}>{jour(c.date_commande)}</td>
                    <td style={tdStyle}>{jour(c.date_livraison_prevue)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fcfa(c.montant_ttc)}</td>
                    <td style={tdStyle}><Badge s={c.statut} /></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <Btn onClick={() => setDetail(c.id)}>👁 Voir</Btn>
                        <Btn bg="#f3f4f6" color="#374151" onClick={() => ouvrirPdfSecurise(`${API}/achat/commandes/${c.id}/pdf`)}>📄 PDF</Btn>
                        {c.statut === 'envoye' && direction && <Btn bg="#dcfce7" color="#15803d" onClick={() => statut(c, 'confirme')}>✓ Confirmer</Btn>}
                        {c.statut === 'envoye' && !direction && <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', alignSelf: 'center' }}>Validation direction</span>}
                        {['confirme', 'receptionne_partiel'].includes(c.statut) && achat && <Btn bg="#e0f2fe" color="#0369a1" onClick={() => setRecep(c)}>📥 Réceptionner</Btn>}
                        {['receptionne_partiel', 'receptionne'].includes(c.statut) && <Btn bg="#f3f4f6" color="#374151" onClick={() => setHisto(c)}>📋 Historique</Btn>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {commandes.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Aucune commande</div>}
          </div>
        </div>
      )}

      {nouvelle && <NouvelleCommande fournisseurs={fournisseurs} articles={articles} onClose={() => setNouvelle(false)} onCree={() => { setNouvelle(false); recharger(); }} />}
      {detail && <DetailCommande id={detail} role={role} onClose={() => setDetail(null)} onChange={recharger}
        onReceptionner={c => { setDetail(null); setRecep(c); }} onHistorique={c => { setDetail(null); setHisto(c); }} />}
      {recep && <Reception commande={recep} onClose={() => setRecep(null)} onFait={() => { setRecep(null); recharger(); }} />}
      {histo && <Historique commande={histo} onClose={() => setHisto(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ARTICLES DIVERS
// ══════════════════════════════════════════════════════════════
const FORM_VIDE = { code: '', designation: '', fournisseur: '', reference_fournisseur: '', famille_id: '', unite_mesure_id: '', prix_achat: '', stock_mini: '', stock_maxi: '', notes: '' };

const ChampFichier = ({ label, icone, accept, fichier, onFichier }) => (
  <div>
    <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>{icone} {label}</label>
    <label style={{ display: 'block', border: `2px dashed ${fichier ? '#16a34a' : '#d1d5db'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', background: fichier ? '#f0fdf4' : '#fafafa', fontSize: 12, color: fichier ? '#15803d' : '#6b7280', textAlign: 'center' }}>
      {fichier ? `✓ ${fichier.name}` : `Cliquez pour choisir (${accept})`}
      <input type="file" accept={accept} style={{ display: 'none' }} onChange={e => onFichier(e.target.files[0] || null)} />
    </label>
  </div>
);

export function ArticlesDivers() {
  const [items, setItems] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [unites, setUnites] = useState([]);
  const [prixMoyens, setPrixMoyens] = useState({});
  const [recherche, setRecherche] = useState('');
  const [form, setForm] = useState(null);       // null = formulaire ferme
  const [editId, setEditId] = useState(null);
  const [fichiers, setFichiers] = useState({ fiche_technique: null, fiche_securite: null, photo: null });
  const [voir, setVoir] = useState(null);
  const [nouvelleFamille, setNouvelleFamille] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    const [a, f, fam, u, pm] = await Promise.all([
      axios.get(`${API}/articles`, { params: { type_article: 'article_divers' } }).catch(() => ({ data: [] })),
      axios.get(`${API}/achat/fournisseurs`).catch(() => ({ data: [] })),
      axios.get(`${API}/referentiels/familles`).catch(() => ({ data: [] })),
      axios.get(`${API}/referentiels/unites`).catch(() => ({ data: [] })),
      axios.get(`${API}/achat/articles-prix-moyen`).catch(() => ({ data: [] })),
    ]);
    setItems(Array.isArray(a.data) ? a.data : []);
    setFournisseurs(Array.isArray(f.data) ? f.data : []);
    setFamilles(Array.isArray(fam.data) ? fam.data : []);
    setUnites(Array.isArray(u.data) ? u.data : []);
    const m = {};
    (Array.isArray(pm.data) ? pm.data : []).forEach(p => { m[p.article_id] = { prix: nb(p.prix_moyen), nb: p.nb_receptions }; });
    setPrixMoyens(m);
  };
  useEffect(() => { charger(); }, []);

  const q = recherche.trim().toLowerCase();
  const visibles = items.filter(i => !q || (i.code || '').toLowerCase().includes(q) || (i.designation || '').toLowerCase().includes(q) || (i.fournisseur || '').toLowerCase().includes(q));

  const ouvrir = it => {
    setFichiers({ fiche_technique: null, fiche_securite: null, photo: null });
    if (it) {
      setEditId(it.id);
      setForm({ code: it.code, designation: it.designation, fournisseur: it.fournisseur || '', reference_fournisseur: it.reference_fournisseur || '',
        famille_id: it.famille_id ? String(it.famille_id) : '', unite_mesure_id: it.unite_mesure_id ? String(it.unite_mesure_id) : '',
        prix_achat: it.prix_achat ? String(it.prix_achat) : '', stock_mini: it.stock_mini ? String(it.stock_mini) : '', stock_maxi: it.stock_maxi ? String(it.stock_maxi) : '', notes: it.notes || '' });
    } else { setEditId(null); setForm({ ...FORM_VIDE }); }
  };

  const enregistrer = async () => {
    if (!form.code.trim() || !form.designation.trim()) return toast.error('Code et désignation obligatoires');
    setEnvoi(true);
    try {
      const payload = { ...form, type_article: 'article_divers', famille_id: form.famille_id || null, unite_mesure_id: form.unite_mesure_id || null,
        prix_achat: form.prix_achat || 0, stock_mini: form.stock_mini || 0, stock_maxi: form.stock_maxi || null };
      const r = editId ? await axios.put(`${API}/articles/${editId}`, payload) : await axios.post(`${API}/articles`, payload);
      const id = r.data?.id || editId;
      if (id && (fichiers.fiche_technique || fichiers.fiche_securite || fichiers.photo)) {
        const fd = new FormData();
        Object.entries(fichiers).forEach(([k, f]) => { if (f) fd.append(k, f); });
        try { await axios.post(`${API}/fichiers-article/${id}`, fd); }
        catch (e) { toast.error(`Article enregistré, mais fichier refusé : ${msg(e)}`); }
      }
      toast.success(editId ? 'Article modifié' : 'Article créé');
      setForm(null); charger();
    } catch (e) { toast.error(msg(e)); }
    setEnvoi(false);
  };

  const supprimer = async it => {
    if (!window.confirm(`Supprimer « ${it.designation} » ?`)) return;
    try { await axios.put(`${API}/articles/${it.id}`, { actif: false }); toast.success('Article supprimé'); charger(); } catch (e) { toast.error(msg(e)); }
  };

  const creerFamille = async () => {
    if (!nouvelleFamille.code.trim() || !nouvelleFamille.libelle.trim()) return toast.error('Code et libellé requis');
    try {
      const { data } = await axios.post(`${API}/referentiels/familles`, nouvelleFamille);
      toast.success('Famille créée');
      const fam = await axios.get(`${API}/referentiels/familles`);
      setFamilles(Array.isArray(fam.data) ? fam.data : []);
      setForm(f => ({ ...f, famille_id: String(data.id) }));
      setNouvelleFamille(null);
    } catch (e) { toast.error(msg(e)); }
  };

  const rouge = it => nb(it.stock_mini) > 0 && nb(it.stock_total) < nb(it.stock_mini);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Code, désignation, fournisseur..." value={recherche} onChange={e => setRecherche(e.target.value)} style={{ ...inputStyle, maxWidth: 340 }} />
        <Btn plein onClick={() => ouvrir(null)}>+ Nouvel article divers</Btn>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Code', 'Désignation', 'Fournisseur', 'Prix achat', 'Prix moyen', 'Stock actuel', 'Stock mini', 'Stock maxi', 'Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {visibles.map(it => (
              <tr key={it.id}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: '#6d28d9' }}>{it.code}</td>
                <td style={tdStyle}>{it.designation}</td>
                <td style={tdStyle}>{it.fournisseur || '—'}</td>
                <td style={tdStyle}>{nb(it.prix_achat) ? fcfa(it.prix_achat) : '—'}</td>
                <td style={tdStyle}>{prixMoyens[it.id] ? fcfa(prixMoyens[it.id].prix) : '—'}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: rouge(it) ? '#dc2626' : '#15803d' }}>{qte(it.stock_total)}</td>
                <td style={tdStyle}>{qte(it.stock_mini)}</td>
                <td style={tdStyle}>{it.stock_maxi ? qte(it.stock_maxi) : '—'}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Btn bg="#e0f2fe" color="#0369a1" onClick={() => setVoir(it)}>👁 Voir</Btn>
                    <Btn bg="#fef3c7" color="#78350f" onClick={() => ouvrir(it)}>Modifier</Btn>
                    <Btn bg="#fee2e2" color="#dc2626" onClick={() => supprimer(it)}>Suppr.</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibles.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Aucun article divers</div>}
      </div>

      {form && (
        <Modal titre={editId ? "Modifier l'article divers" : 'Nouvel article divers'} onClose={() => setForm(null)} largeur={820}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
            <Champ label="Code *"><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!editId} style={inputStyle} /></Champ>
            <Champ label="Désignation *"><input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} style={inputStyle} /></Champ>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Champ label="Fournisseur habituel">
              <select value={form.fournisseur} onChange={e => setForm({ ...form, fournisseur: e.target.value })} style={inputStyle}>
                <option value="">-- Fournisseur --</option>
                {fournisseurs.map(f => <option key={f.id} value={f.raison_sociale}>{f.raison_sociale}</option>)}
              </select>
            </Champ>
            <Champ label="Référence fournisseur" note="(n° de catalogue)"><input value={form.reference_fournisseur} onChange={e => setForm({ ...form, reference_fournisseur: e.target.value })} style={inputStyle} /></Champ>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Champ label="Famille">
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={form.famille_id} onChange={e => setForm({ ...form, famille_id: e.target.value })} style={inputStyle}>
                  <option value="">-- Famille --</option>
                  {familles.map(f => <option key={f.id} value={f.id}>{f.libelle}</option>)}
                </select>
                <Btn onClick={() => setNouvelleFamille({ code: '', libelle: '' })} title="Créer une famille">+</Btn>
              </div>
            </Champ>
            <Champ label="Unité">
              <select value={form.unite_mesure_id} onChange={e => setForm({ ...form, unite_mesure_id: e.target.value })} style={inputStyle}>
                <option value="">-- Unité --</option>
                {unites.map(u => <option key={u.id} value={u.id}>{u.libelle} ({u.code})</option>)}
              </select>
            </Champ>
          </div>
          {nouvelleFamille && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 10, marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 2fr auto auto', gap: 8, alignItems: 'end' }}>
              <Champ label="Code famille"><input value={nouvelleFamille.code} onChange={e => setNouvelleFamille({ ...nouvelleFamille, code: e.target.value })} style={inputStyle} /></Champ>
              <Champ label="Libellé"><input value={nouvelleFamille.libelle} onChange={e => setNouvelleFamille({ ...nouvelleFamille, libelle: e.target.value })} style={inputStyle} /></Champ>
              <Btn plein onClick={creerFamille}>Créer</Btn>
              <Btn bg="#f3f4f6" color="#374151" onClick={() => setNouvelleFamille(null)}>✕</Btn>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Champ label="Prix d'achat (FCFA)"><input type="number" value={form.prix_achat} onChange={e => setForm({ ...form, prix_achat: e.target.value })} style={inputStyle} /></Champ>
            <Champ label="Stock mini"><input type="number" value={form.stock_mini} onChange={e => setForm({ ...form, stock_mini: e.target.value })} style={inputStyle} /></Champ>
            <Champ label="Stock maxi"><input type="number" value={form.stock_maxi} onChange={e => setForm({ ...form, stock_maxi: e.target.value })} style={inputStyle} /></Champ>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            <ChampFichier label="Fiche Technique (TDS)" icone="📄" accept=".pdf,.doc,.docx" fichier={fichiers.fiche_technique} onFichier={f => setFichiers({ ...fichiers, fiche_technique: f })} />
            <ChampFichier label="Fiche de Sécurité (FDS/SDS)" icone="⚠" accept=".pdf,.doc,.docx" fichier={fichiers.fiche_securite} onFichier={f => setFichiers({ ...fichiers, fiche_securite: f })} />
            <ChampFichier label="Photo / Image" icone="🖼" accept=".jpg,.jpeg,.png,.webp" fichier={fichiers.photo} onFichier={f => setFichiers({ ...fichiers, photo: f })} />
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#1d4ed8', marginBottom: 10 }}>
            💡 La fiche de sécurité (FDS) est obligatoire pour les produits dangereux (REACH, CLP). La fiche technique (TDS) contient les paramètres de mise en œuvre. 20 Mo maximum par fichier.
          </div>
          <Champ label="Notes"><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} /></Champ>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <Btn plein onClick={enregistrer} disabled={envoi}>{envoi ? 'Enregistrement...' : editId ? '✓ Enregistrer les modifications' : "✓ Créer l'article"}</Btn>
            <Btn plein bg="#f3f4f6" color="#374151" onClick={() => setForm(null)}>Annuler</Btn>
          </div>
        </Modal>
      )}

      {voir && (
        <Modal titre={`👁 ${voir.code} — ${voir.designation}`} onClose={() => setVoir(null)} largeur={560}>
          {voir.photo_path && <div style={{ textAlign: 'center', marginBottom: 12 }}><img src={voir.photo_path} alt={voir.designation} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} /></div>}
          {[['Fournisseur habituel', voir.fournisseur || '—'], ['Référence fournisseur', voir.reference_fournisseur || '—'], ['Famille', voir.famille_libelle || '—'],
            ['Unité', voir.unite_libelle ? `${voir.unite_libelle} (${voir.unite_code})` : '—'], ['Prix d\'achat', fcfa(voir.prix_achat)],
            ['Prix moyen (réceptions)', prixMoyens[voir.id] ? `${fcfa(prixMoyens[voir.id].prix)} (${prixMoyens[voir.id].nb} réception${prixMoyens[voir.id].nb > 1 ? 's' : ''})` : 'Aucune réception encore'],
            ['Stock actuel', qte(voir.stock_total)], ['Stock mini', qte(voir.stock_mini)], ['Stock maxi', voir.stock_maxi ? qte(voir.stock_maxi) : '—'], ['Notes', voir.notes || '—']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{l}</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {voir.fiche_technique_path ? <a href={voir.fiche_technique_path} target="_blank" rel="noreferrer" style={{ background: '#dbeafe', color: '#1d4ed8', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>📄 Fiche technique</a> : <span style={{ fontSize: 12, color: '#9ca3af' }}>Pas de fiche technique</span>}
            {voir.fiche_securite_path ? <a href={voir.fiche_securite_path} target="_blank" rel="noreferrer" style={{ background: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>⚠ Fiche de sécurité</a> : <span style={{ fontSize: 12, color: '#9ca3af' }}>Pas de fiche de sécurité</span>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SOUS STOCK MINI (liste utilisee par le tableau de bord et la page Alertes)
// ══════════════════════════════════════════════════════════════
const TypeArticle = t => (t === 'matiere_premiere' ? 'MP' : t === 'produit_fini' ? 'PF' : 'Divers');

function TableStockBas({ lignes }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['Code', 'Désignation', 'Type', 'Stock actuel', 'Stock mini'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
      <tbody>
        {lignes.map(s => (
          <tr key={s.id}>
            <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{s.code}</td>
            <td style={tdStyle}>{s.designation}</td>
            <td style={tdStyle}>{TypeArticle(s.type_article)}</td>
            <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626' }}>{qte(s.stock_actuel)}</td>
            <td style={tdStyle}>{qte(s.stock_mini)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SectionStockBas() {
  const [lignes, setLignes] = useState([]);
  useEffect(() => {
    const charger = () => axios.get(`${API}/achat/articles-stock-bas`).then(r => setLignes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    charger();
    const iv = setInterval(charger, 60000);
    return () => clearInterval(iv);
  }, []);
  if (!lignes.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#0369a1' }}>📦 Articles sous stock mini ({lignes.length})</h3>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}><TableStockBas lignes={lignes} /></div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TABLEAU DE BORD ACHAT (cartes cliquables)
// ══════════════════════════════════════════════════════════════
export function DashboardAchat() {
  const [k, setK] = useState(null);
  const [ouvert, setOuvert] = useState(null);   // { titre, contenu }
  const charger = () => axios.get(`${API}/achat/dashboard`).then(r => setK(r.data)).catch(() => setK({}));
  useEffect(() => { charger(); }, []);

  const listeCommandes = async (statuts, titre) => {
    const res = await Promise.all(statuts.map(s => axios.get(`${API}/achat/commandes?statut=${s}`).then(r => r.data).catch(() => [])));
    const lignes = res.flat();
    setOuvert({ titre, total: lignes.reduce((s, c) => s + nb(c.montant_ttc), 0), contenu: (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['N° commande', 'Fournisseur', 'Livraison', 'Montant TTC', 'Statut'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
        <tbody>{lignes.map(c => <tr key={c.id}><td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{c.numero_commande}</td><td style={tdStyle}>{c.fournisseur_nom}</td><td style={tdStyle}>{jour(c.date_livraison_prevue)}</td><td style={{ ...tdStyle, fontWeight: 700 }}>{fcfa(c.montant_ttc)}</td><td style={tdStyle}><Badge s={c.statut} /></td></tr>)}</tbody>
      </table>), vide: !lignes.length });
  };
  const listeStockBas = async () => {
    const { data } = await axios.get(`${API}/achat/articles-stock-bas`).catch(() => ({ data: [] }));
    setOuvert({ titre: 'Articles sous stock mini', contenu: <TableStockBas lignes={data} />, vide: !data.length });
  };
  const listeDemandes = async () => {
    const { data } = await axios.get(`${API}/achat/demandes?statut=en_attente`).catch(() => ({ data: [] }));
    setOuvert({ titre: "Demandes d'achat en attente", contenu: (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['N° demande', 'Demandeur', 'Date', 'Articles'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
        <tbody>{data.map(d => <tr key={d.id}><td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700 }}>{d.numero_demande}</td><td style={tdStyle}>{d.demandeur_nom}</td><td style={tdStyle}>{jour(d.created_at)}</td><td style={{ ...tdStyle, textAlign: 'center' }}>{d.nb_lignes}</td></tr>)}</tbody>
      </table>), vide: !data.length });
  };

  const cartes = k ? [
    { icone: '⏳', valeur: k.commandes_a_confirmer ?? 0, titre: 'Commandes à confirmer', aide: 'Envoyées, en attente de la validation de la direction', action: () => listeCommandes(['envoye'], 'Commandes en attente de la direction') },
    { icone: '📥', valeur: k.commandes_a_receptionner ?? 0, titre: 'Commandes à réceptionner', aide: 'Confirmées, pas encore reçues ou reçues en partie', action: () => listeCommandes(['confirme', 'receptionne_partiel'], 'Commandes à réceptionner') },
    { icone: '💰', valeur: fcfa(k.montant_engage), titre: 'Montant engagé', aide: 'Total TTC des commandes envoyées, confirmées ou partiellement reçues : ce que vous avez promis aux fournisseurs et pas encore soldé', action: () => listeCommandes(['envoye', 'confirme', 'receptionne_partiel'], 'Détail du montant engagé') },
    { icone: '📝', valeur: k.demandes_en_attente ?? 0, titre: "Demandes d'achat", aide: "Demandes de l'atelier à transformer en bon de commande", action: listeDemandes },
    { icone: '⚠', valeur: k.articles_sous_stock_mini ?? 0, titre: 'Articles sous stock mini', aide: 'Articles dont le stock est inférieur au seuil minimum', action: listeStockBas, alerte: (k.articles_sous_stock_mini || 0) > 0 },
    { icone: '🏭', valeur: k.fournisseurs_actifs ?? 0, titre: 'Fournisseurs actifs', aide: 'Fournisseurs référencés', action: null },
  ] : [];

  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>Tableau de bord — Achats</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
        {cartes.map(c => (
          <div key={c.titre} onClick={c.action || undefined} title={c.aide}
            style={{ background: '#fff', borderRadius: 12, padding: 16, border: `1px solid ${c.alerte ? '#fecaca' : '#e5e7eb'}`, cursor: c.action ? 'pointer' : 'default', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 24 }}>{c.icone}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.alerte ? '#dc2626' : '#1f2937', margin: '4px 0' }}>{c.valeur}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{c.titre}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{c.aide}</div>
            {c.action && <div style={{ fontSize: 11, color: '#6d28d9', marginTop: 6, fontWeight: 700 }}>Cliquer pour voir le détail →</div>}
          </div>
        ))}
      </div>
      {!k && <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>Chargement...</div>}
      {ouvert && (
        <Modal titre={ouvert.titre} onClose={() => setOuvert(null)} largeur={760}>
          {ouvert.vide ? <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Rien à afficher</div> : ouvert.contenu}
          {ouvert.total !== undefined && !ouvert.vide && <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 800, color: '#6d28d9' }}>Total : {fcfa(ouvert.total)}</div>}
        </Modal>
      )}
    </div>
  );
}
