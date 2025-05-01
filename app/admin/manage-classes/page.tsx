"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/functional/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose 
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ChevronDown, 
  ChevronRight, 
  PlusCircle, 
  User, 
  SearchIcon, 
  Book, 
  UserCheck,
  UserPlus,
  Edit,
  RotateCw,
  Save,
  Trash2,
  Calendar
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getSubjects } from "@/lib/subjectManagement";
import type { 
  HomeroomClass, 
  Subject, 
  Teacher,
  TeacherSubjectAssignment,
  ClassSubjectsMapping 
} from "@/lib/interfaces";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ManageClasses() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [gradeYears] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [classesByGrade, setClassesByGrade] = useState<{ [key: number]: HomeroomClass[] }>({});
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<HomeroomClass | null>(null);
  const [classTeachers, setClassTeachers] = useState<{ id: string, name: string }[]>([]);
  const [allTeachers, setAllTeachers] = useState<{ id: string, name: string }[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherSubjectAssignments, setTeacherSubjectAssignments] = useState<{ 
    subjectId: string, 
    teacherId: string 
  }[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [namingFormat, setNamingFormat] = useState<"graded" | "custom">("graded");
  const [gradeNumber, setGradeNumber] = useState<number>(0);
  const [classLetter, setClassLetter] = useState<string>("");
  const [customClassName, setCustomClassName] = useState<string>("");
  const [newClassTeacherId, setNewClassTeacherId] = useState<string>("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [bulkNamingFormat, setBulkNamingFormat] = useState<"graded" | "custom">("graded");
  const [bulkGradeNumber, setBulkGradeNumber] = useState<number>(0);
  const [bulkClassCount, setBulkClassCount] = useState<number>(1);
  const [bulkCustomPrefix, setBulkCustomPrefix] = useState<string>("");
  const [bulkCustomCount, setBulkCustomCount] = useState<number>(1);
  const [bulkCreatingClasses, setBulkCreatingClasses] = useState(false);

  useEffect(() => {
    if (user?.schoolId) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user?.schoolId) return;
    
    setLoading(true);
    try {
      // Fetch all teachers
      const teachersRef = collection(db, "schools", user.schoolId, "users");
      const teachersQuery = query(teachersRef, where("role", "==", "teacher"));
      const teachersSnapshot = await getDocs(teachersQuery);
      const teachers = teachersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: `${doc.data().firstName} ${doc.data().lastName}`,
      }));
      setAllTeachers(teachers);
      
      // Fetch all subjects
      const subjectsData = await getSubjects(user.schoolId);
      setSubjects(subjectsData);
      
      // Fetch all classes and group by grade
      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const classesSnapshot = await getDocs(classesRef);
      
      const classData: { [key: number]: HomeroomClass[] } = {};
      gradeYears.forEach(year => {
        classData[year] = [];
      });
      
      classesSnapshot.docs.forEach(doc => {
        const classData = { classId: doc.id, ...doc.data() } as HomeroomClass;
        
        // Extract the grade number from the class name (e.g., "11" from "11A")
        let yearGroup: number | undefined;
        
        // Try to get yearGroup from the existing field first
        if (classData.yearGroup) {
          yearGroup = Number(classData.yearGroup);
        } 
        // If no yearGroup field exists, extract it from the className or classId
        else {
          const className = classData.className || classData.classId;
          // Extract numeric prefix from the class name (e.g., "11" from "11A")
          const match = className.match(/^(\d+)/);
          if (match && match[1]) {
            yearGroup = Number(match[1]);
          }
        }
        
        if (yearGroup) {
          // Check if the yearGroup is a valid grade level and exists in our structure
          const grade = yearGroup as number;
          if (grade >= 1 && grade <= 12) {
            setClassesByGrade(prev => {
              const updated = {...prev};
              if (!updated[grade]) {
                updated[grade] = [];
              }
              updated[grade].push(classData);
              return updated;
            });
          }
        }
      });
      
      setClassesByGrade(classData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при зареждането на данните.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClassDetails = async (classId: string) => {
    if (!user?.schoolId) return;
    
    try {
      // Get class details
      const classRef = doc(db, "schools", user.schoolId, "classes", classId);
      const classDoc = await getDoc(classRef);
      
      if (classDoc.exists()) {
        const classData = { classId: classDoc.id, ...classDoc.data() } as HomeroomClass;
        setSelectedClass(classData);
        setHomeroomTeacherId(classData.classTeacherId || "");
        
        // Fetch teachers for this class
        if (classData.teacherIds && classData.teacherIds.length > 0) {
          const teacherPromises = classData.teacherIds.map(async (teacherId) => {
            const teacherRef = doc(db, "schools", user.schoolId, "users", teacherId);
            const teacherDoc = await getDoc(teacherRef);
            if (teacherDoc.exists()) {
              return {
                id: teacherDoc.id,
                name: `${teacherDoc.data().firstName} ${teacherDoc.data().lastName}`,
              };
            }
            return null;
          });
          
          const teachersResult = await Promise.all(teacherPromises);
          setClassTeachers(teachersResult.filter(t => t !== null) as { id: string, name: string }[]);
        } else {
          setClassTeachers([]);
        }
        
        // Fetch subject-teacher assignments for this class
        const assignmentsRef = collection(db, "schools", user.schoolId, "teacherSubjectAssignments");
        const q = query(assignmentsRef, where("classIds", "array-contains", classId));
        const assignmentsSnapshot = await getDocs(q);
        
        const assignments = assignmentsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            subjectId: data.subjectId,
            teacherId: data.teacherId
          };
        });
        
        setTeacherSubjectAssignments(assignments);
      } else {
        toast({
          title: "Грешка",
          description: "Класът не беше намерен.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error fetching class details:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при зареждането на данните за класа.",
        variant: "destructive"
      });
    }
  };

  const handleGradeSelect = (grade: number) => {
    setSelectedGrade(grade);
    setSelectedClass(null);
    setTeacherSubjectAssignments([]);
    setClassTeachers([]);
  };

  const handleClassSelect = (cls: HomeroomClass) => {
    fetchClassDetails(cls.classId);
  };

  const handleSaveClassAssignments = async () => {
    if (!user?.schoolId || !selectedClass) return;
    
    setSaving(true);
    try {
      const classRef = doc(db, "schools", user.schoolId, "classes", selectedClass.classId);
      
      // Update homeroom teacher
      await updateDoc(classRef, {
        classTeacherId: homeroomTeacherId || null
      });
      
      // Update teacher-subject assignments
      if (teacherSubjectAssignments.length > 0) {
        const classMapping: ClassSubjectsMapping = {
          classId: selectedClass.classId,
          className: selectedClass.className,
          subjects: teacherSubjectAssignments
        };
        
        // Get all teacher IDs
        const teacherIds = [
          ...new Set([
            ...teacherSubjectAssignments.map(a => a.teacherId),
            ...(homeroomTeacherId ? [homeroomTeacherId] : [])
          ])
        ].filter(id => id); // Remove empty strings
        
        // Update class with teacher IDs
        await updateDoc(classRef, {
          teacherIds: teacherIds
        });
        
        // Update assignments
        for (const assignment of teacherSubjectAssignments) {
          // Check if an assignment already exists
          const assignmentsRef = collection(db, "schools", user.schoolId, "teacherSubjectAssignments");
          const q = query(
            assignmentsRef,
            where("subjectId", "==", assignment.subjectId),
            where("teacherId", "==", assignment.teacherId)
          );
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            // Create new assignment
            const docRef = doc(assignmentsRef);
            await updateDoc(docRef, {
              assignmentId: docRef.id,
              teacherId: assignment.teacherId,
              subjectId: assignment.subjectId,
              classIds: [selectedClass.classId],
              schoolYear: getCurrentSchoolYear()
            });
          } else {
            // Update existing assignment
            const existingAssignment = snapshot.docs[0];
            const existingData = existingAssignment.data();
            
            if (!existingData.classIds.includes(selectedClass.classId)) {
              await updateDoc(existingAssignment.ref, {
                classIds: [...existingData.classIds, selectedClass.classId]
              });
            }
          }
        }
      }
      
      toast({
        title: "Успех",
        description: "Промените са запазени успешно.",
      });
      
      // Refresh data
      await fetchClassDetails(selectedClass.classId);
      setEditMode(false);
    } catch (error) {
      console.error("Error saving class assignments:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при запазването на промените.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubjectTeacher = () => {
    setTeacherSubjectAssignments([
      ...teacherSubjectAssignments,
      { subjectId: "", teacherId: "" }
    ]);
  };

  const handleRemoveSubjectTeacher = (index: number) => {
    const updated = [...teacherSubjectAssignments];
    updated.splice(index, 1);
    setTeacherSubjectAssignments(updated);
  };

  const handleSubjectChange = (index: number, subjectId: string) => {
    const updated = [...teacherSubjectAssignments];
    updated[index].subjectId = subjectId;
    setTeacherSubjectAssignments(updated);
  };

  const handleTeacherChange = (index: number, teacherId: string) => {
    const updated = [...teacherSubjectAssignments];
    updated[index].teacherId = teacherId;
    setTeacherSubjectAssignments(updated);
  };

  const handleCreateClass = async () => {
    if (!user?.schoolId) return;

    // Validate inputs
    if (namingFormat === "graded" && (!gradeNumber || !classLetter)) {
      toast({
        title: "Грешка",
        description: "Моля, попълнете номер на клас и буква на паралелка.",
        variant: "destructive"
      });
      return;
    }

    if (namingFormat === "custom" && !customClassName) {
      toast({
        title: "Грешка",
        description: "Моля, въведете име на класа.",
        variant: "destructive"
      });
      return;
    }

    setCreatingClass(true);
    try {
      // Determine class name based on format
      const className = namingFormat === "graded" 
        ? `${gradeNumber}${classLetter.toUpperCase()}`
        : customClassName;

      // Create new class with appropriate format
      const newClass: Partial<HomeroomClass> = {
        className,
        namingFormat,
        classTeacherId: newClassTeacherId || undefined,
        studentIds: [],
        teacherIds: newClassTeacherId ? [newClassTeacherId] : [],
      };

      // Add format-specific fields
      if (namingFormat === "graded") {
        newClass.gradeNumber = gradeNumber;
        newClass.classLetter = classLetter.toUpperCase();
        newClass.yearGroup = gradeNumber; // For backward compatibility
      } else {
        newClass.customName = customClassName;
      }

      // Save to database
      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const newClassRef = doc(classesRef);
      await updateDoc(newClassRef, { 
        ...newClass,
        classId: newClassRef.id 
      });

      toast({
        title: "Успех",
        description: "Класът беше създаден успешно.",
      });

      // Reset form
      setNamingFormat("graded");
      setGradeNumber(0);
      setClassLetter("");
      setCustomClassName("");
      setNewClassTeacherId("");

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error("Error creating class:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при създаването на класа.",
        variant: "destructive"
      });
    } finally {
      setCreatingClass(false);
    }
  };

  const handleBulkCreateClasses = async () => {
    if (!user?.schoolId) return;

    // Validate inputs
    if (bulkNamingFormat === "graded" && (!bulkGradeNumber || bulkClassCount < 1)) {
      toast({
        title: "Грешка",
        description: "Моля, попълнете номер на клас и брой паралелки.",
        variant: "destructive"
      });
      return;
    }

    if (bulkNamingFormat === "custom" && (!bulkCustomPrefix || bulkCustomCount < 1)) {
      toast({
        title: "Грешка",
        description: "Моля, въведете префикс и брой класове.",
        variant: "destructive"
      });
      return;
    }

    setBulkCreatingClasses(true);
    try {
      const newClasses: Partial<HomeroomClass>[] = [];

      if (bulkNamingFormat === "graded") {
        for (let i = 0; i < bulkClassCount; i++) {
          const classLetter = String.fromCharCode(1040 + i); // Cyrillic letters starting from А
          const className = `${bulkGradeNumber}${classLetter}`;
          newClasses.push({
            className,
            namingFormat: "graded",
            gradeNumber: bulkGradeNumber,
            classLetter,
            yearGroup: bulkGradeNumber, // For backward compatibility
            studentIds: [],
            teacherIds: [],
            classTeacherId: "",
          });
        }
      } else {
        for (let i = 0; i < bulkCustomCount; i++) {
          const className = `${bulkCustomPrefix} ${i + 1}`;
          newClasses.push({
            className,
            namingFormat: "custom",
            customName: className,
            studentIds: [],
            teacherIds: [],
            classTeacherId: "",
          });
        }
      }

      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const batchPromises = newClasses.map(async (newClass) => {
        const newClassRef = doc(classesRef);
        await updateDoc(newClassRef, { 
          ...newClass,
          classId: newClassRef.id 
        });
      });

      await Promise.all(batchPromises);

      toast({
        title: "Успех",
        description: `${newClasses.length} класа бяха създадени успешно.`,
      });

      // Reset form
      setBulkNamingFormat("graded");
      setBulkGradeNumber(0);
      setBulkClassCount(1);
      setBulkCustomPrefix("");
      setBulkCustomCount(1);

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error("Error creating classes:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при създаването на класовете.",
        variant: "destructive"
      });
    } finally {
      setBulkCreatingClasses(false);
    }
  };

  // Get subject name by ID
  const getSubjectName = (subjectId: string): string => {
    const subject = subjects.find(s => s.subjectId === subjectId);
    return subject ? subject.name : 'Непознат предмет';
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId: string): string => {
    const teacher = allTeachers.find(t => t.id === teacherId);
    return teacher ? teacher.name : 'Непознат учител';
  };

  // Get current school year
  const getCurrentSchoolYear = (): string => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based (0 = January)
    
    // If we're in the second half of the academic year (January-August)
    if (currentMonth < 8) { // Before September
      return `${currentYear-1}-${currentYear}`;
    } else {
      return `${currentYear}-${currentYear+1}`;
    }
  };

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
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800">Управление на класове</h1>
              <p className="text-gray-600">Създаване, редактиране и управление на класове и разпределение на учители</p>
            </div>
            <div className="flex items-center">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="mt-4 md:mt-0">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Създаване на клас
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Създаване на нов клас</DialogTitle>
                    <DialogDescription>
                      Попълнете информацията за новия клас.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="naming-format">Формат на наименуване</Label>
                      <RadioGroup 
                        value={namingFormat}
                        onValueChange={(value) => {
                          setNamingFormat(value as "graded" | "custom");
                          // Reset fields when switching formats
                          if (value === "graded") {
                            setCustomClassName("");
                          } else {
                            setGradeNumber(0);
                            setClassLetter("");
                          }
                        }}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="graded" id="naming-graded" />
                          <Label htmlFor="naming-graded" className="font-normal">Класическо наименуване (1А, 12Б)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="naming-custom" />
                          <Label htmlFor="naming-custom" className="font-normal">Персонализирано (Група 1, Клас Начинаещи)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {namingFormat === "graded" ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="grade-number">Клас</Label>
                          <Select
                            value={gradeNumber.toString()}
                            onValueChange={(value) => setGradeNumber(parseInt(value))}
                          >
                            <SelectTrigger id="grade-number">
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              {gradeYears.map(year => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}. клас
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="class-letter">Паралелка</Label>
                          <Input 
                            id="class-letter" 
                            value={classLetter}
                            onChange={(e) => setClassLetter(e.target.value)}
                            placeholder="А, Б, В..."
                            maxLength={1}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="custom-class-name">Име на класа</Label>
                        <Input 
                          id="custom-class-name" 
                          value={customClassName}
                          onChange={(e) => setCustomClassName(e.target.value)}
                          placeholder="Група 1, Клас Начинаещи..."
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="class-teacher">Класен ръководител</Label>
                      <Select
                        value={newClassTeacherId}
                        onValueChange={setNewClassTeacherId}
                      >
                        <SelectTrigger id="class-teacher">
                          <SelectValue placeholder="Изберете класен ръководител" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">- Няма класен ръководител -</SelectItem>
                          {allTeachers.map(teacher => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Отказ</Button>
                    </DialogClose>
                    <Button onClick={handleCreateClass} disabled={creatingClass}>
                      {creatingClass ? (
                        <RotateCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <PlusCircle className="h-4 w-4 mr-2" />
                      )}
                      Създаване
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="mt-4 md:mt-0 ml-2" variant="outline">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Масово създаване
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Масово създаване на класове</DialogTitle>
                    <DialogDescription>
                      Създаване на множество класове наведнъж.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-naming-format">Формат на наименуване</Label>
                      <RadioGroup 
                        value={bulkNamingFormat}
                        onValueChange={(value) => {
                          setBulkNamingFormat(value as "graded" | "custom");
                          // Reset fields when switching formats
                          if (value === "graded") {
                            setBulkCustomPrefix("");
                            setBulkCustomCount(0);
                          } else {
                            setBulkGradeNumber(0);
                          }
                        }}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="graded" id="bulk-naming-graded" />
                          <Label htmlFor="bulk-naming-graded" className="font-normal">Класическо наименуване (9А, 9Б, 9В...)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="bulk-naming-custom" />
                          <Label htmlFor="bulk-naming-custom" className="font-normal">Персонализирано (Група 1, Група 2...)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {bulkNamingFormat === "graded" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="bulk-grade-number">Клас</Label>
                          <Select
                            value={bulkGradeNumber.toString()}
                            onValueChange={(value) => setBulkGradeNumber(parseInt(value))}
                          >
                            <SelectTrigger id="bulk-grade-number">
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              {gradeYears.map(year => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}. клас
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="bulk-class-count">Брой паралелки</Label>
                          <Input 
                            id="bulk-class-count" 
                            type="number"
                            min="1"
                            max="10"
                            value={bulkClassCount.toString()}
                            onChange={(e) => setBulkClassCount(parseInt(e.target.value) || 1)}
                          />
                        </div>
                        
                        <div className="border p-4 rounded-md bg-gray-50">
                          <h4 className="text-sm font-medium mb-2">Преглед:</h4>
                          <div className="flex flex-wrap gap-2">
                            {bulkGradeNumber > 0 && bulkClassCount > 0 && 
                              Array.from({ length: Math.min(bulkClassCount, 10) }, (_, i) => (
                                <Badge key={i} variant="outline" className="px-2 py-1">
                                  {bulkGradeNumber}{String.fromCharCode(1040 + i)}
                                </Badge>
                              ))
                            }
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="bulk-custom-prefix">Префикс</Label>
                          <Input 
                            id="bulk-custom-prefix" 
                            value={bulkCustomPrefix}
                            onChange={(e) => setBulkCustomPrefix(e.target.value)}
                            placeholder="Група, Клас..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="bulk-custom-count">Брой класове</Label>
                          <Input 
                            id="bulk-custom-count" 
                            type="number"
                            min="1"
                            max="10"
                            value={bulkCustomCount.toString()}
                            onChange={(e) => setBulkCustomCount(parseInt(e.target.value) || 1)}
                          />
                        </div>
                        
                        <div className="border p-4 rounded-md bg-gray-50">
                          <h4 className="text-sm font-medium mb-2">Преглед:</h4>
                          <div className="flex flex-wrap gap-2">
                            {bulkCustomPrefix && bulkCustomCount > 0 && 
                              Array.from({ length: Math.min(bulkCustomCount, 10) }, (_, i) => (
                                <Badge key={i} variant="outline" className="px-2 py-1">
                                  {bulkCustomPrefix} {i+1}
                                </Badge>
                              ))
                            }
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Отказ</Button>
                    </DialogClose>
                    <Button onClick={handleBulkCreateClasses} disabled={bulkCreatingClasses}>
                      {bulkCreatingClasses ? (
                        <RotateCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <PlusCircle className="h-4 w-4 mr-2" />
                      )}
                      Създаване на {bulkNamingFormat === "graded" ? bulkClassCount : bulkCustomCount} класа
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {selectedClass ? (
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mr-3"
                    onClick={() => {
                      setSelectedClass(null);
                      setEditMode(false);
                    }}
                  >
                    <ChevronRight className="h-4 w-4 mr-1" />
                    Назад
                  </Button>
                  <div>
                    <h2 className="text-xl font-semibold">{selectedClass.className}</h2>
                    <p className="text-gray-500">{selectedClass.yearGroup} клас • {selectedClass.studentIds?.length || 0} ученици</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <Button 
                      variant="outline" 
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Редактиране
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setEditMode(false);
                          fetchClassDetails(selectedClass.classId);
                        }}
                      >
                        Отказ
                      </Button>
                      <Button 
                        onClick={handleSaveClassAssignments}
                        disabled={saving}
                        className="flex items-center gap-1"
                      >
                        {saving ? (
                          <RotateCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Запази
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <Tabs defaultValue="teachers" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="teachers" className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Учители
                  </TabsTrigger>
                  <TabsTrigger value="students" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Ученици
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Програма
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="teachers" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5" />
                        Класен ръководител
                      </CardTitle>
                      <CardDescription>
                        Учителят, който е отговорен за класа и служи като основна точка за контакт.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {editMode ? (
                        <div className="max-w-md">
                          <Select 
                            value={homeroomTeacherId} 
                            onValueChange={setHomeroomTeacherId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Изберете класен ръководител" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">- Няма класен ръководител -</SelectItem>
                              {allTeachers.map(teacher => (
                                <SelectItem key={teacher.id} value={teacher.id}>
                                  {teacher.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          {homeroomTeacherId ? (
                            <>
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{getTeacherName(homeroomTeacherId)}</p>
                                <p className="text-sm text-gray-500">Класен ръководител</p>
                              </div>
                            </>
                          ) : (
                            <p className="text-gray-500 italic">Все още няма зададен класен ръководител</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Book className="h-5 w-5" />
                        Учители по предмети
                      </CardTitle>
                      <CardDescription>
                        Учителите, които преподават отделни предмети на този клас.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {editMode ? (
                        <div className="space-y-4">
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Предмет</TableHead>
                                  <TableHead>Учител</TableHead>
                                  <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {teacherSubjectAssignments.length > 0 ? (
                                  teacherSubjectAssignments.map((assignment, index) => (
                                    <TableRow key={index}>
                                      <TableCell>
                                        <Select 
                                          value={assignment.subjectId} 
                                          onValueChange={(value) => handleSubjectChange(index, value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Изберете предмет" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {subjects.map(subject => (
                                              <SelectItem key={subject.subjectId} value={subject.subjectId}>
                                                {subject.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Select 
                                          value={assignment.teacherId} 
                                          onValueChange={(value) => handleTeacherChange(index, value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Изберете учител" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {allTeachers.map(teacher => (
                                              <SelectItem key={teacher.id} value={teacher.id}>
                                                {teacher.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-red-500" 
                                          onClick={() => handleRemoveSubjectTeacher(index)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-gray-500">
                                      Няма зададени учители по предмети
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            className="flex items-center gap-1"
                            onClick={handleAddSubjectTeacher}
                          >
                            <PlusCircle className="h-4 w-4" />
                            Добави учител за предмет
                          </Button>
                        </div>
                      ) : (
                        <>
                          {teacherSubjectAssignments.length > 0 ? (
                            <div className="rounded-md border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Предмет</TableHead>
                                    <TableHead>Учител</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {teacherSubjectAssignments.map((assignment, index) => (
                                    <TableRow key={index}>
                                      <TableCell className="font-medium">
                                        {getSubjectName(assignment.subjectId)}
                                      </TableCell>
                                      <TableCell>
                                        {getTeacherName(assignment.teacherId)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-gray-500 italic">
                              Все още няма зададени учители по предмети
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="students">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Ученици
                      </CardTitle>
                      <CardDescription>
                        Списък на всички ученици, записани в този клас.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-500">
                        Управлението на учениците се извършва от секцията за "Управление на потребители".
                      </p>
                      <div className="mt-4">
                        <Button variant="outline" className="flex items-center gap-1">
                          <UserPlus className="h-4 w-4" />
                          Към управление на ученици
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="schedule">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Програма
                      </CardTitle>
                      <CardDescription>
                        Седмичната програма на класа.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-500">
                        Управлението на програмата се извършва от секцията за "Създаване на програма".
                      </p>
                      <div className="mt-4">
                        <Button variant="outline" className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Към управление на програмата
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ) : selectedGrade ? (
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mr-3"
                  onClick={() => setSelectedGrade(null)}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Назад
                </Button>
                <h2 className="text-xl font-semibold">{selectedGrade}. клас - Изберете паралелка</h2>
              </div>
              
              {classesByGrade[selectedGrade]?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {classesByGrade[selectedGrade].map((cls) => (
                    <Card 
                      key={cls.classId} 
                      className="cursor-pointer hover:shadow-md transition-all"
                      onClick={() => handleClassSelect(cls)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">{cls.className}</CardTitle>
                        <CardDescription>
                          {cls.studentIds?.length || 0} ученици
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-500">
                        <div className="flex items-center space-x-1 text-gray-700">
                          <UserCheck className="h-4 w-4" />
                          <span>
                            {cls.classTeacherId 
                              ? "Има класен ръководител" 
                              : "Няма класен ръководител"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1 text-gray-700">
                          <Book className="h-4 w-4" />
                          <span>
                            {cls.teacherIds && cls.teacherIds.length > 0
                              ? `${cls.teacherIds.length} учители`
                              : "Няма учители"}
                          </span>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button variant="ghost" size="sm" className="w-full mt-2">
                          Управление на класа
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border rounded-lg">
                  <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Няма намерени класове</h3>
                  <p className="text-gray-500 mb-4">
                    Все още няма създадени паралелки за {selectedGrade}. клас
                  </p>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Създаване на паралелка
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 12 }).map((_, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg shadow animate-pulse">
                    <div className="h-7 bg-gray-200 rounded-md w-1/3 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded-md w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded-md w-2/3"></div>
                      <div className="h-4 bg-gray-200 rounded-md w-1/4"></div>
                    </div>
                  </div>
                ))
              ) : (
                gradeYears.map((grade) => (
                  <div 
                    key={grade} 
                    className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleGradeSelect(grade)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleGradeSelect(grade);
                      }
                    }}
                  >
                    <h2 className="text-xl font-semibold mb-4">{grade}. клас</h2>
                    <div className="space-y-2">
                      <p className="flex items-center text-gray-600">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                        Паралелки: {classesByGrade[grade]?.length || 0}
                      </p>
                      
                      {classesByGrade[grade]?.length > 0 && (
                        <>
                          <p className="flex items-center text-gray-600">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                            Ученици: {classesByGrade[grade].reduce((total, cls) => total + (cls.studentIds?.length || 0), 0)}
                          </p>
                          <p className="flex items-center text-gray-600">
                            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                            Учители: {classesByGrade[grade].reduce((total, cls) => {
                              const uniqueTeachers = new Set(cls.teacherIds || []);
                              return total + uniqueTeachers.size;
                            }, 0)}
                          </p>
                        </>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <Button variant="ghost" size="sm">
                        Преглед на паралелки
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}