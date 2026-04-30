import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth.jsx';
import Login       from './pages/Login';
import Operateur   from './pages/Operateur';
import Regleur     from './pages/Regleur';
import Qualite     from './pages/Qualite';
import ChefAtelier from './pages/ChefAtelier';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  componentDidCatch(error, info) { this.setState({ error: error.toString(), info: info.componentStack }); }
  render() {
    if (this.state.error) return (
      <div style={{padding:40,background:'#1a1a2e',color:'#e74c3c',fontFamily:'monospace',minHeight:'100vh'}}>
        <h2>🔴 Erreur React — NAIdo Debug</h2>
        <pre style={{background:'#16213e',padding:20,borderRadius:8,fontSize:12,overflow:'auto',color:'#ff6b6b'}}>
          {this.state.error}
        </pre>
        <pre style={{background:'#0f3460',padding:20,borderRadius:8,fontSize:11,overflow:'auto',color:'#a8dadc',marginTop:16}}>
          {this.state.info}
        </pre>
        <button onClick={()=>window.location.reload()} 
          style={{marginTop:20,padding:'10px 24px',background:'#e94560',border:'none',borderRadius:8,color:'#fff',cursor:'pointer',fontSize:14}}>
          🔄 Recharger
        </button>
      </div>
    );
    return this.props.children;
  }
}

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
    operateur:'opera teur', regleur:'/regleur', qualite:'/qualite',
  };
  return <Navigate to={map[user.role] || '/chef'} replace />;
}
export default function App() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/operateur/*" element={<PrivateRoute roles={['operateur']}><Operateur /></PrivateRoute>}/>
        <Route path="/regleur/*" element={<PrivateRoute roles={['regleur']}><Regleur /></PrivateRoute>}/>
        <Route path="/qualite/*" element={<PrivateRoute roles={['qualite']}><Qualite /></PrivateRoute>}/>
        <Route path="/chef/*" element={
          <ErrorBoundary>
            <PrivateRoute roles={['chef_atelier','super_admin','directeur','magasinier','achat','vente','qhse','technicien','rh','responsable_qhse','responsable_rh','technicien_regleur','controleur_qualite','comptable','responsable_stock','commercial','technicien_gmao','emballeur']}>
              <ChefAtelier />
            </PrivateRoute>
          </ErrorBoundary>
        }/>
        <Route path="/" element={<RedirectParRole />} />
        <Route path="*" element={<RedirectParRole />} />
      </Routes>
    </>
  );
}
