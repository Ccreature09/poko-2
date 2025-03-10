"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  getAssignment, 
  getSubmissions,
  getStudentSubmission, 
  submitAssignment, 
  gradeSubmission,
  deleteAssignment 
} from "@/lib/assignmentManagement";
import type { 
  Assignment, 
  AssignmentSubmission,
} from "@/lib/interfaces";
import { Timestamp } from "firebase/firestore";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import {
  Calendar,
  FileText,
  Users,
  ChevronLeft,
  CheckCircle,
  XCircle,
  FileCheck
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AssignmentDetail() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [userSubmission, setUserSubmission] = useState<AssignmentSubmission | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [classes, setClasses] = useState<{[key: string]: string}>({});
  
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmission | null>(null);
  const [feedback, setFeedback] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [isGrading, setIsGrading] = useState(false);
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const isAssignmentPast = assignment?.dueDate 
    ? new Date(assignment.dueDate.seconds * 1000) < new Date() 
    : false;

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId || !assignmentId) return;

      try {
        setLoading(true);
        const assignmentData = await getAssignment(user.schoolId, assignmentId as string);
        
        if (!assignmentData) {
          toast({
            title: "Error",
            description: "Assignment not found",
            variant: "destructive",
          });
          router.push("/assignments");
          return;
        }
        
        setAssignment(assignmentData);
        
        if (user.role === "teacher" || user.role === "admin") {
          setLoadingSubmissions(true);
          
          const classesCollection = collection(db, "schools", user.schoolId, "classes");
          const classesSnapshot = await getDocs(classesCollection);
          const classesMap: {[key: string]: string} = {};
          classesSnapshot.docs.forEach((doc) => {
            classesMap[doc.id] = doc.data().className;
          });
          setClasses(classesMap);
          
          const submissionsData = await getSubmissions(user.schoolId, assignmentId as string);
          setSubmissions(submissionsData);
          setLoadingSubmissions(false);
        }
        
        if (user.role === "student") {
          const submissionData = await getStudentSubmission(
            user.schoolId, 
            assignmentId as string,
            user.userId
          );
          
          if (submissionData) {
            setUserSubmission(submissionData);
            setContent(submissionData.content);
          }
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
        toast({
          title: "Error",
          description: "Failed to fetch assignment details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, assignmentId, router]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSubmit = async () => {
    if (!user?.schoolId || !assignmentId) return;
    
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter your submission content",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSubmitting(true);
      
      const submissionData = {
        assignmentId: assignmentId as string,
        studentId: user.userId,
        studentName: `${user.firstName} ${user.lastName}`,
        content: content,
      };
      
      await submitAssignment(user.schoolId, submissionData);
      
      const updatedSubmission = await getStudentSubmission(
        user.schoolId,
        assignmentId as string,
        user.userId
      );
      
      if (updatedSubmission) {
        setUserSubmission(updatedSubmission);
      }
      
      toast({
        title: "Success",
        description: "Assignment submitted successfully",
      });
    } catch (error: unknown) {
      console.error("Error submitting assignment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit assignment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleGradeSubmission = async () => {
    if (!user?.schoolId || !selectedSubmission) return;
    
    const gradeNumber = parseFloat(grade);
    if (isNaN(gradeNumber) || gradeNumber < 2 || gradeNumber > 6) {
      toast({
        title: "Error",
        description: "Please enter a valid grade between 2 and 6",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsGrading(true);
      
      const feedbackData = {
        teacherId: user.userId,
        comment: feedback,
        grade: gradeNumber,
        gradedAt: Timestamp.now(),
      };
      
      await gradeSubmission(
        user.schoolId,
        selectedSubmission.submissionId,
        feedbackData
      );
      
      const updatedSubmissions = submissions.map(sub => 
        sub.submissionId === selectedSubmission.submissionId
          ? { ...sub, feedback: feedbackData, status: "graded" as const }
          : sub
      );
      
      setSubmissions(updatedSubmissions);
      setSelectedSubmission(null);
      setFeedback("");
      setGrade("");
      
      toast({
        title: "Success",
        description: "Submission graded successfully",
      });
    } catch (error) {
      console.error("Error grading submission:", error);
      toast({
        title: "Error",
        description: "Failed to grade submission",
        variant: "destructive",
      });
    } finally {
      setIsGrading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!user?.schoolId || !assignmentId) return;
    
    try {
      setDeleting(true);
      await deleteAssignment(user.schoolId, assignmentId as string);
      
      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });
      
      router.push("/assignments");
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const canSubmit = () => {
    if (!assignment) return false;
    
    const now = new Date();
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    
    if (now <= dueDate) return true;
    
    return assignment.allowLateSubmission;
  };
  
  const canResubmit = () => {
    if (!assignment || !userSubmission) return false;
    
    if (!assignment.allowResubmission) return false;
    
    const now = new Date();
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    
    if (now <= dueDate) return true;
    
    return assignment.allowLateSubmission;
  };

  if (!user) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Моля, влезте в профила си, за да видите това задание.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p>Зареждане на детайли за заданието...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Заданието не е намерено или нямате разрешение да го видите.</p>
              <Button asChild className="mt-4">
                <Link href="/assignments">Обратно към Задачи</Link>
              </Button>
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
          {/* Back button and header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              className="mb-4 p-0 hover:bg-transparent"
              onClick={() => router.push("/assignments")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Обратно към Задачи
            </Button>
            
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">{assignment.title}</h1>
                <div className="flex items-center mt-2">
                  <Badge className="mr-2 bg-blue-50 text-blue-600 border-blue-200">
                    {assignment.subjectName}
                  </Badge>
                  
                  {isAssignmentPast ? (
                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                      Затворена
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                      Активна
                    </Badge>
                  )}
                </div>
              </div>
              
              {user.role === "teacher" && assignment.teacherId === user.userId && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/edit-assignment/${assignmentId}`)}
                  >
                    Редактирай Задание
                  </Button>
                  
                  <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive">Изтрий Задание</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Изтриване на задание</DialogTitle>
                        <DialogDescription>
                          Наистина ли желаете да изтриете това задание? Всички предавания също ще бъдат премахнати. Това действие е необратимо.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Отказ</Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? "Изтриване..." : "Изтрий задание"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
          
          {/* Assignment details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Описание</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {assignment.description ? (
                      <p className="whitespace-pre-wrap text-gray-700">{assignment.description}</p>
                    ) : (
                      <p className="text-gray-500 italic">Няма предоставено описание</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Student Submission Section */}
              {user.role === "student" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Вашето Предаване</CardTitle>
                    {userSubmission ? (
                      <CardDescription>
                        Предадено на {format(new Date(userSubmission.submittedAt.seconds * 1000), "MMMM d, yyyy 'в' h:mm a")}
                        {userSubmission.status === "late" && (
                          <span className="text-orange-500 ml-2">(Закъсняло предаване)</span>
                        )}
                        {userSubmission.status === "resubmitted" && (
                          <span className="text-blue-500 ml-2">(Повторно предаване)</span>
                        )}
                      </CardDescription>
                    ) : (
                      <CardDescription>
                        {canSubmit() 
                          ? "Все още не сте предали това задание" 
                          : "Крайният срок за това задание е изтекло"}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {userSubmission && userSubmission.status === "graded" && userSubmission.feedback ? (
                      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <h4 className="font-medium mb-2 flex items-center">
                          <FileCheck className="h-4 w-4 mr-2 text-blue-500" />
                          Обратна Връзка от Учителя
                        </h4>
                        <p className="text-sm mb-3">{userSubmission.feedback.comment}</p>
                        {userSubmission.feedback.grade !== undefined && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">Оценка:</span>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                              {userSubmission.feedback.grade}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    <Textarea
                      placeholder="Въведете вашето решение тук..."
                      className="min-h-[200px] mb-4"
                      value={content}
                      onChange={handleContentChange}
                      disabled={
                        submitting || 
                        (!canSubmit() && !userSubmission) || 
                        (userSubmission && !canResubmit()) ||
                        (userSubmission?.status === "graded")
                      }
                    />
                    
                    {(!userSubmission || canResubmit()) && !userSubmission?.status?.includes("graded") && (
                      <div className="flex justify-end">
                        {isAssignmentPast && !assignment.allowLateSubmission ? (
                          <p className="text-red-500 text-sm">Крайният срок за това задание е изтекло</p>
                        ) : (
                          <Button 
                          variant={"outline"}
                            onClick={handleSubmit} 
                            disabled={submitting || content.trim() === ""}
                          >
                            {submitting 
                              ? "Предаване..." 
                              : userSubmission 
                                ? "Повторно Предаване" 
                                : "Предай Заданието"
                            }
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Teacher Submissions Review Section */}
              {(user.role === "teacher" || user.role === "admin") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Предадени Задачи от Ученици</CardTitle>
                    <CardDescription>
                      {submissions.length} получени предавания
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingSubmissions ? (
                      <p className="text-center py-4">Зареждане на предадени задачи...</p>
                    ) : submissions.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Все Още Няма Предавания</h3>
                        <p className="text-gray-500">
                          Все още няма ученици, предали това задание.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ученик</TableHead>
                              <TableHead>Статус</TableHead>
                              <TableHead>Предадено</TableHead>
                              <TableHead>Оценка</TableHead>
                              <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {submissions.map((submission) => (
                              <TableRow key={submission.submissionId}>
                                <TableCell className="font-medium">
                                  {submission.studentName}
                                </TableCell>
                                <TableCell>
                                  {submission.status === "submitted" && (
                                    <Badge className="bg-green-50 text-green-600 border-green-200">
                                      Предадено
                                    </Badge>
                                  )}
                                  {submission.status === "late" && (
                                    <Badge className="bg-orange-50 text-orange-600 border-orange-200">
                                      Закъсняло
                                    </Badge>
                                  )}
                                  {submission.status === "resubmitted" && (
                                    <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                                      Повторно предадено
                                    </Badge>
                                  )}
                                  {submission.status === "graded" && (
                                    <Badge className="bg-purple-50 text-purple-600 border-purple-200">
                                      Оценено
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(submission.submittedAt.seconds * 1000), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>
                                  {submission.feedback?.grade !== undefined 
                                    ? submission.feedback.grade 
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setSelectedSubmission(submission)}
                                      >
                                        {submission.status === "graded" ? "Преглед" : "Оцени"}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                                      <DialogHeader>
                                        <DialogTitle>
                                          {submission.status === "graded" 
                                            ? "Преглед на Предаване" 
                                            : "Оценяване на Предаване"}
                                        </DialogTitle>
                                        <DialogDescription>
                                          Предаване от {submission.studentName}
                                        </DialogDescription>
                                      </DialogHeader>
                                      
                                      <div className="space-y-4 my-4">
                                        <div className="p-4 bg-gray-50 rounded-md">
                                          <h3 className="text-sm font-medium mb-2">Предаване на Ученика:</h3>
                                          <p className="whitespace-pre-wrap text-sm">{submission.content}</p>
                                        </div>
                                        
                                        {submission.status === "graded" && submission.feedback ? (
                                          <div className="space-y-4">
                                            <div>
                                              <h3 className="text-sm font-medium mb-2">Вашата Обратна Връзка:</h3>
                                              <p className="whitespace-pre-wrap text-sm">{submission.feedback.comment}</p>
                                            </div>
                                            
                                            <div>
                                              <h3 className="text-sm font-medium mb-2">Оценка:</h3>
                                              <Badge className="bg-blue-100 text-blue-700">
                                                {submission.feedback.grade}
                                              </Badge>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            <div>
                                              <Label htmlFor="feedback">Обратна Връзка</Label>
                                              <Textarea
                                                id="feedback"
                                                placeholder="Въведете обратна връзка към ученика..."
                                                className="min-h-[100px]"
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                              />
                                            </div>
                                            
                                            <div>
                                              <Label htmlFor="grade">Оценка (2-6)</Label>
                                              <Input
                                                id="grade"
                                                placeholder="Въведете оценка..."
                                                className="max-w-[100px]"
                                                value={grade}
                                                onChange={(e) => setGrade(e.target.value)}
                                                type="number"
                                                min="2"
                                                max="6"
                                                step="0.5"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <DialogFooter>
                                        {submission.status !== "graded" && (
                                          <Button 
                                          variant={"outline"}
                                            onClick={handleGradeSubmission}
                                            disabled={isGrading || !feedback.trim() || !grade}
                                          >
                                            {isGrading ? "Записване..." : "Въведи Оценка"}
                                          </Button>
                                        )}
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Sidebar with assignment info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Детайли за Заданието</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Краен Срок</p>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-600" />
                      <span>
                        {format(new Date(assignment.dueDate.seconds * 1000), "MMMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Учител</p>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-600" />
                      <span>{assignment.teacherName}</span>
                    </div>
                  </div>
                  
                  {(user.role === "teacher" || user.role === "admin") && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Възложено На</p>
                      <div className="flex flex-col space-y-1 mt-1">
                        {assignment.classIds.length > 0 ? (
                          assignment.classIds.map((classId) => (
                            <Badge key={classId} variant="outline" className="justify-start mb-1">
                              {classes[classId] || classId}
                            </Badge>
                          ))
                        ) : assignment.studentIds.length > 0 ? (
                          <p className="text-sm">Възложено на {assignment.studentIds.length} {assignment.studentIds.length > 1 ? "конкретни ученици" : "конкретен ученик"}</p>
                        ) : (
                          <p className="text-sm text-gray-500">Няма посочени класове или ученици</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Настройки за Предаване</p>
                    <div className="flex flex-col space-y-2 mt-1">
                      <div className="flex items-start">
                        {assignment.allowLateSubmission ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        )}
                        <span className="text-sm">
                          Закъснели предавания {assignment.allowLateSubmission ? "разрешени" : "не са разрешени"}
                        </span>
                      </div>
                      
                      <div className="flex items-start">
                        {assignment.allowResubmission ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        )}
                        <span className="text-sm">
                          Повторни предавания {assignment.allowResubmission ? "разрешени" : "не са разрешени"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}