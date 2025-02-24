"use client";

import { useUser } from "@/contexts/UserContext";
import { useTimetable } from "@/contexts/TimetableContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/functional/Sidebar";
import type { ClassSession } from "@/lib/interfaces";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase"; // Import Firestore instance
import { collection, getDocs } from "firebase/firestore";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const periods = [
  { period: 1, startTime: "07:30", endTime: "08:10" },
  { period: 2, startTime: "08:20", endTime: "09:00" },
  { period: 3, startTime: "09:10", endTime: "09:50" },
  { period: 4, startTime: "10:10", endTime: "10:50" },
  { period: 5, startTime: "11:00", endTime: "11:40" },
  { period: 6, startTime: "11:50", endTime: "12:30" },
  { period: 7, startTime: "12:40", endTime: "13:20" },
  { period: 8, startTime: "13:30", endTime: "14:10" },
];

export default function Timetable() {
  const { user } = useUser();
  const { timetable, loading, error } = useTimetable();
  const [subjects, setSubjects] = useState<{ [key: string]: string }>({}); // Store subject names by subjectId
  const [teachers, setTeachers] = useState<{ [key: string]: string }>({}); // Store teacher names by teacherId

  useEffect(() => {
    if (user?.schoolId) {
      // Fetch all subjects from Firestore
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
            subjectMap[doc.id] = subjectData.name; // Assuming the subject document has a `name` field
          });

          setSubjects(subjectMap);
        } catch (error) {
          console.error("Failed to fetch subjects from Firestore:", error);
        }
      };

      // Fetch all teachers from Firestore
      const fetchTeachers = async () => {
        try {
          const teachersCollection = collection(
            db,
            `schools/${user.schoolId}/users`
          ); // Updated path
          const teachersSnapshot = await getDocs(teachersCollection);
          const teacherMap: { [key: string]: string } = {};

          teachersSnapshot.forEach((doc) => {
            const teacherData = doc.data();
            teacherMap[
              doc.id
            ] = `${teacherData.firstName} ${teacherData.lastName}`; // Combine first and last name
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

  if (!user) return null;

  // Helper function to get the subject name and teacher name for a specific day and period
  const getDetailsForPeriod = (
    day: string,
    period: number
  ): { subject: string; teacher: string }[] => {
    if (!timetable) return [{ subject: "-", teacher: "-" }];

    const sessions = timetable.filter((session: ClassSession) =>
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

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Timetable</h1>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p>{error}</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Time</th>{" "}
                      {/* Add Time header */}
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
                              {details.map(
                                (
                                  detail: { subject: string; teacher: string },
                                  index: number
                                ) => (
                                  <div key={index}>
                                    <div>{detail.subject}</div>
                                    <div className="text-sm text-gray-500">
                                      {detail.teacher}
                                    </div>
                                  </div>
                                )
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
