import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
// QRCode importé dynamiquement dans TicketImprimable

const API = '/api';

function fmt(n, dec = 0) {
  if (n === null || n === undefined || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('fr-FR', { maximumFractionDigits: dec });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR');
}

const SECTIONS = [
  {
    id: 'dimensions', titre: 'Dimensions à vérifier', icon: '📐',
    champs: [
      { key: 'largeur_mm',     label: 'Largeur',          type: 'number', unite: 'mm',  requis: true },
      { key: 'soufflet_mm',    label: 'Soufflet',         type: 'number', unite: 'mm'  },
      { key: 'epaisseur_um',   label: 'Épaisseur cible',  type: 'number', unite: 'µm',  requis: true },
      { key: 'metrage_bobine', label: 'Métrage / bobine', type: 'number', unite: 'm'   },
      { key: 'nb_bobines',     label: 'Nb bobines',       type: 'number', unite: 'bobs'},
      { key: 'poids_bobine',   label: 'Poids bobine',     type: 'number', unite: 'kg'  },
    ],
  },
  {
    id: 'machine', titre: 'Réglages machine', icon: '⚙️',
    champs: [
      { key: 'temp_zone1',     label: 'T° Zone 1',      type: 'number', unite: '°C',     requis: true, min: 100, max: 280 },
      { key: 'temp_zone2',     label: 'T° Zone 2',      type: 'number', unite: '°C',     min: 100, max: 280 },
      { key: 'temp_zone3',     label: 'T° Zone 3',      type: 'number', unite: '°C',     min: 100, max: 280 },
      { key: 'temp_filiere',   label: 'T° Filière',     type: 'number', unite: '°C',     min: 100, max: 300 },
      { key: 'pression_bar',   label: 'Pression',       type: 'number', unite: 'bar',    requis: true, min: 0, max: 400 },
      { key: 'vitesse_vis',    label: 'Vitesse vis',    type: 'number', unite: 'tr/min', min: 0, max: 200 },
      { key: 'vitesse_tirage', label: 'Vitesse tirage', type: 'number', unite: 'm/min',  min: 0, max: 100 },
      { key: 'corona',         label: 'Corona',         type: 'select', options: ['Non', 'Oui'] },
    ],
  },
];
const TOTAL_CHAMPS = SECTIONS.reduce((a, s) =>
  a + s.champs.filter(c => c.type !== 'select').length, 0);

// ═══════════════════════════════════════════════════════════════
// REMPLACER le composant TicketImprimable dans Regleur.jsx
// par ce composant style ticket de caisse avec QR code
// ═══════════════════════════════════════════════════════════════
// Coller CE BLOC à la place de l'ancien TicketImprimable

// Import à ajouter en tête de fichier (après les autres imports) :
// import QRCode from 'qrcode';

// ─── TICKET STYLE CAISSE + QR ────────────────────────────────────────────────
function TicketImprimable({ record, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  useEffect(() => {
    const qrStr = [
      'REGLAGE',
      record.numero_of,
      `ART:${record.article || ''}`,
      `MACH:${record.machine_code || record.machine_nom || ''}`,
      `T1:${record.temperature || ''}°C`,
      `P:${record.pression || ''}bar`,
      `L:${(() => { try { return JSON.parse(record.notes||'{}').params_complets?.largeur_mm||''; } catch { return ''; } })()}mm`,
      record.valide_at ? new Date(record.valide_at).toLocaleDateString('fr-FR') : '',
    ].join('|');
    import('qrcode').then(QRCode => {
      QRCode.default.toDataURL(qrStr, {
        width: 140, margin: 1,
        color: { dark: '#312e81', light: '#ffffff' }
      }).then(url => setQrDataUrl(url));
    }).catch(() => {});
  }, [record]);

  let params = {};
  let notesLibres = '';
  try {
    const parsed = JSON.parse(record.notes || '{}');
    params = parsed.params_complets || {};
    notesLibres = parsed.notes_libres || '';
  } catch {}

  const lignes = [
    { l: 'N° TICKET', v: record.numero_ticket_reglage || '—', bold: true },
    { l: 'OF',        v: record.numero_of },
    { l: 'ARTICLE',   v: record.article },
    { l: 'COULEUR',   v: record.couleur || '—' },
    { l: 'CLIENT',    v: record.client_nom || '—' },
    { l: 'MACHINE',   v: record.machine_nom || record.machine_code || '—' },
    null,
    { l: 'QUANTITE',  v: `${fmt(record.quantite_cible)} ${record.unite_libelle || record.unite_code || ''}`, bold: true },
    { l: 'POIDS',     v: record.poids_total_kg ? `${fmt(record.poids_total_kg, 1)} kg` : '—', bold: true },
    { l: 'LIVRAISON', v: record.date_livraison_prevue ? new Date(record.date_livraison_prevue).toLocaleDateString('fr-FR') : '—' },
    null,
    { l: 'LARGEUR',      v: params.largeur_mm    ? `${params.largeur_mm} mm`    : '—' },
    { l: 'SOUFFLET',     v: params.soufflet_mm   ? `${params.soufflet_mm} mm`   : '—' },
    { l: 'EPAISSEUR',    v: params.epaisseur_um  ? `${params.epaisseur_um} µm`  : '—' },
    null,
    { l: 'T° ZONE 1',    v: params.temp_zone1    ? `${params.temp_zone1} °C`    : `${record.temperature || '—'} °C`, bold: true },
    { l: 'T° ZONE 2',    v: params.temp_zone2    ? `${params.temp_zone2} °C`    : '—' },
    { l: 'T° ZONE 3',    v: params.temp_zone3    ? `${params.temp_zone3} °C`    : '—' },
    { l: 'T° FILIERE',   v: params.temp_filiere  ? `${params.temp_filiere} °C`  : '—' },
    { l: 'PRESSION',     v: params.pression_bar  ? `${params.pression_bar} bar` : `${record.pression || '—'} bar`, bold: true },
    { l: 'VIT. VIS',     v: params.vitesse_vis   ? `${params.vitesse_vis} tr/min`: `${record.vitesse || '—'} tr/min` },
    { l: 'VIT. TIRAGE',  v: params.vitesse_tirage ? `${params.vitesse_tirage} m/min` : '—' },
    { l: 'CORONA',       v: params.corona || '—' },
  ];

  const printContent = `
    <!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Réglage ${record.numero_of}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Courier New',monospace; font-size:11px; width:72mm; margin:0 auto; padding:4mm; background:#fff; color:#000; }
      .center { text-align:center; }
      .bold   { font-weight:bold; }
      .big    { font-size:15px; font-weight:900; }
      .hr-dash{ border:none; border-top:1px dashed #000; margin:4px 0; }
      .hr-solid{border:none; border-top:2px solid #000; margin:4px 0; }
      .row    { display:flex; justify-content:space-between; padding:1px 0; }
      .row .label { color:#444; }
      .row .val   { font-weight:bold; text-align:right; max-width:55%; word-break:break-all; }
      .qr     { text-align:center; margin:6px 0; }
      .sig    { border:1px solid #000; min-height:12mm; margin-top:2mm; padding:2mm; font-size:9px; }
      .sig-label { font-size:8px; font-weight:bold; text-transform:uppercase; margin-bottom:1mm; }
      .footer { font-size:8px; color:#666; text-align:center; margin-top:3mm; border-top:1px dashed #999; padding-top:2mm; }
      @media print { @page { size: 72mm auto; margin: 0; } }
    </style></head>
    <body onload="window.print()">
      <div class="center bold big">NAI — AT3 EXTRUSION</div>
      <div class="center" style="font-size:9px;color:#555;">NAI</div>
      <hr class="hr-solid"/>
      <div class="center bold" style="font-size:13px;letter-spacing:1px;">FICHE DE RÉGLAGE MACHINE</div>
      <div class="center" style="font-size:9px;">ENR.ALP1-006 — Validation régleur</div>
      <hr class="hr-dash"/>
      ${lignes.map(l => l === null
        ? `<hr class="hr-dash"/>`
        : `<div class="row ${l.bold ? 'bold' : ''}">
             <span class="label">${l.l}</span>
             <span class="val">${l.v}</span>
           </div>`
      ).join('')}
      <hr class="hr-dash"/>
      ${notesLibres ? `<div style="font-size:9px;margin:2px 0;"><b>REMARQUES:</b> ${notesLibres}</div><hr class="hr-dash"/>` : ''}
      <div class="qr">
        ${qrDataUrl ? `<img src="${qrDataUrl}" width="120" height="120"/>` : ''}
        <div style="font-size:8px;color:#666;">${record.numero_of}</div>
      </div>
      <hr class="hr-dash"/>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;">
        <div class="sig"><div class="sig-label">Régleur</div>${record.regleur_nom || ''}<br/><br/><br/>Signature :</div>
        <div class="sig"><div class="sig-label">Chef atelier</div><br/><br/><br/>Signature :</div>
      </div>
      <div class="footer">
        <div>${record.regleur_nom || ''} — ${record.valide_at ? new Date(record.valide_at).toLocaleString('fr-FR') : ''}</div>
        <div>© NAIdo — NAI</div>
      </div>
    </body></html>
  `;

  const imprimer = () => {
    const w = window.open('', '_blank', 'width=400,height=700');
    w.document.write(printContent);
    w.document.close();
  };

  // Aperçu écran style caisse
  return (
    <div style={S.overlay}>
      <div style={{ background:'#fff', borderRadius:16, width:320, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.4)', fontFamily:"'Courier New', monospace" }}>
        {/* ACTIONS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #e0e7ff', position:'sticky', top:0, background:'#fff' }}>
          <div style={{ fontWeight:800, fontSize:13 }}>🖨️ Aperçu ticket</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={imprimer} style={{ background:'#14532d', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:12 }}>
              🖨️ Imprimer
            </button>
            <button onClick={onClose} style={{ background:'#f3f4f6', border:'none', padding:'8px 12px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:12 }}>✕</button>
          </div>
        </div>

        {/* TICKET APERÇU */}
        <div style={{ padding:'14px 16px', fontSize:11, color:'#000' }}>
          <div style={{ textAlign:'center', fontWeight:900, fontSize:15 }}>NAI — AT3 EXTRUSION</div>
          <div style={{ textAlign:'center', fontSize:9, color:'#555' }}>NAI</div>
          <div style={{ borderTop:'2px solid #000', margin:'6px 0' }}/>
          <div style={{ textAlign:'center', fontWeight:800, fontSize:13, letterSpacing:1 }}>FICHE DE RÉGLAGE</div>
          <div style={{ textAlign:'center', fontSize:9, color:'#666' }}>ENR.ALP1-006</div>
          <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }}/>

          {lignes.map((l, i) => l === null
            ? <div key={i} style={{ borderTop:'1px dashed #ccc', margin:'5px 0' }}/>
            : <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'1px 0', fontWeight: l.bold ? 700 : 400, fontSize: l.bold ? 12 : 11 }}>
                <span style={{ color:'#444' }}>{l.l}</span>
                <span style={{ fontWeight:700, textAlign:'right', maxWidth:'55%', wordBreak:'break-all' }}>{l.v}</span>
              </div>
          )}

          {notesLibres && (
            <>
              <div style={{ borderTop:'1px dashed #ccc', margin:'5px 0' }}/>
              <div style={{ fontSize:9 }}><strong>REMARQUES:</strong> {notesLibres}</div>
            </>
          )}

          <div style={{ borderTop:'1px dashed #ccc', margin:'6px 0' }}/>

          {/* QR CODE */}
          <div style={{ textAlign:'center', margin:'8px 0' }}>
            {qrDataUrl
              ? <img src={qrDataUrl} width={120} height={120} alt="QR"/>
              : <div style={{ width:120, height:120, background:'#f3f4f6', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#9ca3af', borderRadius:4 }}>Génération QR...</div>
            }
            <div style={{ fontSize:9, color:'#666', marginTop:2 }}>{record.numero_of}</div>
          </div>

          <div style={{ borderTop:'1px dashed #ccc', margin:'6px 0' }}/>

          {/* SIGNATURES */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {['Régleur', 'Chef atelier'].map(s => (
              <div key={s} style={{ border:'1px solid #000', borderRadius:3, padding:'4px 6px', minHeight:40 }}>
                <div style={{ fontSize:8, fontWeight:700, textTransform:'uppercase' }}>{s}</div>
                {s === 'Régleur' && <div style={{ fontSize:9, color:'#333', marginTop:2 }}>{record.regleur_nom}</div>}
              </div>
            ))}
          </div>

          <div style={{ borderTop:'1px dashed #999', marginTop:8, paddingTop:4, fontSize:8, color:'#666', textAlign:'center' }}>
            <div>{record.regleur_nom} — {record.valide_at ? new Date(record.valide_at).toLocaleString('fr-FR') : ''}</div>
            <div>© NAIdo — NAI</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// HISTORIQUE COMPLET
// ═════════════════════════════════════════════════════════════════════════════
function EcranHistorique({ user, onBack }) {
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [ticket,   setTicket]   = useState(null);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    axios.get(`${API}/regleur/historique`)
      .then(r => setRecords(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Erreur chargement historique'))
      .finally(() => setLoading(false));
  }, []);

  const filtres = records.filter(r =>
    !search ||
    r.numero_of?.toLowerCase().includes(search.toLowerCase()) ||
    r.article?.toLowerCase().includes(search.toLowerCase()) ||
    r.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
    r.regleur_nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={S.page}>
      <header style={S.header}>
        <button style={S.btnBack} onClick={onBack}>← Retour</button>
        <div style={{ flex:1, margin:'0 10px' }}>
          <div style={S.htitle}>Historique des réglages</div>
          <div style={S.hsub}>{records.length} validation{records.length > 1 ? 's' : ''} au total</div>
        </div>
      </header>

      {/* RECHERCHE */}
      <div style={{ padding:'10px 16px', background:'#fff', borderBottom:'1px solid #e0e7ff' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher un OF, article, client, régleur..."
          style={{ ...S.inp, fontSize:14, fontWeight:400, textAlign:'left', padding:'11px 14px', borderColor:'#e0e7ff' }}
        />
      </div>

      <main style={S.main}>
        {loading ? (
          <div style={S.center}>Chargement...</div>
        ) : filtres.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
            <div style={{ fontWeight:700 }}>{search ? 'Aucun résultat' : 'Aucune validation enregistrée'}</div>
          </div>
        ) : filtres.map((r, i) => {
          let params = {};
          try { params = JSON.parse(r.notes || '{}').params_complets || {}; } catch {}
          return (
            <div key={i} style={{ ...S.card, borderLeft:'5px solid #6366f1' }}>
              <div style={S.row}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <div style={S.num}>{r.numero_of}</div>
                    <div style={{ ...S.badge, background:'#dcfce7', color:'#15803d', border:'1px solid #86efac' }}>✓ Validé</div>
                  </div>
                  <div style={S.sub}>{r.article}{r.couleur ? ` · ${r.couleur}` : ''}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
                    {r.client_nom} · {fmt(r.quantite_cible)} {r.unite_code || ''}
                    {r.poids_total_kg ? ` · ${fmt(r.poids_total_kg, 1)} kg` : ''}
                  </div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>
                    {r.machine_nom || r.machine_code || 'Machine NC'} · {r.regleur_nom || 'Régleur'} · {fmtDateTime(r.valide_at)}
                  </div>
                </div>
                <button onClick={() => setTicket(r)}
                  style={{ flexShrink:0, padding:'8px 12px', borderRadius:8, border:'1px solid #6366f1', background:'#ede9fe', color:'#4338ca', fontWeight:700, cursor:'pointer', fontSize:12 }}>
                  🖨️ Ticket
                </button>
              </div>

              {/* PARAMS RÉSUMÉ */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginTop:10 }}>
                {(params.temp_zone1 || r.temperature) && (
                  <Chip l="T° Z1" v={`${params.temp_zone1 || r.temperature}°C`} />
                )}
                {(params.pression_bar || r.pression) && (
                  <Chip l="Pression" v={`${params.pression_bar || r.pression} bar`} />
                )}
                {(params.largeur_mm || r.largeur_mm) && (
                  <Chip l="Largeur" v={`${params.largeur_mm || r.largeur_mm} mm`} />
                )}
                {(params.epaisseur_um || r.epaisseur_um) && (
                  <Chip l="Épais." v={`${params.epaisseur_um || r.epaisseur_um} µm`} />
                )}
              </div>
            </div>
          );
        })}
        <p style={{ textAlign:'center', color:'#9ca3af', fontSize:11, marginTop:16 }}>
          {filtres.length} résultat{filtres.length > 1 ? 's' : ''}
          {search ? ` pour "${search}"` : ' — historique complet'}
        </p>
      </main>

      {ticket && <TicketImprimable record={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LISTE
// ═════════════════════════════════════════════════════════════════════════════
function EcranListe({ user, onValider, onGmao, onHistorique }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [ofs,      setOfs]     = useState([]);
  const [sessions, setSessions]= useState([]);
  const [valides,  setValides] = useState([]);
  const [onglet,   setOnglet]  = useState('attente');
  const [loading,  setLoading] = useState(true);
  const [ticket,   setTicket]  = useState(null);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        axios.get(`${API}/of`).catch(() => ({ data: [] })),
        axios.get(`${API}/sessions/actives`).catch(() => ({ data: [] })),
      ]);
      const allOfs  = Array.isArray(r1.data) ? r1.data : [];
      const allSess = Array.isArray(r2.data) ? r2.data : [];
      setOfs(allOfs.filter(o => ['planifie','lance','en_attente_regleur'].includes(o.statut)));
      setSessions(allSess.filter(s => !s.regleur_valide));
      setValides(allSess.filter(s => s.regleur_valide));
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    charger();
    const iv = setInterval(charger, 20000);
    return () => clearInterval(iv);
  }, [charger]);

  const total = ofs.length + sessions.length;

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={S.avatar}>R</div>
          <div>
            <div style={S.htitle}>NAIdo — Régleur</div>
            <div style={S.hsub}>{user?.prenom} {user?.nom} · AT3 Extrusion</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button style={S.btnHisto} onClick={onHistorique}>📋 Historique</button>
          <button style={S.btnGmao}  onClick={onGmao}>🔧 GMAO</button>
          <button style={S.btnQ}     onClick={() => { logout(); navigate('/login'); }}>Quitter</button>
        </div>
      </header>

      <nav style={S.nav}>
        {[
          { id:'attente', label:`À régler (${total})` },
          { id:'valides', label:`Validés aujourd'hui (${valides.length})` },
        ].map(o => (
          <button key={o.id} style={{ ...S.tab, ...(onglet===o.id ? S.tabOn : {}) }} onClick={() => setOnglet(o.id)}>
            {o.label}
          </button>
        ))}
        <button style={{ ...S.tab, marginLeft:'auto', fontSize:18 }} onClick={charger}>↻</button>
      </nav>

      <main style={S.main}>
        {loading ? (
          <div style={S.center}>Chargement...</div>
        ) : onglet === 'attente' ? (
          <>
            {sessions.length > 0 && <SLabel color="#dc2626">⚠ Opérateurs en attente</SLabel>}
            {sessions.map(s => (
              <div key={s.id} style={{ ...S.card, borderLeft:'5px solid #ef4444', cursor:'pointer' }}
                onClick={() => onValider({ type:'session', data: s })}>
                <div style={S.row}>
                  <div>
                    <div style={S.num}>{s.numero_of}</div>
                    <div style={S.sub}>{s.article} · {s.machine_nom || s.machine_code}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>Opérateur : {s.operateur_nom}</div>
                  </div>
                  <div style={{ ...S.badge, background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}>URGENT →</div>
                </div>
              </div>
            ))}
            {ofs.length > 0 && <SLabel color="#6366f1">OFs à préparer</SLabel>}
            {ofs.map(o => (
              <div key={o.id} style={{ ...S.card, borderLeft:'5px solid #6366f1', cursor:'pointer' }}
                onClick={() => onValider({ type:'of', data: o })}>
                <div style={S.row}>
                  <div>
                    <div style={S.num}>{o.numero_of}</div>
                    <div style={S.sub}>{o.article_nom}{o.couleur ? ` · ${o.couleur}` : ''}</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>
                      {o.client_nom} · {fmt(o.quantite_cible)} {o.unite_code || ''}
                      {o.poids_theorique_total_kg ? ` · ${fmt(o.poids_theorique_total_kg, 1)} kg` : ''}
                      {o.machine_nom ? ` · ${o.machine_nom}` : ''}
                    </div>
                  </div>
                  <div style={{ ...S.badge, background:'#ede9fe', color:'#4338ca', border:'1px solid #c4b5fd' }}>Régler →</div>
                </div>
              </div>
            ))}
            {total === 0 && (
              <div style={S.empty}>
                <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
                <div style={{ fontWeight:700, fontSize:17 }}>Aucun OF en attente</div>
                <div style={{ color:'#9ca3af', marginTop:6, fontSize:14 }}>Tous les réglages sont à jour</div>
              </div>
            )}
          </>
        ) : (
          valides.length === 0
            ? <div style={S.empty}><div style={{ color:'#9ca3af' }}>Aucune validation aujourd'hui</div></div>
            : valides.map((v, i) => {
                let params = {};
                try { params = JSON.parse(v.regleur_notes || '{}').params_complets || {}; } catch {}
                const rec = {
                  ...v, numero_of: v.numero_of, article: v.article, couleur: v.couleur,
                  client_nom: v.client_nom, machine_nom: v.machine_nom, machine_code: v.machine_code,
                  quantite_cible: v.quantite_cible, unite_code: v.unite_code, unite_libelle: v.unite_libelle,
                  poids_total_kg: v.poids_total_kg, date_livraison_prevue: v.date_livraison_prevue,
                  regleur_nom: v.regleur_nom, valide_at: v.regleur_validation_at,
                  temperature: v.regleur_temperature, pression: v.regleur_pression, vitesse: v.regleur_vitesse,
                  notes: v.regleur_notes,
                };
                return (
                  <div key={i} style={{ ...S.card, borderLeft:'5px solid #10b981' }}>
                    <div style={{ ...S.row, marginBottom:10 }}>
                      <div>
                        <div style={S.num}>{v.numero_of}</div>
                        <div style={S.sub}>{v.article} · {v.machine_nom}</div>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <div style={{ ...S.badge, background:'#dcfce7', color:'#15803d', border:'1px solid #86efac' }}>✓ Validé</div>
                        <button onClick={() => setTicket(rec)}
                          style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #6366f1', background:'#ede9fe', color:'#4338ca', fontWeight:700, cursor:'pointer', fontSize:11 }}>
                          🖨️
                        </button>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                      {params.temp_zone1   && <Chip l="T° Z1"    v={`${params.temp_zone1}°C`} />}
                      {params.pression_bar && <Chip l="Pression" v={`${params.pression_bar} bar`} />}
                      {params.largeur_mm   && <Chip l="Largeur"  v={`${params.largeur_mm} mm`} />}
                    </div>
                  </div>
                );
              })
        )}
        <p style={{ textAlign:'center', color:'#9ca3af', fontSize:11, marginTop:32 }}>
          © 2026 NAIdo — NAI
        </p>
      </main>

      {ticket && <TicketImprimable record={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

function SLabel({ color, children }) {
  return <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:0.5 }}>{children}</div>;
}
function Chip({ l, v }) {
  return (
    <div style={{ background:'#f5f3ff', padding:'5px 7px', borderRadius:7 }}>
      <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase' }}>{l}</div>
      <div style={{ fontWeight:700, color:'#312e81', fontSize:11 }}>{v}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FORMULAIRE RÉGLAGE
// ═════════════════════════════════════════════════════════════════════════════
function EcranReglage({ cible, user, onBack, onSuccess }) {
  const estSession = cible.type === 'session';
  const item = cible.data;

  const [params,     setParams]     = useState({ corona: 'Non' });
  const [notes,      setNotes]      = useState('');
  const [secIdx,     setSecIdx]     = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmer,  setConfirmer]  = useState(false);

  useEffect(() => {
    setParams({
      corona:       'Non',
      largeur_mm:   item.largeur_mm   || '',
      soufflet_mm:  item.soufflet_mm  || '',
      epaisseur_um: item.epaisseur_um || '',
    });
  }, [item]);

  const setP = (k, v) => setParams(p => ({ ...p, [k]: v }));

  const nbRemplis = SECTIONS.reduce((a, s) =>
    a + s.champs.filter(c => c.type !== 'select' && params[c.key] !== undefined && params[c.key] !== '').length, 0);
  const pct = Math.round(nbRemplis / TOTAL_CHAMPS * 100);
  const peutValider = params.temp_zone1 && params.pression_bar && params.largeur_mm && params.epaisseur_um;

  const valider = async () => {
    setSubmitting(true);
    try {
      const payload = {
        temperature: parseFloat(params.temp_zone1   || 0),
        pression:    parseFloat(params.pression_bar || 0),
        vitesse:     parseFloat(params.vitesse_vis  || 0),
        notes:       JSON.stringify({ params_complets: params, notes_libres: notes }),
        regleur_id:  user?.id,
        of_id:       estSession ? item.of_id : item.id,
      };
      if (estSession) {
        await axios.post(`${API}/sessions/${item.id}/valider-regleur`, payload);
      } else {
        await axios.patch(`${API}/of/${item.id}/reglage`, payload);
      }
      toast.success("✅ Réglage validé — l'opérateur peut démarrer");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur validation');
    } finally { setSubmitting(false); setConfirmer(false); }
  };

  const sec = SECTIONS[secIdx];
  const qteDisplay = `${fmt(item.quantite_cible)} ${item.unite_libelle || item.unite_code || ''}`.trim();
  const poidsDisplay = item.poids_theorique_total_kg ? `${fmt(item.poids_theorique_total_kg, 1)} kg` : null;

  let formuleMelange = null;
  try {
    const fm = typeof item.formule_melange === 'string' ? JSON.parse(item.formule_melange) : item.formule_melange;
    if (fm && Object.keys(fm).length > 0) formuleMelange = fm;
  } catch {}

  return (
    <div style={S.page}>
      <header style={S.header}>
        <button style={S.btnBack} onClick={onBack}>← Retour</button>
        <div style={{ flex:1, margin:'0 10px', overflow:'hidden' }}>
          <div style={S.htitle}>{item.numero_of}</div>
          <div style={{ ...S.hsub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {item.article || item.article_nom}{item.couleur ? ` · ${item.couleur}` : ''} · {item.machine_nom || item.machine_code || 'Machine NC'}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:10, color:'#a5b4fc' }}>Complété</div>
          <div style={{ fontSize:20, fontWeight:800, color: pct===100?'#34d399':'#fbbf24' }}>{pct}%</div>
        </div>
      </header>

      <div style={{ background:'#3730a3', padding:'12px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
          <InfoBit label="Client"    val={item.client_nom || '—'} />
          <InfoBit label="Quantité"  val={qteDisplay || '—'} />
          <InfoBit label="Poids"     val={poidsDisplay || '—'} />
          <InfoBit label="Livraison" val={item.date_livraison_prevue ? fmtDate(item.date_livraison_prevue) : '—'} />
        </div>
        {estSession && (
          <div style={{ marginTop:8, fontSize:12, color:'#fca5a5', fontWeight:600 }}>
            ⚠ {item.operateur_nom} attend votre validation
          </div>
        )}
      </div>

      {formuleMelange && (
        <div style={{ background:'#fef9c3', borderBottom:'1px solid #fde047', padding:'10px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#854d0e', textTransform:'uppercase', marginBottom:6 }}>
            📋 Formule chef d'atelier
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {Object.entries(formuleMelange).map(([k, v]) => (
              <span key={k} style={{ background:'#fef08a', border:'1px solid #fde047', borderRadius:6, padding:'3px 8px', fontSize:12, fontWeight:600, color:'#713f12' }}>
                {k} : {v}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding:'8px 16px', background:'#fff', borderBottom:'1px solid #e0e7ff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6b7280', marginBottom:3 }}>
          <span>Paramètres saisis</span><strong>{nbRemplis}/{TOTAL_CHAMPS}</strong>
        </div>
        <div style={{ height:5, background:'#e0e7ff', borderRadius:5, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background: pct===100?'#10b981':'#6366f1', borderRadius:5, transition:'width 0.3s' }}/>
        </div>
      </div>

      <div style={{ display:'flex', background:'#fff', borderBottom:'2px solid #e0e7ff' }}>
        {SECTIONS.map((s, i) => {
          const nb  = s.champs.filter(c => c.type !== 'select' && params[c.key] !== undefined && params[c.key] !== '').length;
          const tot = s.champs.filter(c => c.type !== 'select').length;
          return (
            <button key={s.id} onClick={() => setSecIdx(i)} style={{
              flex:1, padding:'12px 10px', border:'none', background:'none', cursor:'pointer',
              borderBottom: secIdx===i ? '3px solid #4338ca' : '3px solid transparent',
              color: secIdx===i ? '#4338ca' : '#6b7280',
              fontWeight: secIdx===i ? 700 : 400, fontSize:13,
            }}>
              {s.icon} {s.titre}
              {nb > 0 && (
                <span style={{ marginLeft:4, background:'#6366f1', color:'#fff', borderRadius:10, padding:'1px 5px', fontSize:10 }}>
                  {nb}/{tot}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <main style={{ ...S.main, paddingBottom:110 }}>
        <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid #e0e7ff' }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#312e81', marginBottom:14 }}>
            {sec.icon} {sec.titre}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {sec.champs.map(champ => (
              <ChampForm key={champ.key} champ={champ} val={params[champ.key]} onChange={v => setP(champ.key, v)} />
            ))}
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid #e0e7ff' }}>
          <label style={S.lbl}>📝 Remarques</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Observations, réglages particuliers, incidents..."
            style={{ width:'100%', border:'1px solid #e0e7ff', borderRadius:10, padding:'12px', fontSize:14, boxSizing:'border-box', resize:'vertical', fontFamily:'inherit' }}/>
        </div>
      </main>

      <div style={{
        position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
        width:'100%', maxWidth:720, background:'#fff',
        borderTop:'1px solid #e0e7ff', padding:'10px 16px', boxSizing:'border-box',
      }}>
        {!peutValider && (
          <div style={{ textAlign:'center', fontSize:11, color:'#9ca3af', marginBottom:6 }}>
            Requis : T° Zone 1 · Pression · Largeur · Épaisseur
          </div>
        )}
        <button onClick={() => setConfirmer(true)} disabled={!peutValider || submitting}
          style={{
            ...S.btnV,
            background: peutValider ? '#4338ca' : '#d1d5db',
            color:       peutValider ? '#fff'    : '#9ca3af',
            cursor:      peutValider ? 'pointer' : 'not-allowed',
          }}>
          ✓ Valider le réglage
        </button>
      </div>

      {confirmer && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize:44, textAlign:'center' }}>⚙️</div>
            <div style={{ fontWeight:800, fontSize:17, textAlign:'center', margin:'10px 0 6px' }}>Confirmer ?</div>
            <div style={{ color:'#6b7280', fontSize:13, textAlign:'center', lineHeight:1.8, marginBottom:16 }}>
              <strong>{item.numero_of}</strong><br/>
              T° {params.temp_zone1}°C · P {params.pression_bar} bar<br/>
              L {params.largeur_mm} mm · Ép. {params.epaisseur_um} µm
              {estSession && <><br/><span style={{ color:'#dc2626', fontWeight:600 }}>L'opérateur peut démarrer.</span></>}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmer(false)} style={{ ...S.btnSec, flex:1, padding:'13px' }}>Annuler</button>
              <button onClick={valider} disabled={submitting}
                style={{ ...S.btnV, flex:2, padding:'13px', fontSize:15 }}>
                {submitting ? 'Validation...' : 'CONFIRMER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBit({ label, val }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'#a5b4fc', textTransform:'uppercase', letterSpacing:0.3 }}>{label}</div>
      <div style={{ fontWeight:700, fontSize:13, color:'#fff' }}>{val}</div>
    </div>
  );
}

function ChampForm({ champ, val, onChange }) {
  if (champ.type === 'select') return (
    <div>
      <label style={S.lbl}>{champ.label}</label>
      <select value={val || ''} onChange={e => onChange(e.target.value)}
        style={{ ...S.inp, textAlign:'left', fontSize:15, fontWeight:500, padding:'12px 14px', borderColor:'#e0e7ff' }}>
        {champ.options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  return (
    <div>
      <label style={S.lbl}>
        {champ.label}
        {champ.requis && <span style={{ color:'#ef4444' }}> *</span>}
        {champ.unite && <span style={{ color:'#9ca3af', fontWeight:400 }}> ({champ.unite})</span>}
      </label>
      <input type="number" step="0.1" inputMode="decimal"
        value={val ?? ''} onChange={e => onChange(e.target.value)}
        min={champ.min} max={champ.max}
        placeholder={champ.min !== undefined ? `${champ.min}–${champ.max}` : '—'}
        style={{ ...S.inp, borderColor: val ? '#6366f1' : '#e0e7ff' }}/>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GMAO
// ═════════════════════════════════════════════════════════════════════════════
function EcranGMAO({ user, onBack }) {
  const [machines,   setMachines]   = useState([]);
  const [form,       setForm]       = useState({ machine_id:'', type:'', urgence:'normale', description:'' });
  const [submitting, setSubmitting] = useState(false);
  const [succes,     setSucces]     = useState(false);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    axios.get(`${API}/equipements`).then(r => setMachines(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const envoyer = async () => {
    if (!form.machine_id || !form.type || !form.description) return toast.error('Complétez tous les champs');
    setSubmitting(true);
    try {
      await axios.post(`${API}/tickets`, {
        equipement_id: form.machine_id, type_intervention: form.type,
        urgence: form.urgence, description: form.description,
        demandeur_id: user?.id, origine: 'regleur', statut: 'ouvert',
      });
      setSucces(true);
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setSubmitting(false); }
  };

  if (succes) return (
    <div style={{ ...S.page, textAlign:'center', paddingTop:80 }}>
      <div style={{ fontSize:56 }}>✅</div>
      <div style={{ fontWeight:800, fontSize:20, marginTop:12, color:'#15803d' }}>Ticket GMAO créé !</div>
      <button style={{ ...S.btnV, marginTop:24, background:'#4338ca', display:'block', maxWidth:260, margin:'24px auto 0' }} onClick={onBack}>← Retour</button>
    </div>
  );

  const TYPES = [['panne','🔴 Panne'],['anomalie','🟡 Anomalie'],['usure','🔧 Usure'],['reglage','⚙️ Pb réglage'],['autre','📝 Autre']];
  const URGENCES = [
    { val:'critique', label:'CRITIQUE — Arrêt total',      bg:'#fef2f2', c:'#dc2626', b:'#fca5a5' },
    { val:'haute',    label:'Haute — Production dégradée', bg:'#fff7ed', c:'#c2410c', b:'#fdba74' },
    { val:'normale',  label:'Normale',                     bg:'#eff6ff', c:'#1d4ed8', b:'#93c5fd' },
    { val:'basse',    label:'Basse — Préventif',            bg:'#f0fdf4', c:'#15803d', b:'#86efac' },
  ];

  return (
    <div style={S.page}>
      <header style={S.header}>
        <button style={S.btnBack} onClick={onBack}>← Retour</button>
        <div style={{ flex:1, margin:'0 10px' }}>
          <div style={S.htitle}>Signalement GMAO</div>
          <div style={S.hsub}>Nouveau ticket maintenance</div>
        </div>
      </header>
      <main style={S.main}>
        <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid #e0e7ff' }}>
          <label style={S.lbl}>Machine *</label>
          <select style={{ ...S.inp, textAlign:'left', fontSize:15, fontWeight:500, padding:'12px 14px', borderColor:'#e0e7ff' }}
            value={form.machine_id} onChange={e => setF('machine_id', e.target.value)}>
            <option value="">-- Sélectionner --</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.code} — {m.libelle || m.nom}</option>)}
          </select>
        </div>
        <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid #e0e7ff' }}>
          <label style={S.lbl}>Type de problème *</label>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {TYPES.map(([val, label]) => (
              <button key={val} onClick={() => setF('type', val)}
                style={{ padding:'11px', borderRadius:10, border:`2px solid ${form.type===val?'#6366f1':'#e0e7ff'}`,
                  background: form.type===val?'#ede9fe':'#fff', color: form.type===val?'#4338ca':'#374151',
                  fontWeight:600, cursor:'pointer', fontSize:13, textAlign:'left' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid #e0e7ff' }}>
          <label style={S.lbl}>Urgence</label>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {URGENCES.map(u => (
              <button key={u.val} onClick={() => setF('urgence', u.val)}
                style={{ padding:'11px 16px', borderRadius:10, textAlign:'left', cursor:'pointer',
                  fontWeight: form.urgence===u.val ? 700 : 500, fontSize:14,
                  background: form.urgence===u.val ? u.bg  : '#fff',
                  color:      form.urgence===u.val ? u.c   : '#374151',
                  border:    `2px solid ${form.urgence===u.val ? u.b : '#e0e7ff'}` }}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid #e0e7ff' }}>
          <label style={S.lbl}>Description *</label>
          <textarea value={form.description} onChange={e => setF('description', e.target.value)} rows={4}
            placeholder="Décrivez précisément le problème observé..."
            style={{ width:'100%', border:'1px solid #e0e7ff', borderRadius:10, padding:'12px', fontSize:14, boxSizing:'border-box', resize:'vertical', fontFamily:'inherit' }}/>
        </div>
        <button onClick={envoyer} disabled={submitting} style={{ ...S.btnV, background:'#dc2626' }}>
          {submitting ? 'Envoi...' : '🔧 Envoyer à la maintenance'}
        </button>
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function Regleur() {
  const { user } = useAuth();
  const [vue,   setVue]   = useState('liste');
  const [cible, setCible] = useState(null);
  const retour = () => { setCible(null); setVue('liste'); };
  if (vue === 'gmao')       return <EcranGMAO       user={user} onBack={retour} />;
  if (vue === 'historique') return <EcranHistorique user={user} onBack={retour} />;
  if (vue === 'reglage' && cible) return <EcranReglage cible={cible} user={user} onBack={retour} onSuccess={retour} />;
  return <EcranListe user={user}
    onValider={item => { setCible(item); setVue('reglage'); }}
    onGmao={() => setVue('gmao')}
    onHistorique={() => setVue('historique')} />;
}

// ═════════════════════════════════════════════════════════════════════════════
const S = {
  page:   { minHeight:'100vh', background:'#f5f3ff', fontFamily:"system-ui,sans-serif", color:'#1e293b', maxWidth:720, margin:'0 auto' },
  header: { background:'#312e81', color:'#fff', padding:'0 12px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, gap:8 },
  htitle: { fontWeight:700, fontSize:15 },
  hsub:   { fontSize:11, color:'#a5b4fc', marginTop:2 },
  avatar: { width:32, height:32, background:'#a5b4fc', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#312e81', fontSize:15, flexShrink:0 },
  nav:    { background:'#fff', borderBottom:'2px solid #e0e7ff', display:'flex', overflowX:'auto' },
  tab:    { padding:'14px 14px', border:'none', background:'none', cursor:'pointer', fontWeight:400, color:'#4b5563', fontSize:13, whiteSpace:'nowrap', borderBottom:'3px solid transparent' },
  tabOn:  { fontWeight:700, color:'#4338ca', borderBottom:'3px solid #4338ca' },
  main:   { padding:'16px', display:'flex', flexDirection:'column', gap:12 },
  card:   { background:'#fff', borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' },
  row:    { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 },
  num:    { fontWeight:800, fontSize:16, color:'#1e293b' },
  sub:    { fontSize:13, color:'#374151', marginTop:3 },
  badge:  { padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:700, flexShrink:0 },
  empty:  { textAlign:'center', padding:'48px 24px', background:'#fff', borderRadius:14, border:'1px solid #e0e7ff' },
  center: { textAlign:'center', padding:48, color:'#94a3b8' },
  lbl:    { display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:0.3 },
  inp:    { width:'100%', border:'2px solid #e0e7ff', borderRadius:10, padding:'12px', fontSize:20, fontWeight:700, boxSizing:'border-box', textAlign:'center', color:'#312e81', outline:'none', fontFamily:'inherit' },
  btnV:   { background:'#4338ca', color:'#fff', border:'none', padding:'16px', borderRadius:12, width:'100%', fontWeight:700, fontSize:16, cursor:'pointer' },
  btnSec: { background:'#f3f4f6', color:'#374151', border:'none', padding:'11px 14px', borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:13 },
  btnGmao: { padding:'5px 10px', borderRadius:8, border:'1px solid #475569', background:'transparent', color:'#a5b4fc', fontWeight:600, fontSize:12, cursor:'pointer' },
  btnHisto:{ padding:'5px 10px', borderRadius:8, border:'1px solid #475569', background:'transparent', color:'#a5b4fc', fontWeight:600, fontSize:12, cursor:'pointer' },
  btnQ:   { background:'#3730a3', border:'none', color:'#a5b4fc', padding:'5px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600 },
  btnBack:{ padding:'6px 10px', borderRadius:8, border:'1px solid #475569', background:'transparent', color:'#a5b4fc', fontWeight:600, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' },
  overlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:200 },
  modal:  { background:'#fff', borderRadius:16, padding:'24px', maxWidth:360, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
};
