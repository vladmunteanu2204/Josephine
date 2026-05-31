import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}


export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  async function signup(email, password, displayName) {
    if (!auth) throw new Error('Authentication is not configured.');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential;
  }

  function login(email, password) {
    if (!auth) throw new Error('Authentication is not configured.');
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    if (!auth) return Promise.resolve();
    return signOut(auth);
  }

  function resetPassword(email) {
    if (!auth) throw new Error('Authentication is not configured.');
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: false
    };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
  }

  async function loginWithGoogle() {
    if (!auth) throw new Error('Authentication is not configured.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      return result;
    } catch (error) {
      // User cancelled — not an error worth showing
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      let errorMessage = 'Authentication failed. Please try again.';
      if (error.code === 'auth/popup-blocked')
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
      else if (error.code === 'auth/network-request-failed')
        errorMessage = 'Network error. Please check your connection.';
      else if (error.code === 'auth/unauthorized-domain')
        errorMessage = 'This domain is not authorized for Google sign-in.';
      else if (error.code === 'auth/operation-not-allowed')
        errorMessage = 'Google sign-in is not enabled. Enable it in Firebase Console.';

      setAuthError(errorMessage);
      throw error;
    }
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Stabilize clearAuthError function identity with useCallback
  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout,
    loginWithGoogle,
    resetPassword,
    authError,
    clearAuthError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
