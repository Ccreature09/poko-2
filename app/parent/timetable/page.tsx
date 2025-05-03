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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClassSession } from "@/lib/interfaces";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import Sidebar from "@/components/functional/Sidebar";
import {
  Calendar,
  Clock,
  User,
  BookOpen,
  CalendarRange,
  AlertCircle,
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
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-green-100 text-green-800 border-green-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-cyan-100 text-cyan-800 border-cyan-200",
    "bg-indigo-100 text-indigo-800 border-indigo-200",
    "bg-orange-100 text-orange-800 border-orange-200",
  ];
  return colors[hash % colors.length];
};

export default function ParentTimetable() {
  const { user } = useUser();
  const { timetable, loading, error } = useTimetable();
  const [subjects, setSubjects] = useState<{ [key: string]: string }>({});
  const [teachers, setTeachers] = useState<{ [key: string]: string }>({});
  const [activeDay, setActiveDay] = useState(days[0]);
  const [periods, setPeriods] = useState(defaultPeriods);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Define Child type
  type Child = { id: string; name: string; classId?: string };
  const [children, setChildren] = useState<Child[]>([]);

  const [highlightCurrentPeriod, setHighlightCurrentPeriod] =
    useState<boolean>(true);
  const [currentDay, setCurrentDay] = useState<string>("");
  const [currentPeriod, setCurrentPeriod] = useState<number | null>(null);

  // State for storing the child-specific timetable
  const [childTimetable, setChildTimetable] = useState<ClassSession[] | null>(
    null
  );
  const [childTimetableLoading, setChildTimetableLoading] =
    useState<boolean>(false);
  const [childTimetableError, setChildTimetableError] = useState<string | null>(
    null
  );

  // Get periods from the timetable if available
  useEffect(() => {
    if (timetable && timetable.length > 0 && timetable[0].periods) {
      setPeriods(timetable[0].periods);
    }
  }, [timetable]);

  // Fetch parent's children
  useEffect(() => {
    if (user?.userId && user.role === "parent" && user.schoolId) {
      const fetchChildren = async () => {
        try {
          // Get the parent document to access childrenIds
          const parentDoc = await getDoc(
            doc(db, "schools", user.schoolId, "users", user.userId)
          );
          if (!parentDoc.exists()) {
            console.error("Parent document not found");
            return;
          }

          const parentData = parentDoc.data();
          const childrenIds = parentData.childrenIds || [];
          // Fix: Define childrenList with the Child type
          const childrenList: Child[] = [];

          // Fetch details for each child
          for (const childId of childrenIds) {
            const childDoc = await getDoc(
              doc(db, "schools", user.schoolId, "users", childId)
            );
            if (childDoc.exists() && childDoc.data().role === "student") {
              const childData = childDoc.data();
              childrenList.push({
                id: childId,
                name: `${childData.firstName} ${childData.lastName}`,
                classId: childData.homeroomClassId,
              });
            }
          }

          setChildren(childrenList);
          if (childrenList.length > 0) {
            setSelectedChildId(childrenList[0].id);
          }
        } catch (error) {
          console.error("Failed to fetch children:", error);
        }
      };

      fetchChildren();
    }
  }, [user]);

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

      fetchSubjects();
      fetchTeachers();
    }
  }, [user]);

  // Fetch timetable when a child is selected
  useEffect(() => {
    if (!user?.schoolId || !selectedChildId) return;

    const fetchChildTimetable = async () => {
      setChildTimetableLoading(true);
      setChildTimetableError(null);

      try {
        // Get the selected child's class ID
        const selectedChild = children.find(
          (child) => child.id === selectedChildId
        );
        if (!selectedChild || !selectedChild.classId) {
          setChildTimetableError("Избраното дете няма назначен клас");
          setChildTimetable(null);
          return;
        }

        // Import the function directly here to avoid circular dependency
        const { fetchTimetablesByHomeroomClassId } = await import(
          "@/lib/timetableManagement"
        );

        // Fetch timetable for the child's class
        const fetchedTimetable = await fetchTimetablesByHomeroomClassId(
          user.schoolId,
          selectedChild.classId
        );

        if (fetchedTimetable.length === 0) {
          setChildTimetable([]);
          setChildTimetableError("Няма намерено разписание за този клас");
        } else {
          const mappedTimetable = fetchedTimetable.map((item) => item.data);
          setChildTimetable(mappedTimetable);

          // If the child's timetable has periods, use those
          if (mappedTimetable[0]?.periods?.length) {
            setPeriods(mappedTimetable[0].periods);
          }
        }
      } catch (error) {
        console.error("Failed to fetch child's timetable:", error);
        setChildTimetableError("Грешка при зареждане на разписанието");
      } finally {
        setChildTimetableLoading(false);
      }
    };

    fetchChildTimetable();
  }, [user?.schoolId, selectedChildId, children]);

  const getDetailsForPeriod = (
    day: string,
    period: number
  ): { subject: string; teacher: string }[] => {
    const timetableToUse = childTimetable || timetable;
    if (!timetableToUse) return [{ subject: "-", teacher: "-" }];

    const sessions = timetableToUse.filter((session: ClassSession) =>
      session.entries.some(
        (entry) => entry.day === day && entry.period === period
      )
    );

    if (sessions.length > 0) {
      const details = sessions.map((session) => {
        const entry = session.entries.find(
          (entry) => entry.day === day && entry.period === period
        );

        return {
          subject: subjects[entry?.subjectId || ""] || "-",
          teacher: teachers[entry?.teacherId || ""] || "-",
        };
      });

      return details;
    }

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

  if (!user || user.role !== "parent") return null;

  const selectedChild = children.find((child) => child.id === selectedChildId);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              Седмично разписание
            </h1>
            <div className="flex items-center space-x-2">
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

          {/* Child selector */}
          {children.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 text-blue-500 mr-2" />
                  <label htmlFor="childSelect" className="text-sm font-medium">
                    Разписание за:
                  </label>
                </div>
                <div className="w-full md:w-64">
                  <Select
                    value={selectedChildId || ""}
                    onValueChange={setSelectedChildId}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Избери дете" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center md:ml-auto">
                  <div className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      id="highlightCurrent"
                      checked={highlightCurrentPeriod}
                      onChange={(e) =>
                        setHighlightCurrentPeriod(e.target.checked)
                      }
                      className="mr-2"
                    />
                    <label htmlFor="highlightCurrent">
                      Маркирай текущия час
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading || childTimetableLoading ? (
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
          ) : error || childTimetableError ? (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <CardTitle className="text-red-600">
                    Грешка при зареждане
                  </CardTitle>
                </div>
                <CardDescription className="text-red-500">
                  {error || childTimetableError}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Моля, опитайте да презаредите страницата или се свържете с
                  администратор ако проблемът продължава.
                </p>
              </CardContent>
            </Card>
          ) : !selectedChildId ? (
            <Card>
              <CardHeader>
                <CardTitle>Няма избрано дете</CardTitle>
                <CardDescription>
                  Моля, изберете дете, за да видите разписанието.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card className="shadow-md">
              <CardHeader className="border-b bg-blue-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-xl text-gray-800 flex items-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
                    Разписание на {selectedChild?.name || "ученик"}
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
                        {periods.map(({ period, startTime, endTime }) => (
                          <tr
                            key={period}
                            className={
                              period === currentPeriod &&
                              activeDay === currentDay &&
                              highlightCurrentPeriod
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
                                {period === currentPeriod &&
                                  activeDay === currentDay &&
                                  highlightCurrentPeriod && (
                                    <Badge className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-200 self-center">
                                      В момента
                                    </Badge>
                                  )}
                              </div>
                            </td>
                            {days.map((day) => {
                              const details = getDetailsForPeriod(day, period);
                              const isCurrentCell =
                                day === currentDay &&
                                period === currentPeriod &&
                                highlightCurrentPeriod;

                              return (
                                <td
                                  key={day}
                                  className={`border-b px-4 py-3 ${
                                    isCurrentCell
                                      ? "bg-yellow-50 border border-yellow-200"
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
                                            )} font-medium`}
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
                        ))}
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

                            return (
                              <Card
                                key={period}
                                className={`overflow-hidden ${
                                  isCurrentPeriodNow
                                    ? "border-yellow-300 shadow-md bg-yellow-50"
                                    : ""
                                }`}
                              >
                                <CardHeader
                                  className={`p-3 ${
                                    isCurrentPeriodNow
                                      ? "bg-yellow-100"
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
                                            )} px-3 py-1 text-sm`}
                                          >
                                            {detail.subject}
                                          </Badge>
                                        </div>
                                        <div className="text-sm text-center text-gray-600 flex items-center justify-center">
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
