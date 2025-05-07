"use client";

import { useUser } from "@/contexts/UserContext";
import { useTimetable } from "@/contexts/TimetableContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ClassSession } from "@/lib/interfaces";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import Sidebar from "@/components/functional/Sidebar";
import Link from "next/link";
import {
  Calendar,
  Clock,
  BookOpen,
  CalendarRange,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Users,
} from "lucide-react";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
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

// Function to get day name in Bulgarian
const getBulgarianDayName = (day: string): string => {
  const dayMap: { [key: string]: string } = {
    Monday: "Понеделник",
    Tuesday: "Вторник",
    Wednesday: "Сряда",
    Thursday: "Четвъртък",
    Friday: "Петък",
  };
  return dayMap[day] || day;
};

// Function to get dates for the current week (Monday-Friday)
const getCurrentWeekDates = (): { [key: string]: Date } => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate the Monday date of this week
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  // Create a map of days to dates
  const weekDates: { [key: string]: Date } = {};
  days.forEach((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    weekDates[day] = date;
  });

  return weekDates;
};

// Get a color for a subject (consistent color for the same subject)
const getSubjectColor = (subjectName: string): string => {
  // Simple hash function to generate a color based on the subject name
  const hash = Array.from(subjectName).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  );
  const colors = [
    "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 hover:text-blue-900",
    "bg-green-100 text-green-800 border-green-200 hover:bg-green-200 hover:text-green-900",
    "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200 hover:text-purple-900",
    "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 hover:text-amber-900",
    "bg-pink-100 text-pink-800 border-pink-200 hover:bg-pink-200 hover:text-pink-900",
    "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200 hover:text-cyan-900",
    "bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200 hover:text-indigo-900",
    "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 hover:text-orange-900",
  ];
  return colors[hash % colors.length];
};

