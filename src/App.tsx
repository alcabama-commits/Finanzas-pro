import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Auth } from './components/Auth';
import { Toaster } from '@/components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="size-10 animate-spin text-zinc-900" />
      </div>
    );
  }

  return (
    <>
      {user ? <Dashboard /> : <Auth />}
      <Toaster position="top-center" />
    </>
  );
}
