"use client";

import { useUser } from "@/contexts/UserContext";
import { useTimetable } from "@/contexts/TimetableContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClassSession } from "@/lib/interfaces";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Sidebar from "@/components/functional/Sidebar";
import Link from "next/link";

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
  { period: 8, startTime: "13:30", endTime: "14:10" }
];

export default function Timetable() {
  const { user } = useUser();
  const { timetable, loading, error } = useTimetable();
  const [subjects, setSubjects] = useState<{ [key: string]: string }>({});
  const [teachers, setTeachers] = useState<{ [key: string]: string }>({});
  const [classes, setClasses] = useState<{ [key: string]: string }>({});
  const [activeDay, setActiveDay] = useState(days[0]);
  const [periods, setPeriods] = useState(defaultPeriods);

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
      console.log("Using custom periods from timetable:", timetable[0].periods);
    }
  }, [timetable]);

  useEffect(() => {
    if (user?.schoolId) {
      const fetchSubjects = async () => {
        try {
          const subjectsCollection = collection(db, `schools/${user.schoolId}/subjects`);
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
          const teachersCollection = collection(db, `schools/${user.schoolId}/users`);
          const teachersSnapshot = await getDocs(teachersCollection);
          const teacherMap: { [key: string]: string } = {};

          teachersSnapshot.forEach((doc) => {
            const teacherData = doc.data();
            teacherMap[doc.id] = `${teacherData.firstName} ${teacherData.lastName}`;
          });

          setTeachers(teacherMap);
        } catch (error) {
          console.error("Failed to fetch teachers from Firestore:", error);
        }
      };

      const fetchClasses = async () => {
        try {
          const classesCollection = collection(db, `schools/${user.schoolId}/classes`);
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
      fetchTeachers();
      fetchClasses();
    }
  }, [user]);

  const getDetailsForPeriod = (day: string, period: number): { subject: string; teacher: string; classId: string; subjectId: string; className?: string }[] => {
    if (!timetable) return [{ subject: '-', teacher: '-', classId: '', subjectId: '' }];

    const sessions = timetable.filter((session: ClassSession) =>
      session.entries.some(entry => entry.day === day && entry.period === period)
    );

    if (sessions.length > 0) {
      const details = sessions.map(session => {
        const entry = session.entries.find(entry => entry.day === day && entry.period === period);
        
        // Different display format for teachers vs students
        if (user?.role === 'teacher') {
          // For teachers: display class name instead of teacher name (they are the teacher)
          return {
            subject: subjects[entry?.subjectId || ''] || '-',
            teacher: '-', // Not shown for teachers
            classId: entry?.classId || session.homeroomClassId || '',
            subjectId: entry?.subjectId || '',
            className: entry?.classId ? `Class: ${session.homeroomClassId === entry.classId ? 
              'My Class' : // If it's the teacher's homeroom class
              (classes[entry.classId] || entry.classId)}` : '-', // Use display-friendly class name
          };
        } else {
          // For students: regular display
          return {
            subject: subjects[entry?.subjectId || ''] || '-',
            teacher: teachers[entry?.teacherId || ''] || '-',
            classId: session.homeroomClassId || '',
            subjectId: entry?.subjectId || '',
          };
        }
      });

      return details;
    }

    return [{ subject: '-', teacher: '-', classId: '', subjectId: '' }];
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

  if (!user) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-8">Разписание</h1>
        {loading ? (
          <p>Зареждане...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Седмичен график</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop View - Full Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Време</th>
                      {days.map((day) => (
                        <th key={day} className="px-4 py-2">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(({ period, startTime, endTime }) => (
                      <tr key={period}>
                        <td className="px-4 py-2 text-center">
                          {startTime} - {endTime}
                        </td>
                        {days.map((day) => {
                          const details = getDetailsForPeriod(day, period);
                          return (
                            <td key={day} className="px-4 py-2 text-center">
                              {details.map((detail, index) => (
                                <div key={index} className="space-y-1">
                                  <div>{detail.subject}</div>
                                  {user?.role === 'teacher' ? (
                                    <div className="text-sm text-gray-500">{detail.className || 'Class: -'}</div>
                                  ) : (
                                    <div className="text-sm text-gray-500">{detail.teacher}</div>
                                  )}
                                  {user?.role === 'teacher' && detail.classId && detail.subject !== '-' && (
                                    <Link 
                                      href={`/attendance?classId=${detail.classId}&subjectId=${detail.subjectId}&date=${encodeURIComponent(getDateForDay(day).toISOString())}&period=${period}&tab=manual-entry`}
                                      className="inline-flex items-center justify-center rounded-md text-xs bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100 transition-colors"
                                    >
                                      Take Attendance
                                    </Link>
                                  )}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile View - Tabs by Day */}
              <div className="md:hidden">
                <Tabs defaultValue={activeDay} onValueChange={setActiveDay}>
                  <TabsList className="grid grid-cols-5 mb-4">
                    {days.map((day) => (
                      <TabsTrigger key={day} value={day}>
                        {day.substring(0, 3)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {days.map((day) => (
                    <TabsContent key={day} value={day}>
                      <div className="space-y-3">
                        {periods.map(({ period, startTime, endTime }) => {
                          const details = getDetailsForPeriod(day, period);
                          return (
                            <Card key={period} className="overflow-hidden">
                              <CardHeader className="p-3 bg-muted">
                                <CardTitle className="text-sm">{startTime} - {endTime}</CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                {details.map((detail, index) => (
                                  <div key={index}>
                                    <div className="font-medium">{detail.subject}</div>
                                    {user?.role === 'teacher' ? (
                                      <div className="text-sm text-gray-500">{detail.className || 'Class: -'}</div>
                                    ) : (
                                      <div className="text-sm text-gray-500">{detail.teacher}</div>
                                    )}
                                    {user?.role === 'teacher' && detail.classId && detail.subject !== '-' && (
                                      <Link 
                                        href={`/attendance?classId=${detail.classId}&subjectId=${detail.subjectId}&date=${encodeURIComponent(getDateForDay(day).toISOString())}&period=${period}&tab=manual-entry`}
                                        className="inline-flex items-center justify-center rounded-md text-xs bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100 mt-2 transition-colors"
                                      >
                                        Take Attendance
                                      </Link>
                                    )}
                                  </div>
                                ))}
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
  );
}