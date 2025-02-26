"use client";

import { useEffect, useState } from "react";
import type { Teacher } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BookOpen, Calendar, Bell, Clock, Plus, FileEdit, ChevronRight } from "lucide-react";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./Sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UpcomingClass {
  id: string;
  subject: string;
  class: string;
  time: Timestamp;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: Timestamp;
}

export default function TeacherDashboard({
  user,
}: {
  user: Teacher & { schoolId: string };
}) {
  const [stats, setStats] = useState([
    { title: "Предметни класове", value: 0, icon: Users },
    { title: "Преподавани курсове", value: 0, icon: BookOpen },
    { title: "Предстоящи класове", value: 0, icon: Calendar },
    { title: "Неприключени задачи", value: 0, icon: Bell },
  ]);
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  const quickActions = [
    { title: "Добавяне на оценки", href: "/add-grades", icon: Plus },
    { title: "Създаване на тест", href: "/create-quiz", icon: FileEdit },
    { title: "Нов курс", href: "/create-course", icon: BookOpen },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.schoolId || !user.userId) {
        console.error("Липсва schoolId или userId");
        return;
      }

      const schoolRef = doc(db, "schools", user.schoolId);
      const classesRef = collection(schoolRef, "classes");
      const coursesRef = collection(schoolRef, "courses");
      const timetablesRef = collection(schoolRef, "timetables");
      const gradesRef = collection(schoolRef, "grades");
      const activitiesRef = collection(schoolRef, "activities");

      try {
        // Fetch stats
        const [subjectClassesCount, coursesTaughtCount, upcomingClassesCount, pendingTasksCount] =
          await Promise.all([
            getCountFromServer(query(classesRef, where("teacherId", "==", user.userId))),
            getCountFromServer(query(coursesRef, where("teacherId", "==", user.userId))),
            getCountFromServer(query(timetablesRef, where("teacherId", "==", user.userId))),
            getCountFromServer(query(gradesRef, where("teacherId", "==", user.userId), where("status", "==", "pending"))),
          ]);

        setStats([
          {
            title: "Предметни класове",
            value: subjectClassesCount.data().count,
            icon: Users,
          },
          {
            title: "Преподавани курсове",
            value: coursesTaughtCount.data().count,
            icon: BookOpen,
          },
          {
            title: "Предстоящи класове",
            value: upcomingClassesCount.data().count,
            icon: Calendar,
          },
          {
            title: "Неприключени задачи",
            value: pendingTasksCount.data().count,
            icon: Bell,
          },
        ]);

        // Fetch upcoming classes
        const today = new Date();
        const upcomingClassesSnapshot = await getDocs(
          query(
            timetablesRef,
            where("teacherId", "==", user.userId),
            where("date", ">=", today),
            orderBy("date"),
            limit(5)
          )
        );

        const upcomingClassesData = upcomingClassesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UpcomingClass[];
        setUpcomingClasses(upcomingClassesData);

        // Fetch recent activity
        const recentActivitySnapshot = await getDocs(
          query(
            activitiesRef,
            where("teacherId", "==", user.userId),
            orderBy("timestamp", "desc"),
            limit(5)
          )
        );

        const recentActivityData = recentActivitySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as RecentActivity[];
        setRecentActivity(recentActivityData);

      } catch (error) {
        console.error("Грешка при извличане на данните:", error);
      }
    };

    fetchStats();
  }, [user.schoolId, user.userId]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Табло на учителя</h1>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">Бързи действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickActions.map((action, index) => (
                  <Link href={action.href} key={index}>
                    <Button
                      variant="outline"
                      className="w-full justify-between hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 group"
                    >
                      <span className="flex items-center">
                        <action.icon className="h-4 w-4 mr-2 group-hover:text-blue-600" />
                        {action.title}
                      </span>
                      <ChevronRight className="h-4 w-4 group-hover:text-blue-600" />
                    </Button>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Upcoming Classes */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">Предстоящи часове</CardTitle>
                <CardDescription>Следващите 5 учебни часа</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {upcomingClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900">{cls.subject}</h4>
                          <p className="text-sm text-gray-500">{cls.class}</p>
                        </div>
                        <div className="flex items-center text-gray-500">
                          <Clock className="h-4 w-4 mr-2" />
                          <span className="text-sm">
                            {new Date(cls.time.seconds * 1000).toLocaleTimeString('bg-BG', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">Последна активност</CardTitle>
                <CardDescription>Последни 5 действия</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="p-3 bg-white rounded-lg border border-gray-100"
                      >
                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                        <div className="flex items-center mt-2 text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          <span className="text-xs">
                            {new Date(activity.timestamp.seconds * 1000).toLocaleString('bg-BG')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
