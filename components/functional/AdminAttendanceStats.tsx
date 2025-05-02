import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Timestamp } from 'firebase/firestore';
import { getSchoolAttendanceStats } from '@/lib/attendanceManagement';

interface AdminAttendanceStatsProps {
  schoolId: string;
}

const AdminAttendanceStats = ({ schoolId }: AdminAttendanceStatsProps) => {
  const [presentRate, setPresentRate] = useState(0);
  const [absentRate, setAbsentRate] = useState(0);
  const [tardyRate, setTardyRate] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      // last 30 days
      const end = Timestamp.now();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const start = Timestamp.fromDate(startDate);
      try {
        const stats = await getSchoolAttendanceStats(schoolId, start, end);
        const { absentCount, lateCount, presentCount, totalRecords: total } = stats;
        const totalCount = absentCount + lateCount + presentCount;
        setAbsentRate(totalCount > 0 ? (absentCount / totalCount) * 100 : 0);
        setTardyRate(totalCount > 0 ? (lateCount / totalCount) * 100 : 0);
        setPresentRate(totalCount > 0 ? (presentCount / totalCount) * 100 : 0);
        setTotalRecords(total);
      } catch (error) {
        console.error('Error fetching school attendance stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [schoolId]);

  if (loading) {
    return <p>Зареждане...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Присъствие</span>
          <span className="font-medium">{presentRate.toFixed(1)}%</span>
        </div>
        <Progress value={presentRate} className="h-2" />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Отсъствие</span>
          <span className="font-medium">{absentRate.toFixed(1)}%</span>
        </div>
        <Progress value={absentRate} className="h-2" />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Закъснение</span>
          <span className="font-medium">{tardyRate.toFixed(1)}%</span>
        </div>
        <Progress value={tardyRate} className="h-2" />
      </div>
      
      <div className="pt-2 text-sm text-muted-foreground">
        <p>Данни от последните {totalRecords} записа.</p>
      </div>
    </div>
  );
};

export default AdminAttendanceStats;