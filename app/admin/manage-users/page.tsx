"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/functional/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Filter, Plus, MoreHorizontal, UserPlus, UserX, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";

// Define user interface
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: Date | null;
  [key: string]: any; // For any other properties
}

export default function ManageUsers() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("students");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    if (!user?.schoolId) return;
    
    setLoading(true);
    try {
      const usersRef = collection(db, "schools", user.schoolId, "users");
      const q = query(usersRef, orderBy("lastName"));
      const snapshot = await getDocs(q);
      
      const fetchedUsers = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          role: data.role || "",
          isActive: data.isActive || false,
          lastLogin: data.lastLogin ? data.lastLogin.toDate() : null,
          ...data
        };
      });
      
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при зареждането на потребителите.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      // Filter by role if specified
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      
      // Filter by status if specified
      if (statusFilter === "active" && !user.isActive) return false;
      if (statusFilter === "inactive" && user.isActive) return false;
      
      // Filter by search query
      if (searchQuery) {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email ? user.email.toLowerCase() : "";
        const query = searchQuery.toLowerCase();
        
        return fullName.includes(query) || email.includes(query);
      }
      
      return true;
    });
  };

  // Format role names
  const getRoleName = (role: string) => {
    const roleNames: Record<string, string> = {
      admin: "Администратор",
      teacher: "Учител",
      student: "Ученик",
      parent: "Родител"
    };
    return roleNames[role] || role;
  };

  const filteredUsers = getFilteredUsers();

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Достъпът е отказан</CardTitle>
            <CardDescription>Нямате достатъчно права за достъп до тази страница.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Тази страница е достъпна само за администратори на системата.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto pb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800">Управление на потребители</h1>
              <p className="text-gray-600">Добавяне, редактиране и управление на потребители в системата</p>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <TabsList>
                <TabsTrigger value="students" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Ученици
                </TabsTrigger>
                <TabsTrigger value="teachers" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Учители
                </TabsTrigger>
                <TabsTrigger value="parents" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Родители
                </TabsTrigger>
                <TabsTrigger value="admins" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Администратори
                </TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    placeholder="Търсене по име или имейл"
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всички</SelectItem>
                    <SelectItem value="active">Активни</SelectItem>
                    <SelectItem value="inactive">Неактивни</SelectItem>
                  </SelectContent>
                </Select>
                
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Покана
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Поканете нови потребители</DialogTitle>
                      <DialogDescription>
                        Изпратете покана по имейл за нови потребители да се присъединят към системата.
                      </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Имейл адрес</Label>
                        <Input id="email" placeholder="user@example.com" type="email" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Роля</Label>
                        <Select defaultValue="student">
                          <SelectTrigger id="role">
                            <SelectValue placeholder="Изберете роля" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Ученик</SelectItem>
                            <SelectItem value="teacher">Учител</SelectItem>
                            <SelectItem value="parent">Родител</SelectItem>
                            <SelectItem value="admin">Администратор</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="class">Клас (за ученици)</Label>
                        <Select defaultValue="none">
                          <SelectTrigger id="class">
                            <SelectValue placeholder="Изберете клас" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Не е приложимо</SelectItem>
                            <SelectItem value="1">1 клас</SelectItem>
                            <SelectItem value="2">2 клас</SelectItem>
                            <SelectItem value="3">3 клас</SelectItem>
                            {/* More classes */}
                          </SelectContent>
                        </Select>
                      </div>
                    </form>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                        Отказ
                      </Button>
                      <Button>Изпращане на покана</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            <Card className="shadow-sm">
              <CardHeader className="p-4 md:p-6 border-b bg-white">
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {activeTab === "students" && "Ученици"}
                    {activeTab === "teachers" && "Учители"}
                    {activeTab === "parents" && "Родители"}
                    {activeTab === "admins" && "Администратори"}
                  </CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {filteredUsers.length} потребители
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead>Име</TableHead>
                        <TableHead>Имейл</TableHead>
                        <TableHead>Роля</TableHead>
                        <TableHead>Последно влизане</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array(5).fill(0).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={6}>
                              <div className="flex items-center space-x-4">
                                <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
                                <div className="space-y-2 flex-1">
                                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                                  <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium">
                                  {user.firstName?.charAt(0) || ''}
                                  {user.lastName?.charAt(0) || ''}
                                </div>
                                <div>
                                  <div className="font-medium">{user.firstName} {user.lastName}</div>
                                  <div className="text-sm text-gray-500">ID: {user.id.substring(0, 8)}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{user.email || 'Не е зададен'}</TableCell>
                            <TableCell>{getRoleName(user.role)}</TableCell>
                            <TableCell>
                              {user.lastLogin 
                                ? new Date(user.lastLogin).toLocaleDateString() 
                                : 'Никога'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.isActive ? "default" : "secondary"} className={user.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>
                                {user.isActive ? 'Активен' : 'Неактивен'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Преглед на профил</DropdownMenuItem>
                                  <DropdownMenuItem>Редактиране</DropdownMenuItem>
                                  <DropdownMenuItem>Промяна на роля</DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600">
                                    {user.isActive ? 'Деактивиране' : 'Активиране'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10">
                            <div className="flex flex-col items-center justify-center text-gray-500">
                              <Users className="h-12 w-12 mb-3 text-gray-300" />
                              <h3 className="text-lg font-medium">Няма намерени потребители</h3>
                              <p className="max-w-sm mt-1 mb-4">
                                {searchQuery || roleFilter !== "all" || statusFilter !== "all" 
                                  ? 'Променете критериите за търсене или филтрите, за да видите повече резултати.' 
                                  : 'Все още няма добавени потребители от този тип в системата.'}
                              </p>
                              <Button onClick={() => setShowInviteDialog(true)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Добавяне на нов потребител
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>
    </div>
  )
}