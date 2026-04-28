import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';

import Login        from './pages/Login';
import Operateur    from './pages/Operateur';
import Regleur      from './pages/Regleur';
import Qualite      from './pages/Qualite';
import ChefAtelier  from './pages/ChefAtelier';

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

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
          <PrivateRoute roles={['chef_atelier']}>
            <ChefAtelier />
          </PrivateRoute>
        }/>

        {/* Redirection auto selon rôle */}
        <Route path="/" element={
          user ? <Navigate to={`/${user.role === 'chef_atelier' ? 'chef' : user.role}`} replace />
               : <Navigate to="/login" replace />
        }/>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
