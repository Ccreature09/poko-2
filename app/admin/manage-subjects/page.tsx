"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/functional/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubjectManagementOverview } from "@/components/functional/SubjectManagement";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronRight, PlusCircle, Trash2, SearchIcon } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { toast } from "@/hooks/use-toast";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getSubjects,
  getTeacherSubjectAssignments,
  getClasses,
  getClassAssignments,
  updateClassSubjects,
  getCurrentSchoolYear,
  getSubjectWithTeacherAssignments,
} from "@/lib/subjectManagement";
import type { Subject, HomeroomClass, TeacherSubjectAssignment, ClassSubjectsMapping } from "@/lib/interfaces";

export default function ManageSubjects() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto pb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800">Управление на предмети</h1>
              <p className="text-gray-600">Добавяне, редактиране и управление на учебни предмети</p>
            </div>
          </div>
          
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">Всички предмети</TabsTrigger>
              <TabsTrigger value="by-grade">По класове</TabsTrigger>
              <TabsTrigger value="assignments">Разпределение</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <SubjectManagementOverview />
            </TabsContent>
            
            <TabsContent value="by-grade" className="space-y-4">
              <SubjectsByGradeLevel />
            </TabsContent>
            
            <TabsContent value="assignments" className="space-y-4">
              <SubjectTeacherAssignments />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function SubjectsByGradeLevel() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [gradeYears, setGradeYears] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [classesByGrade, setClassesByGrade] = useState<{[key: number]: HomeroomClass[]}>({});
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeLevelInfo, setGradeLevelInfo] = useState<{[key: number]: {subjectCount: number, weeklyHours: number}}>({});
  const [selectedClass, setSelectedClass] = useState<HomeroomClass | null>(null);
  const [classSubjects, setClassSubjects] = useState<{subjectId: string, teacherId: string}[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId) return;
      
      setLoading(true);
      try {
        const allSubjects = await getSubjects(user.schoolId);
        setSubjects(allSubjects);
        
        const gradeData: {[key: number]: HomeroomClass[]} = {};
        const gradeInfo: {[key: number]: {subjectCount: number, weeklyHours: number}} = {};
        
        gradeYears.forEach(grade => {
          gradeData[grade] = [];
          gradeInfo[grade] = { subjectCount: 0, weeklyHours: 0 };
        });
        
        const allClasses = await getClasses(user.schoolId);
        
        allClasses.forEach(cls => {
          const yearGroup = cls.yearGroup;
          if (yearGroup && gradeData[yearGroup]) {
            gradeData[yearGroup].push(cls);
          }
        });
        
        allSubjects.forEach(subject => {
          if (subject.gradeLevel && subject.gradeLevel.length > 0) {
            subject.gradeLevel.forEach(grade => {
              if (gradeInfo[grade]) {
                gradeInfo[grade].subjectCount += 1;
                gradeInfo[grade].weeklyHours += subject.weeklyHours || 0;
              }
            });
          }
        });
        
        setClassesByGrade(gradeData);
        setGradeLevelInfo(gradeInfo);
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
    
    fetchData();
  }, [user]);
  
  const fetchTeachers = async () => {
    if (!user?.schoolId) return;
    
    try {
      const teachersRef = collection(db, "schools", user.schoolId, "users");
      const q = query(teachersRef, where("role", "==", "teacher"));
      const querySnapshot = await getDocs(q);
      const fetchedTeachers = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        name: `${doc.data().firstName} ${doc.data().lastName}`,
      }));
      setAvailableTeachers(fetchedTeachers);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast({
        title: 'Грешка',
        description: 'Не успяхме да заредим учителите. Моля, опитайте отново.',
        variant: 'destructive',
      });
    }
  };
  
  const fetchClassSubjects = async (classId: string) => {
    if (!user?.schoolId) return;
    
    try {
      const assignments = await getClassAssignments(user.schoolId, classId);
      const mappedSubjects = assignments.map(assignment => ({
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId
      }));
      
      setClassSubjects(mappedSubjects);
    } catch (error) {
      console.error('Error fetching class subjects:', error);
      toast({
        title: 'Грешка',
        description: 'Не успяхме да заредим предметите за класа. Моля, опитайте отново.',
        variant: 'destructive',
      });
      setClassSubjects([]);
    }
  };
  
  const handleGradeSelect = async (grade: number) => {
    setSelectedGrade(grade);
    setSelectedClass(null);
    setClassSubjects([]);
  };
  
  const handleClassSelect = async (cls: HomeroomClass) => {
    setSelectedClass(cls);
    await fetchTeachers();
    await fetchClassSubjects(cls.classId);
  };
  
  const handleAssignSubjects = async () => {
    if (!user?.schoolId || !selectedClass) return;
    
    try {
      const classSubjectsMapping: ClassSubjectsMapping = {
        classId: selectedClass.classId,
        className: selectedClass.className,
        subjects: classSubjects
      };
      
      await updateClassSubjects(user.schoolId, classSubjectsMapping);
      
      toast({
        title: "Успех",
        description: "Предметите са успешно зададени за класа.",
      });
      
      await fetchClassSubjects(selectedClass.classId);
    } catch (error) {
      console.error('Error assigning subjects to class:', error);
      toast({
        title: 'Грешка',
        description: 'Възникна проблем при задаването на предметите. Моля, опитайте отново.',
        variant: 'destructive',
      });
    }
  };
  
  const handleAddSubject = () => {
    if (selectedClass) {
      setClassSubjects([...classSubjects, { subjectId: "", teacherId: "" }]);
    }
  };
  
  const handleRemoveSubject = (index: number) => {
    const updatedSubjects = [...classSubjects];
    updatedSubjects.splice(index, 1);
    setClassSubjects(updatedSubjects);
  };
  
  const handleSubjectChange = (index: number, subjectId: string) => {
    const updatedSubjects = [...classSubjects];
    updatedSubjects[index].subjectId = subjectId;
    setClassSubjects(updatedSubjects);
  };
  
  const handleTeacherChange = (index: number, teacherId: string) => {
    const updatedSubjects = [...classSubjects];
    updatedSubjects[index].teacherId = teacherId;
    setClassSubjects(updatedSubjects);
  };
  
  const filteredSubjects = selectedGrade 
    ? subjects.filter(subject => !subject.gradeLevel || subject.gradeLevel.includes(selectedGrade))
    : subjects;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Предмети по класове</h2>
      <p className="text-gray-500 italic mb-4">
        Тази страница позволява да разпределите кои предмети се изучават във всеки клас и кои учители ги преподават.
      </p>
      
      {selectedGrade && selectedClass ? (
        <div className="mt-6">
          <div className="flex items-center mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={() => setSelectedClass(null)}
            >
              <ChevronRight className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <h3 className="text-lg font-medium">
              {selectedClass.className} - Разпределение на предмети
            </h3>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Предмет</TableHead>
                  <TableHead className="w-[250px]">Учител</TableHead>
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classSubjects.length > 0 ? (
                  classSubjects.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select 
                          value={item.subjectId} 
                          onValueChange={(value) => handleSubjectChange(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Изберете предмет" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredSubjects.map((subject) => (
                              <SelectItem key={subject.subjectId} value={subject.subjectId}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={item.teacherId} 
                          onValueChange={(value) => handleTeacherChange(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Изберете учител" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTeachers.map((teacher) => (
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
                          onClick={() => handleRemoveSubject(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                      Все още няма зададени предмети за този клас
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleAddSubject}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Добави предмет
            </Button>
            
            <Button onClick={handleAssignSubjects}>
              Запази промените
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {loading ? (
            Array(12).fill(0).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mt-3"></div>
              </div>
            ))
          ) : (
            gradeYears.map((grade) => (
              <div 
                key={grade} 
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleGradeSelect(grade)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleGradeSelect(grade);
                  }
                }}
              >
                <h3 className="text-lg font-medium mb-2">{grade}. клас</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-2"></span>
                    Брой класове: {classesByGrade[grade]?.length || 0}
                  </p>
                  <p className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2"></span>
                    Брой предмети: {gradeLevelInfo[grade]?.subjectCount || 0}
                  </p>
                  <p className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-purple-400 mr-2"></span>
                    Часове седмично: {gradeLevelInfo[grade]?.weeklyHours || 0}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {selectedGrade && !selectedClass && (
        <div className="mt-6">
          <div className="flex items-center mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={() => setSelectedGrade(null)}
            >
              <ChevronRight className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <h3 className="text-lg font-medium">{selectedGrade}. клас - Изберете паралелка</h3>
          </div>
          
          {classesByGrade[selectedGrade]?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {classesByGrade[selectedGrade].map((cls) => (
                <Card 
                  key={cls.classId} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleClassSelect(cls)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleClassSelect(cls);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle>{cls.className}</CardTitle>
                    <CardDescription>
                      {cls.studentIds.length} ученици
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">
                      Класен ръководител: {cls.classTeacherId ? "Зададен" : "Не е зададен"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-md">
              <p className="text-gray-500">Няма намерени класове за {selectedGrade}. клас</p>
              <Button variant="outline" className="mt-2">
                Създаване на клас
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectTeacherAssignments() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId) return;
      
      setLoading(true);
      try {
        const allSubjects = await getSubjects(user.schoolId);
        setSubjects(allSubjects);
        
        const teachersRef = collection(db, "schools", user.schoolId, "users");
        const q = query(teachersRef, where("role", "==", "teacher"));
        const querySnapshot = await getDocs(q);
        const fetchedTeachers = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: `${doc.data().firstName} ${doc.data().lastName}`,
        }));
        setTeachers(fetchedTeachers);
        
        const allClasses = await getClasses(user.schoolId);
        setClasses(allClasses);
        
        const allAssignments = await getTeacherSubjectAssignments(user.schoolId);
        setAssignments(allAssignments);
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
    
    fetchData();
  }, [user]);
  
  const handleSubjectSelect = async (subject: Subject) => {
    setSelectedSubject(subject);
    
    if (user?.schoolId) {
      try {
        const { assignments } = await getSubjectWithTeacherAssignments(user.schoolId, subject.subjectId);
        setAssignments(assignments);
      } catch (error) {
        console.error("Error fetching subject assignments:", error);
        toast({
          title: "Грешка",
          description: "Възникна проблем при зареждането на разпределението.",
          variant: "destructive"
        });
      }
    }
  };
  
  const getTeacherName = (teacherId: string): string => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? teacher.name : 'Неизвестен учител';
  };
  
  const getClassName = (classId: string): string => {
    const cls = classes.find(c => c.classId === classId);
    return cls ? cls.className : 'Неизвестен клас';
  };
  
  const filteredSubjects = subjects.filter(subject => 
    subject.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getAssignedClassesCount = (subjectId: string): number => {
    const subjectAssignments = assignments.filter(a => a.subjectId === subjectId);
    const uniqueClassIds = new Set<string>();
    
    subjectAssignments.forEach(assignment => {
      assignment.classIds.forEach(classId => {
        uniqueClassIds.add(classId);
      });
    });
    
    return uniqueClassIds.size;
  };
  
  const getAssignedTeachersCount = (subjectId: string): number => {
    return new Set(
      assignments
        .filter(a => a.subjectId === subjectId)
        .map(a => a.teacherId)
    ).size;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Разпределение на учители към предмети</h2>
      <p className="text-gray-500 italic mb-4">
        Преглед на разпределението на учители по предмети и класове за текущата учебна година ({getCurrentSchoolYear()}).
      </p>
      
      {selectedSubject ? (
        <div className="mt-6">
          <div className="flex items-center mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="mr-2"
              onClick={() => setSelectedSubject(null)}
            >
              <ChevronRight className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <h3 className="text-lg font-medium">{selectedSubject.name} - Разпределение на учители</h3>
          </div>
          
          <div className="rounded-md border mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Учител</TableHead>
                  <TableHead>Класове</TableHead>
                  <TableHead className="text-right">Общо часове</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments
                  .filter(assignment => assignment.subjectId === selectedSubject.subjectId)
                  .map((assignment) => (
                    <TableRow key={assignment.assignmentId}>
                      <TableCell className="font-medium">
                        {getTeacherName(assignment.teacherId)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignment.classIds.map(classId => (
                            <Badge key={classId} variant="outline">
                              {getClassName(classId)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {(selectedSubject.weeklyHours || 0) * assignment.classIds.length} часа
                      </TableCell>
                    </TableRow>
                  ))}
                
                {assignments.filter(a => a.subjectId === selectedSubject.subjectId).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                      Няма назначени учители за този предмет
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <>
          <div className="relative w-full max-w-md mb-6">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Търсене на предмет..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Предмет</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Учители</TableHead>
                  <TableHead>Класове</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <div className="flex items-center space-x-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredSubjects.length > 0 ? (
                  filteredSubjects.map((subject) => (
                    <TableRow key={subject.subjectId}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          subject.category === 'core' ? 'bg-blue-50 text-blue-700' :
                          subject.category === 'elective' ? 'bg-green-50 text-green-700' :
                          'bg-purple-50 text-purple-700'
                        }>
                          {subject.category === 'core' ? 'Основен' :
                           subject.category === 'elective' ? 'Избираем' :
                           subject.category === 'specialized' ? 'Профилиран' : 'Основен'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getAssignedTeachersCount(subject.subjectId)} назначени
                      </TableCell>
                      <TableCell>
                        {getAssignedClassesCount(subject.subjectId)} класа
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline"
                          className="bg-blue-50 hover:bg-blue-100 transition-colors"
                          onClick={() => handleSubjectSelect(subject)}
                        >
                          Управление
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                      {searchQuery ? 'Няма намерени предмети' : 'Няма добавени предмети'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}