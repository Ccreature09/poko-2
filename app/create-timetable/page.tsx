"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Sidebar from "@/components/functional/Sidebar";
import {
  saveTimetable,
  fetchTimetablesByHomeroomClassId,
} from "@/lib/timetableManagement";
import { toast } from "@/hooks/use-toast";

interface Class {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  teacherIds: string[]; // Fetch teacherIds from subjects
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

interface TimetableEntry {
  day: string;
  period: number;
  subjectId: string;
  teacherId: string;
}

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const defaultPeriods = [
  { period: 1, startTime: "07:30", endTime: "08:10" },
  { period: 2, startTime: "08:20", endTime: "09:00" },
  { period: 3, startTime: "09:10", endTime: "09:50" },
  { period: 4, startTime: "10:10", endTime: "10:50" },
  { period: 5, startTime: "11:00", endTime: "11:40" },
  { period: 6, startTime: "11:50", endTime: "12:30" },
  { period: 7, startTime: "12:40", endTime: "13:20" },
  { period: 8, startTime: "13:30", endTime: "14:10" },
];

export default function CreateTimetable() {
  const { user } = useUser();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [existingTimetableId, setExistingTimetableId] = useState<string | null>(
    null
  );
  const [customPeriods, setCustomPeriods] = useState(defaultPeriods);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.schoolId) return;

      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const subjectsRef = collection(db, "schools", user.schoolId, "subjects");
      const teachersRef = collection(db, "schools", user.schoolId, "users");

      const [classesSnapshot, subjectsSnapshot, teachersSnapshot] =
        await Promise.all([
          getDocs(classesRef),
          getDocs(subjectsRef),
          getDocs(teachersRef),
        ]);

