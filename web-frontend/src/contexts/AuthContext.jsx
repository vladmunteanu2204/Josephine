import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Detect if user is on mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  async function signup(email, password, displayName) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    
    // Force account selection and add custom parameters for better mobile experience
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const isMobile = isMobileDevice();
    
    try {
      if (isMobile) {
        console.log('Mobile device detected, using signInWithRedirect');
        await signInWithRedirect(auth, provider);
      } else {
        console.log('Desktop device detected, using signInWithPopup');
        try {
          const result = await signInWithPopup(auth, provider);
          return result;
        } catch (popupError) {
          // If popup is blocked, fall back to redirect
          if (popupError.code === 'auth/popup-blocked' || 
              popupError.code === 'auth/cancelled-popup-request' ||
              popupError.code === 'auth/popup-closed-by-user') {
            console.log('Popup blocked, falling back to redirect');
            await signInWithRedirect(auth, provider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Authentication failed. Please try again.';
      if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized. Please contact support.';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email using a different sign-in method.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google sign-in is not enabled. Please contact support.';
      }
      
      setAuthError(errorMessage);
      throw error;
    }
  }

  useEffect(() => {
    let redirectCheckComplete = false;
    
    // Check for redirect result when app loads (mobile users returning from Google)
    getRedirectResult(auth)
      .then((result) => {
        redirectCheckComplete = true;
        if (result) {
          console.log('Redirect result received:', result.user);
          setCurrentUser(result.user);
          setAuthError(null);
        }
      })
      .catch((error) => {
        redirectCheckComplete = true;
        console.error('Redirect result error:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Authentication failed. Please try again.';
        if (error.code === 'auth/popup-blocked') {
          errorMessage = 'Popup was blocked. Please allow popups for this site.';
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.code === 'auth/unauthorized-domain') {
          errorMessage = 'This domain is not authorized. Please contact support.';
        }
        
        setAuthError(errorMessage);
      });

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // Only set loading to false after both redirect check and auth state are ready
      if (redirectCheckComplete || !isMobileDevice()) {
        setLoading(false);
      }
    });

    // Fallback: ensure loading state clears after reasonable timeout
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
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
    authError,
    clearAuthError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
