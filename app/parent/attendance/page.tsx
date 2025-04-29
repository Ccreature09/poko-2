"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarIcon, 
  BookOpenText, 
  Clock, 
  AlertCircle,
  Users
} from 'lucide-react';
import Sidebar from '@/components/functional/Sidebar';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  doc,
  getDoc 
} from 'firebase/firestore';
import type { AttendanceRecord } from '@/lib/interfaces';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Helper function to determine status background color
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'present':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Present</Badge>;
    case 'absent':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Absent</Badge>;
    case 'late':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Late</Badge>;
    case 'excused':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Excused</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Group attendance records by date
const groupByDate = (records: AttendanceRecord[]) => {
  const grouped: { [key: string]: AttendanceRecord[] } = {};
  
  records.forEach(record => {
    const date = record.date.toDate().toDateString();
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(record);
  });
  
  return grouped;
};

// Group attendance records by subject
const groupBySubject = (records: AttendanceRecord[]) => {
  const grouped: { [key: string]: AttendanceRecord[] } = {};
  
  records.forEach(record => {
    const subject = record.subjectName || record.subjectId;
    if (!grouped[subject]) {
      grouped[subject] = [];
    }
    grouped[subject].push(record);
  });
  
  return grouped;
};

interface Child {
  id: string;
  name: string;
  classId?: string;
  className?: string;
}

