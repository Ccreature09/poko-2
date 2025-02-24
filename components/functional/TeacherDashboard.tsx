"use client";

import { useEffect, useState } from "react";
import type { Teacher } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, Bell } from "lucide-react";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./Sidebar";

export default function TeacherDashboard({
  user,
}: {
  user: Teacher & { schoolId: string };
}) {
  const [stats, setStats] = useState([
    { title: "Subject Classes", value: 0, icon: Users },
    { title: "Courses Taught", value: 0, icon: BookOpen },
    { title: "Upcoming Classes", value: 0, icon: Calendar },
    { title: "Pending Tasks", value: 0, icon: Bell },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.schoolId || !user.userId) {
        console.error("Missing schoolId or userId");
        return;
      }

      const schoolRef = doc(db, "schools", user.schoolId);
      const classesRef = collection(schoolRef, "classes");
      const coursesRef = collection(schoolRef, "courses");
      const timetablesRef = collection(schoolRef, "timetables");

      try {
        const [subjectClassesCount, coursesTaughtCount, upcomingClassesCount] =
          await Promise.all([
            getCountFromServer(
              query(classesRef, where("teacherId", "==", user.userId))
            ),
            getCountFromServer(
              query(coursesRef, where("teacherId", "==", user.userId))
            ),
            getCountFromServer(
              query(timetablesRef, where("teacherId", "==", user.userId))
            ),
          ]);

        // For pending tasks, you might need to implement a separate system to track tasks
        // This is just a placeholder
        const pendingTasksCount = { data: () => ({ count: 0 }) };

        setStats([
          {
            title: "Subject Classes",
            value: subjectClassesCount.data().count,
            icon: Users,
          },
          {
            title: "Courses Taught",
            value: coursesTaughtCount.data().count,
            icon: BookOpen,
          },
          {
            title: "Upcoming Classes",
            value: upcomingClassesCount.data().count,
            icon: Calendar,
          },
          {
            title: "Pending Tasks",
            value: pendingTasksCount.data().count,
            icon: Bell,
          },
        ]);
      } catch (error) {
        console.error("Error fetching teacher stats:", error);
      }
    };

    fetchStats();
  }, [user.schoolId, user.userId]);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Teacher Dashboard</h1>
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
    </div>
  );
}
