/**
 * Административно табло компонент
 * 
 * Този компонент представлява основното административно табло за училищната система.
 * Предоставя следните функционалности:
 * - Преглед на обща статистика (брой ученици, учители, класове, задания)
 * - Управление на потребители (създаване, изтриване, преглед)
 * - Статистика за заданията и предаванията
 * - Масово създаване на потребители чрез Excel файл
 * - Преглед на най-активните учители
 * - Списък с последни задания
 */

"use client";

import type React from "react";
import { useState, useEffect} from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bulkCreateUsers,
  exportLoginCredentials,
  getAllUsers,
  deleteUser,
  type BulkUserData,
  deleteUserAccount,
  getAllClasses
} from "@/lib/schoolManagement";
import * as XLSX from "xlsx";
import Sidebar from "./Sidebar";
import { 
  Users, 
  BookOpen, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  ChevronRight,
  FileCheck 
} from "lucide-react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getAssignmentStats,
  getAssignments
} from "@/lib/assignmentManagement";
import {
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { toast } from "@/hooks/use-toast";
import type { UserBase, Assignment } from "@/lib/interfaces";

interface User extends UserBase {
  id: string;
}

export default function AdminDashboard() {
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [userOrdering, setUserOrdering] = useState("role");
  const [userDirection, setUserDirection] = useState("asc");

  const [schoolStats, setSchoolStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalAssignments: 0
  });
  const [assignmentStats, setAssignmentStats] = useState({
    totalAssignments: 0,
    pendingGrading: 0,
    submissionRate: 0,
    lateSubmissions: 0
  });
  const [recentAssignments, setRecentAssignments] = useState<Assignment[]>([]);
  const [teacherStats, setTeacherStats] = useState<{
    teacherId: string;
    teacherName: string;
    assignmentCount: number;
    pendingGradingCount: number;
    avgSubmissionRate: number;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId) return;

    const fetchUsers = async () => {
      const fetchedUsers = await getAllUsers(user.schoolId);
      const typedUsers = fetchedUsers as (UserBase & { id: string })[];
      setUsers(typedUsers);

      // Update school stats
      // Актуализиране на статистиките за училището
      const students = typedUsers.filter(u => u.role === "student").length;
      const teachers = typedUsers.filter(u => u.role === "teacher").length;
      
      setSchoolStats(prev => ({
        ...prev,
        totalStudents: students,
        totalTeachers: teachers
      }));
    };

    fetchUsers();
  }, [user?.schoolId]);

  // Извличане на статистиките и данните за задания
  useEffect(() => {
    const fetchAssignmentData = async () => {
      if (!user?.schoolId) return;
      
      setLoading(true);
      try {
        // Вземане на общите статистики за заданията
        const stats = await getAssignmentStats(user.schoolId);
        setAssignmentStats(stats);
        
        // Вземане на броя на класовете
        const classes = await getAllClasses(user.schoolId);
        setSchoolStats(prev => ({
          ...prev,
          totalClasses: classes.length,
          totalAssignments: stats.totalAssignments
        }));

        // Вземане на последните задания
        const assignments = await getAssignments(user.schoolId, { 
          status: "active" 
        });
        
        // Сортиране по най-скоро създадените
        assignments.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
        setRecentAssignments(assignments.slice(0, 5));
        
        // Вземане на статистиките за учителите
        // Вземане на уникалните учители, които са създали задание
        const teacherMap = new Map();
        assignments.forEach(assignment => {
          if (!teacherMap.has(assignment.teacherId)) {
            teacherMap.set(assignment.teacherId, {
              teacherId: assignment.teacherId,
              teacherName: assignment.teacherName,
              assignments: [],
              pendingGradingCount: 0,
              submissionRates: []
            });
          }
          
          teacherMap.get(assignment.teacherId).assignments.push(assignment);
        });
        
        // Изчисляване на статистиките за всеки учител
        const teacherStatsArray = Array.from(teacherMap.values()).map(teacher => {
          // За всеки учител, изчисляване на статистиките за заданията му
          const teacherStats = {
            teacherId: teacher.teacherId,
            teacherName: teacher.teacherName,
            assignmentCount: teacher.assignments.length,
            pendingGradingCount: 0,  
            avgSubmissionRate: 0  
          };
          
          return teacherStats;
        });
        
        // Сортиране по брой задания
        teacherStatsArray.sort((a, b) => b.assignmentCount - a.assignmentCount);
        setTeacherStats(teacherStatsArray.slice(0, 5));
        
      } catch (error) {
        console.error("Error fetching assignment data:", error);
        toast({
          title: "Error",
          description: "Failed to fetch assignment data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssignmentData();
  }, [user?.schoolId]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  // Форматиране на данните за графиката правилно - уверете се, че стойностите са между 0-100%
  const normalizedSubmissionRate = Math.min(100, Math.max(0, assignmentStats.submissionRate));
  const submissionRateData = [
    { name: "Предадени", value: normalizedSubmissionRate },
    { name: "Непредадени", value: 100 - normalizedSubmissionRate }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file || !user?.schoolId) return;

    try {
      setBulkCreateLoading(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: BulkUserData[] = XLSX.utils.sheet_to_json(sheet);

        console.log("Processing data:", jsonData);

        const result = await bulkCreateUsers(
          jsonData,
          user.schoolId,
          "School Name"
        );

        // Създаване на текстов файл за изтегляне с идентификационни данни
        const credentialsText = exportLoginCredentials(result);
        const blob = new Blob([credentialsText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "credentials.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Обновяване на списъка с потребители
        const fetchedUsers = await getAllUsers(user.schoolId);
        setUsers(fetchedUsers as User[]);
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Error processing file:", error);
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!user?.schoolId) return;

    // Намиране на потребителя, който се опитваме да изтрием
    const userToDelete = users.find(u => u.id === userId);

    // Предотвратяване на изтриването на администраторски потребители
    if (userToDelete?.role === "admin") {
      toast({
        title: "Операцията отказана",
        description: "Администраторите не могат да бъдат изтрити от системата.",
        variant: "destructive"
      });
      return;
    }

    try {
      await deleteUser(user.schoolId, userId);
      await deleteUserAccount(userId);
      // Това може да се провали, ако потребителят не е удостоверен - игнорирайте тази грешка
      const fetchedUsers = await getAllUsers(user.schoolId);
      setUsers(fetchedUsers as User[]);
      toast({
        title: "Успех",
        description: "Потребителят беше изтрит успешно."
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при изтриване на потребителя.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Админ табло</h1>
            <div className="flex justify-center items-center h-64">
              <p>Зареждане...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Админ табло</h1>
          
          <div className="space-y-6">
            {/* Обобщени статистики */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Ученици</p>
                    <h3 className="text-3xl font-bold mt-1">{schoolStats.totalStudents}</h3>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-full">
                    <Users className="h-6 w-6 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Учители</p>
                    <h3 className="text-3xl font-bold mt-1">{schoolStats.totalTeachers}</h3>
                  </div>
                  <div className="bg-green-50 p-3 rounded-full">
                    <BookOpen className="h-6 w-6 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Класове</p>
                    <h3 className="text-3xl font-bold mt-1">{schoolStats.totalClasses}</h3>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-full">
                    <Calendar className="h-6 w-6 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Задания</p>
                    <h3 className="text-3xl font-bold mt-1">{schoolStats.totalAssignments}</h3>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-full">
                    <FileText className="h-6 w-6 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Останалата част от съдържанието на таблото */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Tabs defaultValue="overview" className="space-y-4 lg:col-span-2">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Статистики</TabsTrigger>
                  <TabsTrigger value="assignments">Задания</TabsTrigger>
                  <TabsTrigger value="users">Потребители</TabsTrigger>
                </TabsList>
                
                {/* Раздел "Общ преглед" */}
                <TabsContent value="overview" className="space-y-6">
                  {/* Статистики за заданията */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle>Статистика на предаванията</CardTitle>
                        <CardDescription>Процент на предадени задания в цялото училище</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 300 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={submissionRateData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {submissionRateData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="bg-blue-50 rounded-md p-4">
                            <p className="text-sm text-gray-500">Задания</p>
                            <h4 className="text-2xl font-bold">{assignmentStats.totalAssignments}</h4>
                          </div>
                          <div className="bg-amber-50 rounded-md p-4">
                            <p className="text-sm text-gray-500">Чакащи оценяване</p>
                            <h4 className="text-2xl font-bold">{assignmentStats.pendingGrading}</h4>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Топ учители</CardTitle>
                        <CardDescription>По брой задания</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-4">
                            {teacherStats.map((teacher, index) => (
                              <div key={index} className="flex items-center justify-between border-b pb-3">
                                <div>
                                  <p className="font-medium">{teacher.teacherName}</p>
                                  <p className="text-sm text-gray-500">
                                    {teacher.assignmentCount} задан {teacher.assignmentCount !== 1 ? 'ия' : 'е'}
                                  </p>
                                </div>
                                <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">
                                  <span className="text-sm font-medium">{index + 1}</span>
                                </div>
                              </div>
                            ))}
                            {teacherStats.length === 0 && (
                              <div className="text-center py-4 text-gray-500">
                                Няма налични данни за учители
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Последни задания */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Последни задания</CardTitle>
                      <CardDescription>Най-нови задания създадени във всички класове</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {recentAssignments.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Заглавие</TableHead>
                              <TableHead>Предмет</TableHead>
                              <TableHead>Учител</TableHead>
                              <TableHead>Краен срок</TableHead>
                              <TableHead className="text-right">Действие</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recentAssignments.map((assignment, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{assignment.title}</TableCell>
                                <TableCell>{assignment.subjectName}</TableCell>
                                <TableCell>{assignment.teacherName}</TableCell>
                                <TableCell>
                                  {new Date(assignment.dueDate.seconds * 1000).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Link href={`/assignments/${assignment.assignmentId}`}>
                                    <Button variant="link" size="sm">Преглед</Button>
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-6">
                          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">Все още няма създадени задания</p>
                        </div>
                      )}
                    </CardContent>
                    {recentAssignments.length > 0 && (
                      <CardFooter className="flex justify-center">
                        <Link href="/assignments">
                          <Button variant="outline">Виж всички задания</Button>
                        </Link>
                      </CardFooter>
                    )}
                  </Card>
                </TabsContent>
                
                {/* Раздел "Задания" */}
                <TabsContent value="assignments" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Управление на заданията</CardTitle>
                      <CardDescription>Управлявайте всички задания в училището</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                              <FileCheck className="h-8 w-8 text-green-500 mb-2" />
                              <p className="font-medium">Завършени</p>
                              <p className="text-2xl font-bold">{Math.min(100, Math.round(assignmentStats.submissionRate))}%</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                              <p className="font-medium">Закъснели предавания</p>
                              <p className="text-2xl font-bold">{assignmentStats.lateSubmissions}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center h-32">
                              <CheckCircle className="h-8 w-8 text-blue-500 mb-2" />
                              <p className="font-medium">Оценени</p>
                              <p className="text-2xl font-bold">
                                {assignmentStats.totalAssignments - assignmentStats.pendingGrading}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-medium text-lg">Отчети за заданията</h3>
                        <p className="text-sm text-gray-500">Преглед на детайлна аналитика за заданията</p>
                        <div className="space-y-2">
                          <Link href="/assignments">
                            <Button variant="outline" className="w-full justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>Виж всички задания</span>
                              </div>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Раздел "Потребители" */}
                <TabsContent value="users" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Масово създаване на потребители</CardTitle>
                      <CardDescription>
                        Качете Excel файл с данни за потребители, за да създадете множество потребители наведнъж
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="file">Изберете Excel файл</Label>
                          <Input
                            id="file"
                            type="file"
                            onChange={handleFileChange}
                            accept=".xlsx, .xls"
                          />
                        </div>
                        <Button variant={"outline"} onClick={processFile} disabled={!file || bulkCreateLoading}>
                          {bulkCreateLoading ? "Обработка..." : "Обработи файла"}
                        </Button>
                      </div>

                      <div className="mt-6">
                        <h3 className="text-sm font-medium mb-2">Пример за формат на файла</h3>
                        <p className="text-xs text-gray-500 mb-2">
                          Excel файлът трябва да има следните колони: firstName (име),
                          lastName (фамилия), gender (пол - male/female), role (роля - student/teacher/admin),
                          phoneNumber (телефон), homeroomClassId (клас - само за ученици)
                        </p>
                        <Card className="bg-gray-50">
                          <CardContent className="p-4">
                            <code className="text-xs">
                              firstName,lastName,gender,role,phoneNumber,homeroomClassId
                              <br />
                              Иван,Иванов,male,student,1234567890,10A
                              <br />
                              Мария,Петрова,female,teacher,0987654321,
                            </code>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Управление на потребителите */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Управление на потребители</CardTitle>
                      <CardDescription>Управлявайте всички потребители в системата</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="order-by">Подреди по</Label>
                            <Select
                              value={userOrdering}
                              onValueChange={setUserOrdering}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Роля" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="role">Роля</SelectItem>
                                <SelectItem value="firstName">Име</SelectItem>
                                <SelectItem value="lastName">Фамилия</SelectItem>
                                <SelectItem value="homeroomClassId">Клас</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={userDirection}
                              onValueChange={setUserDirection}
                            >
                              <SelectTrigger className="w-[100px]">
                                <SelectValue placeholder="Възх." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="asc">Възх.</SelectItem>
                                <SelectItem value="desc">Низх.</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Input
                              placeholder="Търсене на потребители..."
                              className="max-w-xs"
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Име</TableHead>
                                <TableHead>Имейл</TableHead>
                                <TableHead>Роля</TableHead>
                                <TableHead>Клас</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell>
                                    {user.firstName} {user.lastName}
                                  </TableCell>
                                  <TableCell>{user.email}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs ${
                                        user.role === "admin"
                                          ? "bg-purple-100 text-purple-800"
                                          : user.role === "teacher"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-green-100 text-green-800"
                                      }`}
                                    >
                                      {user.role === "admin" ? "Админ" : 
                                      user.role === "teacher" ? "Учител" : "Ученик"}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {user.role === "student" ? user.homeroomClassId : "-"}
                                  </TableCell>
                                  <TableCell className="text-right space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteUser(user.id)}
                                      disabled={user.role === "admin"}
                                      className={user.role === "admin" ? "cursor-not-allowed opacity-50" : ""}
                                      title={user.role === "admin" ? "Администраторите не могат да бъдат изтрити" : "Изтрий потребителя"}
                                    >
                                      Изтрий
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
