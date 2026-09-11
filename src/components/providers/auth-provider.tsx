"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { subscribeAuth, fetchUserProfile } from "@/lib/firebase/auth";
import type { AppUser } from "@/types";

interface Ctx {
  firebaseUser: User | null;
  profile: AppUser | null;
  loading: boolean;
}
const AuthCtx = createContext<Ctx>({ firebaseUser: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeAuth(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const p = await fetchUserProfile(user.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthCtx.Provider value={{ firebaseUser, profile, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
