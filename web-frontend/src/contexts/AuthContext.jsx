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

// Detect if user is on mobile device using capability checks (more reliable than UA)
function isMobileDevice() {
  // Check for touch support with multiple touch points (not just single touch for stylus)
  const hasTouchPoints = navigator.maxTouchPoints > 1;
  
  // Check for coarse pointer (touch screen) - true mobile devices have coarse primary pointer
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  
  // Check for small screen (mobile-sized)
  const hasSmallScreen = window.innerWidth < 768;
  
  // User agent as fallback
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Stronger detection: coarse pointer with touch OR small screen with mobile UA
  // This avoids classifying touch-enabled laptops as mobile
  const isMobile = (hasCoarsePointer && hasTouchPoints) || (hasSmallScreen && mobileUA);
  
  // Log detection details for debugging
  console.log('Mobile detection:', {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    hasCoarsePointer,
    hasSmallScreen,
    mobileUA,
    finalDecision: isMobile
  });
  
  return isMobile;
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
        console.log('Desktop device detected, attempting signInWithPopup');
        try {
          const result = await signInWithPopup(auth, provider);
          console.log('Popup sign-in successful');
          return result;
        } catch (popupError) {
          console.error('Popup error details:', {
            code: popupError.code,
            message: popupError.message,
            name: popupError.name
          });
          
          // Don't fall back to redirect if user explicitly cancelled
          if (popupError.code === 'auth/popup-closed-by-user' || 
              popupError.code === 'auth/cancelled-popup-request') {
            console.log('User cancelled popup, not falling back to redirect');
            throw popupError;
          }
          
          // For any other error (popup blocked, invalid request, etc.), fall back to redirect
          console.log('Popup failed, falling back to redirect. Error code:', popupError.code);
          await signInWithRedirect(auth, provider);
          return; // Redirect doesn't return immediately
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
