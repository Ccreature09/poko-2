"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { getClassesTaughtByTeacher, doesClassSessionExist } from '@/lib/timetableManagement';
import { getStudentsInClass } from '@/lib/schoolManagement';
import { recordClassAttendance, getClassSessionAttendance } from '@/lib/attendanceManagement';
import { Timestamp } from 'firebase/firestore';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, Check, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AttendanceStatus, HomeroomClass, Student, Teacher, Subject, AttendanceRecord } from '@/lib/interfaces';
import Sidebar from '@/components/functional/Sidebar';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AttendancePage() {
  const { user, loading: userLoading, error: userError } = useUser();
  const teacher = user as Teacher | null;
  
  // State for both tabs
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSessions, setClassSessions] = useState<Array<{
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
  }>>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceRecord[]>([]);
  const [hasExistingAttendance, setHasExistingAttendance] = useState(false);
  const [isCheckingExistingAttendance, setIsCheckingExistingAttendance] = useState(false);
  const [isCheckingTimetable, setIsCheckingTimetable] = useState(false);
  const [classSessionExists, setClassSessionExists] = useState<boolean | null>(null);
  
  // State for manual entry tab
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  
  // State for current class tab
  const [currentClass, setCurrentClass] = useState<{
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    period: number;
  } | null>(null);

  // State for tracking selected tab from URL
  const [activeTab, setActiveTab] = useState<string>('current-class');

  useEffect(() => {
    // Get the initial tab from URL if available
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam === 'manual-entry') {
        setActiveTab('manual-entry');
      }
    }
  }, []);
  
  // Load classes taught by the teacher
  useEffect(() => {
    if (userLoading || !teacher) return;
    
    const fetchClasses = async () => {
      try {
        setIsLoading(true);
        const teacherClassSessions = await getClassesTaughtByTeacher(teacher.schoolId, teacher.userId);
        console.log('Loaded class sessions:', teacherClassSessions);
        
        // Save the raw sessions data for use in current class detection
        setClassSessions(teacherClassSessions);
        
        // Process the class sessions to get unique classes and subjects
        const uniqueClasses = new Map();
        const uniqueSubjects = new Map();
        
        // Add each class and subject to the maps to remove duplicates
        teacherClassSessions.forEach((session) => {
          uniqueClasses.set(session.classId, {
            classId: session.classId,
            className: session.className
          });
          
          uniqueSubjects.set(session.subjectId, {
            subjectId: session.subjectId,
            name: session.subjectName
          });
        });
        
        // Convert maps to arrays
        const classesArray = Array.from(uniqueClasses.values());
        const subjectsArray = Array.from(uniqueSubjects.values());
        
        console.log('Unique classes:', classesArray);
        console.log('Unique subjects:', subjectsArray);
        
        setClasses(classesArray);
        setSubjects(subjectsArray);
        
        // Try to find current class based on day and time
        detectCurrentClass(teacherClassSessions);
      } catch (error) {
        console.error("Error fetching teacher classes:", error);
        toast({
          title: "Error",
          description: "Could not load classes. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClasses();
  }, [teacher, userLoading]);

  // Set class, subject, tab, date and period from URL parameters when classes and subjects are loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && !userLoading && teacher && classes.length > 0 && subjects.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const classIdParam = searchParams.get('classId');
      const subjectIdParam = searchParams.get('subjectId');
      const tabParam = searchParams.get('tab');
      const dateParam = searchParams.get('date');
      const periodParam = searchParams.get('period');
      
      // Always set to manual-entry tab when coming from timetable
      if (tabParam === 'manual-entry') {
        setActiveTab('manual-entry');
      }
      
      // Set class and subject if provided and valid
      if (classIdParam && classes.some(c => c.classId === classIdParam)) {
        setSelectedClassId(classIdParam);
        
        // If subject ID is also provided, set it if valid
        if (subjectIdParam && subjects.some(s => s.subjectId === subjectIdParam)) {
          setSelectedSubjectId(subjectIdParam);
        }
      }
      
      // Set date if provided
      if (dateParam) {
        try {
          const parsedDate = new Date(dateParam);
          if (!isNaN(parsedDate.getTime())) {
            console.log('Setting date from URL:', parsedDate);
            // We need to explicitly set the hours to 0 to avoid timezone issues
            parsedDate.setHours(0, 0, 0, 0);
            setSelectedDate(parsedDate);
          }
        } catch (e) {
          console.error("Failed to parse date parameter:", e);
        }
      }
      
      // Set period if provided
      if (periodParam) {
        const parsedPeriod = parseInt(periodParam);
        if (!isNaN(parsedPeriod) && parsedPeriod >= 1 && parsedPeriod <= 8) {
          console.log('Setting period from URL:', parsedPeriod);
          setSelectedPeriod(parsedPeriod);
        }
      }
    }
  }, [classes, subjects, teacher, userLoading]);

  // Function to detect the current class based on day and time
  const detectCurrentClass = (sessions: Array<{
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
  }>) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeAsMinutes = currentHour * 60 + currentMinutes;
    
    // Map JavaScript day (0=Sunday, 1=Monday, etc.) to day names in timetable
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = daysOfWeek[now.getDay()];
    
    // Find class session that matches current day and time
    const currentSession = sessions.find(session => {
      if (session.day !== currentDay) return false;
      
      // Convert session times to minutes for comparison
      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      const [endHour, endMinute] = session.endTime.split(':').map(Number);
      const startTimeAsMinutes = startHour * 60 + startMinute;
      const endTimeAsMinutes = endHour * 60 + endMinute;
      
      // Check if current time falls within class period
      return currentTimeAsMinutes >= startTimeAsMinutes && currentTimeAsMinutes <= endTimeAsMinutes;
    });
    
    if (currentSession) {
      console.log('Current class detected:', currentSession);
      setCurrentClass({
        classId: currentSession.classId,
        className: currentSession.className,
        subjectId: currentSession.subjectId,
        subjectName: currentSession.subjectName,
        period: currentSession.period
      });
      
      // Load students for current class
      loadStudentsForClass(currentSession.classId);
    } else {
      console.log('No current class found at this time');
      setCurrentClass(null);
    }
  };
  
  // Load students for a given class
  const loadStudentsForClass = async (classId: string) => {
    if (!teacher || !classId) return;
    
    try {
      setIsLoading(true);
      console.log(`Fetching students for class ID: ${classId}, school ID: ${teacher.schoolId}`);
      
      const classStudents = await getStudentsInClass(teacher.schoolId, classId);
      console.log('Students returned from database:', classStudents);
      
      if (!classStudents || classStudents.length === 0) {
        console.warn(`No students found for class ID: ${classId}`);
      }
      
      setStudents(classStudents);
      
      // Initialize attendance data for all students as 'present'
      const initialAttendance: Record<string, AttendanceStatus> = {};
      classStudents.forEach((student: Student) => {
        initialAttendance[student.userId] = 'present';
      });
      setAttendanceData(initialAttendance);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Could not load students. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load students when a class is selected in manual mode
  useEffect(() => {
    if (!selectedClassId || !teacher) return;
    loadStudentsForClass(selectedClassId);
  }, [selectedClassId, teacher]);

  // Check for existing attendance when all selection fields are filled
  useEffect(() => {
    if (!teacher || !selectedClassId || !selectedSubjectId || !selectedDate) return;
    
    const checkExistingAttendance = async () => {
      try {
        setIsCheckingExistingAttendance(true);
        
        // Create a timestamp for the selected date
        const selectedDateTimestamp = Timestamp.fromDate(selectedDate);
        
        // Fetch existing attendance records for this class session
        const existingRecords = await getClassSessionAttendance(
          teacher.schoolId,
          selectedClassId,
          selectedSubjectId,
          selectedDateTimestamp,
          selectedPeriod
        );
        
        if (existingRecords.length > 0) {
          console.log('Found existing attendance records:', existingRecords);
          setExistingAttendance(existingRecords);
          setHasExistingAttendance(true);
          
          // Pre-populate attendance data with existing values
          const existingAttendanceData: Record<string, AttendanceStatus> = {};
          existingRecords.forEach(record => {
            existingAttendanceData[record.studentId] = record.status;
          });
          setAttendanceData(existingAttendanceData);
          
          toast({
            title: "Existing Records Found",
            description: "This class session already has attendance records. You can review or update them.",
            variant: "default",
          });
        } else {
          console.log('No existing attendance records found');
          setExistingAttendance([]);
          setHasExistingAttendance(false);
        }
      } catch (error) {
        console.error("Error checking existing attendance:", error);
        toast({
          title: "Error",
          description: "Failed to check for existing attendance records.",
          variant: "destructive",
        });
      } finally {
        setIsCheckingExistingAttendance(false);
      }
    };

    checkExistingAttendance();
  }, [teacher, selectedClassId, selectedSubjectId, selectedDate, selectedPeriod]);

  // Check if the selected class session exists in the timetable
  useEffect(() => {
    if (!teacher || !selectedClassId || !selectedSubjectId || !selectedDate || !selectedPeriod) {
      // Reset the state if any of the required fields are missing
      setClassSessionExists(null);
      return;
    }
    
    const checkClassSession = async () => {
      try {
        setIsCheckingTimetable(true);
        
        // Convert selected date to day of week name
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = daysOfWeek[selectedDate.getDay()];
        
        // Check if this class session exists in the timetable
        const exists = await doesClassSessionExist(
          teacher.schoolId,
          selectedClassId,
          selectedSubjectId,
          dayOfWeek,
          selectedPeriod
        );
        
        setClassSessionExists(exists);
        
        if (!exists) {
          toast({
            title: "No Scheduled Class",
            description: `There is no ${subjects.find(s => s.subjectId === selectedSubjectId)?.name} class scheduled for ${classes.find(c => c.classId === selectedClassId)?.className} on ${dayOfWeek}, period ${selectedPeriod}.`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error checking timetable:", error);
        setClassSessionExists(false);
      } finally {
        setIsCheckingTimetable(false);
      }
    };
    
    checkClassSession();
  }, [teacher, selectedClassId, selectedSubjectId, selectedDate, selectedPeriod, classes, subjects]);

  const handleAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const submitCurrentClassAttendance = async () => {
    if (!teacher || !currentClass) {
      toast({
        title: "No current class",
        description: "No active class was detected at this time.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Format the attendance data for submission
      const attendanceRecords = Object.entries(attendanceData).map(([studentId, status]) => ({
        studentId,
        status
      }));
      
      // Record attendance for the current class
      await recordClassAttendance(
        teacher.schoolId,
        teacher.userId,
        currentClass.classId,
        currentClass.subjectId,
        Timestamp.fromDate(new Date()),  // Use current date and time
        currentClass.period,
        attendanceRecords
      );
      
      toast({
        title: "Success!",
        description: "Attendance for current class has been recorded successfully.",
        variant: "default",
      });
      
      // Reset form (but keep current class)
      setStudents([]);
      setAttendanceData({});
      
    } catch (error) {
      console.error("Error recording attendance:", error);
      toast({
        title: "Error",
        description: "Failed to record attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitManualAttendance = async () => {
    if (!teacher || !selectedClassId || !selectedSubjectId) {
      toast({
        title: "Missing information",
        description: "Please select a class and subject before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    if (classSessionExists === false) {
      toast({
        title: "No Scheduled Class",
        description: "Cannot mark attendance for a class that is not scheduled at this time.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Format the attendance data for submission
      const attendanceRecords = Object.entries(attendanceData).map(([studentId, status]) => ({
        studentId,
        status
      }));
      
      // Record attendance for the class
      await recordClassAttendance(
        teacher.schoolId,
        teacher.userId,
        selectedClassId,
        selectedSubjectId,
        Timestamp.fromDate(selectedDate),
        selectedPeriod,
        attendanceRecords
      );
      
      toast({
        title: "Success!",
        description: "Attendance has been recorded successfully.",
        variant: "default",
      });
      
      // Reset form
      setSelectedClassId('');
      setSelectedSubjectId('');
      setSelectedPeriod(1);
      setStudents([]);
      setAttendanceData({});
      setClassSessionExists(null);
      
    } catch (error) {
      console.error("Error recording attendance:", error);
      toast({
        title: "Error",
        description: "Failed to record attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to refresh current class detection
  const refreshCurrentClass = () => {
    if (classSessions.length > 0) {
      detectCurrentClass(classSessions);
    }
  };

  if (userLoading) {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (userError || !teacher || teacher.role !== 'teacher') {
    return (
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex-1 p-8 bg-gray-50">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">Access Denied</h3>
                <p className="text-gray-500 mt-2">
                  Only teachers can access the attendance management system.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Attendance Management</h1>
          
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="mb-8"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="current-class">Current Class</TabsTrigger>
              <TabsTrigger value="manual-entry">Manual Entry</TabsTrigger>
            </TabsList>
            
            {/* Current Class Tab */}
            <TabsContent value="current-class">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Current Class Attendance</CardTitle>
                      <CardDescription>Record attendance for your ongoing class</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={refreshCurrentClass}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                      <p>Detecting current class...</p>
                    </div>
                  ) : currentClass ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                        <h3 className="font-medium text-blue-800 mb-2">Currently Teaching:</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Class</p>
                            <p className="font-medium">{currentClass.className}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Subject</p>
                            <p className="font-medium">{currentClass.subjectName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Period</p>
                            <p className="font-medium">{currentClass.period}</p>
                          </div>
                        </div>
                      </div>
                      
                      {students.length > 0 ? (
                        <div>
                          <h3 className="font-medium text-gray-800 mb-4">Mark Attendance</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {students.map(student => (
                                <TableRow key={student.userId}>
                                  <TableCell className="font-medium">
                                    {student.firstName} {student.lastName}
                                  </TableCell>
                                  <TableCell>
                                    <RadioGroup 
                                      value={attendanceData[student.userId] || 'present'} 
                                      onValueChange={(value) => handleAttendanceChange(student.userId, value as AttendanceStatus)}
                                      className="flex space-x-2"
                                    >
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="present" 
                                          id={`current-present-${student.userId}`} 
                                          className="text-green-500 border-green-500"
                                        />
                                        <Label htmlFor={`current-present-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Present
                                        </Label>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="absent" 
                                          id={`current-absent-${student.userId}`} 
                                          className="text-red-500 border-red-500"
                                        />
                                        <Label htmlFor={`current-absent-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Absent
                                        </Label>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="late" 
                                          id={`current-late-${student.userId}`} 
                                          className="text-yellow-500 border-yellow-500"
                                        />
                                        <Label htmlFor={`current-late-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Late
                                        </Label>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="excused" 
                                          id={`current-excused-${student.userId}`} 
                                          className="text-blue-500 border-blue-500"
                                        />
                                        <Label htmlFor={`current-excused-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Excused
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          
                          <div className="mt-6">
                            <Button 
                              onClick={submitCurrentClassAttendance} 
                              disabled={isSubmitting || students.length === 0}
                              className="w-full"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Save Attendance Records
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 border rounded-md bg-gray-50">
                          <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                          <h3 className="text-lg font-medium text-gray-700">No Students Found</h3>
                          <p className="text-gray-500 mt-1">No students were found in this class.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 border rounded-md bg-gray-50">
                      <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700">No Current Class</h3>
                      <p className="text-gray-500 mt-1">No class is currently in session according to your schedule.</p>
                      <Button 
                        variant="outline" 
                        onClick={refreshCurrentClass} 
                        className="mt-4"
                      >
                        Refresh
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Manual Entry Tab */}
            <TabsContent value="manual-entry">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Step 1: Select Class</CardTitle>
                    <CardDescription>Choose from your assigned classes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {isLoading && (
                        <div className="p-2 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          <p className="text-sm text-gray-500 mt-1">Loading classes...</p>
                        </div>
                      )}
                      
                      {!isLoading && classes.length === 0 && (
                        <div className="p-2 text-center">
                          <p className="text-sm text-red-500">No classes found for this teacher</p>
                        </div>
                      )}
                      
                      <div className="grid gap-2">
                        <Label htmlFor="class">Class</Label>
                        <Select
                          value={selectedClassId}
                          onValueChange={(value) => {
                            console.log('Class selected:', value);
                            setSelectedClassId(value);
                          }}
                          disabled={isLoading || classes.length === 0}
                        >
                          <SelectTrigger id="class">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.length > 0 ? (
                              classes.map(cls => (
                                <SelectItem key={cls.classId} value={cls.classId}>
                                  {cls.className}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="p-2 text-center text-sm text-gray-500">
                                No classes available
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Select
                          value={selectedSubjectId}
                          onValueChange={setSelectedSubjectId}
                          disabled={isLoading || subjects.length === 0 || !selectedClassId}
                        >
                          <SelectTrigger id="subject">
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects.map(subject => (
                              <SelectItem key={subject.subjectId} value={subject.subjectId}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Step 2: Select Date & Period</CardTitle>
                    <CardDescription>When was this class?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              disabled={isLoading}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              value={selectedDate}
                              onChange={(value) => {
                                if (value instanceof Date) {
                                  setSelectedDate(value);
                                }
                              }}
                              className="rounded-md border"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="period">Period</Label>
                        <Select 
                          value={selectedPeriod.toString()} 
                          onValueChange={(value) => setSelectedPeriod(parseInt(value))}
                          disabled={isLoading}
                        >
                          <SelectTrigger id="period">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(period => (
                              <SelectItem key={period} value={period.toString()}>
                                Period {period}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-500" />
                          <span className="text-sm">
                            {students.length > 0 ? `${students.length} students loaded` : "No students loaded"}
                          </span>
                        </div>
                        
                        <Button 
                          onClick={submitManualAttendance} 
                          className="flex items-center gap-2"
                          disabled={
                            isSubmitting || 
                            isCheckingTimetable ||
                            !selectedClassId || 
                            !selectedSubjectId || 
                            students.length === 0 || 
                            Object.keys(attendanceData).length === 0 ||
                            classSessionExists === false
                          }
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Submit Attendance
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Only show attendance table when all required fields are selected and students are loaded */}
              {students.length > 0 && selectedClassId && selectedSubjectId && selectedDate && (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>Class Attendance</CardTitle>
                    <CardDescription>
                      {hasExistingAttendance 
                        ? `Viewing/updating existing attendance records for ${classes.find(c => c.classId === selectedClassId)?.className || "selected class"}`
                        : `Mark attendance for ${classes.find(c => c.classId === selectedClassId)?.className || "selected class"}`
                      }
                    </CardDescription>
                    {hasExistingAttendance && (
                      <div className="mt-2 text-sm bg-amber-50 text-amber-700 p-2 rounded-md border border-amber-200">
                        This class session already has attendance records. Any changes you make will update the existing records.
                      </div>
                    )}
                    {classSessionExists === false && (
                      <div className="mt-2 text-sm bg-red-50 text-red-700 p-2 rounded-md border border-red-200">
                        Warning: This class session is not scheduled according to the timetable. Attendance recording is disabled.
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isCheckingExistingAttendance || isCheckingTimetable ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                        <p>Checking class information...</p>
                      </div>
                    ) : classSessionExists === false ? (
                      <div className="text-center py-8 border rounded-md bg-gray-50">
                        <div className="bg-red-50 p-4 rounded-md border border-red-100 max-w-md mx-auto">
                          <h3 className="text-lg font-medium text-red-800">No Scheduled Class</h3>
                          <p className="text-sm text-red-600 mt-2">
                            There is no {subjects.find(s => s.subjectId === selectedSubjectId)?.name} class 
                            scheduled for {classes.find(c => c.classId === selectedClassId)?.className} on {' '}
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedDate.getDay()]}, 
                            period {selectedPeriod}.
                          </p>
                          <p className="text-sm text-red-600 mt-2">
                            Please select a different date, period, or subject that matches the timetable.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map(student => (
                            <TableRow key={student.userId}>
                              <TableCell className="font-medium">
                                {student.firstName} {student.lastName}
                              </TableCell>
                              <TableCell>
                                <RadioGroup 
                                  value={attendanceData[student.userId] || 'present'} 
                                  onValueChange={(value) => handleAttendanceChange(student.userId, value as AttendanceStatus)}
                                  className="flex space-x-2"
                                  disabled={classSessionExists !== true}
                                >
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="present" 
                                      id={`present-${student.userId}`} 
                                      className="text-green-500 border-green-500"
                                    />
                                    <Label htmlFor={`present-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Present
                                    </Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="absent" 
                                      id={`absent-${student.userId}`} 
                                      className="text-red-500 border-red-500"
                                    />
                                    <Label htmlFor={`absent-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Absent
                                    </Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="late" 
                                      id={`late-${student.userId}`} 
                                      className="text-yellow-500 border-yellow-500"
                                    />
                                    <Label htmlFor={`late-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Late
                                    </Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="excused" 
                                      id={`excused-${student.userId}`} 
                                      className="text-blue-500 border-blue-500"
                                    />
                                    <Label htmlFor={`excused-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Excused
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button 
                      onClick={submitManualAttendance} 
                      disabled={isSubmitting || isCheckingExistingAttendance || isCheckingTimetable || classSessionExists === false}
                      className="flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {hasExistingAttendance ? 'Update Attendance Records' : 'Save Attendance Records'}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

