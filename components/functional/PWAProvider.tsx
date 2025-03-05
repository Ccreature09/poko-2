'use client';

import { useEffect, useState } from 'react';
import usePWA from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  // Initialize PWA functionality
  usePWA();
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    
    const choiceResult = await deferredPrompt.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      toast({
        title: "Благодаря!",
        description: "POKO беше успешно инсталиран на вашето устройство!",
      });
    } else {
      toast({
        title: "Инсталацията е отхвърлена",
        description: "Можете да инсталирате POKO по-късно.",
        variant: "destructive"
      });
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Онлайн",
        description: "Връзката с интернет е възстановена.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Офлайн",
        description: "Вие сте офлайн. Някои функции може да не работят.",
        variant: "destructive"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-destructive text-white p-2 text-center z-50">
          Вие сте офлайн. Някои функции може да не работят.
        </div>
      )}
      {children}
      
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary text-white p-4 flex justify-between items-center z-50">
          <div>
            <h3 className="font-bold">Инсталирайте POKO</h3>
            <p className="text-sm">Добавете нашето приложение към началния си екран за по-бърз достъп</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowInstallBanner(false)} 
            >
              По-късно
            </Button>
            <Button 
              onClick={handleInstallClick} 
            >
              Инсталирай
            </Button>
          </div>
        </div>
      )}
    </>
  );
}