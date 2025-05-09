"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Lock, Shield, AlertTriangle } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface SecurityLevelBadgeProps {
  level: string;
  showTooltip?: boolean;
}

const SecurityLevelBadge = ({
  level,
  showTooltip = true,
}: SecurityLevelBadgeProps) => {
  const getSecurityBadge = (level: string) => {
    switch (level) {
      case "extreme":
        return (
          <Badge variant="destructive">
            <Lock className="h-3 w-3 mr-1" /> Екстремна
          </Badge>
        );
      case "high":
        return (
          <Badge variant="default">
            <Shield className="h-3 w-3 mr-1" /> Висока
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 mr-1" /> Средна
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Shield className="h-3 w-3 mr-1" /> Ниска
          </Badge>
        );
    }
  };

  const getSecurityDescription = (level: string) => {
    switch (level) {
      case "extreme":
        return {
          title: "Екстремно ниво на сигурност",
          description:
            "Максимална защита: незабавно отчита смяна на прозореца, блокира копиране на съдържание, автоматично предава след 3 нарушения, позволява наблюдение в реално време, записва всички действия.",
        };
      case "high":
        return {
          title: "Високо ниво на сигурност",
          description:
            "Строг контрол: отчита смяна на прозореца, забранява копиране на съдържание, автоматично предава след 4 нарушения, позволява наблюдение в реално време.",
        };
      case "medium":
        return {
          title: "Средно ниво на сигурност",
          description:
            "Балансирана защита: предупреждава при смяна на раздели, ограничава някои действия, записва подозрителни действия, без автоматично предаване.",
        };
      default:
        return {
          title: "Ниско ниво на сигурност",
          description:
            "Основна защита: без ограничения, подходящ за домашни и практика, лесно използване от ученици.",
        };
    }
  };

  if (!showTooltip) {
    return getSecurityBadge(level);
  }

  const securityInfo = getSecurityDescription(level);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{getSecurityBadge(level)}</HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div>
          <h4 className="font-semibold mb-1">{securityInfo.title}</h4>
          <p className="text-sm text-muted-foreground">
            {securityInfo.description}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default SecurityLevelBadge;
