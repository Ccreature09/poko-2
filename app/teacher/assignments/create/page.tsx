"use client";

/**
 * Teacher Assignment Creation Page
 *
 * Comprehensive interface for creating educational assignments.
 * This page provides:
 *
 * Key features:
 * - Intuitive assignment creation with detailed configuration options
 * - Flexible assignment targeting to classes or individual students
 * - Due date scheduling with calendar integration
 * - Submission policy configuration (late submissions, resubmissions)
 * - Subject categorization and organization
 * - Rich text description formatting for clear assignment instructions
 *
 * Data flow:
 * - Retrieves available classes and subjects from database
 * - Fetches student records for individual assignment targeting
 * - Validates form inputs for completeness and correctness
 * - Creates assignment record with complete configuration
 * - Assigns to appropriate students based on selection criteria
 *
 * This interface enables teachers to efficiently create structured assignments
 * with comprehensive configuration options, supporting both class-wide and
 * individualized assignment distribution.
 */

// Импорт на необходимите React хуукове и контекст за управление на потребителския интерфейс
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useAssignments } from "@/contexts/AssignmentContext";
import { useRouter } from "next/navigation";

// Импорт на Firebase компоненти за работа с базата данни
import { Timestamp } from "firebase/firestore";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Subject, HomeroomClass } from "@/lib/interfaces";

