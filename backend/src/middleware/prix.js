'use strict';
// NAIdo - accès aux prix d'achat : seuls ces rôles voient les prix et montants des commandes et demandes.
const ROLES_PRIX = ['achat', 'directeur', 'super_admin', 'comptable'];

const peutVoirPrix = (user) => ROLES_PRIX.includes(String(user?.role || '').toLowerCase());

// Champs sensibles : prix unitaires, montants HT/TVA/TTC, prix d'achat des articles
const SENSIBLE = /^(prix|montant)|_(ht|ttc|tva)$/;

// Retire récursivement les champs de prix d'un objet, d'une liste d'objets ou d'un résultat de requête
function retirerPrix(x) {
  if (Array.isArray(x)) return x.map(retirerPrix);
  if (x && typeof x === 'object' && !(x instanceof Date)) {
    const propre = {};
    for (const [k, v] of Object.entries(x)) {
      if (SENSIBLE.test(k)) continue;
      propre[k] = retirerPrix(v);
    }
    return propre;
  }
  return x;
}

module.exports = { peutVoirPrix, retirerPrix };
