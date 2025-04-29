"use client";

import { useUser } from "@/contexts/UserContext";
import { useTimetable } from "@/contexts/TimetableContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClassSession } from "@/lib/interfaces";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import Sidebar from "@/components/functional/Sidebar";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
// Default periods as fallback
const defaultPeriods = [
  { period: 1, startTime: "07:30", endTime: "08:10" },
  { period: 2, startTime: "08:20", endTime: "09:00" },
  { period: 3, startTime: "09:10", endTime: "09:50" },
  { period: 4, startTime: "10:10", endTime: "10:50" },
  { period: 5, startTime: "11:00", endTime: "11:40" },
  { period: 6, startTime: "11:50", endTime: "12:30" },
  { period: 7, startTime: "12:40", endTime: "13:20" },
  { period: 8, startTime: "13:30", endTime: "14:10" }
];

export default function ParentTimetable() {
  const { user } = useUser();
  const { timetable, loading, error } = useTimetable();
  const [subjects, setSubjects] = useState<{ [key: string]: string }>({});
  const [teachers, setTeachers] = useState<{ [key: string]: string }>({});
  const [activeDay, setActiveDay] = useState(days[0]);
  const [periods, setPeriods] = useState(defaultPeriods);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<any[]>([]);

  // State for storing the child-specific timetable
  const [childTimetable, setChildTimetable] = useState<ClassSession[] | null>(null);
  const [childTimetableLoading, setChildTimetableLoading] = useState<boolean>(false);
  const [childTimetableError, setChildTimetableError] = useState<string | null>(null);

  // Get periods from the timetable if available
  useEffect(() => {
    if (timetable && timetable.length > 0 && timetable[0].periods) {
      setPeriods(timetable[0].periods);
    }
  }, [timetable]);

  // Fetch parent's children
  useEffect(() => {
    if (user?.userId && user.role === 'parent' && user.schoolId) {
      const fetchChildren = async () => {
        try {
          // Get the parent document to access childrenIds
          const parentDoc = await getDoc(doc(db, "schools", user.schoolId, "users", user.userId));
          if (!parentDoc.exists()) {
            console.error("Parent document not found");
            return;
          }
          
          const parentData = parentDoc.data();
          const childrenIds = parentData.childrenIds || [];
          const childrenList = [];
          
          // Fetch details for each child
          for (const childId of childrenIds) {
            const childDoc = await getDoc(doc(db, "schools", user.schoolId, "users", childId));
            if (childDoc.exists() && childDoc.data().role === 'student') {
              const childData = childDoc.data();
              childrenList.push({
                id: childId,
                name: `${childData.firstName} ${childData.lastName}`,
                classId: childData.homeroomClassId
              });
            }
          }

          setChildren(childrenList);
          if (childrenList.length > 0) {
            setSelectedChildId(childrenList[0].id);
          }
        } catch (error) {
          console.error("Failed to fetch children:", error);
        }
      };

      fetchChildren();
    }
  }, [user]);

  useEffect(() => {
    if (user?.schoolId) {
      const fetchSubjects = async () => {
        try {
          const subjectsCollection = collection(db, `schools/${user.schoolId}/subjects`);
          const subjectsSnapshot = await getDocs(subjectsCollection);
          const subjectMap: { [key: string]: string } = {};

          subjectsSnapshot.forEach((doc) => {
            const subjectData = doc.data();
            subjectMap[doc.id] = subjectData.name;
          });

          setSubjects(subjectMap);
        } catch (error) {
          console.error("Failed to fetch subjects from Firestore:", error);
        }
      };

      const fetchTeachers = async () => {
        try {
          const teachersCollection = collection(db, `schools/${user.schoolId}/users`);
          const teachersSnapshot = await getDocs(teachersCollection);
          const teacherMap: { [key: string]: string } = {};

          teachersSnapshot.forEach((doc) => {
            const teacherData = doc.data();
            if (teacherData.role === 'teacher') {
              teacherMap[doc.id] = `${teacherData.firstName} ${teacherData.lastName}`;
            }
          });

          setTeachers(teacherMap);
        } catch (error) {
          console.error("Failed to fetch teachers from Firestore:", error);
        }
      };

      fetchSubjects();
      fetchTeachers();
    }
  }, [user]);

  // Fetch timetable when a child is selected
  useEffect(() => {
    if (!user?.schoolId || !selectedChildId) return;
    
    const fetchChildTimetable = async () => {
      setChildTimetableLoading(true);
      setChildTimetableError(null);
      
      try {
        // Get the selected child's class ID
        const selectedChild = children.find(child => child.id === selectedChildId);
        if (!selectedChild || !selectedChild.classId) {
          setChildTimetableError("Избраното дете няма назначен клас");
          setChildTimetable(null);
          return;
        }
        
        // Import the function directly here to avoid circular dependency
        const { fetchTimetablesByHomeroomClassId } = await import("@/lib/timetableManagement");
        
        // Fetch timetable for the child's class
        const fetchedTimetable = await fetchTimetablesByHomeroomClassId(user.schoolId, selectedChild.classId);
        console.log("Fetched timetable for child's class:", fetchedTimetable);
        
        if (fetchedTimetable.length === 0) {
          setChildTimetable([]);
          setChildTimetableError("Няма намерено разписание за този клас");
        } else {
          const mappedTimetable = fetchedTimetable.map(item => item.data);
          setChildTimetable(mappedTimetable);
        }
      } catch (error) {
        console.error("Failed to fetch child's timetable:", error);
        setChildTimetableError("Грешка при зареждане на разписанието");
      } finally {
        setChildTimetableLoading(false);
      }
    };
    
    fetchChildTimetable();
  }, [user?.schoolId, selectedChildId, children]);

  const getDetailsForPeriod = (day: string, period: number): { subject: string; teacher: string }[] => {
    const timetableToUse = childTimetable || timetable;
    if (!timetableToUse) return [{ subject: '-', teacher: '-' }];

    const sessions = timetableToUse.filter((session: ClassSession) =>
      session.entries.some(entry => entry.day === day && entry.period === period)
    );

    if (sessions.length > 0) {
      const details = sessions.map(session => {
        const entry = session.entries.find(entry => entry.day === day && entry.period === period);
        
        return {
          subject: subjects[entry?.subjectId || ''] || '-',
          teacher: teachers[entry?.teacherId || ''] || '-',
        };
      });

      return details;
    }

    return [{ subject: '-', teacher: '-' }];
  };

  // Get the current day of the week on component load
  useEffect(() => {
    const today = new Date().getDay();
    // Convert JS day (0=Sunday, 1=Monday) to our days array (0=Monday)
    const dayIndex = today === 0 ? 4 : today - 1; // If Sunday, show Friday, otherwise show current day
    if (dayIndex >= 0 && dayIndex < days.length) {
      setActiveDay(days[dayIndex]);
    }
  }, []);

  if (!user || user.role !== 'parent') return null;

  const selectedChild = children.find(child => child.id === selectedChildId);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-8">Разписание</h1>
        
        {/* Child selector */}
        {children.length > 0 && (
          <div className="mb-6">
            <label htmlFor="childSelect" className="block text-sm font-medium mb-2">
              Избери дете:
            </label>
            <select
              id="childSelect"
              value={selectedChildId || ''}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="w-full md:w-64 p-2 border rounded-md"
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {loading || childTimetableLoading ? (
          <p>Зареждане...</p>
        ) : error || childTimetableError ? (
          <p>{error || childTimetableError}</p>
        ) : !selectedChildId ? (
          <p>Моля, изберете дете, за да видите разписанието.</p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                Седмичен график - {selectedChild?.name || 'Ученик'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop View - Full Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Време</th>
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
                        <td className="px-4 py-2 text-center">
                          {startTime} - {endTime}
                        </td>
                        {days.map((day) => {
                          const details = getDetailsForPeriod(day, period);
                          return (
                            <td key={day} className="px-4 py-2 text-center">
                              {details.map((detail, index) => (
                                <div key={index} className="space-y-1">
                                  <div>{detail.subject}</div>
                                  <div className="text-sm text-gray-500">{detail.teacher}</div>
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Mobile View - Tabs by Day */}
              <div className="md:hidden">
                <Tabs defaultValue={activeDay} onValueChange={setActiveDay}>
                  <TabsList className="grid grid-cols-5 mb-4">
                    {days.map((day) => (
                      <TabsTrigger key={day} value={day}>
                        {day.substring(0, 3)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {days.map((day) => (
                    <TabsContent key={day} value={day}>
                      <div className="space-y-3">
                        {periods.map(({ period, startTime, endTime }) => {
                          const details = getDetailsForPeriod(day, period);
                          return (
                            <Card key={period} className="overflow-hidden">
                              <CardHeader className="p-3 bg-muted">
                                <CardTitle className="text-sm">{startTime} - {endTime}</CardTitle>
                              </CardHeader>
                              <CardContent className="p-3">
                                {details.map((detail, index) => (
                                  <div key={index}>
                                    <div className="font-medium">{detail.subject}</div>
                                    <div className="text-sm text-gray-500">{detail.teacher}</div>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}