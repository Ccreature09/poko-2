// TimetableManagement Component - Handles creation and management of school timetables
// Allows creating, editing, and scheduling classes with teachers, subjects and periods
"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/layout/Sidebar";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  AlertTriangle,
  Save,
  Clock,
} from "lucide-react";

// Data management utilities
import {
  getClasses,
  getAllSubjects,
  getAllTeachers,
  createOrUpdateTimetable,
  fetchTimetablesByHomeroomClassId,
  checkTimetableConflicts,
  checkTeacherConflicts,
} from "@/lib/management/timetableManagement";

import type { HomeroomClass, ClassSession, Subject } from "@/lib/interfaces";

// Constants for timetable management
const DAYS_OF_WEEK = [
  "Понеделник",
  "Вторник",
  "Сряда",
  "Четвъртък",
  "Петък",
  "Събота",
  "Неделя",
];

const DEFAULT_PERIODS = [
  { period: 1, startTime: "08:00", endTime: "08:45" },
  { period: 2, startTime: "08:55", endTime: "09:40" },
  { period: 3, startTime: "09:50", endTime: "10:35" },
  { period: 4, startTime: "10:45", endTime: "11:30" },
  { period: 5, startTime: "11:40", endTime: "12:25" },
  { period: 6, startTime: "12:35", endTime: "13:20" },
  { period: 7, startTime: "13:30", endTime: "14:15" },
];

// Type definitions for timetable management
type Period = {
  period: number;
  startTime: string;
  endTime: string;
};

// Type for timetable entry form data
interface TimetableEntryFormData {
  day: string;
  period: number;
  teacherId: string;
  subjectId: string;
  startTime: string;
  endTime: string;
  isFreePeriod: boolean; // Indicates if this is a free period
}

