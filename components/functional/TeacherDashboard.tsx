"use client";

import { useEffect, useState } from "react";
import type { Teacher, Assignment, AssignmentSubmission } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BookOpen, Calendar, Bell, Clock, FileEdit, ChevronRight, FileText, CheckCircle, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { getAssignmentStats, getPendingSubmissions } from "@/lib/assignmentManagement";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface UpcomingClass {
  id: string;
  title: string;
  time: string;
  className: string;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
}

interface PendingSubmission {
  submission: AssignmentSubmission;
  assignment: Assignment;
}

export default function TeacherDashboard({
  user,
}: {
  user: Teacher & { schoolId: string };
}) {
  const [stats, setStats] = useState([
    { title: "Управлявани класове", value: 0, icon: Users },
    { title: "Преподавани предмети", value: 0, icon: BookOpen },
    { title: "Предстоящи часове", value: 0, icon: Calendar },
    { title: "Очакващи проверка", value: 0, icon: Bell },
  ]);
  
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [assignmentStats, setAssignmentStats] = useState({
    totalAssignments: 0,
    pendingGrading: 0,
    submissionRate: 0,
    lateSubmissions: 0
  });
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const quickLinks = [
    { title: "Създаване на задача", href: "/create-assignment", icon: FileText },
    { title: "Създаване на тест", href: "/create-quiz", icon: FileEdit },
    { title: "Нов курс", href: "/create-course", icon: BookOpen },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.schoolId || !user.userId) {
        console.error("Липсва schoolId или userId");
        return;
      }

      setLoading(true);

      const schoolRef = doc(db, "schools", user.schoolId);
      const classesRef = collection(schoolRef, "classes");
      const coursesRef = collection(schoolRef, "courses");
      const timetablesRef = collection(schoolRef, "timetables");
      const activitiesRef = collection(schoolRef, "activities");

      try {
        // Fetch stats
        const [subjectClassesCount, coursesTaughtCount, upcomingClassesCount] =
          await Promise.all([
            getCountFromServer(query(classesRef, where("teacherId", "==", user.userId))),
            getCountFromServer(query(coursesRef, where("teacherId", "==", user.userId))),
            getCountFromServer(query(timetablesRef, where("teacherId", "==", user.userId))),
          ]);

        // Fetch assignment stats
        const assignmentStatsData = await getAssignmentStats(user.schoolId, user.userId);
        setAssignmentStats(assignmentStatsData);

        // Fetch pending submissions (awaiting grading)
        const pendingSubs = await getPendingSubmissions(user.schoolId, user.userId);
        setPendingSubmissions(pendingSubs);

        setStats([
          {
            title: "Управлявани класове",
            value: subjectClassesCount.data().count,
            icon: Users,
          },
          {
            title: "Преподавани предмети",
            value: coursesTaughtCount.data().count,
            icon: BookOpen,
          },
          {
            title: "Предстоящи часове",
            value: upcomingClassesCount.data().count,
            icon: Calendar,
          },
          {
            title: "Очакващи проверка",
            value: assignmentStatsData.pendingGrading,
            icon: Bell,
          },
        ]);

        // Fetch upcoming classes
        const now = Timestamp.now();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekTimestamp = Timestamp.fromDate(nextWeek);

        const upcomingClassesQuery = query(
          timetablesRef,
          where("teacherId", "==", user.userId),
          where("date", ">=", now),
          where("date", "<=", nextWeekTimestamp),
          orderBy("date", "asc"),
          limit(5)
        );

        const upcomingClassesSnapshot = await getDocs(upcomingClassesQuery);
        const upcomingClassesData = upcomingClassesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.subjectName || "Untitled Class",
            time: data.startTime,
            className: data.className || "Unknown Class",
          };
        });
        setUpcomingClasses(upcomingClassesData);

        // Fetch recent activities
        const recentActivitiesQuery = query(
          activitiesRef,
          where("teacherId", "==", user.userId),
          orderBy("createdAt", "desc"),
          limit(10)
        );

        const recentActivitiesSnapshot = await getDocs(recentActivitiesQuery);
        const activitiesData = recentActivitiesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            title: data.title,
            description: data.description,
            date: new Date(data.createdAt.seconds * 1000),
          };
        });
        setActivities(activitiesData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user.schoolId, user.userId]);

  // Format data for charts
  const submissionPieData = [
    { name: "Submitted", value: assignmentStats.submissionRate },
    { name: "Missing", value: 100 - assignmentStats.submissionRate }
  ];
  
  const lateSubmissionData = [
    { name: "On Time", value: pendingSubmissions.filter(ps => ps.submission.status === "submitted").length },
    { name: "Late", value: pendingSubmissions.filter(ps => ps.submission.status === "late").length },
    { name: "Resubmitted", value: pendingSubmissions.filter(ps => ps.submission.status === "resubmitted").length }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Учителско табло</h1>
            <div className="flex justify-center items-center h-64">
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Учителско табло</h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                      <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full">
                      <Icon className="h-6 w-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Links */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Бързи връзки</CardTitle>
                <CardDescription>Преки пътища към често използвани действия</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quickLinks.map((link, index) => {
                    const Icon = link.icon;
                    return (
                      <Link href={link.href} key={index}>
                        <Button
                          variant="outline"
                          className="w-full justify-between hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{link.title}</span>
                          </div>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Pending Submissions */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle>Чакащи предавания</CardTitle>
                <CardDescription>Предавания очакващи вашата оценка</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingSubmissions.length > 0 ? (
                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-4">
                      {pendingSubmissions.slice(0, 5).map((item, index) => (
                        <div key={index} className="flex items-start justify-between p-4 border rounded-md hover:bg-gray-50 transition-colors">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <Link href={`/assignments/${item.assignment.assignmentId}`}>
                                <span className="font-medium text-blue-600 hover:underline">
                                  {item.assignment.title}
                                </span>
                              </Link>
                              <Badge variant={item.submission.status === "submitted" ? "outline" : (item.submission.status === "late" ? "destructive" : "secondary")}>
                                {item.submission.status === "submitted" ? "Ново" : (item.submission.status === "late" ? "Закъсняло" : "Преработено")}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              Предадено от <span className="font-medium">{item.submission.studentName}</span> на{" "}
                              {format(new Date(item.submission.submittedAt.seconds * 1000), "MMM d, yyyy")}
                            </p>
                          </div>
                          <Link href={`/assignments/${item.assignment.assignmentId}`}>
                            <Button size="sm" variant="outline">
                              Оцени
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Всички предавания са оценени!</h3>
                    <p className="text-gray-500 mt-1">Няма чакащи предавания за оценяване.</p>
                  </div>
                )}
                {pendingSubmissions.length > 5 && (
                  <div className="mt-4 text-center">
                    <Link href="/assignments">
                      <Button variant="link">Виж всички {pendingSubmissions.length} предавания</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Assignment Analytics */}
          <h2 className="text-2xl font-bold mt-8 mb-6 text-gray-800">Статистика на задачите</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Submission Rate */}
            <Card>
              <CardHeader>
                <CardTitle>Процент предадени</CardTitle>
                <CardDescription>Процент на предадените задачи от учениците</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={submissionPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {submissionPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Submission Status */}
            <Card>
              <CardHeader>
                <CardTitle>Преглед на активност</CardTitle>
                <CardDescription>Разпределение на навреме и закъснели предавания</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={lateSubmissionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" name="Submissions" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Classes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upcoming Classes */}
            <Card>
              <CardHeader>
                <CardTitle>Предстоящи часове</CardTitle>
                <CardDescription>Вашият график за следващите часове</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingClasses.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingClasses.map((cls, index) => (
                      <div key={index} className="flex items-center justify-between border-b last:border-b-0 pb-3 last:pb-0">
                        <div className="space-y-1">
                          <p className="font-medium">{cls.title}</p>
                          <p className="text-sm text-gray-500">{cls.className}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{cls.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Няма предстоящи часове</h3>
                    <p className="text-gray-500 mt-1">Нямате насрочени часове за днес.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Последна активност</CardTitle>
                <CardDescription>Последни действия във вашите курсове</CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <ScrollArea className="h-[220px]">
                    <div className="space-y-4">
                      {activities.map((activity, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="bg-blue-50 p-1.5 rounded-full">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <p className="font-medium text-sm">{activity.title}</p>
                            <p className="text-xs text-gray-500">{activity.description}</p>
                            <p className="text-xs text-gray-400">
                              {format(activity.date, "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500">Няма скорошна активност</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
