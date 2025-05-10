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
import { Badge } from "@/components/ui/badge";

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
      <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-gr`ay-800">
          Създаване на нов тест
        </h1>
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-xl text-gray-800">
              Детайли за теста
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title" className="text-sm sm:text-base">
                      Име на теста
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 text-sm sm:text-base"
                      placeholder="Въведете име на теста"
                      required
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="description"
                      className="text-sm sm:text-base"
                    >
                      Описание
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 text-sm sm:text-base"
                      placeholder="Въведете описание на теста"
                    />
                  </div>

                  <div>
                    <Label className="text-sm sm:text-base">Класове</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {classes.map((cls) => (
                        <div
                          key={cls.classId}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={cls.classId}
                            checked={selectedClasses.includes(cls.classId)}
                            onCheckedChange={() =>
                              handleClassSelect(cls.classId)
                            }
                          />
                          <Label
                            htmlFor={cls.classId}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {cls.className}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedClasses.length > 0 && (
                      <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
                        Избрани класове: {renderSelectedClasses()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="timeLimit"
                        className="text-sm sm:text-base"
                      >
                        Времетраене (минути)
                      </Label>
                      <Input
                        id="timeLimit"
                        type="number"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(e.target.value)}
                        min="0"
                        className="mt-1 text-sm sm:text-base"
                        placeholder="Без ограничение"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="maxAttempts"
                        className="text-sm sm:text-base"
                      >
                        Макс. брой опити
                      </Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        value={maxAttempts}
                        onChange={(e) => setMaxAttempts(e.target.value)}
                        min="1"
                        className="mt-1 text-sm sm:text-base"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="availableFrom"
                        className="text-sm sm:text-base"
                      >
                        Достъпен от
                      </Label>
                      <Input
                        id="availableFrom"
                        type="datetime-local"
                        value={availableFrom}
                        onChange={(e) => setAvailableFrom(e.target.value)}
                        className="mt-1 text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="availableTo"
                        className="text-sm sm:text-base"
                      >
                        Достъпен до
                      </Label>
                      <Input
                        id="availableTo"
                        type="datetime-local"
                        value={availableTo}
                        onChange={(e) => setAvailableTo(e.target.value)}
                        className="mt-1 text-sm sm:text-base"
                      />
                    </div>
                  </div>{" "}
                  <div>
                    <Label
                      htmlFor="securityLevel"
                      className="text-sm sm:text-base mb-1 block"
                    >
                      Ниво на сигурност
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {" "}
                      <Button
                        type="button"
                        variant={
                          securityLevel === "low" ? "default" : "outline"
                        }
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          securityLevel === "low" ? "text-white" : ""
                        }`}
                        onClick={() => setSecurityLevel("low")}
                      >
                        Ниско
                      </Button>
                      <Button
                        type="button"
                        variant={
                          securityLevel === "medium" ? "default" : "outline"
                        }
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          securityLevel === "medium" ? "text-white" : ""
                        }`}
                        onClick={() => setSecurityLevel("medium")}
                      >
                        Средно
                      </Button>
                      <Button
                        type="button"
                        variant={
                          securityLevel === "high" ? "default" : "outline"
                        }
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          securityLevel === "high" ? "text-white" : ""
                        }`}
                        onClick={() => setSecurityLevel("high")}
                      >
                        Високо
                      </Button>
                      <Button
                        type="button"
                        variant={
                          securityLevel === "extreme" ? "default" : "outline"
                        }
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          securityLevel === "extreme" ? "text-white" : ""
                        }`}
                        onClick={() => setSecurityLevel("extreme")}
                      >
                        Изпитно
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label
                      htmlFor="showResults"
                      className="text-sm sm:text-base mb-1 block"
                    >
                      Показване на резултати
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {" "}
                      <Button
                        type="button"
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          showResults === "immediately" ? "text-white" : ""
                        }`}
                        variant={
                          showResults === "immediately" ? "default" : "outline"
                        }
                        onClick={() => setShowResults("immediately")}
                      >
                        Веднага
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          showResults === "after_deadline" ? "text-white" : ""
                        }`}
                        variant={
                          showResults === "after_deadline"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setShowResults("after_deadline")}
                      >
                        След крайния срок
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className={`text-xs sm:text-sm ${
                          showResults === "manual" ? "text-white" : ""
                        }`}
                        variant={
                          showResults === "manual" ? "default" : "outline"
                        }
                        onClick={() => setShowResults("manual")}
                      >
                        Ръчно публикуване
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="randomizeQuestions"
                        checked={randomizeQuestions}
                        onCheckedChange={(checked) =>
                          setRandomizeQuestions(!!checked)
                        }
                      />
                      <Label
                        htmlFor="randomizeQuestions"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Разбъркване на въпросите
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="randomizeChoices"
                        checked={randomizeChoices}
                        onCheckedChange={(checked) =>
                          setRandomizeChoices(!!checked)
                        }
                      />
                      <Label
                        htmlFor="randomizeChoices"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Разбъркване на отговорите
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="allowReview"
                        checked={allowReview}
                        onCheckedChange={(checked) => setAllowReview(!!checked)}
                      />
                      <Label
                        htmlFor="allowReview"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Разрешаване на преглед след предаване
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="proctored"
                        checked={proctored}
                        onCheckedChange={(checked) => setProctored(!!checked)}
                      />
                      <Label
                        htmlFor="proctored"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Наблюдаван тест
                      </Label>
                    </div>
                  </div>
                </div>
              </div>{" "}
              <div className="mt-6 space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-semibold">Въпроси</h2>
                  <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-10"
                        >
                          Добави въпрос
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => addQuestion("singleChoice")}
                          className="text-xs sm:text-sm"
                        >
                          Един верен отговор
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => addQuestion("multipleChoice")}
                          className="text-xs sm:text-sm"
                        >
                          Много верни отговори
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => addQuestion("trueFalse")}
                          className="text-xs sm:text-sm"
                        >
                          Вярно/Невярно
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => addQuestion("openEnded")}
                          className="text-xs sm:text-sm"
                        >
                          Отворен отговор
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="submit"
                      size="sm"
                      className="text-xs text-white sm:text-sm px-2 sm:px-4 h-8 sm:h-10"
                    >
                      Запази теста
                    </Button>
                  </div>
                </div>{" "}
                {questions.map((question, qIndex) => (
                  <Card key={qIndex} className="relative">
                    <CardHeader className="pb-2 flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base sm:text-lg">
                            Въпрос {qIndex + 1}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {question.type === "singleChoice"
                              ? "Един верен отговор"
                              : question.type === "multipleChoice"
                              ? "Много верни отговори"
                              : question.type === "trueFalse"
                              ? "Вярно/Невярно"
                              : "Отворен отговор"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`question-points-${qIndex}`}
                            className="text-xs sm:text-sm"
                          >
                            Точки:
                          </Label>
                          <Input
                            id={`question-points-${qIndex}`}
                            type="number"
                            className="w-16 h-8 text-xs sm:text-sm"
                            min="1"
                            value={question.points}
                            onChange={(e) =>
                              updateQuestion(
                                qIndex,
                                "points",
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 mt-2 sm:mt-0"
                        onClick={() => removeQuestion(qIndex)}
                      >
                        Изтрий
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div>
                        <Label
                          htmlFor={`question-text-${qIndex}`}
                          className="text-xs sm:text-sm mb-1 block"
                        >
                          Текст на въпроса
                        </Label>
                        <Textarea
                          id={`question-text-${qIndex}`}
                          placeholder="Въведете текст на въпроса"
                          className="min-h-[60px] text-xs sm:text-sm"
                          value={question.text}
                          onChange={(e) =>
                            updateQuestion(qIndex, "text", e.target.value)
                          }
                        />
                      </div>{" "}
                      {question.type === "trueFalse" && (
                        <div>
                          <Label className="text-xs sm:text-sm mb-1 block">
                            Верен отговор
                          </Label>
                          <RadioGroup
                            value={question.correctAnswer as string}
                            onValueChange={(value) =>
                              updateQuestion(qIndex, "correctAnswer", value)
                            }
                            className="flex flex-col sm:flex-row gap-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="true"
                                id={`true-${qIndex}`}
                              />
                              <Label
                                htmlFor={`true-${qIndex}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Вярно
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="false"
                                id={`false-${qIndex}`}
                              />
                              <Label
                                htmlFor={`false-${qIndex}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Невярно
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      )}{" "}
                      {(question.type === "singleChoice" ||
                        question.type === "multipleChoice") && (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                            <Label className="text-xs sm:text-sm mb-1 block">
                              Възможни отговори
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs sm:text-sm"
                              onClick={() => addChoice(qIndex)}
                            >
                              Добави отговор
                            </Button>
                          </div>

                          {question.choices?.map((choice, choiceIndex) => (
                            <div
                              key={choice.choiceId}
                              className="flex items-start gap-2"
                            >
                              {question.type === "singleChoice" ? (
                                <RadioGroup
                                  value={question.correctAnswer as string}
                                  onValueChange={(value) =>
                                    updateQuestion(
                                      qIndex,
                                      "correctAnswer",
                                      value
                                    )
                                  }
                                  className="flex items-center"
                                >
                                  <div className="flex items-center h-10">
                                    <RadioGroupItem
                                      value={choice.choiceId}
                                      id={`choice-${qIndex}-${choiceIndex}`}
                                    />
                                  </div>
                                </RadioGroup>
                              ) : (
                                <Checkbox
                                  id={`choice-${qIndex}-${choiceIndex}`}
                                  className="mt-2.5"
                                  checked={
                                    Array.isArray(question.correctAnswer) &&
                                    question.correctAnswer.includes(
                                      choice.choiceId
                                    )
                                  }
                                  onCheckedChange={(checked) => {
                                    const currentAnswers = Array.isArray(
                                      question.correctAnswer
                                    )
                                      ? [...question.correctAnswer]
                                      : [];
                                    const updatedAnswers = checked
                                      ? [...currentAnswers, choice.choiceId]
                                      : currentAnswers.filter(
                                          (id) => id !== choice.choiceId
                                        );
                                    updateQuestion(
                                      qIndex,
                                      "correctAnswer",
                                      updatedAnswers
                                    );
                                  }}
                                />
                              )}
                              <div className="flex-1">
                                <Input
                                  value={choice.text}
                                  placeholder={`Отговор ${choiceIndex + 1}`}
                                  className="text-xs sm:text-sm"
                                  onChange={(e) =>
                                    updateChoice(
                                      qIndex,
                                      choiceIndex,
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {question.type === "openEnded" && (
                        <div className="p-3 bg-muted/30 rounded border text-xs sm:text-sm text-muted-foreground">
                          Въпрос със свободен отговор. Учениците ще въведат своя
                          отговор в текстово поле.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {questions.length === 0 && (
                  <div className="text-center p-12 border rounded-lg bg-muted/10">
                    <p className="text-muted-foreground text-sm sm:text-base">
                      Все още няма добавени въпроси. Натиснете &quot;Добави
                      въпрос&quot; за да започнете.
                    </p>
                  </div>
                )}
                <div className="flex justify-end text-white mt-4">
                  <Button type="submit">Запази теста</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
