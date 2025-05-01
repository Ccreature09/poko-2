"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { BulgarianGradingScale, defaultGradingScale } from '@/lib/interfaces';
import { validateGradingScale } from '@/lib/gradingUtils';
import { AlertCircle, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface GradingScaleEditorProps {
  initialScale?: BulgarianGradingScale;
  onChange: (scale: BulgarianGradingScale) => void;
  onError?: (isValid: boolean) => void;
}

export default function GradingScaleEditor({
  initialScale = defaultGradingScale,
  onChange,
  onError
}: GradingScaleEditorProps) {
  const [useCustomScale, setUseCustomScale] = useState<boolean>(false);
  const [gradingScale, setGradingScale] = useState<BulgarianGradingScale>(initialScale);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize with provided scale if different from default
  useEffect(() => {
    if (initialScale !== defaultGradingScale) {
      setUseCustomScale(true);
      setGradingScale(initialScale);
    }
  }, [initialScale]);

  // Toggle between custom scale and default scale
  useEffect(() => {
    if (!useCustomScale) {
      setGradingScale(defaultGradingScale);
      onChange(defaultGradingScale);
      setIsValid(true);
      setErrors([]);
      if (onError) onError(true);
    } else if (isDirty) {
      validateScale();
    }
  }, [useCustomScale]);

  // Update parent component with changes
  useEffect(() => {
    if (isDirty && isValid && useCustomScale) {
      onChange(gradingScale);
    }
  }, [gradingScale, isValid, isDirty, useCustomScale]);

  const validateScale = () => {
    const validationErrors: string[] = [];

    // Check if all values are within range
    const allRanges = [
      { name: 'Слаб 2', min: gradingScale.poor.min, max: gradingScale.poor.max },
      { name: 'Среден 3', min: gradingScale.average.min, max: gradingScale.average.max },
      { name: 'Добър 4', min: gradingScale.good.min, max: gradingScale.good.max },
      { name: 'Мн. Добър 5', min: gradingScale.veryGood.min, max: gradingScale.veryGood.max },
      { name: 'Отличен 6', min: gradingScale.excellent.min, max: gradingScale.excellent.max }
    ];

    // Check for invalid ranges
    allRanges.forEach(range => {
      if (range.min < 0 || range.max > 100) {
        validationErrors.push(`${range.name}: Стойностите трябва да са между 0 и 100`);
      }
      if (range.min > range.max) {
        validationErrors.push(`${range.name}: Минималната стойност трябва да е по-малка от максималната`);
      }
    });

    // Check if ranges are consecutive
    if (gradingScale.poor.max + 1 !== gradingScale.average.min) {
      validationErrors.push('Диапазонът между Слаб 2 и Среден 3 трябва да е последователен');
    }
    if (gradingScale.average.max + 1 !== gradingScale.good.min) {
      validationErrors.push('Диапазонът между Среден 3 и Добър 4 трябва да е последователен');
    }
    if (gradingScale.good.max + 1 !== gradingScale.veryGood.min) {
      validationErrors.push('Диапазонът между Добър 4 и Мн. Добър 5 трябва да е последователен');
    }
    if (gradingScale.veryGood.max + 1 !== gradingScale.excellent.min) {
      validationErrors.push('Диапазонът между Мн. Добър 5 и Отличен 6 трябва да е последователен');
    }

    const valid = validationErrors.length === 0;
    setIsValid(valid);
    setErrors(validationErrors);
    if (onError) onError(valid);
    
    return valid;
  };

  const handleInputChange = (
    grade: 'poor' | 'average' | 'good' | 'veryGood' | 'excellent',
    field: 'min' | 'max',
    value: string
  ) => {
    const numValue = parseInt(value, 10);
    
    if (isNaN(numValue)) return;
    
    setGradingScale(prev => ({
      ...prev,
      [grade]: {
        ...prev[grade],
        [field]: numValue
      }
    }));
    
    setIsDirty(true);
    validateScale();
  };

  const resetToDefault = () => {
    setGradingScale(defaultGradingScale);
    setIsValid(true);
    setErrors([]);
    onChange(defaultGradingScale);
    setIsDirty(true);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Скала за оценяване (Българска система)</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="use-custom" className="cursor-pointer text-sm text-gray-600">
              Персонализирана скала
            </Label>
            <Switch
              id="use-custom"
              checked={useCustomScale}
              onCheckedChange={setUseCustomScale}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium">Българска система за оценяване</h4>
                  <p className="text-sm text-muted-foreground">
                    Персонализирайте диапазоните на процентите за всяка оценка:
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                    <li>Слаб 2: 0-49% (по подразбиране)</li>
                    <li>Среден 3: 50-62% (по подразбиране)</li>
                    <li>Добър 4: 63-74% (по подразбиране)</li>
                    <li>Мн. Добър 5: 75-87% (по подразбиране)</li>
                    <li>Отличен 6: 88-100% (по подразбиране)</li>
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <CardDescription>
          Задайте процентните диапазони за всяка оценка по Българската система за оценяване.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {useCustomScale ? (
          <div className="space-y-6">
            {/* Error display */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 space-y-1">
                <div className="flex items-center font-medium mb-1">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Грешки във въведените стойности:
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Poor (2) Range */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label 
                  htmlFor="poor-range"
                  className="font-medium text-red-600"
                >
                  Слаб 2
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="poor-min"
                    className="w-16 text-center"
                    value={gradingScale.poor.min}
                    onChange={(e) => handleInputChange('poor', 'min', e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    id="poor-max"
                    className="w-16 text-center"
                    value={gradingScale.poor.max}
                    onChange={(e) => handleInputChange('poor', 'max', e.target.value)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            
            {/* Average (3) Range */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label 
                  htmlFor="average-range"
                  className="font-medium text-amber-600"
                >
                  Среден 3
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="average-min"
                    className="w-16 text-center"
                    value={gradingScale.average.min}
                    onChange={(e) => handleInputChange('average', 'min', e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    id="average-max"
                    className="w-16 text-center"
                    value={gradingScale.average.max}
                    onChange={(e) => handleInputChange('average', 'max', e.target.value)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            
            {/* Good (4) Range */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label 
                  htmlFor="good-range"
                  className="font-medium text-indigo-600"
                >
                  Добър 4
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="good-min"
                    className="w-16 text-center"
                    value={gradingScale.good.min}
                    onChange={(e) => handleInputChange('good', 'min', e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    id="good-max"
                    className="w-16 text-center"
                    value={gradingScale.good.max}
                    onChange={(e) => handleInputChange('good', 'max', e.target.value)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            
            {/* Very Good (5) Range */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label 
                  htmlFor="veryGood-range"
                  className="font-medium text-blue-600"
                >
                  Мн. Добър 5
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="veryGood-min"
                    className="w-16 text-center"
                    value={gradingScale.veryGood.min}
                    onChange={(e) => handleInputChange('veryGood', 'min', e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    id="veryGood-max"
                    className="w-16 text-center"
                    value={gradingScale.veryGood.max}
                    onChange={(e) => handleInputChange('veryGood', 'max', e.target.value)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            
            {/* Excellent (6) Range */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label 
                  htmlFor="excellent-range"
                  className="font-medium text-green-600"
                >
                  Отличен 6
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="excellent-min"
                    className="w-16 text-center"
                    value={gradingScale.excellent.min}
                    onChange={(e) => handleInputChange('excellent', 'min', e.target.value)}
                  />
                  <span>-</span>
                  <Input
                    id="excellent-max"
                    className="w-16 text-center"
                    value={gradingScale.excellent.max}
                    onChange={(e) => handleInputChange('excellent', 'max', e.target.value)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={resetToDefault}
              className="mt-4"
            >
              Възстанови стойности по подразбиране
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-500 py-4 border-y">
              Използва се стандартната скала за оценяване.
              <div className="grid grid-cols-5 gap-2 mt-4 font-medium text-center">
                <div className="text-red-600">Слаб 2<br/>(0-49%)</div>
                <div className="text-amber-600">Среден 3<br/>(50-62%)</div>
                <div className="text-indigo-600">Добър 4<br/>(63-74%)</div>
                <div className="text-blue-600">Мн. Добър 5<br/>(75-87%)</div>
                <div className="text-green-600">Отличен 6<br/>(88-100%)</div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Включете опцията "Персонализирана скала", за да промените процентните диапазони за всяка оценка.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}