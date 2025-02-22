"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSubjects } from "@/lib/subjectManagement";
import {
  getClasses,
  saveTimetable,
  getTimetable,
} from "@/lib/timetableManagement";
import { toast } from "@/hooks/use-toast";
import type { Subject, HomeroomClass, ClassSession } from "@/lib/interfaces";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const periods = [1, 2, 3, 4, 5, 6, 7, 8];

export function TimetableManagement() {
  const { user } = useUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [timetable, setTimetable] = useState<ClassSession>({
    entries: [],
    homeroomClassId: "",
  });

  const fetchSubjectsAndClasses = useCallback(async () => {
    if (user) {
      try {
        const [fetchedSubjects, fetchedClasses] = await Promise.all([
          getSubjects(user.schoolId),
          getClasses(user.schoolId),
        ]);
        setSubjects(fetchedSubjects);
        setClasses(fetchedClasses);
      } catch (error) {
        console.error("Error fetching subjects and classes:", error);
        toast({
          title: "Error",
          description:
            "Failed to fetch subjects and classes. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [user]);

  useEffect(() => {
    fetchSubjectsAndClasses();
  }, [fetchSubjectsAndClasses]);

  const fetchTimetable = async (classId: string) => {
    try {
      const fetchedTimetable = await getTimetable(user!.schoolId, classId);
      setTimetable(fetchedTimetable);
    } catch (error) {
      console.error("Error fetching timetable:", error);
      toast({
        title: "Error",
        description: "Failed to fetch timetable. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    fetchTimetable(classId);
  };

  const handleTimetableChange = (
    day: string,
    period: number,
    subjectId: string,
    teacherId: string
  ) => {
    const updatedEntries = timetable.entries.filter(
      (entry) => !(entry.day === day && entry.period === period)
    );
    updatedEntries.push({
      day,
      period,
      classId: selectedClass!,
      subjectId,
      teacherId,
      startTime: `${period}:00`, // Placeholder, adjust as needed
      endTime: `${period + 1}:00`, // Placeholder, adjust as needed
    });
    setTimetable({
      ...timetable,
      entries: updatedEntries,
    });
  };

  const handleSaveTimetable = async () => {
    if (!selectedClass) return;

    try {
      await saveTimetable(user!.schoolId, selectedClass, timetable);
      toast({
        title: "Success",
        description: "Timetable saved successfully.",
      });
    } catch (error) {
      console.error("Error saving timetable:", error);
      toast({
        title: "Error",
        description: "Failed to save timetable. Please try again.",
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
        <CardTitle>Timetable Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="class-select">Select Class</Label>
            <Select onValueChange={handleClassChange}>
              <SelectTrigger id="class-select">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.classId} value={cls.classId}>
                    {cls.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClass && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Timetable</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2">Period</th>
                      {days.map((day) => (
                        <th key={day} className="border p-2">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr key={period}>
                        <td className="border p-2">{period}</td>
                        {days.map((day) => (
                          <td key={`${day}-${period}`} className="border p-2">
                            <Select
                              onValueChange={(value) => {
                                const [subjectId, teacherId] = value.split("|");
                                handleTimetableChange(
                                  day,
                                  period,
                                  subjectId,
                                  teacherId
                                );
                              }}
                              value={
                                timetable.entries.find(
                                  (entry) =>
                                    entry.day === day && entry.period === period
                                )?.subjectId || ""
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map((subject) =>
                                  subject.teacherIds.map((teacherId) => (
                                    <SelectItem
                                      key={`${subject.subjectId}-${teacherId}`}
                                      value={`${subject.subjectId}|${teacherId}`}
                                    >
                                      {subject.name} - Teacher ID: {teacherId}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleSaveTimetable} className="mt-4 text-white">
                Save Timetable
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}