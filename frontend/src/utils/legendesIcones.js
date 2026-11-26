// NAIdo - Legende visible sous chaque bouton qui ne contient qu'une icone (explique l'action).
// Fonctionne sur toute l'application : on ajoute seulement l'attribut data-legende ; le texte est affiche par une regle CSS
// (::after), donc React n'est jamais perturbe. Un bouton garde sa propre legende s'il a deja un titre (title / aria-label).
// Pour desactiver sur un bouton : data-sans-legende.

const ICONES = {
  '👁': 'Détails', '📋': 'Détails', '📦': 'Détails',
  '✏': 'Modifier', '✎': 'Modifier',
  '🗑': 'Supprimer',
  '🖨': 'PDF', '📄': 'PDF', '🌐': 'HTML',
  '➕': 'Ajouter', '+': 'Ajouter',
  '✉': 'Envoyer', '📧': 'Envoyer',
  '🔄': 'Actualiser', '🔁': 'Répéter',
  '💾': 'Enregistrer',
  '✓': 'Valider', '✔': 'Valider', '✅': 'Valider',
  '⛔': 'Refuser', '🚫': 'Refuser',
  '⬇': 'Télécharger', '📥': 'Télécharger', '📤': 'Exporter',
  '🔍': 'Rechercher', '⚙': 'Réglages',
  '📎': 'Joindre', '🖼': 'Photo', '📷': 'Photo', '🔗': 'Lien',
  '📊': 'Rapport', '📞': 'Appeler', '✍': 'Signer',
  '🔒': 'Verrouiller', '🔓': 'Déverrouiller', '📌': 'Épingler', '⭐': 'Favori',
  '▶': 'Lancer', '⏸': 'Pause', '⏹': 'Arrêter', '📅': 'Date', '🧾': 'Facture',
};

const STYLE_ID = 'naido-legendes-icones';
const CSS = `
button[data-legende]{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.15;height:auto}
button[data-legende]::after{content:attr(data-legende);font-size:9px;font-weight:600;letter-spacing:.01em;white-space:nowrap;opacity:.85}
`;

const nettoyer = (t) => (t || '').replace(/[︎️‍\s]/g, '');

function legendePour(b) {
  if (b.hasAttribute('data-sans-legende') || b.hasAttribute('data-legende')) return null;
  const texte = nettoyer(b.textContent);
  // uniquement les boutons qui ne contiennent qu'une ou deux icones (pas de lettres ni de chiffres)
  if (!texte || Array.from(texte).length > 3 || /[\p{L}\p{N}]/u.test(texte)) return null;
  return b.getAttribute('title') || b.getAttribute('aria-label') || ICONES[texte] || null;
}

function traiter(racine) {
  if (!racine || racine.nodeType !== 1) return;
  const boutons = [];
  if (racine.tagName === 'BUTTON') boutons.push(racine);
  racine.querySelectorAll('button').forEach((b) => boutons.push(b));
  boutons.forEach((b) => {
    const legende = legendePour(b);
    if (legende) b.setAttribute('data-legende', legende);
  });
}

export function demarrerLegendes() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  let file = new Set();
  let programme = false;
  const vider = () => {
    programme = false;
    const noeuds = file;
    file = new Set();
    noeuds.forEach(traiter);
  };
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) file.add(n); }));
    if (!programme && file.size) { programme = true; requestAnimationFrame(vider); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  traiter(document.body);
}

demarrerLegendes();
