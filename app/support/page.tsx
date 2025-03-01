import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Поддръжка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-600 text-center">
            Нашият екип за поддръжка е на ваше разположение
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Видове поддръжка</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Техническа поддръжка</h4>
                  <p className="text-gray-600">
                    За проблеми с платформата, грешки или технически въпроси.<br />
                    support@poko.bg
                  </p>
                </div>
                
                <div className="border p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Административна поддръжка</h4>
                  <p className="text-gray-600">
                    За въпроси свързани с акаунти, права за достъп и училищна администрация.<br />
                    admin@poko.bg
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Работно време на поддръжката</h3>
              <div className="space-y-2 text-gray-600">
                <p><strong>Понеделник - Петък:</strong> 8:00 - 20:00</p>
                <p><strong>Събота:</strong> 9:00 - 15:00</p>
                <p><strong>Неделя:</strong> Затворено</p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Често срещани проблеми</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Проблеми с влизането</h4>
                  <p className="text-gray-600">
                    Проверете дали имейлът и паролата са въведени правилно. 
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Технически проблеми</h4>
                  <p className="text-gray-600">
                    Изчистете кеша на браузъра и опитайте да презаредите страницата. Ако 
                    проблемът продължава, свържете се с нашия екип.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Спешни случаи</h3>
              <p className="text-gray-600">
                За спешни технически проблеми извън работно време, моля обадете се на:<br />
                <strong>+359 89 541 6182</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}