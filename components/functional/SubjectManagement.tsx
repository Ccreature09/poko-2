"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
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

type Teachers = {
  id:string;
  name:string;
}
export function SubjectManagement() {
  const { user } = useUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState({ name: '', description: '', teacherIds: [] as string[] });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teachers[]>([]);

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
    <Card className="shadow-md">
      <CardHeader className="border-b bg-gray-50">
        <CardTitle className="text-xl text-gray-800">Управление на предмети</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={editingSubject ? handleUpdateSubject : handleAddSubject} className="space-y-5 mb-8 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingSubject ? 'Редактиране на предмет' : 'Добавяне на нов предмет'}
          </h3>
          
          <div>
            <Label htmlFor="subjectName" className="text-gray-700">Име на предмет</Label>
            <Input
              id="subjectName"
              value={editingSubject ? editingSubject.name : newSubject.name}
              onChange={(e) =>
                editingSubject
                  ? setEditingSubject({ ...editingSubject, name: e.target.value })
                  : setNewSubject({ ...newSubject, name: e.target.value })
              }
              placeholder="Въведете име на предмет"
              className="flex-grow mt-1"
              required
            />
          </div>
          
          <div>
            <Label className="text-gray-700 mb-1 block">Преподаватели</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between mt-1 bg-white border border-gray-200 hover:bg-gray-50">
                  <span className="truncate">
                    {editingSubject 
                      ? renderSelectedTeachers(editingSubject.teacherIds) || 'Изберете преподаватели'
                      : renderSelectedTeachers(newSubject.teacherIds) || 'Изберете преподаватели'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full max-h-60 overflow-auto">
                {teachers.length > 0 ? (
                  teachers.map((teacher) => (
                    <DropdownMenuItem 
                      key={teacher.id} 
                      onSelect={() => handleAssignTeacher(teacher.id)}
                      className="cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          checked={(editingSubject ? editingSubject.teacherIds : newSubject.teacherIds).includes(teacher.id)} 
                          readOnly 
                          className="mr-2"
                        />
                        {teacher.name}
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>Няма налични преподаватели</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              {editingSubject ? 'Запазване на промените' : 'Добавяне на предмет'}
            </Button>
            
            {editingSubject && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingSubject(null)} 
                className="border-gray-300 hover:bg-gray-50"
              >
                Отказ
              </Button>
            )}
          </div>
        </form>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-6 w-32 bg-gray-200 rounded mb-3"></div>
              <div className="h-24 w-full max-w-md bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Списък на предметите</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.length > 0 ? subjects.map((subject) => (
                <Card key={subject.subjectId} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardHeader className="bg-gray-50 border-b pb-3">
                    <CardTitle className="text-lg">{subject.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="mb-4">
                      <Label className="text-gray-700 font-medium">Преподаватели:</Label>
                      {subject.teacherIds.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {subject.teacherIds.map((teacherId) => {
                            const teacher = teachers.find((t) => t.id === teacherId);
                            return (
                              <li key={teacherId} className="flex items-center text-sm text-gray-600">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-2"></span>
                                {teacher ? teacher.name : 'Неизвестен преподавател'}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">Няма назначени преподаватели</p>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => handleEditSubject(subject)} 
                        className="bg-white border-gray-300 hover:bg-gray-50 flex-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                        </svg>
                        Редактиране
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => handleDeleteSubject(subject.subjectId)} 
                        className="hover:bg-red-700 text-white transition-colors flex-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                        Изтриване
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-full text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-500">Няма добавени предмети</p>
                  <p className="text-sm text-gray-400 mt-1">Използвайте формата по-горе, за да добавите предмети</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