// Импорт на UI компоненти за потребителския интерфейс
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
import Sidebar from "@/components/functional/layout/Sidebar";
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export default function CreateAssignment() {
  // Извличане на информация за потребителя и инициализиране на маршрутизатор
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { createNewAssignment } = useAssignments();

  // Деклариране на state променливи за формуляра за създаване на задача
  const [title, setTitle] = useState(""); // Заглавие на задачата
  const [description, setDescription] = useState(""); // Описание на задачата
  const [selectedSubject, setSelectedSubject] = useState(""); // Избран предмет
  const [subjects, setSubjects] = useState<Subject[]>([]); // Списък с предмети
  const [classes, setClasses] = useState<HomeroomClass[]>([]); // Списък с класове
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]); // Избрани класове
  const [selectedClassForStudents, setSelectedClassForStudents] =
    useState<string>(""); // Избран клас за ученици
  const [selectedStudents, setSelectedStudents] = useState<
    { id: string; name: string }[]
  >([]); // Избрани ученици

  // Настройка на крайния срок - по подразбиране една седмица напред
  const [date, setDate] = useState<Date | undefined>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  // Опции за предаване на задачата
  const [allowLateSubmission, setAllowLateSubmission] = useState(false); // Разрешаване на закъснели предавания
  const [allowResubmission, setAllowResubmission] = useState(true); // Разрешаване на повторни предавания
  const [loading, setLoading] = useState(false); // Индикатор за зареждане
  const [allStudents, setAllStudents] = useState<
    { id: string; name: string; classId?: string }[]
  >([]); // Списък с всички ученици
  const [filteredStudents, setFilteredStudents] = useState<
    { id: string; name: string; classId?: string }[]
  >([]); // Списък с филтрирани ученици по клас
  const [selectedTab, setSelectedTab] = useState<string>("classes");

  // Извличане на данни от Firebase при зареждане на компонента
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.schoolId) return; // Проверка дали потребителят има асоциирано училище

      try {
        // Извличане на предмети от базата данни
        const subjectsCollection = collection(
          db,
          "schools",
          user.schoolId,
          "subjects"
        );
        const subjectsSnapshot = await getDocs(subjectsCollection);
        const subjectsData = subjectsSnapshot.docs.map(
          (doc) => ({ ...doc.data(), subjectId: doc.id } as Subject)
        );
        setSubjects(subjectsData);

        // Извличане на класове от базата данни
        const classesCollection = collection(
          db,
          "schools",
          user.schoolId,
          "classes"
        );
        const classesSnapshot = await getDocs(classesCollection);
        const classesData = classesSnapshot.docs.map(
          (doc) => ({ ...doc.data(), classId: doc.id } as HomeroomClass)
        );
        setClasses(classesData);

        // Извличане на ученици от базата данни
        const studentsCollection = collection(
          db,
          "schools",
          user.schoolId,
          "users"
        );
        const studentsSnapshot = await getDocs(studentsCollection);
        const studentsData = studentsSnapshot.docs
          .filter((doc) => doc.data().role === "student") // Филтриране само на ученици
          .map((doc) => ({
            id: doc.id,
            name: `${doc.data().firstName} ${doc.data().lastName}`,
            classId: doc.data().homeroomClassId, // Добавяне на класа на ученика
          }));
        setAllStudents(studentsData);
        setFilteredStudents(studentsData); // Initially show all students
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Грешка",
          description: "Неуспешно зареждане на предметите и класовете.",
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [user, toast]); // Повторно извикване при промяна на потребителя

  // Filter students when class is selected
  useEffect(() => {
    if (selectedClassForStudents) {
      const filtered = allStudents.filter(
        (student) => student.classId === selectedClassForStudents
      );
      setFilteredStudents(filtered);
      // Reset selected students when changing class
      setSelectedStudents([]);
    } else {
      setFilteredStudents(allStudents);
    }
  }, [selectedClassForStudents, allStudents]);

  // Функция за избор/деселекция на клас
  const handleClassSelect = (classId: string) => {
    setSelectedClasses(
      (prev) =>
        prev.includes(classId)
          ? prev.filter((id) => id !== classId) // Премахване, ако вече е избран
          : [...prev, classId] // Добавяне, ако не е избран
    );
  };

  // Функция за избор/деселекция на ученик
  const handleStudentSelect = (student: { id: string; name: string }) => {
    setSelectedStudents(
      (prev) =>
        prev.some((s) => s.id === student.id)
          ? prev.filter((s) => s.id !== student.id) // Премахване, ако вече е избран
          : [...prev, student] // Добавяне, ако не е избран
    );
  };

  // Функция за обработка на изпращането на формуляра
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId || !user?.userId) return; // Проверка за валиден потребител

    // Валидация на формуляра
    if (!title.trim()) {
      toast({
        title: "Грешка",
        description: "Моля, въведете заглавие за задачата.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSubject) {
      toast({
        title: "Грешка",
        description: "Моля, изберете предмет за задачата.",
        variant: "destructive",
      });
      return;
    }

    if (!date) {
      toast({
        title: "Грешка",
        description: "Моля, изберете краен срок за задачата.",
        variant: "destructive",
      });
      return;
    }

    // Проверка дали е избран поне един клас, ако сме в таб "класове"
    if (selectedTab === "classes" && selectedClasses.length === 0) {
      toast({
        title: "Грешка",
        description: "Моля, изберете поне един клас.",
        variant: "destructive",
      });
      return;
    }

    // Проверка дали е избран поне един ученик, ако сме в таб "ученици"
    if (selectedTab === "students" && selectedStudents.length === 0) {
      toast({
        title: "Грешка",
        description: "Моля, изберете поне един ученик.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true); // Задаване на индикатор за зареждане

    try {
      // Намиране на данни за избрания предмет
      const selectedSubjectData = subjects.find(
        (sub) => sub.subjectId === selectedSubject
      );

      // Подготвяне на данни за задачата
      const assignmentData = {
        title,
        description,
        teacherId: user.userId,
        teacherName: `${user.firstName} ${user.lastName}`,
        subjectId: selectedSubject,
        subjectName: selectedSubjectData?.name || "",
        dueDate: Timestamp.fromDate(date),
        classIds: selectedTab === "classes" ? selectedClasses : [],
        studentIds:
          selectedTab === "students"
            ? selectedStudents.map((student) => student.id)
            : [],
        allowLateSubmission,
        allowResubmission,
      };

      // Създаване на задачата чрез AssignmentContext
      await createNewAssignment(assignmentData);

      toast({
        title: "Успешно",
        description: "Заданието е създадено успешно",
      });

      // Пренасочване към страницата със задачи
      router.push("/teacher/assignments");
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Грешка",
        description: "Неуспешно създаване на заданието",
        variant: "destructive",
      });
    } finally {
      setLoading(false); // Изключване на индикатора за зареждане
    }
  };

  // Проверка дали потребителят е учител - само учители могат да създават задачи
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

  // Основен изглед на формата за създаване на задача
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">
            Създаване на задача
          </h1>

          {/* Карта с формуляра за създаване на задача */}
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50 border-b">
              <CardTitle className="text-xl">Детайли на задачата</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Секция за заглавие и предмет */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-700">
                      Заглавие на задачата
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Въведете заглавие на задачата"
                      className="border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700">
                      Subject
                    </Label>
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

                {/* Поле за описание на задачата */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-700">
                    Описание
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Въведете описание на задачата"
                    className="min-h-[150px] border-gray-200"
                  />
                </div>

                {/* Избор на краен срок с календар */}
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-gray-700">
                    Краен срок
                  </Label>
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

                {/* Секция за избор на класове или ученици с табове */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium">Възлагане на</h3>
                  <Tabs
                    defaultValue="classes"
                    className="w-full"
                    onValueChange={setSelectedTab}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="classes" data-value="classes">
                        Класове
                      </TabsTrigger>
                      <TabsTrigger value="students" data-value="students">
                        Конкретни ученици
                      </TabsTrigger>
                    </TabsList>

                    {/* Таб за избор на класове */}
                    <TabsContent value="classes" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-gray-700">
                          Изберете класове
                        </Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between border-gray-200 text-foreground"
                            >
                              {selectedClasses.length > 0
                                ? `${selectedClasses.length} ${
                                    selectedClasses.length > 1
                                      ? "класа"
                                      : "клас"
                                  } избрани`
                                : "Изберете класове"}
                              <ChevronsUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="w-full max-h-60"
                            align="start"
                          >
                            <ScrollArea className="h-[200px]">
                              {classes.map((cls) => (
                                <DropdownMenuCheckboxItem
                                  key={cls.classId}
                                  checked={selectedClasses.includes(
                                    cls.classId
                                  )}
                                  onCheckedChange={() =>
                                    handleClassSelect(cls.classId)
                                  }
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

                    {/* Таб за избор на конкретни ученици */}
                    <TabsContent value="students" className="space-y-4">
                      {/* Class selection for students tab */}
                      <div className="space-y-2">
                        <Label className="text-gray-700">Изберете клас</Label>
                        <Select
                          value={selectedClassForStudents}
                          onValueChange={setSelectedClassForStudents}
                        >
                          <SelectTrigger className="border-gray-200">
                            <SelectValue placeholder="Изберете клас" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((cls) => (
                              <SelectItem key={cls.classId} value={cls.classId}>
                                {cls.className}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-gray-700">
                          Изберете ученици
                        </Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between border-gray-200 text-foreground"
                              disabled={!selectedClassForStudents}
                            >
                              {selectedStudents.length > 0
                                ? `${selectedStudents.length} ${
                                    selectedStudents.length > 1
                                      ? "ученика"
                                      : "ученик"
                                  } избрани`
                                : "Изберете ученици"}
                              <ChevronsUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-full" align="start">
                            <ScrollArea className="h-[200px]">
                              {filteredStudents.length > 0 ? (
                                filteredStudents.map((student) => (
                                  <DropdownMenuCheckboxItem
                                    key={student.id}
                                    checked={selectedStudents.some(
                                      (s) => s.id === student.id
                                    )}
                                    onCheckedChange={() =>
                                      handleStudentSelect(student)
                                    }
                                  >
                                    {student.name}
                                    {selectedStudents.some(
                                      (s) => s.id === student.id
                                    ) && <Check className="ml-auto h-4 w-4" />}
                                  </DropdownMenuCheckboxItem>
                                ))
                              ) : (
                                <div className="py-2 px-4 text-sm text-gray-500">
                                  {selectedClassForStudents
                                    ? "Няма ученици в избрания клас"
                                    : "Моля, изберете клас първо"}
                                </div>
                              )}
                            </ScrollArea>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TabsContent>
                  </Tabs>{" "}
                </div>

                {/* Секция за опции за предаване */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-md font-medium">Опции за предаване</h3>
                  {/* Опция за разрешаване на закъснели предавания */}
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

                  {/* Опция за разрешаване на повторно предаване */}
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
                        Учениците могат да актуализират предаването си преди
                        крайния срок
                      </p>
                    </div>
                  </div>
                </div>

                {/* Бутон за изпращане на формуляра */}
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
