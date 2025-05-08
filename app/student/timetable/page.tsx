"use client";

/**
 * Student Timetable Page
 *
 * Interactive weekly schedule display for students to track their classes.
 * This page provides:
 *
 * Key features:
 * - Complete weekly schedule with subject and teacher information
 * - Real-time tracking of current class periods and days
 * - Visual indicators for current, upcoming, and completed classes
 * - Toggle options for highlighting current period and showing past classes
 * - Responsive design with optimized mobile (day tabs) and desktop (full week) views
 *
 * Data flow:
 * - Retrieves timetable data from TimetableContext
 * - Fetches supporting data (subjects, teachers) from Firestore
 * - Calculates current period/class based on real-time system clock
 * - Processes periods data for visual time-based indicators
 *
 * This interface allows students to easily navigate their weekly schedule with
 * intuitive visual cues for time-based context and class information.
 */

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
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Sidebar from "@/components/functional/layout/Sidebar";
import {
  Calendar,
  Clock,
  User,
  BookOpen,
  CalendarRange,
  AlertCircle,
  CheckCircle2,
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

export default function StudentTimetable() {
  const { user } = useUser();
  const { timetable, loading, error } = useTimetable();
  const [subjects, setSubjects] = useState<{ [key: string]: string }>({});
  const [teachers, setTeachers] = useState<{ [key: string]: string }>({});
  const [activeDay, setActiveDay] = useState(days[0]);
  const [periods, setPeriods] = useState(defaultPeriods);
  const [highlightCurrentPeriod, setHighlightCurrentPeriod] =
    useState<boolean>(true);
  const [currentDay, setCurrentDay] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<number | null>(null);
  const [showCompletedClasses, setShowCompletedClasses] =
    useState<boolean>(false);

  // Get periods from the timetable if available
  useEffect(() => {
    if (timetable && timetable.length > 0) {
      console.log("Checking for periods in timetable:", timetable[0]);

      if (timetable[0].periods && timetable[0].periods.length > 0) {
        console.log("Using periods from timetable:", timetable[0].periods);
        setPeriods(timetable[0].periods);
      } else {
        console.log("No periods found in timetable, using defaults");
        setPeriods(defaultPeriods);
      }
    }
  }, [timetable]);

  useEffect(() => {
    if (user?.schoolId) {
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
            subjectMap[doc.id] = subjectData.name;
          });

          setSubjects(subjectMap);
        } catch (error) {
          console.error("Failed to fetch subjects from Firestore:", error);
        }
      };

      const fetchTeachers = async () => {
        try {
          const teachersCollection = collection(
            db,
            `schools/${user.schoolId}/users`
          );
          const teachersSnapshot = await getDocs(teachersCollection);
          const teacherMap: { [key: string]: string } = {};

          teachersSnapshot.forEach((doc) => {
            const teacherData = doc.data();
            if (teacherData.role === "teacher") {
              teacherMap[
                doc.id
              ] = `${teacherData.firstName} ${teacherData.lastName}`;
            }
          });

          setTeachers(teacherMap);
        } catch (error) {
          console.error("Failed to fetch teachers from Firestore:", error);
        }
      };

      // Add debug logging for timetable data
      if (timetable) {
        console.log("Timetable data for display:", timetable);
      } else {
        console.log("No timetable data available");
      }

      fetchSubjects();
      fetchTeachers();
    }
  }, [user, timetable]);

  const getDetailsForPeriod = (
    day: string,
    period: number
  ): { subject: string; teacher: string }[] => {
    if (!timetable) return [{ subject: "-", teacher: "-" }];

    console.log(
      `getDetailsForPeriod called for day: ${day}, period: ${period}`
    );

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

    // Loop through each session in the timetable
    for (const session of timetable) {
      if (
        !session.entries ||
        !Array.isArray(session.entries) ||
        session.entries.length === 0
      ) {
        console.log("Session has no entries", session);
        continue;
      }

      // Debug log to check entries
      console.log(
        `Checking ${session.entries.length} entries for day: ${day}, period: ${period}`
      );

      // Find entries matching the day and period
      const matchingEntries = session.entries.filter((entry) => {
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

        if (matchesDay && matchesPeriod) {
          console.log(
            `Match found! day=${entry.day}, period=${entry.period}, subject=${entry.subjectId}`
          );
        }

        return matchesDay && matchesPeriod;
      });

      console.log(`Found ${matchingEntries.length} matching entries`);

      if (matchingEntries.length > 0) {
        const details = matchingEntries.map((entry) => ({
          subject: subjects[entry.subjectId] || "-",
          teacher: teachers[entry.teacherId] || "-",
        }));

        console.log(`Returning details:`, details);
        return details;
      }
    }

    console.log(`No matching entries found for day: ${day}, period: ${period}`);
    return [{ subject: "-", teacher: "-" }];
  };

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

  // Get the current day of the week on component load
  useEffect(() => {
    const today = new Date().getDay();
    // Convert JS day (0=Sunday, 1=Monday) to our days array (0=Monday)
    const dayIndex = today === 0 ? 4 : today - 1; // If Sunday, show Friday, otherwise show current day
    if (dayIndex >= 0 && dayIndex < days.length) {
      setActiveDay(days[dayIndex]);
    }
  }, []);

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

  if (!user || user.role !== "student") return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-3 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
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

          <div className="flex flex-wrap gap-4 mb-4 md:mb-6">
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
              <CardHeader className="border-b bg-blue-50 p-3 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-lg md:text-xl text-gray-800 flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
                    Моето разписание
                  </CardTitle>
                  {user?.homeroomClassId && (
                    <div className="flex items-center mt-2 md:mt-0">
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 mr-2">
                        <Calendar className="h-3 w-3 mr-1" /> Учебна 2024/2025
                      </Badge>
                    </div>
                  )}
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
                                            <User className="h-3 w-3 mr-1" />
                                            {detail.teacher}
                                          </div>
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
                <div className="block md:hidden">
                  <Tabs
                    defaultValue={activeDay}
                    onValueChange={setActiveDay}
                    className="w-full"
                  >
                    <div className="overflow-x-auto pb-1 -mx-1 px-1">
                      <TabsList className="w-full min-w-[400px] grid grid-cols-5 mb-4">
                        {days.map((day) => {
                          const weekDates = getCurrentWeekDates();
                          const date = weekDates[day];
                          const formattedDate = date.toLocaleDateString(
                            "bg-BG",
                            {
                              day: "numeric",
                              month: "numeric",
                            }
                          );
                          const isToday = day === currentDay;

                          return (
                            <TabsTrigger
                              key={day}
                              value={day}
                              className={`px-1 py-1.5 ${
                                isToday && highlightCurrentPeriod
                                  ? "data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900"
                                  : ""
                              }`}
                            >
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-medium">
                                  {getBulgarianDayName(day).substring(0, 3)}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  {formattedDate}
                                </span>
                                {isToday && highlightCurrentPeriod && (
                                  <div className="h-1 w-1 rounded-full bg-blue-500 mt-0.5"></div>
                                )}
                              </div>
                            </TabsTrigger>
                          );
                        })}
                      </TabsList>
                    </div>

                    {days.map((day) => (
                      <TabsContent key={day} value={day} className="mt-1">
                        <div className="space-y-2">
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
                                  <CardHeader className="p-2 pb-0 pt-1.5 bg-gray-100">
                                    <div className="flex justify-between items-center">
                                      <CardTitle className="text-xs flex items-center text-gray-500">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {period}. {startTime} - {endTime}
                                      </CardTitle>
                                      <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 h-5">
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
                                  className={`p-2 pb-1 ${
                                    isCurrentPeriodNow
                                      ? "bg-yellow-100"
                                      : isPeriodCompleted &&
                                        showCompletedClasses
                                      ? "bg-gray-100"
                                      : "bg-gray-50"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <CardTitle className="text-xs flex items-center">
                                      <Clock className="h-3 w-3 mr-1 text-gray-500" />
                                      {period}. {startTime} - {endTime}
                                    </CardTitle>
                                    {isCurrentPeriodNow && (
                                      <Badge className="bg-yellow-200 text-yellow-800 text-xs px-1.5 py-0.5 h-5">
                                        В момента
                                      </Badge>
                                    )}
                                    {isPeriodCompleted &&
                                      showCompletedClasses && (
                                        <Badge className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 h-5">
                                          Завършен
                                        </Badge>
                                      )}
                                  </div>
                                </CardHeader>
                                <CardContent className="p-2 pt-2">
                                  {details.map((detail, index) => {
                                    if (detail.subject === "-") {
                                      return (
                                        <div
                                          key={index}
                                          className="text-center py-3 text-gray-400 text-sm"
                                        >
                                          Няма час
                                        </div>
                                      );
                                    }
                                    return (
                                      <div
                                        key={index}
                                        className="space-y-1 py-1"
                                      >
                                        <div className="flex items-center justify-center">
                                          <Badge
                                            className={`${getSubjectColor(
                                              detail.subject
                                            )} px-3 py-0.5 text-sm ${
                                              isPeriodCompleted &&
                                              showCompletedClasses
                                                ? "opacity-85"
                                                : ""
                                            }`}
                                          >
                                            {detail.subject}
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-center text-gray-600 flex items-center justify-center">
                                          <User className="h-3 w-3 mr-1" />
                                          {detail.teacher}
                                        </div>
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
