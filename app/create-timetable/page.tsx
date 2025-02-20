"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/Sidebar";
import { saveTimetable, fetchTimetablesByHomeroomClassId } from "@/lib/timetableManagement";
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
const periods = [
  { period: 1, startTime: "07:30", endTime: "08:10" },
  { period: 2, startTime: "08:20", endTime: "09:00" },
  { period: 3, startTime: "09:10", endTime: "09:50" },
  { period: 4, startTime: "10:10", endTime: "10:50" },
  { period: 5, startTime: "11:00", endTime: "11:40" },
  { period: 6, startTime: "11:50", endTime: "12:30" },
  { period: 7, startTime: "12:40", endTime: "13:20" },
  { period: 8, startTime: "13:30", endTime: "14:10" }
];

export default function CreateTimetable() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [existingTimetableId, setExistingTimetableId] = useState<string | null>(null); // Track existing timetable ID

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.schoolId) return;

      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const subjectsRef = collection(db, "schools", user.schoolId, "subjects");
      const teachersRef = collection(db, "schools", user.schoolId, "users");

      const [classesSnapshot, subjectsSnapshot, teachersSnapshot] = await Promise.all([
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
        const fetchedTimetables = await fetchTimetablesByHomeroomClassId(user.schoolId, selectedClass);
        if (fetchedTimetables.length > 0) {
          setTimetable(fetchedTimetables[0].data.entries as TimetableEntry[]);
          setExistingTimetableId(fetchedTimetables[0].id); // Set the existing timetable ID
        } else {
          setTimetable([]); // Clear timetable if no data exists for the selected class
          setExistingTimetableId(null); // Reset existing timetable ID
        }
      } catch (error) {
        console.error("Failed to fetch timetable", error);
        setTimetable([]); // Clear timetable on error
        setExistingTimetableId(null); // Reset existing timetable ID
      }
    };

    fetchTimetable();
  }, [user, selectedClass]);

  const handleTimetableChange = (
    day: string,
    period: number,
    subjectId: string,
    teacherId: string
  ) => {
    const updatedTimetable = timetable.filter(
      (entry) => !(entry.day === day && entry.period === period)
    );
    updatedTimetable.push({ day, period, subjectId, teacherId });
    setTimetable([...updatedTimetable]);
  };

  const handleSubjectChange = (day: string, period: number, subjectId: string) => {
    const updatedTimetable = timetable.map((entry) =>
      entry.day === day && entry.period === period
        ? { ...entry, subjectId }
        : entry
    );
    if (!updatedTimetable.find((entry) => entry.day === day && entry.period === period)) {
      updatedTimetable.push({ day, period, subjectId, teacherId: "" });
    }
    setTimetable(updatedTimetable);

    // Filter teachers based on the selected subject
    const selectedSubject = subjects.find((subject) => subject.id === subjectId);
    const filtered = teachers.filter((teacher) => selectedSubject?.teacherIds.includes(teacher.id));
    setFilteredTeachers(filtered);
  };

  const handleTeacherChange = (day: string, period: number, teacherId: string) => {
    const updatedTimetable = timetable.map((entry) =>
      entry.day === day && entry.period === period
        ? { ...entry, teacherId }
        : entry
    );
    if (!updatedTimetable.find((entry) => entry.day === day && entry.period === period)) {
      updatedTimetable.push({ day, period, subjectId: "", teacherId });
    }
    setTimetable(updatedTimetable);
  };

  const handleSaveTimetable = async () => {
    if (!user || !user.schoolId || !selectedClass) return;

    try {
      const classSessions = {
        homeroomClassId: selectedClass,
        entries: timetable.map((entry) => ({
          classId: selectedClass,
          startTime: periods.find((p) => p.period === entry.period)?.startTime || "",
          endTime: periods.find((p) => p.period === entry.period)?.endTime || "",
          ...entry,
        })),
      };

      if (existingTimetableId) {
        // Update existing timetable
        const timetableRef = doc(db, "schools", user.schoolId, "timetables", existingTimetableId);
        await setDoc(timetableRef, classSessions, { merge: true });
      } else {
        // Create new timetable
        await saveTimetable(user.schoolId, selectedClass, classSessions);
      }

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

  if (!user || user.role !== "admin") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Create Timetable</h1>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Class</CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedClass} value={selectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select a class" />
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
          <Card>
            <CardHeader>
              <CardTitle>Timetable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Period</th>
                      <th className="px-4 py-2">Time</th>
                      {days.map((day) => (
                        <th key={day} className="px-4 py-2">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(({ period, startTime, endTime }) => (
                      <tr key={period}>
                        <td className="border px-4 py-2">{period}</td>
                        <td className="border px-4 py-2">
                          {startTime} - {endTime}
                        </td>
                        {days.map((day) => (
                          <td key={day} className="border px-4 py-2">
                            <div className="flex flex-col">
                              <Select
                                onValueChange={(subjectId) => handleSubjectChange(day, period, subjectId)}
                                value={
                                  timetable.find(
                                    (entry) =>
                                      entry.day === day &&
                                      entry.period === period
                                  )?.subjectId || ""
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subjects.map((subject) => (
                                    <SelectItem key={subject.id} value={subject.id}>
                                      {subject.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                onValueChange={(teacherId) => handleTeacherChange(day, period, teacherId)}
                                value={
                                  timetable.find(
                                    (entry) =>
                                      entry.day === day &&
                                      entry.period === period
                                  )?.teacherId || ""
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select teacher" />
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}