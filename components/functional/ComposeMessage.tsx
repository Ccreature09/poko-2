/**
 * Компонент за съставяне на съобщения
 * 
 * Този компонент предоставя интерфейс за изпращане на различни видове съобщения:
 * - Индивидуални съобщения до един или повече потребители
 * - Съобщения до цял клас
 * - Обявления до определени групи потребители (учители/ученици/администратори)
 * 
 * Функционалности:
 * - Избор на тип съобщение
 * - Избор на получатели според ролята на текущия потребител
 * - Съставяне и изпращане на съобщението
 * - Различни права за достъп според ролята на потребителя
 */

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
import { useToast } from '@/hooks/use-toast';

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
  
  const { toast } = useToast();
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
        } else if (user?.role === 'parent') {
          // Parents can only message teachers and admins
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
        toast({
          title: "Успешно",
          description: "Съобщението е изпратено",
        });
        handleClose();
      } else {
        toast({
          title: "Грешка",
          description: "Съобщението не беше изпратено. Моля, опитайте отново.",
          variant: "destructive"
        });
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

  // Get user initials for avatar display
  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) onCloseAction();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {messageType === 'announcement' 
              ? '📢 Ново обявление' 
              : messageType === 'class'
                ? '👨‍👩‍👧‍👦 Съобщение до клас'
                : '✉️ Ново съобщение'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Message type selection */}
        <div className="space-y-6">
          {permissions.canSendAnnouncement && (
            <div className="flex gap-2 justify-center mb-4">
              <Button 
                variant={messageType === 'individual' ? 'default' : 'outline'} 
                onClick={() => setMessageType('individual')}
                className="px-4 py-2 rounded-full"
              >
                ✉️ Индивидуално съобщение
              </Button>
              
              {permissions.canSendToClass && (
                <Button 
                  variant={messageType === 'class' ? 'default' : 'outline'} 
                  onClick={() => setMessageType('class')}
                  className="px-4 py-2 rounded-full"
                >
                  👨‍👩‍👧‍👦 Съобщение до клас
                </Button>
              )}
              
              <Button 
                variant={messageType === 'announcement' ? 'default' : 'outline'} 
                onClick={() => setMessageType('announcement')}
                className="px-4 py-2 rounded-full"
              >
                📢 Обявление
              </Button>
            </div>
          )}
          
          {/* Recipients selection */}
          {messageType === 'individual' && (
            <div className="space-y-2">
              <Label className="text-base font-medium mb-2 block">Получатели</Label>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-50 rounded-md border border-gray-200">
                  {selectedUsers.map(userId => {
                    const selectedUser = availableUsers.find(u => u.id === userId);
                    if (!selectedUser) return null;
                    
                    return (
                      <div key={userId} className="flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                        <span className="mr-1">{selectedUser.firstName} {selectedUser.lastName}</span>
                        <button 
                          onClick={() => toggleUserSelection(userId)}
                          className="text-blue-500 hover:text-blue-700 ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <ScrollArea className="h-[250px] border rounded-md p-2 bg-white">
                {loading ? (
                  <div className="p-4 text-center">Зареждане на потребители...</div>
                ) : (
                  Object.entries(usersByRole).map(([role, users]) => (
                    <div key={role} className="mb-4">
                      <h4 className="font-semibold capitalize mb-2 px-2 py-1 bg-gray-100 rounded">
                        {role === 'teacher' ? '👨‍🏫 Учители' : role === 'student' ? '👨‍🎓 Ученици' : '👑 Администратори'}
                      </h4>
                      <div className="grid grid-cols-2 gap-1">
                        {users.map(user => (
                          <div 
                            key={user.id} 
                            className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-gray-50 ${
                              selectedUsers.includes(user.id) ? 'bg-blue-50 border border-blue-200' : ''
                            }`}
                            onClick={() => toggleUserSelection(user.id)}
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-xs">
                              {getUserInitials(user.firstName, user.lastName)}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="truncate font-medium">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-gray-500 capitalize">{user.role}</div>
                            </div>
                            {selectedUsers.includes(user.id) && (
                              <div className="text-blue-600">✓</div>
                            )}
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
              <Label className="text-base font-medium mb-2 block">Изберете клас</Label>
              <Select 
                value={selectedClass} 
                onValueChange={setSelectedClass}
              >
                <SelectTrigger className="h-12 text-base">
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
            <div className="space-y-4">
              <Label className="text-base font-medium mb-2 block">Групи получатели</Label>
              <div className="grid grid-cols-3 gap-4">
                <div 
                  className={`flex flex-col items-center space-y-2 p-4 rounded-lg border-2 cursor-pointer ${
                    selectedRoles.includes('teacher') 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleRoleSelection('teacher')}
                >
                  <div className="text-3xl">👨‍🏫</div>
                  <Label className="cursor-pointer font-medium">Учители</Label>
                  {selectedRoles.includes('teacher') && (
                    <div className="text-blue-600 text-sm font-semibold">✓ Избрано</div>
                  )}
                </div>
                
                <div 
                  className={`flex flex-col items-center space-y-2 p-4 rounded-lg border-2 cursor-pointer ${
                    selectedRoles.includes('student') 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleRoleSelection('student')}
                >
                  <div className="text-3xl">👨‍🎓</div>
                  <Label className="cursor-pointer font-medium">Ученици</Label>
                  {selectedRoles.includes('student') && (
                    <div className="text-blue-600 text-sm font-semibold">✓ Избрано</div>
                  )}
                </div>
                
                <div 
                  className={`flex flex-col items-center space-y-2 p-4 rounded-lg border-2 cursor-pointer ${
                    selectedRoles.includes('admin') 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleRoleSelection('admin')}
                >
                  <div className="text-3xl">👑</div>
                  <Label className="cursor-pointer font-medium">Администратори</Label>
                  {selectedRoles.includes('admin') && (
                    <div className="text-blue-600 text-sm font-semibold">✓ Избрано</div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Message content */}
          <div className="space-y-2">
            <Label className="text-base font-medium mb-2 block">Съобщение</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Въведете вашето съобщение тук..."
              className="min-h-[150px] text-base"
              disabled={sending}
            />
            <div className="text-xs text-gray-500 text-right">
              {content.length} символа
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between items-center mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={sending}>Отказ</Button>
          <Button 
            onClick={handleSend} 
            disabled={
              sending || 
              !content.trim() || 
              (messageType === 'individual' && selectedUsers.length === 0) ||
              (messageType === 'class' && !selectedClass) ||
              (messageType === 'announcement' && selectedRoles.length === 0)
            }
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            {sending ? 'Изпращане...' : 'Изпрати съобщението'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};