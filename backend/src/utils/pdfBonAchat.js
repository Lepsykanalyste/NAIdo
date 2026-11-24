'use strict';
// NAIdo - bon de commande en PDF (pdfkit) : mise en page soignee, totaux calcules a partir des lignes, QR code vers le document.
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const BLEU = '#0369a1';
const BLEU_CLAIR = '#e0f2fe';
const GRIS = '#6b7280';
const LIGNE = '#d1d5db';
const ZEBRA = '#f9fafb';

const nombre = (n, d = 0) => (n === null || n === undefined || n === '' || isNaN(parseFloat(n)))
  ? '—' : parseFloat(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const date = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// Totaux recalcules a partir des lignes (HT = quantite x prix ; TVA par ligne au taux du bon)
function calculer(cmd, lignes) {
  const taux = parseFloat(cmd.taux_tva);
  let ht = 0;
  let tva = 0;
  for (const l of lignes) {
    const montant = (parseFloat(l.quantite_commandee) || 0) * (parseFloat(l.prix_unitaire_ht) || 0);
    ht += montant;
    tva += montant * ((Number.isFinite(taux) ? taux : 0) / 100);
  }
  return { ht, tva, ttc: ht + tva };
}

function pdfBonAchat(cmd, lignes, urlQr) {
  return new Promise(async (resolve, reject) => {
    try {
      const qr = urlQr ? await QRCode.toBuffer(urlQr, { type: 'png', width: 200, margin: 1 }) : null;
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const morceaux = [];
      doc.on('data', m => morceaux.push(m));
      doc.on('end', () => resolve(Buffer.concat(morceaux)));
      doc.on('error', reject);

      const G = 40;          // marge gauche
      const L = 595 - 40;    // bord droit
      const largeur = L - G;

      // ----- Bandeau -----
      doc.rect(0, 0, 595, 92).fill(BLEU);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('NAI', G, 30);
      doc.font('Helvetica').fontSize(9).text('Service Achats', G, 58);
      doc.font('Helvetica-Bold').fontSize(18).text('BON DE COMMANDE', 260, 26, { width: L - 260, align: 'right' });
      doc.font('Helvetica').fontSize(11).text(cmd.numero_commande || '', 260, 52, { width: L - 260, align: 'right' });
      doc.fontSize(9).text('Date : ' + date(cmd.date_commande), 260, 68, { width: L - 260, align: 'right' });
      doc.fillColor('#000000');

      // ----- Fournisseur / commande (deux colonnes) -----
      const y0 = 116;
      const demi = (largeur - 20) / 2;
      const bloc = (x, titre, lignesTxt) => {
        doc.rect(x, y0, demi, 88).lineWidth(0.8).strokeColor(LIGNE).stroke();
        doc.rect(x, y0, demi, 20).fill(BLEU_CLAIR);
        doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9).text(titre, x + 10, y0 + 6);
        doc.fillColor('#111827').font('Helvetica').fontSize(9.5);
        lignesTxt.forEach((t, i) => doc.text(t, x + 10, y0 + 28 + i * 16, { width: demi - 20 }));
      };
      bloc(G, 'FOURNISSEUR', [
        cmd.raison_sociale || '—',
        [cmd.adresse, cmd.ville].filter(Boolean).join(', ') || '—',
        [cmd.telephone, cmd.email].filter(Boolean).join(' / ') || '—',
      ]);
      bloc(G + demi + 20, 'COMMANDE', [
        'Livraison prévue : ' + date(cmd.date_livraison_prevue),
        'Référence fournisseur : ' + (cmd.reference_fournisseur || '—'),
        'Établi par : ' + (cmd.cree_par_nom || '—'),
      ]);

      // ----- Tableau des lignes -----
      let y = 230;
      const cols = [
        { t: 'Code', x: G, w: 70, al: 'left' },
        { t: 'Désignation', x: G + 70, w: 215, al: 'left' },
        { t: 'Quantité', x: G + 285, w: 60, al: 'right' },
        { t: 'Prix HT', x: G + 345, w: 70, al: 'right' },
        { t: 'Total HT', x: G + 415, w: largeur - 415, al: 'right' },
      ];
      doc.rect(G, y, largeur, 22).fill(BLEU);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      cols.forEach(c => doc.text(c.t, c.x + 6, y + 7, { width: c.w - 12, align: c.al }));
      doc.fillColor('#000000');
      y += 22;

      lignes.forEach((l, i) => {
        const vals = [
          l.article_code || '',
          l.designation || '',
          nombre(l.quantite_commandee, 3),
          nombre(l.prix_unitaire_ht),
          nombre((parseFloat(l.quantite_commandee) || 0) * (parseFloat(l.prix_unitaire_ht) || 0)),
        ];
        const hauteur = Math.max(20, doc.heightOfString(vals[1], { width: cols[1].w - 12 }) + 8);
        if (y + hauteur > 690) { doc.addPage(); y = 50; }
        if (i % 2 === 1) doc.rect(G, y, largeur, hauteur).fill(ZEBRA);
        doc.fillColor('#111827').font('Helvetica').fontSize(9);
        cols.forEach((c, k) => doc.text(String(vals[k]), c.x + 6, y + 5, { width: c.w - 12, align: c.al }));
        y += hauteur;
        doc.moveTo(G, y).lineTo(L, y).lineWidth(0.5).strokeColor(LIGNE).stroke();
      });

      // ----- Totaux (recalcules) -----
      const t = calculer(cmd, lignes);
      y += 14;
      if (y > 620) { doc.addPage(); y = 50; }
      const xT = G + 330;
      const wT = largeur - 330;
      const totalLigne = (libelle, valeur, gras) => {
        doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(gras ? 11 : 10).fillColor('#111827');
        doc.text(libelle, xT + 10, y, { width: wT / 2 - 10 });
        doc.text(valeur, xT + wT / 2, y, { width: wT / 2 - 10, align: 'right' });
        y += gras ? 22 : 16;
      };
      doc.rect(xT, y - 4, wT, 78).fill(BLEU_CLAIR);
      totalLigne('Total HT', nombre(t.ht) + ' FCFA');
      totalLigne('TVA (' + nombre(cmd.taux_tva, 0) + ' %)', nombre(t.tva) + ' FCFA');
      doc.moveTo(xT + 10, y - 2).lineTo(xT + wT - 10, y - 2).lineWidth(0.8).strokeColor(BLEU).stroke();
      totalLigne('Total TTC', nombre(t.ttc) + ' FCFA', true);
      y += 12;

      if (cmd.notes) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text('Notes', G, y);
        doc.font('Helvetica').fontSize(9).fillColor('#111827').text(cmd.notes, G, y + 12, { width: largeur });
        y += 12 + doc.heightOfString(cmd.notes, { width: largeur }) + 10;
      }

      // ----- Signatures et QR code -----
      if (y > 640) { doc.addPage(); y = 50; }
      const ySig = Math.max(y + 10, 660);
      const sigW = (largeur - 20) / 2;
      [[G, 'SERVICE ACHAT', cmd.cree_par_nom || ''], [G + sigW + 20, 'DIRECTION',
        (cmd.validee_at || cmd.confirme_at) ? 'Validé le ' + date(cmd.validee_at || cmd.confirme_at) : 'En attente de validation']]
        .forEach(([x, titre, sous]) => {
          doc.rect(x, ySig, sigW, 90).lineWidth(0.8).strokeColor(LIGNE).stroke();
          doc.font('Helvetica-Bold').fontSize(9).fillColor(BLEU).text(titre, x + 10, ySig + 8);
          doc.font('Helvetica').fontSize(9).fillColor('#111827').text(sous, x + 10, ySig + 24, { width: sigW - 20 });
          doc.fillColor(GRIS).fontSize(8).text('Signature :', x + 10, ySig + 70);
        });
      if (qr) {
        doc.image(qr, L - 62, ySig - 88, { width: 62 });
        doc.fillColor(GRIS).font('Helvetica').fontSize(7).text('Scanner pour ouvrir le document', L - 130, ySig - 22, { width: 128, align: 'right' });
      }

      // ----- Pied de page -----
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(pages.start + i);
        doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
          .text(`NAI — ${cmd.numero_commande || ''} — page ${i + 1} / ${pages.count}`, G, 812, { width: largeur, align: 'center', lineBreak: false });
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { pdfBonAchat, calculer };
