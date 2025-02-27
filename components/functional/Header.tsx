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

  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center py-4">
          <Link href="/" className={`text-3xl font-bold text-white lg:ml-0 ml-12 ${!user ? 'mx-auto col-span-3 tracking-widest' : ''}`}>
            P O K O
          </Link>
          {user && (
            <>
            <Link href={`/dashboard/${user.schoolId}`} className="col-start-2 justify-self-center">
            <div className="text-center text-lg font-semibold text-white col-start-2 justify-self-center hidden sm:block">{schoolName}</div>

            </Link>
              <div className="flex items-center space-x-4 justify-self-end">
                <Button variant="ghost" size="icon" className="text-white hidden sm:inline-flex">
                  <Bell className="h-5 w-5" />
                </Button>
                <Link href={'/messages'}>
                <Button variant="ghost" size="icon" className="text-white hidden sm:inline-flex">
                  <MessageSquare className="h-5 w-5" />
                </Button></Link>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2 text-white">
                      <User className="h-5 w-5" />
                      <span className="hidden sm:inline-block">{user.lastName}</span>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
