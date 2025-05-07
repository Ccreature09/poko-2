/**
 * Компонент за главната навигационна лента
 *
 * Предоставя:
 * - Лого и име на приложението
 * - Име на текущото училище
 * - Известия в реално време
 * - Меню за съобщения
 * - Потребителско меню с опции за профил и изход
 *
 * Адаптивен дизайн с различен изглед за мобилни и десктоп устройства
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "../../contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  MessageSquare,
  LogOut,
  User,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";



import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Sidebar from "./Sidebar";
import NotificationBadge from "../NotificationBadge";
import NotificationPopoverContent from "../NotificationPopoverContent";

export default function Header() {
  // Component state
  const { user } = useUser();
  const { logOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  // Initialize after browser load
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logOut();
      router.push("/");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // Load school name
  useEffect(() => {
    const fetchSchoolName = async (schoolId: string) => {
      console.log(schoolId);
      const schoolDoc = await getDoc(doc(db, "schools", schoolId));
      return schoolDoc.exists() ? schoolDoc.data()?.name : null;
    };

    if (user?.schoolId) {
      fetchSchoolName(user.schoolId).then(setSchoolName);
    }
  }, [user?.schoolId]);

  if (!mounted) return null;

  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center py-4">
          <div className="flex items-center gap-4">
            {user && (
              <div className="lg:hidden">
                <Sidebar />
              </div>
            )}
            <Link href="/" className={`${!user ? "mx-auto col-span-3" : ""}`}>
              <div className="flex items-center">
                <div className="flex flex-col items-center justify-center w-10 h-10 sm:hidden">
                  <span className="text-lg font-bold leading-none text-white">
                    PO
                  </span>
                  <span className="text-lg font-bold leading-none text-white">
                    KO
                  </span>
                </div>

                <div className="hidden sm:flex items-center">
                  <span className="text-xl font-bold text-white tracking-[0.5em]">
                    POKO
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {user && (
            <>
              {/* School name in center */}
              <Link
                href={
                  user && user.role
                    ? `/${user.role}/dashboard/${user.schoolId}`
                    : `/dashboard/${user.schoolId}`
                }
                className="justify-self-center"
              >
                <div className="text-center text-lg font-semibold text-white hidden sm:block">
                  {schoolName}
                </div>
              </Link>

              {/* Right section with user controls */}
              <div className="flex items-center space-x-4 justify-self-end">
                {/* Notifications dropdown */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white relative hidden sm:inline-flex"
                    >
                      <Bell className="h-5 w-5" />
                      {/* Use unreadCount from the NotificationContext */}
                      <NotificationBadge />
                    </Button>
                  </PopoverTrigger>
                  {/* Notification dropdown content */}
                  <PopoverContent className="w-96 p-0" align="end">
                    <NotificationPopoverContent />
                  </PopoverContent>
                </Popover>

                {/* Messages button */}
                <Link href="/messages">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hidden sm:inline-flex"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </Link>

                {/* User dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-2 text-white"
                    >
                      <User className="h-5 w-5" />
                      <span className="hidden sm:inline-block">
                        {user?.lastName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Профил</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Изход
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
