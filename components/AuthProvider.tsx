"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDocs, query, collection, where } from "firebase/firestore";
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
          // Fetch user data from Firestore
          const schoolsSnapshot = await getDocs(collection(db, "schools"));
          let userData: Admin | Teacher | Student | null = null;
          let schoolId: string | null = null;

          for (const schoolDoc of schoolsSnapshot.docs) {
            const usersCollection = collection(
              db,
              "schools",
              schoolDoc.id,
              "users"
            );
            const userSnapshot = await getDocs(
              query(usersCollection, where("userId", "==", firebaseUser.uid))
            );

            if (!userSnapshot.empty) {
              userData = userSnapshot.docs[0].data() as
                | Admin
                | Teacher
                | Student;
              schoolId = schoolDoc.id;
              break;
            }
          }

          if (userData && schoolId) {
            setUser({
              ...userData,
              schoolId,
            } as UserBase & { schoolId: string });
          } else {
            console.error("User document not found");
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
