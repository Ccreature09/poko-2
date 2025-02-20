import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Quiz } from "@/lib/interfaces";
interface QuizProps {
  quiz: Quiz;
  onSubmit: (answers: Record<string, string | string[]>) => void;
}

export default function QuizComponent({ quiz, onSubmit }: QuizProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const handleAnswerChange = (
    questionId: string,
    answer: string | string[]
  ) => {
    setAnswers((prevAnswers) => ({
      ...prevAnswers,
      [questionId]: answer,
    }));
  };

  const handleSubmit = () => {
    onSubmit(answers);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Quiz</h2>
      {quiz.questions.map((question) => (
        <div key={question.questionId} className="border p-4 rounded-lg">
          <p className="font-semibold mb-2">{question.text}</p>
          {question.type === "multipleChoice" && (
            <div className="space-y-2">
              {question.choices?.map((choice) => (
                <label
                  key={choice.choiceId}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="checkbox"
                    checked={(
                      (answers[question.questionId] as string[]) || []
                    ).includes(choice.choiceId)}
                    onChange={(e) => {
                      const currentAnswers =
                        (answers[question.questionId] as string[]) || [];
                      if (e.target.checked) {
                        handleAnswerChange(question.questionId, [
                          ...currentAnswers,
                          choice.choiceId,
                        ]);
                      } else {
                        handleAnswerChange(
                          question.questionId,
                          currentAnswers.filter((id) => id !== choice.choiceId)
                        );
                      }
                    }}
                  />
                  <span>{choice.text}</span>
                </label>
              ))}
            </div>
          )}
          {question.type === "singleChoice" && (
            <div className="space-y-2">
              {question.choices?.map((choice) => (
                <label
                  key={choice.choiceId}
                  className="flex items-center space-x-2"
                >
                  <input
                    type="radio"
                    checked={answers[question.questionId] === choice.choiceId}
                    onChange={() =>
                      handleAnswerChange(question.questionId, choice.choiceId)
                    }
                  />
                  <span>{choice.text}</span>
                </label>
              ))}
            </div>
          )}
          {question.type === "openEnded" && (
            <textarea
              className="w-full p-2 border rounded"
              value={(answers[question.questionId] as string) || ""}
              onChange={(e) =>
                handleAnswerChange(question.questionId, e.target.value)
              }
            />
          )}
        </div>
      ))}
      <Button onClick={handleSubmit}>Submit Quiz</Button>
    </div>
  );
}
