"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import TeacherDashboard from "@/components/functional/dashboards/TeacherDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teacher } from "@/lib/interfaces";

export default function TeacherDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "teacher") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard`);
            break;
          case "student":
            router.push(`/student/dashboard`);
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

  if (!user || user.role !== "teacher") {
    return null;
  }

  return <TeacherDashboard user={user as Teacher & { schoolId: string }} />;
}
