"use client";

import React from 'react';
import { QuizResult, Quiz, BulgarianGradingScale, defaultGradingScale } from '@/lib/interfaces';
import BulgarianGradeDisplay from './BulgarianGradeDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTimeSpent } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, Clock, HelpCircle } from 'lucide-react';

interface QuizResultCardProps {
  result: QuizResult;
  quiz?: Quiz;
  showDetails?: boolean;
}

export default function QuizResultCard({ result, quiz, showDetails = true }: QuizResultCardProps) {
  // Calculate percentage score
  const percentage = Math.round((result.score / result.totalPoints) * 100);
  
  // Determine if we should use the quiz's custom grading scale or the default
  const gradingScale: BulgarianGradingScale = quiz?.gradingScale || defaultGradingScale;
  
  // Determine status badge color and icon
  const getBadgeDetails = () => {
    if (percentage >= 80) return { variant: 'success', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
    if (percentage >= 60) return { variant: 'default', icon: <CheckCircle className="h-4 w-4 mr-1" /> };
    if (percentage >= 40) return { variant: 'warning', icon: <AlertCircle className="h-4 w-4 mr-1" /> };
    return { variant: 'destructive', icon: <AlertCircle className="h-4 w-4 mr-1" /> };
  };
  
  const badge = getBadgeDetails();
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium">
            {quiz?.title || "Резултат от тест"}
          </CardTitle>
          <Badge variant={badge.variant as any} className="flex items-center">
            {badge.icon}
            {percentage}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-4">
          {/* Bulgarian grade display */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Оценка (Българска система):</span>
            <BulgarianGradeDisplay 
              percentage={percentage} 
              gradingScale={gradingScale}
              showBadge={true}
            />
          </div>
          
          {/* Score */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Резултат:</span>
              <span>{result.score} / {result.totalPoints} точки</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
          
          {showDetails && (
            <>
              {/* Time information */}
              {result.totalTimeSpent && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1 inline" /> Време за изпълнение:
                  </span>
                  <span>{formatTimeSpent(result.totalTimeSpent)}</span>
                </div>
              )}
              
              {/* Date taken */}
              {result.timestamp && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Дата и час:</span>
                  <span>{format(result.timestamp.toDate(), 'dd.MM.yyyy HH:mm')}</span>
                </div>
              )}
              
              {/* Security violations */}
              {result.securityViolations && result.securityViolations > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-500">Нарушения на сигурността:</span>
                  <Badge variant="outline" className="border-amber-500 text-amber-500">
                    {result.securityViolations}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}