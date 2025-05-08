/**
 * Offline Page Component
 *
 * Serves as the fallback UI when the user's device loses internet connection.
 * This page is triggered by the service worker when network requests fail
 * due to connectivity issues.
 *
 * Features:
 * - Clear visual indication of offline status
 * - Informative message about limited offline functionality
 * - Simple, lightweight design that loads quickly from cache
 * - Automatically redirects back to previous page when connection is restored
 *
 * This page is part of the app's Progressive Web App (PWA) implementation,
 * working in conjunction with the service worker to ensure graceful
 * degradation during network interruptions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Вие сте офлайн
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">
            За съжаление в момента нямате връзка с интернет. Моля, проверете
            връзката си и опитайте отново.
          </p>
          <p className="text-sm text-gray-500">
            Някои функции на POKO са достъпни офлайн, но за пълна функционалност
            е необходима интернет връзка.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
