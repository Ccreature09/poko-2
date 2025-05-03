/**
 * Компонент за табло на учителя
 *
 * Основен компонент за визуализация на учителската дейност:
 * - Обобщена статистика (класове, предмети, часове, чакащи оценки)
 * - Бързи връзки към често използвани функции
 * - Преглед на чакащи предавания от ученици
 * - Графики за анализ на предаванията
 * - Предстоящи часове и последна активност
 *
 * Функционалности:
 * - Автоматично обновяване на статистиката
 * - Интерактивни графики за анализ
 * - Бързи действия за оценяване
 * - Проследяване на закъснели предавания
 * - Визуализация на график за часове
 */

"use client";

import { useEffect, useState } from "react";
import type {
  Teacher,
  Assignment,
  AssignmentSubmission,
} from "@/lib/interfaces";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Users,
  BookOpen,
  Calendar,
  Bell,
  Clock,
  FileEdit,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import {
  collection,
  query,
  where,
  doc,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./Sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  getAssignmentStats,
  getPendingSubmissions,
} from "@/lib/assignmentManagement";
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
  Cell,
} from "recharts";
import { getClassesTaughtByTeacher } from "@/lib/timetableManagement";

interface UpcomingClass {
  id: string;
  title: string;
  time: string;
  className: string;
  day: string;
  period: number;
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
    lateSubmissions: 0,
  });
  const [pendingSubmissions, setPendingSubmissions] = useState<
    PendingSubmission[]
  >([]);
  const [loading, setLoading] = useState(true);

  const quickLinks = [
    {
      title: "Създаване на задание",
      href: "/teacher/assignments/create",
      icon: FileText,
    },
    {
      title: "Създаване на тест",
      href: "/teacher/quizzes/create",
      icon: FileEdit,
    },
    {
      title: "Отбелязване на присъствия",
      href: "/teacher/attendance",
      icon: Users,
    },
    {
      title: "Отзиви за ученици",
      href: "/teacher/feedback",
      icon: MessageSquare,
    },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.schoolId || !user.userId) {
        console.error("Липсва schoolId или userId");
        return;
      }

      setLoading(true);

      const schoolRef = doc(db, "schools", user.schoolId);
      const activitiesRef = collection(schoolRef, "activities");

      try {
        // Fetch assignment stats
        const assignmentStatsData = await getAssignmentStats(
          user.schoolId,
          user.userId
        );
        setAssignmentStats(assignmentStatsData);

        // Fetch pending submissions (awaiting grading)
        const pendingSubs = await getPendingSubmissions(
          user.schoolId,
          user.userId
        );
        setPendingSubmissions(pendingSubs);

        // Fetch classes taught by the teacher using the new function
        const classesTaught = await getClassesTaughtByTeacher(
          user.schoolId,
          user.userId
        );

        // Extract unique classes and subjects for stats
        const uniqueClasses = new Set(classesTaught.map((cls) => cls.classId));
        const uniqueSubjects = new Set(
          classesTaught.map((cls) => cls.subjectId)
        );

        // Get upcoming classes for display
        const upcomingClassesData = classesTaught
          .sort((a, b) => {
            // Sort by day of week (converting to numbers)
            const daysOfWeek = [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ];
            const dayA = daysOfWeek.indexOf(a.day);
            const dayB = daysOfWeek.indexOf(b.day);
            if (dayA !== dayB) return dayA - dayB;

            // Then by period
            return a.period - b.period;
          })
          .slice(0, 5)
          .map((cls) => ({
            id: `${cls.classId}-${cls.subjectId}-${cls.day}-${cls.period}`,
            title: cls.subjectName,
            className: cls.className,
            time: `${cls.startTime} - ${cls.endTime}`,
            day: cls.day,
            period: cls.period,
          }));

        setUpcomingClasses(upcomingClassesData);

        // Update stats with the new data
        setStats([
          {
            title: "Управлявани класове",
            value: uniqueClasses.size,
            icon: Users,
          },
          {
            title: "Преподавани предмети",
            value: uniqueSubjects.size,
            icon: BookOpen,
          },
          {
            title: "Предстоящи часове",
            value: classesTaught.length,
            icon: Calendar,
          },
          {
            title: "Очакващи проверка",
            value: assignmentStatsData.pendingGrading,
            icon: Bell,
          },
        ]);

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
    { name: "Missing", value: 100 - assignmentStats.submissionRate },
  ];

  const lateSubmissionData = [
    {
      name: "On Time",
      value: pendingSubmissions.filter(
        (ps) => ps.submission.status === "submitted"
      ).length,
    },
    {
      name: "Late",
      value: pendingSubmissions.filter((ps) => ps.submission.status === "late")
        .length,
    },
    {
      name: "Resubmitted",
      value: pendingSubmissions.filter(
        (ps) => ps.submission.status === "resubmitted"
      ).length,
    },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">
              Учителско табло
            </h1>
            <div className="flex justify-center items-center h-64">
              <p>Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Учителско табло
          </h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index}>
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {stat.title}
                      </p>
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
                <CardDescription>
                  Преки пътища към често използвани действия
                </CardDescription>
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
                <CardDescription>
                  Предавания очакващи вашата оценка
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingSubmissions.length > 0 ? (
                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-4">
                      {pendingSubmissions.slice(0, 5).map((item, index) => (
                        <div
                          key={index}
                          className="flex items-start justify-between p-4 border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <Link
                                href={`/teacher/assignments/${item.assignment.assignmentId}`}
                              >
                                <span className="font-medium text-blue-600 hover:underline">
                                  {item.assignment.title}
                                </span>
                              </Link>
                              <Badge
                                variant={
                                  item.submission.status === "submitted"
                                    ? "outline"
                                    : item.submission.status === "late"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {item.submission.status === "submitted"
                                  ? "Ново"
                                  : item.submission.status === "late"
                                  ? "Закъсняло"
                                  : "Преработено"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              Предадено от{" "}
                              <span className="font-medium">
                                {item.submission.studentName}
                              </span>{" "}
                              на{" "}
                              {format(
                                new Date(
                                  item.submission.submittedAt.seconds * 1000
                                ),
                                "MMM d, yyyy"
                              )}
                            </p>
                          </div>
                          <Link
                            href={`/teacher/assignments/${item.assignment.assignmentId}`}
                          >
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
                    <h3 className="text-lg font-medium text-gray-900">
                      Всички предавания са оценени!
                    </h3>
                    <p className="text-gray-500 mt-1">
                      Няма чакащи предавания за оценяване.
                    </p>
                  </div>
                )}
                {pendingSubmissions.length > 5 && (
                  <div className="mt-4 text-center">
                    <Link href="/teacher/assignments">
                      <Button variant="link">
                        Виж всички {pendingSubmissions.length} предавания
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Assignment Analytics */}
          <h2 className="text-2xl font-bold mt-8 mb-6 text-gray-800">
            Статистика на заданията
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Submission Rate */}
            <Card>
              <CardHeader>
                <CardTitle>Процент предадени</CardTitle>
                <CardDescription>
                  Процент на предадените задания от учениците
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div style={{ width: "100%", height: 300 }}>
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
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {submissionPieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
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
                <CardDescription>
                  Разпределение на навреме и закъснели предавания
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div style={{ width: "100%", height: 300 }}>
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
                <CardDescription>Вашият график за часовете</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingClasses.length > 0 ? (
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-4">
                      {upcomingClasses.map((cls, index) => (
                        <div
                          key={index}
                          className="flex items-start p-3 border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <div className="bg-blue-50 p-2 rounded-full mr-3">
                            <Calendar className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{cls.title}</p>
                              <Badge variant="outline">{cls.day}</Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              Клас: {cls.className}
                            </p>
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>
                                Час {cls.period}: {cls.time}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* View All Classes Button */}
                    <div className="mt-4 text-center">
                      <Link href="/teacher/timetable">
                        <Button variant="link" className="gap-1">
                          <span>Виж пълния график</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Няма часове
                    </h3>
                    <p className="text-gray-500 mt-1">
                      Не са намерени часове в програмата.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Последна активност</CardTitle>
                <CardDescription>
                  Последни действия във вашите курсове
                </CardDescription>
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
                            <p className="font-medium text-sm">
                              {activity.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {activity.description}
                            </p>
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