export default function ParentAttendance() {
  const { user } = useUser();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [filterDays, setFilterDays] = useState(30); // Default to last 30 days
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  
  // Fetch parent's children
  useEffect(() => {
    if (!user || user.role !== 'parent') return;
    
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
        const childrenList: Child[] = [];
        
        // Fetch details for each child
        for (const childId of childrenIds) {
          const childDoc = await getDoc(doc(db, "schools", user.schoolId, "users", childId));
          if (childDoc.exists() && childDoc.data().role === 'student') {
            const childData = childDoc.data();
            
            // Get class name if available
            let className = "";
            if (childData.homeroomClassId) {
              const classDoc = await getDoc(doc(db, "schools", user.schoolId, "classes", childData.homeroomClassId));
              if (classDoc.exists()) {
                className = classDoc.data().name || "";
              }
            }
            
            childrenList.push({
              id: childId,
              name: `${childData.firstName} ${childData.lastName}`,
              classId: childData.homeroomClassId,
              className: className
            });
          }
        }
        
        setChildren(childrenList);
        if (childrenList.length > 0) {
          setSelectedChildId(childrenList[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch children:", error);
        setError("Failed to load children information.");
      }
    };
    
    fetchChildren();
  }, [user]);
  
  // Fetch attendance records for selected child
  useEffect(() => {
    if (!user || !selectedChildId) return;
    
    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Calculate date range based on filter
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filterDays);
        
        // Reference to the attendance collection
        const schoolRef = collection(db, 'schools', user.schoolId, 'attendance');
        
        // Query for the selected child's attendance records
        const attendanceQuery = query(
          schoolRef,
          where('studentId', '==', selectedChildId),
          where('date', '>=', Timestamp.fromDate(startDate)),
          orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(attendanceQuery);
        const records: AttendanceRecord[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          records.push({
            attendanceId: doc.id,
            studentId: data.studentId,
            studentName: data.studentName,
            teacherId: data.teacherId,
            teacherName: data.teacherName,
            classId: data.classId,
            className: data.className,
            subjectId: data.subjectId,
            subjectName: data.subjectName,
            date: data.date,
            periodNumber: data.periodNumber,
            status: data.status,
            justified: data.justified || false,
            createdAt: data.createdAt,
            notifiedParent: data.notifiedParent || false,
            updatedAt: data.updatedAt || data.createdAt,
          });
        });
        
        setAttendanceRecords(records);
      } catch (error) {
        console.error("Error fetching attendance records:", error);
        setError("Failed to load attendance records. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (selectedChildId) {
      fetchAttendance();
    }
  }, [user, selectedChildId, filterDays]);
  
  if (!user || user.role !== 'parent') {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">Access Denied</h3>
                <p className="text-gray-500 mt-2">
                  Only parents can access this page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Calculate attendance summary
  const totalRecords = attendanceRecords.length;
  const absentRecords = attendanceRecords.filter(r => r.status === 'absent');
  const lateRecords = attendanceRecords.filter(r => r.status === 'late');
  const excusedRecords = attendanceRecords.filter(r => r.status === 'excused');
  const presentRecords = attendanceRecords.filter(r => r.status === 'present');
  
  const absentRate = totalRecords > 0 ? (absentRecords.length / totalRecords) * 100 : 0;
  const lateRate = totalRecords > 0 ? (lateRecords.length / totalRecords) * 100 : 0;
  
  // Group records for different views
  const recordsByDate = groupByDate(attendanceRecords);
  const recordsBySubject = groupBySubject(attendanceRecords);
  
  const selectedChild = children.find(child => child.id === selectedChildId);
  
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">Child Attendance</h1>
          <p className="text-gray-600 mb-6">View and track your child's attendance records</p>
          
          {/* Child selector */}
          {children.length > 0 ? (
            <div className="mb-6">
              <label htmlFor="childSelect" className="block text-sm font-medium text-gray-700 mb-2">
                Select Child
              </label>
              <Select 
                value={selectedChildId || ''} 
                onValueChange={(value) => setSelectedChildId(value)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name} {child.className ? `(${child.className})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-700">No children found under your account.</p>
            </div>
          )}
          
          {/* Time filter buttons */}
          {selectedChildId && (
            <div className="mb-6 flex flex-wrap gap-2">
              <Button 
                variant={filterDays === 7 ? "default" : "outline"} 
                onClick={() => setFilterDays(7)}
                size="sm"
              >
                Last 7 days
              </Button>
              <Button 
                variant={filterDays === 30 ? "default" : "outline"} 
                onClick={() => setFilterDays(30)}
                size="sm"
              >
                Last 30 days
              </Button>
              <Button 
                variant={filterDays === 90 ? "default" : "outline"} 
                onClick={() => setFilterDays(90)}
                size="sm"
              >
                Last 3 months
              </Button>
              <Button 
                variant={filterDays === 180 ? "default" : "outline"} 
                onClick={() => setFilterDays(180)}
                size="sm"
              >
                Last 6 months
              </Button>
            </div>
          )}
          
          {!selectedChildId ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">Please Select a Child</h3>
              <p className="text-gray-500 mt-2">
                Select a child from the dropdown menu to view their attendance records.
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading attendance records...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">{error}</p>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800">No Attendance Records</h3>
              <p className="text-gray-500 mt-2">
                No attendance records found for {selectedChild?.name} in the selected time period.
              </p>
            </div>
          ) : (
            <>
              {/* Attendance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">Present</p>
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <CalendarIcon className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{presentRecords.length}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {totalRecords > 0 ? ((presentRecords.length / totalRecords) * 100).toFixed(1) : 0}% of total
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">Absent</p>
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{absentRecords.length}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {absentRate.toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">Late</p>
                      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-yellow-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{lateRecords.length}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {lateRate.toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">Excused</p>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <BookOpenText className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mt-2">{excusedRecords.length}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {totalRecords > 0 ? ((excusedRecords.length / totalRecords) * 100).toFixed(1) : 0}% of total
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Attendance Records Tabs */}
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle>Attendance Records for {selectedChild?.name}</CardTitle>
                  <CardDescription>Recent attendance history</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs 
                    value={activeTab} 
                    onValueChange={setActiveTab}
                    className="mb-4"
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">All Records</TabsTrigger>
                      <TabsTrigger value="by-date">By Date</TabsTrigger>
                      <TabsTrigger value="by-subject">By Subject</TabsTrigger>
                    </TabsList>
                    
                    {/* All Records Tab */}
                    <TabsContent value="all">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceRecords.length > 0 ? (
                            attendanceRecords.map((record) => (
                              <TableRow key={record.attendanceId}>
                                <TableCell>
                                  {format(record.date.toDate(), 'PPP')}
                                </TableCell>
                                <TableCell>{record.subjectName}</TableCell>
                                <TableCell>{record.periodNumber}</TableCell>
                                <TableCell>{getStatusBadge(record.status)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4">
                                No attendance records found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                    
                    {/* By Date Tab */}
                    <TabsContent value="by-date">
                      {Object.entries(recordsByDate).length > 0 ? (
                        Object.entries(recordsByDate)
                          .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                          .map(([date, records]) => (
                            <div key={date} className="mb-6">
                              <h3 className="text-md font-medium text-gray-700 mb-2">
                                {format(new Date(date), 'PPPP')}
                              </h3>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {records.map((record) => (
                                    <TableRow key={record.attendanceId}>
                                      <TableCell>{record.subjectName}</TableCell>
                                      <TableCell>{record.periodNumber}</TableCell>
                                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-500">No attendance records found</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* By Subject Tab */}
                    <TabsContent value="by-subject">
                      {Object.entries(recordsBySubject).length > 0 ? (
                        Object.entries(recordsBySubject)
                          .sort(([subjectA], [subjectB]) => subjectA.localeCompare(subjectB))
                          .map(([subject, records]) => (
                            <div key={subject} className="mb-6">
                              <h3 className="text-md font-medium text-gray-700 mb-2">
                                {subject}
                              </h3>
                              <div className="flex gap-4 mb-2">
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                  <span className="text-xs">
                                    Present: {records.filter(r => r.status === 'present').length}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                  <span className="text-xs">
                                    Absent: {records.filter(r => r.status === 'absent').length}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                  <span className="text-xs">
                                    Late: {records.filter(r => r.status === 'late').length}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                  <span className="text-xs">
                                    Excused: {records.filter(r => r.status === 'excused').length}
                                  </span>
                                </div>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {records
                                    .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
                                    .map((record) => (
                                      <TableRow key={record.attendanceId}>
                                        <TableCell>
                                          {format(record.date.toDate(), 'PPP')}
                                        </TableCell>
                                        <TableCell>{record.periodNumber}</TableCell>
                                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-gray-500">No attendance records found</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}