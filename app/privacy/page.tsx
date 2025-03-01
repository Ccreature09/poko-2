import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Политика за поверителност</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">
            Последна актуализация: {new Date().toLocaleDateString('bg-BG')}
          </p>

          <div>
            <h3 className="text-xl font-semibold mb-3">1. Събиране на информация</h3>
            <p className="text-gray-600">
              POKO събира следните видове лична информация:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-600">
              <li>Име и фамилия</li>
              <li>Имейл адрес</li>
              <li>Училищна информация</li>
              <li>Данни за успеваемост</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">2. Използване на информацията</h3>
            <p className="text-gray-600">
              Събраната информация се използва за:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-600">
              <li>Предоставяне на образователни услуги</li>
              <li>Подобряване на платформата</li>
              <li>Комуникация с потребителите</li>
              <li>Анализ на успеваемостта</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">3. Защита на данните</h3>
            <p className="text-gray-600">
              POKO използва съвременни технологии за защита на личните данни, включително:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-600">
              <li>Криптиране на данните</li>
              <li>Защитени сървъри</li>
              <li>Редовни проверки за сигурност</li>
              <li>Ограничен достъп до лична информация</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">4. Вашите права</h3>
            <p className="text-gray-600">
              Имате право да:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-600">
              <li>Поискате достъп до вашите данни</li>
              <li>Коригирате неточна информация</li>
              <li>Поискате изтриване на данните</li>
              <li>Оттеглите съгласието си за обработка</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}