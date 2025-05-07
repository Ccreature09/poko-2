"use client";

// Context for managing user profile data
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import {
  getDocs,
  query,
  collection,
  where,
  collectionGroup,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Admin, Student, Teacher, UserBase } from "@/lib/interfaces";
import { useAuth } from "./AuthContext";

// Define the type for user context data
type UserContextType = {
  user: (UserBase & { schoolId: string }) | null; // User information including school ID
  loading: boolean; // Flag indicating if data is loading
  error: string | null; // Error message if any
  refreshUserData: () => Promise<void>; // Function to manually refresh user data
};

// Create context with initial values
const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  error: null,
  refreshUserData: async () => {},
});

// Export the UserContext
export { UserContext };

// Hook for easy access to user context from components
export const useUser = () => useContext(UserContext);

// Provider component that wraps the application and provides user data
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  // State for storing user information
  const [user, setUser] = useState<(UserBase & { schoolId: string }) | null>(
    null
  );
  // State showing if data is currently loading
  const [loading, setLoading] = useState(true);
  // State for storing authentication or data loading errors
  const [error, setError] = useState<string | null>(null);

  // Use the AuthContext to get authentication state
  const { authUser, authLoading } = useAuth();

  // Function to fetch user data from Firestore
  const fetchUserData = async () => {
    if (!authUser) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Using collectionGroup to query across all "users" subcollections at once
      // This allows searching for a user across all schools simultaneously
      const usersQuery = query(
        collectionGroup(db, "users"),
        where("userId", "==", authUser.uid)
      );

      // Execute database query
      const userSnapshot = await getDocs(usersQuery);

      if (!userSnapshot.empty) {
        // Get the first matching user document
        const userDoc = userSnapshot.docs[0];
        // Extract data from the document and type it according to the interface
        const userData = userDoc.data() as Admin | Teacher | Student;

        // Extract schoolId from the document path
        // Format is: schools/{schoolId}/users/{userId}
        const schoolId = userDoc.ref.path.split("/")[1];

        // Update user state with data and schoolId
        setUser({
          ...userData,
          schoolId,
        } as UserBase & { schoolId: string });
        setError(null);
      } else {
        // If no document is found for the user, set an error
        setError("User document not found");
        setUser(null);
      }
    } catch (error) {
      // Error handling when fetching user data
      const errorMessage =
        error instanceof Error ? error.message : "Error fetching user data";
      console.error("Error fetching user data:", error);
      setError(errorMessage);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Expose a function to allow manual refreshing of user data
  const refreshUserData = async () => {
    await fetchUserData();
  };

  // Effect to fetch user data when authentication state changes
  useEffect(() => {
    if (!authLoading) {
      fetchUserData();
    }
  }, [authUser, authLoading]);

  return (
    <UserContext.Provider value={{ user, loading, error, refreshUserData }}>
      {children}
    </UserContext.Provider>
  );
};