      setClasses(
        classesSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().className,
        }))
      );
      setSubjects(
        subjectsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          teacherIds: doc.data().teacherIds || [], // Fetch teacherIds from subjects
        }))
      );
      setTeachers(
        teachersSnapshot.docs
          .filter((doc) => doc.data().role === "teacher")
          .map((doc) => ({
            id: doc.id,
            firstName: doc.data().firstName,
            lastName: doc.data().lastName,
          }))
      );
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const fetchTimetable = async () => {
      if (!user || !user.schoolId || !selectedClass) return;

      try {
        const fetchedTimetables = await fetchTimetablesByHomeroomClassId(
          user.schoolId,
          selectedClass
        );
        if (fetchedTimetables[0]?.data?.entries) {
          setTimetable(fetchedTimetables[0].data.entries as TimetableEntry[]);
          setExistingTimetableId(fetchedTimetables[0].id); // Set the existing timetable ID
        } else {
          setTimetable([]); // Clear timetable if no data exists for the selected class
          setExistingTimetableId(null); // Reset existing timetable ID
        }
      } catch (error) {
        console.error("Неуспешно зареждане на разписание", error);
        setTimetable([]); // Clear timetable on error
        setExistingTimetableId(null); // Reset existing timetable ID
      }
    };

    fetchTimetable();
  }, [user, selectedClass]);

  const handleSubjectChange = (
    day: string,
    period: number,
    subjectId: string
  ) => {
    const updatedTimetable = timetable.map((entry) =>
      entry.day === day && entry.period === period
        ? { ...entry, subjectId }
        : entry
    );
    if (
      !updatedTimetable.find(
        (entry) => entry.day === day && entry.period === period
      )
    ) {
      updatedTimetable.push({ day, period, subjectId, teacherId: "" });
    }
    setTimetable(updatedTimetable);
  };

  const handleTeacherChange = (
    day: string,
    period: number,
    teacherId: string
  ) => {
    const updatedTimetable = timetable.map((entry) =>
      entry.day === day && entry.period === period
        ? { ...entry, teacherId }
        : entry
    );
    if (
      !updatedTimetable.find(
        (entry) => entry.day === day && entry.period === period
      )
    ) {
      updatedTimetable.push({ day, period, subjectId: "", teacherId });
    }
    setTimetable(updatedTimetable);
  };

  const validateTimeFormat = (time: string) => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  const validateTimePeriod = (startTime: string, endTime: string) => {
    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
      return false;
    }
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const startDate = new Date(0, 0, 0, startHour, startMinute);
    const endDate = new Date(0, 0, 0, endHour, endMinute);
    return endDate > startDate;
  };

  const handleAddPeriod = () => {
    const newPeriodNumber = customPeriods.length + 1;
    const lastPeriod = customPeriods[customPeriods.length - 1];
    
    // Calculate default times based on last period
    const [lastEndHour, lastEndMinute] = lastPeriod.endTime.split(":").map(Number);
    const newStartTime = `${lastEndHour}:${(lastEndMinute + 10).toString().padStart(2, '0')}`;
    const newEndTime = `${lastEndHour}:${(lastEndMinute + 50).toString().padStart(2, '0')}`;
    
    setCustomPeriods([
      ...customPeriods,
      { period: newPeriodNumber, startTime: newStartTime, endTime: newEndTime }
    ]);
  };

  const handleUpdatePeriodTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    // Make sure to allow typing by not validating immediately
    const updatedPeriods = [...customPeriods];
    updatedPeriods[index] = {
      ...updatedPeriods[index],
      [field]: value
    };
    setCustomPeriods(updatedPeriods);

    // Only validate when the input matches the time format
    if (value.length === 5) {
      if (!validateTimeFormat(value)) {
        toast({
          title: "Invalid Time Format",
          description: "Please use the format HH:MM (e.g., 09:30)",
          variant: "destructive"
        });
        return;
      }

      if (!validateTimePeriod(updatedPeriods[index].startTime, updatedPeriods[index].endTime)) {
        toast({
          title: "Invalid Time Period",
          description: "End time must be after start time",
          variant: "destructive"
        });
        return;
      }
    }
  };

  const handleSaveTimetable = async () => {
    if (!user || !user.schoolId || !selectedClass) return;

    try {
      const classSessions = {
        homeroomClassId: selectedClass,
        periods: customPeriods, // Store the periods configuration
        entries: timetable.map((entry) => {
          // Find the matching period in customPeriods
          const periodData = customPeriods.find((p) => p.period === entry.period);
          
          return {
            classId: selectedClass,
            day: entry.day,
            period: entry.period,
            subjectId: entry.subjectId,
            teacherId: entry.teacherId,
            startTime: periodData?.startTime || "",
            endTime: periodData?.endTime || "",
          };
        }),
      };

      if (existingTimetableId) {
        const timetableRef = doc(
          db,
          "schools",
          user.schoolId,
          "timetables",
          existingTimetableId
        );
        await setDoc(timetableRef, classSessions, { merge: true });
      } else {
        await saveTimetable(user.schoolId, classSessions);
      }

      toast({
        title: "Успех",
        description: "Разписанието е запазено успешно.",
      });
    } catch (error) {
      console.error("Грешка при запазване на разписание:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно запазване на разписание. Моля, опитайте отново.",
        variant: "destructive",
      });
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Създаване на разписание</h1>
        
        <div className="max-w-7xl mx-auto">
          <Card className="mb-8 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-b bg-gray-50">
              <CardTitle className="text-xl text-gray-800">Изберете клас</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Select 
                onValueChange={setSelectedClass} 
                value={selectedClass}
              >
                <SelectTrigger className="w-full md:w-[300px] bg-white">
                  <SelectValue placeholder="Изберете клас" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          {selectedClass && (
            <Card className="shadow-md mb-8">
              <CardHeader className="border-b bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-xl text-gray-800">Разписание</CardTitle>
                  <div className="text-sm text-gray-500 mt-2 md:mt-0">
                    {existingTimetableId 
                      ? "Редактиране на съществуващо разписание" 
                      : "Създаване на ново разписание"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto -mx-4 sm:mx-0 mb-6">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200">Час</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200">Време</th>
                          {days.map((day) => (
                            <th key={day} className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider border border-gray-200">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customPeriods.map(({ period, startTime, endTime }, index) => (
                          <tr key={period} className="hover:bg-gray-50 transition-colors">
                            <td className="border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
                              {period}
                            </td>
                            <td className="border border-gray-200 px-4 py-3">
                              <div className="flex flex-col sm:flex-row gap-2 items-center">
                                <input
                                  type="text"
                                  className="flex h-9 w-full sm:w-24 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                  value={startTime}
                                  onChange={(e) => handleUpdatePeriodTime(index, 'startTime', e.target.value)}
                                  placeholder="HH:MM"
                                  maxLength={5}
                                />
                                <span className="text-sm text-gray-500">-</span>
                                <input
                                  type="text"
                                  className="flex h-9 w-full sm:w-24 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                  value={endTime}
                                  onChange={(e) => handleUpdatePeriodTime(index, 'endTime', e.target.value)}
                                  placeholder="HH:MM"
                                  maxLength={5}
                                />
                              </div>
                            </td>
                            {days.map((day) => (
                              <td key={day} className="border border-gray-200 px-4 py-3">
                                <div className="flex flex-col gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Предмет</label>
                                    <Select
                                      onValueChange={(subjectId) => handleSubjectChange(day, period, subjectId)}
                                      value={timetable.find((entry) => entry.day === day && entry.period === period)?.subjectId || ""}
                                    >
                                      <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Изберете" />
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
                                  <div>
                                    <label className="block text-xs text-gray-500 mb-1">Учител</label>
                                    <Select
                                      onValueChange={(teacherId) => handleTeacherChange(day, period, teacherId)}
                                      value={timetable.find((entry) => entry.day === day && entry.period === period)?.teacherId || ""}
                                    >
                                      <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Изберете" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {teachers.map((teacher) => (
                                          <SelectItem key={teacher.id} value={teacher.id}>
                                            {teacher.firstName} {teacher.lastName}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div>
                    <Button 
                      onClick={handleAddPeriod} 
                      variant="outline" 
                      className="bg-white border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Добавяне на учебен час
                    </Button>
                  </div>
                  <div>
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
              </CardContent>
            </Card>
          )}

          {selectedClass && !customPeriods.length && (
            <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500">Няма конфигурирани учебни часове</p>
              <p className="text-sm text-gray-400 mt-1">Използвайте бутона \"Добавяне на учебен час\", за да започнете</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
