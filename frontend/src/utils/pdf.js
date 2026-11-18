// NAIdo - ouverture securisee des PDF et telechargements (l'adresse exige le jeton de connexion)
import axios from 'axios';
import toast from 'react-hot-toast';

// Ouvre un document (PDF, bon, ticket) dans un nouvel onglet apres l'avoir recupere avec le jeton.
export async function ouvrirPdfSecurise(url) {
  const popup = window.open('', '_blank');
  try {
    const { data } = await axios.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(data);
    if (!popup) { URL.revokeObjectURL(blobUrl); throw new Error('popup'); }
    popup.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  } catch (e) {
    if (popup) popup.close();
    toast.error(e && e.message === 'popup' ? 'Autorisez les fenetres pop-up pour ouvrir le document' : 'Impossible de recuperer le document (connexion et droits a verifier)');
  }
}

// Telecharge un fichier (document QHSE, fiche) sous son vrai nom.
export async function telechargerSecurise(url, nom) {
  try {
    const { data } = await axios.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = blobUrl; a.download = nom || 'document';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (e) {
    toast.error('Impossible de telecharger le document (connexion et droits a verifier)');
  }
}
