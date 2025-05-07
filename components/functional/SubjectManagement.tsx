/**
 * Компонент за управление на учебните предмети
 *
 * Предоставя административен интерфейс за:
 * - Добавяне на нови предмети
 * - Редактиране на съществуващи предмети
 * - Изтриване на предмети
 * - Назначаване на преподаватели към предмети
 *
 * Функционалности:
 * - Динамично зареждане на списък с преподаватели
 * - Множествен избор на преподаватели за всеки предмет
 * - Валидация на формите
 * - Потвърждения за успешни операции
 * - Защита на достъпа само за администратори
 */

"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  addSubject,
  deleteSubject,
  getSubjects,
} from "@/lib/management/subjectManagement";
import { toast } from "@/hooks/use-toast";
import type { Subject } from "@/lib/interfaces";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  doc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Teachers = {
  id: string;
  name: string;
};

export function SubjectManagement() {
  // This component is kept for backward compatibility
  return <SubjectManagementOverview />;
}

export function SubjectManagementOverview() {
  const { user } = useUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState({
    name: "",
    description: "",
    teacherSubjectPairs: [] as Array<{ teacherId: string; subjectId: string }>,
    weeklyHours: 0,
    category: "core", // core, elective, specialized
  });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teachers[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddSubjectDialogOpen, setIsAddSubjectDialogOpen] = useState(false);
  const [isEditSubjectDialogOpen, setIsEditSubjectDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchSubjects = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const fetchedSubjects = await getSubjects(user.schoolId);
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error("Error fetching subjects:", error);
        toast({
          title: "Грешка",
          description:
            "Не успяхме да заредим предметите. Моля, опитайте отново.",
          variant: "destructive",
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
        }));
        setTeachers(fetchedTeachers);
      } catch (error) {
        console.error("Error fetching teachers:", error);
        toast({
          title: "Грешка",
          description:
            "Не успяхме да заредим учителите. Моля, опитайте отново.",
          variant: "destructive",
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
        subjectId: "", // This will be set by the server
        name: newSubject.name,
        description: newSubject.description,
        teacherSubjectPairs: newSubject.teacherSubjectPairs,
        category: newSubject.category || "core",
        weeklyHours: newSubject.weeklyHours || 0,
        studentIds: [],
      };
      await addSubject(user!.schoolId, newSubjectData);
      setNewSubject({
        name: "",
        description: "",
        teacherSubjectPairs: [],
        weeklyHours: 0,
        category: "core",
      });
      setIsAddSubjectDialogOpen(false);
      fetchSubjects();
      toast({
        title: "Успех",
        description: "Предметът е добавен успешно.",
      });
    } catch (error) {
      console.error("Error adding subject:", error);
      toast({
        title: "Грешка",
        description: "Не успяхме да добавим предмета. Моля, опитайте отново.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      await deleteSubject(user!.schoolId, subjectId);
      fetchSubjects();
      toast({
        title: "Успех",
        description: "Предметът е изтрит успешно.",
      });
    } catch (error) {
      console.error("Error deleting subject:", error);
      toast({
        title: "Грешка",
        description: "Не успяхме да изтрием предмета. Моля, опитайте отново.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId || !editingSubject) return;

    try {
      const subjectRef = doc(
        db,
        `schools/${user.schoolId}/subjects/${editingSubject.subjectId}`
      );
      await updateDoc(subjectRef, {
        name: editingSubject.name,
        description: editingSubject.description,
        teacherSubjectPairs: editingSubject.teacherSubjectPairs,
        category: editingSubject.category || "core",
        weeklyHours: editingSubject.weeklyHours || 0,
      });

      setSubjects(
        subjects.map((subject) =>
          subject.subjectId === editingSubject.subjectId
            ? editingSubject
            : subject
        )
      );
      setEditingSubject(null);
      setIsEditSubjectDialogOpen(false);
      toast({
        title: "Успех",
        description: "Предметът е обновен успешно.",
      });
    } catch (error) {
      console.error("Error updating subject:", error);
      toast({
        title: "Грешка",
        description: "Не успяхме да обновим предмета. Моля, опитайте отново.",
        variant: "destructive",
      });
    }
  };

  const handleAssignTeacher = (teacherId: string) => {
    if (editingSubject) {
      setEditingSubject((prev) => ({
        ...prev!,
        teacherSubjectPairs: prev!.teacherSubjectPairs.some(
          (pair) => pair.teacherId === teacherId
        )
          ? prev!.teacherSubjectPairs.filter(
              (pair) => pair.teacherId !== teacherId
            )
          : [
              ...prev!.teacherSubjectPairs,
              { teacherId, subjectId: prev!.subjectId || "" },
            ],
      }));
    } else {
      setNewSubject((prev) => ({
        ...prev,
        teacherSubjectPairs: prev.teacherSubjectPairs.some(
          (pair) => pair.teacherId === teacherId
        )
          ? prev.teacherSubjectPairs.filter(
              (pair) => pair.teacherId !== teacherId
            )
          : [...prev.teacherSubjectPairs, { teacherId, subjectId: "" }],
      }));
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setIsEditSubjectDialogOpen(true);
  };

  // Filter and search subjects
  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch = subject.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || subject.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get category label
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "core":
        return "Основен";
      case "elective":
        return "Избираем";
      case "specialized":
        return "Профилиран";
      default:
        return "Основен";
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "core":
        return "bg-blue-100 text-blue-800";
      case "elective":
        return "bg-green-100 text-green-800";
      case "specialized":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Update the dropdown to show selected teachers
  const renderSelectedTeachers = (
    teacherPairs: Array<{ teacherId: string; subjectId: string }>
  ) => {
    if (teacherPairs.length === 0) return "";

    if (teacherPairs.length === 1) {
      const teacher = teachers.find((t) => t.id === teacherPairs[0].teacherId);
      return teacher ? teacher.name : "Неизвестен учител";
    }

    return `${teacherPairs.length} избрани учители`;
  };

  if (!user || user.role !== "admin") {
    return <div>Достъпът е отказан. Изисква се администраторски достъп.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 p-6 bg-white rounded-lg shadow">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Списък на предметите</h2>
          <p className="text-gray-500">
            Управление на всички предмети в училището
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Търсене на предмет..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Всички типове" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички типове</SelectItem>
              <SelectItem value="core">Основни</SelectItem>
              <SelectItem value="elective">Избираеми</SelectItem>
              <SelectItem value="specialized">Профилирани</SelectItem>
            </SelectContent>
          </Select>

          <Dialog
            open={isAddSubjectDialogOpen}
            onOpenChange={setIsAddSubjectDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Добавяне на предмет
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleAddSubject}>
                <DialogHeader>
                  <DialogTitle>Добавяне на нов предмет</DialogTitle>
                  <DialogDescription>
                    Попълнете информацията за новия учебен предмет и назначете
                    преподаватели.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Име на предмет</Label>
                    <Input
                      id="name"
                      placeholder="Въведете име на предмет"
                      value={newSubject.name}
                      onChange={(e) =>
                        setNewSubject({ ...newSubject, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      placeholder="Кратко описание на предмета"
                      value={newSubject.description}
                      onChange={(e) =>
                        setNewSubject({
                          ...newSubject,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Категория</Label>
                    <Select
                      value={newSubject.category}
                      onValueChange={(value) =>
                        setNewSubject({ ...newSubject, category: value })
                      }
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Изберете категория" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Основен</SelectItem>
                        <SelectItem value="elective">Избираем</SelectItem>
                        <SelectItem value="specialized">Профилиран</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weeklyHours">Часове седмично</Label>
                    <Input
                      id="weeklyHours"
                      type="number"
                      min="0"
                      max="20"
                      placeholder="Брой часове"
                      value={newSubject.weeklyHours.toString()}
                      onChange={(e) =>
                        setNewSubject({
                          ...newSubject,
                          weeklyHours: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Назначени преподаватели</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <span>
                            {renderSelectedTeachers(
                              newSubject.teacherSubjectPairs
                            ) || "Изберете преподаватели"}
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="ml-2"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 max-h-56 overflow-auto">
                        <DropdownMenuLabel>Преподаватели</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {teachers.length > 0 ? (
                          teachers.map((teacher) => (
                            <DropdownMenuCheckboxItem
                              key={teacher.id}
                              checked={newSubject.teacherSubjectPairs.some(
                                (pair) => pair.teacherId === teacher.id
                              )}
                              onCheckedChange={() =>
                                handleAssignTeacher(teacher.id)
                              }
                            >
                              {teacher.name}
                            </DropdownMenuCheckboxItem>
                          ))
                        ) : (
                          <DropdownMenuItem disabled>
                            Няма налични преподаватели
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Отказ</Button>
                  </DialogClose>
                  <Button type="submit">Добавяне</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-lg shadow animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="mt-6 flex space-x-3">
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {filteredSubjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubjects.map((subject) => (
                <Card
                  key={subject.subjectId}
                  className="shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{subject.name}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {subject.description || "Няма описание"}
                        </CardDescription>
                      </div>
                      <div
                        className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(
                          subject.category || "core"
                        )}`}
                      >
                        {getCategoryLabel(subject.category || "core")}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Часове седмично
                        </p>
                        <p className="text-sm">{subject.weeklyHours || 0}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Преподаватели
                        </p>
                        {subject.teacherSubjectPairs &&
                        subject.teacherSubjectPairs.length > 0 ? (
                          <div className="space-y-1 mt-1">
                            {subject.teacherSubjectPairs.map((pair) => {
                              const teacher = teachers.find(
                                (t) => t.id === pair.teacherId
                              );
                              return (
                                <p
                                  key={pair.teacherId}
                                  className="text-sm flex items-center"
                                >
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-2"></span>
                                  {teacher
                                    ? teacher.name
                                    : "Неизвестен преподавател"}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">
                            Няма назначени преподаватели
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2 border-t">
                    <Dialog
                      open={
                        isEditSubjectDialogOpen &&
                        editingSubject?.subjectId === subject.subjectId
                      }
                      onOpenChange={(open) => {
                        if (!open) setEditingSubject(null);
                        setIsEditSubjectDialogOpen(open);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSubject(subject)}
                        >
                          Редактиране
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        {editingSubject && (
                          <form onSubmit={handleUpdateSubject}>
                            <DialogHeader>
                              <DialogTitle>Редактиране на предмет</DialogTitle>
                              <DialogDescription>
                                Променете информацията за предмета и назначените
                                преподаватели.
                              </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-name">
                                  Име на предмет
                                </Label>
                                <Input
                                  id="edit-name"
                                  placeholder="Въведете име на предмет"
                                  value={editingSubject.name}
                                  onChange={(e) =>
                                    setEditingSubject({
                                      ...editingSubject,
                                      name: e.target.value,
                                    })
                                  }
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-description">
                                  Описание
                                </Label>
                                <Textarea
                                  id="edit-description"
                                  placeholder="Кратко описание на предмета"
                                  value={editingSubject.description || ""}
                                  onChange={(e) =>
                                    setEditingSubject({
                                      ...editingSubject,
                                      description: e.target.value,
                                    })
                                  }
                                  rows={3}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-category">Категория</Label>
                                <Select
                                  value={editingSubject.category || "core"}
                                  onValueChange={(value) =>
                                    setEditingSubject({
                                      ...editingSubject,
                                      category: value,
                                    })
                                  }
                                >
                                  <SelectTrigger id="edit-category">
                                    <SelectValue placeholder="Изберете категория" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="core">
                                      Основен
                                    </SelectItem>
                                    <SelectItem value="elective">
                                      Избираем
                                    </SelectItem>
                                    <SelectItem value="specialized">
                                      Профилиран
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="edit-weeklyHours">
                                  Часове седмично
                                </Label>
                                <Input
                                  id="edit-weeklyHours"
                                  type="number"
                                  min="0"
                                  max="20"
                                  placeholder="Брой часове"
                                  value={(
                                    editingSubject.weeklyHours || 0
                                  ).toString()}
                                  onChange={(e) =>
                                    setEditingSubject({
                                      ...editingSubject,
                                      weeklyHours:
                                        parseInt(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Назначени преподаватели</Label>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-between"
                                    >
                                      <span>
                                        {renderSelectedTeachers(
                                          editingSubject.teacherSubjectPairs
                                        ) || "Изберете преподаватели"}
                                      </span>
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="ml-2"
                                      >
                                        <path d="m6 9 6 6 6-6" />
                                      </svg>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-56 max-h-56 overflow-auto">
                                    <DropdownMenuLabel>
                                      Преподаватели
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {teachers.length > 0 ? (
                                      teachers.map((teacher) => (
                                        <DropdownMenuCheckboxItem
                                          key={teacher.id}
                                          checked={editingSubject.teacherSubjectPairs.some(
                                            (pair) =>
                                              pair.teacherId === teacher.id
                                          )}
                                          onCheckedChange={() =>
                                            handleAssignTeacher(teacher.id)
                                          }
                                        >
                                          {teacher.name}
                                        </DropdownMenuCheckboxItem>
                                      ))
                                    ) : (
                                      <DropdownMenuItem disabled>
                                        Няма налични преподаватели
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            <DialogFooter>
                              <DialogClose asChild>
                                <Button
                                  variant="outline"
                                  onClick={() => setEditingSubject(null)}
                                >
                                  Отказ
                                </Button>
                              </DialogClose>
                              <Button type="submit">Запазване</Button>
                            </DialogFooter>
                          </form>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Изтриване
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Сигурни ли сте?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Това действие ще изтрие предмета &quot;
                            {subject.name}&quot; и не може да бъде отменено.
                            Всички асоциирани данни като разписания и оценки
                            също ще бъдат засегнати.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отказ</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleDeleteSubject(subject.subjectId)
                            }
                            className="bg-red-600 hover:bg-red-700 text-white transition-colors"
                          >
                            Изтриване
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Няма намерени предмети
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {searchQuery || categoryFilter !== "all"
                  ? "Няма предмети, които отговарят на търсенето. Опитайте с различни критерии."
                  : 'Все още няма добавени предмети. Използвайте бутона "Добавяне на предмет", за да създадете нов.'}
              </p>
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  if (!subjects.length) {
                    setIsAddSubjectDialogOpen(true);
                  }
                }}
                variant={subjects.length ? "outline" : "default"}
              >
                {subjects.length
                  ? "Изчистване на търсенето"
                  : "Добавяне на предмет"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
