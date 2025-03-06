'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  usePWA();
  
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // Initialize isOnline as undefined to prevent hydration mismatch
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);
  const [offlineInit, setOfflineInit] = useState(false);

  useEffect(() => {
    // Check if we've shown the prompt before
    const hasShownPrompt = localStorage.getItem('pwa-prompt-shown');
    
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show banner if we haven't shown it before and we're on the landing page
      if (!hasShownPrompt && pathname === '/') {
        setShowInstallBanner(true);
        // Mark that we've shown the prompt
        localStorage.setItem('pwa-prompt-shown', 'true');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, [pathname]);

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

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setOfflineInit(true);
    
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
    <div className="flex flex-col min-h-screen">
      {offlineInit && !isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-destructive text-white p-2 text-center z-50">
          Вие сте офлайн. Някои функции може да не работят.
        </div>
      )}
      {children}
      
      {showInstallBanner && pathname === '/' && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary text-white p-4 flex justify-between items-center z-50">
          <div>
            <h3 className="font-bold">Инсталирайте POKO</h3>
            <p className="text-sm">Добавете нашето приложение към началния си екран за по-бърз достъп</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => {
                setShowInstallBanner(false);
                localStorage.setItem('pwa-prompt-shown', 'true');
              }} 
              variant="outline"
            >
              По-късно
            </Button>
            <Button 
              onClick={handleInstallClick}
              variant="secondary"
            >
              Инсталирай
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}