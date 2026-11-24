// NAIdo - confirmation dans l'application (remplace window.confirm, qui peut etre bloquee par le navigateur)
import React, { useEffect, useState } from 'react';

// Usage : if (!(await confirmer('Valider ce bon ?'))) return;
export function confirmer(message) {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('naido-confirm', { detail: { message, resolve } }));
  });
}

// A monter une seule fois, dans App
export function ConfirmHost() {
  const [demande, setDemande] = useState(null);

  useEffect(() => {
    const ecoute = (e) => setDemande(e.detail);
    window.addEventListener('naido-confirm', ecoute);
    return () => window.removeEventListener('naido-confirm', ecoute);
  }, []);

  if (!demande) return null;

  const repondre = (valeur) => {
    demande.resolve(valeur);
    setDemande(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: '#111827' }}>{demande.message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => repondre(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Annuler</button>
          <button onClick={() => repondre(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0369a1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}
