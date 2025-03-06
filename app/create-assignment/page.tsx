"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createAssignment } from "@/lib/assignmentManagement";
import type { Subject, HomeroomClass } from "@/lib/interfaces";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/functional/Sidebar";
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";

export default function CreateAssignment() {
  const { user } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<
    { id: string; name: string }[]
  >([]);
  const [date, setDate] = useState<Date | undefined>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [loading, setLoading] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId) return;

      try {
        const subjectsCollection = collection(db, "schools", user.schoolId, "subjects");
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(
          (doc) => ({ ...doc.data(), subjectId: doc.id } as Subject)
        );
        setSubjects(subjectsData);

        const classesCollection = collection(db, "schools", user.schoolId, "classes");
        const classesSnapshot = await getDocs(classesCollection);
        const classesData = classesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), classId: doc.id } as HomeroomClass)
        );
        setClasses(classesData);

        const studentsCollection = collection(db, "schools", user.schoolId, "users");
        const studentsSnapshot = await getDocs(studentsCollection);
        const studentsData = studentsSnapshot.docs
          .filter(doc => doc.data().role === "student")
          .map(doc => ({
            id: doc.id,
            name: `${doc.data().firstName} ${doc.data().lastName}`
          }));
        setAllStudents(studentsData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load subjects and classes.",
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [user]);

  const handleClassSelect = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const handleStudentSelect = (student: { id: string; name: string }) => {
    setSelectedStudents((prev) =>
      prev.some((s) => s.id === student.id)
        ? prev.filter((s) => s.id !== student.id)
        : [...prev, student]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !user?.userId) return;
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the assignment.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedSubject) {
      toast({
        title: "Error",
        description: "Please select a subject for the assignment.",
        variant: "destructive",
      });
      return;
    }
    
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a due date for the assignment.",
        variant: "destructive",
      });
      return;
    }

    const tabsElement = document.querySelector('[role="tablist"]');
    const selectedTab = tabsElement?.querySelector('[aria-selected="true"]')?.getAttribute('data-value') || 'classes';
    
    if (selectedTab === 'classes' && selectedClasses.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one class.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTab === 'students' && selectedStudents.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one student.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const selectedSubjectData = subjects.find(sub => sub.subjectId === selectedSubject);
      
      const assignmentData = {
        title,
        description,
        teacherId: user.userId,
        teacherName: `${user.firstName} ${user.lastName}`,
        subjectId: selectedSubject,
        subjectName: selectedSubjectData?.name || "",
        dueDate: Timestamp.fromDate(date),
        classIds: selectedTab === 'classes' ? selectedClasses : [],
        studentIds: selectedTab === 'students' ? selectedStudents.map(student => student.id) : [],
        allowLateSubmission,
        allowResubmission,
      };

      console.log("Creating assignment with data:", JSON.stringify(assignmentData));
      await createAssignment(user.schoolId, assignmentData);
      
      toast({
        title: "Success",
        description: "Assignment created successfully.",
      });
      
      router.push("/assignments");
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: "Failed to create assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== "teacher") {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <Card>
            <CardContent className="pt-6">
              <p>Само учители могат да създават задачи.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">Създаване на задача</h1>
          
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-xl">Детайли на задачата</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-700">Заглавие на задачата</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Въведете заглавие на задачата"
                      className="border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700">Subject</Label>
                    <Select 
                      value={selectedSubject} 
                      onValueChange={setSelectedSubject}
                    >
                      <SelectTrigger className="border-gray-200">
                        <SelectValue placeholder="Изберете предмет" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem 
                            key={subject.subjectId} 
                            value={subject.subjectId}
                          >
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-700">Описание</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Въведете описание на задачата"
                    className="min-h-[150px] border-gray-200"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-gray-700">Краен срок</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="w-full justify-between text-left font-normal border-gray-200 text-foreground"
                      >
                        {date ? (
                          format(date, "PPP")
                        ) : (
                          <span>Изберете дата</span>
                        )}
                        <CalendarIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        value={date}
                        onChange={(value) => setDate(value as Date)}
                        minDate={new Date()}
                        className="w-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Възлагане на</h3>
                  <Tabs defaultValue="classes" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="classes" data-value="classes">Класове</TabsTrigger>
                      <TabsTrigger value="students" data-value="students">Конкретни ученици</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="classes" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-gray-700">Изберете класове</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between border-gray-200 text-foreground"
                            >
                              {selectedClasses.length > 0
                                ? `${selectedClasses.length} ${selectedClasses.length > 1 ? "класа" : "клас"} избрани`
                                : "Изберете класове"}
                              <ChevronsUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-full max-h-60" align="start">
                            <ScrollArea className="h-[200px]">
                              {classes.map((cls) => (
                                <DropdownMenuCheckboxItem
                                  key={cls.classId}
                                  checked={selectedClasses.includes(cls.classId)}
                                  onCheckedChange={() => handleClassSelect(cls.classId)}
                                >
                                  {cls.className}
                                  {selectedClasses.includes(cls.classId) && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </ScrollArea>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="students" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-gray-700">Изберете ученици</Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between border-gray-200 text-foreground"
                            >
                              {selectedStudents.length > 0
                                ? `${selectedStudents.length} ${selectedStudents.length > 1 ? "ученика" : "ученик"} избрани`
                                : "Изберете ученици"}
                              <ChevronsUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-full" align="start">
                            <ScrollArea className="h-[200px]">
                              {allStudents.map((student) => (
                                <DropdownMenuCheckboxItem
                                  key={student.id}
                                  checked={selectedStudents.some(s => s.id === student.id)}
                                  onCheckedChange={() => handleStudentSelect(student)}
                                >
                                  {student.name}
                                  {selectedStudents.some(s => s.id === student.id) && (
                                    <Check className="ml-auto h-4 w-4" />
                                  )}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </ScrollArea>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-md font-medium">Опции за предаване</h3>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="allowLateSubmission"
                      checked={allowLateSubmission}
                      onCheckedChange={(checked) => {
                        setAllowLateSubmission(checked === true);
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="allowLateSubmission"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Позволи закъснели предавания
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Учениците могат да предават след крайния срок
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="allowResubmission"
                      checked={allowResubmission}
                      onCheckedChange={(checked) => {
                        setAllowResubmission(checked === true);
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="allowResubmission"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Позволи повторно предаване
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Учениците могат да актуализират предаването си преди крайния срок
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button 
                  variant={"outline"}
                    type="submit" 
                    className="min-w-[120px] text-foreground"
                    disabled={loading}
                  >
                    {loading ? "Създаване..." : "Създай задача"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}