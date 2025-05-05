"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import Sidebar from "@/components/functional/Sidebar";
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

import {
  getClasses,
  getAllSubjects,
  getAllTeachers,
  getTeachersBySubject,
  createOrUpdateTimetable,
  fetchTimetablesByHomeroomClassId,
  checkTimetableConflicts,
  checkTeacherConflicts,
} from "@/lib/timetableManagement";

import type { HomeroomClass, ClassSession, Subject } from "@/lib/interfaces";

// Days of the week in Bulgarian
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

// Type for ClassSession periods to ensure it's not undefined
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
  isFreePeriod: boolean; // New field to indicate if this is a free period
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

  // Timetable state - update the type declaration to ensure periods is never undefined
  const [timetableId, setTimetableId] = useState<string | null>(null);
  const [timetableEntries, setTimetableEntries] = useState<
    ClassSession["entries"]
  >([]);
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredClasses, setFilteredClasses] = useState<HomeroomClass[]>([]);

  // Dialog state
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

  // Conflicts
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

  // Fetch initial data
  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/login");
    } else if (user?.schoolId) {
      loadInitialData(user.schoolId);
    }
  }, [user, router]);

  // Filter classes when search query changes
  useEffect(() => {
    if (searchQuery) {
      const filtered = classes.filter((classData) =>
        classData.className.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClasses(filtered);
    } else {
      setFilteredClasses(classes);
    }
  }, [classes, searchQuery]);

  // Update period times when selecting an entry to edit
  useEffect(() => {
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

  // Load initial data: classes, subjects, teachers
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

  // Load timetable for selected class
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

  // Handle class selection
  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId);
    loadTimetable(classId);
  };

  // Handle saving timetable
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

  // Handle adding a new timetable entry
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

  // Handle updating a timetable entry
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

  // Handle deleting a timetable entry
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

  // Handle updating periods
  const handleUpdatePeriods = (updatedPeriods: Period[] | undefined) => {
    // Make sure we never set undefined to the periods state
    if (updatedPeriods) {
      setPeriods(updatedPeriods);
    }
    setIsEditPeriodsDialogOpen(false);
  };

  // For subject selection, we want to show teachers who teach that subject
  const handleSubjectSelect = async (subjectId: string) => {
    if (!user?.schoolId) return;

    setEntryFormData({
      ...entryFormData,
      subjectId,
      teacherId: "", // Reset teacher when subject changes
    });
  };

  // Get teacher name by ID
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find((t) => t.userId === teacherId);
    return teacher
      ? `${teacher.firstName} ${teacher.lastName}`
      : "Неизвестен учител";
  };

  // Get subject name by ID
  const getSubjectName = (subjectId: string) => {
    const subject = subjects.find((s) => s.subjectId === subjectId);
    return subject ? subject.name : "Неизвестен предмет";
  };

  // Find teachers who can teach the selected subject
  const getTeachersForSubject = (subjectId: string) => {
    const subject = subjects.find((s) => s.subjectId === subjectId);
    if (!subject) return [];

    // Debug the subject data to ensure teacherSubjectPairs exists and has valid structure
    console.log("Subject data:", subject);
    console.log("Teachers data:", teachers);

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

  // Open the edit entry dialog
  const handleEditEntry = (index: number) => {
    setSelectedEntryIndex(index);
    setIsEditEntryDialogOpen(true);
  };

  // Open the delete entry dialog
  const handleDeleteEntryClick = (index: number) => {
    setSelectedEntryIndex(index);
    setIsDeleteEntryDialogOpen(true);
  };

  // Generate the timetable view
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

  // Show conflict warnings if any
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
                Управление на разписанието
              </h1>
              <p className="text-gray-600 mt-1">
                Създавайте и управлявайте разписания на класове и назначавайте
                учители по предмети
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Classes Sidebar */}
            <Card className="lg:col-span-1">
              <CardContent className="p-4">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-2">Класове</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Търсене на класове..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <Button
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">
                      Зареждане на класове...
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <div className="space-y-1">
                      {filteredClasses.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          Няма намерени класове
                        </div>
                      ) : (
                        filteredClasses.map((classData) => (
                          <Button
                            key={classData.classId}
                            variant={
                              selectedClass === classData.classId
                                ? "default"
                                : "ghost"
                            }
                            className={`w-full justify-start ${
                              selectedClass === classData.classId
                                ? "text-white"
                                : "text-black"
                            }`}
                            onClick={() => handleClassSelect(classData.classId)}
                          >
                            {classData.className}
                          </Button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Timetable Content */}
            <Card className="lg:col-span-3">
              <CardContent className="p-4">
                {!selectedClass ? (
                  <div className="text-center py-12">
                    <h2 className="text-xl font-semibold text-gray-600 mb-2">
                      Изберете клас, за да управлявате разписанието му
                    </h2>
                    <p className="text-gray-500">
                      Изберете клас от списъка вляво, за да видите и редактирате
                      разписанието му
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">
                      Зареждане на разписанието...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">
                        Разписание за{" "}
                        {selectedClassData?.className || "Избран клас"}
                        {timetableId && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            (Редактиране на съществуващо разписание)
                          </span>
                        )}
                      </h2>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsEditPeriodsDialogOpen(true)}
                          className="flex items-center gap-1"
                        >
                          <Clock className="h-4 w-4" />
                          Редактиране на часове
                        </Button>
                        <Button
                          onClick={handleSaveTimetable}
                          disabled={isSaving}
                          className="flex items-center gap-1 text-white"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Запазване...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Запази разписанието
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Show conflicts if any */}
                    {renderConflicts()}

                    {/* Timetable Grid */}
                    <ScrollArea className="h-[calc(100vh-280px)]">
                      {renderTimetableGrid()}
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Entry Dialog */}
      <Dialog
        open={isAddEntryDialogOpen}
        onOpenChange={setIsAddEntryDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добави учебен час</DialogTitle>
            <DialogDescription>
              Добавете нов учебен час към разписанието
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="free-period"
                checked={entryFormData.isFreePeriod}
                onCheckedChange={(checked) => {
                  setEntryFormData({
                    ...entryFormData,
                    isFreePeriod: checked as boolean,
                  });
                }}
              />
              <Label htmlFor="free-period">
                Задай като свободен час (не се изисква учител или предмет)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day">Ден</Label>
                <Select
                  value={entryFormData.day}
                  onValueChange={(value) =>
                    setEntryFormData({ ...entryFormData, day: value })
                  }
                >
                  <SelectTrigger id="day">
                    <SelectValue placeholder="Избери ден" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Час</Label>
                <Select
                  value={entryFormData.period.toString()}
                  onValueChange={(value) => {
                    const period = parseInt(value);
                    const periodData = periods.find((p) => p.period === period);

                    setEntryFormData({
                      ...entryFormData,
                      period,
                      startTime:
                        periodData?.startTime || entryFormData.startTime,
                      endTime: periodData?.endTime || entryFormData.endTime,
                    });
                  }}
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Избери час" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.period} value={p.period.toString()}>
                        Час {p.period} ({p.startTime} - {p.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Предмет</Label>
              <Select
                value={entryFormData.subjectId}
                onValueChange={handleSubjectSelect}
                disabled={entryFormData.isFreePeriod}
              >
                <SelectTrigger id="subject">
                  <SelectValue
                    placeholder={
                      entryFormData.isFreePeriod
                        ? "Не се изисква за свободен час"
                        : "Избери предмет"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem
                      key={subject.subjectId}
                      value={subject.subjectId}
                    >
                      {subject.name || "Неименуван предмет"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher">Учител</Label>
              <Select
                value={entryFormData.teacherId}
                onValueChange={(value) =>
                  setEntryFormData({ ...entryFormData, teacherId: value })
                }
                disabled={
                  !entryFormData.subjectId || entryFormData.isFreePeriod
                }
              >
                <SelectTrigger id="teacher">
                  <SelectValue
                    placeholder={
                      entryFormData.isFreePeriod
                        ? "Не се изисква за свободен час"
                        : entryFormData.subjectId
                        ? "Избери учител"
                        : "Първо изберете предмет"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {getTeachersForSubject(entryFormData.subjectId).map(
                    (teacher) => (
                      <SelectItem key={teacher.userId} value={teacher.userId}>
                        {teacher.firstName} {teacher.lastName}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddEntryDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button type="button" onClick={handleAddEntry}>
              Добави час
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog
        open={isEditEntryDialogOpen}
        onOpenChange={setIsEditEntryDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактирай учебен час</DialogTitle>
            <DialogDescription>
              Актуализирайте детайлите за този учебен час
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="edit-free-period"
                checked={entryFormData.isFreePeriod}
                onCheckedChange={(checked) => {
                  setEntryFormData({
                    ...entryFormData,
                    isFreePeriod: checked as boolean,
                  });
                }}
              />
              <Label htmlFor="edit-free-period">
                Задай като свободен час (не се изисква учител или предмет)
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-day">Ден</Label>
                <Select
                  value={entryFormData.day}
                  onValueChange={(value) =>
                    setEntryFormData({ ...entryFormData, day: value })
                  }
                >
                  <SelectTrigger id="edit-day">
                    <SelectValue placeholder="Избери ден" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-period">Час</Label>
                <Select
                  value={entryFormData.period.toString()}
                  onValueChange={(value) => {
                    const period = parseInt(value);
                    const periodData = periods.find((p) => p.period === period);

                    setEntryFormData({
                      ...entryFormData,
                      period,
                      startTime:
                        periodData?.startTime || entryFormData.startTime,
                      endTime: periodData?.endTime || entryFormData.endTime,
                    });
                  }}
                >
                  <SelectTrigger id="edit-period">
                    <SelectValue placeholder="Избери час" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => (
                      <SelectItem key={p.period} value={p.period.toString()}>
                        Час {p.period} ({p.startTime} - {p.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-subject">Предмет</Label>
              <Select
                value={entryFormData.subjectId}
                onValueChange={handleSubjectSelect}
                disabled={entryFormData.isFreePeriod}
              >
                <SelectTrigger id="edit-subject">
                  <SelectValue
                    placeholder={
                      entryFormData.isFreePeriod
                        ? "Не се изисква за свободен час"
                        : "Избери предмет"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem
                      key={subject.subjectId}
                      value={subject.subjectId}
                    >
                      {subject.name || "Неименуван предмет"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-teacher">Учител</Label>
              <Select
                value={entryFormData.teacherId}
                onValueChange={(value) =>
                  setEntryFormData({ ...entryFormData, teacherId: value })
                }
                disabled={
                  !entryFormData.subjectId || entryFormData.isFreePeriod
                }
              >
                <SelectTrigger id="edit-teacher">
                  <SelectValue
                    placeholder={
                      entryFormData.isFreePeriod
                        ? "Не се изисква за свободен час"
                        : entryFormData.subjectId
                        ? "Избери учител"
                        : "Първо изберете предмет"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {getTeachersForSubject(entryFormData.subjectId).map(
                    (teacher) => (
                      <SelectItem key={teacher.userId} value={teacher.userId}>
                        {teacher.firstName} {teacher.lastName}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditEntryDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              type="button"
              className="text-white"
              onClick={handleUpdateEntry}
            >
              Актуализирай час
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Dialog */}
      <Dialog
        open={isDeleteEntryDialogOpen}
        onOpenChange={setIsDeleteEntryDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изтрий учебен час</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете този учебен час?
            </DialogDescription>
          </DialogHeader>

          {selectedEntryIndex !== null &&
            timetableEntries[selectedEntryIndex] && (
              <div className="py-4">
                <div className="rounded-md bg-gray-50 p-4">
                  <p>
                    <strong>Ден:</strong>{" "}
                    {timetableEntries[selectedEntryIndex].day}
                  </p>
                  <p>
                    <strong>Час:</strong>{" "}
                    {timetableEntries[selectedEntryIndex].period}
                  </p>
                  {timetableEntries[selectedEntryIndex].isFreePeriod ? (
                    <p>
                      <strong>Тип:</strong> Свободен час
                    </p>
                  ) : (
                    <>
                      <p>
                        <strong>Предмет:</strong>{" "}
                        {getSubjectName(
                          timetableEntries[selectedEntryIndex].subjectId
                        )}
                      </p>
                      <p>
                        <strong>Учител:</strong>{" "}
                        {getTeacherName(
                          timetableEntries[selectedEntryIndex].teacherId
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteEntryDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteEntry}
            >
              Изтрий час
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Periods Dialog */}
      <Dialog
        open={isEditPeriodsDialogOpen}
        onOpenChange={setIsEditPeriodsDialogOpen}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Редактирай учебните часове</DialogTitle>
            <DialogDescription>
              Дефинирайте времевите периоди за учебния ден
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {periods.map((period, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="w-24">
                      <Label>Час {period.period}</Label>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`start-time-${index}`}>
                          Начален час
                        </Label>
                        <Input
                          id={`start-time-${index}`}
                          type="time"
                          value={period.startTime}
                          onChange={(e) => {
                            const updatedPeriods = [...periods];
                            updatedPeriods[index].startTime = e.target.value;
                            setPeriods(updatedPeriods);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`end-time-${index}`}>Краен час</Label>
                        <Input
                          id={`end-time-${index}`}
                          type="time"
                          value={period.endTime}
                          onChange={(e) => {
                            const updatedPeriods = [...periods];
                            updatedPeriods[index].endTime = e.target.value;
                            setPeriods(updatedPeriods);
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        const updatedPeriods = periods.filter(
                          (_, i) => i !== index
                        );
                        setPeriods(updatedPeriods);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    if (periods.length === 0) {
                      // If there are no periods, add an initial one
                      setPeriods([
                        {
                          period: 1,
                          startTime: "08:00",
                          endTime: "08:45",
                        },
                      ]);
                      return;
                    }

                    const lastPeriod = periods[periods.length - 1];

                    // Calculate new times (10 minutes after the last period)
                    const lastEndTime = lastPeriod.endTime;
                    const [hours, minutes] = lastEndTime.split(":").map(Number);

                    let newStartHours = hours;
                    let newStartMinutes = minutes + 10;

                    // Handle minute overflow
                    if (newStartMinutes >= 60) {
                      newStartHours += Math.floor(newStartMinutes / 60);
                      newStartMinutes = newStartMinutes % 60;
                    }

                    // Handle hour overflow
                    if (newStartHours >= 24) {
                      newStartHours = newStartHours % 24;
                    }

                    const newStartTime = `${newStartHours
                      .toString()
                      .padStart(2, "0")}:${newStartMinutes
                      .toString()
                      .padStart(2, "0")}`;

                    // Calculate end time (45 minutes after start)
                    let newEndHours = newStartHours;
                    let newEndMinutes = newStartMinutes + 45;

                    // Handle minute overflow for end time
                    if (newEndMinutes >= 60) {
                      newEndHours += Math.floor(newEndMinutes / 60);
                      newEndMinutes = newEndMinutes % 60;
                    }

                    // Handle hour overflow for end time
                    if (newEndHours >= 24) {
                      newEndHours = newEndHours % 24;
                    }

                    const newEndTime = `${newEndHours
                      .toString()
                      .padStart(2, "0")}:${newEndMinutes
                      .toString()
                      .padStart(2, "0")}`;

                    setPeriods([
                      ...periods,
                      {
                        period: lastPeriod.period + 1,
                        startTime: newStartTime,
                        endTime: newEndTime,
                      },
                    ]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добави час
                </Button>
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditPeriodsDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              type="button"
              className="text-white"
              onClick={() => handleUpdatePeriods(periods)}
            >
              Запази часовете
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