export default function TimetableManagement() {
  const { user } = useUser();
  const router = useRouter();

  // State for classes, subjects, teachers and selected items
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<
    { userId: string; firstName: string; lastName: string; email: string }[]
  >([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedClassData, setSelectedClassData] =
    useState<HomeroomClass | null>(null);

  // Timetable state management
  const [timetableId, setTimetableId] = useState<string | null>(null);
  const [timetableEntries, setTimetableEntries] = useState<
    ClassSession["entries"]
  >([]);
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);

  // UI state management
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredClasses, setFilteredClasses] = useState<HomeroomClass[]>([]);

  // Dialog control states
  const [isAddEntryDialogOpen, setIsAddEntryDialogOpen] = useState(false);
  const [isEditEntryDialogOpen, setIsEditEntryDialogOpen] = useState(false);
  const [isDeleteEntryDialogOpen, setIsDeleteEntryDialogOpen] = useState(false);
  const [isEditPeriodsDialogOpen, setIsEditPeriodsDialogOpen] = useState(false);

  // Entry form data
  const [entryFormData, setEntryFormData] = useState<TimetableEntryFormData>({
    day: DAYS_OF_WEEK[0],
    period: 1,
    teacherId: "",
    subjectId: "",
    startTime: "08:00",
    endTime: "08:45",
    isFreePeriod: false,
  });

  // Selected entry for editing or deletion
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(
    null
  );

  // Conflict tracking states
  const [timetableConflicts, setTimetableConflicts] = useState<
    {
      day: string;
      period: number;
      existingSubject: string;
      newSubject: string;
    }[]
  >([]);

  const [teacherConflicts, setTeacherConflicts] = useState<
    {
      teacherId: string;
      teacherName: string;
      day: string;
      period: number;
      className: string;
    }[]
  >([]);

  useEffect(() => {
    // Authentication check and redirect for non-admin users
    if (user?.role !== "admin") {
      router.push("/login");
    } else if (user?.schoolId) {
      loadInitialData(user.schoolId);
    }
  }, [user, router]);

  useEffect(() => {
    // Filter classes when search query changes
    if (searchQuery) {
      const filtered = classes.filter((classData) =>
        classData.className.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClasses(filtered);
    } else {
      setFilteredClasses(classes);
    }
  }, [classes, searchQuery]);

  useEffect(() => {
    // Update form data when selecting an entry to edit
    if (selectedEntryIndex !== null && timetableEntries[selectedEntryIndex]) {
      const entry = timetableEntries[selectedEntryIndex];
      setEntryFormData({
        day: entry.day,
        period: entry.period,
        teacherId: entry.teacherId,
        subjectId: entry.subjectId,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isFreePeriod: entry.isFreePeriod || false,
      });
    }
  }, [selectedEntryIndex, timetableEntries]);

  /**
   * Loads initial data: classes, subjects, teachers for the school
   * @param schoolId - ID of the current school
   */
  const loadInitialData = async (schoolId: string) => {
    setIsLoading(true);
    try {
      const [fetchedClasses, fetchedSubjects, fetchedTeachers] =
        await Promise.all([
          getClasses(schoolId),
          getAllSubjects(schoolId),
          getAllTeachers(schoolId),
        ]);

      setClasses(fetchedClasses);
      setFilteredClasses(fetchedClasses);
      setSubjects(fetchedSubjects);
      setTeachers(fetchedTeachers);
    } catch (error) {
      console.error("Error loading initial data:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно зареждане на данни",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Loads timetable for the selected class
   * @param classId - ID of the selected class
   */
  const loadTimetable = async (classId: string) => {
    if (!user?.schoolId) return;

    setIsLoading(true);
    try {
      console.log(`Loading timetable for class ID: ${classId}`);

      // Find the selected class data
      const classData = classes.find((c) => c.classId === classId) || null;
      setSelectedClassData(classData);

      // Get timetable for this class
      const timetables = await fetchTimetablesByHomeroomClassId(
        user.schoolId,
        classId
      );

      console.log(
        `Found ${timetables.length} timetables for class ID: ${classId}`
      );

      if (timetables.length > 0) {
        const timetable = timetables[0];
        console.log("Timetable data:", timetable);
        setTimetableId(timetable.id);
        setTimetableEntries(timetable.data.entries || []);

        // Use the timetable periods if they exist, otherwise use default periods
        if (timetable.data.periods && timetable.data.periods.length > 0) {
          console.log("Using timetable periods:", timetable.data.periods);
          setPeriods(timetable.data.periods);
        } else {
          console.log("No periods found in timetable, using default periods");
          setPeriods(DEFAULT_PERIODS);
        }
      } else {
        // No timetable exists yet
        console.log(
          "No existing timetable found, creating new timetable state"
        );
        setTimetableId(null);
        setTimetableEntries([]);
        setPeriods(DEFAULT_PERIODS);
      }
    } catch (error) {
      console.error("Error loading timetable:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно зареждане на разписанието",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles selection of a class to view/edit its timetable
   * @param classId - ID of the selected class
   */
  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId);
    loadTimetable(classId);
  };

  /**
   * Saves the current timetable for the selected class
   * Checks for conflicts before saving
   */
  const handleSaveTimetable = async () => {
    if (!user?.schoolId || !selectedClass) return;

    setIsSaving(true);
    try {
      // Check for conflicts
      const tConflicts = await checkTimetableConflicts(
        user.schoolId,
        selectedClass,
        timetableEntries,
        timetableId || undefined
      );

      // Check for teacher conflicts
      const teacherConfs = await checkTeacherConflicts(
        user.schoolId,
        timetableEntries,
        timetableId || undefined
      );

      setTimetableConflicts(tConflicts);
      setTeacherConflicts(teacherConfs);

      // If there are conflicts, show warnings but still allow saving
      if (tConflicts.length > 0 || teacherConfs.length > 0) {
        toast({
          title: "Предупреждение",
          description:
            "Има конфликти в разписанието. Прегледайте ги, преди да продължите.",
          variant: "destructive",
        });
      }

      // Save timetable
      const timetableData: ClassSession = {
        homeroomClassId: selectedClass,
        entries: timetableEntries,
        periods: periods,
      };

      await createOrUpdateTimetable(user.schoolId, timetableData);

      toast({
        title: "Успех",
        description: "Разписанието е запазено успешно",
      });

      // Reload timetable to get the latest data
      loadTimetable(selectedClass);
    } catch (error) {
      console.error("Error saving timetable:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно запазване на разписанието",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles adding a new entry to the timetable
   * Validates form data before adding
   */
  const handleAddEntry = () => {
    // Only validate teacher and subject if not a free period
    if (
      !entryFormData.isFreePeriod &&
      (!entryFormData.teacherId || !entryFormData.subjectId)
    ) {
      toast({
        title: "Грешка",
        description: "Моля, изберете учител и предмет",
        variant: "destructive",
      });
      return;
    }

    // Get period times from the periods array
    const periodData = periods.find((p) => p.period === entryFormData.period);
    const startTime = periodData
      ? periodData.startTime
      : entryFormData.startTime;
    const endTime = periodData ? periodData.endTime : entryFormData.endTime;

    // Create new entry - use empty values for teacher and subject if it's a free period
    const newEntry = {
      day: entryFormData.day,
      period: entryFormData.period,
      teacherId: entryFormData.isFreePeriod ? "" : entryFormData.teacherId,
      subjectId: entryFormData.isFreePeriod ? "" : entryFormData.subjectId,
      startTime,
      endTime,
      classId: selectedClass || "",
      isFreePeriod: entryFormData.isFreePeriod,
    };

    // Add to entries array
    setTimetableEntries([...timetableEntries, newEntry]);

    // Reset form and close dialog
    setEntryFormData({
      day: DAYS_OF_WEEK[0],
      period: 1,
      teacherId: "",
      subjectId: "",
      startTime: "08:00",
      endTime: "08:45",
      isFreePeriod: false,
    });

    setIsAddEntryDialogOpen(false);
  };

  /**
   * Handles updating an existing timetable entry
   * Validates form data before updating
   */
  const handleUpdateEntry = () => {
    if (selectedEntryIndex === null) return;
    // Only validate teacher and subject if not a free period
    if (
      !entryFormData.isFreePeriod &&
      (!entryFormData.teacherId || !entryFormData.subjectId)
    ) {
      toast({
        title: "Грешка",
        description: "Моля, изберете учител и предмет",
        variant: "destructive",
      });
      return;
    }

    // Get period times from the periods array
    const periodData = periods.find((p) => p.period === entryFormData.period);
    const startTime = periodData
      ? periodData.startTime
      : entryFormData.startTime;
    const endTime = periodData ? periodData.endTime : entryFormData.endTime;

    // Create updated entry - use empty values for teacher and subject if it's a free period
    const updatedEntry = {
      day: entryFormData.day,
      period: entryFormData.period,
      teacherId: entryFormData.isFreePeriod ? "" : entryFormData.teacherId,
      subjectId: entryFormData.isFreePeriod ? "" : entryFormData.subjectId,
      startTime,
      endTime,
      classId: selectedClass || "",
      isFreePeriod: entryFormData.isFreePeriod,
    };

    // Update entries array
    const updatedEntries = [...timetableEntries];
    updatedEntries[selectedEntryIndex] = updatedEntry;
    setTimetableEntries(updatedEntries);

    // Reset form and close dialog
    setSelectedEntryIndex(null);
    setIsEditEntryDialogOpen(false);
  };

  /**
   * Handles deletion of a timetable entry
   */
  const handleDeleteEntry = () => {
    if (selectedEntryIndex === null) return;

    // Remove entry from array
    const updatedEntries = [...timetableEntries];
    updatedEntries.splice(selectedEntryIndex, 1);
    setTimetableEntries(updatedEntries);

    // Reset and close dialog
    setSelectedEntryIndex(null);
    setIsDeleteEntryDialogOpen(false);
  };

  /**
   * Handles updating period definitions for the timetable
   * @param updatedPeriods - New array of period definitions
   */
  const handleUpdatePeriods = (updatedPeriods: Period[]) => {
    if (updatedPeriods && updatedPeriods.length > 0) {
      console.log("Updating periods with:", updatedPeriods);
      setPeriods(updatedPeriods);
    } else {
      console.warn("Attempted to set empty periods, using defaults instead");
      setPeriods(DEFAULT_PERIODS);
    }
    setIsEditPeriodsDialogOpen(false);
  };

  /**
   * Handles subject selection in the form
   * @param subjectId - ID of the selected subject
   */
  const handleSubjectSelect = async (subjectId: string) => {
    if (!user?.schoolId) return;

    setEntryFormData({
      ...entryFormData,
      subjectId,
      teacherId: "", // Reset teacher when subject changes
    });
  };

  /**
   * Gets a teacher's full name by ID
   * @param teacherId - ID of the teacher
   * @returns The teacher's full name or placeholder if not found
   */
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find((t) => t.userId === teacherId);
    return teacher
      ? `${teacher.firstName} ${teacher.lastName}`
      : "Неизвестен учител";
  };

  /**
   * Gets a subject's name by ID
   * @param subjectId - ID of the subject
   * @returns The subject name or placeholder if not found
   */
  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find((s) => s.subjectId === subjectId);
    return subject ? subject.name : "Неизвестен предмет";
  };

  /**
   * Finds teachers who can teach the selected subject
   * @param subjectId - ID of the subject
   * @returns List of teachers who can teach the subject
   */
  const getTeachersForSubject = (subjectId: string) => {
    const subject = subjects.find((s) => s.subjectId === subjectId);
    if (!subject) return [];

    // Extract teacher IDs from teacherSubjectPairs
    let subjectTeacherIds: string[] = [];

    // Handle different possible structures of teacherSubjectPairs
    if (
      subject.teacherSubjectPairs &&
      Array.isArray(subject.teacherSubjectPairs)
    ) {
      // If the structure is as expected
      subjectTeacherIds = subject.teacherSubjectPairs
        .map((pair) =>
          typeof pair === "object" && pair !== null ? pair.teacherId : pair
        )
        .filter((id) => id); // Filter out any undefined or empty values
    }

    // If we still don't have teachers and selectedClassData is available, try getting teacher IDs from there
    if (
      subjectTeacherIds.length === 0 &&
      selectedClassData &&
      selectedClassData.teacherSubjectPairs
    ) {
      // Try to find teacher IDs from the selected class data
      subjectTeacherIds = selectedClassData.teacherSubjectPairs
        .filter((pair) => pair.subjectId === subjectId)
        .map((pair) => pair.teacherId);
    }

    // If there are still no teachers, return all available teachers as a fallback
    if (subjectTeacherIds.length === 0) {
      console.log(
        "No teachers found for subject, returning all teachers as fallback"
      );
      return teachers;
    }

    const filteredTeachers = teachers.filter((teacher) =>
      subjectTeacherIds.includes(teacher.userId)
    );

    console.log("Filtered teachers:", filteredTeachers);
    return filteredTeachers;
  };

  /**
   * Opens the edit entry dialog for a specific entry
   * @param index - Index of the entry to edit
   */
  const handleEditEntry = (index: number) => {
    setSelectedEntryIndex(index);
    setIsEditEntryDialogOpen(true);
  };

  /**
   * Opens the delete entry dialog for a specific entry
   * @param index - Index of the entry to delete
   */
  const handleDeleteEntryClick = (index: number) => {
    setSelectedEntryIndex(index);
    setIsDeleteEntryDialogOpen(true);
  };

  /**
   * Renders the timetable grid for the selected class
   * @returns JSX element containing the timetable grid
   */
  const renderTimetableGrid = () => {
    // Group entries by day and period
    const entriesByDayAndPeriod: Record<
      string,
      Record<number, (typeof timetableEntries)[0]>
    > = {};

    // Initialize empty grid
    DAYS_OF_WEEK.forEach((day) => {
      entriesByDayAndPeriod[day] = {};
    });

    // Fill in entries
    timetableEntries.forEach((entry) => {
      if (!entriesByDayAndPeriod[entry.day]) {
        entriesByDayAndPeriod[entry.day] = {};
      }
      entriesByDayAndPeriod[entry.day][entry.period] = entry;
    });

    return (
      <div className="rounded-md border overflow-hidden mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Час</TableHead>
              {DAYS_OF_WEEK.map((day) => (
                <TableHead key={day}>{day}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((periodData) => (
              <TableRow key={periodData.period}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>Час {periodData.period}</span>
                    <span className="text-xs text-gray-500">
                      {periodData.startTime} - {periodData.endTime}
                    </span>
                  </div>
                </TableCell>

                {DAYS_OF_WEEK.map((day) => {
                  const entry = entriesByDayAndPeriod[day][periodData.period];
                  return (
                    <TableCell key={day}>
                      {entry ? (
                        <div className="space-y-1">
                          <div className="font-medium">
                            {entry.isFreePeriod ? (
                              <span className="text-gray-500">
                                Свободен час
                              </span>
                            ) : (
                              getSubjectName(entry.subjectId)
                            )}
                          </div>
                          {!entry.isFreePeriod && (
                            <div className="text-sm text-gray-500">
                              {getTeacherName(entry.teacherId)}
                            </div>
                          )}
                          <div className="flex space-x-1 mt-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                handleEditEntry(timetableEntries.indexOf(entry))
                              }
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() =>
                                handleDeleteEntryClick(
                                  timetableEntries.indexOf(entry)
                                )
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full flex justify-center items-center text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setEntryFormData({
                              day,
                              period: periodData.period,
                              teacherId: "",
                              subjectId: "",
                              startTime: periodData.startTime,
                              endTime: periodData.endTime,
                              isFreePeriod: false,
                            });
                            setIsAddEntryDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          <span>Добави</span>
                        </Button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  /**
   * Renders conflict warnings if any conflicts are detected
   * @returns JSX element containing conflict warnings or null if no conflicts
   */
  const renderConflicts = () => {
    if (timetableConflicts.length === 0 && teacherConflicts.length === 0) {
      return null;
    }

    return (
      <div className="my-4 space-y-3">
        {timetableConflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Конфликти в разписанието</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {timetableConflicts.map((conflict, index) => (
                  <li key={index}>
                    {conflict.day}, Час {conflict.period}:{" "}
                    {conflict.existingSubject} е в конфликт с{" "}
                    {conflict.newSubject}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {teacherConflicts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Конфликти в графика на учителите</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {teacherConflicts.map((conflict, index) => (
                  <li key={index}>
                    {conflict.teacherName} вече преподава в {conflict.className}{" "}
                    на {conflict.day}, Час {conflict.period}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Protect route - return null if user is not an admin
  if (!user || user.role !== "admin") {
    return null;
  }

  // Main component rendering
  return (
    // ...existing code...
  );
}
