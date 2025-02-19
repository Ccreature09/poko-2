"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addSubject,
  deleteSubject,
  getSubjects,
} from "@/lib/subjectManagement";
import { toast } from "@/hooks/use-toast";
import type { Subject } from "@/lib/interfaces";

export function SubjectManagement() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSubjects = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const fetchedSubjects = await getSubjects(user.schoolId);
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error("Error fetching subjects:", error);
        toast({
          title: "Error",
          description: "Failed to fetch subjects. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;

    try {
      const newSubjectData: Subject = {
        subjectId: "", // This will be set by the server
        name: newSubject,
        description: "",
        teacherIds: [],
        studentIds: [],
      };
      await addSubject(user!.schoolId, newSubjectData);
      setNewSubject("");
      fetchSubjects();
      toast({
        title: "Success",
        description: "Subject added successfully.",
      });
    } catch (error) {
      console.error("Error adding subject:", error);
      toast({
        title: "Error",
        description: "Failed to add subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      await deleteSubject(user!.schoolId, subjectId);
      fetchSubjects();
      toast({
        title: "Success",
        description: "Subject deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast({
        title: "Error",
        description: "Failed to delete subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user || user.role !== "admin") {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject Management</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddSubject} className="space-y-4 mb-6">
          <div>
            <Label htmlFor="newSubject">New Subject</Label>
            <div className="flex space-x-2">
              <Input
                id="newSubject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Enter subject name"
                className="flex-grow"
              />
              <Button type="submit">Add Subject</Button>
            </div>
          </div>
        </form>

        {loading ? (
          <div>Loading subjects...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject Name</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.subjectId}>
                  <TableCell>{subject.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSubject(subject.subjectId)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
