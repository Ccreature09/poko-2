"use client";

import { useState, useEffect } from 'react';
import { useMessaging } from '@/contexts/MessagingContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, HomeroomClass } from '@/lib/interfaces';

interface ComposeMessageProps {
  onCloseAction: () => void;
  isAnnouncement?: boolean;
}

export const ComposeMessage = ({ onCloseAction, isAnnouncement = false }: ComposeMessageProps) => {
  const { user } = useUser();
  const { 
    createConversation, 
    sendMessage, 
    fetchUsersByRole, 
    fetchClasses,
    sendAnnouncement,
    sendClassMessage,
    permissions
  } = useMessaging();
  
  const [isOpen, setIsOpen] = useState(true);
  const [messageType, setMessageType] = useState<'individual' | 'class' | 'announcement'>(
    isAnnouncement ? 'announcement' : 'individual'
  );
  const [content, setContent] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableClasses, setAvailableClasses] = useState<HomeroomClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch available users and classes on component mount
  useEffect(() => {
    const loadRecipientOptions = async () => {
      setLoading(true);
      try {
        // Load users based on current user role
        let users: User[] = [];
        
        if (user?.role === 'admin') {
          // Admins can message anyone
          const teachers = await fetchUsersByRole('teacher');
          const students = await fetchUsersByRole('student');
          const admins = await fetchUsersByRole('admin').then(
            admins => admins.filter(a => a.id !== user.userId)
          );
          users = [...teachers, ...students, ...admins];
        } else if (user?.role === 'teacher') {
          // Teachers can message students, other teachers, and admins
          const teachers = await fetchUsersByRole('teacher').then(
            teachers => teachers.filter(t => t.id !== user.userId)
          );
          const students = await fetchUsersByRole('student');
          const admins = await fetchUsersByRole('admin');
          users = [...teachers, ...students, ...admins];
        } else if (user?.role === 'student') {
          // Students can only message teachers and admins
          const teachers = await fetchUsersByRole('teacher');
          const admins = await fetchUsersByRole('admin');
          users = [...teachers, ...admins];
        }
        
        setAvailableUsers(users);
        
        // Load classes if user is teacher or admin
        if (user?.role === 'teacher' || user?.role === 'admin') {
          const classes = await fetchClasses();
          setAvailableClasses(classes);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      loadRecipientOptions();
    }
  }, [user, fetchUsersByRole, fetchClasses]);

  const handleClose = () => {
    setIsOpen(false);
    onCloseAction();
  };

  const handleSend = async () => {
    if (!content.trim()) return;
    
    setSending(true);
    try {
      let success = false;
      
      switch (messageType) {
        case 'individual':
          if (selectedUsers.length > 0) {
            const conversationId = await createConversation(
              selectedUsers,
              selectedUsers.length > 1,
              selectedUsers.length > 1 ? 'Групов разговор' : undefined
            );
            
            if (conversationId) {
              success = await sendMessage(conversationId, content);
            }
          }
          break;
          
        case 'class':
          if (selectedClass) {
            success = await sendClassMessage(selectedClass, content);
          }
          break;
          
        case 'announcement':
          if (selectedRoles.length > 0) {
            success = await sendAnnouncement(content, selectedRoles);
          }
          break;
      }
      
      if (success) {
        handleClose();
      }
    } finally {
      setSending(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleRoleSelection = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  // Organize users by role for better display
  const usersByRole = availableUsers.reduce((acc, user) => {
    if (!acc[user.role]) {
      acc[user.role] = [];
    }
    acc[user.role].push(user);
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {messageType === 'announcement' 
              ? 'Ново обявление' 
              : messageType === 'class'
                ? 'Съобщение до клас'
                : 'Ново съобщение'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Message type selection */}
        <div className="space-y-4">
          {permissions.canSendAnnouncement && (
            <div className="flex gap-2">
              <Button 
                variant={messageType === 'individual' ? 'default' : 'outline'} 
                onClick={() => setMessageType('individual')}
              >
                Индивидуално съобщение
              </Button>
              
              {permissions.canSendToClass && (
                <Button 
                  variant={messageType === 'class' ? 'default' : 'outline'} 
                  onClick={() => setMessageType('class')}
                >
                  Съобщение до клас
                </Button>
              )}
              
              <Button 
                variant={messageType === 'announcement' ? 'default' : 'outline'} 
                onClick={() => setMessageType('announcement')}
              >
                Обявление
              </Button>
            </div>
          )}
          
          {/* Recipients selection */}
          {messageType === 'individual' && (
            <div className="space-y-2">
              <Label>Получатели</Label>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {loading ? (
                  <div className="p-4 text-center">Зареждане на потребители...</div>
                ) : (
                  Object.entries(usersByRole).map(([role, users]) => (
                    <div key={role} className="mb-4">
                      <h4 className="font-medium capitalize mb-2">
                        {role === 'teacher' ? 'Учители' : role === 'student' ? 'Ученици' : 'Администратори'}
                      </h4>
                      <div className="space-y-2">
                        {users.map(user => (
                          <div key={user.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={user.id} 
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                            <Label htmlFor={user.id} className="cursor-pointer">
                              {user.firstName} {user.lastName}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          )}
          
          {messageType === 'class' && (
            <div className="space-y-2">
              <Label>Изберете клас</Label>
              <Select 
                value={selectedClass} 
                onValueChange={setSelectedClass}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете клас" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map(cls => (
                    <SelectItem key={cls.classId} value={cls.classId}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {messageType === 'announcement' && (
            <div className="space-y-2">
              <Label>Групи получатели</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="teachers"
                    checked={selectedRoles.includes('teacher')}
                    onCheckedChange={() => toggleRoleSelection('teacher')}
                  />
                  <Label htmlFor="teachers">Учители</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="students"
                    checked={selectedRoles.includes('student')}
                    onCheckedChange={() => toggleRoleSelection('student')}
                  />
                  <Label htmlFor="students">Ученици</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="admins"
                    checked={selectedRoles.includes('admin')}
                    onCheckedChange={() => toggleRoleSelection('admin')}
                  />
                  <Label htmlFor="admins">Администратори</Label>
                </div>
              </div>
            </div>
          )}
          
          {/* Message content */}
          <div className="space-y-2">
            <Label>Съобщение</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Въведете вашето съобщение тук..."
              className="min-h-[150px]"
              disabled={sending}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Отказ</Button>
          <Button 
            onClick={handleSend} 
            disabled={
              sending || 
              !content.trim() || 
              (messageType === 'individual' && selectedUsers.length === 0) ||
              (messageType === 'class' && !selectedClass) ||
              (messageType === 'announcement' && selectedRoles.length === 0)
            }
          >
            {sending ? 'Изпращане...' : 'Изпрати'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};