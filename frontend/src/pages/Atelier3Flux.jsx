// ============================================================
// NAIdo — AT3 FLUX COMPLET — Composant React
// Fichier : Atelier3Flux.jsx
//
// INTÉGRATION dans ChefAtelier.jsx :
//   1. Importer : import Atelier3Flux from './Atelier3Flux';
//   2. Ajouter dans MENU :
//      { id:'at3flux', label:'🏭 Flux AT3', icon:'production', color:'#14532d' }
//   3. Ajouter dans le rendu des sections :
//      {section === 'at3flux' && <Atelier3Flux />}
// ============================================================

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = '/api';

// ─────────────────────────────────────────────────────────────
// COULEURS & STATUTS
// ─────────────────────────────────────────────────────────────
const ZONE_CONFIG = {
  EXTR:   { label: 'Extrusion',       icon: '⚙',  bg: '#dbeafe', tx: '#1d4ed8', border: '#93c5fd' },
  QUAR:   { label: 'Quarantaine',     icon: '⏳', bg: '#fef3c7', tx: '#92400e', border: '#fcd34d' },
  IMPR:   { label: 'Impression',      icon: '🖨',  bg: '#f3e8ff', tx: '#6d28d9', border: '#c4b5fd' },
  EMBL:   { label: 'Emballage',       icon: '📦', bg: '#ecfdf5', tx: '#065f46', border: '#6ee7b7' },
  STKAT3: { label: 'Stock AT3',       icon: '🏗',  bg: '#f0fdf4', tx: '#15803d', border: '#86efac' },
  MAGSIN: { label: 'Magasin Central', icon: '🏭', bg: '#faf5ff', tx: '#6b21a8', border: '#a855f7' },
};

const STATUT_OF = {
  nouveau:      { bg: '#f3f4f6', tx: '#374151', label: 'Nouveau' },
  composition:  { bg: '#dbeafe', tx: '#1d4ed8', label: 'Config. en cours' },
  extrusion:    { bg: '#fef3c7', tx: '#92400e', label: 'En extrusion' },
  quarantaine:  { bg: '#fef9c3', tx: '#854d0e', label: 'Quarantaine' },
  impression:   { bg: '#f3e8ff', tx: '#6d28d9', label: 'Impression' },
  emballage:    { bg: '#ecfdf5', tx: '#065f46', label: 'Emballage' },
  stock_at3:    { bg: '#dcfce7', tx: '#15803d', label: 'Stock AT3' },
  cede:         { bg: '#e0f2fe', tx: '#0369a1', label: 'Cédé Magasin' },
};

// ─────────────────────────────────────────────────────────────
// BADGE statut
// ─────────────────────────────────────────────────────────────
const Badge = ({ statut, map, custom }) => {
  const cfg = custom || map?.[statut] || { bg: '#f3f4f6', tx: '#374151', label: statut };
  return (
    <span style={{
      background: cfg.bg, color: cfg.tx,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap'
    }}>{cfg.label || statut}</span>
  );
};

