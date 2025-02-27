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
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [userSubmission, setUserSubmission] = useState<AssignmentSubmission | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [classes, setClasses] = useState<{[key: string]: string}>({});
  
  // Grade submission states
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmission | null>(null);
  const [feedback, setFeedback] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [isGrading, setIsGrading] = useState(false);
  
  const isAssignmentPast = assignment?.dueDate 
    ? new Date(assignment.dueDate.seconds * 1000) < new Date() 
    : false;

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId || !assignmentId) return;

      try {
        setLoading(true);
        // Fetch assignment details
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
        
        // Fetch class info for teacher view
        if (user.role === "teacher" || user.role === "admin") {
          setLoadingSubmissions(true);
          
          // Fetch class names
          const classesCollection = collection(db, "schools", user.schoolId, "classes");
          const classesSnapshot = await getDocs(classesCollection);
          const classesMap: {[key: string]: string} = {};
          classesSnapshot.docs.forEach((doc) => {
            classesMap[doc.id] = doc.data().className;
          });
          setClasses(classesMap);
          
          // Fetch submissions
          const submissionsData = await getSubmissions(user.schoolId, assignmentId as string);
          setSubmissions(submissionsData);
          setLoadingSubmissions(false);
        }
        
        // For student, check if they already submitted
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
      
      // Update local submissions
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
  
  // Helper function to check if student is allowed to submit
  const canSubmit = () => {
    if (!assignment) return false;
    
    const now = new Date();
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    
    // If not yet past due date, always allowed to submit
    if (now <= dueDate) return true;
    
    // If past due date, check if late submissions are allowed
    return assignment.allowLateSubmission;
  };
  
  // Helper function to check if student is allowed to resubmit
  const canResubmit = () => {
    if (!assignment || !userSubmission) return false;
    
    // If resubmission is not allowed at all
    if (!assignment.allowResubmission) return false;
    
    const now = new Date();
    const dueDate = new Date(assignment.dueDate.seconds * 1000);
    
    // If not yet past due date, allowed to resubmit
    if (now <= dueDate) return true;
    
    // If past due date, check if late submissions are allowed
    return assignment.allowLateSubmission;
  };

  if (!user) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Please log in to view this assignment.</p>
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
              <p>Loading assignment details...</p>
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
              <p>Assignment not found or you don&apos;t have permission to view it.</p>
              <Button asChild className="mt-4">
                <Link href="/assignments">Back to Assignments</Link>
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
              <ChevronLeft className="h-4 w-4 mr-1" /> Back to Assignments
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
                      Closed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              
              {user.role === "teacher" && assignment.teacherId === user.userId && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // TODO: Implement edit functionality
                      toast({
                        title: "Coming soon",
                        description: "Edit functionality will be available soon",
                      });
                    }}
                  >
                    Edit Assignment
                  </Button>
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
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {assignment.description ? (
                      <p className="whitespace-pre-wrap text-gray-700">{assignment.description}</p>
                    ) : (
                      <p className="text-gray-500 italic">No description provided</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Student Submission Section */}
              {user.role === "student" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Your Submission</CardTitle>
                    {userSubmission ? (
                      <CardDescription>
                        Submitted on {format(new Date(userSubmission.submittedAt.seconds * 1000), "MMMM d, yyyy 'at' h:mm a")}
                        {userSubmission.status === "late" && (
                          <span className="text-orange-500 ml-2">(Late submission)</span>
                        )}
                        {userSubmission.status === "resubmitted" && (
                          <span className="text-blue-500 ml-2">(Resubmitted)</span>
                        )}
                      </CardDescription>
                    ) : (
                      <CardDescription>
                        {canSubmit() 
                          ? "You haven't submitted this assignment yet" 
                          : "The deadline for this assignment has passed"}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {userSubmission && userSubmission.status === "graded" && userSubmission.feedback ? (
                      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <h4 className="font-medium mb-2 flex items-center">
                          <FileCheck className="h-4 w-4 mr-2 text-blue-500" />
                          Teacher Feedback
                        </h4>
                        <p className="text-sm mb-3">{userSubmission.feedback.comment}</p>
                        {userSubmission.feedback.grade !== undefined && (
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">Grade:</span>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                              {userSubmission.feedback.grade}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : null}
                    
                    <Textarea
                      placeholder="Enter your submission here..."
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
                          <p className="text-red-500 text-sm">The deadline for this assignment has passed</p>
                        ) : (
                          <Button 
                            onClick={handleSubmit} 
                            disabled={submitting || content.trim() === ""}
                          >
                            {submitting 
                              ? "Submitting..." 
                              : userSubmission 
                                ? "Resubmit Assignment" 
                                : "Submit Assignment"
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
                    <CardTitle>Student Submissions</CardTitle>
                    <CardDescription>
                      {submissions.length} submissions received
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingSubmissions ? (
                      <p className="text-center py-4">Loading submissions...</p>
                    ) : submissions.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Submissions Yet</h3>
                        <p className="text-gray-500">
                          No students have submitted this assignment yet.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Submitted</TableHead>
                              <TableHead>Grade</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
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
                                      Submitted
                                    </Badge>
                                  )}
                                  {submission.status === "late" && (
                                    <Badge className="bg-orange-50 text-orange-600 border-orange-200">
                                      Late
                                    </Badge>
                                  )}
                                  {submission.status === "resubmitted" && (
                                    <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                                      Resubmitted
                                    </Badge>
                                  )}
                                  {submission.status === "graded" && (
                                    <Badge className="bg-purple-50 text-purple-600 border-purple-200">
                                      Graded
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
                                        {submission.status === "graded" ? "Review" : "Grade"}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                                      <DialogHeader>
                                        <DialogTitle>
                                          {submission.status === "graded" 
                                            ? "Review Submission" 
                                            : "Grade Submission"}
                                        </DialogTitle>
                                        <DialogDescription>
                                          Submission from {submission.studentName}
                                        </DialogDescription>
                                      </DialogHeader>
                                      
                                      <div className="space-y-4 my-4">
                                        <div className="p-4 bg-gray-50 rounded-md">
                                          <h3 className="text-sm font-medium mb-2">Student Submission:</h3>
                                          <p className="whitespace-pre-wrap text-sm">{submission.content}</p>
                                        </div>
                                        
                                        {submission.status === "graded" && submission.feedback ? (
                                          <div className="space-y-4">
                                            <div>
                                              <h3 className="text-sm font-medium mb-2">Your Feedback:</h3>
                                              <p className="whitespace-pre-wrap text-sm">{submission.feedback.comment}</p>
                                            </div>
                                            
                                            <div>
                                              <h3 className="text-sm font-medium mb-2">Grade:</h3>
                                              <Badge className="bg-blue-100 text-blue-700">
                                                {submission.feedback.grade}
                                              </Badge>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            <div>
                                              <Label htmlFor="feedback">Feedback</Label>
                                              <Textarea
                                                id="feedback"
                                                placeholder="Provide feedback to the student..."
                                                className="min-h-[100px]"
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                              />
                                            </div>
                                            
                                            <div>
                                              <Label htmlFor="grade">Grade (2-6)</Label>
                                              <Input
                                                id="grade"
                                                placeholder="Enter grade..."
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
                                            onClick={handleGradeSubmission}
                                            disabled={isGrading || !feedback.trim() || !grade}
                                          >
                                            {isGrading ? "Saving..." : "Submit Grade"}
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
                  <CardTitle>Assignment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Due Date</p>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-600" />
                      <span>
                        {format(new Date(assignment.dueDate.seconds * 1000), "MMMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Teacher</p>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-600" />
                      <span>{assignment.teacherName}</span>
                    </div>
                  </div>
                  
                  {(user.role === "teacher" || user.role === "admin") && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Assigned To</p>
                      <div className="flex flex-col space-y-1 mt-1">
                        {assignment.classIds.length > 0 ? (
                          assignment.classIds.map((classId) => (
                            <Badge key={classId} variant="outline" className="justify-start mb-1">
                              {classes[classId] || classId}
                            </Badge>
                          ))
                        ) : assignment.studentIds.length > 0 ? (
                          <p className="text-sm">Assigned to {assignment.studentIds.length} specific students</p>
                        ) : (
                          <p className="text-sm text-gray-500">No classes or students specified</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Submission Settings</p>
                    <div className="flex flex-col space-y-2 mt-1">
                      <div className="flex items-start">
                        {assignment.allowLateSubmission ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        )}
                        <span className="text-sm">
                          Late submissions {assignment.allowLateSubmission ? "allowed" : "not allowed"}
                        </span>
                      </div>
                      
                      <div className="flex items-start">
                        {assignment.allowResubmission ? (
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2 text-red-500 mt-0.5" />
                        )}
                        <span className="text-sm">
                          Resubmissions {assignment.allowResubmission ? "allowed" : "not allowed"}
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