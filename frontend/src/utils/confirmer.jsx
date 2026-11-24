// NAIdo - confirmations et saisies dans l'application (remplacent window.confirm et window.prompt,
// que le navigateur peut bloquer ou que l'outil ne peut pas valider).
import React, { useEffect, useState } from 'react';

// Usage : if (!(await confirmer('Valider ce bon ?'))) return;
export function confirmer(message) {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('naido-confirm', { detail: { message, resolve } }));
  });
}

// Usage : const motif = await saisir('Motif du refus :', 'valeur par defaut'); // null si annule
export function saisir(message, valeurDefaut = '') {
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('naido-saisie', { detail: { message, valeurDefaut, resolve } }));
  });
}

// A monter une seule fois, dans App
export function ConfirmHost() {
  const [demande, setDemande] = useState(null);
  const [saisie, setSaisie] = useState(null);
  const [texte, setTexte] = useState('');

  useEffect(() => {
    const ecouteConfirm = (e) => setDemande(e.detail);
    const ecouteSaisie = (e) => { setTexte(e.detail.valeurDefaut || ''); setSaisie(e.detail); };
    window.addEventListener('naido-confirm', ecouteConfirm);
    window.addEventListener('naido-saisie', ecouteSaisie);
    return () => {
      window.removeEventListener('naido-confirm', ecouteConfirm);
      window.removeEventListener('naido-saisie', ecouteSaisie);
    };
  }, []);

  const fond = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 };
  const boite = { background: '#fff', borderRadius: 14, padding: 24, maxWidth: 440, width: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' };
  const btnAnnuler = { padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' };
  const btnOk = { padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0369a1', color: '#fff', fontWeight: 700, cursor: 'pointer' };

  if (demande) {
    const repondre = (v) => { demande.resolve(v); setDemande(null); };
    return (
      <div style={fond}>
        <div style={boite}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: '#111827' }}>{demande.message}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => repondre(false)} style={btnAnnuler}>Annuler</button>
            <button onClick={() => repondre(true)} style={btnOk}>Confirmer</button>
          </div>
        </div>
      </div>
    );
  }

  if (saisie) {
    const repondre = (v) => { saisie.resolve(v); setSaisie(null); };
    return (
      <div style={fond}>
        <div style={boite}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#111827' }}>{saisie.message}</div>
          <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={3}
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => repondre(null)} style={btnAnnuler}>Annuler</button>
            <button onClick={() => repondre(texte)} style={btnOk}>Valider</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
