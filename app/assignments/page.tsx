"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { format } from "date-fns";
import { getAssignments, getStudentAssignments, getStudentSubmission, getSubmissions } from "@/lib/assignmentManagement";
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
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [pastAssignments, setPastAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user?.schoolId || !user?.userId) return;

      try {
        setLoading(true);
        let assignments: Assignment[] = [];

        // Fetch assignments based on role
        if (user.role === "teacher") {
          // Teachers see assignments they created
          assignments = await getAssignments(user.schoolId, {
            teacherId: user.userId,
          });
        } else if (user.role === "student") {
          // Students see assignments assigned to them
          assignments = await getStudentAssignments(user.schoolId, user.userId);
        } else if (user.role === "admin") {
          // Admins see all assignments
          assignments = await getAssignments(user.schoolId);
        }

        // Split into active and past assignments based on due date and completion status
        const now = new Date();
        const active: Assignment[] = [];
        const past: Assignment[] = [];

        for (const assignment of assignments) {
          const dueDate = new Date(assignment.dueDate.seconds * 1000);
          
          // For students: if they've submitted, consider it as a past assignment
          if (user.role === "student") {
            // Check if student has already submitted this assignment
            const submission = await getStudentSubmission(
              user.schoolId, 
              assignment.assignmentId, 
              user.userId
            );
            
            if (submission) {
              // If student has submitted, move to past assignments
              past.push(assignment);
            } else if (dueDate < now) {
              // If due date has passed and not submitted, it's also past
              past.push(assignment);
            } else {
              // Otherwise it's active
              active.push(assignment);
            }
          }
          // For teachers: if all students have completed, consider it past
          else if (user.role === "teacher" || user.role === "admin") {
            if (dueDate < now) {
              // If due date has passed, move to past assignments
              past.push(assignment);
            } else {
              // For active assignments, check if all assigned students have submitted
              const allSubmitted = await checkAllStudentsSubmitted(
                user.schoolId, 
                assignment
              );
              
              if (allSubmitted) {
                // If all students have submitted, move to past assignments
                past.push(assignment);
              } else {
                // Otherwise, it's still active
                active.push(assignment);
              }
            }
          }
        }

        // Sort by due date
        active.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds);
        past.sort((a, b) => b.dueDate.seconds - a.dueDate.seconds); // Past assignments in reverse chronological order

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
  }, [user]);

  // Helper function to check if all students have submitted and all submissions are graded
  const checkAllStudentsSubmitted = async (schoolId: string, assignment: Assignment): Promise<boolean> => {
    // Get all submissions for this assignment
    const submissions = await getSubmissions(schoolId, assignment.assignmentId);
    
    // Get list of students who should submit this assignment
    const targetStudentIds = new Set<string>();
    
    // If specific students are assigned
    if (assignment.studentIds && assignment.studentIds.length > 0) {
      assignment.studentIds.forEach(id => targetStudentIds.add(id));
    } 
    // Otherwise, get students from classes
    else if (assignment.classIds && assignment.classIds.length > 0) {
      for (const classId of assignment.classIds) {
        const classDoc = await getDoc(doc(db, "schools", schoolId, "classes", classId));
        if (classDoc.exists() && classDoc.data().studentIds) {
          classDoc.data().studentIds.forEach((id: string) => targetStudentIds.add(id));
        }
      }
    }
    
    // If no students assigned, consider it completed
    if (targetStudentIds.size === 0) return true;
    
    // Check if submissions exist for all target students
    const submittedStudentIds = new Set(submissions.map(sub => sub.studentId));
    
    // Check if every target student has submitted
    const allSubmitted = Array.from(targetStudentIds).every(studentId => submittedStudentIds.has(studentId));
    
    // If not all students have submitted, return false immediately
    if (!allSubmitted) return false;
    
    // If all students have submitted, check if all submissions are graded
    const allGraded = submissions.every(submission => submission.status === "graded");
    
    // Only consider the assignment as "past" if all submissions are graded
    return allGraded;
  };

  // Calculate time remaining until due date
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

  // Format assignment cards based on user role
  const renderAssignmentCard = (assignment: Assignment, isPast: boolean) => {
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    const isSubmissionDeadline = !isPast && dueDate.getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours to submit
    
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
            <Link href={`/assignments/${assignment.assignmentId}`} className="flex-1">
              <Button variant={isPast ? "outline" : "ghost"} className="w-full text-foreground">
                <>
                  {isPast ? <FileCheck className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  {isPast ? "Преглед" : user?.role === "teacher" ? "Провери" : "Предай"}
                </>
              </Button>
            </Link>

            {(user?.role === "teacher" || user?.role === "admin") && (
              <>
                <Link href={`/edit-assignment/${assignment.assignmentId}`}>
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
                      <Button variant="outline">
                        Отказ
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => {
                          // TODO: Implement delete functionality
                          toast({
                            title: "Not implemented",
                            description: "Delete functionality will be added soon",
                            variant: "destructive",
                          });
                        }}
                      >
                        Изтрий
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
            <h1 className="text-3xl font-bold text-gray-800">Задачи</h1>
            
            {user.role === "teacher" && (
              <Link href="/create-assignment">
                <Button variant={"outline"} className="flex items-center gap-2 text-foreground">
                  <Plus className="h-4 w-4" />
                  Създаване на задание
                </Button>
              </Link>
            )}
          </div>

          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Активни задачи</TabsTrigger>
              <TabsTrigger value="past">Минали задачи</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p>Зареждане на задачи...</p>
                </div>
              ) : activeAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">Няма активни задачи</h3>
                      {user.role === "teacher" ? (
                        <p className="text-gray-500 mb-4">
                          Все още не сте създали активни задачи.
                        </p>
                      ) : (
                        <p className="text-gray-500 mb-4">
                          Нямате активни задачи в момента.
                        </p>
                      )}
                      
                      {user.role === "teacher" && (
                        <Link href="/create-assignment">
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
                  <p>Зареждане на минали задачи...</p>
                </div>
              ) : pastAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">Няма минали задачи</h3>
                      <p className="text-gray-500">
                        Нямате минали задачи.
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
