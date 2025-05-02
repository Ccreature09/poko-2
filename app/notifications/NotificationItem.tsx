'use client';

import { Notification } from '@/lib/notificationManagement';
import { formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { cva } from 'class-variance-authority';
import ParentLinkRequestCard from '@/components/functional/ParentLinkRequestCard';
import { useState } from 'react';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onAction?: () => void; // New prop for handling after-action refreshes
}

// Define priority and read status variants with class-variance-authority
const notificationCardVariants = cva(
  "relative flex flex-col md:flex-row md:justify-between p-4 cursor-pointer transition-all", 
  {
    variants: {
      priority: {
        urgent: "border-l-4 border-red-500",
        high: "border-l-4 border-orange-500",
        medium: "border-l-4 border-blue-500",
        low: "border-l-4 border-gray-500",
      },
      read: {
        true: "bg-white dark:bg-gray-800",
        false: "bg-blue-50 dark:bg-gray-700 font-medium",
      }
    },
    defaultVariants: {
      priority: "low",
      read: false
    }
  }
);

export default function NotificationItem({ notification, onClick, onAction }: NotificationItemProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Format the time as "X days/hours/minutes ago"
  const timeAgo = formatRelativeTime(notification.createdAt);
  
  // Check if this is a parent link request notification
  const isParentLinkRequest = 
    notification.type === 'system-announcement' && 
    notification.metadata?.linkRequestId !== undefined && 
    typeof notification.metadata?.parentName === 'string';
  
  // Use the notification's color if provided, otherwise use a default based on category
  const getCategoryColor = () => {
    if (notification.color) return notification.color;
    
    const categoryColors: Record<string, string> = {
      assignments: '#4f46e5', // indigo
      quizzes: '#8b5cf6',     // violet
      grades: '#10b981',      // green
      attendance: '#f59e0b',  // amber
      feedback: '#ef4444',    // red
      system: '#6b7280',      // gray
      messages: '#0ea5e9',    // sky/blue
    };
    
    return categoryColors[notification.category] || '#6b7280';
  };

  // If this is a parent link request, show the specialized component when expanded
  if (isParentLinkRequest && expanded) {
    return (
      <ParentLinkRequestCard 
        notification={notification} 
        onActionComplete={() => {
          // Close the expanded view and refresh the notifications list
          setExpanded(false);
          if (onAction) onAction();
        }} 
      />
    );
  }

  const handleClick = () => {
    if (isParentLinkRequest) {
      setExpanded(!expanded);
    } else {
      onClick();
    }
  };

  return (
    <Card 
      className={notificationCardVariants({ 
        priority: notification.priority, 
        read: notification.read 
      })}
      onClick={handleClick}
      style={{ borderLeftColor: notification.color || getCategoryColor() }}
    >
      <div className="flex-1">
        <div className="flex items-start gap-3">
          {notification.icon && (
            <div className="text-2xl flex-shrink-0 mt-0.5">
              {typeof notification.icon === 'string'
                ? notification.icon
                : notification.icon}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">{notification.title}</h3>
            <p className="text-gray-600 dark:text-gray-300">{notification.message}</p>
            
           
            {isParentLinkRequest && !expanded && (
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                }}>
                  Виж детайли
                </Button>
              </div>
            )}
            
            {/* Action buttons if present */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex gap-2 mt-3">
                {notification.actions.map((action, index) => (
                  <Button 
                    key={index} 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Implement action handler here
                      if (action.url) {
                        window.open(action.url, '_blank');
                      }
                    }}
                  >
                    {action.icon && (
                      <span className="mr-1">
                        {typeof action.icon === 'string' ? action.icon : null}
                      </span>
                    )}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-2 md:mt-0 md:ml-4">
        <div className="text-sm text-gray-500">{timeAgo}</div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
      
      {!notification.read && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500" />
      )}
    </Card>
  );
}