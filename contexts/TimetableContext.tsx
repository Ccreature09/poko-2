"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  fetchTimetablesByHomeroomClassId,
  getClassesTaughtByTeacher,
} from "@/lib/management/timetableManagement";
import type { Timetable, ClassSession } from "@/lib/interfaces";
import { useUser } from "@/contexts/UserContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from "firebase/firestore";
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
  refreshTimetable: () => void;
};

const TimetableContext = createContext<TimetableContextType>({
  timetable: null,
  loading: true,
  error: null,
  refreshTimetable: () => {},
});

export const useTimetable = () => useContext(TimetableContext);

export const TimetableProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [timetable, setTimetable] = useState<ClassSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Reference to store unsubscribe functions
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Function to manually refresh timetable data
  const refreshTimetable = useCallback(() => {
    setRefreshToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    console.log("TimetableContext: Effect triggered with user:", user?.userId);

    // Clean up any existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!user || !user.schoolId || !user.userId) {
      console.log("TimetableContext: No user data, exiting");
      setLoading(false);
      return;
    }

    // At this point, we've checked that user, user.schoolId, and user.userId are not null/undefined
    // TypeScript should now recognize these as non-null within this scope
    const schoolId = user.schoolId;
    const userId = user.userId;
    const userRole = user.role;
    const homeroomClassId = user.homeroomClassId || "";

    setLoading(true);
    setError(null);

    console.log("TimetableContext: Starting to fetch timetable data");
    console.log("TimetableContext: User info:", {
      userId,
      schoolId,
      role: userRole,
      homeroomClassId,
    });

    // Different handling based on user role
    if (userRole === "teacher") {
      setupTeacherTimetableListener(schoolId, userId, homeroomClassId);
    } else if (userRole === "student" && homeroomClassId) {
      setupStudentTimetableListener(schoolId, userId, homeroomClassId);
    } else {
      setLoading(false);
      setError("Invalid user role or missing required data");
    }

    // Set up real-time listener for teacher timetable
    async function setupTeacherTimetableListener(
      schoolId: string,
      teacherId: string,
      homeroomClassId: string
    ) {
      try {
        // First, try to get the consolidated teacher timetable
        const teacherTimetablesRef = collection(
          db,
          "schools",
          schoolId,
          "teacherTimetables"
        );

        const q = query(
          teacherTimetablesRef,
          where("teacherId", "==", teacherId)
        );

        // Check if the teacher has a consolidated timetable document
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Set up listener on the consolidated teacher timetable
          const teacherTimetableDoc = querySnapshot.docs[0].ref;

          const unsubscribe = onSnapshot(
            teacherTimetableDoc,
            (snapshot) => {
              if (snapshot.exists()) {
                const teacherTimetable = snapshot.data() as ClassSession;
                console.log(
                  "TimetableContext: Real-time update for teacher timetable",
                  teacherTimetable
                );
                setTimetable([teacherTimetable]);
                setError(null);
              } else {
                console.log("Teacher timetable document no longer exists");
                fallbackToClassBasedTimetable(
                  schoolId,
                  teacherId,
                  homeroomClassId
                );
              }
              setLoading(false);
            },
            (err) => {
              console.error("Error in teacher timetable listener:", err);
              fallbackToClassBasedTimetable(
                schoolId,
                teacherId,
                homeroomClassId
              );
            }
          );

          unsubscribeRef.current = unsubscribe;
        } else {
          // No consolidated timetable found, fall back to class-based approach
          fallbackToClassBasedTimetable(schoolId, teacherId, homeroomClassId);
        }
      } catch (err) {
        console.error("Error setting up teacher timetable listener:", err);
        fallbackToClassBasedTimetable(schoolId, teacherId, homeroomClassId);
      }
    }

    // Fallback method to construct teacher timetable from classes taught
    async function fallbackToClassBasedTimetable(
      schoolId: string,
      teacherId: string,
      homeroomClassId: string
    ) {
      try {
        // For teachers - get timetable from all classes they teach
        const classesTaught = await getClassesTaughtByTeacher(
          schoolId,
          teacherId
        );

        // Construct teacher timetable
        const teacherTimetable: ClassSession = {
          homeroomClassId,
          entries: [],
          periods: defaultPeriods,
        };

        if (classesTaught.length > 0) {
          // Set entries from classes taught
          teacherTimetable.entries = classesTaught.map((cls) => ({
            day: cls.day,
            period: cls.period,
            classId: cls.classId,
            subjectId: cls.subjectId,
            teacherId,
            startTime: cls.startTime || "",
            endTime: cls.endTime || "",
            isFreePeriod: false,
          }));

          // Try to get period definitions from homeroom class or classes taught
          await fetchPeriodDefinitions(
            schoolId,
            teacherTimetable,
            classesTaught,
            homeroomClassId
          );
        }

        console.log("TimetableContext: Using fallback teacher timetable");
        setTimetable([teacherTimetable]);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch fallback teacher timetable:", err);
        setError("Failed to fetch timetable");
        setLoading(false);
      }
    }

    // Get period definitions from class timetables
    async function fetchPeriodDefinitions(
      schoolId: string,
      teacherTimetable: ClassSession,
      classesTaught: any[],
      homeroomClassId: string
    ) {
      try {
        // First check homeroom class
        if (homeroomClassId) {
          const homeroomTimetable = await fetchTimetablesByHomeroomClassId(
            schoolId,
            homeroomClassId
          );
          if (
            homeroomTimetable.length > 0 &&
            homeroomTimetable[0].data.periods &&
            homeroomTimetable[0].data.periods.length > 0
          ) {
            teacherTimetable.periods = homeroomTimetable[0].data.periods;
            return;
          }
        }

        // If no periods found from homeroom, check taught classes
        if (classesTaught.length > 0) {
          const firstClassTimetable = await fetchTimetablesByHomeroomClassId(
            schoolId,
            classesTaught[0].classId
          );
          if (
            firstClassTimetable.length > 0 &&
            firstClassTimetable[0].data.periods &&
            firstClassTimetable[0].data.periods.length > 0
          ) {
            teacherTimetable.periods = firstClassTimetable[0].data.periods;
          }
        }
      } catch (err) {
        console.warn("Could not fetch period definitions:", err);
        // Keep using default periods as fallback
      }
    }

    // Set up real-time listener for student timetable
    function setupStudentTimetableListener(
      schoolId: string,
      studentId: string,
      classId: string
    ) {
      try {
        if (!classId) {
          setError("No class assigned to this student");
          setLoading(false);
          return;
        }

        // Reference to the timetable document for the student's class
        const timetableRef = doc(
          db,
          "schools",
          schoolId,
          "timetables",
          classId
        );

        const unsubscribe = onSnapshot(
          timetableRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const classTimetable = {
                ...snapshot.data(),
                homeroomClassId: classId,
              } as ClassSession;

              // Ensure periods exist
              if (
                !classTimetable.periods ||
                classTimetable.periods.length === 0
              ) {
                classTimetable.periods = defaultPeriods;
              }

              // Ensure entries array exists
              if (!classTimetable.entries) {
                classTimetable.entries = [];
              }

              console.log(
                "TimetableContext: Real-time update for student timetable",
                classTimetable
              );

              setTimetable([classTimetable]);
              setError(null);
            } else {
              // Timetable document doesn't exist - fall back to manual fetch
              const fetchedTimetable = await fetchTimetablesByHomeroomClassId(
                schoolId,
                classId
              );

              if (fetchedTimetable.length === 0) {
                setError("No timetable found for your class");
                setTimetable(null);
              } else {
                const mappedTimetable = fetchedTimetable.map((item) => {
                  // Ensure periods exist
                  if (!item.data.periods || item.data.periods.length === 0) {
                    item.data.periods = defaultPeriods;
                  }
                  return item.data;
                });

                setTimetable(mappedTimetable);
                setError(null);
              }
            }
            setLoading(false);
          },
          (err) => {
            console.error("Error in student timetable listener:", err);
            setError("Failed to listen for timetable updates");
            setLoading(false);
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (err) {
        console.error("Failed to set up student timetable listener:", err);
        setError("Failed to fetch timetable");
        setLoading(false);
      }
    }

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        console.log("TimetableContext: Cleaning up listener");
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, refreshToken]);

  return (
    <TimetableContext.Provider
      value={{ timetable, loading, error, refreshTimetable }}
    >
      {children}
    </TimetableContext.Provider>
  );
};
