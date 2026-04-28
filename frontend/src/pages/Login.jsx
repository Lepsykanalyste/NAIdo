import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, loginBadge } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('password'); // 'password' | 'badge'
  const [form, setForm] = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const roleRedirect = (role) => {
    const map = { operateur: '/operateur', regleur: '/regleur',
                  qualite: '/qualite', chef_atelier: '/chef' };
    return map[role] || '/';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.login, form.password);
      toast.success(`Bienvenue ${user.prenom} !`);
      navigate(roleRedirect(user.role));
    } catch {
      toast.error('Identifiants incorrects');
    } finally { setLoading(false); }
  };

  const handleBadgeScan = async (qrValue) => {
    setLoading(true);
    try {
      const user = await loginBadge(qrValue);
      toast.success(`Bienvenue ${user.prenom} !`);
      navigate(roleRedirect(user.role));
    } catch {
      toast.error('Badge non reconnu');
    } finally { setLoading(false); setScanning(false); }
  };

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-6">
      {/* Logo & titre */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-green-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-green-900 text-3xl font-bold">N</span>
        </div>
        <h1 className="text-white text-3xl font-bold">NAIdo</h1>
        <p className="text-green-300 text-sm mt-1">MES — Atelier 3 · Green Industry</p>
      </div>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        {/* Onglets */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode==='password' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}
            onClick={() => setMode('password')}
          >
            Login / Mot de passe
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode==='badge' ? 'bg-green-700 text-white' : 'bg-white text-gray-600'}`}
            onClick={() => setMode('badge')}
          >
            Badge QR Code
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
              <input
                type="text"
                value={form.login}
                onChange={e => setForm({...form, login: e.target.value})}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Votre login"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-700 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-gray-600 text-sm">Scannez votre badge QR Code avec la caméra</p>
            <button
              onClick={() => {
                const qr = prompt('Valeur QR Code (test) :');
                if (qr) handleBadgeScan(qr);
              }}
              disabled={loading}
              className="w-full bg-green-700 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loading ? 'Vérification...' : 'Scanner le badge'}
            </button>
            <p className="text-xs text-gray-400">Un lecteur QR Code physique USB peut aussi être utilisé</p>
          </div>
        )}
      </div>

      <p className="text-green-400 text-xs mt-6">v1.0.0 — Réseau interne uniquement</p>
    </div>
  );
}
