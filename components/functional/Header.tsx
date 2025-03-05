"use client";

// Компонент за заглавната част на приложението - съдържа лого, навигация и потребителски контроли
import { useState, useEffect } from "react";
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
import { useRouter } from "next/navigation";

// Импорт на функции за работа с известия
import { getUserNotifications, getUnreadNotificationsCount, markNotificationAsRead, Notification } from "@/lib/notificationManagement";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function Header() {
  const { user } = useUser();
  const router = useRouter();
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Функция за излизане от потребителския акаунт
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // Извличане на името на училището
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

  // Извличане на известия
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.schoolId || !user?.userId) return;
      
      try {
        const [recentNotifications, count] = await Promise.all([
          getUserNotifications(user.schoolId, user.userId, { limit: 5 }),
          getUnreadNotificationsCount(user.schoolId, user.userId)
        ]);
        
        setNotifications(recentNotifications);
        setUnreadCount(count);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };
    
    // Първоначално зареждане и периодично обновяване на известията
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 60000); // Обновяване всяка минута
    return () => clearInterval(intervalId);
  }, [user?.schoolId, user?.userId]);
  
  // Обработка на кликване върху известие
  const handleNotificationClick = async (notificationId: string | undefined, read: boolean, link?: string) => {
    if (!notificationId || !user?.schoolId || !user?.userId || !read) return;

    try {
      // Маркиране на известието като прочетено
      await markNotificationAsRead(user.schoolId, user.userId, notificationId);
      setNotifications(prev => prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
    
    // Препращане към свързаната страница, ако има такава
    if (link) router.push(link);
  };

  return (
    <header className="bg-gradient-to-r from-blue-500 to-purple-600 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center py-4">
          {/* Лого и заглавие на приложението */}
          <Link href="/" className={`text-3xl font-bold text-white lg:ml-0 ml-12 ${!user ? 'mx-auto col-span-3 tracking-widest' : ''}`}>
            P O K O
          </Link>
          {user && (
            <>
              {/* Име на училището в средата на хедъра */}
              <Link href={`/dashboard/${user.schoolId}`} className="col-start-2 justify-self-center">
                <div className="text-center text-lg font-semibold text-white col-start-2 justify-self-center hidden sm:block">
                  {schoolName}
                </div>
              </Link>
              {/* Секция с бутони за потребителски функции */}
              <div className="flex items-center space-x-4 justify-self-end">
                {/* Падащо меню за известия */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white relative hidden sm:inline-flex">
                      <Bell className="h-5 w-5" />
                      {/* Бадж за показване на брой непрочетени известия */}
                      {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  {/* Съдържание на падащото меню с известия */}
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="font-medium text-sm px-4 py-2 border-b">
                      Уведомления
                    </div>
                    <ScrollArea className="h-[300px]">
                      {notifications.length > 0 ? (
                        <div className="py-2">
                          {/* Списък с известия */}
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                              onClick={() => handleNotificationClick(notification.id, notification.read, notification.link)}
                            >
                              <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-medium ${!notification.read ? 'text-blue-600' : 'text-gray-900'}`}>
                                  {notification.title}
                                </h4>
                                <span className="text-xs text-gray-500">
                                  {new Date(notification.createdAt.seconds * 1000).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-gray-500">
                          Няма уведомления
                        </div>
                      )}
                    </ScrollArea>
                    {/* Бутон за преглед на всички известия */}
                    {notifications.length > 0 && (
                      <div className="p-2 border-t text-center">
                        <Button variant="link" className="text-xs w-full">
                          Виж всички уведомления
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* Бутон за съобщения */}
                <Link href="/messages">
                  <Button variant="ghost" size="icon" className="text-white hidden sm:inline-flex">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </Link>
                
                {/* Падащо меню за потребителски функции */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2 text-white">
                      <User className="h-5 w-5" />
                      <span className="hidden sm:inline-block">{user?.lastName}</span>
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
