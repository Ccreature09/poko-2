"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import {
  fetchTimetablesByHomeroomClassId,
  getClassesTaughtByTeacher,
} from "@/lib/management/timetableManagement";
import type { Timetable, ClassSession } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Default periods as fallback
const defaultPeriods = [
  { period: 1, startTime: "07:30", endTime: "08:10" },
  { period: 2, startTime: "08:20", endTime: "09:00" },
  { period: 3, startTime: "09:10", endTime: "09:50" },
  { period: 4, startTime: "10:10", endTime: "10:50" },
  { period: 5, startTime: "11:00", endTime: "11:40" },
  { period: 6, startTime: "11:50", endTime: "12:30" },
  { period: 7, startTime: "12:40", endTime: "13:20" },
  { period: 8, startTime: "13:30", endTime: "14:10" },
];

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
    console.log("TimetableContext: Effect triggered with user:", user?.userId);

    const fetchTimetable = async () => {
      if (!user || !user.schoolId || !user.userId) {
        console.log("TimetableContext: No user data, exiting fetchTimetable");
        setLoading(false);
        return;
      }

      console.log("TimetableContext: Starting to fetch timetable data");
      console.log("TimetableContext: User info:", {
        userId: user.userId,
        schoolId: user.schoolId,
        role: user.role,
        homeroomClassId: user.homeroomClassId,
      });

      try {
        // Different timetable fetching logic based on user role
        if (user.role === "teacher") {
          console.log("TimetableContext: Fetching data for teacher");

          // First, try to fetch the teacher's consolidated timetable directly
          const teacherTimetablesRef = collection(
            db,
            "schools",
            user.schoolId,
            "teacherTimetables"
          );
          console.log(
            `TimetableContext: Collection path: schools/${user.schoolId}/teacherTimetables`
          );

          const q = query(
            teacherTimetablesRef,
            where("teacherId", "==", user.userId)
          );
          console.log(
            `TimetableContext: Query created with condition teacherId == ${user.userId}`
          );

          const querySnapshot = await getDocs(q);
          console.log(
            `TimetableContext: Query executed, got ${querySnapshot.size} documents`
          );

          if (!querySnapshot.empty) {
            // Teacher timetable found in the teacherTimetables collection
            const teacherTimetable =
              querySnapshot.docs[0].data() as ClassSession;
            console.log(
              "TimetableContext: Found teacher timetable directly:",
              teacherTimetable
            );
            setTimetable([teacherTimetable]);
            setLoading(false);
            return;
          } else {
            console.log(
              "TimetableContext: No teacher timetable found in teacherTimetables collection"
            );
          }

          // Fallback: For teachers - get timetable from all classes they teach
          const classesTaught = await getClassesTaughtByTeacher(
            user.schoolId,
            user.userId
          );
          console.log("Teacher classes taught:", classesTaught);

          // First, define a teacher timetable with default periods
          const teacherTimetable: ClassSession = {
            homeroomClassId: user.homeroomClassId || "",
            entries: [],
            periods: defaultPeriods, // Always start with default periods as fallback
          };

          if (classesTaught.length > 0) {
            // Set the entries from classes taught
            teacherTimetable.entries = classesTaught.map((cls) => ({
              day: cls.day,
              period: cls.period,
              classId: cls.classId,
              subjectId: cls.subjectId,
              teacherId: user.userId || "", // Ensure teacherId is always a string
              startTime: cls.startTime || "",
              endTime: cls.endTime || "",
              isFreePeriod: false,
            }));

            // Try to fetch actual period definitions from one of the classes they teach
            try {
              // First check if teacher has homeroom class and try to get periods from there
              if (user.homeroomClassId) {
                const homeroomTimetable =
                  await fetchTimetablesByHomeroomClassId(
                    user.schoolId,
                    user.homeroomClassId
                  );
                if (
                  homeroomTimetable.length > 0 &&
                  homeroomTimetable[0].data.periods &&
                  homeroomTimetable[0].data.periods.length > 0
                ) {
                  teacherTimetable.periods = homeroomTimetable[0].data.periods;
                  console.log(
                    "Using periods from teacher's homeroom class:",
                    teacherTimetable.periods
                  );
                }
              }

              // If no periods found from homeroom class, try from any class they teach
              if (
                !teacherTimetable.periods ||
                teacherTimetable.periods.length === 0
              ) {
                const firstClassTimetable =
                  await fetchTimetablesByHomeroomClassId(
                    user.schoolId,
                    classesTaught[0].classId
                  );
                if (
                  firstClassTimetable.length > 0 &&
                  firstClassTimetable[0].data.periods &&
                  firstClassTimetable[0].data.periods.length > 0
                ) {
                  teacherTimetable.periods =
                    firstClassTimetable[0].data.periods;
                  console.log(
                    "Using periods from taught class:",
                    teacherTimetable.periods
                  );
                }
              }
            } catch (err) {
              console.warn("Could not fetch period definitions:", err);
            }
          }

          console.log("Final teacher timetable:", teacherTimetable);
          setTimetable([teacherTimetable]);
        } else if (user.role === "student") {
          // For students: get timetable based on their homeroom class
          if (!user.homeroomClassId) {
            console.log("TimetableContext: Student has no homeroom class ID");
            setError("No class assigned to this student");
            setLoading(false);
            return;
          }

          console.log(
            `TimetableContext: Fetching timetable for student in homeroom class ${user.homeroomClassId}`
          );

          const fetchedTimetable = await fetchTimetablesByHomeroomClassId(
            user.schoolId,
            user.homeroomClassId
          );

          console.log("Fetched Student Timetable:", fetchedTimetable);

          if (fetchedTimetable.length === 0) {
            console.log(
              "TimetableContext: No timetable found for the student's class"
            );
            setError("No timetable found for your class");
            setLoading(false);
            return;
          }

          const mappedTimetable = fetchedTimetable.map((item) => item.data);

          // Ensure periods are set
          if (
            mappedTimetable.length > 0 &&
            (!mappedTimetable[0].periods ||
              mappedTimetable[0].periods.length === 0)
          ) {
            console.log(
              "TimetableContext: Setting default periods as none were found"
            );
            mappedTimetable[0].periods = defaultPeriods;
          }

          // Ensure entries exist
          if (
            mappedTimetable.length > 0 &&
            (!mappedTimetable[0].entries ||
              mappedTimetable[0].entries.length === 0)
          ) {
            console.log("TimetableContext: No entries found in the timetable");
            setError("No classes found in your timetable");
            setTimetable(mappedTimetable); // Still set the timetable even if empty
            setLoading(false);
            return;
          }

          console.log(
            `TimetableContext: Setting student timetable with ${mappedTimetable[0].entries.length} entries`
          );
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
