"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import ParentDashboard from "@/components/functional/dashboards/ParentDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function ParentDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "parent") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard`);
            break;
          case "teacher":
            router.push(`/teacher/dashboard`);
            break;
          case "student":
            router.push(`/student/dashboard`);
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
  if (!user || user.role !== "parent") {
    return null;
  }

  return <ParentDashboard />;
}
