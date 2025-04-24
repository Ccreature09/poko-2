import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { getSchoolAttendanceStats } from '@/lib/attendanceManagement';
import { Timestamp } from 'firebase/firestore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type AdminAttendanceStatsProps = {
  schoolId: string;
};

const AdminAttendanceStats: React.FC<AdminAttendanceStatsProps> = ({ schoolId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'term'>('week');
  const [activeTab, setActiveTab] = useState('overview');
  
  const [attendanceStats, setAttendanceStats] = useState<{
    totalStudents: number;
    totalRecords: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    presentCount: number;
    absenceRate: number;
    tardyRate: number;
    byClass: Record<string, {
      totalStudents: number;
      absentCount: number;
      lateCount: number;
      absenceRate: number;
    }>
  } | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    
    const fetchAttendanceStats = async () => {
      try {
        setLoading(true);
        
        // Calculate date range based on selected time range
        const now = new Date();
        let startDate: Date;
        
        switch (timeRange) {
          case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'term':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 4);
            break;
          default:
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        }
        
        const stats = await getSchoolAttendanceStats(
          schoolId,
          Timestamp.fromDate(startDate),
          Timestamp.fromDate(now)
        );
        
        setAttendanceStats(stats);
        setError(null);
      } catch (err) {
        console.error('Error fetching attendance stats:', err);
        setError('Failed to load attendance statistics');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAttendanceStats();
  }, [schoolId, timeRange]);

  const formatAttendanceData = () => {
    if (!attendanceStats) return [];
    
    return [
      { name: 'Present', value: attendanceStats.presentCount, fill: '#4ade80' },
      { name: 'Absent', value: attendanceStats.absentCount, fill: '#f87171' },
      { name: 'Late', value: attendanceStats.lateCount, fill: '#facc15' },
      { name: 'Excused', value: attendanceStats.excusedCount, fill: '#60a5fa' }
    ];
  };

  const formatClassData = () => {
    if (!attendanceStats) return [];
    
    return Object.entries(attendanceStats.byClass).map(([classId, data]) => ({
      name: classId,
      absenceRate: parseFloat(data.absenceRate.toFixed(1)),
      lateRate: parseFloat(((data.lateCount / (data.totalStudents || 1)) * 100).toFixed(1))
    }));
  };

  const COLORS = ['#4ade80', '#f87171', '#facc15', '#60a5fa'];

  if (loading) {
    return (
      <Card className="col-span-2">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-2" />
            <p className="text-red-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Attendance Statistics</CardTitle>
            <CardDescription>Track attendance patterns across the school</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={(value: 'week' | 'month' | 'term') => setTimeRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="term">Last term</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-6">
        {attendanceStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <Users className="h-8 w-8 text-blue-500 mb-2" />
                  <p className="text-sm text-gray-500">Total Students</p>
                  <p className="text-2xl font-bold">{attendanceStats.totalStudents}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <Clock className="h-8 w-8 text-red-500 mb-2" />
                  <p className="text-sm text-gray-500">Absence Rate</p>
                  <p className="text-2xl font-bold">{attendanceStats.absenceRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <Calendar className="h-8 w-8 text-yellow-500 mb-2" />
                  <p className="text-sm text-gray-500">Tardy Rate</p>
                  <p className="text-2xl font-bold">{attendanceStats.tardyRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="h-8 w-8 text-green-500 mb-2" />
                  <p className="text-sm text-gray-500">Present Rate</p>
                  <p className="text-2xl font-bold">
                    {(100 - attendanceStats.absenceRate - attendanceStats.tardyRate).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="byClass">By Class</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatAttendanceData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {formatAttendanceData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="byClass">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={formatClassData()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="absenceRate" name="Absence Rate %" fill="#f87171" />
                      <Bar dataKey="lateRate" name="Late Rate %" fill="#facc15" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAttendanceStats;