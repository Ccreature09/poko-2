"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import Sidebar from "@/components/functional/Sidebar";
import { Grade, Subject, User, Student } from "@/lib/interfaces";
import { Timestamp } from "firebase/firestore";
import { BarChart, LayoutGrid, Info, FileText } from "lucide-react";
import type { GradeType } from "@/lib/interfaces";
import { getParentChildren } from "@/lib/parentManagement";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GradeWithId extends Grade {
  id: string;
  title: string;
  description?: string;
  type: GradeType;
  date: Timestamp;
  createdAt: Timestamp;
}

interface GradeWithDetails extends GradeWithId {
  subjectName: string;
  teacherName: string;
}

export default function ReportCard() {
  const { user } = useUser();
  const [grades, setGrades] = useState<GradeWithDetails[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<GradeWithDetails | null>(null);
  const [viewType, setViewType] = useState<"card" | "table">("card");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Parent-specific states
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  
  useEffect(() => {
    // Fetch children for parent users
    if (user?.role === 'parent') {
      setIsLoadingChildren(true);
      getParentChildren(user.schoolId, user.userId)
        .then((fetchedChildren) => {
          setChildren(fetchedChildren);
          if (fetchedChildren.length > 0) {
            // Select the first child by default
            setSelectedChildId(fetchedChildren[0].userId);
          }
        })
        .catch((error) => {
          console.error("Error fetching children:", error);
        })
        .finally(() => {
          setIsLoadingChildren(false);
        });
    }
  }, [user]);
  
  useEffect(() => {
    const fetchGrades = async () => {
      if (!user?.schoolId || !selectedChildId) return;
      
      const gradesRef = collection(db, "schools", user.schoolId, "grades");
      const q = query(gradesRef, where("studentId", "==", selectedChildId));
      const querySnapshot = await getDocs(q);

      const fetchedGrades = await Promise.all(
        querySnapshot.docs.map(async (gradeDoc) => {
          const gradeData = gradeDoc.data() as GradeWithId;
          const subjectDocRef = doc(
            db,
            "schools",
            user.schoolId,
            "subjects",
            gradeData.subjectId
          );
          const teacherDocRef = doc(
            db,
            "schools",
            user.schoolId,
            "users",
            gradeData.teacherId
          );
          const subjectDoc = await getDoc(subjectDocRef);
          const teacherDoc = await getDoc(teacherDocRef);
          
          return {
            ...gradeData,
            id: gradeDoc.id,
            subjectName: subjectDoc.exists()
              ? (subjectDoc.data() as Subject).name
              : "Unknown",
            teacherName: teacherDoc.exists()
              ? (teacherDoc.data() as User).firstName +
                " " +
                (teacherDoc.data() as User).lastName
              : "Unknown",
          };
        })
      );

      setGrades(fetchedGrades);
    };

    fetchGrades();
  }, [user, selectedChildId]);

  const getGradeColor = (grade: number) => {
    if (grade >= 5.5) return "text-emerald-600 font-semibold";
    if (grade >= 4.5) return "text-blue-600 font-semibold";
    if (grade >= 3.5) return "text-yellow-600";
    if (grade >= 3) return "text-orange-600";
    return "text-red-600";
  };

  const getGradeBgColor = (grade: number) => {
    if (grade >= 5.5) return "bg-emerald-50 border-emerald-200";
    if (grade >= 4.5) return "bg-blue-50 border-blue-200";
    if (grade >= 3.5) return "bg-yellow-50 border-yellow-200";
    if (grade >= 3) return "bg-orange-50 border-orange-200";
    return "bg-red-50 border-red-200";
  };

  const gradeTypes: { value: GradeType; label: string }[] = [
    { value: 'exam', label: 'Изпит' },
    { value: 'test', label: 'Тест' },
    { value: 'homework', label: 'Домашна работа' },
    { value: 'participation', label: 'Участие' },
    { value: 'project', label: 'Проект' },
    { value: 'other', label: 'Друго' }
  ];

  // Group grades by subject and term (semester)
  const groupedGrades = grades.reduce((grouped, grade) => {
    if (!grouped[grade.subjectName]) {
      grouped[grade.subjectName] = [];
    }
    grouped[grade.subjectName].push(grade);
    return grouped;
  }, {} as Record<string, GradeWithDetails[]>);

  // Calculate subject averages
  const subjectAverages = Object.entries(groupedGrades).reduce((averages, [subject, grades]) => {
    const total = grades.reduce((sum, grade) => sum + grade.value, 0);
    averages[subject] = Number((total / grades.length).toFixed(2));
    return averages;
  }, {} as Record<string, number>);

  // Get the latest 4 grades for the card view
  const latestGrades = [...grades]
    .sort((a, b) => b.date.seconds - a.date.seconds)
    .slice(0, 4);

  const calculateGPA = () => {
    if (grades.length === 0) return 0;
    const totalPoints = grades.reduce((sum, grade) => sum + grade.value, 0);
    return (totalPoints / grades.length).toFixed(2);
  };

  const handleGradeClick = (grade: GradeWithDetails) => {
    setSelectedGrade(grade);
    setIsDialogOpen(true);
  };

  const handleChildChange = (childId: string) => {
    setSelectedChildId(childId);
  };

  const getStudentName = () => {
    if (selectedChildId) {
      const selectedChild = children.find(child => child.userId === selectedChildId);
      return selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : 'Избрано дете';
    }
    return 'Ученик';
  };

  if (!user) return null;

  // Redirect if wrong role for this page - parent version should only be accessed by parents
  if (user.role !== 'parent') return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800">Успех</h1>
            <p className="text-gray-600">
              Успех на {getStudentName()}
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mt-4 md:mt-0 w-full md:w-auto">
            {children.length > 0 && (
              <Select
                value={selectedChildId || ''}
                onValueChange={handleChildChange}
                disabled={isLoadingChildren}
              >
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Изберете дете" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.userId} value={child.userId}>
                      {child.firstName} {child.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center space-x-2">
              <Button
                variant={viewType === "card" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("card")}
                className="flex items-center"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Картички
              </Button>
              <Button
                variant={viewType === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("table")}
                className="flex items-center"
              >
                <FileText className="w-4 h-4 mr-2" />
                Таблица
              </Button>
            </div>
          </div>
        </div>
        
        {isLoadingChildren ? (
          <div className="text-center py-10">
            <p>Зареждане на информация...</p>
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg border">
            <p className="text-gray-500">Не са намерени деца, свързани с този акаунт</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 mb-6">
              <Card className="shadow-md">
                <CardHeader className="border-b bg-white">
                  <CardTitle>Общ успех</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className={`text-4xl font-bold ${getGradeColor(Number(calculateGPA()))}`}>
                    {calculateGPA()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {viewType === "card" ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Последни оценки</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {latestGrades.map((grade) => (
                    <Card 
                      key={grade.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleGradeClick(grade)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium">{grade.subjectName}</CardTitle>
                        <CardDescription className="text-xs">
                          {gradeTypes.find(t => t.value === grade.type)?.label} | {new Date(grade.date.seconds * 1000).toLocaleDateString('bg-BG')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex justify-between items-center">
                          <div className="text-sm truncate max-w-[150px]">{grade.title}</div>
                          <div className={`text-2xl ${getGradeColor(grade.value)}`}>{grade.value}</div>
                        </div>
                      </CardContent>
                      <CardFooter className="text-xs text-gray-500 pt-0">
                        Учител: {grade.teacherName}
                      </CardFooter>
                    </Card>
                  ))}
                  {latestGrades.length === 0 && (
                    <div className="col-span-4 text-center py-10 bg-white rounded-lg border">
                      <BarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Все още няма оценки</p>
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-semibold mb-4">Всички предмети</h2>
                <div className="grid gap-6 mb-8">
                  {Object.entries(groupedGrades).map(([subject, subjectGrades]) => (
                    <Card key={subject} className="shadow-sm">
                      <CardHeader className="pb-2 border-b">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">{subject}</CardTitle>
                          <div className={`text-lg ${getGradeColor(subjectAverages[subject])}`}>
                            {subjectAverages[subject]}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {subjectGrades
                            .sort((a, b) => b.date.seconds - a.date.seconds)
                            .map((grade) => (
                              <HoverCard key={grade.id}>
                                <HoverCardTrigger asChild>
                                  <div 
                                    className={`px-3 py-1.5 rounded-full border ${getGradeBgColor(grade.value)} cursor-pointer`}
                                    onClick={() => handleGradeClick(grade)}
                                  >
                                    <span className={getGradeColor(grade.value)}>{grade.value}</span>
                                  </div>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold">{grade.title}</h4>
                                    <div className="text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Дата:</span>
                                        <span>{new Date(grade.date.seconds * 1000).toLocaleDateString('bg-BG')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Тип:</span>
                                        <span>{gradeTypes.find(t => t.value === grade.type)?.label}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Учител:</span>
                                        <span>{grade.teacherName}</span>
                                      </div>
                                    </div>
                                    {grade.description && (
                                      <div className="pt-2 border-t">
                                        <p className="text-sm">{grade.description}</p>
                                      </div>
                                    )}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {Object.keys(groupedGrades).length === 0 && (
                    <div className="text-center py-10 bg-white rounded-lg border">
                      <BarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">Все още няма оценки</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // Table View
              <div className="grid gap-6">
                {Object.entries(groupedGrades).map(([subject, subjectGrades]) => (
                  <Card key={subject} className="shadow-md">
                    <CardHeader className="border-b bg-white">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-xl text-gray-800">{subject}</CardTitle>
                        <span className={`text-lg ${getGradeColor(subjectAverages[subject])}`}>
                          Среден успех: {subjectAverages[subject]}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ScrollArea className="h-auto max-h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-gray-700">Дата</TableHead>
                              <TableHead className="text-gray-700">Вид</TableHead>
                              <TableHead className="text-gray-700">Заглавие</TableHead>
                              <TableHead className="text-gray-700">Учител</TableHead>
                              <TableHead className="text-gray-700 text-center">Оценка</TableHead>
                              <TableHead className="text-gray-700 w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subjectGrades
                              .sort((a, b) => b.date.seconds - a.date.seconds)
                              .map((grade) => (
                                <TableRow 
                                  key={grade.id} 
                                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                                  onClick={() => handleGradeClick(grade)}
                                >
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(grade.date.seconds * 1000).toLocaleDateString('bg-BG')}
                                  </TableCell>
                                  <TableCell>
                                    {gradeTypes.find(t => t.value === grade.type)?.label || grade.type}
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {grade.title}
                                  </TableCell>
                                  <TableCell>{grade.teacherName}</TableCell>
                                  <TableCell className={`text-center ${getGradeColor(grade.value)}`}>
                                    {grade.value}
                                  </TableCell>
                                  <TableCell>
                                    <Popover>
                                      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <Info className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80">
                                        <div className="space-y-2">
                                          <h4 className="font-semibold">{grade.title}</h4>
                                          <div className="text-sm space-y-1">
                                            <div className="flex justify-between">
                                              <span className="text-gray-500">Дата:</span>
                                              <span>{new Date(grade.date.seconds * 1000).toLocaleDateString('bg-BG')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-500">Тип:</span>
                                              <span>{gradeTypes.find(t => t.value === grade.type)?.label}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-500">Оценка:</span>
                                              <span className={getGradeColor(grade.value)}>{grade.value}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-gray-500">Учител:</span>
                                              <span>{grade.teacherName}</span>
                                            </div>
                                          </div>
                                          {grade.description && (
                                            <div className="pt-2 border-t">
                                              <p className="text-sm">{grade.description}</p>
                                            </div>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </TableCell>
                                </TableRow>
                              ))}
                            {subjectGrades.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                  Няма оценки за този предмет
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))}
                {Object.keys(groupedGrades).length === 0 && (
                  <div className="text-center py-10 bg-white rounded-lg border">
                    <BarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Все още няма оценки</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Grade Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedGrade && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedGrade.title}</DialogTitle>
                <DialogDescription>
                  {selectedGrade.subjectName} | {gradeTypes.find(t => t.value === selectedGrade.type)?.label}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
                  <span className="font-medium">Оценка:</span>
                  <span className={`text-2xl font-bold ${getGradeColor(selectedGrade.value)}`}>
                    {selectedGrade.value}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Дата</h4>
                    <p>{new Date(selectedGrade.date.seconds * 1000).toLocaleDateString('bg-BG')}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Учител</h4>
                    <p>{selectedGrade.teacherName}</p>
                  </div>
                </div>
                
                {selectedGrade.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Описание</h4>
                    <p className="mt-1 text-gray-700">{selectedGrade.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}