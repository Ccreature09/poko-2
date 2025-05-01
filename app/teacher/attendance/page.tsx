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
    students,
    attendanceData,
    isLoading,
    isSubmitting,
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
                <h3 className="text-lg font-medium">Достъп отказан</h3>
                <p className="text-gray-500 mt-2">
                  Само учители имат достъп до системата за управление на присъствията.
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
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Управление на присъствията</h1>
          
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => setState(prev => ({ ...prev, activeTab: value }))}
            className="mb-8"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="current-class">Текущ час</TabsTrigger>
              <TabsTrigger value="manual-entry">Ръчно въвеждане</TabsTrigger>
            </TabsList>
            
            {/* Current Class Tab */}
            <TabsContent value="current-class">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Присъствия в текущия час</CardTitle>
                      <CardDescription>Записване на присъствия за текущия учебен час</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleRefreshCurrentClass}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                      Обнови
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                      <p>Откриване на текущия час...</p>
                    </div>
                  ) : currentClass ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                        <h3 className="font-medium text-blue-800 mb-2">В момента преподавате:</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Клас</p>
                            <p className="font-medium">{currentClass.className}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Предмет</p>
                            <p className="font-medium">{currentClass.subjectName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Час</p>
                            <p className="font-medium">{currentClass.period}</p>
                          </div>
                        </div>
                      </div>
                      
                      {students.length > 0 ? (
                        <div>
                          <h3 className="font-medium text-gray-800 mb-4">Отбележи присъствия</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ученик</TableHead>
                                <TableHead>Статус</TableHead>
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
                                          Присъства
                                        </Label>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="absent" 
                                          id={`current-absent-${student.userId}`} 
                                          className="text-red-500 border-red-500"
                                        />
                                        <Label htmlFor={`current-absent-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Отсъства
                                        </Label>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="late" 
                                          id={`current-late-${student.userId}`} 
                                          className="text-yellow-500 border-yellow-500"
                                        />
                                        <Label htmlFor={`current-late-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Закъснява
                                        </Label>
                                      </div>
                                      
                                      <div className="flex items-center space-x-1">
                                        <RadioGroupItem 
                                          value="excused" 
                                          id={`current-excused-${student.userId}`} 
                                          className="text-blue-500 border-blue-500"
                                        />
                                        <Label htmlFor={`current-excused-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                          Извинен
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
                                  Изпращане...
                                </>
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Запази присъствията
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 border rounded-md bg-gray-50">
                          <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                          <h3 className="text-lg font-medium text-gray-700">Няма намерени ученици</h3>
                          <p className="text-gray-500 mt-1">В този клас не бяха намерени ученици.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 border rounded-md bg-gray-50">
                      <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-700">Няма текущ час</h3>
                      <p className="text-gray-500 mt-1">Според вашето разписание в момента не тече учебен час.</p>
                      <Button 
                        variant="outline" 
                        onClick={handleRefreshCurrentClass} 
                        className="mt-4"
                      >
                        Обнови
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
                    <CardTitle>Стъпка 1: Избор на клас</CardTitle>
                    <CardDescription>Изберете измежду вашите класове</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {isLoading && (
                        <div className="p-2 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          <p className="text-sm text-gray-500 mt-1">Зареждане на класове...</p>
                        </div>
                      )}
                      
                      {!isLoading && classes.length === 0 && (
                        <div className="p-2 text-center">
                          <p className="text-sm text-red-500">Не са намерени класове за този учител</p>
                        </div>
                      )}
                      
                      <div className="grid gap-2">
                        <Label htmlFor="class">Клас</Label>
                        <Select
                          value={selectedClassId}
                          onValueChange={(value) => {
                            setState(prev => ({ ...prev, selectedClassId: value }));
                          }}
                          disabled={isLoading || classes.length === 0}
                        >
                          <SelectTrigger id="class">
                            <SelectValue placeholder="Изберете клас" />
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
                                Няма налични класове
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="subject">Предмет</Label>
                        <Select
                          value={selectedSubjectId}
                          onValueChange={(value) => setState(prev => ({ ...prev, selectedSubjectId: value }))}
                          disabled={isLoading || subjects.length === 0 || !selectedClassId}
                        >
                          <SelectTrigger id="subject">
                            <SelectValue placeholder="Изберете предмет" />
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
                    <CardTitle>Стъпка 2: Избор на дата и учебен час</CardTitle>
                    <CardDescription>Кога се е провел този час?</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label>Дата</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                              disabled={isLoading}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, 'PPP') : <span>Изберете дата</span>}
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
                        <Label htmlFor="period">Учебен час</Label>
                        <Select 
                          value={selectedPeriod.toString()} 
                          onValueChange={(value) => setState(prev => ({ ...prev, selectedPeriod: parseInt(value) }))}
                          disabled={isLoading}
                        >
                          <SelectTrigger id="period">
                            <SelectValue placeholder="Изберете час" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(period => (
                              <SelectItem key={period} value={period.toString()}>
                                Час {period}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-500" />
                          <span className="text-sm">
                            {students.length > 0 ? `${students.length} ученици заредени` : "Няма заредени ученици"}
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
                          Запиши присъствия
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
                    <CardTitle>Присъствия в класа</CardTitle>
                    <CardDescription>
                      {hasExistingAttendance 
                        ? `Преглед/обновяване на съществуващи записи за присъствия за ${classes.find(c => c.classId === selectedClassId)?.className || "избрания клас"}`
                        : `Отбележи присъствия за ${classes.find(c => c.classId === selectedClassId)?.className || "избрания клас"}`
                      }
                    </CardDescription>
                    {hasExistingAttendance && (
                      <div className="mt-2 text-sm bg-amber-50 text-amber-700 p-2 rounded-md border border-amber-200">
                        Този учебен час вече има записи за присъствия. Всички промени, които направите, ще обновят съществуващите записи.
                      </div>
                    )}
                    {classSessionExists === false && (
                      <div className="mt-2 text-sm bg-red-50 text-red-700 p-2 rounded-md border border-red-200">
                        Внимание: Този учебен час не е планиран според разписанието. Записването на присъствия е деактивирано.
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isCheckingExistingAttendance || isCheckingTimetable ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                        <p>Проверка на информацията за класа...</p>
                      </div>
                    ) : classSessionExists === false ? (
                      <div className="text-center py-8 border rounded-md bg-gray-50">
                        <div className="bg-red-50 p-4 rounded-md border border-red-100 max-w-md mx-auto">
                          <h3 className="text-lg font-medium text-red-800">Няма планиран час</h3>
                          <p className="text-sm text-red-600 mt-2">
                            Няма час по {subjects.find(s => s.subjectId === selectedSubjectId)?.name}, 
                            планиран за {classes.find(c => c.classId === selectedClassId)?.className} на {' '}
                            {['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'][selectedDate.getDay()]}, 
                            {selectedPeriod}-и час.
                          </p>
                          <p className="text-sm text-red-600 mt-2">
                            Моля, изберете друга дата, час или предмет, които съответстват на разписанието.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ученик</TableHead>
                            <TableHead>Статус</TableHead>
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
                                      Присъства
                                    </Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="absent" 
                                      id={`absent-${student.userId}`} 
                                      className="text-red-500 border-red-500"
                                    />
                                    <Label htmlFor={`absent-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Отсъства
                                    </Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="late" 
                                      id={`late-${student.userId}`} 
                                      className="text-yellow-500 border-yellow-500"
                                    />
                                    <Label htmlFor={`late-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Закъснява
                                    </Label>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <RadioGroupItem 
                                      value="excused" 
                                      id={`excused-${student.userId}`} 
                                      className="text-blue-500 border-blue-500"
                                    />
                                    <Label htmlFor={`excused-${student.userId}`} className="text-sm font-normal cursor-pointer">
                                      Извинен
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
                      {hasExistingAttendance ? 'Обнови записите за присъствия' : 'Запази записите за присъствия'}
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