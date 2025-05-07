"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import StudentDashboard from "@/components/functional/dashboards/StudentDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Student } from "@/lib/interfaces";

export default function StudentDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "student") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard`);
            break;
          case "teacher":
            router.push(`/teacher/dashboard`);
            break;
          case "parent":
            router.push(`/parent/dashboard`);
            break;
          default:
            router.push("/login");
        }
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!user || user.role !== "student") {
    return null;
  }

  return <StudentDashboard user={user as Student & { schoolId: string }} />;
}
