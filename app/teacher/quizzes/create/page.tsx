"use client";

/**
 * Teacher Quiz Creation Page
 *
 * Advanced interface for creating educational assessments.
 * This page provides:
 *
 * Key features:
 * - Multi-format question creation (single-choice, multiple-choice, open-ended, true/false)
 * - Flexible assessment configuration with time limits and availability windows
 * - Security level settings from basic to high-security exam environments
 * - Advanced anti-cheating options including question/answer randomization
 * - Targeted assignment to specific classes with multi-select capability
 * - Points and grading customization for each question
 *
 * Data flow:
 * - Retrieves class data for assessment targeting
 * - Processes question and answer formatting for different question types
 * - Manages correct answer logic for various question formats
 * - Creates quiz document with complete configuration in database
 *
 * This interface enables teachers to build comprehensive assessments with
 * flexible question types, timing parameters, and security settings to
 * accommodate everything from simple knowledge checks to high-stakes exams.
 */

import type React from "react";
import type { HomeroomClass } from "@/lib/interfaces";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/layout/Sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface Question {
  type: "multipleChoice" | "singleChoice" | "openEnded" | "trueFalse";
  text: string;
  points: number;
  choices?: { choiceId: string; text: string }[];
  correctAnswer?: string | string[];
  id?: string;
}

