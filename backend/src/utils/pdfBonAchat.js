'use strict';
// NAIdo - bon de commande en PDF (pdfkit) : une seule page, QR code en haut a droite, totaux recalcules a partir des lignes.
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const BLEU = '#0369a1';
const BLEU_CLAIR = '#e0f2fe';
const GRIS = '#6b7280';
const LIGNE = '#d1d5db';
const ZEBRA = '#f3f4f6';

const nombre = (n, d = 0) => (n === null || n === undefined || n === '' || isNaN(parseFloat(n)))
  ? '—' : parseFloat(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
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

function pdfBonAchat(cmd, lignes, urlQr) {
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
        doc.rect(x, y0, demi, 74).lineWidth(0.8).strokeColor(LIGNE).stroke();
        doc.rect(x, y0, demi, 18).fill(BLEU_CLAIR);
        doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9).text(titre, x + 10, y0 + 5);
        doc.fillColor('#111827').font('Helvetica').fontSize(corps);
        lignesTxt.forEach((t, i) => doc.text(t, x + 10, y0 + 25 + i * 15, { width: demi - 20 }));
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
      let y = 200;
      const cols = [
        { t: 'Code', x: G, w: 70, al: 'left' },
        { t: 'Désignation', x: G + 70, w: 215, al: 'left' },
        { t: 'Quantité', x: G + 285, w: 60, al: 'right' },
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
          nombre(l.quantite_commandee, 3),
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

      // ----- Totaux (recalcules) -----
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

      // ----- Notes -----
      if (cmd.notes) {
        doc.font('Helvetica-Bold').fontSize(corps).fillColor(BLEU).text('Notes', G, y);
        doc.font('Helvetica').fontSize(corps).fillColor('#111827').text(cmd.notes, G, y + 12, { width: largeur });
        y += 12 + doc.heightOfString(cmd.notes, { width: largeur }) + 8;
      }

      // ----- Signatures (en bas de la page) -----
      const ySig = Math.max(y + 8, 668);
      const sigW = (largeur - 16) / 2;
      [[G, 'SERVICE ACHAT', cmd.cree_par_nom || ''],
       [G + sigW + 16, 'DIRECTION', (cmd.validee_at || cmd.confirme_at) ? 'Validé le ' + date(cmd.validee_at || cmd.confirme_at) : 'En attente de validation']]
        .forEach(([x, titre, sous]) => {
          doc.rect(x, ySig, sigW, 76).lineWidth(0.8).strokeColor(LIGNE).stroke();
          doc.font('Helvetica-Bold').fontSize(corps).fillColor(BLEU).text(titre, x + 10, ySig + 7);
          doc.font('Helvetica').fontSize(corps).fillColor('#111827').text(sous, x + 10, ySig + 22, { width: sigW - 20 });
          doc.fillColor(GRIS).fontSize(8).text('Signature :', x + 10, ySig + 58);
        });

      doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
        .text(`NAI — ${cmd.numero_commande || ''}`, G, 780, { width: largeur, align: 'center', lineBreak: false });

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { pdfBonAchat, calculer };
