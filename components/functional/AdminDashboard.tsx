"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, User, Calendar, BookOpen, LucideIcon } from "lucide-react";
import AdminAttendanceStats from "./AdminAttendanceStats";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

// Define interfaces for our data structures
interface AdminDashboardProps {
  schoolId: string;
}

interface Stat {
  title: string;
  value: number;
  icon: LucideIcon; // Use LucideIcon type from lucide-react
}

export default function AdminDashboard({ schoolId }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "schools", schoolId, "users");
        const studentsSnap = await getDocs(
          query(usersRef, where("role", "==", "student"))
        );
        const teachersSnap = await getDocs(
          query(usersRef, where("role", "==", "teacher"))
        );
        const parentsSnap = await getDocs(
          query(usersRef, where("role", "==", "parent"))
        );
        const classesSnap = await getDocs(
          collection(db, "schools", schoolId, "classes")
        );
        const subjectsSnap = await getDocs(
          collection(db, "schools", schoolId, "subjects")
        );
        setStats([
          { title: "Ученици", value: studentsSnap.size, icon: Users },
          { title: "Учители", value: teachersSnap.size, icon: User },
          { title: "Родители", value: parentsSnap.size, icon: User },
          { title: "Класове", value: classesSnap.size, icon: Calendar },
          { title: "Предмети", value: subjectsSnap.size, icon: BookOpen },
        ]);
      } catch (error) {
        console.error("Error loading admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [schoolId]);

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  const quickLinks = [
    {
      title: "Управление на потребители",
      href: `/admin/users/`,
      icon: Users,
    },
    {
      title: "Управление на класове",
      href: `/admin/classes/`,
      icon: Calendar,
    },
    {
      title: "Управление на предмети",
      href: `/admin/subjects/`,
      icon: BookOpen,
    },
  ];

  const roleData = stats
    .filter((s) => ["Ученици", "Учители", "Родители"].includes(s.title))
    .map((s) => ({ name: s.title, value: s.value }));
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

  return (
    <div className="w-full">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-8 text-gray-800 text-center md:text-left">
        Администраторско табло
      </h1>

      {/* Stats Grid - Improved mobile layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="mx-auto w-full max-w-xs sm:max-w-none">
              <CardContent className="p-4 md:p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {stat.title}
                  </p>
                  <h3 className="text-2xl md:text-3xl font-bold mt-1">
                    {stat.value}
                  </h3>
                </div>
                <div className="bg-blue-50 p-2 md:p-3 rounded-full">
                  <Icon className="h-5 w-5 md:h-6 md:w-6 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Admin Panels - Improved for mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Quick Links */}
        <Card className="mx-auto w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-center md:text-left">
              Бързи връзки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
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
        <Card className="mx-auto w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-center md:text-left">
              Присъствия
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminAttendanceStats schoolId={schoolId} />
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card className="mx-auto w-full md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-center md:text-left">
              Распределение роли
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56 md:h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={roleData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label
                >
                  {roleData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
