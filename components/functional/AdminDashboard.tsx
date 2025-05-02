"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, User, Calendar, BookOpen } from "lucide-react";
import AdminAttendanceStats from "./AdminAttendanceStats";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { format } from "date-fns";
import { Icon } from "@radix-ui/react-select";
interface AdminDashboardProps {
  schoolId: string;
}

export default function AdminDashboard({ schoolId }: AdminDashboardProps) {
  const [stats, setStats] = useState<{ title: string; value: number; icon: any }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<{ id: string; type: string; title: string; description: string; date: Date }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "schools", schoolId, "users");
        const studentsSnap = await getDocs(query(usersRef, where("role", "==", "student")));
        const teachersSnap = await getDocs(query(usersRef, where("role", "==", "teacher")));
        const parentsSnap = await getDocs(query(usersRef, where("role", "==", "parent")));
        const classesSnap = await getDocs(collection(db, "schools", schoolId, "classes"));
        const subjectsSnap = await getDocs(collection(db, "schools", schoolId, "subjects"));
        setStats([
          { title: "Ученици", value: studentsSnap.size, icon: Users },
          { title: "Учители", value: teachersSnap.size, icon: User },
          { title: "Родители", value: parentsSnap.size, icon: User },
          { title: "Класове", value: classesSnap.size, icon: Calendar },
          { title: "Предмети", value: subjectsSnap.size, icon: BookOpen }
        ]);
      } catch (error) {
        console.error("Error loading admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchActivities = async () => {
      const activitiesRef = collection(db, "schools", schoolId, "activities");
      const q = query(activitiesRef, orderBy("createdAt", "desc"), limit(5));
      const snap = await getDocs(q);
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any), date: new Date((doc.data() as any).createdAt.seconds * 1000) })));
    };

    fetchStats();
    fetchActivities();
  }, [schoolId]);

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  const quickLinks = [
    { title: "Управление на потребители", href: `/admin/users/${schoolId}`, icon: Users },
    { title: "Управление на класове", href: `/admin/classes/${schoolId}`, icon: Calendar },
    { title: "Управление на предмети", href: `/admin/subjects/${schoolId}`, icon: BookOpen }
  ];

  const roleData = stats.filter(s => ["Ученици", "Учители", "Родители"].includes(s.title)).map(s => ({ name: s.title, value: s.value }));
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Администраторско табло</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx}>
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

      {/* Main Admin Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Бързи връзки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quickLinks.map((link, i) => {
                const Icon = link.icon;
                return (
                  <Link href={link.href} key={i}>
                    <Button
                      variant="outline"
                      className="w-full justify-between hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{link.title}</span>
                      </div>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Attendance Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Присъствия</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminAttendanceStats schoolId={schoolId} />
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Распределение роли</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {roleData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Последни дейности</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <ScrollArea className="h-48">
              <div className="space-y-4">
                {activities.map(act => (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className="bg-gray-100 p-1.5 rounded-full">
                      <Icon className="h-4 w-4 text-gray-500" /> {/* replace Icon based on act.type */}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{act.title}</p>
                      <p className="text-xs text-gray-500">{act.description}</p>
                      <p className="text-xs text-gray-400">{format(act.date, 'PP')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-gray-500">Няма последни дейности.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}