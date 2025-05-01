"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/functional/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";
import { Building, Calendar, GraduationCap, Phone, Mail, MapPin, Clock, Edit, Save, Pencil } from "lucide-react";

export default function SchoolSettings() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolData, setSchoolData] = useState({
    name: "",
    type: "public",
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    description: "",
    principal: "",
    logo: "",
    established: "",
    academicYear: {
      startDate: "",
      endDate: "",
      currentTerm: "1",
    },
    schedule: {
      startsAt: "08:00",
      periodDuration: 40,
      breakDuration: 10,
      periodsPerDay: 7,
    },
    gradingSystem: {
      scale: "2-6",
      passingGrade: 3,
      useLetters: false,
    },
    features: {
      enableAttendance: true,
      enableGradeBook: true,
      enableAssignments: true,
      enableQuizzes: true,
      enableParentPortal: true,
      enableMessaging: true,
    },
    classSettings: {
      namingFormat: "graded"
    }
  });

  useEffect(() => {
    if (user?.schoolId) {
      fetchSchoolData();
    }
  }, [user]);

  const fetchSchoolData = async () => {
    if (!user?.schoolId) return;
    
    setLoading(true);
    try {
      const schoolDoc = await getDoc(doc(db, "schools", user.schoolId));
      
      if (schoolDoc.exists()) {
        const data = schoolDoc.data();
        setSchoolData({
          ...schoolData,
          ...data,
          academicYear: {
            ...schoolData.academicYear,
            ...(data.academicYear || {})
          },
          schedule: {
            ...schoolData.schedule,
            ...(data.schedule || {})
          },
          gradingSystem: {
            ...schoolData.gradingSystem,
            ...(data.gradingSystem || {})
          },
          features: {
            ...schoolData.features,
            ...(data.features || {})
          }
        });
      }
    } catch (error) {
      console.error("Error fetching school data:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при зареждането на данните за училището.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (section: string) => {
    if (!user?.schoolId) return;
    
    setSaving(true);
    try {
      const schoolRef = doc(db, "schools", user.schoolId);
      
      // Update only the specific section
      let updateData = {};
      
      switch (section) {
        case "general":
          updateData = {
            name: schoolData.name,
            type: schoolData.type,
            address: schoolData.address,
            city: schoolData.city,
            postalCode: schoolData.postalCode,
            phone: schoolData.phone,
            email: schoolData.email,
            website: schoolData.website,
            description: schoolData.description,
            principal: schoolData.principal,
            established: schoolData.established,
          };
          break;
        case "academicYear":
          updateData = { academicYear: schoolData.academicYear };
          break;
        case "schedule":
          updateData = { schedule: schoolData.schedule };
          break;
        case "gradingSystem":
          updateData = { gradingSystem: schoolData.gradingSystem };
          break;
        case "features":
          updateData = { features: schoolData.features };
          break;
        case "classSettings":
          updateData = { 
            classSettings: {
              namingFormat: schoolData.classSettings?.namingFormat || "graded"
            } 
          };
          break;
        default:
          // Save all if no specific section
          updateData = schoolData;
      }
      
      await updateDoc(schoolRef, updateData);
      
      toast({
        title: "Запазено",
        description: "Промените са запазени успешно.",
      });
    } catch (error) {
      console.error("Error saving school data:", error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при запазването на промените.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Define a type for the school data to help with type checking
  type SchoolDataKey = keyof typeof schoolData;
  
  const handleInputChange = (field: string, value: any) => {
    // For nested fields, parse the dot notation
    if (field.includes('.')) {
      const [section, key] = field.split('.') as [keyof typeof schoolData, string];
      
      // Make sure we're dealing with an object before spreading
      const sectionData = schoolData[section];
      if (typeof sectionData === 'object' && sectionData !== null) {
        setSchoolData({
          ...schoolData,
          [section]: {
            ...sectionData,
            [key]: value
          }
        });
      }
    } else {
      setSchoolData({
        ...schoolData,
        [field]: value
      });
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Достъпът е отказан</CardTitle>
            <CardDescription>Нямате достатъчно права за достъп до тази страница.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Тази страница е достъпна само за администратори на системата.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar className="hidden lg:block" />
      <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto pb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800">Настройки на училището</h1>
              <p className="text-gray-600">Управление на основните настройки и параметри на училището</p>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-5 mb-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden md:inline">Основни</span>
              </TabsTrigger>
              <TabsTrigger value="academic" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden md:inline">Учебна година</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden md:inline">Разписание</span>
              </TabsTrigger>
              <TabsTrigger value="grading" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden md:inline">Оценяване</span>
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                <span className="hidden md:inline">Функционалности</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <>
                  <TabsContent value="general">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Основна информация</h2>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="school-name">Име на училището</Label>
                          <Input 
                            id="school-name" 
                            value={schoolData.name} 
                            onChange={(e) => handleInputChange('name', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-type">Тип на училището</Label>
                          <Select 
                            value={schoolData.type}
                            onValueChange={(value) => handleInputChange('type', value)}
                          >
                            <SelectTrigger id="school-type">
                              <SelectValue placeholder="Изберете тип" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">Държавно училище</SelectItem>
                              <SelectItem value="private">Частно училище</SelectItem>
                              <SelectItem value="language">Езиково училище</SelectItem>
                              <SelectItem value="professional">Професионална гимназия</SelectItem>
                              <SelectItem value="specialized">Специализирано училище</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-address">Адрес</Label>
                          <Input 
                            id="school-address" 
                            value={schoolData.address} 
                            onChange={(e) => handleInputChange('address', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-city">Град</Label>
                          <Input 
                            id="school-city" 
                            value={schoolData.city} 
                            onChange={(e) => handleInputChange('city', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-postal">Пощенски код</Label>
                          <Input 
                            id="school-postal" 
                            value={schoolData.postalCode} 
                            onChange={(e) => handleInputChange('postalCode', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-phone">Телефон</Label>
                          <Input 
                            id="school-phone" 
                            value={schoolData.phone} 
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-email">Имейл</Label>
                          <Input 
                            id="school-email" 
                            type="email"
                            value={schoolData.email} 
                            onChange={(e) => handleInputChange('email', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-website">Уебсайт</Label>
                          <Input 
                            id="school-website" 
                            value={schoolData.website} 
                            onChange={(e) => handleInputChange('website', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-principal">Директор</Label>
                          <Input 
                            id="school-principal" 
                            value={schoolData.principal} 
                            onChange={(e) => handleInputChange('principal', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="school-established">Година на основаване</Label>
                          <Input 
                            id="school-established" 
                            value={schoolData.established} 
                            onChange={(e) => handleInputChange('established', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-6 space-y-2">
                        <Label htmlFor="school-description">Описание на училището</Label>
                        <Textarea 
                          id="school-description" 
                          rows={4}
                          value={schoolData.description} 
                          onChange={(e) => handleInputChange('description', e.target.value)}
                        />
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button 
                          onClick={() => handleSave('general')}
                          disabled={saving}
                          className="flex items-center gap-2"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Запазване на промените
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="academic">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Учебна година</h2>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="academic-start">Начало на учебната година</Label>
                          <Input 
                            id="academic-start" 
                            type="date"
                            value={schoolData.academicYear.startDate}
                            onChange={(e) => handleInputChange('academicYear.startDate', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="academic-end">Край на учебната година</Label>
                          <Input 
                            id="academic-end" 
                            type="date"
                            value={schoolData.academicYear.endDate}
                            onChange={(e) => handleInputChange('academicYear.endDate', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="current-term">Текущ срок</Label>
                          <Select 
                            value={schoolData.academicYear.currentTerm}
                            onValueChange={(value) => handleInputChange('academicYear.currentTerm', value)}
                          >
                            <SelectTrigger id="current-term">
                              <SelectValue placeholder="Изберете срок" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Първи срок</SelectItem>
                              <SelectItem value="2">Втори срок</SelectItem>
                              <SelectItem value="summer">Лятна ваканция</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button 
                          onClick={() => handleSave('academicYear')}
                          disabled={saving}
                          className="flex items-center gap-2"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Запазване на промените
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="schedule">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Настройки на учебния ден</h2>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="schedule-start">Начало на учебния ден</Label>
                          <Input 
                            id="schedule-start" 
                            type="time"
                            value={schoolData.schedule.startsAt}
                            onChange={(e) => handleInputChange('schedule.startsAt', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="period-duration">Продължителност на час (минути)</Label>
                          <Input 
                            id="period-duration" 
                            type="number"
                            min="30"
                            max="90"
                            value={schoolData.schedule.periodDuration}
                            onChange={(e) => handleInputChange('schedule.periodDuration', parseInt(e.target.value))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="break-duration">Продължителност на междучасие (минути)</Label>
                          <Input 
                            id="break-duration" 
                            type="number"
                            min="5"
                            max="30"
                            value={schoolData.schedule.breakDuration}
                            onChange={(e) => handleInputChange('schedule.breakDuration', parseInt(e.target.value))}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="periods-per-day">Брой часове на ден</Label>
                          <Input 
                            id="periods-per-day" 
                            type="number"
                            min="4"
                            max="12"
                            value={schoolData.schedule.periodsPerDay}
                            onChange={(e) => handleInputChange('schedule.periodsPerDay', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <h3 className="text-lg font-medium mb-4">Изчислено разписание на часовете</h3>
                        <div className="border rounded-md overflow-hidden">
                          <table className="min-w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">№</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Начало</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Край</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {Array.from({ length: schoolData.schedule.periodsPerDay }).map((_, index) => {
                                const startHour = schoolData.schedule.startsAt || "08:00";
                                const [startHours, startMinutes] = startHour.split(":").map(Number);
                                
                                const periodStartMinutes = startHours * 60 + startMinutes + 
                                  index * (schoolData.schedule.periodDuration + schoolData.schedule.breakDuration);
                                
                                const periodEndMinutes = periodStartMinutes + schoolData.schedule.periodDuration;
                                
                                const formatTime = (minutes: number) => {
                                  const hours = Math.floor(minutes / 60);
                                  const mins = minutes % 60;
                                  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                                };
                                
                                return (
                                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{index + 1}</td>
                                    <td className="py-3 px-4 text-sm text-gray-500">{formatTime(periodStartMinutes)}</td>
                                    <td className="py-3 px-4 text-sm text-gray-500">{formatTime(periodEndMinutes)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button 
                          onClick={() => handleSave('schedule')}
                          disabled={saving}
                          className="flex items-center gap-2"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Запазване на промените
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="grading">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Система за оценяване</h2>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <Label>Скала за оценяване</Label>
                          <RadioGroup 
                            value={schoolData.gradingSystem.scale}
                            onValueChange={(value) => handleInputChange('gradingSystem.scale', value)}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="2-6" id="scale-bg" />
                              <Label htmlFor="scale-bg" className="font-normal">Българска (2-6)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="0-100" id="scale-percent" />
                              <Label htmlFor="scale-percent" className="font-normal">Процентна (0-100)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="A-F" id="scale-letter" />
                              <Label htmlFor="scale-letter" className="font-normal">Буквена (A-F)</Label>
                            </div>
                          </RadioGroup>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="passing-grade">Минимална оценка за успешно преминаване</Label>
                          <Input 
                            id="passing-grade" 
                            type="number"
                            step="0.1"
                            min="2"
                            max="6"
                            value={schoolData.gradingSystem.passingGrade}
                            onChange={(e) => handleInputChange('gradingSystem.passingGrade', parseFloat(e.target.value))}
                            className="max-w-[200px]"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch 
                            id="use-letters"
                            checked={schoolData.gradingSystem.useLetters} 
                            onCheckedChange={(checked) => handleInputChange('gradingSystem.useLetters', checked)}
                          />
                          <Label htmlFor="use-letters" className="font-normal">Показване на буквени обозначения (Отличен, Мн. добър, и т.н.)</Label>
                        </div>
                        
                        <div className="mt-4">
                          <h3 className="text-lg font-medium mb-3">Интервали за оценяване</h3>
                          <p className="text-sm text-gray-500 mb-4">
                            Визуализация на скалата за оценяване, която се използва в системата.
                          </p>
                          
                          {schoolData.gradingSystem.scale === '2-6' && (
                            <div className="grid grid-cols-5 gap-3">
                              <div className="p-3 rounded bg-red-100 text-center">
                                <div className="text-lg font-semibold text-red-700">2.00</div>
                                <div className="text-xs text-red-700">Слаб</div>
                              </div>
                              <div className="p-3 rounded bg-orange-100 text-center">
                                <div className="text-lg font-semibold text-orange-700">3.00-3.49</div>
                                <div className="text-xs text-orange-700">Среден</div>
                              </div>
                              <div className="p-3 rounded bg-yellow-100 text-center">
                                <div className="text-lg font-semibold text-yellow-700">3.50-4.49</div>
                                <div className="text-xs text-yellow-700">Добър</div>
                              </div>
                              <div className="p-3 rounded bg-blue-100 text-center">
                                <div className="text-lg font-semibold text-blue-700">4.50-5.49</div>
                                <div className="text-xs text-blue-700">Мн. добър</div>
                              </div>
                              <div className="p-3 rounded bg-green-100 text-center">
                                <div className="text-lg font-semibold text-green-700">5.50-6.00</div>
                                <div className="text-xs text-green-700">Отличен</div>
                              </div>
                            </div>
                          )}
                          
                          {schoolData.gradingSystem.scale === '0-100' && (
                            <div className="grid grid-cols-5 gap-3">
                              <div className="p-3 rounded bg-red-100 text-center">
                                <div className="text-lg font-semibold text-red-700">0-49%</div>
                                <div className="text-xs text-red-700">Слаб</div>
                              </div>
                              <div className="p-3 rounded bg-orange-100 text-center">
                                <div className="text-lg font-semibold text-orange-700">50-59%</div>
                                <div className="text-xs text-orange-700">Среден</div>
                              </div>
                              <div className="p-3 rounded bg-yellow-100 text-center">
                                <div className="text-lg font-semibold text-yellow-700">60-74%</div>
                                <div className="text-xs text-yellow-700">Добър</div>
                              </div>
                              <div className="p-3 rounded bg-blue-100 text-center">
                                <div className="text-lg font-semibold text-blue-700">75-89%</div>
                                <div className="text-xs text-blue-700">Мн. добър</div>
                              </div>
                              <div className="p-3 rounded bg-green-100 text-center">
                                <div className="text-lg font-semibold text-green-700">90-100%</div>
                                <div className="text-xs text-green-700">Отличен</div>
                              </div>
                            </div>
                          )}
                          
                          {schoolData.gradingSystem.scale === 'A-F' && (
                            <div className="grid grid-cols-6 gap-3">
                              <div className="p-3 rounded bg-green-100 text-center">
                                <div className="text-lg font-semibold text-green-700">A</div>
                                <div className="text-xs text-green-700">Отличен</div>
                              </div>
                              <div className="p-3 rounded bg-blue-100 text-center">
                                <div className="text-lg font-semibold text-blue-700">B</div>
                                <div className="text-xs text-blue-700">Мн. добър</div>
                              </div>
                              <div className="p-3 rounded bg-yellow-100 text-center">
                                <div className="text-lg font-semibold text-yellow-700">C</div>
                                <div className="text-xs text-yellow-700">Добър</div>
                              </div>
                              <div className="p-3 rounded bg-orange-100 text-center">
                                <div className="text-lg font-semibold text-orange-700">D</div>
                                <div className="text-xs text-orange-700">Среден</div>
                              </div>
                              <div className="p-3 rounded bg-red-50 text-center">
                                <div className="text-lg font-semibold text-red-600">E</div>
                                <div className="text-xs text-red-600">Слаб</div>
                              </div>
                              <div className="p-3 rounded bg-red-100 text-center">
                                <div className="text-lg font-semibold text-red-700">F</div>
                                <div className="text-xs text-red-700">Много слаб</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button 
                          onClick={() => handleSave('gradingSystem')}
                          disabled={saving}
                          className="flex items-center gap-2"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Запазване на промените
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="features">
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Управление на функционалности</h2>
                      <p className="text-gray-500 mb-6">
                        Включете или изключете функционалности на системата според нуждите на вашето училище.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">Отбелязване на присъствие</h3>
                            <p className="text-sm text-gray-500">Позволява на учителите да отбелязват присъствие на учениците</p>
                          </div>
                          <Switch 
                            id="enable-attendance"
                            checked={schoolData.features.enableAttendance} 
                            onCheckedChange={(checked) => handleInputChange('features.enableAttendance', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">Електронен дневник</h3>
                            <p className="text-sm text-gray-500">Позволява на учителите да въвеждат оценки</p>
                          </div>
                          <Switch 
                            id="enable-gradebook"
                            checked={schoolData.features.enableGradeBook} 
                            onCheckedChange={(checked) => handleInputChange('features.enableGradeBook', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">Задания</h3>
                            <p className="text-sm text-gray-500">Позволява създаване и управление на задания за учениците</p>
                          </div>
                          <Switch 
                            id="enable-assignments"
                            checked={schoolData.features.enableAssignments} 
                            onCheckedChange={(checked) => handleInputChange('features.enableAssignments', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">Тестове и изпити</h3>
                            <p className="text-sm text-gray-500">Позволява създаване и оценяване на онлайн тестове</p>
                          </div>
                          <Switch 
                            id="enable-quizzes"
                            checked={schoolData.features.enableQuizzes} 
                            onCheckedChange={(checked) => handleInputChange('features.enableQuizzes', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">Родителски портал</h3>
                            <p className="text-sm text-gray-500">Позволява на родителите да следят напредъка на децата си</p>
                          </div>
                          <Switch 
                            id="enable-parent-portal"
                            checked={schoolData.features.enableParentPortal} 
                            onCheckedChange={(checked) => handleInputChange('features.enableParentPortal', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-medium">Съобщения</h3>
                            <p className="text-sm text-gray-500">Позволява комуникация между учители, ученици и родители</p>
                          </div>
                          <Switch 
                            id="enable-messaging"
                            checked={schoolData.features.enableMessaging} 
                            onCheckedChange={(checked) => handleInputChange('features.enableMessaging', checked)}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <Button 
                          onClick={() => handleSave('features')}
                          disabled={saving}
                          className="flex items-center gap-2"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Запазване на промените
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}