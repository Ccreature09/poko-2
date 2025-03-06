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

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  usePWA();
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // Initialize isOnline as undefined to prevent hydration mismatch
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);
  const [offlineInit, setOfflineInit] = useState(false);

  useEffect(() => {
    // Check if we've shown the prompt in this session
    const hasShownPrompt = sessionStorage.getItem('pwa-prompt-shown');
    
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      console.log('Received beforeinstallprompt event', e);
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show banner if we haven't shown it in this session
      if (!hasShownPrompt) {
        console.log('Showing install banner');
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if the app is already installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA was installed');
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      sessionStorage.setItem('pwa-prompt-shown', 'true');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    console.log('Install button clicked', { deferredPrompt: !!deferredPrompt });
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      return;
    }

    try {
      console.log('Triggering install prompt');
      // Show the prompt
      const promptResult = await deferredPrompt.prompt();
      console.log('Prompt shown', { promptResult });
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      console.log('User choice result:', choiceResult);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        toast({
          title: "Благодаря!",
          description: "POKO беше успешно инсталиран на вашето устройство!",
        });
        // Don't show the banner again in this session
        sessionStorage.setItem('pwa-prompt-shown', 'true');
      } else {
        console.log('User dismissed the install prompt');
        toast({
          title: "Инсталацията е отхвърлена",
          description: "Можете да инсталирате POKO по-късно.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error during installation:', error);
      toast({
        title: "Грешка",
        description: "Възникна проблем при инсталирането на приложението.",
        variant: "destructive"
      });
    }

    // Clear the deferredPrompt after use
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
      
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary text-white p-4 flex justify-between items-center z-50">
          <div>
            <h3 className="font-bold">Инсталирайте POKO</h3>
            <p className="text-sm">Добавете нашето приложение към началния си екран за по-бърз достъп</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => {
                setShowInstallBanner(false);
                sessionStorage.setItem('pwa-prompt-shown', 'true');
              }} 
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
    </div>
  );
}