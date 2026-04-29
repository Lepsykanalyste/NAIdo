import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth.jsx';

import Login       from './pages/Login';
import Operateur   from './pages/Operateur';
import Regleur     from './pages/Regleur';
import Qualite     from './pages/Qualite';
import ChefAtelier from './pages/ChefAtelier';

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function RedirectParRole() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const map = {
    operateur:    '/operateur',
    regleur:      '/regleur',
    qualite:      '/qualite',
    chef_atelier: '/chef',
    super_admin:  '/chef',
    directeur:    '/chef',
    magasinier:   '/chef',
    achat:        '/chef',
    vente:        '/chef',
    qhse:         '/chef',
    technicien:   '/chef',
    rh:           '/chef',
  };
  return <Navigate to={map[user.role] || '/chef'} replace />;
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/operateur/*" element={
          <PrivateRoute roles={['operateur']}>
            <Operateur />
          </PrivateRoute>
        }/>

        <Route path="/regleur/*" element={
          <PrivateRoute roles={['regleur']}>
            <Regleur />
          </PrivateRoute>
        }/>

        <Route path="/qualite/*" element={
          <PrivateRoute roles={['qualite']}>
            <Qualite />
          </PrivateRoute>
        }/>

        <Route path="/chef/*" element={
          <PrivateRoute roles={['chef_atelier','super_admin','directeur','magasinier','achat','vente','qhse','technicien','rh']}>
            <ChefAtelier />
          </PrivateRoute>
        }/>

        <Route path="/super_admin/*" element={<RedirectParRole />} />
        <Route path="/" element={<RedirectParRole />} />
        <Route path="*" element={<RedirectParRole />} />
      </Routes>
    </>
  );
}
