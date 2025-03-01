"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Sidebar from "@/components/functional/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useCourses } from "@/contexts/CoursesContext";
import type { Course, Subchapter, Topic } from "@/lib/interfaces";
import { BookOpen, Clock, ArrowLeft, BookOpenText, FileText } from "lucide-react";
import Link from "next/link";

export default function CourseDetails() {
  const { courseId } = useParams();
  const { user } = useUser();
  const { courses } = useCourses();
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedSubchapter, setSelectedSubchapter] = useState<Subchapter | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [defaultAccordionValue, setDefaultAccordionValue] = useState<string | undefined>(undefined);

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
              setDefaultAccordionValue(`chapter-${courseData.chapters.indexOf(chapter)}`);
              return;
            }
          }
        }
      }
    }
  }, [courseId, user?.schoolId, courses]);

  if (!course) {
    return (
      <div className="flex min-h-screen">
        <Sidebar className="hidden lg:block" />
        <div className="flex-1 pt-16 lg:pt-4 px-4 lg:px-8 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground animate-pulse" />
            <h2 className="text-xl font-semibold mt-4">Loading course...</h2>
          </div>
        </div>
      </div>
    );
  }

  // Determine a consistent color for the course - for real app, this could be stored in the course data
  const courseColor = "bg-blue-100 border-blue-300 text-blue-700";

  return (
    <div className="flex min-h-screen">
      <Sidebar className="hidden lg:block" />
      
      <div className="flex-1 pt-16 lg:pt-4">
        <div className="max-w-7xl mx-auto">
          {/* Course header */}
          <div className="border-b pb-4 px-4 lg:px-8">
            <div className="mb-2">
              <Link href="/courses">
                <Button variant="ghost" size="sm" className="pl-0 text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Обратно към всички курсове
                </Button>
              </Link>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{course.title}</h1>
                <p className="text-muted-foreground mt-1">{course.description}</p>
              </div>
              
              <div className="flex items-center gap-3">
                
                <span className="text-sm text-muted-foreground">
                  {Array.isArray(course.classIds) 
                  ? course.classIds.join(', ') + ' клас'
                  : (course.classIds || "9") + ' клас'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Chapter/Subchapter navigation */}
            <div className="w-full lg:w-1/4 border-r">
              <div className="p-4 bg-muted/10">
                <h3 className="font-medium mb-2 flex items-center">
                  <BookOpenText className="h-4 w-4 mr-2" />
                  Съдържание на курса
                </h3>
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={defaultAccordionValue || ""}
                  className="w-full"
                >
                  {course.chapters.map((chapter, index) => (
                    <AccordionItem key={chapter.title} value={`chapter-${index}`} className="border-b-0">
                      <AccordionTrigger className="py-2 px-2 hover:bg-muted/20 rounded-md text-sm">
                        {chapter.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="pl-4">
                          {chapter.subchapters?.map((subchapter) => (
                            <li
                              key={subchapter.subchapterId}
                              className={`py-2 px-2 rounded-md cursor-pointer transition-colors text-sm hover:bg-muted/20 ${
                                selectedSubchapter?.subchapterId === subchapter.subchapterId
                                  ? "bg-primary/10 text-primary font-medium"
                                  : ""
                              }`}
                              onClick={() => {
                                setSelectedSubchapter(subchapter);
                                setSelectedTopic(subchapter.topics[0] || null);
                              }}
                            >
                              <div className="flex items-center">
                                <FileText className="h-3.5 w-3.5 mr-2 flex-shrink-0" />
                                <span className="truncate">{subchapter.title}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 p-4 lg:p-8 overflow-auto">
              {selectedSubchapter && selectedTopic ? (
                <div className="max-w-3xl">
                  <Card>
                    <CardHeader className="border-b bg-muted/10">
                      <Badge className="mb-2 w-fit">{selectedSubchapter.title}</Badge>
                      <CardTitle>{selectedTopic.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="prose prose-stone max-w-none">
                        <p>{selectedTopic.content}</p>
                      </div>
                    </CardContent>
                   
                  </Card>
                </div>
              ) : (
                <div>
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-2">За този курс</h2>
                    <p className="text-muted-foreground">{course.description}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-medium">Глави</span>
                        </div>
                        <p className="text-2xl font-semibold">{course.chapters.length}</p>
                      </div>
                      
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium">Подглави</span>
                        </div>
                        <p className="text-2xl font-semibold">
                          {course.chapters.reduce((count, chapter) => count + (chapter.subchapters?.length || 0), 0)}
                        </p>
                      </div>
                      
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="font-medium">Прогрес</span>
                        </div>
                        <p className="text-2xl font-semibold">33%</p>
                      </div>
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-semibold mb-4">Съдържание на курса</h2>
                  <div className="space-y-6">
                    {course.chapters.map((chapter, index) => (
                      <Card key={index}>
                        <CardHeader className="bg-muted/5 border-b">
                          <CardTitle className="text-lg">{chapter.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <p className="text-muted-foreground mb-4">{chapter.description}</p>
                          
                          {(chapter.subchapters?.length ?? 0) > 0 && (
                            <div className="space-y-4">
                              {chapter.subchapters?.map((subchapter) => (
                                <div key={`${chapter.title}-${subchapter.subchapterId}`} className="pl-4 border-l">
                                  <h4 className="text-base font-medium mb-2">{subchapter.title}</h4>
                                  {subchapter.topics?.length > 0 && (
                                    <ul className="space-y-1">
                                      {subchapter.topics.map((topic, topicIndex) => (
                                        <li 
                                          key={`${subchapter.title}-${topicIndex}`}
                                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary cursor-pointer pl-4"
                                          onClick={() => {
                                            setSelectedSubchapter(subchapter);
                                            setSelectedTopic(topic);
                                          }}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></span>
                                          {topic.title}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
