"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { 
  type AttendancePageState,
  getInitialAttendanceState,
  initializeStateFromURL,
  loadAndUpdateAttendanceForm,
  refreshCurrentClass as refreshCurrentClassUtil,
  submitCurrentClassAttendance as submitCurrentClassAttendanceUtil,
  submitManualAttendance as submitManualAttendanceUtil,
  handleAttendanceChange as handleAttendanceChangeUtil,
  fetchInitialClassesData
} from '@/lib/attendanceManagement';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, Check, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { AttendanceStatus, Teacher} from '@/lib/interfaces';
import Sidebar from '@/components/functional/Sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AttendancePage() {
  const { user, loading: userLoading, error: userError } = useUser();
  const teacher = user as Teacher | null;
  
  const [state, setState] = useState<AttendancePageState>(getInitialAttendanceState());
  
  const {
    classes,
    subjects,
    classSessions,
    students,
    attendanceData,
    isLoading,
    isSubmitting,
    existingAttendance,
    hasExistingAttendance,
    isCheckingExistingAttendance,
    isCheckingTimetable,
    classSessionExists,
    selectedClassId,
    selectedSubjectId,
    selectedDate,
    selectedPeriod,
    currentClass,
    activeTab
  } = state;
  
  useEffect(() => {
    // Get the initial tab from URL if available
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      if (tabParam === 'manual-entry') {
        setState(prev => ({ ...prev, activeTab: 'manual-entry' }));
      }
    }
  }, []);
  
  // Load classes taught by the teacher
  useEffect(() => {
    if (userLoading || !teacher) return;
    
    const fetchClasses = async () => {
      setState(prevState => {
        // Start loading to prevent multiple fetches
        if (prevState.isLoading) return prevState;
        
        fetchInitialClassesData(prevState, teacher)
          .then(updatedState => {
            setState(updatedState);
          })
          .catch(error => {
            console.error("Error fetching classes:", error);
            setState(prev => ({ ...prev, isLoading: false }));
          });
        
        // Return state with loading flag set to true
        return { ...prevState, isLoading: true };
      });
    };
    
    fetchClasses();
  }, [teacher, userLoading]); // Removed state from dependencies

  // Set class, subject, tab, date and period from URL parameters when classes and subjects are loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && !userLoading && teacher && classes.length > 0 && subjects.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      setState(prevState => {
        const updatedState = initializeStateFromURL(prevState, searchParams, classes, subjects);
        return updatedState;
      });
    }
  }, [classes, subjects, teacher, userLoading]); // Removed state from dependencies

  // Load students when a class is selected in manual mode
  useEffect(() => {
    if (!selectedClassId || !teacher) return;
    
    const updateForm = async () => {
      setState(prevState => {
        // Prevent multiple fetches if already loading
        if (prevState.isCheckingExistingAttendance) return prevState;
        
        loadAndUpdateAttendanceForm(prevState, teacher)
          .then(updatedState => {
            setState(updatedState);
          })
          .catch(error => {
            console.error("Error loading form data:", error);
            setState(prev => ({ 
              ...prev, 
              isLoading: false,
              isCheckingExistingAttendance: false,
              isCheckingTimetable: false
            }));
          });
        
        // Return state with loading flags set to true
        return { 
          ...prevState, 
          isCheckingExistingAttendance: true,
          isCheckingTimetable: true
        };
      });
    };
    
    updateForm();
  }, [selectedClassId, teacher, selectedSubjectId, selectedDate, selectedPeriod]); // Removed state from dependencies

  // Handler functions that update the state
  const handleAttendanceChange = (studentId: string, status: AttendanceStatus) => {
    const updatedState = handleAttendanceChangeUtil(state, studentId, status);
    setState(updatedState);
  };

  const handleSubmitCurrentClassAttendance = async () => {
    if (!teacher) return;
    
    const updatedState = await submitCurrentClassAttendanceUtil(state, teacher);
    setState(updatedState);
  };

  const handleSubmitManualAttendance = async () => {
    if (!teacher) return;
    
    const updatedState = await submitManualAttendanceUtil(state, teacher);
    setState(updatedState);
  };

  // Function to refresh current class detection
  const handleRefreshCurrentClass = async () => {
    if (!teacher) return;
    
    const updatedState = await refreshCurrentClassUtil(state, teacher);
    setState(updatedState);
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
            onValueChange={(value) => setState(prev => ({ ...prev, activeTab: value }))}
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
                      onClick={handleRefreshCurrentClass}
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
                              onClick={handleSubmitCurrentClassAttendance} 
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
                        onClick={handleRefreshCurrentClass} 
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
                            setState(prev => ({ ...prev, selectedClassId: value }));
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
                          onValueChange={(value) => setState(prev => ({ ...prev, selectedSubjectId: value }))}
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
                                  setState(prev => ({ ...prev, selectedDate: value }));
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
                          onValueChange={(value) => setState(prev => ({ ...prev, selectedPeriod: parseInt(value) }))}
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
                          onClick={handleSubmitManualAttendance} 
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
                      onClick={handleSubmitManualAttendance} 
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