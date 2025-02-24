"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Sidebar from "@/components/functional/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useCourses } from "@/contexts/CoursesContext";
import type { Course, Subchapter, Topic } from "@/lib/interfaces";

export default function CourseDetails() {
  const { courseId } = useParams();
  const { user } = useUser();
  const { courses } = useCourses();
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedSubchapter, setSelectedSubchapter] =
    useState<Subchapter | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [defaultAccordionValue, setDefaultAccordionValue] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    if (user?.schoolId) {
      const courseData = courses.find((course) => course.courseId === courseId);
      if (courseData) {
        setCourse(courseData);
        for (const chapter of courseData.chapters) {
          for (const subchapter of chapter.subchapters || []) {
            if (subchapter.topics.length > 0) {
              setSelectedSubchapter(subchapter);
              setSelectedTopic(subchapter.topics[0] || null);
              setDefaultAccordionValue(
                `chapter-${courseData.chapters.indexOf(chapter)}`
              );
              return;
            }
          }
        }
      }
    }
  }, [courseId, user?.schoolId, courses]);

  if (!course) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="w-1/4 p-4 bg-gray-100 border-r">
        <Accordion
          type="single"
          collapsible
          defaultValue={defaultAccordionValue || ""}
        >
          {course.chapters.map((chapter, index) => (
            <AccordionItem key={chapter.title} value={`chapter-${index}`}>
              <AccordionTrigger>{chapter.title}</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc list-inside">
                  {chapter.subchapters?.map((subchapter) => (
                    <li
                      key={subchapter.subchapterId}
                      className="mb-2 cursor-pointer"
                      onClick={() => {
                        setSelectedSubchapter(subchapter);
                        setSelectedTopic(subchapter.topics[0] || null);
                      }}
                    >
                      {subchapter.title}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <div className="flex-1 p-8 overflow-auto">
        {selectedSubchapter && selectedTopic ? (
          <div>
            <h2 className="text-2xl font-semibold mb-4">
              {selectedSubchapter.title}
            </h2>
            <h3 className="text-xl font-semibold mb-2">
              {selectedTopic.title}
            </h3>
            <p>{selectedTopic.content}</p>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold mb-8">{course.title}</h1>
            <p className="text-muted-foreground mb-4">{course.description}</p>
            <h2 className="text-2xl font-semibold mb-4">Chapters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {course.chapters.map((chapter, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{chapter.title + "sfg"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      {chapter.description}
                    </p>
                    <h3 className="text-xl font-semibold mb-2">Subchapters</h3>
                    <ul className="list-disc list-inside mb-4">
                      {chapter.subchapters?.map((subchapter) => (
                        <li
                          key={`${chapter.title}-${subchapter.subchapterId}`}
                          className="mb-2"
                        >
                          <h4 className="text-lg font-medium">
                            {subchapter.title}
                          </h4>
                          <ul className="list-disc list-inside ml-4">
                            {subchapter.topics?.map((topic, topicIndex) => (
                              <li key={`${subchapter.title}-${topicIndex}`}>
                                {topic.toString()}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
