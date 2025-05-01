"use client";

import React from 'react';
import { BulgarianGradingScale, defaultGradingScale } from '@/lib/interfaces';
import { getGradeNameAndValue, getGradeColor } from '@/lib/gradingUtils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BulgarianGradeDisplayProps {
  percentage: number;
  gradingScale?: BulgarianGradingScale;
  showTooltip?: boolean;
  showBadge?: boolean;
  className?: string;
}

export default function BulgarianGradeDisplay({
  percentage,
  gradingScale = defaultGradingScale,
  showTooltip = true,
  showBadge = false,
  className = '',
}: BulgarianGradeDisplayProps) {
  const { name, value } = getGradeNameAndValue(percentage, gradingScale);
  const colorClass = getGradeColor(value);
  const formattedValue = value.toFixed(2).replace(/\.00$/, '');
  
  const content = (
    <span className={`${colorClass} ${className}`}>
      {showBadge ? (
        <Badge 
          variant="outline" 
          className={`font-medium ${colorClass} border-current bg-opacity-10 bg-current`}
        >
          {name} ({percentage}%)
        </Badge>
      ) : (
        <>{name} ({percentage}%)</>
      )}
    </span>
  );
  
  if (!showTooltip) return content;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p>Точна оценка: {formattedValue}</p>
            <p>Процент верни: {percentage}%</p>
            {gradingScale !== defaultGradingScale && (
              <p className="italic">Използва се персонализирана скала за оценяване</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}