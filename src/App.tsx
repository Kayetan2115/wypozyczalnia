/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { UserProfile } from './types';
import SellerView from './components/SellerView';
import AdminView from './components/AdminView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toaster } from '@/components/ui/sonner';
import { Loader2, LogOut, Waves, Lock, User, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './lib/api';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await api.getUsers();
        setDbConnected(true);
      } catch (e) {
        setDbConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('swopr_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    
    try {
      // Try to login with credentials
      let loggedUser;
      try {
        loggedUser = await api.login({ username, password });
      } catch (loginError: any) {
        // If login fails, check if it's the first time admin login
        const lowerUsername = username.toLowerCase();
        if (lowerUsername === 'admin' && password === 'swopr') {
          const users = await api.getUsers();
          const adminExists = users.find((u: any) => u.username.toLowerCase() === 'admin');
          
          if (!adminExists) {
            const newUser = {
              username: 'admin',
              password: 'swopr',
              name: 'Administrator',
              role: 'admin',
              email: 'admin@swopr.local'
            };
            const createdAdmin = await api.createUser(newUser);
            loggedUser = { ...createdAdmin, uid: createdAdmin._id };
            toast.success('System zainicjalizowany!');
          } else {
            throw loginError;
          }
        } else {
          throw loginError;
        }
      }

      if (loggedUser) {
        const userWithUid = { ...loggedUser, uid: loggedUser._id || loggedUser.uid } as unknown as UserProfile;
        setUser(userWithUid);
        localStorage.setItem('swopr_user', JSON.stringify(userWithUid));
        toast.success('Zalogowano pomyślnie');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Błąd logowania');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('swopr_user');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Waves className="h-10 w-10 text-blue-600" />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">śwopr</h1>
            <p className="mt-2 text-slate-600">System Zarządzania Wypożyczalnią</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Login</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="username" 
                    placeholder="Wpisz login" 
                    className="pl-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Hasło</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            
            <Button type="submit" className="w-full py-6 text-lg" disabled={loginLoading}>
              {loginLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Zaloguj się'}
            </Button>

            <div className="mt-4 flex flex-col items-center gap-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                {dbConnected ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-amber-500" />}
                <span>Status serwera: {dbConnected ? 'Połączono' : 'Brak połączenia'}</span>
              </div>
              <p className="text-center px-4">
                Dane są synchronizowane w czasie rzeczywistym z serwerem MongoDB.
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Waves className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold tracking-tight">śwopr</span>
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 uppercase">
              {user.role}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 text-[10px] font-medium text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => window.location.reload()}
              title="Kliknij, aby odświeżyć i wymusić synchronizację"
            >
              {dbConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" />
                  Połączono
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-amber-500" />
                  Łączenie...
                </>
              )}
            </div>
            <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {user.role === 'admin' ? <AdminView user={user} /> : <SellerView user={user} />}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}


