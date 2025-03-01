import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Свържете се с нас</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-600 text-center">
            Имате въпроси или предложения? Ние сме тук да помогнем!
          </p>

          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Офис адрес</h3>
              <p className="text-gray-600">
                ул. &quot;Цар Борис III&quot; 124<br />
                София 1612<br />
                България
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Контакти</h3>
              <div className="space-y-2">
                <p className="text-gray-600">
                  <strong>Телефон:</strong><br />
                  +359 89 541 6182
                </p>
                <p className="text-gray-600">
                  <strong>Имейл:</strong><br />
                  office@poko.bg
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Работно време</h3>
              <p className="text-gray-600">
                Понеделник - Петък<br />
                9:00 - 18:00
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">За спешни случаи</h3>
              <p className="text-gray-600">
                При спешни технически проблеми:<br />
                support@poko.bg<br />
                +359 89 541 6182
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}