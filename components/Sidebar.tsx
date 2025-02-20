"use client";

import { useAuth } from "./AuthProvider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, BookOpen, FileText, BarChart2, Calendar } from "lucide-react";

export default function Sidebar() {
  const { user } = useAuth();

  if (!user) return null;

  const studentLinks = [
    { href: `/dashboard/${user.schoolId}`, label: "Dashboard", icon: Home },
    { href: "/courses", label: "Courses", icon: BookOpen },
    { href: "/assignments", label: "Assignments", icon: FileText },
    { href: "/report-card", label: "Report Card", icon: BarChart2 },
    { href: "/timetable", label: "Timetable", icon: Calendar },
    { href: "/statistics", label: "Statistics", icon: BarChart2 },
  ];

  const teacherLinks = [
    { href: `/dashboard/${user.schoolId}`, label: "Dashboard", icon: Home },
    { href: "/create-course", label: "Create Course", icon: BookOpen },
    { href: "/create-quiz", label: "Create Quiz", icon: FileText },
    { href: "/add-grades", label: "Add Grades", icon: BarChart2 },
  ];

  const adminLinks = [
    { href: `/dashboard/${user.schoolId}`, label: "Dashboard", icon: Home },
    { href: "/create-timetable", label: "Create Timetable", icon: Calendar },
    { href: "/manage-subjects", label: "Manage Subjects", icon: BookOpen },
  ];

  const links =
    user.role === "student"
      ? studentLinks
      : user.role === "teacher"
      ? teacherLinks
      : adminLinks;

  return (
    <aside className="bg-background border-r w-64 h-screen">
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="text-lg font-semibold mb-4">
            {user.firstName} {user.lastName}
            <div className="text-sm text-muted-foreground">{user.role}</div>
          </div>
          <nav className="space-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} passHref>
                <Button variant="ghost" className="w-full justify-start">
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </aside>
  );
}
