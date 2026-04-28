import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('naido_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('naido_token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (loginVal, password) => {
    const { data } = await axios.post('/api/auth/login', { login: loginVal, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('naido_token', data.token);
    localStorage.setItem('naido_user', JSON.stringify(data.user));
    return data.user;
  };

  const loginBadge = async (badge_qr) => {
    const { data } = await axios.post('/api/auth/login-badge', { badge_qr });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('naido_token', data.token);
    localStorage.setItem('naido_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('naido_token');
    localStorage.removeItem('naido_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginBadge, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
