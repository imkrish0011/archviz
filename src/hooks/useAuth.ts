import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setLoading]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will update user state automatically
    } catch (err) {
      console.error('Google sign-in error:', err);
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged fires → sets user to null
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  };

  return { user, loading, signInWithGoogle, signOut };
}
