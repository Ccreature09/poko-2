"use client";

/**
 * Teacher Assignment Edit Page
 *
 * Comprehensive interface for modifying existing educational assignments.
 * This page provides:
 *
 * Key features:
 * - Full editing capabilities for existing assignment parameters
 * - Due date modification with calendar integration
 * - Submission policy adjustments (late submissions, resubmissions)
 * - Class targeting refinement with visual selection interface
 * - Permission validation to ensure proper editorial access
 * - Assignment metadata management with subject categorization
 *
 * Data flow:
 * - Retrieves existing assignment data from database
 * - Loads related class and subject data for comprehensive editing
 * - Validates user permissions against assignment ownership
 * - Performs validation on required fields before submission
 * - Updates assignment document with modified parameters
 *
 * This interface enables teachers to refine assignment parameters after
 * initial creation, supporting the iterative improvement of assignments
 * with deadline adjustments, policy changes, and targeting modifications.
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useAssignments } from "@/contexts/AssignmentContext";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Timestamp } from "firebase/firestore";
import type { Assignment, HomeroomClass } from "@/lib/interfaces";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, CheckIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import Sidebar from "@/components/functional/layout/Sidebar";

export default function EditAssignment() {
  const router = useRouter();
  const { user } = useUser();
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params?.assignmentId;
  const { fetchAssignmentById, updateExistingAssignment } = useAssignments();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<HomeroomClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!user?.schoolId || !assignmentId) return;

      try {
        setInitialLoading(true);

        // Fetch assignment details using the context
        const assignmentData = await fetchAssignmentById(assignmentId);

        if (!assignmentData) {
          toast({
            title: "Грешка",
            description: "Задачата не е намерена",
            variant: "destructive",
          });
          router.push("/assignments");
          return;
        }

        // Check if user has permission to edit this assignment
        if (assignmentData.teacherId !== user.userId && user.role !== "admin") {
          toast({
            title: "Отказан достъп",
            description: "Нямате права да редактирате тази задача",
            variant: "destructive",
          });
          router.push(`/assignments/${assignmentId}`);
          return;
        }

        // Populate form with assignment data
        setTitle(assignmentData.title);
        setDescription(assignmentData.description || "");
        setSelectedDate(new Date(assignmentData.dueDate.seconds * 1000));
        setSelectedSubject(assignmentData.subjectId || "");
        setAllowLateSubmission(assignmentData.allowLateSubmission || false);
        setAllowResubmission(assignmentData.allowResubmission || false);
        setSelectedClasses(assignmentData.classIds || []);

        // Fetch subjects
        const subjectsCollection = collection(
          db,
          "schools",
          user.schoolId,
          "subjects"
        );
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
        }));
        setSubjects(subjectsData);

        // Fetch classes
        const classesCollection = collection(
          db,
          "schools",
          user.schoolId,
          "classes"
        );
        const classesSnapshot = await getDocs(classesCollection);
        const classesData = classesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), classId: doc.id } as HomeroomClass)
        );
        setAvailableClasses(classesData);
      } catch (error) {
        console.error("Error fetching assignment data:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на данни за задачата",
          variant: "destructive",
        });
      } finally {
        setInitialLoading(false);
      }
    };

    fetchAssignment();
  }, [user, assignmentId, router, fetchAssignmentById]);

  const handleClassSelect = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !selectedDate || !selectedSubject || !assignmentId) {
      toast({
        title: "Липсваща информация",
        description: "Моля, попълнете всички задължителни полета",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Get subject name for display
      const subjectName =
        subjects.find((s) => s.id === selectedSubject)?.name || "";

      const assignmentData: Partial<Assignment> = {
        title,
        description,
        dueDate: Timestamp.fromDate(selectedDate),
        subjectId: selectedSubject,
        subjectName,
        allowLateSubmission,
        allowResubmission,
        classIds: selectedClasses,
        updatedAt: Timestamp.now(),
      };

      await updateExistingAssignment(assignmentId, assignmentData);

      toast({
        title: "Успешно",
        description: "Заданието е актуализирано успешно",
      });

      router.push(`/teacher/assignments/${assignmentId}`);
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно актуализиране на заданието",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (initialLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p>Зареждане на детайли за задачата...</p>
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Редактиране на задача
          </h1>

          <Card>
            <CardHeader>
              <CardTitle>Детайли за задачата</CardTitle>
              <CardDescription>
                Редактирайте детайлите за тази задача
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Заглавие на задачата</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Въведете заглавие"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание на задачата</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Въведете описание на задачата"
                    className="min-h-[150px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Предмет</Label>
                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Изберете предмет" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Краен срок</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? (
                            format(selectedDate, "PPP")
                          ) : (
                            <span>Изберете дата</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          value={selectedDate}
                          onChange={(value) => setSelectedDate(value as Date)}
                          className="rounded-md border"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Настройки на задачата</Label>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowLateSubmission"
                      checked={allowLateSubmission}
                      onCheckedChange={(checked) =>
                        setAllowLateSubmission(checked === true)
                      }
                    />
                    <Label
                      htmlFor="allowLateSubmission"
                      className="font-normal cursor-pointer"
                    >
                      Позволи закъснели предавания след крайния срок
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowResubmission"
                      checked={allowResubmission}
                      onCheckedChange={(checked) =>
                        setAllowResubmission(checked === true)
                      }
                    />
                    <Label
                      htmlFor="allowResubmission"
                      className="font-normal cursor-pointer"
                    >
                      Позволи повторни предавания от учениците
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="mb-2 block">Избери класове</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {availableClasses.map((classItem) => (
                      <div
                        key={classItem.classId}
                        onClick={() => handleClassSelect(classItem.classId)}
                        className={`
                          cursor-pointer rounded-lg border p-2 text-center transition
                          ${
                            selectedClasses.includes(classItem.classId)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-300"
                          }
                        `}
                      >
                        <div className="flex justify-between items-center">
                          <span>{classItem.className}</span>
                          {selectedClasses.includes(classItem.classId) && (
                            <CheckIcon className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-end gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                    >
                      Отказ
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Запазване..." : "Запази Промените"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
