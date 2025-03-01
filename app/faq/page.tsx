import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function FAQPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Често задавани въпроси</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Как да се регистрирам в системата?</h3>
            <p className="text-gray-600">
              Регистрацията в POKO става чрез вашето училище. Свържете се с училищния администратор, 
              който ще създаде вашия акаунт с училищния имейл.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Забравих си паролата, какво да правя?</h3>
            <p className="text-gray-600">
              Свържете се с училищния администратор, за да нулирате паролата си.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Как да променя личните си данни?</h3>
            <p className="text-gray-600">
              В горния десен ъгъл на екрана щракнете върху вашето име и изберете "Профил". 
              Там можете да редактирате личната си информация.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Какво да правя при технически проблем?</h3>
            <p className="text-gray-600">
              При технически проблеми можете да се свържете с нашия екип за поддръжка чрез 
              формата за контакт или на имейл support@poko.bg
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Как да проследя оценките си?</h3>
            <p className="text-gray-600">
              В менюто изберете "Оценки", където ще намерите пълна информация за вашите оценки, 
              домашни работи и тестове.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}