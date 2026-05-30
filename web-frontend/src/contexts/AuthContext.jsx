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
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Detect if user is on mobile device using capability checks (more reliable than UA)
function isMobileDevice() {
  // Guard for SSR/non-browser contexts
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
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
    const provider = new GoogleAuthProvider();
    
    // Force account selection and add custom parameters for better mobile experience
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const isMobile = isMobileDevice();
    
    try {
      // CRITICAL FIX: Set Firebase persistence to LOCAL before sign-in
      // This ensures auth state survives OAuth redirects on mobile browsers
      console.log('Setting Firebase persistence to LOCAL (survives redirects)');
      await setPersistence(auth, browserLocalPersistence);
      
      if (isMobile) {
        console.log('Mobile device detected, using signInWithRedirect');
        
        // Store a flag in localStorage to track that we initiated OAuth
        // This helps detect if we're returning from Google after redirect
        localStorage.setItem('_firebase_oauth_pending', 'true');
        localStorage.setItem('_firebase_oauth_timestamp', Date.now().toString());
        console.log('Stored OAuth pending flag in localStorage');
        
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
          
          // Store OAuth pending flag for redirect fallback too
          localStorage.setItem('_firebase_oauth_pending', 'true');
          localStorage.setItem('_firebase_oauth_timestamp', Date.now().toString());
          
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
    // If Firebase wasn't initialized (no env vars), skip auth setup entirely
    if (!auth) {
      setLoading(false);
      return;
    }

    let redirectCheckComplete = false;

    // ===== COMPREHENSIVE OAUTH REDIRECT DEBUGGING =====
    const timestamp = new Date().toISOString();
    console.log('=== AUTH CONTEXT INITIALIZATION ===', timestamp);
    
    // Log current URL and parameters
    console.log('Current URL:', window.location.href);
    console.log('URL search params:', window.location.search);
    console.log('URL hash:', window.location.hash);
    
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthParams = urlParams.has('state') || urlParams.has('code') || urlParams.has('error');
    console.log('OAuth params present:', hasOAuthParams, {
      state: urlParams.get('state'),
      code: urlParams.get('code') ? 'PRESENT' : null,
      error: urlParams.get('error')
    });
    
    // Check storage availability
    try {
      const testKey = '_firebase_test';
      sessionStorage.setItem(testKey, 'test');
      const canUseSessionStorage = sessionStorage.getItem(testKey) === 'test';
      sessionStorage.removeItem(testKey);
      console.log('Session storage available:', canUseSessionStorage);
      
      localStorage.setItem(testKey, 'test');
      const canUseLocalStorage = localStorage.getItem(testKey) === 'test';
      localStorage.removeItem(testKey);
      console.log('Local storage available:', canUseLocalStorage);
    } catch (e) {
      console.error('Storage check failed:', e);
    }
    
    // Log all storage keys (to see Firebase state)
    console.log('Session storage keys:', Object.keys(sessionStorage));
    console.log('Local storage keys:', Object.keys(localStorage));
    
    // Check if we're returning from an OAuth redirect
    const oauthPending = localStorage.getItem('_firebase_oauth_pending');
    const oauthTimestamp = localStorage.getItem('_firebase_oauth_timestamp');
    const isReturningFromOAuth = oauthPending === 'true';
    
    if (isReturningFromOAuth) {
      const timeSinceRedirect = Date.now() - parseInt(oauthTimestamp || '0');
      console.log('🔄 RETURNING FROM OAUTH REDIRECT!');
      console.log('Time since redirect:', timeSinceRedirect + 'ms');
    }
    
    console.log('Starting getRedirectResult check...');
    
    // Check for redirect result when app loads (mobile users returning from Google)
    getRedirectResult(auth)
      .then((result) => {
        redirectCheckComplete = true;
        console.log('=== getRedirectResult RESOLVED ===');
        console.log('Result object:', result);
        console.log('Result is null:', result === null);
        console.log('Result is undefined:', result === undefined);
        
        if (result) {
          console.log('✅ REDIRECT SUCCESS - User data:', {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName
          });
          
          // Clear OAuth pending flags
          localStorage.removeItem('_firebase_oauth_pending');
          localStorage.removeItem('_firebase_oauth_timestamp');
          console.log('Cleared OAuth pending flags');
          
          setCurrentUser(result.user);
          setAuthError(null);
        } else {
          console.log('⚠️ getRedirectResult returned NULL');
          
          if (isReturningFromOAuth) {
            console.log('📋 BUT we have OAuth pending flag - waiting for onAuthStateChanged...');
            console.log('Firebase should restore auth from localStorage persistence');
            // Don't clear the flag yet - wait for onAuthStateChanged to confirm
          } else {
            console.log('No OAuth pending (normal page load)');
          }
        }
      })
      .catch((error) => {
        redirectCheckComplete = true;
        console.error('=== getRedirectResult ERROR ===');
        console.error('Error object:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
        
        // Clear OAuth pending flags on error
        localStorage.removeItem('_firebase_oauth_pending');
        localStorage.removeItem('_firebase_oauth_timestamp');
        
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
      const authTimestamp = new Date().toISOString();
      console.log('=== onAuthStateChanged FIRED ===', authTimestamp);
      console.log('User object:', user);
      console.log('Is logged in:', !!user);
      
      if (user) {
        console.log('User details:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        });
        
        // Check if this is from an OAuth redirect
        const wasOAuthPending = localStorage.getItem('_firebase_oauth_pending') === 'true';
        if (wasOAuthPending) {
          console.log('✅ OAuth redirect completed successfully via localStorage persistence!');
          // Clear OAuth pending flags now that we have the user
          localStorage.removeItem('_firebase_oauth_pending');
          localStorage.removeItem('_firebase_oauth_timestamp');
          console.log('Cleared OAuth pending flags');
        }
      }
      
      console.log('redirectCheckComplete:', redirectCheckComplete);
      
      setCurrentUser(user);
      
      // Only set loading to false after both redirect check and auth state are ready
      if (redirectCheckComplete || !isMobileDevice()) {
        console.log('Setting loading to false');
        setLoading(false);
      } else {
        console.log('Still loading, waiting for redirect check...');
      }
    });

    // Fallback: ensure loading state clears after reasonable timeout
    // Increased from 3s to 8s for mobile OAuth redirects which can be slower
    const timeout = setTimeout(() => {
      console.log('⏱️ 8-second timeout reached, forcing loading to false');
      
      // If OAuth was pending but we still don't have a user, clear the flags
      if (localStorage.getItem('_firebase_oauth_pending') === 'true') {
        console.log('⚠️ OAuth pending flag still set after timeout - clearing');
        localStorage.removeItem('_firebase_oauth_pending');
        localStorage.removeItem('_firebase_oauth_timestamp');
      }
      
      setLoading(false);
    }, 8000);

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
