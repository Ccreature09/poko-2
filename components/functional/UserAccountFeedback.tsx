"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Copy, Eye, EyeOff } from "lucide-react";

interface UserAccountInfo {
  email: string;
  password: string;
  userId: string;
  role?: string;
}

interface FailedAccountInfo {
  email: string;
  error: string;
}

interface UserAccountFeedbackProps {
  successAccounts: UserAccountInfo[];
  failedAccounts?: FailedAccountInfo[];
  onClose?: () => void;
}

export function UserAccountFeedback({
  successAccounts,
  failedAccounts = [],
  onClose,
}: UserAccountFeedbackProps) {
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );
  const [copiedUsers, setCopiedUsers] = useState<Record<string, boolean>>({});

  const totalAccounts = successAccounts.length + failedAccounts.length;
  const successRate =
    totalAccounts > 0
      ? Math.round((successAccounts.length / totalAccounts) * 100)
      : 0;

  const togglePasswordVisibility = (email: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [email]: !prev[email],
    }));
  };

  const copyToClipboard = (email: string, password: string) => {
    navigator.clipboard.writeText(`Имейл: ${email}\nПарола: ${password}`);
    setCopiedUsers((prev) => ({ ...prev, [email]: true }));

    // Reset the copied status after 2 seconds
    setTimeout(() => {
      setCopiedUsers((prev) => ({ ...prev, [email]: false }));
    }, 2000);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Резултати от Firebase удостоверяване</span>
          <Badge
            variant={successRate > 80 ? "default" : "destructive"}
            className="ml-2 text-white"
          >
            {successRate}% Успех
          </Badge>
        </CardTitle>
        <CardDescription>
          Създадени {successAccounts.length} от {totalAccounts} потребителски
          акаунта във Firebase Authentication
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {successAccounts.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="success-accounts">
              <AccordionTrigger className="text-green-600">
                <div className="flex items-center">
                  <Check className="mr-2 h-4 w-4" />
                  <span>
                    Успешно създадени акаунти ({successAccounts.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 max-h-60 overflow-y-auto p-1">
                  {successAccounts.map((account) => (
                    <div
                      key={account.userId}
                      className="p-3 border rounded-lg text-sm bg-slate-50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{account.email}</p>
                          <div className="flex items-center mt-1">
                            <span className="text-slate-500 mr-2">Парола:</span>
                            <code className="bg-slate-100 px-2 py-0.5 rounded">
                              {showPasswords[account.email]
                                ? account.password
                                : "••••••••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-1"
                              onClick={() =>
                                togglePasswordVisibility(account.email)
                              }
                            >
                              {showPasswords[account.email] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          {account.role && (
                            <Badge variant="outline" className="mt-1">
                              {account.role}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={() =>
                            copyToClipboard(account.email, account.password)
                          }
                        >
                          {copiedUsers[account.email] ? (
                            <span className="text-green-600 text-xs flex items-center">
                              <Check className="h-3 w-3 mr-1" /> Копирано
                            </span>
                          ) : (
                            <span className="text-xs flex items-center">
                              <Copy className="h-3 w-3 mr-1" /> Копирай
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {failedAccounts.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="failed-accounts">
              <AccordionTrigger className="text-red-600">
                <div className="flex items-center">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  <span>
                    Неуспешни създавания на акаунти ({failedAccounts.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 max-h-60 overflow-y-auto p-1">
                  {failedAccounts.map((account, index) => (
                    <Alert
                      variant="destructive"
                      key={`${account.email}-${index}`}
                    >
                      <AlertTitle>{account.email}</AlertTitle>
                      <AlertDescription>{account.error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>

      {onClose && (
        <CardFooter className="flex justify-end">
          <Button className="text-white" onClick={onClose}>
            Затвори
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
