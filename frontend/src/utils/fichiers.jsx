// NAIdo — fichiers téléversés (/uploads/...) : ils ne sont plus publics, ils se chargent avec le jeton de connexion.
import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Ouvre un fichier téléversé dans un nouvel onglet
export async function ouvrirFichier(chemin) {
  if (!chemin) return;
  const { data } = await axios.get(chemin, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Image téléversée : chargée avec le jeton, affichée depuis une URL locale
export function ImageFichier({ chemin, ...props }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    let annule = false;
    if (!chemin) return undefined;
    axios.get(chemin, { responseType: 'blob' })
      .then(({ data }) => { if (!annule) { url = URL.createObjectURL(data); setSrc(url); } })
      .catch(() => { if (!annule) setSrc(null); });
    return () => { annule = true; if (url) URL.revokeObjectURL(url); };
  }, [chemin]);
  if (!src) return null;
  return <img src={src} {...props} />;
}
