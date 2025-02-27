"use client";

import { useEffect, useState } from "react";
import type { Student, Assignment, AssignmentSubmission } from "@/lib/interfaces";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, Calendar, GraduationCap, Bell, Clock, FileText, CheckCircle, XCircle } from "lucide-react";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "./Sidebar";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isPast } from "date-fns";
import { getStudentAssignments, getStudentSubmission } from "@/lib/assignmentManagement";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

interface AssignmentWithMeta extends Assignment {
  submission?: AssignmentSubmission;
}

export default function StudentDashboard({
  user,
}: {
  user: Student & { schoolId: string };
}) {
  const [stats, setStats] = useState([
    { title: "Записани предмети", value: 0, icon: BookOpen },
    { title: "Предстоящи класове", value: 0, icon: Calendar },
    { title: "Последни оценки", value: "0%", icon: GraduationCap },
    { title: "Нови съобщения", value: 0, icon: Bell },
  ]);

  const [upcomingAssignments, setUpcomingAssignments] = useState<AssignmentWithMeta[]>([]);
  const [pastAssignments, setPastAssignments] = useState<AssignmentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentStats, setAssignmentStats] = useState({
    completed: 0,
    pending: 0,
    late: 0,
    graded: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user.schoolId || !user.userId) {
        console.error("Липсва schoolId или userId");
        return;
      }

      setLoading(true);

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
            title: "Записани предмети",
            value: enrolledSubjectsCount.data().count,
            icon: BookOpen,
          },
          {
            title: "Предстоящи класове",
            value: upcomingClassesCount.data().count,
            icon: Calendar,
          },
          {
            title: "Последни оценки",
            value: recentGrades,
            icon: GraduationCap,
          },
          {
            title: "Нови съобщения",
            value: newMessagesCount.data().count,
            icon: Bell,
          },
        ]);

        // Fetch all assignments for the student
        const assignments = await getStudentAssignments(user.schoolId, user.userId);
        
        // Split into upcoming and past assignments
        const now = new Date();
        const upcoming = [];
        const past = [];
        let completed = 0;
        let pending = 0;
        let graded = 0;
        let late = 0;

        for (const assignment of assignments) {
          // Create a copy of the assignment object for easier handling
          const assignmentWithMeta: AssignmentWithMeta = { ...assignment };
          const dueDate = new Date(assignment.dueDate.seconds * 1000);
          
          // Fetch submission status for this assignment
          const submission = await getStudentSubmission(
            user.schoolId,
            assignment.assignmentId,
            user.userId
          );
          
          if (submission) {
            assignmentWithMeta.submission = submission;
            
            if (submission.status === "graded") {
              graded++;
            }
            
            if (dueDate < now && submission.submittedAt.seconds > assignment.dueDate.seconds) {
              late++;
            }
            
            completed++;
          } else if (dueDate < now) {
            late++;
          } else {
            pending++;
          }
          
          // Categorize by due date
          if (dueDate > now) {
            upcoming.push(assignmentWithMeta);
          } else {
            past.push(assignmentWithMeta);
          }
        }
        
        // Sort upcoming by closest due date first
        upcoming.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds);
        
        // Sort past by most recently due first
        past.sort((a, b) => b.dueDate.seconds - a.dueDate.seconds);
        
        setUpcomingAssignments(upcoming);
        setPastAssignments(past);
        setAssignmentStats({
          completed,
          pending,
          late,
          graded
        });

      } catch (error) {
        console.error("Error fetching student dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user.schoolId, user.userId]);
  
  // Format data for charts
  const submissionStatusData = [
    { name: "Submitted", value: assignmentStats.completed },
    { name: "Pending", value: assignmentStats.pending },
  ];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
  
  const getTimeRemaining = (dueDate: Date) => {
    const now = new Date();
    const diffTime = Math.abs(dueDate.getTime() - now.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} ${diffDays !== 1 ? 'дни' : 'ден'} остават`;
    } else {
      return `${diffHours} ${diffHours !== 1 ? 'часа' : 'час'} остават`;
    }
  };
  
  // Format submission status badge
  const getSubmissionStatus = (assignment: AssignmentWithMeta) => {
    if (!assignment.submission) {
      const dueDate = new Date(assignment.dueDate.seconds * 1000);
      if (isPast(dueDate)) {
        return <Badge variant="destructive">Липсва</Badge>;
      }
      return <Badge variant="outline">Не е предадено</Badge>;
    }
    
    switch (assignment.submission.status) {
      case "submitted":
        return <Badge variant="secondary">Предадено</Badge>;
      case "graded":
        return <Badge variant="secondary" className="bg-green-500 text-white hover:bg-green-600">Оценено</Badge>;
      case "late":
        return <Badge variant="destructive">Закъсняло</Badge>;
      case "resubmitted":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Преработено</Badge>;
      default:
        return <Badge variant="outline">Неизвестно</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Ученическо табло</h1>
            <div className="flex justify-center items-center h-64">
              <p>Зареждане...</p>
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
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Ученическо табло</h1>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="overflow-hidden">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Upcoming Assignments */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Предстоящи задачи</CardTitle>
                <CardDescription>Задачи с наближаващ краен срок</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingAssignments.length > 0 ? (
                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-4">
                      {upcomingAssignments.map((assignment) => {
                        const dueDate = new Date(assignment.dueDate.seconds * 1000);
                        return (
                          <div key={assignment.assignmentId} className="flex items-start justify-between p-4 border rounded-md">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <Link href={`/assignments/${assignment.assignmentId}`}>
                                  <span className="font-medium hover:text-blue-600 hover:underline">
                                    {assignment.title}
                                  </span>
                                </Link>
                              </div>
                              <p className="text-sm text-gray-500">
                                {assignment.subjectName} • Краен срок {format(dueDate, "MMM d, yyyy")}
                              </p>
                              <div className="flex items-center mt-1">
                                <Clock className="h-3 w-3 text-amber-500 mr-1" />
                                <span className="text-xs font-medium text-amber-500">
                                  {getTimeRemaining(dueDate)}
                                </span>
                              </div>
                            </div>
                            <Link href={`/assignments/${assignment.assignmentId}`}>
                              <Button size="sm" variant={assignment.submission ? "outline" : "default"}>
                                {assignment.submission ? "Преглед" : "Предай"}
                              </Button>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Всичко е наред!</h3>
                    <p className="text-gray-500 mt-1">Нямате предстоящи задачи.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Assignment Status */}
            <Card>
              <CardHeader>
                <CardTitle>Статус на задачите</CardTitle>
                <CardDescription>Преглед на вашите задачи</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Завършени:</span>
                    <span className="font-medium">{assignmentStats.completed}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Чакащи:</span>
                    <span className="font-medium">{assignmentStats.pending}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Просрочени:</span>
                    <span className="font-medium">{assignmentStats.late}</span>
                  </div>
                </div>

                <div className="pt-4 h-32">
                  {assignmentStats.completed + assignmentStats.pending > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={submissionStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={40}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {submissionStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  </div>

                <div className="flex justify-center mt-4">
                  <Link href="/assignments">
                    <Button variant="outline" size="sm">View All Assignments</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Past Assignments and Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Past Assignments */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Последни предавания</CardTitle>
                <CardDescription>Вашите последни предадени задачи</CardDescription>
              </CardHeader>
              <CardContent>
                {pastAssignments.length > 0 ? (
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      {pastAssignments.slice(0, 5).map((assignment, index) => {
                        const dueDate = new Date(assignment.dueDate.seconds * 1000);
                        return (
                          <div key={index} className="flex items-start justify-between p-4 border rounded-md hover:bg-gray-50 transition-colors">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <Link href={`/assignments/${assignment.assignmentId}`}>
                                  <span className="font-medium text-blue-600 hover:underline">
                                    {assignment.title}
                                  </span>
                                </Link>
                                {getSubmissionStatus(assignment)}
                              </div>
                              <p className="text-sm text-gray-500">
                                {assignment.subjectName} • Краен срок {format(dueDate, "MMM d, yyyy")}
                              </p>
                              {assignment.submission && assignment.submission.feedback && assignment.submission.feedback.grade && (
                                <div className="flex items-center mt-1">
                                  <GraduationCap className="h-3 w-3 text-green-500 mr-1" />
                                  <span className="text-xs font-medium text-green-500">
                                    Оценка: {assignment.submission.feedback.grade}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Link href={`/assignments/${assignment.assignmentId}`}>
                              <Button size="sm" variant="outline">
                                {assignment.submission?.status === "graded" ? "Виж оценка" : (assignment.submission ? "Преглед" : "Закъсняло предаване")}
                              </Button>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Няма минали задачи</h3>
                    <p className="text-gray-500 mt-1">Все още нямате минали задачи.</p>
                  </div>
                )}
                {pastAssignments.length > 5 && (
                  <div className="mt-4 text-center">
                    <Link href="/assignments">
                      <Button variant="link">Виж всички {pastAssignments.length} минали задачи</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Представяне</CardTitle>
                <CardDescription>Статистика за предаване на задачи</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={[
                      { name: "Навреме", value: assignmentStats.completed - assignmentStats.late },
                      { name: "Закъснели", value: assignmentStats.late }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" name="Предавания" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-xs text-center text-gray-500">
                  {assignmentStats.completed > 0 ? (
                    <p>
                      Завършили сте {assignmentStats.completed} задачи,{" "}
                      {assignmentStats.late > 0 ? `от които ${assignmentStats.late} предадени със закъснение.` : "всички навреме!"}
                    </p>
                  ) : (
                    <p>Все още няма данни за задачи.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
