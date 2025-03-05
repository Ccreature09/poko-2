import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Вие сте офлайн</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">
            За съжаление в момента нямате връзка с интернет. Моля, проверете връзката си и опитайте отново.
          </p>
          <p className="text-sm text-gray-500">
            Някои функции на POKO са достъпни офлайн, но за пълна функционалност е необходима интернет връзка.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}