export default function TeacherTimetable() {
  const { user } = useUser();
  const { timetable, loading, error } = useTimetable();
  const [subjects, setSubjects] = useState<{ [key: string]: string }>({});
  const [classes, setClasses] = useState<{ [key: string]: string }>({});
  const [activeDay, setActiveDay] = useState(days[0]);
  const [periods, setPeriods] = useState(defaultPeriods);
  const [highlightCurrentPeriod, setHighlightCurrentPeriod] =
    useState<boolean>(true);
  const [currentDay, setCurrentDay] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<number | null>(null);
  const [showCompletedClasses, setShowCompletedClasses] =
    useState<boolean>(false);
  const [allClassSessions, setAllClassSessions] = useState<ClassSession[]>([]);

  // Helper function to get a date object for a specific day of the week
  const getDateForDay = (dayName: string): Date => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDay = days.indexOf(dayName) + 1; // +1 because our days array is 0-based but starts with Monday

    // Calculate the difference between the current day and the target day
    let diff = targetDay - currentDay;

    // If the target day is earlier in the week, go to previous week
    if (diff < 0) {
      // We want the most recent occurrence (this week)
      // Do nothing, diff is already negative and will give us the correct date
    } else if (diff === 0) {
      // Same day, use today
      diff = 0;
    } else {
      // Day is later in the week, use next occurrence
      // diff is already positive
    }

    // Create a new date for the target day
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    return targetDate;
  };

  // Get periods from the timetable if available
  useEffect(() => {
    if (timetable && timetable.length > 0 && timetable[0].periods) {
      setPeriods(timetable[0].periods);
    }
  }, [timetable]);

  // Find current period based on time
  useEffect(() => {
    const updateCurrentPeriod = () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      // Only update on weekdays
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        setCurrentDay(days[dayOfWeek - 1]);

        // Get current time in hours and minutes
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTimeInMinutes = hours * 60 + minutes;

        // Check if current time falls within any period
        let foundPeriod: number | null = null;
        for (const { period, startTime, endTime } of periods) {
          const [startHour, startMinute] = startTime.split(":").map(Number);
          const [endHour, endMinute] = endTime.split(":").map(Number);

          const periodStartInMinutes = startHour * 60 + startMinute;
          const periodEndInMinutes = endHour * 60 + endMinute;

          if (
            currentTimeInMinutes >= periodStartInMinutes &&
            currentTimeInMinutes <= periodEndInMinutes
          ) {
            foundPeriod = period;
            break;
          }
        }
        setCurrentPeriod(foundPeriod);
      } else {
        setCurrentDay("");
        setCurrentPeriod(null);
      }
    };

    // Update immediately and then every minute
    updateCurrentPeriod();
    const intervalId = setInterval(updateCurrentPeriod, 60000);

    return () => clearInterval(intervalId);
  }, [periods]);

  // Fetch additional data for teacher timetable
  useEffect(() => {
    if (user?.schoolId && user?.userId && user.role === "teacher") {
      console.log("TeacherTimetable: Starting fetchTeacherTimetable effect");

      // Function to directly fetch teacher timetable from teacherTimetables collection
      const fetchTeacherTimetable = async () => {
        try {
          console.log(
            "TeacherTimetable: Fetching teacher timetable directly from teacherTimetables collection"
          );

          // Define the reference to the teacherTimetables collection
          const teacherTimetablesRef = collection(
            db,
            `schools/${user.schoolId}/teacherTimetables`
          );

          // Create a query to find timetables for this specific teacher
          const q = query(
            teacherTimetablesRef,
            where("teacherId", "==", user.userId)
          );

          console.log(
            `TeacherTimetable: Querying teacherTimetables with teacherId=${user.userId}`
          );
          const querySnapshot = await getDocs(q);

          console.log(
            `TeacherTimetable: Found ${querySnapshot.size} teacher timetable documents`
          );

          if (!querySnapshot.empty) {
            // We found the teacher's timetable directly in the teacherTimetables collection
            const teacherTimetableDoc = querySnapshot.docs[0];
            const teacherTimetableData =
              teacherTimetableDoc.data() as ClassSession;

            console.log(
              "TeacherTimetable: Raw document data:",
              teacherTimetableData
            );

            // Handle day name translation: Convert Bulgarian day names to English day names if needed
            if (
              teacherTimetableData.entries &&
              teacherTimetableData.entries.length > 0
            ) {
              const bgToEnDayMap = {
                Понеделник: "Monday",
                Вторник: "Tuesday",
                Сряда: "Wednesday",
                Четвъртък: "Thursday",
                Петък: "Friday",
                Събота: "Saturday",
                Неделя: "Sunday",
              };

              // Map Bulgarian day names to English day names for compatibility
              teacherTimetableData.entries = teacherTimetableData.entries.map(
                (entry) => {
                  if (bgToEnDayMap[entry.day]) {
                    return {
                      ...entry,
                      day: bgToEnDayMap[entry.day],
                    };
                  }
                  return entry;
                }
              );

              console.log(
                "TeacherTimetable: Processed entries with day name mapping:",
                teacherTimetableData.entries
              );
            } else {
              console.log(
                "TeacherTimetable: No entries in the document or entries is not an array"
              );
            }

            // Use the teacher timetable
            setAllClassSessions([teacherTimetableData]);

            // If the teacher timetable has periods defined, use them
            if (
              teacherTimetableData.periods &&
              teacherTimetableData.periods.length > 0
            ) {
              console.log(
                "TeacherTimetable: Using periods from teacher timetable:",
                teacherTimetableData.periods
              );
              setPeriods(teacherTimetableData.periods);
            }
          } else {
            console.log(
              "TeacherTimetable: No teacher timetable found in teacherTimetables collection"
            );

            // Create a default empty timetable
            const defaultTimetable: ClassSession = {
              teacherId: user.userId,
              entries: [],
              periods: defaultPeriods,
              homeroomClassId: "",
            };

            setAllClassSessions([defaultTimetable]);
          }
        } catch (error) {
          console.error(
            "TeacherTimetable: Error fetching teacher timetable:",
            error
          );
        }
      };

      // Fetch the teacher timetable
      fetchTeacherTimetable();

      // Also fetch subjects and classes for better display
      const fetchSubjects = async () => {
        try {
          const subjectsCollection = collection(
            db,
            `schools/${user.schoolId}/subjects`
          );
          const subjectsSnapshot = await getDocs(subjectsCollection);
          const subjectMap: { [key: string]: string } = {};

          subjectsSnapshot.forEach((doc) => {
            const subjectData = doc.data();
            // Check for different possible field names for the subject name
            subjectMap[doc.id] =
              subjectData.name || subjectData.subjectName || doc.id;
          });

          console.log("TeacherTimetable: Fetched subjects:", subjectMap);
          setSubjects(subjectMap);
        } catch (error) {
          console.error("Failed to fetch subjects from Firestore:", error);
        }
      };

      const fetchClasses = async () => {
        try {
          const classesCollection = collection(
            db,
            `schools/${user.schoolId}/classes`
          );
          const classesSnapshot = await getDocs(classesCollection);
          const classMap: { [key: string]: string } = {};

          classesSnapshot.forEach((doc) => {
            const classData = doc.data();
            classMap[doc.id] = classData.className || doc.id;
          });

          setClasses(classMap);
        } catch (error) {
          console.error("Failed to fetch classes from Firestore:", error);
        }
      };

      fetchSubjects();
      fetchClasses();
    }
  }, [user]);

  // Get details for period - this function determines what shows in each timetable cell
  const getDetailsForPeriod = (
    day: string,
    period: number
  ): {
    subject: string;
    classId: string;
    subjectId: string;
    className?: string;
  }[] => {
    // Use the timetable from TimetableContext, which should contain the teacher's timetable directly
    // Only use allClassSessions as a fallback
    const timetablesToUse = timetable || allClassSessions;

    console.log(`getDetailsForPeriod: Called for day=${day}, period=${period}`);

    if (!timetablesToUse || timetablesToUse.length === 0) {
      console.log(`getDetailsForPeriod: No timetable data available`);
      return [{ subject: "-", classId: "", subjectId: "" }];
    }

    // Define the day name mappings (both directions)
    const bgToEnDayMap = {
      Понеделник: "Monday",
      Вторник: "Tuesday",
      Сряда: "Wednesday",
      Четвъртък: "Thursday",
      Петък: "Friday",
      Събота: "Saturday",
      Неделя: "Sunday",
    };

    // Find sessions where the teacher teaches on the given day and period
    const sessions = timetablesToUse.filter((session: ClassSession) => {
      if (!session.entries || !Array.isArray(session.entries)) {
        return false;
      }

      // Check each entry for the specific day and period
      const entriesForThisDay = session.entries.filter((entry) => {
        // The entry day might be in Bulgarian or English, so we need to handle both
        let entryDayInEnglish = entry.day;

        // If entry day is in Bulgarian, convert to English
        if (bgToEnDayMap[entry.day]) {
          entryDayInEnglish = bgToEnDayMap[entry.day];
        }

        // If day is in Bulgarian, convert to English for comparison
        let dayInEnglish = day;
        if (bgToEnDayMap[day]) {
          dayInEnglish = bgToEnDayMap[day];
        }

        const matchesDay = entryDayInEnglish === dayInEnglish;
        const matchesPeriod = entry.period === period;
        const matchesTeacher =
          entry.teacherId === user?.userId ||
          session.teacherId === user?.userId;

        if (matchesDay && matchesPeriod) {
          console.log("getDetailsForPeriod: Found matching entry:", entry);
        }

        return matchesDay && matchesPeriod && matchesTeacher;
      });

      return entriesForThisDay.length > 0;
    });

    console.log(
      `getDetailsForPeriod: Found ${sessions.length} matching sessions`
    );

    if (sessions.length > 0) {
      const details = sessions.flatMap((session) => {
        // Find all entries for this day and period where this teacher is assigned
        const relevantEntries = session.entries.filter((entry) => {
          // Handle both Bulgarian and English day names
          let entryDayInEnglish = entry.day;
          if (bgToEnDayMap[entry.day]) {
            entryDayInEnglish = bgToEnDayMap[entry.day];
          }

          // If day is in Bulgarian, convert to English for comparison
          let dayInEnglish = day;
          if (bgToEnDayMap[day]) {
            dayInEnglish = bgToEnDayMap[day];
          }

          return (
            entryDayInEnglish === dayInEnglish &&
            entry.period === period &&
            (entry.teacherId === user?.userId ||
              session.teacherId === user?.userId)
          );
        });

        // Map each relevant entry to a detail object
        return relevantEntries.map((entry) => ({
          subject: subjects[entry?.subjectId || ""] || "-",
          classId: entry?.classId || session.homeroomClassId || "",
          subjectId: entry?.subjectId || "",
          className: entry?.classId
            ? `${
                session.homeroomClassId === entry.classId
                  ? "Моят клас" // If it's the teacher's homeroom class
                  : classes[entry.classId] || entry.classId
              }`
            : "-", // Use display-friendly class name
        }));
      });

      return details.length > 0
        ? details
        : [{ subject: "-", classId: "", subjectId: "" }];
    }

    return [{ subject: "-", classId: "", subjectId: "" }];
  };

  // Check if a period is over (earlier today or on a previous day)
  const isPeriodOver = (day: string, period: number): boolean => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const today = days[dayOfWeek - 1];

    // If it's a different day
    if (day !== today) {
      const dayIndex = days.indexOf(day);
      const todayIndex = days.indexOf(today);
      return dayIndex < todayIndex;
    }

    // Same day, check time
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;

    // Find period end time
    const periodInfo = periods.find((p) => p.period === period);
    if (!periodInfo) return false;

    const [endHour, endMinute] = periodInfo.endTime.split(":").map(Number);
    const periodEndInMinutes = endHour * 60 + endMinute;

    return currentTimeInMinutes > periodEndInMinutes;
  };

  // Get the current day of the week on component load
  useEffect(() => {
    const today = new Date().getDay();
    // Convert JS day (0=Sunday, 1=Monday) to our days array (0=Monday)
    const dayIndex = today === 0 ? 4 : today - 1; // If Sunday, show Friday, otherwise show current day
    if (dayIndex >= 0 && dayIndex < days.length) {
      setActiveDay(days[dayIndex]);
    }
  }, []);

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              Седмично разписание
            </h1>
            <div className="flex items-center space-x-2 mt-2 md:mt-0">
              <CalendarRange className="h-5 w-5 text-blue-500" />
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString("bg-BG", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <Switch
                  id="highlight-current"
                  checked={highlightCurrentPeriod}
                  onCheckedChange={setHighlightCurrentPeriod}
                />
                <Label htmlFor="highlight-current" className="text-sm">
                  Маркирай текущия час
                </Label>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-completed"
                  checked={showCompletedClasses}
                  onCheckedChange={setShowCompletedClasses}
                />
                <Label htmlFor="show-completed" className="text-sm">
                  Показвай отминали часове
                </Label>
              </div>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-1/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <CardTitle className="text-red-600">
                    Грешка при зареждане
                  </CardTitle>
                </div>
                <CardDescription className="text-red-500">
                  {error}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Моля, опитайте да презаредите страницата или се свържете с
                  администратор ако проблемът продължава.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md">
              <CardHeader className="border-b bg-blue-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-xl text-gray-800 flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
                    Моето разписание
                  </CardTitle>
                  <div className="flex items-center mt-2 md:mt-0">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 mr-2">
                      <Calendar className="h-3 w-3 mr-1" /> Учебна 2024/2025
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop View - Full Table */}
                <div className="hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border-b border-r px-4 py-3 text-left font-medium text-gray-500">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              Час / Ден
                            </div>
                          </th>
                          {days.map((day) => {
                            const weekDates = getCurrentWeekDates();
                            const date = weekDates[day];
                            const formattedDate = date.toLocaleDateString(
                              "bg-BG",
                              { day: "numeric", month: "numeric" }
                            );

                            return (
                              <th
                                key={day}
                                className={`border-b px-4 py-3 text-center font-medium ${
                                  day === currentDay && highlightCurrentPeriod
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-500"
                                }`}
                              >
                                <div className="flex flex-col items-center">
                                  <span>{getBulgarianDayName(day)}</span>
                                  <span className="text-xs mt-1 text-gray-500">
                                    {formattedDate}
                                  </span>
                                  {day === currentDay &&
                                    highlightCurrentPeriod && (
                                      <Badge className="mt-1 bg-blue-100 text-blue-800 text-xs">
                                        Днес
                                      </Badge>
                                    )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map(({ period, startTime, endTime }) => {
                          const isPeriodActive =
                            period === currentPeriod &&
                            activeDay === currentDay;

                          return (
                            <tr
                              key={period}
                              className={
                                isPeriodActive && highlightCurrentPeriod
                                  ? "bg-yellow-50"
                                  : period % 2 === 0
                                  ? "bg-gray-50"
                                  : "bg-white"
                              }
                            >
                              <td className="border-r px-4 py-3 text-center">
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {period} час
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {startTime} - {endTime}
                                  </span>
                                  {isPeriodActive && highlightCurrentPeriod && (
                                    <Badge className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-200 self-center">
                                      В момента
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              {days.map((day) => {
                                const details = getDetailsForPeriod(
                                  day,
                                  period
                                );
                                const isCurrentCell =
                                  day === currentDay &&
                                  period === currentPeriod &&
                                  highlightCurrentPeriod;
                                const isPeriodCompleted = isPeriodOver(
                                  day,
                                  period
                                );

                                if (isPeriodCompleted && showCompletedClasses) {
                                  return (
                                    <td
                                      key={day}
                                      className="border-b px-4 py-3 bg-gray-50 text-center"
                                    >
                                      <div className="flex justify-center">
                                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={day}
                                    className={`border-b px-4 py-3 ${
                                      isCurrentCell
                                        ? "bg-yellow-50 border border-yellow-200"
                                        : isPeriodCompleted &&
                                          showCompletedClasses
                                        ? "bg-gray-50/70"
                                        : ""
                                    }`}
                                  >
                                    {details.map((detail, index) => {
                                      if (detail.subject === "-") {
                                        return (
                                          <div
                                            key={index}
                                            className="text-center text-gray-400"
                                          >
                                            —
                                          </div>
                                        );
                                      }
                                      return (
                                        <div
                                          key={index}
                                          className="flex flex-col items-center"
                                        >
                                          <div>
                                            <Badge
                                              className={`${getSubjectColor(
                                                detail.subject
                                              )} font-medium ${
                                                isPeriodCompleted &&
                                                showCompletedClasses
                                                  ? "opacity-75"
                                                  : ""
                                              }`}
                                            >
                                              {detail.subject}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-gray-500 mt-1 flex items-center">
                                            <Users className="h-3 w-3 mr-1" />
                                            {detail.className}
                                          </div>
                                          {detail.classId &&
                                            detail.subjectId && (
                                              <Link
                                                href={`/teacher/attendance?classId=${
                                                  detail.classId
                                                }&subjectId=${
                                                  detail.subjectId
                                                }&date=${encodeURIComponent(
                                                  getDateForDay(
                                                    day
                                                  ).toISOString()
                                                )}&period=${period}&tab=manual-entry`}
                                                className="inline-flex items-center justify-center rounded-md text-xs bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100 mt-1 transition-colors"
                                              >
                                                <ClipboardList className="h-3 w-3 mr-1" />
                                                Отбележи отсъствия
                                              </Link>
                                            )}
                                        </div>
                                      );
                                    })}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile View - Tabs by Day */}
                <div className="md:hidden">
                  <Tabs defaultValue={activeDay} onValueChange={setActiveDay}>
                    <TabsList className="w-full grid grid-cols-5 mb-4">
                      {days.map((day) => {
                        const weekDates = getCurrentWeekDates();
                        const date = weekDates[day];
                        const formattedDate = date.toLocaleDateString("bg-BG", {
                          day: "numeric",
                          month: "numeric",
                        });

                        return (
                          <TabsTrigger
                            key={day}
                            value={day}
                            className={`${
                              day === currentDay && highlightCurrentPeriod
                                ? "data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
                                : ""
                            }`}
                          >
                            <div className="flex flex-col items-center">
                              <span>{day.substring(0, 3)}</span>
                              <span className="text-[10px] text-gray-500">
                                {formattedDate}
                              </span>
                              {day === currentDay && highlightCurrentPeriod && (
                                <span className="text-[10px] mt-0.5 text-blue-800">
                                  • днес •
                                </span>
                              )}
                            </div>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {days.map((day) => (
                      <TabsContent key={day} value={day}>
                        <div className="space-y-3">
                          {periods.map(({ period, startTime, endTime }) => {
                            const details = getDetailsForPeriod(day, period);
                            const isCurrentPeriodNow =
                              period === currentPeriod &&
                              day === currentDay &&
                              highlightCurrentPeriod;
                            const isPeriodCompleted = isPeriodOver(day, period);

                            if (isPeriodCompleted && showCompletedClasses) {
                              return (
                                <Card
                                  key={period}
                                  className="bg-gray-50 opacity-80 overflow-hidden border-gray-200"
                                >
                                  <CardHeader className="p-3 bg-gray-100">
                                    <div className="flex justify-between items-center">
                                      <CardTitle className="text-sm flex items-center text-gray-500">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {period}. {startTime} - {endTime}
                                      </CardTitle>
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        Завършен
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                </Card>
                              );
                            }

                            return (
                              <Card
                                key={period}
                                className={`overflow-hidden ${
                                  isCurrentPeriodNow
                                    ? "border-yellow-300 shadow-md bg-yellow-50"
                                    : isPeriodCompleted && showCompletedClasses
                                    ? "opacity-80"
                                    : ""
                                }`}
                              >
                                <CardHeader
                                  className={`p-3 ${
                                    isCurrentPeriodNow
                                      ? "bg-yellow-100"
                                      : isPeriodCompleted &&
                                        showCompletedClasses
                                      ? "bg-gray-100"
                                      : "bg-gray-50"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <CardTitle className="text-sm flex items-center">
                                      <Clock className="h-3 w-3 mr-1 text-gray-500" />
                                      {period}. {startTime} - {endTime}
                                    </CardTitle>
                                    {isCurrentPeriodNow && (
                                      <Badge className="bg-yellow-200 text-yellow-800 text-xs">
                                        В момента
                                      </Badge>
                                    )}
                                    {isPeriodCompleted &&
                                      showCompletedClasses && (
                                        <Badge className="bg-gray-200 text-gray-700 text-xs">
                                          Завършен
                                        </Badge>
                                      )}
                                  </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-4">
                                  {details.map((detail, index) => {
                                    if (detail.subject === "-") {
                                      return (
                                        <div
                                          key={index}
                                          className="text-center py-4 text-gray-400"
                                        >
                                          Няма час
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={index} className="space-y-2">
                                        <div className="flex items-center justify-center">
                                          <Badge
                                            className={`${getSubjectColor(
                                              detail.subject
                                            )} px-3 py-1 text-sm ${
                                              isPeriodCompleted &&
                                              showCompletedClasses
                                                ? "opacity-85"
                                                : ""
                                            }`}
                                          >
                                            {detail.subject}
                                          </Badge>
                                        </div>
                                        <div className="text-sm text-center text-gray-600 flex items-center justify-center">
                                          <Users className="h-3 w-3 mr-1" />
                                          {detail.className}
                                        </div>
                                        {detail.classId && detail.subjectId && (
                                          <div className="flex justify-center mt-2">
                                            <Link
                                              href={`/teacher/attendance?classId=${
                                                detail.classId
                                              }&subjectId=${
                                                detail.subjectId
                                              }&date=${encodeURIComponent(
                                                getDateForDay(day).toISOString()
                                              )}&period=${period}&tab=manual-entry`}
                                              className="inline-flex items-center justify-center rounded-md text-xs bg-blue-50 px-3 py-1.5 text-blue-700 hover:bg-blue-100 transition-colors"
                                            >
                                              <ClipboardList className="h-3 w-3 mr-1" />
                                              Отбележи отсъствия
                                            </Link>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
