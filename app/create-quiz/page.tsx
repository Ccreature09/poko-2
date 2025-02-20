"use client";

import type React from "react";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/Sidebar";

interface Question {
  type: "multipleChoice" | "singleChoice" | "openEnded";
  text: string;
  choices?: string[];
  correctAnswer?: string | string[];
}

export default function CreateQuiz() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);

  const addQuestion = (type: Question["type"]) => {
    setQuestions([...questions, { type, text: "", choices: ["", ""] }]);
  };

  const updateQuestion = (
    index: number,
    field: keyof Question,
    value: string | string[]
  ) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const addChoice = (questionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].choices?.push("");
    setQuestions(updatedQuestions);
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    value: string
  ) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[questionIndex].choices) {
      updatedQuestions[questionIndex].choices![choiceIndex] = value;
    }
    setQuestions(updatedQuestions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.schoolId) return;

    try {
      const quizRef = collection(db, "schools", user.schoolId, "quizzes");
      await addDoc(quizRef, {
        title,
        questions,
        teacherId: user.userId,
        createdAt: new Date(),
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("Error creating quiz:", error);
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8">Create New Quiz</h1>
        <Card>
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Quiz Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              {questions.map((question, qIndex) => (
                <Card key={qIndex} className="mb-4">
                  <CardContent className="pt-4">
                    <Label>Question {qIndex + 1}</Label>
                    <Textarea
                      value={question.text}
                      onChange={(e) =>
                        updateQuestion(qIndex, "text", e.target.value)
                      }
                      placeholder="Enter question text"
                      className="mb-2"
                    />
                    {question.type !== "openEnded" && (
                      <>
                        {question.choices?.map((choice, cIndex) => (
                          <div
                            key={cIndex}
                            className="flex items-center space-x-2 mb-2"
                          >
                            {question.type === "singleChoice" ? (
                              <RadioGroup
                                value={question.correctAnswer as string}
                                onValueChange={(value: string) =>
                                  updateQuestion(qIndex, "correctAnswer", value)
                                }
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value={cIndex.toString()}
                                    id={`q${qIndex}c${cIndex}`}
                                  />
                                  <Input
                                    value={choice}
                                    onChange={(
                                      e: React.ChangeEvent<HTMLInputElement>
                                    ) =>
                                      updateChoice(
                                        qIndex,
                                        cIndex,
                                        e.target.value
                                      )
                                    }
                                    placeholder={`Choice ${cIndex + 1}`}
                                  />
                                </div>
                              </RadioGroup>
                            ) : (
                              <>
                                <Checkbox
                                  checked={(
                                    question.correctAnswer as string[]
                                  )?.includes(cIndex.toString())}
                                  onCheckedChange={(checked) => {
                                    const currentAnswers =
                                      (question.correctAnswer as string[]) ||
                                      [];
                                    const updatedAnswers = checked
                                      ? [...currentAnswers, cIndex.toString()]
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
                                  value={choice}
                                  onChange={(e) =>
                                    updateChoice(qIndex, cIndex, e.target.value)
                                  }
                                  placeholder={`Choice ${cIndex + 1}`}
                                />
                              </>
                            )}
                          </div>
                        ))}
                        <Button type="button" onClick={() => addChoice(qIndex)}>
                          Add Choice
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
              <div className="space-x-2">
                <Button
                  type="button"
                  onClick={() => addQuestion("singleChoice")}
                >
                  Add Single Choice Question
                </Button>
                <Button
                  type="button"
                  onClick={() => addQuestion("multipleChoice")}
                >
                  Add Multiple Choice Question
                </Button>
                <Button type="button" onClick={() => addQuestion("openEnded")}>
                  Add Open-Ended Question
                </Button>
              </div>
              <Button type="submit">Create Quiz</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
