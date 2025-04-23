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
 * - Управление на родители (създаване, свързване, премахване на връзки с деца)
 */

"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
  getAllClasses,
  createParentUser
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
  FileCheck,
  UserPlus,
  UserMinus,
  Link2,
  Unlink2
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
import type { User, Parent, Student, Assignment } from "@/lib/interfaces";
import { linkParentToChild, unlinkParentFromChild, getParentChildren } from "@/lib/parentManagement";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

export default function AdminDashboard() {
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [userOrdering, setUserOrdering] = useState("role");
  const [userDirection, setUserDirection] = useState("asc");
  
  // Parent management states
  const [newParentData, setNewParentData] = useState({ firstName: '', lastName: '', phoneNumber: '', gender: '' as 'male' | 'female' | '' });
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  const [allParents, setAllParents] = useState<Parent[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [linkingInProgress, setLinkingInProgress] = useState(false);
  const [unlinkingInProgress, setUnlinkingInProgress] = useState(false);
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [selectedParentChildren, setSelectedParentChildren] = useState<Student[]>([]);
  const [isLoadingParentChildren, setIsLoadingParentChildren] = useState(false);

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

    const fetchUsersAndData = async () => {
      setLoading(true);
      try {
        const fetchedUsers = await getAllUsers(user.schoolId);
        const typedUsers = fetchedUsers as User[];
        setUsers(typedUsers);

        // Separate users by role for linking dropdowns
        setAllParents(typedUsers.filter(u => u.role === 'parent') as unknown as Parent[]);
        setAllStudents(typedUsers.filter(u => u.role === 'student') as unknown as Student[]);

        // Update school stats
        const studentsCount = typedUsers.filter(u => u.role === "student").length;
        const teachersCount = typedUsers.filter(u => u.role === "teacher").length;
        
        // Fetch other data (classes, assignments) - existing logic
        const classes = await getAllClasses(user.schoolId);
        const stats = await getAssignmentStats(user.schoolId);
        const assignments = await getAssignments(user.schoolId, { status: "active" });
        assignments.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
        setRecentAssignments(assignments.slice(0, 5));

        // Update combined stats
        setSchoolStats({
          totalStudents: studentsCount,
          totalTeachers: teachersCount,
          totalClasses: classes.length,
          totalAssignments: stats.totalAssignments
        });
        setAssignmentStats(stats);

        // Calculate teacher stats (existing logic)
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
        const teacherStatsArray = Array.from(teacherMap.values()).map(teacher => ({
          teacherId: teacher.teacherId,
          teacherName: teacher.teacherName,
          assignmentCount: teacher.assignments.length,
          pendingGradingCount: 0,
          avgSubmissionRate: 0
        }));
        teacherStatsArray.sort((a, b) => b.assignmentCount - a.assignmentCount);
        setTeacherStats(teacherStatsArray.slice(0, 5));

      } catch (error) {
        console.error("Error fetching initial data:", error);
        toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndData();
  }, [user?.schoolId]);

  useEffect(() => {
    if (selectedParentId && user?.schoolId) {
      setIsLoadingParentChildren(true);
      getParentChildren(user.schoolId, selectedParentId)
        .then(children => setSelectedParentChildren(children))
        .catch(err => {
          console.error("Error fetching parent's children for unlinking:", err);
          toast({ title: "Error", description: "Could not load children for the selected parent.", variant: "destructive" });
          setSelectedParentChildren([]);
        })
        .finally(() => setIsLoadingParentChildren(false));
    } else {
      setSelectedParentChildren([]);
    }
  }, [selectedParentId, user?.schoolId]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

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

    const userToDelete = users.find(u => u.id === userId);

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

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !newParentData.firstName || !newParentData.lastName || !newParentData.gender) {
      toast({ title: "Missing Information", description: "Please fill in first name, last name, and gender.", variant: "destructive" });
      return;
    }
    setIsCreatingParent(true);
    try {
      // Create parent data object with the required schoolId property
      const parentData = {
        ...newParentData,
        schoolId: user.schoolId,
        email: `${newParentData.firstName.toLowerCase()}.${newParentData.lastName.toLowerCase()}@school.com`, // Generate placeholder email
        gender: newParentData.gender as 'male' | 'female' // Ensure gender is never empty
      };

      // Now pass the complete data to createParentUser
      const { userId, email, passwordGenerated } = await createParentUser(user.schoolId, parentData);
      
      toast({
        title: "Parent Created Successfully",
        description: `Parent ${email} created. Password: ${passwordGenerated}`,
      });
      
      // Refresh user list
      const fetchedUsers = await getAllUsers(user.schoolId);
      const typedUsers = fetchedUsers as User[];
      setUsers(typedUsers);
      setAllParents(typedUsers.filter(u => u.role === 'parent') as unknown as Parent[]);
      
      // Reset form
      setNewParentData({ firstName: '', lastName: '', phoneNumber: '', gender: '' });
    } catch (error: any) {
      console.error("Error creating parent:", error);
      toast({ title: "Error Creating Parent", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsCreatingParent(false);
    }
  };

  const handleLinkParentChild = async () => {
    if (!user?.schoolId || !selectedParentId || !selectedStudentId) {
      toast({ title: "Selection Missing", description: "Please select both a parent and a child.", variant: "destructive" });
      return;
    }
    setLinkingInProgress(true);
    try {
      await linkParentToChild(user.schoolId, selectedParentId, selectedStudentId);
      toast({ title: "Link Successful", description: "Parent and child linked successfully." });
      if (selectedParentId) {
         const children = await getParentChildren(user.schoolId, selectedParentId);
         setSelectedParentChildren(children);
      }
    } catch (error: any) {
      console.error("Error linking parent to child:", error);
      toast({ title: "Linking Failed", description: error.message || "Could not link parent and child.", variant: "destructive" });
    } finally {
      setLinkingInProgress(false);
    }
  };

  const handleUnlinkParentChild = async (childToUnlinkId: string) => {
    if (!user?.schoolId || !selectedParentId || !childToUnlinkId) {
      toast({ title: "Selection Missing", description: "Cannot determine which child to unlink.", variant: "destructive" });
      return;
    }
    setUnlinkingInProgress(true);
    try {
      await unlinkParentFromChild(user.schoolId, selectedParentId, childToUnlinkId);
      toast({ title: "Unlink Successful", description: "Child unlinked from parent successfully." });
      const children = await getParentChildren(user.schoolId, selectedParentId);
      setSelectedParentChildren(children);
    } catch (error: any) {
      console.error("Error unlinking parent from child:", error);
      toast({ title: "Unlinking Failed", description: error.message || "Could not unlink child.", variant: "destructive" });
    } finally {
      setUnlinkingInProgress(false);
    }
  };

  const filteredParents = allParents.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(parentSearchTerm.toLowerCase())
  );

  const filteredStudents = allStudents.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Tabs defaultValue="overview" className="space-y-4 lg:col-span-2">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Статистики</TabsTrigger>
                  <TabsTrigger value="assignments">Задания</TabsTrigger>
                  <TabsTrigger value="users">Потребители</TabsTrigger>
                  <TabsTrigger value="parents">Родители</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-6">
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
                            {teacherStats.map((teacher) => (
                              <div key={teacher.teacherId} className="flex items-center justify-between border-b pb-3">
                                <div>
                                  <p className="font-medium">{teacher.teacherName}</p>
                                  <p className="text-sm text-gray-500">
                                    {teacher.assignmentCount} задани {teacher.assignmentCount !== 1 ? 'я' : 'е'}
                                  </p>
                                </div>
                                <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">
                                  <span className="text-sm font-medium">{teacherStats.indexOf(teacher) + 1}</span>
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
                            {recentAssignments.map((assignment) => (
                              <TableRow key={assignment.assignmentId}>
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

                <TabsContent value="parents" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Create New Parent User</CardTitle>
                      <CardDescription>Manually add a new parent account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateParent} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="parentFirstName">First Name</Label>
                            <Input 
                              id="parentFirstName" 
                              value={newParentData.firstName} 
                              onChange={(e) => setNewParentData({...newParentData, firstName: e.target.value})} 
                              required 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parentLastName">Last Name</Label>
                            <Input 
                              id="parentLastName" 
                              value={newParentData.lastName} 
                              onChange={(e) => setNewParentData({...newParentData, lastName: e.target.value})} 
                              required 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                            <Label htmlFor="parentPhone">Phone Number</Label>
                            <Input 
                              id="parentPhone" 
                              type="tel" 
                              value={newParentData.phoneNumber} 
                              onChange={(e) => setNewParentData({...newParentData, phoneNumber: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parentGender">Gender</Label>
                            <Select 
                              value={newParentData.gender}
                              onValueChange={(value: 'male' | 'female') => setNewParentData({...newParentData, gender: value})}
                            >
                              <SelectTrigger id="parentGender">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="submit" disabled={isCreatingParent}>
                          {isCreatingParent ? "Creating..." : "Create Parent"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Manage Parent-Child Links</CardTitle>
                      <CardDescription>Connect parents to their children or remove existing links.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-3">Link Parent to Child</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div className="space-y-2">
                            <Label htmlFor="select-parent">Select Parent</Label>
                            <Select onValueChange={setSelectedParentId} value={selectedParentId ?? ''}>
                              <SelectTrigger id="select-parent">
                                <SelectValue placeholder="Search or select parent..." />
                              </SelectTrigger>
                              <SelectContent>
                                <ScrollArea className="h-[200px]">
                                  {allParents.map(parent => (
                                    <SelectItem key={parent.userId} value={parent.userId}>
                                      {parent.firstName} {parent.lastName} ({parent.email})
                                    </SelectItem>
                                  ))}
                                  {allParents.length === 0 && <div className="p-2 text-sm text-gray-500">No parents found.</div>}
                                </ScrollArea>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="select-student">Select Child (Student)</Label>
                            <Select onValueChange={setSelectedStudentId} value={selectedStudentId ?? ''}>
                              <SelectTrigger id="select-student">
                                <SelectValue placeholder="Search or select student..." />
                              </SelectTrigger>
                              <SelectContent>
                                <ScrollArea className="h-[200px]">
                                  {allStudents.map(student => (
                                    <SelectItem key={student.userId} value={student.userId}>
                                      {student.firstName} {student.lastName} ({student.homeroomClassId ? `Class ${student.homeroomClassId}` : 'No class'})
                                    </SelectItem>
                                  ))}
                                  {allStudents.length === 0 && <div className="p-2 text-sm text-gray-500">No students found.</div>}
                                </ScrollArea>
                              </SelectContent>
                            </Select>
                          </div>

                          <Button onClick={handleLinkParentChild} disabled={linkingInProgress || !selectedParentId || !selectedStudentId}>
                            <Link2 className="mr-2 h-4 w-4" />
                            {linkingInProgress ? "Linking..." : "Link Parent & Child"}
                          </Button>
                        </div>
                      </div>

                      {selectedParentId && (
                        <div className="border-t pt-6">
                          <h3 className="text-lg font-medium mb-3">
                            Unlink Child from {allParents.find(p => p.userId === selectedParentId)?.firstName} {allParents.find(p => p.userId === selectedParentId)?.lastName}
                          </h3>
                          {isLoadingParentChildren ? (
                            <p>Loading children...</p>
                          ) : selectedParentChildren.length > 0 ? (
                            <ul className="space-y-2">
                              {selectedParentChildren.map(child => (
                                <li key={child.userId} className="flex justify-between items-center p-2 border rounded">
                                  <span>{child.firstName} {child.lastName}</span>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="destructive" size="sm" disabled={unlinkingInProgress}>
                                        <Unlink2 className="mr-1 h-4 w-4" /> Unlink
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Confirm Unlink</DialogTitle>
                                      </DialogHeader>
                                      <p>Are you sure you want to unlink {child.firstName} {child.lastName} from this parent?</p>
                                      <DialogFooter>
                                        <DialogClose asChild>
                                          <Button variant="outline">Cancel</Button>
                                        </DialogClose>
                                        <Button 
                                          variant="destructive" 
                                          onClick={() => handleUnlinkParentChild(child.userId)} 
                                          disabled={unlinkingInProgress}
                                        >
                                          {unlinkingInProgress ? "Unlinking..." : "Confirm Unlink"}
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-500">This parent is not currently linked to any children.</p>
                          )}
                        </div>
                      )}
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
