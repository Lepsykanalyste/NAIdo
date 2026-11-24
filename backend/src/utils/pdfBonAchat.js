'use strict';
// NAIdo - bon de commande en vrai PDF (pdfkit), avec QR code vers le document.
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const f = (n, d = 0) => (n === null || n === undefined || n === '') ? '—'
  : parseFloat(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const date = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function pdfBonAchat(cmd, lignes, urlQr) {
  return new Promise(async (resolve, reject) => {
    try {
      const qr = urlQr ? await QRCode.toBuffer(urlQr, { type: 'png', width: 120, margin: 1 }) : null;
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const morceaux = [];
      doc.on('data', m => morceaux.push(m));
      doc.on('end', () => resolve(Buffer.concat(morceaux)));
      doc.on('error', reject);

      // En-tete
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#000').text('NAI', 50, 50);
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Service Achats', 50, 70);
      doc.fillColor('#000').fontSize(9).text('Date : ' + date(cmd.date_commande), 350, 50, { width: 195, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(14).text('BON DE COMMANDE', 50, 110);
      doc.font('Helvetica-Bold').fontSize(12).text(cmd.numero_commande || '', 50, 130);
      if (qr) doc.image(qr, 460, 95, { width: 90 });

      // Fournisseur et commande
      doc.font('Helvetica-Bold').fontSize(10).text('Fournisseur', 50, 165);
      doc.font('Helvetica').fontSize(9).text(cmd.raison_sociale || '—', 50, 180);
      doc.text([cmd.adresse, cmd.ville].filter(Boolean).join(', ') || '—', 50, 195);
      doc.text([cmd.telephone, cmd.email].filter(Boolean).join(' / ') || '—', 50, 210);
      doc.font('Helvetica-Bold').fontSize(10).text('Commande', 330, 165);
      doc.font('Helvetica').fontSize(9).text('Livraison prévue : ' + date(cmd.date_livraison_prevue), 330, 180);
      doc.text('Réf. fournisseur : ' + (cmd.reference_fournisseur || '—'), 330, 195);

      // Tableau des lignes
      let y = 245;
      const cols = [
        { t: 'Code', x: 50, w: 70 }, { t: 'Désignation', x: 120, w: 180 },
        { t: 'Quantité', x: 300, w: 65, r: true }, { t: 'Prix HT', x: 370, w: 70, r: true }, { t: 'Total HT', x: 440, w: 105, r: true },
      ];
      doc.font('Helvetica-Bold').fontSize(9);
      cols.forEach(c => doc.text(c.t, c.x, y, { width: c.w, align: c.r ? 'right' : 'left' }));
      y += 16;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 6;
      doc.font('Helvetica').fontSize(9);
      for (const l of lignes) {
        if (y > 700) { doc.addPage(); y = 60; }
        const vals = [l.article_code || '', l.designation || '', f(l.quantite_commandee, 3), f(l.prix_unitaire_ht), f(l.montant_ht)];
        cols.forEach((c, i) => doc.text(String(vals[i]), c.x, y, { width: c.w, align: c.r ? 'right' : 'left' }));
        y += 16;
      }
      y += 6;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 10;

      // Totaux
      const total = (libelle, valeur, gras) => {
        doc.font(gras ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
        doc.text(libelle, 330, y, { width: 105 });
        doc.text(valeur, 440, y, { width: 105, align: 'right' });
        y += 16;
      };
      total('Total HT', f(cmd.montant_ht) + ' FCFA');
      total('TVA (' + f(cmd.taux_tva, 0) + ' %)', f(cmd.montant_tva) + ' FCFA');
      total('Total TTC', f(cmd.montant_ttc) + ' FCFA', true);

      if (cmd.notes) {
        y += 10;
        doc.font('Helvetica-Bold').fontSize(9).text('Notes', 50, y);
        y += 12;
        doc.font('Helvetica').text(cmd.notes, 50, y, { width: 495 });
        y += 30;
      }

      // Signatures
      y = Math.max(y + 30, 640);
      doc.font('Helvetica-Bold').fontSize(9).text('SERVICE ACHAT', 50, y);
      doc.font('Helvetica').text(cmd.cree_par_nom || '', 50, y + 14);
      doc.text('Signature :', 50, y + 60);
      doc.font('Helvetica-Bold').text('DIRECTION', 330, y);
      const valide = cmd.validee_at || cmd.confirme_at;
      doc.font('Helvetica').text(valide ? 'Validé par la direction le ' + date(valide) : 'En attente de validation', 330, y + 14, { width: 215 });
      doc.text('Signature :', 330, y + 60);

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { pdfBonAchat };
