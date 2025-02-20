"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addSubject,
  deleteSubject,
  getSubjects,
} from "@/lib/subjectManagement";
import { toast } from "@/hooks/use-toast";
import type { Subject } from "@/lib/interfaces";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from "@/lib/firebase";

export function SubjectManagement() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState({ name: '', description: '', teacherIds: [] as string[] });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);

  const fetchSubjects = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const fetchedSubjects = await getSubjects(user.schoolId);
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch subjects. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
  }, [user]);

  const fetchTeachers = useCallback(async () => {
    if (user) {
      try {
        const teachersRef = collection(db, "schools", user.schoolId, "users");
        const q = query(teachersRef, where("role", "==", "teacher"));
        const querySnapshot = await getDocs(q);
        const fetchedTeachers = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: `${doc.data().firstName} ${doc.data().lastName}`,
          ...doc.data(),
        }));
        console.log('Fetched Teachers:', fetchedTeachers); // Add this line
        setTeachers(fetchedTeachers);
      } catch (error) {
        console.error('Error fetching teachers:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch teachers. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [user]);

  useEffect(() => {
    fetchSubjects();
    fetchTeachers();
  }, [fetchSubjects, fetchTeachers]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name.trim()) return;

    try {
      const newSubjectData: Subject = {
        subjectId: '', // This will be set by the server
        name: newSubject.name,
        description: newSubject.description,
        teacherIds: newSubject.teacherIds,
        studentIds: [],
      };
      await addSubject(user!.schoolId, newSubjectData);
      setNewSubject({ name: '', description: '', teacherIds: [] });
      fetchSubjects();
      toast({
        title: 'Success',
        description: 'Subject added successfully.',
      });
    } catch (error) {
      console.error('Error adding subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to add subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      await deleteSubject(user!.schoolId, subjectId);
      fetchSubjects();
      toast({
        title: 'Success',
        description: 'Subject deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId || !editingSubject) return;
    console.log("handleUpdateSubject called");
   
    console.log("Editing Subject ID:", editingSubject);
    try {
      const subjectRef = doc(db, `schools/${user.schoolId}/subjects/${editingSubject.subjectId}`);
      console.log("Subject Reference:", subjectRef);
      await updateDoc(subjectRef, {
        name: editingSubject.name,
        description: editingSubject.description,
        teacherIds: editingSubject.teacherIds,
      });
      console.log("Subject updated successfully");
      setSubjects(subjects.map((subject) => (subject.subjectId === editingSubject.subjectId ? editingSubject : subject)));
      setEditingSubject(null);
      toast({
        title: 'Success',
        description: 'Subject updated successfully.',
      });
    } catch (error) {
      console.error('Error updating subject:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAssignTeacher = (teacherId: string) => {
    if (editingSubject) {
      setEditingSubject((prev) => ({
        ...prev!,
        teacherIds: prev!.teacherIds.includes(teacherId)
          ? prev!.teacherIds.filter((id) => id !== teacherId)
          : [...prev!.teacherIds, teacherId],
      }));
    } else {
      setNewSubject((prev) => ({
        ...prev,
        teacherIds: prev.teacherIds.includes(teacherId)
          ? prev.teacherIds.filter((id) => id !== teacherId)
          : [...prev.teacherIds, teacherId],
      }));
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
  };

  // Update the dropdown to show selected teachers
  const renderSelectedTeachers = (teacherIds: string[]) => {
    return teacherIds.map((teacherId) => {
      const teacher = teachers.find((t) => t.id === teacherId);
      return teacher ? teacher.name : 'Unknown Teacher';
    }).join(', ');
  };

  if (!user || user.role !== 'admin') {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject Management</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={editingSubject ? handleUpdateSubject : handleAddSubject} className="space-y-4 mb-6">
          <div>
            <Label htmlFor="subjectName">Subject Name</Label>
            <Input
              id="subjectName"
              value={editingSubject ? editingSubject.name : newSubject.name}
              onChange={(e) =>
                editingSubject
                  ? setEditingSubject({ ...editingSubject, name: e.target.value })
                  : setNewSubject({ ...newSubject, name: e.target.value })
              }
              placeholder="Enter subject name"
              className="flex-grow"
              required
            />
          </div>
          <div>
            <Label>Assign Teachers</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {editingSubject ? renderSelectedTeachers(editingSubject.teacherIds) : renderSelectedTeachers(newSubject.teacherIds) || 'Select Teachers'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {teachers.map((teacher: any) => (
                  <DropdownMenuItem key={teacher.id} onSelect={() => handleAssignTeacher(teacher.id)}>
                    {teacher.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button variant={"outline"} type="submit">{editingSubject ? 'Update Subject' : 'Add Subject'}</Button>
          {editingSubject && (
            <Button type="button" variant="outline" onClick={() => setEditingSubject(null)}>
              Cancel
            </Button>
          )}
        </form>

        {loading ? (
          <div>Loading subjects...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => (
              <Card key={subject.subjectId} className="relative">
                <CardHeader>
                  <CardTitle>{subject.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Label>Teachers:</Label>
                    <ul>
                      {subject.teacherIds.map((teacherId) => {
                        const teacher = teachers.find((t: any) => t.id === teacherId);
                        return <li key={teacherId}>{teacher ? teacher.name : 'Unknown Teacher'}</li>;
                      })}
                    </ul>
                  </div>
                  <Button variant="outline" onClick={() => handleEditSubject(subject)}>
                    Edit
                  </Button>
                  <Button variant="destructive" onClick={() => handleDeleteSubject(subject.subjectId)} className="ml-2">
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