// ─────────────────────────────────────────────────────────────
// BARRE PROGRESSION FLUX AT3
// ─────────────────────────────────────────────────────────────
const BarreFlux = ({ statut_zone }) => {
  const etapes = ['nouveau','composition','extrusion','quarantaine','impression','emballage','stock_at3','cede'];
  const idx = etapes.indexOf(statut_zone);
  const labels = ['Nouveau','Config','Extrusion','Quarantaine','Impression','Emballage','Stock AT3','Cédé'];
  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'center', margin: '12px 0' }}>
      {etapes.map((e, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div key={e} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              flex: 1, textAlign: 'center', padding: '5px 4px',
              background: active ? '#14532d' : done ? '#86efac' : '#f3f4f6',
              color: active ? '#fff' : done ? '#14532d' : '#9ca3af',
              fontSize: 9, fontWeight: active ? 800 : 600,
              borderRadius: i === 0 ? '8px 0 0 8px' : i === etapes.length-1 ? '0 8px 8px 0' : 0,
              borderRight: i < etapes.length-1 ? '1px solid #e5e7eb' : 'none',
            }}>
              {labels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TICKET IMPRESSION — Formaté ESC/POS (affiché à l'écran, imprimable)
// ─────────────────────────────────────────────────────────────
const TicketView = ({ data, type = 'bobine', onClose }) => {
  const printRef = useRef();
  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Ticket ${data.numero_bobine || data.numero_palette}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .hr { border-top: 1px dashed #000; margin: 6px 0; }
        .big { font-size: 18px; font-weight: bold; }
        .small { font-size: 10px; }
      </style></head><body onload="window.print()">
      <div class="center bold big">NAI — ATELIER 3</div>
      <div class="hr"></div>
      ${type === 'bobine' ? `
        <div>BOBINE: <b>${data.numero_bobine}</b></div>
        <div>LOT: ${data.numero_lot}</div>
        <div>MACHINE: ${data.machine_code}</div>
        <div class="hr"></div>
        <div>OF: ${data.numero_of}</div>
        <div>ARTICLE: ${data.article_code}</div>
        <div>${data.article_nom}</div>
        <div>COULEUR: ${data.couleur || '—'}</div>
        <div>DIM: ${data.longueur_mm || '—'} x ${data.largeur_mm || '—'} mm</div>
        <div class="hr"></div>
        <div class="bold">POIDS NET: ${parseFloat(data.poids_net_kg||0).toFixed(3)} kg</div>
        <div>POIDS BRUT: ${parseFloat(data.poids_brut_kg||0).toFixed(3)} kg</div>
        <div>CLIENT: ${data.client_nom || '—'}</div>
        <div class="hr"></div>
        <div class="small">OP: ${data.operateur_nom || '—'}</div>
        <div class="small">${new Date(data.created_at).toLocaleString('fr-FR')}</div>
      ` : `
        <div>PALETTE: <b>${data.numero_palette}</b></div>
        <div>LOT: ${data.numero_lot}</div>
        <div class="hr"></div>
        <div>OF: ${data.numero_of}</div>
        <div>ARTICLE: ${data.article_code}</div>
        <div>${data.article_nom}</div>
        <div>COULEUR: ${data.couleur || '—'}</div>
        <div class="hr"></div>
        <div class="bold">NB SACS: ${data.nb_sacs}</div>
        <div class="bold">POIDS NET: ${parseFloat(data.poids_sacs_kg||0).toFixed(2)} kg</div>
        <div class="bold">POIDS TOTAL: ${parseFloat(data.poids_total_kg||0).toFixed(2)} kg</div>
        <div>EMBALLAGE: ${data.type_emballage || '—'}</div>
        ${data.nb_couches ? `<div>${data.nb_couches} couches x ${data.sacs_par_couche} sacs/couche</div>` : ''}
        <div class="hr"></div>
        <div>CLIENT: ${data.client_nom || '—'}</div>
        <div class="small">QR: ${data.qr_code || ''}</div>
        <div class="small">EMBALLEUR: ${data.emballeur_nom || '—'}</div>
        <div class="small">${new Date(data.created_at).toLocaleString('fr-FR')}</div>
      `}
      <div class="hr"></div>
      <div class="center small">© NAI — Green Industry</div>
      </body></html>
    `);
    w.document.close();
  };

  if (!data) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 24,
        width: 340, fontFamily: "'Courier New', monospace",
        boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
          🖨 NAI — ATELIER 3
        </div>
        <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }} />
        {type === 'bobine' ? (
          <>
            <div><strong>BOBINE:</strong> {data.numero_bobine}</div>
            <div><strong>LOT:</strong> {data.numero_lot}</div>
            <div><strong>MACHINE:</strong> {data.machine_code}</div>
            <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
            <div><strong>OF:</strong> {data.numero_of}</div>
            <div>{data.article_code} — {data.article_nom}</div>
            {data.couleur && <div>Couleur: {data.couleur}</div>}
            <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              POIDS NET: {parseFloat(data.poids_net_kg || 0).toFixed(3)} kg
            </div>
            <div>POIDS BRUT: {parseFloat(data.poids_brut_kg || 0).toFixed(3)} kg</div>
          </>
        ) : (
          <>
            <div><strong>PALETTE:</strong> {data.numero_palette}</div>
            <div><strong>LOT:</strong> {data.numero_lot}</div>
            <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
            <div><strong>OF:</strong> {data.numero_of}</div>
            <div>{data.article_code} — {data.article_nom}</div>
            <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
            <div style={{ fontSize: 15, fontWeight: 800 }}>NB SACS: {data.nb_sacs}</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              POIDS NET: {parseFloat(data.poids_sacs_kg || 0).toFixed(2)} kg
            </div>
            <div>POIDS TOTAL: {parseFloat(data.poids_total_kg || 0).toFixed(2)} kg</div>
          </>
        )}
        <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0', fontSize: 11, color: '#6b7280' }}>
          {data.client_nom && <div>Client: {data.client_nom}</div>}
          <div>{new Date(data.created_at).toLocaleString('fr-FR')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={handlePrint} style={{
            flex: 1, background: '#14532d', color: '#fff', border: 'none',
            padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 700
          }}>🖨 Imprimer</button>
          <button onClick={onClose} style={{
            background: '#f3f4f6', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer'
          }}>✕</button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODULE 1 : CHEF ATELIER — Réception OF & Configuration
// ─────────────────────────────────────────────────────────────
// ============================================================
// NAIdo — MODULE COMPOSITION OF — Chef Atelier AT3
// Remplace ModuleChefAtelier dans Atelier3Flux.jsx
// ============================================================

// ============================================================
// NAIdo — MODULE COMPOSITION PAR FAMILLE — Chef Atelier AT3
// Logique : Article définit % par famille → Chef AT3 choisit
//           les MP concrètes dans chaque famille selon stock
// ============================================================

function ModuleChefAtelier() {
  const [ofs, setOfs]           = useState([]);
  const [ofSel, setOfSel]       = useState(null);
  const [mpStock, setMpStock]   = useState([]);   // toutes les MP avec stock
  const [familles, setFamilles] = useState([]);   // familles MP
  const [compoFamilles, setCompoFamilles] = useState([]); // composition par famille avec MP choisies
  const [config, setConfig]     = useState({ at3_poids_cible_kg:'', at3_nb_bobines_cibles:'', at3_notes_regleur:'', at3_machine_assignee_id:'' });
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');

  const chargerOfs = async () => {
    try {
      const { data } = await axios.get(`${API}/at3/of`);
      setOfs(data);
    } catch { toast.error('Erreur chargement OF'); }
  };

  const chargerRefs = async () => {
    try {
      const [mpRes, famRes] = await Promise.all([
        axios.get(`${API}/articles?type_article=matiere_premiere`),
        axios.get(`${API}/referentiels/familles`).catch(() => ({ data: [] })),
      ]);
      // Enrichir MP avec stock
      const stockRes = await axios.get(`${API}/stock/liste`).catch(() => ({ data: [] }));
      const stocks = stockRes.data || [];
      const mpEnrichies = (mpRes.data || []).map(mp => {
        const s = stocks.find(x => x.article_id === mp.id);
        return { ...mp, qte_disponible: parseFloat(s?.qte_disponible || 0) };
      });
      setMpStock(mpEnrichies);
      setFamilles(famRes.data || []);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { chargerOfs(); chargerRefs(); }, []);

  // ── Ouvrir un OF ──
  const ouvrirOf = async (o) => {
    setOfSel(o);
    setConfig({
      at3_poids_cible_kg:      o.at3_poids_cible_kg || '',
      at3_nb_bobines_cibles:   o.at3_nb_bobines_cibles || '',
      at3_notes_regleur:       o.at3_notes_regleur || '',
      at3_machine_assignee_id: o.at3_machine_assignee_id || '',
    });

    // Charger composition par famille depuis l'article
    try {
      const { data: art } = await axios.get(`${API}/articles/${o.article_id}`);
      const baseCompoFamilles = art.composition_familles || [];

      // Si l'OF a déjà une composition familles sauvegardée, l'utiliser
      const savedCompo = o.at3_composition_familles || [];

      if (savedCompo.length > 0) {
        setCompoFamilles(savedCompo);
      } else if (baseCompoFamilles.length > 0) {
        // Initialiser depuis la composition de l'article
        setCompoFamilles(baseCompoFamilles.map(f => ({
          famille_id:      f.famille_id,
          famille_code:    f.famille_code,
          famille_libelle: f.famille_libelle,
          pct_famille:     f.pct,
          // MP choisies pour cette famille (vide au départ)
          mp_choisies: [],
        })));
      } else {
        setCompoFamilles([]);
      }
    } catch { setCompoFamilles([]); }
  };

  // ── MP disponibles pour une famille ──
  const mpDeFamille = (famille_id) =>
    mpStock.filter(mp => mp.famille_id === famille_id);

  // ── Ajouter une MP dans une famille ──
  const ajouterMpDansFamille = (familleIdx, mp_id) => {
    if (!mp_id) return;
    setCompoFamilles(prev => prev.map((f, i) => {
      if (i !== familleIdx) return f;
      if (f.mp_choisies.find(m => m.mp_id === mp_id)) return f;
      const mp = mpStock.find(m => m.id === mp_id);
      if (!mp) return f;
      return {
        ...f,
        mp_choisies: [...f.mp_choisies, {
          mp_id:       mp.id,
          code:        mp.code,
          designation: mp.designation,
          pct:         '',  // % dans la famille
          quantite:    '',  // kg calculé
          qte_dispo:   mp.qte_disponible,
        }]
      };
    }));
  };

  // ── Modifier % d'une MP dans une famille ──
  const majPctMp = (familleIdx, mpIdx, val) => {
    const poidsCible = parseFloat(config.at3_poids_cible_kg || 0);
    setCompoFamilles(prev => prev.map((f, fi) => {
      if (fi !== familleIdx) return f;
      const mp_choisies = f.mp_choisies.map((m, mi) => {
        if (mi !== mpIdx) return m;
        const pct = parseFloat(val || 0);
        const quantite = poidsCible > 0 ? ((pct / 100) * poidsCible).toFixed(3) : '';
        return { ...m, pct: val, quantite };
      });
      return { ...f, mp_choisies };
    }));
  };

  // ── Supprimer une MP d'une famille ──
  const supprimerMp = (familleIdx, mpIdx) => {
    setCompoFamilles(prev => prev.map((f, fi) => {
      if (fi !== familleIdx) return f;
      return { ...f, mp_choisies: f.mp_choisies.filter((_, mi) => mi !== mpIdx) };
    }));
  };

  // ── Recalculer quantités quand poids cible change ──
  useEffect(() => {
    const poidsCible = parseFloat(config.at3_poids_cible_kg || 0);
    if (!poidsCible) return;
    setCompoFamilles(prev => prev.map(f => ({
      ...f,
      mp_choisies: f.mp_choisies.map(m => ({
        ...m,
        quantite: m.pct ? ((parseFloat(m.pct) / 100) * poidsCible).toFixed(3) : '',
      }))
    })));
  }, [config.at3_poids_cible_kg]);

  // ── Validation ──
  const totalPctGlobal = compoFamilles.reduce((s, f) => {
    const totalFamille = f.mp_choisies.reduce((sf, m) => sf + parseFloat(m.pct || 0), 0);
    return s + totalFamille;
  }, 0);

  const sauvegarder = async (valider = false) => {
    if (valider) {
      if (compoFamilles.length === 0) return toast.error('Aucune composition définie');
      if (Math.abs(totalPctGlobal - 100) > 0.1) return toast.error(`Total = ${totalPctGlobal.toFixed(1)}% — doit être 100%`);
      if (!config.at3_poids_cible_kg) return toast.error('Poids cible requis');
      for (const f of compoFamilles) {
        if (f.mp_choisies.length === 0) return toast.error(`Famille "${f.famille_libelle}" : aucune MP sélectionnée`);
      }
    }
    setLoading(true);
    try {
      await axios.put(`${API}/at3/of/${ofSel.id}/configurer`, {
        ...config,
        composition_of: compoFamilles.flatMap(f => f.mp_choisies.map(m => ({
          mp_id: m.mp_id, code: m.code, designation: m.designation,
          pct: m.pct, quantite: m.quantite,
          famille_id: f.famille_id, famille_libelle: f.famille_libelle,
        }))),
        at3_composition_familles: compoFamilles,
        valider,
      });
      toast.success(valider ? '✅ Composition validée — Extrusion lancée !' : '💾 Sauvegardé');
      if (valider) setOfSel(null);
      chargerOfs();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  const STATUT_COLOR = {
    nouveau:     { bg:'#f3f4f6', tx:'#374151', label:'Nouveau' },
    composition: { bg:'#dbeafe', tx:'#1d4ed8', label:'En config.' },
    extrusion:   { bg:'#fef3c7', tx:'#92400e', label:'En extrusion' },
    quarantaine: { bg:'#fef9c3', tx:'#854d0e', label:'Quarantaine' },
    impression:  { bg:'#f3e8ff', tx:'#6d28d9', label:'Impression' },
    emballage:   { bg:'#ecfdf5', tx:'#065f46', label:'Emballage' },
    stock_at3:   { bg:'#dcfce7', tx:'#15803d', label:'Stock AT3' },
    cede:        { bg:'#e0f2fe', tx:'#0369a1', label:'Cédé ✓' },
  };

  const FAMILLE_COLORS = [
    { bg:'#dbeafe', tx:'#1d4ed8', border:'#93c5fd' },
    { bg:'#fef3c7', tx:'#92400e', border:'#fcd34d' },
    { bg:'#f3e8ff', tx:'#6d28d9', border:'#c4b5fd' },
    { bg:'#dcfce7', tx:'#15803d', border:'#86efac' },
    { bg:'#fce7f3', tx:'#9d174d', border:'#f9a8d4' },
    { bg:'#e0f2fe', tx:'#0369a1', border:'#7dd3fc' },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'#14532d' }}>
          📋 Chef Atelier — Composition des OF
        </h3>
        <button onClick={() => { chargerOfs(); chargerRefs(); }}
          style={{ background:'#f0fdf4', border:'1px solid #86efac', color:'#15803d', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
          🔄 Actualiser
        </button>
      </div>

      {/* ── DETAIL OF ── */}
      {ofSel && (
        <div style={{ background:'#fff', borderRadius:14, border:'2px solid #86efac', padding:24, marginBottom:20 }}>

          {/* En-tête */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:18, color:'#14532d' }}>{ofSel.numero_of}</div>
              <div style={{ fontSize:14, color:'#374151' }}>{ofSel.article_code} — {ofSel.article_nom}</div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>Client : {ofSel.client_nom || '—'} | Qté : {ofSel.quantite_cible}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{
                background:(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).bg,
                color:(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).tx,
                padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700
              }}>{(STATUT_COLOR[ofSel.at3_statut_zone]||STATUT_COLOR.nouveau).label}</span>
              <button onClick={() => setOfSel(null)}
                style={{ background:'#f3f4f6', border:'none', padding:'4px 12px', borderRadius:8, cursor:'pointer' }}>✕</button>
            </div>
          </div>

          {/* Paramètres production */}
          <div style={{ background:'#f8fafc', borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1d4ed8', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
              ⚙ Paramètres production
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
              {[
                ['Poids cible (kg) *', 'at3_poids_cible_kg'],
                ['Nb bobines prévues', 'at3_nb_bobines_cibles'],
                ['Machine (ID)', 'at3_machine_assignee_id'],
              ].map(([label, key]) => (
                <div key={key}>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>{label}</label>
                  <input type="number" value={config[key] || ''} onChange={e => setConfig({ ...config, [key]: e.target.value })}
                    style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:14, boxSizing:'border-box', textAlign:'center', fontWeight:700 }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:10 }}>
              <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:3 }}>Instructions régleur</label>
              <textarea value={config.at3_notes_regleur || ''} onChange={e => setConfig({ ...config, at3_notes_regleur: e.target.value })}
                rows={2} placeholder="Températures, vitesses, consignes..."
                style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:8, padding:'8px', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
            </div>
          </div>

          {/* Total % global */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151' }}>
              🧪 Composition par famille de matières premières
            </div>
            <div style={{
              background: Math.abs(totalPctGlobal-100) < 0.1 ? '#dcfce7' : totalPctGlobal > 100 ? '#fee2e2' : '#fef3c7',
              color:      Math.abs(totalPctGlobal-100) < 0.1 ? '#15803d' : totalPctGlobal > 100 ? '#dc2626' : '#92400e',
              padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:800
            }}>
              Total : {totalPctGlobal.toFixed(1)}%
              {Math.abs(totalPctGlobal-100) < 0.1 ? ' ✓' : totalPctGlobal > 100 ? ' ⚠ Dépassement' : ` (manque ${(100-totalPctGlobal).toFixed(1)}%)`}
            </div>
          </div>

          {/* Familles */}
          {compoFamilles.length === 0 ? (
            <div style={{ background:'#fef3c7', borderRadius:10, padding:16, textAlign:'center', color:'#92400e', fontSize:13 }}>
              ⚠ Cet article n'a pas de composition par famille définie.<br/>
              <span style={{ fontSize:11 }}>Demandez à l'admin de configurer la composition famille dans la fiche article.</span>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {compoFamilles.map((f, fi) => {
                const clr = FAMILLE_COLORS[fi % FAMILLE_COLORS.length];
                const mpDispo = mpDeFamille(f.famille_id);
                const totalFamille = f.mp_choisies.reduce((s, m) => s + parseFloat(m.pct || 0), 0);
                const qteNeeded = config.at3_poids_cible_kg
                  ? ((f.pct_famille / 100) * parseFloat(config.at3_poids_cible_kg)).toFixed(1)
                  : '—';

                return (
                  <div key={fi} style={{ border:`2px solid ${clr.border}`, borderRadius:12, overflow:'hidden' }}>
                    {/* Header famille */}
                    <div style={{ background:clr.bg, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <span style={{ fontWeight:800, color:clr.tx, fontSize:14 }}>
                          {f.famille_libelle}
                        </span>
                        <span style={{ marginLeft:10, background:'#fff', color:clr.tx, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                          {f.pct_famille}% de l'OF
                        </span>
                        {config.at3_poids_cible_kg && (
                          <span style={{ marginLeft:8, fontSize:12, color:clr.tx }}>
                            = {qteNeeded} kg à fournir
                          </span>
                        )}
                      </div>
                      <div style={{
                        background: Math.abs(totalFamille - f.pct_famille) < 0.1 ? '#15803d' : '#dc2626',
                        color:'#fff', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700
                      }}>
                        {totalFamille.toFixed(1)}% / {f.pct_famille}%
                        {Math.abs(totalFamille - f.pct_famille) < 0.1 ? ' ✓' : ''}
                      </div>
                    </div>

                    {/* MP choisies */}
                    <div style={{ padding:'12px 16px', background:'#fff' }}>
                      {f.mp_choisies.length > 0 && (
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:10 }}>
                          <thead>
                            <tr style={{ background:clr.bg }}>
                              {['MP sélectionnée', 'Stock dispo', '% dans formule', 'Quantité (kg)', ''].map(h => (
                                <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:clr.tx }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {f.mp_choisies.map((m, mi) => {
                              const qteNecessaire = parseFloat(m.quantite || 0);
                              const insuffisant = qteNecessaire > m.qte_dispo && m.qte_dispo > 0;
                              return (
                                <tr key={mi} style={{ borderBottom:`1px solid ${clr.border}` }}>
                                  <td style={{ padding:'7px 10px' }}>
                                    <div style={{ fontWeight:700, color:clr.tx }}>{m.code}</div>
                                    <div style={{ fontSize:11, color:'#6b7280' }}>{m.designation}</div>
                                  </td>
                                  <td style={{ padding:'7px 10px' }}>
                                    <span style={{ color: insuffisant ? '#dc2626' : '#15803d', fontWeight:600, fontSize:12 }}>
                                      {m.qte_dispo > 0 ? `${m.qte_dispo.toFixed(1)} kg` : '—'}
                                      {insuffisant && ' ⚠ Insuffisant'}
                                    </span>
                                  </td>
                                  <td style={{ padding:'7px 10px', width:100 }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                      <input type="number" value={m.pct} min="0" max="100" step="0.1"
                                        onChange={e => majPctMp(fi, mi, e.target.value)}
                                        style={{ width:65, border:`1px solid ${clr.border}`, borderRadius:6, padding:'5px', fontSize:13, textAlign:'center', fontWeight:700 }} />
                                      <span style={{ fontSize:11 }}>%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding:'7px 10px', fontSize:13, fontWeight:700, color:clr.tx }}>
                                    {m.quantite ? `${m.quantite} kg` : '—'}
                                  </td>
                                  <td style={{ padding:'7px 10px' }}>
                                    <button onClick={() => supprimerMp(fi, mi)}
                                      style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:12 }}>
                                      🗑
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      {/* Ajouter MP dans cette famille */}
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>
                          + Ajouter une MP :
                        </span>
                        {mpDispo.length === 0 ? (
                          <span style={{ fontSize:11, color:'#dc2626' }}>
                            ⚠ Aucune MP dans la famille {f.famille_libelle} — créez-en dans Articles
                          </span>
                        ) : (
                          mpDispo.filter(mp => !f.mp_choisies.find(m => m.mp_id === mp.id)).map(mp => (
                            <button key={mp.id} onClick={() => ajouterMpDansFamille(fi, mp.id)}
                              style={{
                                background: mp.qte_disponible > 0 ? clr.bg : '#f3f4f6',
                                color: mp.qte_disponible > 0 ? clr.tx : '#9ca3af',
                                border: `1px solid ${clr.border}`,
                                borderRadius:20, padding:'4px 12px', cursor:'pointer', fontSize:11, fontWeight:600
                              }}>
                              + {mp.code}
                              <span style={{ fontSize:10, marginLeft:4, opacity:0.8 }}>
                                ({mp.qte_disponible > 0 ? `${mp.qte_disponible.toFixed(0)} kg` : 'rupture'})
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Boutons */}
          <div style={{ display:'flex', gap:10, marginTop:20, flexWrap:'wrap' }}>
            <button onClick={() => sauvegarder(false)} disabled={loading}
              style={{ background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', padding:'10px 20px', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
              💾 Sauvegarder
            </button>
            <button onClick={() => sauvegarder(true)} disabled={loading || ofSel.at3_statut_zone === 'extrusion'}
              style={{
                background: Math.abs(totalPctGlobal-100) < 0.1 && config.at3_poids_cible_kg ? '#14532d' : '#9ca3af',
                color:'#fff', border:'none', padding:'10px 24px', borderRadius:8,
                cursor: Math.abs(totalPctGlobal-100) < 0.1 && config.at3_poids_cible_kg ? 'pointer' : 'not-allowed',
                fontWeight:700, fontSize:14
              }}>
              {loading ? '...' : '✅ Valider & Lancer Extrusion'}
            </button>
            {ofSel.at3_statut_zone === 'extrusion' && (
              <span style={{ background:'#fef3c7', color:'#92400e', padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600 }}>
                ⚙ Déjà en extrusion
              </span>
            )}
            <button onClick={() => setOfSel(null)}
              style={{ background:'#f3f4f6', border:'none', padding:'10px 16px', borderRadius:8, cursor:'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── LISTE OF ── */}
      <div style={{ display:'flex', gap:10, marginBottom:12, alignItems:'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un OF..."
          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'8px 14px', fontSize:13 }} />
        <span style={{ fontSize:12, color:'#6b7280' }}>
          {ofs.filter(o => !search || o.numero_of?.toLowerCase().includes(search.toLowerCase()) || o.article_nom?.toLowerCase().includes(search.toLowerCase())).length} OF
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {ofs
          .filter(o => !search || o.numero_of?.toLowerCase().includes(search.toLowerCase()) || o.article_nom?.toLowerCase().includes(search.toLowerCase()))
          .map(o => {
            const sc = STATUT_COLOR[o.at3_statut_zone] || STATUT_COLOR.nouveau;
            const pct = o.at3_poids_cible_kg > 0
              ? Math.min(100, Math.round((parseFloat(o.poids_produit_kg||0) / o.at3_poids_cible_kg) * 100))
              : 0;
            return (
              <div key={o.id} style={{
                background: ofSel?.id === o.id ? '#f0fdf4' : '#fff',
                borderRadius:12, padding:'14px 18px',
                border:`2px solid ${ofSel?.id === o.id ? '#86efac' : sc.bg}`,
                cursor:'pointer'
              }} onClick={() => ofSel?.id === o.id ? setOfSel(null) : ouvrirOf(o)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:800, fontSize:15, color:'#14532d' }}>{o.numero_of}</span>
                      <span style={{ background:sc.bg, color:sc.tx, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {sc.label}
                      </span>
                      {o.at3_composition_validee && (
                        <span style={{ background:'#dcfce7', color:'#15803d', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                          ✓ Composition validée
                        </span>
                      )}
                      {!o.at3_composition_validee && (
                        <span style={{ background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                          ⚠ À configurer
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:'#374151' }}>{o.article_code} — {o.article_nom}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                      Client : {o.client_nom || '—'} | Qté : {o.quantite_cible}
                      {o.at3_poids_cible_kg && ` | Cible : ${o.at3_poids_cible_kg} kg`}
                    </div>
                    {o.at3_poids_cible_kg > 0 && (
                      <div style={{ marginTop:6 }}>
                        <div style={{ fontSize:10, color:'#6b7280', marginBottom:2 }}>
                          Production : {parseFloat(o.poids_produit_kg||0).toFixed(1)} / {o.at3_poids_cible_kg} kg — {pct}%
                        </div>
                        <div style={{ background:'#e5e7eb', borderRadius:10, height:5, overflow:'hidden', maxWidth:300 }}>
                          <div style={{ background:pct>=100?'#15803d':'#1d4ed8', width:`${pct}%`, height:'100%', borderRadius:10 }}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, color:'#14532d' }}>{o.nb_bobines||0} bob.</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{o.nb_palettes||0} palettes</div>
                    <div style={{ marginTop:4, color:'#1d4ed8', fontSize:11, fontWeight:600 }}>
                      {ofSel?.id === o.id ? '▲ Fermer' : '▼ Configurer'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        {ofs.length === 0 && (
          <div style={{ background:'#fff', borderRadius:14, padding:48, textAlign:'center', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📋</div>
            <p style={{ color:'#9ca3af' }}>Aucun OF disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
function ModuleExtrusion() {
  const [ofs, setOfs] = useState([]);
  const [ofSel, setOfSel] = useState(null);
  const [bobines, setBobines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState({
    machine_id: '', poids_brut_kg: '', poids_net_kg: '',
    poids_mandrin_kg: '', longueur_m: '',
    temperature_c: '', vitesse_m_min: '', pression_bar: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/at3/extrusion/of-actifs`).then(r => setOfs(r.data)).catch(() => {});
  }, []);

  const selOf = async (o) => {
    setOfSel(o);
    setShowForm(false);
    setForm({ ...form, machine_id: o.at3_machine_assignee_id || '' });
    try {
      const { data } = await axios.get(`${API}/at3/extrusion/${o.id}/bobines`);
      setBobines(data);
    } catch { setBobines([]); }
  };

  const creerBobine = async () => {
    if (!form.poids_net_kg) return toast.error('Poids net requis');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/at3/extrusion/bobine`, {
        of_id: ofSel.id,
        machine_id: form.machine_id || ofSel.at3_machine_assignee_id,
        ...form
      });
      toast.success(data.message);
      // Afficher ticket
      const ticketRes = await axios.get(`${API}/at3/ticket/bobine/${data.bobine.id}`);
      setTicket(ticketRes.data);
      setShowForm(false);
      const { data: bobs } = await axios.get(`${API}/at3/extrusion/${ofSel.id}/bobines`);
      setBobines(bobs);
      setForm({ ...form, poids_brut_kg: '', poids_net_kg: '', poids_mandrin_kg: '', longueur_m: '', temperature_c: '', vitesse_m_min: '', pression_bar: '' });
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  const inp = (label, key, type = 'number', ph = '') => (
    <div key={key}>
      <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>{label}</label>
      <input type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={ph} step="0.001"
        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '9px', fontSize: 14, boxSizing: 'border-box', textAlign: 'center', fontWeight: 700 }} />
    </div>
  );

  return (
    <div>
      {ticket && <TicketView data={ticket} type="bobine" onClose={() => setTicket(null)} />}
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1d4ed8' }}>
        ⚙ Extrusion — Saisie Bobines
      </h3>

      {/* Sélection OF */}
      {!ofSel ? (
        <div>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Sélectionnez votre OF :</p>
          {ofs.map(o => (
            <div key={o.id} onClick={() => selOf(o)} style={{
              background: '#fff', borderRadius: 12, padding: '14px 18px',
              border: '2px solid #bfdbfe', marginBottom: 10, cursor: 'pointer'
            }}>
              <div style={{ fontWeight: 800, color: '#1d4ed8', fontSize: 15 }}>{o.numero_of}</div>
              <div style={{ fontSize: 13 }}>{o.article_code} — {o.article_nom} | {o.couleur || ''}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Machine : {o.machine_code || '—'} | Cible : {o.at3_poids_cible_kg || '—'} kg |
                Fait : {parseFloat(o.poids_fait_kg || 0).toFixed(1)} kg ({o.nb_bobines_faites || 0} bobines)
              </div>
              {o.at3_notes_regleur && (
                <div style={{ background: '#fef3c7', borderRadius: 8, padding: '6px 10px', fontSize: 12, marginTop: 8, color: '#92400e' }}>
                  📋 Régleur : {o.at3_notes_regleur}
                </div>
              )}
            </div>
          ))}
          {ofs.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <div style={{ fontSize: 32 }}>⚙</div>
              <p>Aucun OF actif en extrusion</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* En-tête OF sélectionné */}
          <div style={{ background: '#dbeafe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, color: '#1d4ed8', fontSize: 15 }}>{ofSel.numero_of}</div>
              <div style={{ fontSize: 13 }}>{ofSel.article_code} — {ofSel.article_nom}</div>
              <div style={{ fontSize: 12, color: '#1d4ed8' }}>
                Cible : {ofSel.at3_poids_cible_kg || '—'} kg | {ofSel.at3_nb_bobines_cibles || '—'} bobines prévues
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>{bobines.length}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>bobines créées</div>
              <button onClick={() => { setOfSel(null); setBobines([]); }} style={{
                marginTop: 6, background: '#fff', border: '1px solid #93c5fd', color: '#1d4ed8',
                padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11
              }}>← Changer OF</button>
            </div>
          </div>

          {/* Formulaire nouvelle bobine */}
          {showForm ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #1d4ed8', padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: 14 }}>🆕 Nouvelle Bobine</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
                {inp('Poids brut (kg) *', 'poids_brut_kg', 'number', '0.000')}
                {inp('Poids net (kg) *', 'poids_net_kg', 'number', '0.000')}
                {inp('Poids mandrin (kg)', 'poids_mandrin_kg', 'number', '0.000')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                {inp('Longueur (m)', 'longueur_m', 'number', '0')}
                {inp('Temp. (°C)', 'temperature_c', 'number', '0')}
                {inp('Vitesse (m/min)', 'vitesse_m_min', 'number', '0')}
                {inp('Pression (bar)', 'pression_bar', 'number', '0')}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={creerBobine} disabled={loading} style={{
                  background: '#1d4ed8', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14
                }}>
                  {loading ? '...' : '✓ Valider & Imprimer ticket'}
                </button>
                <button onClick={() => setShowForm(false)} style={{
                  background: '#f3f4f6', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer'
                }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)} style={{
              background: '#1d4ed8', color: '#fff', border: 'none',
              padding: '12px 28px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
              fontSize: 15, marginBottom: 16, width: '100%'
            }}>
              + Nouvelle Bobine
            </button>
          )}

          {/* Liste bobines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bobines.map(b => (
              <div key={b.id} style={{
                background: '#fff', borderRadius: 10, padding: '10px 14px',
                border: '1px solid #dbeafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', fontFamily: 'monospace' }}>{b.numero_bobine}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>LOT: {b.numero_lot} | Zone: {b.zone_code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: '#15803d' }}>{parseFloat(b.poids_net_kg).toFixed(3)} kg</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(b.created_at).toLocaleTimeString('fr-FR')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE 3 : QUARANTAINE — Chef atelier valide → Impression
// ─────────────────────────────────────────────────────────────
function ModuleQuarantaine() {
  const [bobines, setBobines] = useState([]);
  const [selIds, setSelIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const charger = async () => {
    try { const { data } = await axios.get(`${API}/at3/quarantaine`); setBobines(data); }
    catch { toast.error('Erreur chargement quarantaine'); }
  };

  useEffect(() => { charger(); const t = setInterval(charger, 20000); return () => clearInterval(t); }, []);

  const toggle = (id) => setSelIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toutSelectionner = () => setSelIds(selIds.length === bobines.length ? [] : bobines.map(b => b.id));

  const valider = async () => {
    if (!selIds.length) return toast.error('Sélectionnez au moins une bobine');
    const ofId = bobines.find(b => selIds.includes(b.id))?.of_id;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/at3/quarantaine/valider`, { bobines_ids: selIds, of_id: ofId, notes });
      toast.success(data.message);
      setSelIds([]);
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  const rejeter = async (id) => {
    const motif = prompt('Motif de rejet :');
    if (!motif) return;
    try {
      await axios.post(`${API}/at3/quarantaine/rejeter`, { bobine_id: id, motif });
      toast.success('Bobine rejetée → rebut');
      charger();
    } catch { toast.error('Erreur'); }
  };

  const poidsTotal = bobines.filter(b => selIds.includes(b.id)).reduce((s, b) => s + parseFloat(b.poids_net_kg || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400e' }}>
          ⏳ Zone de Quarantaine
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
            {bobines.length} bobine(s)
          </span>
          <button onClick={charger} style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
            🔄
          </button>
        </div>
      </div>

      {bobines.length > 0 && (
        <>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #fcd34d', padding: '10px 16px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={toutSelectionner} style={{ background: '#f3f4f6', border: '1px solid #d1d5db', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
              {selIds.length === bobines.length ? '☐ Désélectionner' : '☑ Tout sélectionner'}
            </button>
            {selIds.length > 0 && (
              <>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  {selIds.length} sélectionnée(s) — {poidsTotal.toFixed(3)} kg
                </span>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notes (optionnel)..."
                  style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 12 }} />
                <button onClick={valider} disabled={loading} style={{
                  background: '#14532d', color: '#fff', border: 'none',
                  padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700
                }}>
                  {loading ? '...' : `✓ Valider → Impression`}
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bobines.map(b => {
              const sel = selIds.includes(b.id);
              const mins = Math.round(b.minutes_en_quarantaine || 0);
              return (
                <div key={b.id} onClick={() => toggle(b.id)} style={{
                  background: sel ? '#fef9c3' : '#fff',
                  borderRadius: 10, padding: '12px 16px',
                  border: `2px solid ${sel ? '#fcd34d' : '#fef3c7'}`,
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid #fcd34d', background: sel ? '#fcd34d' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && '✓'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{b.numero_bobine}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        OF : {b.numero_of} | Machine : {b.machine_code} | {b.operateur_nom}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#92400e' }}>{parseFloat(b.poids_net_kg).toFixed(3)} kg</div>
                      <div style={{ fontSize: 10, color: mins > 120 ? '#dc2626' : '#9ca3af' }}>
                        {mins > 60 ? `${Math.floor(mins / 60)}h${mins % 60}min` : `${mins} min`}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); rejeter(b.id); }} style={{
                      background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11
                    }}>
                      Rebut
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {bobines.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', border: '1px solid #fef3c7', borderRadius: 12, color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
          <p>Zone de quarantaine vide</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE 4 : IMPRESSION
// ─────────────────────────────────────────────────────────────
function ModuleImpression() {
  const [bobines, setBobines] = useState([]);
  const [bobineSel, setBobineSel] = useState(null);
  const [form, setForm] = useState({ type_impression: 'jet_encre', couleur_encre: '', texte_imprime: '', controle_ok: true, nb_reprises: 0, motif_reprise: '', observations: '' });
  const [loading, setLoading] = useState(false);

  const charger = async () => {
    try { const { data } = await axios.get(`${API}/at3/impression`); setBobines(data); }
    catch { toast.error('Erreur'); }
  };

  useEffect(() => { charger(); }, []);

  const terminer = async () => {
    if (!bobineSel) return;
    setLoading(true);
    try {
      await axios.post(`${API}/at3/impression/terminer`, {
        bobine_id: bobineSel.id,
        of_id: bobineSel.of_id,
        ...form
      });
      toast.success('Impression terminée → Emballage');
      setBobineSel(null);
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#6d28d9' }}>
        🖨 Poste Impression
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: bobineSel ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Liste bobines */}
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            {bobines.length} bobine(s) à imprimer
          </div>
          {bobines.map(b => (
            <div key={b.id} onClick={() => { setBobineSel(b); setForm({ type_impression: 'jet_encre', couleur_encre: '', texte_imprime: b.numero_lot || '', controle_ok: true, nb_reprises: 0, motif_reprise: '', observations: '' }); }}
              style={{
                background: bobineSel?.id === b.id ? '#f3e8ff' : '#fff',
                border: `2px solid ${bobineSel?.id === b.id ? '#a78bfa' : '#e9d5ff'}`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer'
              }}>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#6d28d9' }}>{b.numero_bobine}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                OF: {b.numero_of} | {b.article_code} — {b.article_nom}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {b.longueur_mm}x{b.largeur_mm}mm | {b.couleur} | LOT: {b.numero_lot}
              </div>
            </div>
          ))}
          {bobines.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #c4b5fd', borderRadius: 12 }}>
              <div style={{ fontSize: 36 }}>🖨</div>
              <p>Aucune bobine en attente d'impression</p>
            </div>
          )}
        </div>

        {/* Formulaire impression */}
        {bobineSel && (
          <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #a78bfa', padding: 20 }}>
            <div style={{ fontWeight: 800, color: '#6d28d9', marginBottom: 14 }}>
              Impression : {bobineSel.numero_bobine}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Type d'impression</label>
                <select value={form.type_impression} onChange={e => setForm({ ...form, type_impression: e.target.value })}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 8, fontSize: 13 }}>
                  {['jet_encre', 'laser', 'flexographie', 'serigraphie'].map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              {[
                ['Couleur encre', 'couleur_encre', 'text', 'ex: Noir, Bleu...'],
                ['Texte imprimé / Références', 'texte_imprime', 'text', ''],
                ['Nb reprises', 'nb_reprises', 'number', '0'],
              ].map(([l, k, t, ph]) => (
                <div key={k}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>{l}</label>
                  <input type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                    placeholder={ph}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 8, fontSize: 13, boxSizing: 'border-box', textAlign: t === 'number' ? 'center' : 'left' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Observations</label>
                <textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" id="ctrl_ok" checked={form.controle_ok}
                  onChange={e => setForm({ ...form, controle_ok: e.target.checked })}
                  style={{ width: 16, height: 16 }} />
                <label htmlFor="ctrl_ok" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Contrôle visuel OK
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={terminer} disabled={loading} style={{
                flex: 1, background: '#6d28d9', color: '#fff', border: 'none',
                padding: '10px', borderRadius: 8, cursor: 'pointer', fontWeight: 700
              }}>
                {loading ? '...' : '✓ Terminer → Emballage'}
              </button>
              <button onClick={() => setBobineSel(null)} style={{
                background: '#f3f4f6', border: 'none', padding: '10px 14px', borderRadius: 8, cursor: 'pointer'
              }}>✕</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE 5 : EMBALLAGE & PALETTES
// ─────────────────────────────────────────────────────────────
function ModuleEmballage() {
  const [bobines, setBobines] = useState([]);
  const [selBobines, setSelBobines] = useState([]);
  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState({ nb_sacs: '', poids_sacs_kg: '', poids_palette_kg: '', type_emballage: 'film_etirable', nb_couches: '', sacs_par_couche: '' });
  const [loading, setLoading] = useState(false);

  const charger = async () => {
    try { const { data } = await axios.get(`${API}/at3/emballage`); setBobines(data); }
    catch { toast.error('Erreur'); }
  };

  useEffect(() => { charger(); }, []);

  const toggleBobine = (b) => setSelBobines(prev =>
    prev.find(p => p.id === b.id) ? prev.filter(p => p.id !== b.id) : [...prev, b]
  );

  const creerPalette = async () => {
    if (!selBobines.length) return toast.error('Sélectionnez au moins une bobine');
    if (!form.nb_sacs || !form.poids_sacs_kg) return toast.error('Nb sacs et poids requis');
    setLoading(true);
    try {
      const of_id = selBobines[0].of_id;
      const article_id = selBobines[0].article_id;
      const { data } = await axios.post(`${API}/at3/emballage/palette`, {
        of_id, article_id,
        article_code: selBobines[0].article_code,
        article_nom: selBobines[0].article_nom,
        bobines_ids: selBobines.map(b => b.id),
        ...form
      });
      toast.success(data.message);
      const ticketRes = await axios.get(`${API}/at3/ticket/palette/${data.palette.id}`);
      setTicket(ticketRes.data);
      setSelBobines([]);
      setForm({ nb_sacs: '', poids_sacs_kg: '', poids_palette_kg: '', type_emballage: 'film_etirable', nb_couches: '', sacs_par_couche: '' });
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  return (
    <div>
      {ticket && <TicketView data={ticket} type="palette" onClose={() => setTicket(null)} />}
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#065f46' }}>
        📦 Découpe & Emballage
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Bobines à emballer */}
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            Bobines imprimées disponibles — Sélectionnez pour créer une palette :
          </div>
          {bobines.map(b => {
            const sel = selBobines.find(s => s.id === b.id);
            return (
              <div key={b.id} onClick={() => toggleBobine(b)} style={{
                background: sel ? '#ecfdf5' : '#fff',
                border: `2px solid ${sel ? '#6ee7b7' : '#d1fae5'}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 6, cursor: 'pointer'
              }}>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#065f46' }}>{b.numero_bobine}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>OF: {b.numero_of} | {parseFloat(b.poids_net_kg).toFixed(3)} kg</div>
              </div>
            );
          })}
          {bobines.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #6ee7b7', borderRadius: 12 }}>
              <div style={{ fontSize: 36 }}>📦</div>
              <p>Aucune bobine en attente d'emballage</p>
            </div>
          )}
        </div>

        {/* Formulaire palette */}
        <div style={{ background: '#fff', borderRadius: 12, border: '2px solid #6ee7b7', padding: 20 }}>
          <div style={{ fontWeight: 700, color: '#065f46', marginBottom: 12 }}>
            Créer Palette — {selBobines.length} bobine(s) sélectionnée(s)
          </div>
          {selBobines.length > 0 && (
            <div style={{ background: '#ecfdf5', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
              OF: {selBobines[0].numero_of} | Poids bobines: {selBobines.reduce((s, b) => s + parseFloat(b.poids_net_kg || 0), 0).toFixed(3)} kg
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Nb sacs *', 'nb_sacs', 'number'],
              ['Poids sacs (kg) *', 'poids_sacs_kg', 'number'],
              ['Poids palette (kg)', 'poids_palette_kg', 'number'],
              ['Nb couches', 'nb_couches', 'number'],
              ['Sacs/couche', 'sacs_par_couche', 'number'],
            ].map(([l, k, t]) => (
              <div key={k}>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>{l}</label>
                <input type={t} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 8, fontSize: 14, boxSizing: 'border-box', textAlign: 'center', fontWeight: 700 }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Type emballage</label>
              <select value={form.type_emballage} onChange={e => setForm({ ...form, type_emballage: e.target.value })}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 8, fontSize: 13 }}>
                {['film_etirable', 'carton', 'filet', 'vrac'].map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          {form.poids_sacs_kg && form.poids_palette_kg && (
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 13, fontWeight: 700, color: '#15803d' }}>
              Poids total : {(parseFloat(form.poids_sacs_kg || 0) + parseFloat(form.poids_palette_kg || 0)).toFixed(2)} kg
            </div>
          )}
          <button onClick={creerPalette} disabled={loading || !selBobines.length} style={{
            width: '100%', marginTop: 16, background: '#065f46', color: '#fff', border: 'none',
            padding: '12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14
          }}>
            {loading ? '...' : '📦 Créer Palette & Imprimer Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE 6 : STOCK AT3 & CESSION MAGASIN
// ─────────────────────────────────────────────────────────────
function ModuleCession() {
  const [stock, setStock] = useState([]);
  const [cessions, setCessions] = useState([]);
  const [selPalettes, setSelPalettes] = useState([]);
  const [notesCession, setNotesCession] = useState('');
  const [loading, setLoading] = useState(false);
  const [onglet, setOnglet] = useState('stock');

  const charger = async () => {
    try {
      const [s, c] = await Promise.all([
        axios.get(`${API}/at3/stock`),
        axios.get(`${API}/at3/cessions`),
      ]);
      setStock(s.data);
      setCessions(c.data);
    } catch { toast.error('Erreur'); }
  };

  useEffect(() => { charger(); }, []);

  const togglePalette = (p) => setSelPalettes(prev =>
    prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]
  );

  const creerCession = async () => {
    if (!selPalettes.length) return toast.error('Sélectionnez au moins une palette');
    const of_id = selPalettes[0].of_id;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/at3/cessions`, {
        of_id,
        palettes_ids: selPalettes.map(p => p.id),
        notes_chef: notesCession
      });
      toast.success(data.message);
      setSelPalettes([]);
      setNotesCession('');
      charger();
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur'); }
    setLoading(false);
  };

  const STATUT_CES = {
    brouillon: { bg: '#f3f4f6', tx: '#374151', label: 'Brouillon' },
    soumis:    { bg: '#dbeafe', tx: '#1d4ed8', label: 'Soumis' },
    accepte:   { bg: '#dcfce7', tx: '#15803d', label: 'Accepté ✓' },
    rejete:    { bg: '#fee2e2', tx: '#dc2626', label: 'Rejeté' },
  };

  const totaux = selPalettes.reduce((acc, p) => ({
    sacs: acc.sacs + (p.nb_sacs || 0),
    poids: acc.poids + parseFloat(p.poids_sacs_kg || 0)
  }), { sacs: 0, poids: 0 });

  return (
    <div>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#15803d' }}>
        🏗 Stock AT3 & Cession Magasin Central
      </h3>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '2px solid #e5e7eb', width: 'fit-content' }}>
        {[['stock', '📦 Stock AT3'], ['cessions', '📤 Cessions']].map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{
            padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: onglet === id ? '#15803d' : '#fff', color: onglet === id ? '#fff' : '#6b7280'
          }}>{label}</button>
        ))}
        <button onClick={charger} style={{ padding: '9px 12px', border: 'none', background: '#f3f4f6', cursor: 'pointer', borderLeft: '2px solid #e5e7eb' }}>🔄</button>
      </div>

      {onglet === 'stock' && (
        <>
          {selPalettes.length > 0 && (
            <div style={{ background: '#f0fdf4', borderRadius: 12, border: '2px solid #86efac', padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                {selPalettes.length} palette(s) — {totaux.sacs} sacs — {totaux.poids.toFixed(2)} kg
              </div>
              <input value={notesCession} onChange={e => setNotesCession(e.target.value)}
                placeholder="Notes cession..."
                style={{ border: '1px solid #86efac', borderRadius: 8, padding: '6px 12px', fontSize: 12, flex: 1 }} />
              <button onClick={creerCession} disabled={loading} style={{
                background: '#15803d', color: '#fff', border: 'none',
                padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700
              }}>
                {loading ? '...' : '📤 Créer Bon de Cession'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stock.map(p => {
              const sel = selPalettes.find(s => s.id === p.id);
              return (
                <div key={p.id} onClick={() => togglePalette(p)} style={{
                  background: sel ? '#f0fdf4' : '#fff',
                  border: `2px solid ${sel ? '#86efac' : '#e5e7eb'}`,
                  borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid #86efac', background: sel ? '#86efac' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && '✓'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#15803d', fontSize: 13 }}>{p.numero_palette}</div>
                      <div style={{ fontSize: 12, color: '#374151' }}>OF: {p.numero_of} | {p.article_code} — {p.article_nom}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>LOT: {p.numero_lot} | Par: {p.emballeur_nom}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#15803d' }}>{p.nb_sacs} sacs</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{parseFloat(p.poids_sacs_kg || 0).toFixed(2)} kg net</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
              );
            })}
            {stock.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: 12, color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🏗</div>
                <p>Stock AT3 vide</p>
              </div>
            )}
          </div>
        </>
      )}

      {onglet === 'cessions' && (
        <div>
          {cessions.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontFamily: 'monospace', color: '#15803d', fontSize: 14 }}>{c.numero_cession}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>OF: {c.numero_of} | Chef: {c.chef_nom}</div>
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
                    {c.nb_palettes} palette(s) — {c.nb_sacs_total} sacs — {parseFloat(c.poids_total_kg || 0).toFixed(2)} kg
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge statut={c.statut} map={STATUT_CES} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    {new Date(c.date_cession).toLocaleString('fr-FR')}
                  </div>
                  {c.receptionnaire_nom && (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Reçu par: {c.receptionnaire_nom}</div>
                  )}
                </div>
              </div>
              {c.notes_chef && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>Note: {c.notes_chef}</div>
              )}
            </div>
          ))}
          {cessions.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 36 }}>📤</div>
              <p>Aucune cession</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL — Flux AT3 complet
// ─────────────────────────────────────────────────────────────
export default function Atelier3Flux() {
  const [module, setModule] = useState('dashboard');
  const [dashData, setDashData] = useState({ zones: [], flux: [], mouvements_jour: [] });

  useEffect(() => {
    if (module === 'dashboard') {
      axios.get(`${API}/at3/dashboard`).then(r => setDashData(r.data)).catch(() => {});
    }
  }, [module]);

  const MODULES = [
    { id: 'dashboard',  icon: '📊', label: 'Tableau de bord',    color: '#14532d' },
    { id: 'chef',       icon: '📋', label: 'Chef Atelier',        color: '#1d4ed8' },
    { id: 'extrusion',  icon: '⚙',  label: 'Extrusion',           color: '#0369a1' },
    { id: 'quarantaine',icon: '⏳', label: 'Quarantaine',          color: '#92400e' },
    { id: 'impression', icon: '🖨',  label: 'Impression',           color: '#6d28d9' },
    { id: 'emballage',  icon: '📦', label: 'Emballage',            color: '#065f46' },
    { id: 'cession',    icon: '📤', label: 'Stock AT3 & Cession',  color: '#15803d' },
    { id: 'mouvements', icon: '🔄', label: 'Tickets / Mouvements', color: '#374151' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#14532d,#166534)', borderRadius: 14, padding: '16px 20px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>🏭 Atelier 3 — Flux de Production Complet</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
          Extrusion → Quarantaine → Impression → Emballage → Stock AT3 → Cession Magasin
        </div>
      </div>

      {/* Navigation modules */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setModule(m.id)} style={{
            background: module === m.id ? m.color : '#fff',
            color: module === m.id ? '#fff' : m.color,
            border: `2px solid ${m.color}`,
            padding: '7px 14px', borderRadius: 10, cursor: 'pointer',
            fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap'
          }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {module === 'dashboard' && (
        <div>
          {/* Zones AT3 en temps réel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
            {(dashData.zones || []).filter(z => z.code !== 'MAGSIN').map(z => {
              const cfg = ZONE_CONFIG[z.code] || { bg: '#f3f4f6', tx: '#374151', icon: '📍', border: '#e5e7eb' };
              return (
                <div key={z.code} style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 10, color: cfg.tx, fontWeight: 700, marginBottom: 4 }}>{cfg.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: cfg.tx }}>{z.nb_bobines || 0}</div>
                  <div style={{ fontSize: 10, color: cfg.tx }}>bobines</div>
                  {z.poids_kg > 0 && <div style={{ fontSize: 11, color: cfg.tx, marginTop: 2 }}>{parseFloat(z.poids_kg).toFixed(1)} kg</div>}
                </div>
              );
            })}
          </div>

          {/* Mouvements du jour */}
          {(dashData.mouvements_jour || []).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: 10, fontSize: 13 }}>🔄 Mouvements aujourd'hui</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                {(dashData.mouvements_jour || []).map((m, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#374151' }}>{m.type_mouvement?.replace(/_/g, ' → ')}</div>
                    <div style={{ color: '#6b7280' }}>{m.nb} mouvement(s) — {parseFloat(m.poids || 0).toFixed(1)} kg</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flux OF */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }}>
            <div style={{ fontWeight: 700, color: '#14532d', marginBottom: 12, fontSize: 13 }}>📋 OF en cours — État du flux</div>
            {(dashData.flux || []).map(f => {
              const sc = STATUT_OF[f.at3_statut_zone] || STATUT_OF['nouveau'];
              return (
                <div key={f.of_id} style={{ borderBottom: '1px solid #f0fdf4', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 800, color: '#14532d', marginRight: 10 }}>{f.numero_of}</span>
                      <Badge statut={f.at3_statut_zone} map={STATUT_OF} />
                      <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 10 }}>{f.article_code} — {f.article_nom}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 12 }}>
                      <span>⚙ {f.nb_bobines_total || 0} bob.</span>
                      <span>📦 {f.nb_palettes || 0} pal.</span>
                      <span style={{ fontWeight: 700, color: '#15803d' }}>{parseFloat(f.poids_produit_kg || 0).toFixed(1)} kg</span>
                    </div>
                  </div>
                  <BarreFlux statut_zone={f.at3_statut_zone} />
                </div>
              );
            })}
            {!dashData.flux?.length && (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Aucun OF en cours</div>
            )}
          </div>
        </div>
      )}

      {/* ── MODULES ── */}
      {module === 'chef'        && <ModuleChefAtelier />}
      {module === 'extrusion'   && <ModuleExtrusion />}
      {module === 'quarantaine' && <ModuleQuarantaine />}
      {module === 'impression'  && <ModuleImpression />}
      {module === 'emballage'   && <ModuleEmballage />}
      {module === 'cession'     && <ModuleCession />}
      {module === 'mouvements'  && <ModuleMouvements />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE MOUVEMENTS / TICKETS
// ─────────────────────────────────────────────────────────────
function ModuleMouvements() {
  const [mvts, setMvts] = useState([]);
  const [filtre, setFiltre] = useState('');

  useEffect(() => {
    axios.get(`${API}/at3/mouvements?limit=100`).then(r => setMvts(r.data)).catch(() => {});
  }, []);

  const TYPE_LABEL = {
    extrusion_quarantaine: { label: 'Extrusion → Quarantaine', color: '#92400e', bg: '#fef3c7' },
    quarantaine_impression: { label: 'Quarantaine → Impression', color: '#6d28d9', bg: '#f3e8ff' },
    impression_emballage: { label: 'Impression → Emballage', color: '#065f46', bg: '#ecfdf5' },
    emballage_stock_at3: { label: 'Emballage → Stock AT3', color: '#15803d', bg: '#dcfce7' },
    stock_at3_magasin: { label: 'Stock AT3 → Magasin', color: '#0369a1', bg: '#dbeafe' },
  };

  const filtres = mvts.filter(m => !filtre || m.of_id?.toString() === filtre || m.numero_of?.includes(filtre));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#374151' }}>🔄 Tickets de Mouvement AT3</h3>
        <input value={filtre} onChange={e => setFiltre(e.target.value)}
          placeholder="🔍 Filtrer par OF..."
          style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 12px', fontSize: 12, flex: 1, maxWidth: 200 }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['N° Ticket', 'Mouvement', 'OF', 'Nb bobines', 'Poids', 'Statut', 'Par', 'Date'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtres.map((m, i) => {
              const tc = TYPE_LABEL[m.type_mouvement] || { label: m.type_mouvement, color: '#374151', bg: '#f3f4f6' };
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#374151' }}>{m.numero_ticket}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: tc.bg, color: tc.color, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{tc.label}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#14532d' }}>{m.numero_of}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{m.nb_bobines}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#15803d' }}>{parseFloat(m.poids_total_kg || 0).toFixed(2)} kg</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: m.statut === 'valide' ? '#dcfce7' : m.statut === 'en_attente' ? '#fef3c7' : '#f3f4f6', color: m.statut === 'valide' ? '#15803d' : m.statut === 'en_attente' ? '#92400e' : '#374151', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                      {m.statut}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{m.cree_par_nom}</td>
                  <td style={{ padding: '8px 12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {new Date(m.date_mouvement).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtres.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <div style={{ fontSize: 32 }}>🔄</div>
            <p>Aucun mouvement</p>
          </div>
        )}
      </div>
    </div>
  );
}
