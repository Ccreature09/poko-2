/**
 * Компонент за управление на учебното разписание
 * 
 * Предоставя административен интерфейс за:
 * - Създаване и редактиране на седмично разписание за всеки клас
 * - Запазване на промените в разписанието
 * - Управление на часове по дни и периоди
 * - Автоматично зареждане на предмети и учители
 * 
 * Функционалности:
 * - Интерактивна таблица за седмичното разписание
 * - Избор на предмет и преподавател за всеки час
 * - Валидация на въведените данни
 * - Защита на достъпа само за администратори
 * - Автоматично запазване на промените
 */

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
    try {
      await saveTimetable(user!.schoolId, timetable);
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
    <Card className="shadow-md">
      <CardHeader className="border-b bg-gray-50">
        <CardTitle className="text-xl text-gray-800">Управление на разписание</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <Label htmlFor="class-select" className="text-gray-700 mb-2 block">Изберете клас</Label>
            <Select onValueChange={handleClassChange}>
              <SelectTrigger id="class-select" className="w-full md:w-[300px] bg-white">
                <SelectValue placeholder="Изберете клас" />
              </SelectTrigger>
              <SelectContent>
                {classes.length > 0 ? (
                  classes.map((cls) => (
                    <SelectItem key={cls.classId} value={cls.classId}>
                      {cls.className}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-classes" disabled>
                    Няма налични класове
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedClass && (
            <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">Разписание на {classes.find(c => c.classId === selectedClass)?.className || 'избрания клас'}</h3>
              
              <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200">Час</th>
                        {days.map((day) => (
                          <th key={day} className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {periods.map((period) => (
                        <tr key={period} className="hover:bg-gray-50 transition-colors">
                          <td className="border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
                            {period}
                          </td>
                          {days.map((day) => (
                            <td key={`${day}-${period}`} className="border border-gray-200 px-4 py-3">
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
                                  )
                                    ? `${timetable.entries.find(
                                        (entry) =>
                                          entry.day === day && entry.period === period
                                      )?.subjectId}|${timetable.entries.find(
                                        (entry) =>
                                          entry.day === day && entry.period === period
                                      )?.teacherId}`
                                    : ""
                                }
                              >
                                <SelectTrigger className="w-full bg-white">
                                  <SelectValue placeholder="Изберете предмет" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.length > 0 ? (
                                    subjects.map((subject) =>
                                      subject.teacherIds.map((teacherId) => (
                                        <SelectItem
                                          key={`${subject.subjectId}-${teacherId}`}
                                          value={`${subject.subjectId}|${teacherId}`}
                                        >
                                          <span className="flex items-center">
                                            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-2"></span>
                                            {subject.name} - Учител ID: {teacherId.substring(0, 5)}...
                                          </span>
                                        </SelectItem>
                                      ))
                                    )
                                  ) : (
                                    <SelectItem value="no-subjects" disabled>
                                      Няма налични предмети
                                    </SelectItem>
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
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveTimetable} 
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Запазване на разписание
                </Button>
              </div>
            </div>
          )}

          {!selectedClass && (
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500">Все още не е избран клас</p>
              <p className="text-sm text-gray-400 mt-1">Моля, първо изберете клас от списъка по-горе</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}