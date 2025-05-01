/**
 * Utility functions for grading calculations using the Bulgarian grading system
 */

import { BulgarianGradingScale, defaultGradingScale } from './interfaces';

/**
 * Validates a grading scale to ensure it has valid ranges
 * @param scale The grading scale to validate
 * @returns True if the scale is valid, false otherwise 
 */
export const validateGradingScale = (scale: BulgarianGradingScale): boolean => {
  // Check if all ranges are within 0-100%
  const ranges = [
    { min: scale.poor.min, max: scale.poor.max },
    { min: scale.average.min, max: scale.average.max },
    { min: scale.good.min, max: scale.good.max },
    { min: scale.veryGood.min, max: scale.veryGood.max },
    { min: scale.excellent.min, max: scale.excellent.max }
  ];

  // Check that all ranges are valid
  for (const range of ranges) {
    if (range.min < 0 || range.max > 100 || range.min > range.max) {
      return false;
    }
  }

  // Check that ranges are consecutive
  if (scale.poor.max + 1 !== scale.average.min) return false;
  if (scale.average.max + 1 !== scale.good.min) return false;
  if (scale.good.max + 1 !== scale.veryGood.min) return false;
  if (scale.veryGood.max + 1 !== scale.excellent.min) return false;

  return true;
};

/**
 * Calculates a Bulgarian grade (2-6) from a percentage score
 * @param percentage Percentage score (0-100)
 * @param scale The Bulgarian grading scale to use
 * @returns The Bulgarian grade as a number 
 */
export const calculateGrade = (percentage: number, scale: BulgarianGradingScale = defaultGradingScale): number => {
  if (percentage <= scale.poor.max) {
    // Poor (2) - Linear interpolation between 2.00 and 2.99
    return 2 + (percentage - scale.poor.min) / (scale.poor.max - scale.poor.min) * 0.99;
  } else if (percentage <= scale.average.max) {
    // Average (3) - Linear interpolation between 3.00 and 3.99
    return 3 + (percentage - scale.average.min) / (scale.average.max - scale.average.min) * 0.99;
  } else if (percentage <= scale.good.max) {
    // Good (4) - Linear interpolation between 4.00 and 4.99
    return 4 + (percentage - scale.good.min) / (scale.good.max - scale.good.min) * 0.99;
  } else if (percentage <= scale.veryGood.max) {
    // Very Good (5) - Linear interpolation between 5.00 and 5.99
    return 5 + (percentage - scale.veryGood.min) / (scale.veryGood.max - scale.veryGood.min) * 0.99;
  } else {
    // Excellent (6) - Linear interpolation between 6.00 and 6.00
    return 6;
  }
};

/**
 * Gets the name and value of a Bulgarian grade from a percentage score
 * @param percentage Percentage score (0-100)
 * @param scale The Bulgarian grading scale to use
 * @returns Object with grade name and numeric value 
 */
export const getGradeNameAndValue = (percentage: number, scale: BulgarianGradingScale = defaultGradingScale) => {
  const gradeValue = calculateGrade(percentage, scale);
  
  if (gradeValue < 3) {
    return {
      name: 'Слаб 2',
      value: gradeValue
    };
  } else if (gradeValue < 4) {
    return {
      name: 'Среден 3',
      value: gradeValue
    };
  } else if (gradeValue < 5) {
    return {
      name: 'Добър 4',
      value: gradeValue
    };
  } else if (gradeValue < 6) {
    return {
      name: 'Мн. Добър 5',
      value: gradeValue
    };
  } else {
    return {
      name: 'Отличен 6',
      value: gradeValue
    };
  }
};

/**
 * Gets a CSS color class based on the Bulgarian grade
 * @param grade The Bulgarian grade (2-6)
 * @returns CSS color class for the grade 
 */
export const getGradeColor = (grade: number): string => {
  if (grade < 3) return 'text-red-600';
  if (grade < 4) return 'text-amber-600';
  if (grade < 5) return 'text-indigo-600';
  if (grade < 6) return 'text-blue-600';
  return 'text-green-600';
};