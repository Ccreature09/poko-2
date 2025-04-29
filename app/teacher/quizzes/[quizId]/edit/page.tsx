"use client";

import type React from "react";
import type { HomeroomClass } from "@/lib/interfaces";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { collection, getDocs, getDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import Sidebar from "@/components/functional/Sidebar";
import { updateQuiz } from "@/lib/quizManagement";
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
import { toast } from "@/hooks/use-toast";

interface Question {
  type: "multipleChoice" | "singleChoice" | "openEnded" | "trueFalse";
  text: string;
  points: number;
  choices?: { choiceId: string; text: string }[];
  correctAnswer?: string | string[];
  id?: string;
  questionId?: string;
}

export default function EditQuiz() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const quizId = params?.quizId as string;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [timeLimit, setTimeLimit] = useState("");
  const [securityLevel, setSecurityLevel] = useState<"low" | "medium" | "high" | "extreme">("low");
  const [showResults, setShowResults] = useState<"immediately" | "after_deadline" | "manual">("immediately");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeChoices, setRandomizeChoices] = useState(false);
  const [allowReview, setAllowReview] = useState(true);
  const [proctored, setProctored] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuizAndClasses = async () => {
      if (!user?.schoolId || !quizId) return;

      try {
        // Fetch quiz data
        const quizRef = doc(db, "schools", user.schoolId, "quizzes", quizId as string);
        const quizSnap = await getDoc(quizRef);
        
        if (!quizSnap.exists()) {
          toast({
            title: "Error",
            description: "Quiz not found",
            variant: "destructive",
          });
          router.push("/quizzes");
          return;
        }

        const quizData = quizSnap.data();
        
        // Set all the form fields
        setTitle(quizData.title);
        setDescription(quizData.description);
        setQuestions(quizData.questions);
        setSelectedClasses(quizData.classIds);
        setTimeLimit(quizData.timeLimit?.toString() || "");
        setSecurityLevel(quizData.securityLevel || "low");
        setShowResults(quizData.showResults || "immediately");
        setMaxAttempts(quizData.maxAttempts?.toString() || "1");
        setAvailableFrom(quizData.availableFrom ? new Date(quizData.availableFrom.toDate()).toISOString().slice(0, 16) : "");
        setAvailableTo(quizData.availableTo ? new Date(quizData.availableTo.toDate()).toISOString().slice(0, 16) : "");
        setRandomizeQuestions(quizData.randomizeQuestions || false);
        setRandomizeChoices(quizData.randomizeChoices || false);
        setAllowReview(quizData.allowReview !== false);
        setProctored(quizData.proctored || false);

        // Fetch available classes
        const classesRef = collection(db, "schools", user.schoolId, "classes");
        const classesSnapshot = await getDocs(classesRef);
        const classesList = classesSnapshot.docs.map((doc) => ({
          classId: doc.id,
          className: doc.data().className,
          yearGroup: doc.data().yearGroup,
          classTeacherId: doc.data().classTeacherId,
          studentIds: doc.data().studentIds,
          teacherIds: doc.data().teacherIds || [], // Add missing teacherIds property
        }));
        setClasses(classesList);
      } catch (error) {
        console.error("Error fetching quiz:", error);
        toast({
          title: "Error",
          description: "Failed to load quiz data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizAndClasses();
  }, [user, quizId, router]);

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
      const questionsWithIds = questions.map((question) => ({
        ...question,
        questionId: question.questionId || question.id || Date.now().toString(),
        points: Number(question.points) || 1,
        choices: question.choices?.map((choice) => ({
          ...choice,
          choiceId: choice.choiceId || Date.now().toString(),
        })),
        correctAnswer:
          question.type === "openEnded"
            ? ""
            : question.correctAnswer ||
              (question.type === "multipleChoice" ? [] : ""),
      }));

      await updateQuiz(user.schoolId, quizId as string, {
        title,
        description,
        questions: questionsWithIds,
        classIds: selectedClasses,
        timeLimit: Number(timeLimit),
        securityLevel,
        showResults,
        maxAttempts: Number(maxAttempts),
        availableFrom: availableFrom ? Timestamp.fromDate(new Date(availableFrom)) : undefined,
        availableTo: availableTo ? Timestamp.fromDate(new Date(availableTo)) : undefined,
        randomizeQuestions,
        randomizeChoices,
        allowReview,
        proctored
      });

      toast({
        title: "Success",
        description: "Quiz updated successfully",
      });

      router.push("/quizzes");
    } catch (error) {
      console.error("Error updating quiz:", error);
      toast({
        title: "Error",
        description: "Failed to update quiz",
        variant: "destructive",
      });
    }
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, qIndex) => qIndex !== index));
  };

  if (!user || user.role !== "teacher" || isLoading) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Edit Quiz</h1>
        <Card className="max-w-4xl mx-auto shadow-md">
          <CardHeader className="border-b bg-white">
            <CardTitle className="text-xl text-gray-800">Quiz Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-700">Quiz Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      className="border-gray-200 focus:border-blue-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classes" className="text-gray-700">Select Classes</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between bg-white border-gray-200 hover:bg-gray-50">
                          <span className="truncate">{renderSelectedClasses() || "Select classes"}</span>
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
                  <Label htmlFor="description" className="text-gray-700">Quiz Description</Label>
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
                    <Label htmlFor="timeLimit" className="text-gray-700">Time Limit (minutes)</Label>
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
                    <Label htmlFor="maxAttempts" className="text-gray-700">Maximum Attempts</Label>
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
                    <Label htmlFor="availableFrom" className="text-gray-700">Start Date</Label>
                    <Input
                      id="availableFrom"
                      type="datetime-local"
                      value={availableFrom}
                      onChange={(e) => setAvailableFrom(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availableTo" className="text-gray-700">End Date</Label>
                    <Input
                      id="availableTo"
                      type="datetime-local"
                      value={availableTo}
                      onChange={(e) => setAvailableTo(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="securityLevel" className="text-gray-700">Security Level</Label>
                    <Select onValueChange={(value: "low" | "medium" | "high" | "extreme") => setSecurityLevel(value)} value={securityLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select security level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="extreme">Extreme</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="showResults" className="text-gray-700">Show Results</Label>
                    <Select onValueChange={(value: "immediately" | "after_deadline" | "manual") => setShowResults(value)} value={showResults}>
                      <SelectTrigger>
                        <SelectValue placeholder="When to show results" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">Immediately</SelectItem>
                        <SelectItem value="after_deadline">After Deadline</SelectItem>
                        <SelectItem value="manual">Manual by Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="randomizeQuestions"
                      checked={randomizeQuestions}
                      onCheckedChange={(checked) => setRandomizeQuestions(checked as boolean)}
                    />
                    <Label htmlFor="randomizeQuestions">Randomize Questions</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="randomizeChoices"
                      checked={randomizeChoices}
                      onCheckedChange={(checked) => setRandomizeChoices(checked as boolean)}
                    />
                    <Label htmlFor="randomizeChoices">Randomize Choices</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowReview"
                      checked={allowReview}
                      onCheckedChange={(checked) => setAllowReview(checked as boolean)}
                    />
                    <Label htmlFor="allowReview">Allow Review</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="proctored"
                      checked={proctored}
                      onCheckedChange={(checked) => setProctored(checked as boolean)}
                    />
                    <Label htmlFor="proctored">Requires Proctoring</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-6 border-t pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">Questions</h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => addQuestion("singleChoice")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Single Choice
                    </Button>
                    <Button
                      type="button"
                      onClick={() => addQuestion("multipleChoice")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Multiple Choice
                    </Button>
                    <Button
                      type="button"
                      onClick={() => addQuestion("openEnded")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Open Ended
                    </Button>
                    <Button
                      type="button"
                      onClick={() => addQuestion("trueFalse")}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      True/False
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
                              <Label className="text-gray-700 shrink-0">Question {qIndex + 1}</Label>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`points-${qIndex}`} className="text-gray-700 shrink-0">Points:</Label>
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
                              placeholder="Enter the question text"
                              className="border-gray-200 focus:border-blue-300"
                            />
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeQuestion(qIndex)}
                            variant="destructive"
                            className="ml-4"
                          >
                            Delete
                          </Button>
                        </div>

                        {question.type !== "openEnded" && question.type !== "trueFalse" && (
                          <div className="space-y-4 mt-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-gray-700">Answers</Label>
                              <Button
                                type="button"
                                onClick={() => addChoice(qIndex)}
                                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                              >
                                Add Choice
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
                                          placeholder={`Choice ${cIndex + 1}`}
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
                                        className="mr-2"
                                      />
                                      <Input
                                        value={choice.text}
                                        onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
                                        placeholder={`Choice ${cIndex + 1}`}
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
                            <Label className="text-gray-700">Correct Answer</Label>
                            <RadioGroup
                              value={question.correctAnswer as string}
                              onValueChange={(value: string) => updateQuestion(qIndex, "correctAnswer", value)}
                              className="flex items-center gap-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="true" id={`q${qIndex}-true`} />
                                <Label htmlFor={`q${qIndex}-true`}>True</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="false" id={`q${qIndex}-false`} />
                                <Label htmlFor={`q${qIndex}-false`}>False</Label>
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
                  disabled={questions.length === 0 || selectedClasses.length === 0}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}