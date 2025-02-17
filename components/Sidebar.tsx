"use client";

import { useAuth } from "./AuthProvider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, BookOpen, Calendar, BarChart2, FileText } from "lucide-react";

export default function Sidebar() {
  const { user } = useAuth();

  if (!user) return null;

  const links = [
    { href: "/dashboard", label: "Main Page", icon: Home },
    { href: "/report-card", label: "Report Card", icon: FileText },
    { href: "/courses", label: "Courses", icon: BookOpen },
    { href: "/assignments", label: "Assignments", icon: FileText },
    { href: "/statistics", label: "Statistics", icon: BarChart2 },
    { href: "/calendar", label: "Calendar", icon: Calendar },
  ];

  return (
    <aside className="bg-gray-100 w-64 flex-shrink-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="text-lg font-semibold mb-4">
            {user.firstName} {user.lastName}
            <div className="text-sm text-gray-500">Grade </div>
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
