"use client";

import Link from "next/link";
import { useUser } from "../../contexts/UserContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, MessageSquare, LogOut, User } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export default function Header() {
  const { user } = useUser();
  const router = useRouter();
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const [schoolName, setSchoolName] = useState<string | null>(null);

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

  if (!user) return null;

  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold text-primary">
            POKO
          </Link>
          <div className="text-center text-lg font-semibold">{schoolName}</div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <MessageSquare className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>{user.lastName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile">Профил</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Изход
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