export default function CreateQuiz() {
  const { user } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [timeLimit, setTimeLimit] = useState("");
  const [securityLevel, setSecurityLevel] = useState<
    "low" | "medium" | "high" | "extreme"
  >("low");
  const [showResults, setShowResults] = useState<
    "immediately" | "after_deadline" | "manual"
  >("immediately");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeChoices, setRandomizeChoices] = useState(false);
  const [allowReview, setAllowReview] = useState(true);
  const [proctored, setProctored] = useState(false);

  useEffect(() => {
    // Redirect non-teachers
    if (user && user.role !== "teacher") {
      router.push("/dashboard");
      return;
    }

    const fetchClasses = async () => {
      if (!user || !user.schoolId) return;
      const classesRef = collection(db, "schools", user.schoolId, "classes");
      const classesSnapshot = await getDocs(classesRef);
      const classesList = classesSnapshot.docs.map((doc) => ({
        classId: doc.id,
        className: doc.data().className,
        yearGroup: doc.data().yearGroup,
        classTeacherId: doc.data().classTeacherId,
        studentIds: doc.data().studentIds,
        teacherIds: doc.data().teacherIds || [], // Add the missing teacherIds property
        namingFormat: doc.data().namingFormat || "graded", // Add required namingFormat property with default value
        teacherSubjectPairs: doc.data().teacherSubjectPairs || [], // Add the missing teacherSubjectPairs property
      }));
      setClasses(classesList);
    };
    fetchClasses();
  }, [user, router]);

  const addQuestion = (type: Question["type"]) => {
    setQuestions([
      ...questions,
      {
        type,
        text: "",
        points: 1,
        choices:
          type !== "openEnded" && type !== "trueFalse"
            ? [
                { choiceId: Date.now().toString(), text: "" },
                { choiceId: (Date.now() + 1).toString(), text: "" },
              ]
            : [],
        correctAnswer: type === "openEnded" ? "" : undefined,
        id: Date.now().toString(),
      },
    ]);
  };

  const updateQuestion = (
    index: number,
    field: keyof Question,
    value: string | string[] | number
  ) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const addChoice = (questionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].choices?.push({
      choiceId: Date.now().toString(),
      text: "",
    });
    setQuestions(updatedQuestions);
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    value: string
  ) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[questionIndex].choices) {
      updatedQuestions[questionIndex].choices![choiceIndex] = {
        ...updatedQuestions[questionIndex].choices![choiceIndex],
        text: value,
      };
    }
    setQuestions(updatedQuestions);
  };

  const handleClassSelect = (classId: string) => {
    setSelectedClasses((prevSelected) =>
      prevSelected.includes(classId)
        ? prevSelected.filter((id) => id !== classId)
        : [...prevSelected, classId]
    );
  };

  const renderSelectedClasses = () => {
    return selectedClasses
      .map(
        (classId) => classes.find((cls) => cls.classId === classId)?.className
      )
      .join(", ");
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId) return;
    try {
      const quizRef = collection(db, "schools", user.schoolId, "quizzes");
      const questionsWithIds = questions.map((question, index) => ({
        ...question,
        questionId: question.id || index.toString(),
        points: Number(question.points) || 1,
        choices: question.choices?.map((choice, cIndex) => ({
          ...choice,
          choiceId: choice.choiceId || `${question.id}-${cIndex}`,
        })),
        correctAnswer:
          question.type === "openEnded"
            ? ""
            : question.correctAnswer ||
              (question.type === "multipleChoice" ? [] : ""),
      }));

      await addDoc(quizRef, {
        title,
        description,
        questions: questionsWithIds,
        teacherId: user.userId,
        createdAt: new Date(),
        classIds: selectedClasses,
        timeLimit: Number(timeLimit),
        securityLevel,
        showResults,
        maxAttempts: Number(maxAttempts),
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
        randomizeQuestions,
        randomizeChoices,
        allowReview,
        proctored,
        tookTest: [],
        points: questionsWithIds.reduce(
          (total: number, q) => total + (Number(q.points) || 0),
          0
        ),
      });

      router.push(`/teacher/quizzes`);
    } catch (error) {
      console.error("Грешка при създаване на тест:", error);
    }
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, qIndex) => qIndex !== index));
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">
          Създаване на нов тест
        </h1>
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-xl text-gray-800">
              Детайли за теста
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-700">
                      Заглавие на теста
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="border-gray-200 focus:border-blue-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="classes" className="text-gray-700">
                      Изберете класове
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between bg-white border-gray-200 hover:bg-gray-50"
                        >
                          <span className="truncate">
                            {renderSelectedClasses() || "Изберете класове"}
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="ml-2"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px]">
                        {classes.map((cls) => (
                          <DropdownMenuItem
                            key={cls.classId}
                            onSelect={() => handleClassSelect(cls.classId)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center">
                              <Checkbox
                                checked={selectedClasses.includes(cls.classId)}
                                className="mr-2"
                              />
                              {cls.className}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-700">
                    Описание на теста
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="min-h-[100px] border-gray-200 focus:border-blue-300"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit" className="text-gray-700">
                      Времеви лимит (минути)
                    </Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      min="1"
                      className="border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxAttempts" className="text-gray-700">
                      Максимален брой опити
                    </Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      min="1"
                      className="border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availableFrom" className="text-gray-700">
                      Начална дата
                    </Label>
                    <Input
                      id="availableFrom"
                      type="datetime-local"
                      value={availableFrom}
                      onChange={(e) => setAvailableFrom(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availableTo" className="text-gray-700">
                      Крайна дата
                    </Label>
                    <Input
                      id="availableTo"
                      type="datetime-local"
                      value={availableTo}
                      onChange={(e) => setAvailableTo(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="securityLevel" className="text-gray-700">
                      Ниво на сигурност
                    </Label>
                    <Select
                      onValueChange={(
                        value: "low" | "medium" | "high" | "extreme"
                      ) => setSecurityLevel(value)}
                      value={securityLevel}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Изберете ниво на сигурност" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Ниско</SelectItem>
                        <SelectItem value="medium">Средно</SelectItem>
                        <SelectItem value="high">Високо</SelectItem>
                        <SelectItem value="extreme">Екстремно</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="showResults" className="text-gray-700">
                      Показване на резултати
                    </Label>
                    <Select
                      onValueChange={(
                        value: "immediately" | "after_deadline" | "manual"
                      ) => setShowResults(value)}
                      value={showResults}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Кога да се показват резултатите" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">Веднага</SelectItem>
                        <SelectItem value="after_deadline">
                          След крайния срок
                        </SelectItem>
                        <SelectItem value="manual">Ръчно от учител</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="randomizeQuestions"
                      checked={randomizeQuestions}
                      onCheckedChange={(checked) =>
                        setRandomizeQuestions(checked as boolean)
                      }
                    />
                    <Label htmlFor="randomizeQuestions">
                      Разбъркване на въпросите
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="randomizeChoices"
                      checked={randomizeChoices}
                      onCheckedChange={(checked) =>
                        setRandomizeChoices(checked as boolean)
                      }
                    />
                    <Label htmlFor="randomizeChoices">
                      Разбъркване на отговорите
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowReview"
                      checked={allowReview}
                      onCheckedChange={(checked) =>
                        setAllowReview(checked as boolean)
                      }
                    />
                    <Label htmlFor="allowReview">Разрешаване на преглед</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="proctored"
                      checked={proctored}
                      onCheckedChange={(checked) =>
                        setProctored(checked as boolean)
                      }
                    />
                    <Label htmlFor="proctored">Изисква наблюдение</Label>
                  </div>{" "}
                </div>
              </div>

              <div className="space-y-6 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Въпроси
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => addQuestion("singleChoice")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Един избор
                    </Button>
                    <Button
                      type="button"
                      onClick={() => addQuestion("multipleChoice")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Множествен избор
                    </Button>
                    <Button
                      type="button"
                      onClick={() => addQuestion("openEnded")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Отворен отговор
                    </Button>
                    <Button
                      type="button"
                      onClick={() => addQuestion("trueFalse")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Вярно/Невярно
                    </Button>
                  </div>
                </div>

                {questions.map((question, qIndex) => (
                  <Card key={qIndex} className="border border-gray-200">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-4">
                              <Label className="text-gray-700 shrink-0">
                                Въпрос {qIndex + 1}
                              </Label>
                              <div className="flex items-center gap-2">
                                <Label
                                  htmlFor={`points-${qIndex}`}
                                  className="text-gray-700 shrink-0"
                                >
                                  Точки:
                                </Label>
                                <Input
                                  id={`points-${qIndex}`}
                                  type="number"
                                  min="1"
                                  value={question.points}
                                  onChange={(e) =>
                                    updateQuestion(
                                      qIndex,
                                      "points",
                                      Math.max(1, Number(e.target.value))
                                    )
                                  }
                                  className="w-20 border-gray-200 focus:border-blue-300"
                                />
                              </div>
                            </div>
                            <Textarea
                              value={question.text}
                              onChange={(e) =>
                                updateQuestion(qIndex, "text", e.target.value)
                              }
                              placeholder="Въведете текста на въпроса"
                              className="border-gray-200 focus:border-blue-300"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeQuestion(qIndex)}
                            variant="destructive"
                            className="ml-4"
                          >
                            Изтриване
                          </Button>
                        </div>

                        {question.type !== "openEnded" &&
                          question.type !== "trueFalse" && (
                            <div className="space-y-4 mt-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-gray-700">
                                  Отговори
                                </Label>
                                <Button
                                  type="button"
                                  onClick={() => addChoice(qIndex)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                >
                                  Добавяне на избор
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {question.choices?.map((choice, cIndex) => (
                                  <div
                                    key={choice.choiceId}
                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                                  >
                                    {question.type === "singleChoice" ? (
                                      <RadioGroup
                                        value={question.correctAnswer as string}
                                        onValueChange={(value: string) =>
                                          updateQuestion(
                                            qIndex,
                                            "correctAnswer",
                                            value
                                          )
                                        }
                                        className="flex items-center gap-3 flex-1"
                                      >
                                        <div className="flex items-center flex-1">
                                          <RadioGroupItem
                                            value={cIndex.toString()}
                                            id={`q${qIndex}c${cIndex}`}
                                            className="mr-2"
                                          />
                                          <Input
                                            value={choice.text}
                                            onChange={(e) =>
                                              updateChoice(
                                                qIndex,
                                                cIndex,
                                                e.target.value
                                              )
                                            }
                                            placeholder={`Избор ${cIndex + 1}`}
                                            className="flex-1 border-gray-200 focus:border-blue-300"
                                          />
                                        </div>
                                      </RadioGroup>
                                    ) : (
                                      <div className="flex items-center gap-3 flex-1">
                                        <Checkbox
                                          checked={(
                                            question.correctAnswer as string[]
                                          )?.includes(cIndex.toString())}
                                          onCheckedChange={(checked) => {
                                            const currentAnswers =
                                              (question.correctAnswer as string[]) ||
                                              [];
                                            const updatedAnswers = checked
                                              ? [
                                                  ...currentAnswers,
                                                  cIndex.toString(),
                                                ]
                                              : currentAnswers.filter(
                                                  (a) => a !== cIndex.toString()
                                                );
                                            updateQuestion(
                                              qIndex,
                                              "correctAnswer",
                                              updatedAnswers
                                            );
                                          }}
                                          id={`q${qIndex}c${cIndex}`}
                                        />
                                        <Input
                                          value={choice.text}
                                          onChange={(e) =>
                                            updateChoice(
                                              qIndex,
                                              cIndex,
                                              e.target.value
                                            )
                                          }
                                          placeholder={`Избор ${cIndex + 1}`}
                                          className="flex-1 border-gray-200 focus:border-blue-300"
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {question.type === "trueFalse" && (
                          <div className="space-y-4 mt-4">
                            <Label className="text-gray-700">
                              Верен отговор
                            </Label>
                            <RadioGroup
                              value={question.correctAnswer as string}
                              onValueChange={(value: string) =>
                                updateQuestion(qIndex, "correctAnswer", value)
                              }
                              className="flex items-center gap-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="true"
                                  id={`q${qIndex}-true`}
                                />
                                <Label htmlFor={`q${qIndex}-true`}>Вярно</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value="false"
                                  id={`q${qIndex}-false`}
                                />
                                <Label htmlFor={`q${qIndex}-false`}>
                                  Невярно
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-6 border-t">
                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors text-lg py-6"
                  disabled={
                    questions.length === 0 || selectedClasses.length === 0
                  }
                >
                  Създаване на тест
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
