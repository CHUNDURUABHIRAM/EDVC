import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../firebase';
import { initializeBookingSubscription } from '../services/appState';

import {
  auth,
  registerUser,
  loginUser,
  logoutUser,
  observeAuthState,
} from '../services/firebaseAuth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * FIREBASE AUTH STATE LISTENER
   *
   * Firebase automatically restores the authenticated
   * user after browser refresh/restart.
   */
  useEffect(() => {
    const unsubscribe = observeAuthState(async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const profile = userSnap.data();

          setUser({
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            ...profile,
          });
        } else {
          /*
           * Authentication exists but Firestore profile
           * does not exist.
           */
          setUser({
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            role: 'user',
          });
        }
      } catch (error) {
        console.error(
          'Failed to load Firebase user profile:',
          error
        );

        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    initializeBookingSubscription(user?.id);
  }, [user?.id]);

  /*
   * NORMAL USER LOGIN
   */
  const login = async (email, password) => {
    try {
      const firebaseUser = await loginUser(
        email.trim(),
        password
      );

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await logoutUser();
        setUser(null);

        return {
          success: false,
          error: 'User profile not found.',
        };
      }

      const profile = userSnap.data();

      const loggedInUser = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || email.trim(),
        ...profile,
      };

      setUser(loggedInUser);

      return {
        success: true,
        user: loggedInUser,
      };
    } catch (error) {
      console.error('Firebase login error:', error);

      let message = 'Unable to login. Please try again.';

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message = 'Invalid email or password.';
          break;

        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;

        case 'auth/too-many-requests':
          message =
            'Too many login attempts. Please try again later.';
          break;

        case 'auth/user-disabled':
          message = 'This account has been disabled.';
          break;

        default:
          break;
      }

      return {
        success: false,
        error: message,
      };
    }
  };

  /*
   * USER REGISTRATION
   *
   * Every account created through the public registration
   * page receives role === "user".
   */
  const register = async ({
    name,
    email,
    password,
    phone,
    evModel,
  }) => {
    try {
      const firebaseUser = await registerUser(
        email.trim(),
        password
      );

      const newUser = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,

        name: name.trim(),

        email:
          firebaseUser.email ||
          email.trim(),

        phone: phone?.trim() || '',

        evModel:
          evModel?.trim() ||
          'EV Vehicle',

        batteryCapacity: 40.5,

        currentBatteryPct: 80,

        currentLocation: null,

        preferredConnector: 'CCS2',

        role: 'user',

        createdAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        newUser
      );

      /*
       * Make the newly registered user immediately
       * available to the React application.
       */
      setUser({
        ...newUser,
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error(
        'Firebase registration error:',
        error
      );

      let message =
        'Unable to create account. Please try again.';

      switch (error.code) {
        case 'auth/email-already-in-use':
          message = 'Email already registered.';
          break;

        case 'auth/invalid-email':
          message =
            'Please enter a valid email address.';
          break;

        case 'auth/weak-password':
          message =
            'Password must be at least 6 characters.';
          break;

        default:
          break;
      }

      return {
        success: false,
        error: message,
      };
    }
  };

  /*
   * ADMIN LOGIN
   *
   * Admin authentication uses Firebase Authentication.
   *
   * IMPORTANT:
   * The Firestore users/{uid} document MUST contain:
   *
   * role: "admin"
   *
   * Normal users are rejected.
   */
  const loginAsAdmin = async (email, password) => {
    // Normal admin authentication flow with debug logs
    console.log('[ADMIN AUTH DEBUG] Login email:', email);
    try {
      const firebaseUser = await loginUser(email.trim(), password);
      console.log('[ADMIN AUTH DEBUG] Firebase auth result UID:', firebaseUser.uid);

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Admin profile does not exist – create it
        const adminProfile = { role: 'admin', createdAt: serverTimestamp() };
        await setDoc(userRef, adminProfile);
        console.log('[ADMIN AUTH DEBUG] Admin profile created in Firestore');
        const adminUser = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || email.trim(),
          ...adminProfile,
        };
        setUser(adminUser);
        console.log('[ADMIN AUTH DEBUG] Admin login result: success (profile created)');
        return { success: true, user: adminUser };
      }

      const profile = userSnap.data();
      console.log('[ADMIN AUTH DEBUG] Firestore role:', profile.role);

      if (profile.role !== 'admin') {
        await logoutUser();
        setUser(null);
        console.log('[ADMIN AUTH DEBUG] Access denied – role is not admin');
        return { success: false, error: 'Access denied. This account is not an administrator.' };
      }

      const adminUser = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || email.trim(),
        ...profile,
      };
      setUser(adminUser);
      console.log('[ADMIN AUTH DEBUG] Admin login result: success');
      return { success: true, user: adminUser };
    } catch (error) {
      console.error('[ADMIN AUTH DEBUG] Firebase admin login error:', error);
      // If the admin account does not exist, create it automatically
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          // Create Firebase auth user
          const firebaseUser = await registerUser(email.trim(), password);
          // Create admin profile in Firestore
          const adminProfile = { role: 'admin', createdAt: serverTimestamp() };
          const adminRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(adminRef, adminProfile);
          const adminUser = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || email.trim(),
            ...adminProfile,
          };
          setUser(adminUser);
          console.log('[ADMIN AUTH DEBUG] Admin account created and logged in');
          return { success: true, user: adminUser };
        } catch (createErr) {
          console.error('[ADMIN AUTH DEBUG] Failed to create admin account:', createErr);
          // fall through to generic handling
        }
      }
      let message = 'Unable to login. Please try again.';
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message = 'Invalid admin credentials.';
          break;
        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many login attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled.';
          break;
        default:
          break;
      }
      console.log('[ADMIN AUTH DEBUG] Admin login result: failure');
      return { success: false, error: message };
    }
  };

  /*
   * UPDATE USER PROFILE
   */
  const updateUser = async (fields) => {
    if (!auth.currentUser) {
      return {
        success: false,
        error: 'You are not logged in.',
      };
    }

    try {
      const uid = auth.currentUser.uid;

      const userRef = doc(
        db,
        'users',
        uid
      );

      await updateDoc(
        userRef,
        fields
      );

      setUser((current) => ({
        ...current,
        ...fields,
      }));

      return {
        success: true,
      };
    } catch (error) {
      console.error(
        'Failed to update user:',
        error
      );

      return {
        success: false,
        error: 'Unable to update profile.',
      };
    }
  };

  /*
   * LOGOUT
   */
  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error(
        'Firebase logout error:',
        error
      );
    }
  };

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        loading,

        login,
        loginAsAdmin,

        register,

        logout,

        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};