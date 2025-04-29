"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import TeacherDashboard from "@/components/functional/TeacherDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Teacher } from "@/lib/interfaces";

export default function TeacherDashboardPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId || "";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "teacher") {
        // Redirect to role-specific dashboard
        switch (user.role) {
          case "admin":
            router.push(`/admin/dashboard/${user.schoolId}`);
            break;
          case "student":
            router.push(`/student/dashboard/${user.schoolId}`);
            break;
          case "parent":
            router.push(`/parent/dashboard/${user.schoolId}`);
            break;
          default:
            router.push("/login");
        }
      } else if (user.schoolId !== schoolId) {
        router.push("/login");
      }
    }
  }, [user, loading, schoolId, router]);

  if (loading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!user || user.schoolId !== schoolId || user.role !== "teacher") {
    return null;
  }

  return <TeacherDashboard user={user as Teacher & { schoolId: string }} />;
}