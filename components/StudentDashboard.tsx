"use client";

import { useEffect, useState } from "react";
import type { Student } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, GraduationCap, Bell } from "lucide-react";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function StudentDashboard({
  user,
}: {
  user: Student & { schoolId: string };
  schoolId: string;
}) {
  const [stats, setStats] = useState([
    { title: "Enrolled Subjects", value: 0, icon: BookOpen },
    { title: "Upcoming Classes", value: 0, icon: Calendar },
    { title: "Recent Grades", value: "0%", icon: GraduationCap },
    { title: "New Messages", value: 0, icon: Bell },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.schoolId || !user.userId) {
        console.error("Missing schoolId or userId");
        return;
      }

      const schoolRef = doc(db, "schools", user.schoolId);
      const classesRef = collection(schoolRef, "classes");
      const timetablesRef = collection(schoolRef, "timetables");
      const inboxRef = collection(
        doc(schoolRef, "users", user.userId),
        "inbox"
      );

      try {
        const [enrolledSubjectsCount, upcomingClassesCount, newMessagesCount] =
          await Promise.all([
            getCountFromServer(
              query(
                classesRef,
                where("students", "array-contains", user.userId)
              )
            ),
            getCountFromServer(
              query(
                timetablesRef,
                where("students", "array-contains", user.userId)
              )
            ),
            getCountFromServer(query(inboxRef, where("read", "==", false))),
          ]);

        // For recent grades, you might need to implement a separate system to track grades
        // This is just a placeholder
        const recentGrades = "85%";

        setStats([
          {
            title: "Enrolled Subjects",
            value: enrolledSubjectsCount.data().count,
            icon: BookOpen,
          },
          {
            title: "Upcoming Classes",
            value: upcomingClassesCount.data().count,
            icon: Calendar,
          },
          { title: "Recent Grades", value: recentGrades, icon: GraduationCap },
          {
            title: "New Messages",
            value: newMessagesCount.data().count,
            icon: Bell,
          },
        ]);
      } catch (error) {
        console.error("Error fetching student stats:", error);
      }
    };

    fetchStats();
  }, [user.schoolId, user.userId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Student Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
