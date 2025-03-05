'use client';

import { useEffect } from 'react';

export function usePWA() {
  useEffect(() => {
    // Check if service workers are supported
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      window.addEventListener('load', async () => {
        try {
          // Register the service worker
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered with scope:', registration.scope);
          
          // Check for updates to the service worker
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // At this point, the updated precached content has been fetched,
                    // but the previous service worker will still serve the older
                    // content until all client tabs are closed.
                    console.log('New content is available; please refresh.');
                  } else {
                    // At this point, everything has been precached.
                    console.log('Content is cached for offline use.');
                  }
                }
              };
            }
          };
          
          // Handle network connectivity status changes
          window.addEventListener('online', () => {
            console.log('Application is online.');
          });
          
          window.addEventListener('offline', () => {
            console.log('Application is offline.');
          });
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      });
    }
  }, []);

  return null;
}

export default usePWA;