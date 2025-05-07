"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthContextType = {
  authUser: FirebaseUser | null;
  authLoading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<FirebaseUser | null>;
  signUp: (email: string, password: string) => Promise<FirebaseUser | null>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  authLoading: true,
  authError: null,
  signIn: async () => null,
  signUp: async () => null,
  logOut: async () => {},
  resetPassword: async () => {},
  clearAuthError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setAuthUser(user);
        setAuthLoading(false);
      },
      (error) => {
        console.error("Auth state change error:", error);
        setAuthError(error.message);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<FirebaseUser | null> => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      return userCredential.user;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Sign in failed";
      console.error("Sign in error:", error);
      setAuthError(errorMessage);
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (
    email: string,
    password: string
  ): Promise<FirebaseUser | null> => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      return userCredential.user;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Sign up failed";
      console.error("Sign up error:", error);
      setAuthError(errorMessage);
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign out
  const logOut = async (): Promise<void> => {
    try {
      setAuthLoading(true);
      await signOut(auth);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Sign out failed";
      console.error("Sign out error:", error);
      setAuthError(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string): Promise<void> => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Password reset failed";
      console.error("Password reset error:", error);
      setAuthError(errorMessage);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  // Clear auth errors
  const clearAuthError = (): void => {
    setAuthError(null);
  };

  const value = {
    authUser,
    authLoading,
    authError,
    signIn,
    signUp,
    logOut,
    resetPassword,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
