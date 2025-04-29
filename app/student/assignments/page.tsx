"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { format } from "date-fns";
import { getAssignments, getStudentAssignments, getStudentSubmission, getSubmissions, deleteAssignment } from "@/lib/assignmentManagement";
import type { Assignment } from "@/lib/interfaces";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Calendar, Clock, Plus, FileText, Users, FileCheck, Pencil, Trash2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function Assignments() {
  const { user } = useUser();
  // Състояние за активни Задания
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  // Състояние за минали Задания
  const [pastAssignments, setPastAssignments] = useState<Assignment[]>([]);
  // Състояние за индикатор за зареждане
  const [loading, setLoading] = useState(true);
  // Състояние за идентификатор на задание, което се изтрива
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
  // Състояние за индикатор за изтриване
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Функция за извличане на Задания
    const fetchAssignments = async () => {
      // Ако няма schoolId или userId, прекрати изпълнението
      if (!user?.schoolId || !user?.userId) return;

      try {
        setLoading(true);
        let assignments: Assignment[] = [];

        // В зависимост от ролята на потребителя, извлича Заданията
        if (user.role === "teacher") {
          // Ако е учител, извлича Заданияте, създадени от него
          assignments = await getAssignments(user.schoolId, {
            teacherId: user.userId,
          });
        } else if (user.role === "student") {
          // Ако е ученик, извлича задания, зададени на него
          assignments = await getStudentAssignments(user.schoolId, user.userId);
        } else if (user.role === "admin") {
          // Ако е администратор, извлича всички задания
          assignments = await getAssignments(user.schoolId);
        }

        const now = new Date();
        const active: Assignment[] = [];
        const past: Assignment[] = [];

        // Разделя заданията на активни и минали
        for (const assignment of assignments) {
          const dueDate = new Date(assignment.dueDate.seconds * 1000);
          
          if (user.role === "student") {
            // Ако е ученик, проверява дали е предал заданията
            const submission = await getStudentSubmission(
              user.schoolId, 
              assignment.assignmentId, 
              user.userId
            );
            
            if (submission) {
              // Ако е предал заданието, я добавя към миналите
              past.push(assignment);
            } else if (dueDate < now) {
              // Ако крайният срок е минал, я добавя към миналите
              past.push(assignment);
            } else {
              // Ако не е предал заданието и крайният срок не е минал, я добавя към активните
              active.push(assignment);
            }
          }
          else if (user.role === "teacher" || user.role === "admin") {
            // Ако е учител или администратор, проверява дали всички ученици са предали заданието
            if (dueDate < now) {
              past.push(assignment);
            } else {
              const allSubmitted = await checkAllStudentsSubmitted(
                user.schoolId, 
                assignment
              );
              
              if (allSubmitted) {
                past.push(assignment);
              } else {
                active.push(assignment);
              }
            }
          }
        }

        // Сортира активните и миналите Задания
        active.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds);
        past.sort((a, b) => b.dueDate.seconds - a.dueDate.seconds); 
        setActiveAssignments(active);
        setPastAssignments(past);
      } catch (error) {
        console.error("Error fetching assignments:", error);
        toast({
          title: "Error",
          description: "Failed to fetch assignments. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [user]); // Зависимости на useEffect - изпълнява се при промяна на user

  // Функция за проверка дали всички ученици са предали заданието
  const checkAllStudentsSubmitted = async (schoolId: string, assignment: Assignment): Promise<boolean> => {
    const submissions = await getSubmissions(schoolId, assignment.assignmentId);
    
    // Множество за съхранение на идентификаторите на учениците, които трябва да предадат заданието
    const targetStudentIds = new Set<string>();
    
    // Ако има зададени studentIds, ги добавя към множеството
    if (assignment.studentIds && assignment.studentIds.length > 0) {
      assignment.studentIds.forEach(id => targetStudentIds.add(id));
    } 
    // Ако има зададени classIds, извлича studentIds от класовете и ги добавя към множеството
    else if (assignment.classIds && assignment.classIds.length > 0) {
      for (const classId of assignment.classIds) {
        const classDoc = await getDoc(doc(db, "schools", schoolId, "classes", classId));
        if (classDoc.exists() && classDoc.data().studentIds) {
          classDoc.data().studentIds.forEach((id: string) => targetStudentIds.add(id));
        }
      }
    }
    
    // Ако няма ученици, които трябва да предадат заданието, връща true
    if (targetStudentIds.size === 0) return true;
    
    // Множество за съхранение на идентификаторите на учениците, които са предали заданието
    const submittedStudentIds = new Set(submissions.map(sub => sub.studentId));
    
    // Проверява дали всички ученици, които трябва да предадат заданието, са я предали
    const allSubmitted = Array.from(targetStudentIds).every(studentId => submittedStudentIds.has(studentId));
    
    // Ако не всички са предали, връща false
    if (!allSubmitted) return false;
    
    // Проверява дали всички предадени Задания са оценени
    const allGraded = submissions.every(submission => submission.status === "graded");
    
    // Връща true, ако всички са предали и всички са оценени
    return allGraded;
  };

  // Функция за изчисляване на оставащото време до крайния срок
  const getTimeRemaining = (dueDate: Date) => {
    const now = new Date();
    const diffTime = Math.abs(dueDate.getTime() - now.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} left`;
    } else {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} left`;
    }
  };

  // Функция за изтриване на задание
  const handleDeleteAssignment = async () => {
    if (!user?.schoolId || !deletingAssignmentId) return;
    
    try {
      setIsDeleting(true);
      await deleteAssignment(user.schoolId, deletingAssignmentId);
      
      // Update the local state to remove the deleted assignment
      setActiveAssignments(prev => prev.filter(a => a.assignmentId !== deletingAssignmentId));
      setPastAssignments(prev => prev.filter(a => a.assignmentId !== deletingAssignmentId));
      
      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });
      
      setDeletingAssignmentId(null);
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Функция за показване на карта за задание
  const renderAssignmentCard = (assignment: Assignment, isPast: boolean) => {
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    const isSubmissionDeadline = !isPast && dueDate.getTime() - Date.now() < 24 * 60 * 60 * 1000; 
    return (
      <Card key={assignment.assignmentId} className={`${isSubmissionDeadline ? 'border-orange-200' : ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{assignment.title}</span>
            {isSubmissionDeadline && (
              <Badge variant="outline" className="ml-2 bg-orange-50 text-orange-700 border-orange-200">
                Наближава краен срок
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Предмет: {assignment.subjectName}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm mb-4 text-gray-600 line-clamp-2">
            {assignment.description}
          </p>
          
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Краен срок: {format(dueDate, "MMMM d, yyyy")}</span>
          </div>
          
          {!isPast && (
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-2" />
              <span>{getTimeRemaining(dueDate)}</span>
            </div>
          )}
          
          {user?.role === "teacher" && (
            <div className="flex items-center text-sm text-gray-500 mt-2">
              <Users className="h-4 w-4 mr-2" />
              <span>
                {assignment.classIds.length > 0 
                  ? `${assignment.classIds.length} ${assignment.classIds.length === 1 ? 'клас' : 'класа'}`
                  : 'Избрани ученици'}
              </span>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-2">
          <div className="flex text-xs text-gray-500">
            {user?.role === "teacher" ? (
              <span>Създадено от вас</span>
            ) : (
              <span>Създадено от {assignment.teacherName}</span>
            )}
          </div>
          
          <div className="flex gap-2 w-full">
            <Link href={`${user?.role === "teacher" ? "/teacher" : user?.role === "student" ? "/student" : ""}/assignments/${assignment.assignmentId}`} className="flex-1">
              <Button variant={isPast ? "outline" : "ghost"} className="w-full text-foreground">
                <>
                  {isPast ? <FileCheck className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  {isPast ? "Преглед" : user?.role === "teacher" ? "Провери" : "Предай"}
                </>
              </Button>
            </Link>

            {(user?.role === "teacher" || user?.role === "admin") && (
              <>
                <Link href={`/teacher/assignments/${assignment.assignmentId}/edit`}>
                  <Button variant="ghost" size="icon" className="w-10 px-0">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </Link>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 px-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Изтриване на задание</DialogTitle>
                      <DialogDescription>
                        Сигурни ли сте, че искате да изтриете това задание? Това действие не може да бъде отменено.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button 
                        variant="outline"
                        onClick={() => setDeletingAssignmentId(null)}
                      >
                        Отказ
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => {
                          setDeletingAssignmentId(assignment.assignmentId);
                          handleDeleteAssignment();
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting && deletingAssignmentId === assignment.assignmentId ? "Изтриване..." : "Изтрий"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    );
  };

  // Ако потребителят не е логнат
  if (!user) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Please log in to view assignments.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Задания</h1>
            
            {user.role === "teacher" && (
              <Link href="/teacher/assignments/create">
                <Button variant={"outline"} className="flex items-center gap-2 text-foreground">
                  <Plus className="h-4 w-4" />
                  Създаване на задание
                </Button>
              </Link>
            )}
          </div>

          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Активни Задания</TabsTrigger>
              <TabsTrigger value="past">Минали Задания</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p>Зареждане на Задания...</p>
                </div>
              ) : activeAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">Няма активни Задания</h3>
                      {user.role === "teacher" ? (
                        <p className="text-gray-500 mb-4">
                          Все още не сте създали активни Задания.
                        </p>
                      ) : (
                        <p className="text-gray-500 mb-4">
                          Нямате активни Задания в момента.
                        </p>
                      )}
                      
                      {user.role === "teacher" && (
                        <Link href="/teacher/assignments/create">
                          <Button variant={"outline"} className="text-foreground">Създай задание</Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeAssignments.map((assignment) => renderAssignmentCard(assignment, false))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="past" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p>Зареждане на минали Задания...</p>
                </div>
              ) : pastAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">Няма минали Задания</h3>
                      <p className="text-gray-500">
                        Нямате минали Задания.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastAssignments.map((assignment) => renderAssignmentCard(assignment, true))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
