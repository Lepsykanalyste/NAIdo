'use strict';
// NAIdo - bon de commande en PDF (pdfkit) : une seule page, QR code en haut a droite, totaux recalcules a partir des lignes.
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const BLEU = '#0369a1';
const BLEU_CLAIR = '#e0f2fe';
const GRIS = '#6b7280';
const LIGNE = '#d1d5db';
const ZEBRA = '#f3f4f6';

// Montants lisibles : 5 000 000 (espaces simples, virgule pour les decimales)
const nombre = (n, d = 0) => {
  if (n === null || n === undefined || n === '' || isNaN(parseFloat(n))) return '—';
  const v = Math.round(parseFloat(n) * Math.pow(10, d)) / Math.pow(10, d);
  const [entier, dec] = Math.abs(v).toFixed(d).split('.');
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (v < 0 ? '-' : '') + groupes + (d > 0 ? ',' + dec : '');
};
// Quantites : pas de decimales si entier (1 000) ; sinon les decimales utiles seulement (1 000,1)
const quantite = q => {
  const v = parseFloat(q);
  if (!Number.isFinite(v)) return '—';
  const r = Math.round(v * 1000) / 1000;
  const dec = Number.isInteger(r) ? 0 : (String(r).split('.')[1] || '').length;
  return nombre(r, dec);
};
const date = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// Totaux recalcules a partir des lignes : HT = quantite x prix unitaire ; TVA au taux du bon
function calculer(cmd, lignes) {
  const taux = parseFloat(cmd.taux_tva);
  const tauxOk = Number.isFinite(taux) ? taux : 0;
  let ht = 0;
  for (const l of lignes) {
    ht += (parseFloat(l.quantite_commandee) || 0) * (parseFloat(l.prix_unitaire_ht) || 0);
  }
  const tva = ht * tauxOk / 100;
  return { ht, tva, ttc: ht + tva };
}

