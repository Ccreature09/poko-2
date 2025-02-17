"use client";

import { useAuth } from "@/components/AuthProvider";
import AdminDashboard from "@/components/AdminDashboard";
import TeacherDashboard from "@/components/TeacherDashboard";
import StudentDashboard from "@/components/StudentDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teacher, Student } from "@/lib/interfaces";

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!user) {
    return <div>Please log in to view your dashboard.</div>;
  }

  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "teacher":
      return <TeacherDashboard user={user as Teacher & { schoolId: string }} />;
    case "student":
      return <StudentDashboard user={user as Student & { schoolId: string }} />;
    default:
      return <div>Invalid user role</div>;
  }
}
