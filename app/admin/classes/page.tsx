"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, X, Loader2 } from "lucide-react";

interface ClassFormData {
  classId?: string;
  name: string;
  namingType: "standard" | "custom";
  gradeLevel: number;
  section: string;
  educationLevel: "primary" | "middle" | "high";
  teacherSubjectPairs: {
    teacherId: string;
    subjectId: string;
    isHomeroom?: boolean;
  }[];
  students: string[];
  academicYear: string;
}

interface HomeroomClass {
  classId: string;
  name: string;
  gradeLevel: number;
  section: string;
  educationLevel: "primary" | "middle" | "high";
  teacherSubjectPairs: {
    teacherId: string;
    subjectId: string;
    isHomeroom?: boolean;
  }[];
  students: string[];
  academicYear: string;
  createdAt: Timestamp;
}

interface TeacherData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface SubjectData {
  subjectId: string;
  name: string;
  description: string;
}

export default function ClassManagement() {
  const { user } = useUser();
  const router = useRouter();

  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<HomeroomClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [teacherSubjectMappings, setTeacherSubjectMappings] = useState<{
    teacherToSubjects: Record<string, string[]>;
    subjectToTeachers: Record<string, string[]>;
  }>({
    teacherToSubjects: {},
    subjectToTeachers: {},
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [educationLevelFilter, setEducationLevelFilter] =
    useState<string>("all");

  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  const [isEditClassDialogOpen, setIsEditClassDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [classFormData, setClassFormData] = useState<ClassFormData>({
    name: "",
    namingType: "standard",
    gradeLevel: 1,
    section: "A",
    educationLevel: "primary",
    teacherSubjectPairs: [{ teacherId: "", subjectId: "", isHomeroom: true }],
    students: [],
    academicYear:
      new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
  });

  const [selectedClass, setSelectedClass] = useState<HomeroomClass | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/login");
    } else {
      fetchClasses();
      fetchTeachers();
      fetchSubjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  useEffect(() => {
    if (classes.length > 0 && teachers.length > 0 && subjects.length > 0) {
      const teacherToSubjects: Record<string, string[]> = {};
      const subjectToTeachers: Record<string, string[]> = {};

      teachers.forEach((teacher) => {
        teacherToSubjects[teacher.userId] = [];
      });

      subjects.forEach((subject) => {
        subjectToTeachers[subject.subjectId] = [];
      });

      classes.forEach((cls) => {
        if (cls.teacherSubjectPairs && cls.teacherSubjectPairs.length > 0) {
          cls.teacherSubjectPairs.forEach((pair) => {
            const { teacherId, subjectId } = pair;

            if (
              teacherId &&
              subjectId &&
              teacherToSubjects[teacherId] &&
              !teacherToSubjects[teacherId].includes(subjectId)
            ) {
              teacherToSubjects[teacherId].push(subjectId);
            }

            if (
              teacherId &&
              subjectId &&
              subjectToTeachers[subjectId] &&
              !subjectToTeachers[subjectId].includes(teacherId)
            ) {
              subjectToTeachers[subjectId].push(teacherId);
            }
          });
        }
      });

      setTeacherSubjectMappings({
        teacherToSubjects,
        subjectToTeachers,
      });
    }
  }, [classes, teachers, subjects]);

  useEffect(() => {
    let result = [...classes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((cls) => cls.name.toLowerCase().includes(query));
    }

    if (educationLevelFilter !== "all") {
      result = result.filter(
        (cls) => cls.educationLevel === educationLevelFilter
      );
    }

    result.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) {
        return a.gradeLevel - b.gradeLevel;
      }
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    setFilteredClasses(result);
  }, [classes, searchQuery, educationLevelFilter]);

  const fetchClasses = async () => {
    if (!user?.schoolId) return;

    setIsLoading(true);
    try {
      const classesRef = collection(
        doc(db, "schools", user.schoolId),
        "classes"
      );
      const snapshot = await getDocs(classesRef);

      const fetchedClasses: HomeroomClass[] = [];
      snapshot.forEach((doc) => {
        const classData = doc.data() as HomeroomClass;
        fetchedClasses.push({
          ...classData,
          classId: doc.id,
        });
      });

      setClasses(fetchedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast({
        title: "Error",
        description: "Failed to load classes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeachers = async () => {
    if (!user?.schoolId) return;

    try {
      const usersRef = collection(doc(db, "schools", user.schoolId), "users");
      const teachersQuery = query(usersRef, where("role", "==", "teacher"));
      const snapshot = await getDocs(teachersQuery);

      const fetchedTeachers: TeacherData[] = [];
      snapshot.forEach((doc) => {
        const teacherData = doc.data() as TeacherData;
        fetchedTeachers.push({
          ...teacherData,
          userId: doc.id,
        });
      });

      setTeachers(fetchedTeachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const fetchSubjects = async () => {
    if (!user?.schoolId) return;

    try {
      const subjectsRef = collection(
        doc(db, "schools", user.schoolId),
        "subjects"
      );
      const snapshot = await getDocs(subjectsRef);

      const fetchedSubjects: SubjectData[] = [];
      snapshot.forEach((doc) => {
        const subjectData = doc.data() as SubjectData;
        fetchedSubjects.push({
          ...subjectData,
          subjectId: doc.id,
        });
      });

      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const updateClassName = () => {
    if (classFormData.namingType === "standard") {
      const gradeName = classFormData.gradeLevel.toString();
      const sectionName = classFormData.section;
      setClassFormData((prev) => ({
        ...prev,
        name: gradeName + sectionName,
      }));
    }
  };

  useEffect(() => {
    if (classFormData.namingType === "standard") {
      updateClassName();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    classFormData.gradeLevel,
    classFormData.section,
    classFormData.namingType,
  ]);

  const handleAddTeacherSubjectPair = () => {
    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: [
        ...prev.teacherSubjectPairs,
        { teacherId: "", subjectId: "", isHomeroom: false },
      ],
    }));
  };

  const handleRemoveTeacherSubjectPair = (index: number) => {
    if (classFormData.teacherSubjectPairs.length <= 1) return;

    const newPairs = [...classFormData.teacherSubjectPairs];
    newPairs.splice(index, 1);

    const hasHomeroom = newPairs.some((pair) => pair.isHomeroom);
    if (!hasHomeroom && newPairs.length > 0) {
      newPairs[0].isHomeroom = true;
    }

    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: newPairs,
    }));
  };

  const handleTeacherSubjectPairChange = (
    index: number,
    field: string,
    value: string | boolean
  ) => {
    const newPairs = [...classFormData.teacherSubjectPairs];

    if (field === "isHomeroom" && value === true) {
      newPairs.forEach((pair, i) => {
        if (i !== index) {
          pair.isHomeroom = false;
        }
      });
    }

    newPairs[index] = {
      ...newPairs[index],
      [field]: value,
    };

    setClassFormData((prev) => ({
      ...prev,
      teacherSubjectPairs: newPairs,
    }));
  };

  const getFilteredTeachers = (pairIndex: number): TeacherData[] => {
    const currentPair = classFormData.teacherSubjectPairs[pairIndex];

    // If no subject is selected, show all teachers
    if (!currentPair.subjectId) {
      return teachers;
    }

    // When editing a class, we should include the currently assigned teacher
    // even if they don't usually teach this subject
    if (isEditClassDialogOpen && currentPair.teacherId) {
      const teacherIds = [
        ...(teacherSubjectMappings.subjectToTeachers[currentPair.subjectId] ||
          []),
      ];
      if (!teacherIds.includes(currentPair.teacherId)) {
        teacherIds.push(currentPair.teacherId);
      }
      return teachers.filter((teacher) => teacherIds.includes(teacher.userId));
    }

    // Get teachers who teach this subject
    const teacherIds =
      teacherSubjectMappings.subjectToTeachers[currentPair.subjectId] || [];

    // If no teacher has taught this subject before, show all teachers
    if (teacherIds.length === 0) {
      return teachers;
    }

    // Return only teachers that teach this subject
    return teachers.filter((teacher) => teacherIds.includes(teacher.userId));
  };

  const getFilteredSubjects = (pairIndex: number): SubjectData[] => {
    const currentPair = classFormData.teacherSubjectPairs[pairIndex];

    // If no teacher is selected, show all subjects
    if (!currentPair.teacherId) {
      return subjects;
    }

    // When editing a class, we should include the currently assigned subject
    // even if the teacher doesn't usually teach it
    if (isEditClassDialogOpen && currentPair.subjectId) {
      const subjectIds = [
        ...(teacherSubjectMappings.teacherToSubjects[currentPair.teacherId] ||
          []),
      ];
      if (!subjectIds.includes(currentPair.subjectId)) {
        subjectIds.push(currentPair.subjectId);
      }
      return subjects.filter((subject) =>
        subjectIds.includes(subject.subjectId)
      );
    }

    // Get subjects that this teacher teaches
    const subjectIds =
      teacherSubjectMappings.teacherToSubjects[currentPair.teacherId] || [];

    // If this teacher hasn't taught any subjects before, show all subjects
    if (subjectIds.length === 0) {
      return subjects;
    }

    // Return only subjects taught by this teacher
    return subjects.filter((subject) => subjectIds.includes(subject.subjectId));
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;

    if (
      classFormData.teacherSubjectPairs.some(
        (pair) => !pair.teacherId || !pair.subjectId
      )
    ) {
      toast({
        title: "Error",
        description:
          "All teacher-subject pairs must have both teacher and subject selected",
        variant: "destructive",
      });
      return;
    }

    const homeroomTeachers = classFormData.teacherSubjectPairs.filter(
      (pair) => pair.isHomeroom
    );
    if (homeroomTeachers.length !== 1) {
      toast({
        title: "Error",
        description: "There must be exactly one homeroom teacher for the class",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const classesRef = collection(
        doc(db, "schools", user.schoolId),
        "classes"
      );

      const nameCheckQuery = query(
        classesRef,
        where("name", "==", classFormData.name)
      );
      const nameCheck = await getDocs(nameCheckQuery);

      if (!nameCheck.empty) {
        toast({
          title: "Error",
          description: "A class with this name already exists",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const newClassData = {
        name: classFormData.name,
        gradeLevel: classFormData.gradeLevel,
        section: classFormData.section,
        educationLevel: classFormData.educationLevel,
        teacherSubjectPairs: classFormData.teacherSubjectPairs,
        students: [],
        academicYear: classFormData.academicYear,
        createdAt: Timestamp.now(),
      };

      await addDoc(classesRef, newClassData);

      for (const pair of classFormData.teacherSubjectPairs) {
        const teacherRef = doc(
          db,
          "schools",
          user.schoolId,
          "users",
          pair.teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          const teachesClasses = teacherData.teachesClasses || [];

          if (!teachesClasses.includes(classFormData.name)) {
            await updateDoc(teacherRef, {
              teachesClasses: [...teachesClasses, classFormData.name],
            });
          }
        }
      }

      toast({
        title: "Success",
        description: "Class created successfully",
      });

      setClassFormData({
        name: "",
        namingType: "standard",
        gradeLevel: 1,
        section: "A",
        educationLevel: "primary",
        teacherSubjectPairs: [
          { teacherId: "", subjectId: "", isHomeroom: true },
        ],
        students: [],
        academicYear:
          new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
      });

      setIsAddClassDialogOpen(false);
      fetchClasses();
    } catch (error) {
      console.error("Error adding class:", error);
      toast({
        title: "Error",
        description: "Failed to create class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedClass?.classId) return;

    if (
      classFormData.teacherSubjectPairs.some(
        (pair) => !pair.teacherId || !pair.subjectId
      )
    ) {
      toast({
        title: "Error",
        description:
          "All teacher-subject pairs must have both teacher and subject selected",
        variant: "destructive",
      });
      return;
    }

    const homeroomTeachers = classFormData.teacherSubjectPairs.filter(
      (pair) => pair.isHomeroom
    );
    if (homeroomTeachers.length !== 1) {
      toast({
        title: "Error",
        description: "There must be exactly one homeroom teacher for the class",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const classRef = doc(
        db,
        "schools",
        user.schoolId,
        "classes",
        selectedClass.classId
      );

      if (classFormData.name !== selectedClass.name) {
        const classesRef = collection(
          doc(db, "schools", user.schoolId),
          "classes"
        );
        const nameCheckQuery = query(
          classesRef,
          where("name", "==", classFormData.name)
        );
        const nameCheck = await getDocs(nameCheckQuery);

        if (!nameCheck.empty) {
          const conflictingClass = nameCheck.docs[0];
          if (conflictingClass.id !== selectedClass.classId) {
            toast({
              title: "Error",
              description: "This class name is already in use",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        }
      }

      const updateData = {
        name: classFormData.name,
        gradeLevel: classFormData.gradeLevel,
        section: classFormData.section,
        educationLevel: classFormData.educationLevel,
        teacherSubjectPairs: classFormData.teacherSubjectPairs,
        academicYear: classFormData.academicYear,
      };

      await updateDoc(classRef, updateData);

      const previousTeacherIds = selectedClass.teacherSubjectPairs.map(
        (pair) => pair.teacherId
      );
      const currentTeacherIds = classFormData.teacherSubjectPairs.map(
        (pair) => pair.teacherId
      );

      const teachersToRemove = previousTeacherIds.filter(
        (id) => !currentTeacherIds.includes(id)
      );
      const teachersToAdd = currentTeacherIds.filter(
        (id) => !previousTeacherIds.includes(id)
      );

      for (const teacherId of teachersToRemove) {
        const teacherRef = doc(
          db,
          "schools",
          user.schoolId,
          "users",
          teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          const teachesClasses = teacherData.teachesClasses || [];

          if (teachesClasses.includes(selectedClass.name)) {
            await updateDoc(teacherRef, {
              teachesClasses: teachesClasses.filter(
                (className) => className !== selectedClass.name
              ),
            });
          }
        }
      }

      for (const teacherId of teachersToAdd) {
        const teacherRef = doc(
          db,
          "schools",
          user.schoolId,
          "users",
          teacherId
        );
        const teacherDoc = await getDoc(teacherRef);

        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          const teachesClasses = teacherData.teachesClasses || [];

          if (!teachesClasses.includes(classFormData.name)) {
            await updateDoc(teacherRef, {
              teachesClasses: [...teachesClasses, classFormData.name],
            });
          }
        }
      }

      toast({
        title: "Success",
        description: "Class updated successfully",
      });

      setIsEditClassDialogOpen(false);
      fetchClasses();
    } catch (error) {
      console.error("Error updating class:", error);
      toast({
        title: "Error",
        description: "Failed to update class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (classData: HomeroomClass) => {
    setSelectedClass(classData);

    const safeTeacherSubjectPairs = classData.teacherSubjectPairs || [];

    setClassFormData({
      classId: classData.classId,
      name: classData.name || "",
      namingType:
        classData.name === `${classData.gradeLevel}${classData.section}`
          ? "standard"
          : "custom",
      gradeLevel: classData.gradeLevel || 1,
      section: classData.section || "А",
      educationLevel: classData.educationLevel || "primary",
      teacherSubjectPairs: safeTeacherSubjectPairs,
      students: classData.students || [],
      academicYear:
        classData.academicYear ||
        `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    });
    setIsEditClassDialogOpen(true);
  };

  const handleDeleteClick = (classData: HomeroomClass) => {
    setSelectedClass(classData);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteClass = async () => {
    if (!user?.schoolId || !selectedClass?.classId) return;

    setIsSubmitting(true);
    try {
      if (
        selectedClass.teacherSubjectPairs &&
        selectedClass.teacherSubjectPairs.length > 0
      ) {
        for (const pair of selectedClass.teacherSubjectPairs) {
          if (pair && pair.teacherId) {
            const teacherRef = doc(
              db,
              "schools",
              user.schoolId,
              "users",
              pair.teacherId
            );
            const teacherDoc = await getDoc(teacherRef);

            if (teacherDoc.exists()) {
              const teacherData = teacherDoc.data();
              const teachesClasses = teacherData.teachesClasses || [];

              await updateDoc(teacherRef, {
                teachesClasses: teachesClasses.filter(
                  (className: string) => className !== selectedClass.name
                ),
              });
            }
          }
        }
      }

      if (selectedClass.students && selectedClass.students.length > 0) {
        for (const studentId of selectedClass.students) {
          const studentRef = doc(
            db,
            "schools",
            user.schoolId,
            "users",
            studentId
          );
          const studentDoc = await getDoc(studentRef);

          if (studentDoc.exists()) {
            const studentData = studentDoc.data();

            if (studentData.homeroomClassId === selectedClass.classId) {
              await updateDoc(studentRef, {
                homeroomClassId: "",
              });
            }
          }
        }
      }

      toast({
        title: "Success",
        description: "Class deleted successfully",
      });

      setIsDeleteDialogOpen(false);
      fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast({
        title: "Error",
        description: "Failed to delete class",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEducationLevelBadgeStyle = (level: string) => {
    switch (level) {
      case "primary":
        return "bg-green-100 text-green-800 border-green-300";
      case "middle":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "high":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getTeacherName = (teacherId: string) => {
    if (!teachers || teachers.length === 0) return "Loading...";
    const teacher = teachers.find((t) => t.userId === teacherId);
    return teacher
      ? `${teacher.firstName} ${teacher.lastName}`
      : "Unknown Teacher";
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Управление на класове
              </h1>
              <p className="text-gray-600 mt-1">
                Създаване и управление на учебни класове и присъединяване на
                учители
              </p>
            </div>

            <div className="flex gap-3">
              <Dialog
                open={isAddClassDialogOpen}
                onOpenChange={setIsAddClassDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Създай клас</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Създаване на нов клас</DialogTitle>
                    <DialogDescription>
                      Попълнете необходимата информация за създаване на нов
                      учебен клас
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleAddClass} className="space-y-4 my-4">
                    <div className="space-y-2">
                      <Label>Тип на именуване</Label>
                      <RadioGroup
                        value={classFormData.namingType}
                        onValueChange={(value) =>
                          setClassFormData({
                            ...classFormData,
                            namingType: value as "standard" | "custom",
                          })
                        }
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem
                            value="standard"
                            id="naming-standard"
                          />
                          <Label htmlFor="naming-standard">
                            Стандартно (1А, 2Б, и т.н.)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="naming-custom" />
                          <Label htmlFor="naming-custom">По избор</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {classFormData.namingType === "standard" ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="gradeLevel">Клас (цифра)</Label>
                          <Select
                            value={classFormData.gradeLevel.toString()}
                            onValueChange={(value) =>
                              setClassFormData({
                                ...classFormData,
                                gradeLevel: parseInt(value),
                              })
                            }
                          >
                            <SelectTrigger id="gradeLevel">
                              <SelectValue placeholder="Изберете клас" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
                                (grade) => (
                                  <SelectItem
                                    key={grade}
                                    value={grade.toString()}
                                  >
                                    {grade}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="section">Паралелка (буква)</Label>
                          <Select
                            value={classFormData.section}
                            onValueChange={(value) =>
                              setClassFormData({
                                ...classFormData,
                                section: value,
                              })
                            }
                          >
                            <SelectTrigger id="section">
                              <SelectValue placeholder="Изберете паралелка" />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "А",
                                "Б",
                                "В",
                                "Г",
                                "Д",
                                "Е",
                                "Ж",
                                "З",
                                "И",
                              ].map((section) => (
                                <SelectItem key={section} value={section}>
                                  {section}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="custom-name">Име на класа</Label>
                        <Input
                          id="custom-name"
                          value={classFormData.name}
                          onChange={(e) =>
                            setClassFormData({
                              ...classFormData,
                              name: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="education-level">
                        Образователно ниво
                      </Label>
                      <Select
                        value={classFormData.educationLevel}
                        onValueChange={(value) =>
                          setClassFormData({
                            ...classFormData,
                            educationLevel: value as
                              | "primary"
                              | "middle"
                              | "high",
                          })
                        }
                      >
                        <SelectTrigger id="education-level">
                          <SelectValue placeholder="Изберете образователно ниво" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">
                            Начален (1-4 клас)
                          </SelectItem>
                          <SelectItem value="middle">
                            Прогимназиален (5-7 клас)
                          </SelectItem>
                          <SelectItem value="high">
                            Гимназиален (8-12 клас)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Учители и предмети</Label>

                      <div className="space-y-3">
                        {classFormData.teacherSubjectPairs.map(
                          (pair, index) => (
                            <div
                              key={index}
                              className="border p-3 rounded-lg bg-gray-50"
                            >
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`teacher-${index}`}>
                                    Учител
                                  </Label>
                                  <Select
                                    value={pair.teacherId}
                                    onValueChange={(value) =>
                                      handleTeacherSubjectPairChange(
                                        index,
                                        "teacherId",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger id={`teacher-${index}`}>
                                      <SelectValue placeholder="Изберете учител" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(pair.subjectId
                                        ? getFilteredTeachers(index)
                                        : teachers
                                      ).map((teacher) => (
                                        <SelectItem
                                          key={teacher.userId}
                                          value={teacher.userId}
                                        >
                                          {teacher.firstName} {teacher.lastName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-1">
                                  <Label htmlFor={`subject-${index}`}>
                                    Предмет
                                  </Label>
                                  <Select
                                    value={pair.subjectId}
                                    onValueChange={(value) =>
                                      handleTeacherSubjectPairChange(
                                        index,
                                        "subjectId",
                                        value
                                      )
                                    }
                                  >
                                    <SelectTrigger id={`subject-${index}`}>
                                      <SelectValue placeholder="Изберете предмет" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(pair.teacherId
                                        ? getFilteredSubjects(index)
                                        : subjects
                                      ).map((subject) => (
                                        <SelectItem
                                          key={subject.subjectId}
                                          value={subject.subjectId}
                                        >
                                          {subject.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`homeroom-${index}`}
                                    checked={pair.isHomeroom}
                                    onCheckedChange={(checked) =>
                                      handleTeacherSubjectPairChange(
                                        index,
                                        "isHomeroom",
                                        checked === true
                                      )
                                    }
                                  />
                                  <Label
                                    htmlFor={`homeroom-${index}`}
                                    className="cursor-pointer"
                                  >
                                    Класен ръководител
                                  </Label>
                                </div>

                                {index > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveTeacherSubjectPair(index)
                                    }
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    Премахни
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddTeacherSubjectPair}
                          className="w-full"
                        >
                          + Добави учител и предмет
                        </Button>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddClassDialogOpen(false)}
                      >
                        Отказ
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Създаване...
                          </>
                        ) : (
                          "Създай клас"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Търсене по име на клас..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="md:w-56">
                  <Select
                    value={educationLevelFilter}
                    onValueChange={setEducationLevelFilter}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Филтър по ниво" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всички нива</SelectItem>
                      <SelectItem value="primary">Начален етап</SelectItem>
                      <SelectItem value="middle">
                        Прогимназиален етап
                      </SelectItem>
                      <SelectItem value="high">Гимназиален етап</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">Зареждане на класове...</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Клас</TableHead>
                          <TableHead>Образователно ниво</TableHead>
                          <TableHead>Класен ръководител</TableHead>
                          <TableHead>Брой ученици</TableHead>
                          <TableHead>Учебна година</TableHead>
                          <TableHead className="w-[100px] text-right">
                            Действия
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClasses.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center py-10 text-gray-500"
                            >
                              Няма намерени класове
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredClasses.map((classData, index) => (
                            <TableRow key={classData.classId}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {classData.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={getEducationLevelBadgeStyle(
                                    classData.educationLevel
                                  )}
                                >
                                  {classData.educationLevel === "primary"
                                    ? "Начален"
                                    : classData.educationLevel === "middle"
                                    ? "Прогимназиален"
                                    : "Гимназиален"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {classData.teacherSubjectPairs?.find(
                                  (pair) => pair.isHomeroom
                                )?.teacherId ? (
                                  getTeacherName(
                                    classData.teacherSubjectPairs.find(
                                      (pair) => pair.isHomeroom
                                    )!.teacherId
                                  )
                                ) : (
                                  <span className="text-gray-400">
                                    Не е зададен
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {classData.students?.length || 0}
                              </TableCell>
                              <TableCell>{classData.academicYear}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditClick(classData)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteClick(classData)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    Показани {filteredClasses.length} от {classes.length}{" "}
                    класове
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isEditClassDialogOpen}
        onOpenChange={setIsEditClassDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактиране на клас</DialogTitle>
            <DialogDescription>
              Променете данните за избрания клас
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditClass} className="space-y-4 my-4">
            <div className="space-y-2">
              <Label>Тип на именуване</Label>
              <RadioGroup
                value={classFormData.namingType}
                onValueChange={(value) =>
                  setClassFormData({
                    ...classFormData,
                    namingType: value as "standard" | "custom",
                  })
                }
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="edit-naming-standard" />
                  <Label htmlFor="edit-naming-standard">
                    Стандартно (1А, 2Б, и т.н.)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="edit-naming-custom" />
                  <Label htmlFor="edit-naming-custom">По избор</Label>
                </div>
              </RadioGroup>
            </div>

            {classFormData.namingType === "standard" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-gradeLevel">Клас (цифра)</Label>
                  <Select
                    value={classFormData.gradeLevel.toString()}
                    onValueChange={(value) =>
                      setClassFormData({
                        ...classFormData,
                        gradeLevel: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id="edit-gradeLevel">
                      <SelectValue placeholder="Изберете клас" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                        <SelectItem key={grade} value={grade.toString()}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-section">Паралелка (буква)</Label>
                  <Select
                    value={classFormData.section}
                    onValueChange={(value) =>
                      setClassFormData({ ...classFormData, section: value })
                    }
                  >
                    <SelectTrigger id="edit-section">
                      <SelectValue placeholder="Изберете паралелка" />
                    </SelectTrigger>
                    <SelectContent>
                      {["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И"].map(
                        (section) => (
                          <SelectItem key={section} value={section}>
                            {section}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-custom-name">Име на класа</Label>
                <Input
                  id="edit-custom-name"
                  value={classFormData.name}
                  onChange={(e) =>
                    setClassFormData({ ...classFormData, name: e.target.value })
                  }
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-education-level">Образователно ниво</Label>
              <Select
                value={classFormData.educationLevel}
                onValueChange={(value) =>
                  setClassFormData({
                    ...classFormData,
                    educationLevel: value as "primary" | "middle" | "high",
                  })
                }
              >
                <SelectTrigger id="edit-education-level">
                  <SelectValue placeholder="Изберете образователно ниво" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Начален (1-4 клас)</SelectItem>
                  <SelectItem value="middle">
                    Прогимназиален (5-7 клас)
                  </SelectItem>
                  <SelectItem value="high">Гимназиален (8-12 клас)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Учители и предмети</Label>

              <div className="space-y-3">
                {classFormData.teacherSubjectPairs.map((pair, index) => (
                  <div key={index} className="border p-3 rounded-lg bg-gray-50">
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="space-y-1">
                        <Label htmlFor={`edit-teacher-${index}`}>Учител</Label>
                        <Select
                          value={pair.teacherId}
                          onValueChange={(value) =>
                            handleTeacherSubjectPairChange(
                              index,
                              "teacherId",
                              value
                            )
                          }
                        >
                          <SelectTrigger id={`edit-teacher-${index}`}>
                            <SelectValue placeholder="Изберете учител" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pair.subjectId
                              ? getFilteredTeachers(index)
                              : teachers
                            ).map((teacher) => (
                              <SelectItem
                                key={teacher.userId}
                                value={teacher.userId}
                              >
                                {teacher.firstName} {teacher.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor={`edit-subject-${index}`}>Предмет</Label>
                        <Select
                          value={pair.subjectId}
                          onValueChange={(value) =>
                            handleTeacherSubjectPairChange(
                              index,
                              "subjectId",
                              value
                            )
                          }
                        >
                          <SelectTrigger id={`edit-subject-${index}`}>
                            <SelectValue placeholder="Изберете предмет" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pair.teacherId
                              ? getFilteredSubjects(index)
                              : subjects
                            ).map((subject) => (
                              <SelectItem
                                key={subject.subjectId}
                                value={subject.subjectId}
                              >
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-homeroom-${index}`}
                          checked={pair.isHomeroom}
                          onCheckedChange={(checked) =>
                            handleTeacherSubjectPairChange(
                              index,
                              "isHomeroom",
                              checked === true
                            )
                          }
                        />
                        <Label
                          htmlFor={`edit-homeroom-${index}`}
                          className="cursor-pointer"
                        >
                          Класен ръководител
                        </Label>
                      </div>

                      {index > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveTeacherSubjectPair(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          Премахни
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTeacherSubjectPair}
                  className="w-full"
                >
                  + Добави учител и предмет
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditClassDialogOpen(false)}
              >
                Отказ
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Запазване...
                  </>
                ) : (
                  "Запази"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на клас</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този клас? Това действие не
              може да бъде отменено.
            </DialogDescription>
          </DialogHeader>

          {selectedClass && (
            <div className="py-4">
              <p className="font-medium">Клас: {selectedClass.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedClass.educationLevel === "primary"
                  ? "Начален етап"
                  : selectedClass.educationLevel === "middle"
                  ? "Прогимназиален етап"
                  : "Гимназиален етап"}
              </p>

              <div className="mt-4 text-sm">
                <p className="mt-1">
                  <span className="font-medium">Ученици:</span>{" "}
                  {selectedClass.students?.length || 0}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Учебна година:</span>{" "}
                  {selectedClass.academicYear}
                </p>
              </div>

              {selectedClass.students?.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-700 text-sm">
                  <p className="font-medium">Внимание:</p>
                  <p>
                    Този клас съдържа {selectedClass.students.length} ученици.
                    При изтриване на класа, учениците ще останат в системата, но
                    няма да бъдат асоциирани с никой клас.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClass}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Изтриване...
                </>
              ) : (
                "Изтрий"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
