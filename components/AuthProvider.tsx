"use client";

import type React from "react";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Admin, Student, Teacher, UserBase } from "@/lib/interfaces";

type AuthContextType = {
  user: (UserBase & { schoolId: string }) | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<(UserBase & { schoolId: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const schoolsSnapshot = await getDocs(collection(db, "schools"));
          let userData:
            | ((Admin | Teacher | Student) & { schoolId: string })
            | null = null;

          for (const schoolDoc of schoolsSnapshot.docs) {
            if (schoolDoc.exists()) {
              const userDoc = await getDoc(
                doc(schoolDoc.ref, "users", firebaseUser.uid)
              );
              if (userDoc.exists()) {
                userData = {
                  ...(userDoc.data() as Admin | Teacher | Student),
                  schoolId: schoolDoc.id,
                };
                break;
              }
            }
          }

          if (userData) {
            setUser(userData);
          } else {
            console.error("User data not found in any school");
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
