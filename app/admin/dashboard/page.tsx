"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import AdminDashboard from "@/components/functional/dashboards/AdminDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "admin") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "teacher":
            router.push(`/teacher/dashboard`);
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
  if (!user || user.role !== "admin") {
    return null;
  }

  return <AdminDashboard schoolId={user.schoolId} />;
}
