"use client";

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
import Sidebar from "@/components/functional/Sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface Question {
  type: "multipleChoice" | "singleChoice" | "openEnded";
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

  useEffect(() => {
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
      }));
      setClasses(classesList);
    };
    fetchClasses();
  }, [user]);

  const addQuestion = (type: Question["type"]) => {
    setQuestions([
      ...questions,
      {
        type,
        text: "",
        points: 1,
        choices:
          type !== "openEnded"
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

      console.log({
        title,
        description,
        isActive: false,
        questions: questionsWithIds,
        teacherId: user.userId,
        createdAt: new Date(),
        classIds: selectedClasses,
      });

      await addDoc(quizRef, {
        title,
        description,
        isActive: false,
        questions: questionsWithIds,
        teacherId: user.userId,
        createdAt: new Date(),
        classIds: selectedClasses,
      });

      router.push(`/dashboard/${user.schoolId}`);
    } catch (error) {
      console.error("Грешка при създаване на тест:", error);
    }
  };

  const removeQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, qIndex) => qIndex !== index);
    setQuestions(updatedQuestions);
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Създаване на нов тест</h1>
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-xl text-gray-800">Детайли за теста</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-700">Заглавие на теста</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="border-gray-200 focus:border-blue-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="classes" className="text-gray-700">Изберете класове</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-white border-gray-200 hover:bg-gray-50">
                          <span className="truncate">{renderSelectedClasses() || "Изберете класове"}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                            <path d="m6 9 6 6 6-6"/>
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
                              <input
                                type="checkbox"
                                checked={selectedClasses.includes(cls.classId)}
                                readOnly
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
                  <Label htmlFor="description" className="text-gray-700">Описание на теста</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="min-h-[100px] border-gray-200 focus:border-blue-300"
                  />
                </div>
              </div>

              <div className="space-y-6 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Въпроси</h3>
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
                  </div>
                </div>

                {questions.map((question, qIndex) => (
                  <Card key={qIndex} className="border border-gray-200">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-4">
                              <Label className="text-gray-700 shrink-0">Въпрос {qIndex + 1}</Label>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`points-${qIndex}`} className="text-gray-700 shrink-0">Точки:</Label>
                                <Input
                                  id={`points-${qIndex}`}
                                  type="number"
                                  min="1"
                                  value={question.points}
                                  onChange={(e) => updateQuestion(qIndex, "points", Math.max(1, Number(e.target.value)))}
                                  className="w-20 border-gray-200 focus:border-blue-300"
                                />
                              </div>
                            </div>
                            <Textarea
                              value={question.text}
                              onChange={(e) => updateQuestion(qIndex, "text", e.target.value)}
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

                        {question.type !== "openEnded" && (
                          <div className="space-y-4 mt-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-gray-700">Отговори</Label>
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
                                      onValueChange={(value: string) => updateQuestion(qIndex, "correctAnswer", value)}
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
                                          onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
                                          placeholder={`Избор ${cIndex + 1}`}
                                          className="flex-1 border-gray-200 focus:border-blue-300"
                                        />
                                      </div>
                                    </RadioGroup>
                                  ) : (
                                    <div className="flex items-center gap-3 flex-1">
                                      <Checkbox
                                        checked={(question.correctAnswer as string[])?.includes(cIndex.toString())}
                                        onCheckedChange={(checked) => {
                                          const currentAnswers = (question.correctAnswer as string[]) || [];
                                          const updatedAnswers = checked
                                            ? [...currentAnswers, cIndex.toString()]
                                            : currentAnswers.filter((a) => a !== cIndex.toString());
                                          updateQuestion(qIndex, "correctAnswer", updatedAnswers);
                                        }}
                                        id={`q${qIndex}c${cIndex}`}
                                      />
                                      <Input
                                        value={choice.text}
                                        onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="pt-6 border-t">
                <Button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors text-lg py-6"
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