// sign = { achat: Buffer|null, direction: Buffer|null } : signatures image de chaque personne (importees dans son compte)
function pdfBonAchat(cmd, lignes, urlQr, sign = {}, opts = {}) {
  const sansPrix = !!opts.sansPrix;
  return new Promise(async (resolve, reject) => {
    try {
      const qr = urlQr ? await QRCode.toBuffer(urlQr, { type: 'png', width: 240, margin: 1 }) : null;
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const morceaux = [];
      doc.on('data', m => morceaux.push(m));
      doc.on('end', () => resolve(Buffer.concat(morceaux)));
      doc.on('error', reject);

      const G = 40;
      const L = 595 - 40;
      const largeur = L - G;
      // Taille du texte selon le nombre de lignes : le bon reste sur une seule page
      const petit = lignes.length > 10;
      const corps = petit ? 8 : 9;
      const hligne = petit ? 15 : 19;

      // ----- Bandeau avec QR code en haut a droite -----
      doc.rect(0, 0, 595, 96).fill(BLEU);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('NAI', G, 30);
      doc.font('Helvetica').fontSize(9).text('Service Achats', G, 58);
      doc.font('Helvetica-Bold').fontSize(17).text('BON DE COMMANDE', 170, 28, { width: 260, align: 'right' });
      doc.font('Helvetica').fontSize(11).text(cmd.numero_commande || '', 170, 52, { width: 260, align: 'right' });
      doc.fontSize(9).text('Date : ' + date(cmd.date_commande), 170, 68, { width: 260, align: 'right' });
      if (qr) {
        doc.rect(L - 74, 8, 80, 80).fill('#ffffff');
        doc.image(qr, L - 72, 10, { width: 76 });
      }
      doc.fillColor('#000000');

      // ----- Fournisseur / commande -----
      const y0 = 112;
      const demi = (largeur - 16) / 2;
      const bloc = (x, titre, lignesTxt) => {
        doc.rect(x, y0, demi, 92).lineWidth(0.8).strokeColor(LIGNE).stroke();
        doc.rect(x, y0, demi, 18).fill(BLEU_CLAIR);
        doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9).text(titre, x + 10, y0 + 5);
        doc.fillColor('#111827').font('Helvetica').fontSize(corps);
        // Lignes posees l'une sous l'autre selon leur hauteur reelle (pas de chevauchement si une adresse passe sur 2 lignes)
        let yy = y0 + 25;
        lignesTxt.forEach(t => { doc.text(t, x + 10, yy, { width: demi - 20 }); yy += doc.heightOfString(t, { width: demi - 20 }) + 3; });
      };
      bloc(G, 'FOURNISSEUR', [
        cmd.raison_sociale || '—',
        [cmd.adresse, cmd.ville].filter(Boolean).join(', ') || '—',
        [cmd.telephone, cmd.email].filter(Boolean).join(' / ') || '—',
      ]);
      bloc(G + demi + 16, 'COMMANDE', [
        'Livraison prévue : ' + date(cmd.date_livraison_prevue),
        'Référence fournisseur : ' + (cmd.reference_fournisseur || '—'),
        'Établi par : ' + (cmd.cree_par_nom || '—'),
      ]);

      // ----- Tableau des lignes -----
      let y = 216;
      const cols = sansPrix ? [
        { t: 'Code', x: G, w: 62, al: 'left' },
        { t: 'Désignation', x: G + 62, w: largeur - 62 - 130, al: 'left' },
        { t: 'Unité', x: G + largeur - 130, w: 50, al: 'center' },
        { t: 'Quantité', x: G + largeur - 80, w: 80, al: 'right' },
      ] : [
        { t: 'Code', x: G, w: 62, al: 'left' },
        { t: 'Désignation', x: G + 62, w: 175, al: 'left' },
        { t: 'Unité', x: G + 237, w: 50, al: 'center' },
        { t: 'Quantité', x: G + 287, w: 58, al: 'right' },
        { t: 'Prix HT', x: G + 345, w: 70, al: 'right' },
        { t: 'Total HT', x: G + 415, w: largeur - 415, al: 'right' },
      ];
      doc.rect(G, y, largeur, 20).fill(BLEU);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(corps);
      cols.forEach(c => doc.text(c.t, c.x + 6, y + 6, { width: c.w - 12, align: c.al }));
      doc.fillColor('#000000');
      y += 20;

      lignes.forEach((l, i) => {
        const vals = [
          l.article_code || '',
          l.designation || '',
          l.unite_code || '',
          quantite(l.quantite_commandee),
          nombre(l.prix_unitaire_ht),
          nombre((parseFloat(l.quantite_commandee) || 0) * (parseFloat(l.prix_unitaire_ht) || 0)),
        ];
        const hauteur = Math.max(hligne, doc.heightOfString(vals[1], { width: cols[1].w - 12 }) + 6);
        if (i % 2 === 1) doc.rect(G, y, largeur, hauteur).fill(ZEBRA);
        doc.fillColor('#111827').font('Helvetica').fontSize(corps);
        cols.forEach((c, k) => doc.text(String(vals[k]), c.x + 6, y + 4, { width: c.w - 12, align: c.al }));
        y += hauteur;
        doc.moveTo(G, y).lineTo(L, y).lineWidth(0.4).strokeColor(LIGNE).stroke();
      });

      // ----- Totaux (recalcules) : absents pour les roles qui ne voient pas les prix -----
      if (!sansPrix) {
      const t = calculer(cmd, lignes);
      y += 12;
      const xT = G + 300;
      const wT = largeur - 300;
      const ligneTotal = (libelle, valeur, gras) => {
        doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(gras ? corps + 2 : corps).fillColor('#111827');
        doc.text(libelle, xT + 10, y, { width: wT / 2 - 10, lineBreak: false });
        doc.text(valeur, xT + wT / 2, y, { width: wT / 2 - 10, align: 'right', lineBreak: false });
        y += gras ? 20 : 16;
      };
      const hTot = 16 + 16 + 24 + 8;
      doc.rect(xT, y - 4, wT, hTot).fill(BLEU_CLAIR);
      ligneTotal('Total HT', nombre(t.ht) + ' FCFA');
      ligneTotal('TVA (' + nombre(cmd.taux_tva, 0) + ' %)', nombre(t.tva) + ' FCFA');
      doc.moveTo(xT + 10, y - 2).lineTo(xT + wT - 10, y - 2).lineWidth(0.8).strokeColor(BLEU).stroke();
      ligneTotal('Total TTC', nombre(t.ttc) + ' FCFA', true);
      y += 14;
      }

      // ----- Notes -----
      if (cmd.notes) {
        doc.font('Helvetica-Bold').fontSize(corps).fillColor(BLEU).text('Notes', G, y);
        doc.font('Helvetica').fontSize(corps).fillColor('#111827').text(cmd.notes, G, y + 12, { width: largeur });
        y += 12 + doc.heightOfString(cmd.notes, { width: largeur }) + 8;
      }

      // ----- Signatures (en bas de la page) -----
      const ySig = Math.max(y + 8, 668);
      const sigW = (largeur - 16) / 2;
      const hBoite = 96;
      const validee = cmd.validee_at || cmd.confirme_at;
      [[G, 'SERVICE ACHAT', cmd.cree_par_nom || '', '', sign.achat],
       [G + sigW + 16, 'DIRECTION', sign.direction_nom || (validee ? 'Validé' : 'En attente de validation'), validee ? 'Validé le ' + date(validee) : '', sign.direction]]
        .forEach(([x, titre, nom, detail, image]) => {
          doc.rect(x, ySig, sigW, hBoite).lineWidth(0.8).strokeColor(LIGNE).stroke();
          doc.font('Helvetica-Bold').fontSize(corps).fillColor(BLEU).text(titre, x + 10, ySig + 7);
          doc.font('Helvetica-Bold').fontSize(corps).fillColor('#111827').text(nom, x + 10, ySig + 21, { width: sigW - 20 });
          if (detail) doc.font('Helvetica').fontSize(corps - 1).fillColor(GRIS).text(detail, x + 10, ySig + 34, { width: sigW - 20 });
          if (image) {
            // Signature importee par la personne : agrandie, tient dans la case
            try { doc.image(image, x + 10, ySig + 46, { fit: [sigW - 20, 36] }); } catch (e) { /* image illisible : case vide */ }
          }
          doc.fillColor(GRIS).fontSize(7).text('Signature', x + 10, ySig + hBoite - 12);
        });

      doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
        .text(`NAI — ${cmd.numero_commande || ''}`, G, 780, { width: largeur, align: 'center', lineBreak: false });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// Bon de livraison en PDF (bordereau de reception, avec transport, chauffeur, lots et type local/export)
function pdfReception({ numRec, cmd, rec, lignes, sign = null, nomRec = '' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const morceaux = [];
    doc.on('data', m => morceaux.push(m));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
    const G = 40;
    const L = 595 - 40;
    const largeur = L - G;
    const estExport = cmd.type_achat === 'export';
    const conteneur = rec.mode_transport === 'conteneur';

    // Bandeau
    doc.rect(0, 0, 595, 90).fill(BLEU);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('NAI', G, 28);
    doc.font('Helvetica').fontSize(9).text('Service Achats - Magasin', G, 56);
    doc.font('Helvetica-Bold').fontSize(16).text('BON DE LIVRAISON', 250, 24, { width: 305, align: 'right' });
    doc.font('Helvetica').fontSize(9).text('Bordereau de réception', 250, 44, { width: 305, align: 'right' });
    doc.font('Helvetica').fontSize(11).text(numRec, 250, 58, { width: 305, align: 'right' });
    doc.fontSize(9).text('Réception du ' + date(rec.date_reception) + '  ·  ' + (estExport ? 'IMPORT' : 'LOCAL'), 250, 74, { width: 305, align: 'right' });
    doc.fillColor('#000000');

    // Commande et livraison
    const y0 = 104;
    const demi = (largeur - 16) / 2;
    const hBloc = 124;
    const bloc = (x, titre, lignesTxt) => {
      doc.rect(x, y0, demi, hBloc).lineWidth(0.8).strokeColor(LIGNE).stroke();
      doc.rect(x, y0, demi, 18).fill(BLEU_CLAIR);
      doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9).text(titre, x + 10, y0 + 5);
      let yy = y0 + 24;
      doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
      lignesTxt.filter(Boolean).forEach(t => {
        doc.text(t, x + 10, yy, { width: demi - 20 });
        yy += doc.heightOfString(t, { width: demi - 20 }) + 3;
      });
    };
    bloc(G, 'COMMANDE', [
      'Bon de commande : ' + (cmd.numero_commande || '—'),
      'Fournisseur : ' + (cmd.raison_sociale || '—'),
      'Type : ' + (estExport ? 'Import' : 'Local'),
      cmd.commentaire ? 'Commentaire : ' + cmd.commentaire : null,
      estExport ? 'Lot du conteneur : ' + (cmd.numero_lot_conteneur || '—') : null,
    ]);
    const chauffeur = ((rec.chauffeur_prenom || '') + ' ' + (rec.chauffeur_nom || '')).trim() || '—';
    bloc(G + demi + 16, 'LIVRAISON', [
      'Bon de livraison : ' + (rec.reference_bl || '—'),
      'Reçu par : ' + (rec.cree_par_nom || '—'),
      conteneur ? 'Conteneur n° : ' + (rec.numero_conteneur || '—') : 'Véhicule (immatriculation) : ' + (rec.immatriculation || '—'),
      conteneur ? 'N° de plomb : ' + (rec.numero_plomb || '—') : null,
      'Chauffeur : ' + chauffeur,
      'Lot de la matière : ' + (rec.numero_lot_matiere || '—'),
    ]);

    // Tableau des lignes
    let y = y0 + hBloc + 14;
    const cols = [
      { t: 'Code', x: G, w: 60, al: 'left' },
      { t: 'Désignation', x: G + 60, w: 185, al: 'left' },
      { t: 'Commandé', x: G + 245, w: 65, al: 'right' },
      { t: 'Déjà reçu', x: G + 310, w: 65, al: 'right' },
      { t: 'Reçu ce jour', x: G + 375, w: 75, al: 'right' },
      { t: 'Reste', x: G + 450, w: largeur - 450, al: 'right' },
    ];
    doc.rect(G, y, largeur, 20).fill(BLEU);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    cols.forEach(c => doc.text(c.t, c.x + 6, y + 6, { width: c.w - 12, align: c.al }));
    doc.fillColor('#000000');
    y += 20;
    lignes.forEach((l, i) => {
      const vals = [l.code, l.designation, quantite(l.commande), quantite(l.avant), quantite(l.recu), quantite(l.reste)];
      const hauteur = Math.max(18, doc.heightOfString(String(vals[1]), { width: cols[1].w - 12, fontSize: 8.5 }) + 6);
      if (i % 2 === 1) doc.rect(G, y, largeur, hauteur).fill(ZEBRA);
      doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
      cols.forEach((c, k) => doc.text(String(vals[k]), c.x + 6, y + 4, { width: c.w - 12, align: c.al }));
      y += hauteur;
      doc.moveTo(G, y).lineTo(L, y).lineWidth(0.4).strokeColor(LIGNE).stroke();
    });

    // Notes et commentaire de reception
    const notes = [rec.commentaire ? 'Commentaire : ' + rec.commentaire : null, rec.notes || null].filter(Boolean).join('\n');
    if (notes) {
      y += 14;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text('Notes', G, y);
      doc.font('Helvetica').fontSize(9).fillColor('#111827').text(notes, G, y + 12, { width: largeur });
    }

    // Signatures : nom et signature de la personne qui a receptionne (dans les deux cases)
    const ySig = 676;
    const sigW = (largeur - 16) / 2;
    [[G, 'SERVICE ACHAT'], [G + sigW + 16, 'MAGASIN']].forEach(([x, titre]) => {
      doc.rect(x, ySig, sigW, 96).lineWidth(0.8).strokeColor(LIGNE).stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text(titre, x + 10, ySig + 7);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(nomRec || '—', x + 10, ySig + 21, { width: sigW - 20 });
      if (sign) {
        try { doc.image(sign, x + 10, ySig + 36, { fit: [sigW - 20, 40] }); } catch (e) { /* image illisible : case vide */ }
      }
      doc.fillColor(GRIS).fontSize(7).text('Signature', x + 10, ySig + 82);
    });

    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
      .text(`NAI — ${numRec}`, G, 780, { width: largeur, align: 'center', lineBreak: false });
    doc.end();
  });
}

// Document commercial en PDF (devis, bon de commande client, demande de fabrication) : portrait, ou paysage pour les grands tableaux
function pdfCommercial({ titre, numero, dateStr, statut, infos = [], client = [], entete = [], lignes = [], totaux = [], notes = '', paysage = false, qrUrl = null, signatures = [], titreGauche = 'CLIENT', titreDroite = 'INFORMATIONS', sousTitre = 'Service Commercial', tableau2 = null }) {
  return new Promise(async (resolve, reject) => {
    // QR code en haut a droite (meme place que sur le bon d'achat)
    let qr = null;
    if (qrUrl) { try { qr = await QRCode.toBuffer(qrUrl, { type: 'png', width: 240, margin: 1 }); } catch (e) { qr = null; } }
    const W = paysage ? 842 : 595;
    const H = paysage ? 595 : 842;
    const doc = new PDFDocument({ size: 'A4', layout: paysage ? 'landscape' : 'portrait', margin: 40 });
    const morceaux = [];
    doc.on('data', m => morceaux.push(m));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
    const G = 40;
    const L = W - 40;
    const largeur = L - G;
    const xDroite = W - 40 - 305 - (qr ? 90 : 0);

    // Bandeau
    doc.rect(0, 0, W, 90).fill(BLEU);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('NAI', G, 28);
    doc.font('Helvetica').fontSize(9).text(sousTitre, G, 56);
    doc.font('Helvetica-Bold').fontSize(16).text(titre, xDroite, 24, { width: 305, align: 'right' });
    doc.font('Helvetica').fontSize(11).text(numero || '', xDroite, 46, { width: 305, align: 'right' });
    doc.fontSize(9).text('Date : ' + (dateStr || '—') + (statut ? '  ·  ' + statut : ''), xDroite, 64, { width: 305, align: 'right' });
    doc.fillColor('#000000');

    if (qr) { doc.rect(W - 40 - 78, 8, 80, 80).fill('#ffffff'); doc.image(qr, W - 40 - 76, 10, { width: 76 }); }
    // Client et informations
    const y0 = 104;
    const demi = (largeur - 16) / 2;
    const hBloc = Math.max(96, 32 + 14 * Math.max(client.filter(Boolean).length, infos.filter(Boolean).length));
    const bloc = (x, titreB, lignesTxt) => {
      doc.rect(x, y0, demi, hBloc).lineWidth(0.8).strokeColor(LIGNE).stroke();
      doc.rect(x, y0, demi, 18).fill(BLEU_CLAIR);
      doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9).text(titreB, x + 10, y0 + 5);
      let yy = y0 + 24;
      doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
      lignesTxt.filter(Boolean).forEach(t => {
        doc.text(t, x + 10, yy, { width: demi - 20 });
        yy += doc.heightOfString(t, { width: demi - 20 }) + 3;
      });
    };
    bloc(G, titreGauche, client);
    bloc(G + demi + 16, titreDroite, infos);

    // Tableau des lignes : toutes les lignes sont affichees
    let y = y0 + hBloc + 14;
    doc.rect(G, y, largeur, 20).fill(BLEU);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    let x = G;
    entete.forEach(c => { doc.text(c.t, x + 6, y + 6, { width: c.w - 12, align: c.al }); x += c.w; });
    doc.fillColor('#000000');
    y += 20;
    lignes.forEach((vals, i) => {
      const hauteur = Math.max(18, doc.heightOfString(String(vals[1] || ''), { width: entete[1].w - 12, fontSize: 8.5 }) + 6);
      if (i % 2 === 1) doc.rect(G, y, largeur, hauteur).fill(ZEBRA);
      doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
      let xx = G;
      entete.forEach((c, k) => { doc.text(String(vals[k] ?? ''), xx + 6, y + 4, { width: c.w - 12, align: c.al }); xx += c.w; });
      y += hauteur;
      doc.moveTo(G, y).lineTo(L, y).lineWidth(0.4).strokeColor(LIGNE).stroke();
    });

    // Deuxieme tableau (ex. composition des matieres d'un OF) ; message explicatif s'il est vide
    if (tableau2) {
      y += 16;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text(tableau2.titre, G, y);
      y += 14;
      if (tableau2.lignes.length) {
        doc.rect(G, y, largeur, 20).fill(BLEU);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
        let x2 = G;
        tableau2.entete.forEach(c => { doc.text(c.t, x2 + 6, y + 6, { width: c.w - 12, align: c.al }); x2 += c.w; });
        doc.fillColor('#000000');
        y += 20;
        tableau2.lignes.forEach((vals, i) => {
          const h2 = Math.max(18, doc.heightOfString(String(vals[2] || ''), { width: tableau2.entete[2].w - 12, fontSize: 8.5 }) + 6);
          if (i % 2 === 1) doc.rect(G, y, largeur, h2).fill(ZEBRA);
          doc.fillColor('#111827').font('Helvetica').fontSize(8.5);
          let xx2 = G;
          tableau2.entete.forEach((c, k) => { doc.text(String(vals[k] ?? ''), xx2 + 6, y + 4, { width: c.w - 12, align: c.al }); xx2 += c.w; });
          y += h2;
          doc.moveTo(G, y).lineTo(L, y).lineWidth(0.4).strokeColor(LIGNE).stroke();
        });
      } else {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(GRIS).text(tableau2.vide || 'Aucune ligne', G, y, { width: largeur });
        y += 18;
      }
    }

    // Totaux
    y += 12;
    const yTot0 = y;
    const wT = paysage ? 340 : largeur - 300;
    const xT = L - wT;
    totaux.forEach(([lib, val, gras]) => {
      doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(gras ? 10 : 9).fillColor('#111827');
      doc.text(lib, xT + 10, y, { width: wT / 2 - 10, lineBreak: false });
      doc.text(val, xT + wT / 2, y, { width: wT / 2 - 10, align: 'right', lineBreak: false });
      y += gras ? 20 : 16;
    });

    if (notes) {
      // En paysage, les notes sont a gauche des totaux ; en portrait, sous les totaux
      const largeurNotes = paysage ? largeur - wT - 20 : largeur;
      const yNotes = paysage ? yTot0 : y + 14;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text('Notes', G, yNotes);
      doc.font('Helvetica').fontSize(9).fillColor('#111827').text(notes, G, yNotes + 12, { width: largeurNotes });
      y = Math.max(y, yNotes + 12 + doc.heightOfString(notes, { width: largeurNotes }));
    }

    // Signatures en bas de page (comme sur le bon de commande)
    if (signatures.length) {
      // Position : en bas de page, ou juste sous le contenu s'il est long (nouvelle page si necessaire)
      let ySigC = Math.max(H - 175, y + 16);
      if (ySigC + 100 > H - 56) { doc.addPage(); ySigC = 60; }
      const nSig = Math.min(signatures.length, 4);
      const sigWC = (largeur - 16 * (nSig - 1)) / nSig;
      signatures.slice(0, 4).forEach((s, i) => {
        const xs = G + i * (sigWC + 16);
        doc.rect(xs, ySigC, sigWC, 96).lineWidth(0.8).strokeColor(LIGNE).stroke();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text(s.titre, xs + 10, ySigC + 7);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(s.nom || '—', xs + 10, ySigC + 21, { width: sigWC - 20 });
        if (s.image) { try { doc.image(s.image, xs + 10, ySigC + 36, { fit: [sigWC - 20, 40] }); } catch (e) { /* image illisible */ } }
        doc.fillColor(GRIS).fontSize(7).text('Signature', xs + 10, ySigC + 82);
      });
    }
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
      .text(`NAI — ${numero || ''}`, G, H - 50, { width: largeur, align: 'center', lineBreak: false });
    doc.end();
  });
}

module.exports = { pdfBonAchat, calculer, pdfReception, pdfCommercial, nombre, date };


