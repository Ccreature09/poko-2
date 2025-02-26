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

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const periods = [
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
  const [activeDay, setActiveDay] = useState(days[0]);

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

      fetchSubjects();
      fetchTeachers();
    }
  }, [user]);

  const getDetailsForPeriod = (day: string, period: number): { subject: string; teacher: string }[] => {
    if (!timetable) return [{ subject: '-', teacher: '-' }];

    const sessions = timetable.filter((session: ClassSession) =>
      session.entries.some(entry => entry.day === day && entry.period === period)
    );

    if (sessions.length > 0) {
      const details = sessions.map(session => {
        const entry = session.entries.find(entry => entry.day === day && entry.period === period);
        return {
          subject: subjects[entry?.subjectId || ''] || '-',
          teacher: teachers[entry?.teacherId || ''] || '-',
        };
      });

      return details;
    }

    return [{ subject: '-', teacher: '-' }];
  };

  if (!user) return null;

  // Get the current day of the week on component load
  useEffect(() => {
    const today = new Date().getDay();
    // Convert JS day (0=Sunday, 1=Monday) to our days array (0=Monday)
    const dayIndex = today === 0 ? 4 : today - 1; // If Sunday, show Friday, otherwise show current day
    if (dayIndex >= 0 && dayIndex < days.length) {
      setActiveDay(days[dayIndex]);
    }
  }, []);

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
                                <div key={index}>
                                  <div>{detail.subject}</div>
                                  <div className="text-sm text-gray-500">{detail.teacher}</div>
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
                                    <div className="text-sm text-gray-500">{detail.teacher}</div>
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