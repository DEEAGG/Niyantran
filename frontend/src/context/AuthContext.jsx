import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('niyantran_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      const storedToken = localStorage.getItem('niyantran_token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      try {
        const profile = await apiClient.get('/auth/me');
        if (isMounted) {
          setUser(profile);
          setToken(storedToken);
        }
      } catch (err) {
        console.error('Failed to verify token:', err);
        if (isMounted) {
          localStorage.removeItem('niyantran_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('niyantran_token', res.access_token);
    setToken(res.access_token);
    setUser(res);
    return res;
  };

  const register = async ({ email, password, full_name, institution_name }) => {
    const res = await apiClient.post('/auth/register', {
      email,
      password,
      full_name,
      institution_name,
    });
    localStorage.setItem('niyantran_token', res.access_token);
    setToken(res.access_token);
    setUser(res);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('niyantran_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async ({ full_name, institution_name }) => {
    const res = await apiClient.put('/auth/profile', { full_name, institution_name });
    setUser((prev) => ({ ...prev, ...res }));
    return res;
  };

  const changePassword = async ({ current_password, new_password }) => {
    return await apiClient.post('/auth/change-password', {
      current_password,
      new_password,
    });
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    role: user?.role || 'institution_user',
    isOfficer: user?.role === 'reviewer' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
