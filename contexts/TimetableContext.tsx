"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { fetchTimetablesByHomeroomClassId } from "@/lib/timetableManagement";
import type { Timetable, ClassSession } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";

type TimetableContextType = {
  timetable: ClassSession[] | null;
  loading: boolean;
  error: string | null;
};

const TimetableContext = createContext<TimetableContextType>({
  timetable: null,
  loading: true,
  error: null,
});

export const useTimetable = () => useContext(TimetableContext);

export const TimetableProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [timetable, setTimetable] = useState<ClassSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!user || !user.homeroomClassId) {
        setLoading(false);
        return;
      }

      try {
        const fetchedTimetable = await fetchTimetablesByHomeroomClassId(user.schoolId, user.homeroomClassId);
        console.log("Fetched Timetable:", fetchedTimetable);
        const mappedTimetable = fetchedTimetable.map(item => item.data);
        setTimetable(mappedTimetable);
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
