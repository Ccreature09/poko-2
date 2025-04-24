"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { fetchTimetablesByHomeroomClassId, getClassesTaughtByTeacher } from "@/lib/timetableManagement";
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
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Different timetable fetching logic based on user role
        if (user.role === 'teacher') {
          // For teachers: get timetable from all classes they teach
          const classesTaught = await getClassesTaughtByTeacher(user.schoolId, user.userId);
          console.log("Teacher classes taught:", classesTaught);
          
          if (classesTaught.length > 0) {
            // Group classes by day and period to create a teacher-specific timetable
            const teacherTimetable: ClassSession = {
              homeroomClassId: user.homeroomClassId || "",
              entries: classesTaught.map(cls => ({
                day: cls.day,
                period: cls.period,
                classId: cls.classId,
                subjectId: cls.subjectId,
                teacherId: user.userId,
                startTime: cls.startTime,
                endTime: cls.endTime
              })),
              // Use period times from the first class taught (assuming consistent across school)
              // This will be overridden if better data is available
              periods: []
            };
            
            // Try to fetch actual period definitions from one of the classes they teach
            try {
              const firstClassTimetable = await fetchTimetablesByHomeroomClassId(user.schoolId, classesTaught[0].classId);
              if (firstClassTimetable.length > 0 && firstClassTimetable[0].data.periods) {
                teacherTimetable.periods = firstClassTimetable[0].data.periods;
              }
            } catch (err) {
              console.warn("Could not fetch period definitions:", err);
            }
            
            setTimetable([teacherTimetable]);
          } else {
            setTimetable([]);
          }
        } else {
          // For students: get timetable based on their homeroom class
          if (!user.homeroomClassId) {
            setLoading(false);
            return;
          }
          
          const fetchedTimetable = await fetchTimetablesByHomeroomClassId(user.schoolId, user.homeroomClassId);
          console.log("Fetched Student Timetable:", fetchedTimetable);
          const mappedTimetable = fetchedTimetable.map(item => item.data);
          setTimetable(mappedTimetable);
        }
      } catch (err) {
        console.error("Failed to fetch timetable:", err);
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
