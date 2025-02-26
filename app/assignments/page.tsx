"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { format } from "date-fns";
import { getAssignments, getStudentAssignments } from "@/lib/assignmentManagement";
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
import { Calendar, Clock, Plus, FileText, Users, Check, AlertTriangle, FileCheck } from "lucide-react";

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

        // Split into active and past assignments based on due date
        const now = new Date();
        const active: Assignment[] = [];
        const past: Assignment[] = [];

        assignments.forEach((assignment) => {
          const dueDate = new Date(assignment.dueDate.seconds * 1000);
          if (dueDate >= now) {
            active.push(assignment);
          } else {
            past.push(assignment);
          }
        });

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
                Due Soon
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Subject: {assignment.subjectName}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm mb-4 text-gray-600 line-clamp-2">
            {assignment.description}
          </p>
          
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar className="h-4 w-4 mr-2" />
            <span>Due: {format(dueDate, "MMMM d, yyyy")}</span>
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
                  ? `${assignment.classIds.length} ${assignment.classIds.length === 1 ? 'class' : 'classes'}`
                  : 'Specific students'}
              </span>
            </div>
          )}
          
          {isPast && user?.role === "teacher" && (
            <div className="mt-4">
              <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100">
                View Submissions
              </Badge>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <div className="flex text-xs text-gray-500">
            {user?.role === "teacher" ? (
              <span>Created by you</span>
            ) : (
              <span>Created by {assignment.teacherName}</span>
            )}
          </div>
          
          <Link href={`/assignments/${assignment.assignmentId}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              {user?.role === "student" ? (
                <>
                  {isPast ? <FileCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {isPast ? "View" : "Submit"}
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  View Details
                </>
              )}
            </Button>
          </Link>
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
            <h1 className="text-3xl font-bold text-gray-800">Assignments</h1>
            
            {user.role === "teacher" && (
              <Link href="/create-assignment">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Assignment
                </Button>
              </Link>
            )}
          </div>

          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active Assignments</TabsTrigger>
              <TabsTrigger value="past">Past Assignments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <p>Loading assignments...</p>
                </div>
              ) : activeAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">No Active Assignments</h3>
                      {user.role === "teacher" ? (
                        <p className="text-gray-500 mb-4">
                          You haven't created any active assignments yet.
                        </p>
                      ) : (
                        <p className="text-gray-500 mb-4">
                          You don't have any active assignments right now.
                        </p>
                      )}
                      
                      {user.role === "teacher" && (
                        <Link href="/create-assignment">
                          <Button>Create Assignment</Button>
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
                  <p>Loading past assignments...</p>
                </div>
              ) : pastAssignments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-300" />
                      <h3 className="text-lg font-medium">No Past Assignments</h3>
                      <p className="text-gray-500">
                        You don't have any past assignments.
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
