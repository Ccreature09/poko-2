"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Timetable } from "@/lib/interfaces";
import { useAuth } from "@/components/AuthProvider";

type TimetableContextType = {
  timetable: Timetable | null;
  loading: boolean;
  error: string | null;
};

const TimetableContext = createContext<TimetableContextType>({
  timetable: null,
  loading: true,
  error: null,
});

export const useTimetableContext = () => useContext(TimetableContext);

export const TimetableProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const timetableDoc = await getDoc(doc(db, "timetables", user.userId));
        if (timetableDoc.exists()) {
          setTimetable(timetableDoc.data() as Timetable);
        }
      } catch {
        setError("Failed to fetch timetable");
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [user]);

  return (
    <TimetableContext.Provider value={{ timetable, loading, error }}>
      {children}
    </TimetableContext.Provider>
  );
};
