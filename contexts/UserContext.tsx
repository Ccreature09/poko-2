"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDocs, query, collection, where, collectionGroup } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Admin, Student, Teacher, UserBase } from "@/lib/interfaces";

type UserContextType = {
  user: (UserBase & { schoolId: string }) | null;
  loading: boolean;
  error: string | null;
};

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  error: null
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<(UserBase & { schoolId: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Use collectionGroup to query across all users subcollections in one call
          const usersQuery = query(
            collectionGroup(db, "users"),
            where("userId", "==", firebaseUser.uid)
          );
          
          const userSnapshot = await getDocs(usersQuery);
          
          if (!userSnapshot.empty) {
            // Get the first matching user document
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data() as Admin | Teacher | Student;
            
            // Extract schoolId from the path
            const schoolId = userDoc.ref.path.split('/')[1];
            
            setUser({
              ...userData,
              schoolId,
            } as UserBase & { schoolId: string });
            setError(null);
          } else {
            setError("User document not found");
            setUser(null);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Error fetching user data";
          console.error("Error fetching user data:", error);
          setError(errorMessage);
          setUser(null);
        }
      } else {
        setUser(null);
        setError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error }}>
      {children}
    </UserContext.Provider>
  );
};
