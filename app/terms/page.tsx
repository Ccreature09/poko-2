import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Условия за ползване</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">
            Последна актуализация: {new Date().toLocaleDateString('bg-BG')}
          </p>

          <div>
            <h3 className="text-xl font-semibold mb-3">1. Общи условия</h3>
            <p className="text-gray-600">
              С използването на POKO, вие се съгласявате с настоящите условия за ползване. 
              Платформата е предназначена за образователни цели и трябва да се използва в 
              съответствие с българското законодателство.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">2. Регистрация и акаунти</h3>
            <p className="text-gray-600">
              Потребителите са длъжни да:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-600">
              <li>Предоставят точна и актуална информация</li>
              <li>Пазят поверителността на своите данни за достъп</li>
              <li>Не споделят акаунти с други потребители</li>
              <li>Уведомяват незабавно при нарушения на сигурността</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">3. Интелектуална собственост</h3>
            <p className="text-gray-600">
              Цялото съдържание в платформата POKO, включително текстове, изображения, 
              логота и софтуер, е защитено от авторски права. Забранено е копирането, 
              разпространението или модифицирането без изрично разрешение.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">4. Поведение на потребителите</h3>
            <p className="text-gray-600">
              Потребителите се задължават да:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-gray-600">
              <li>Спазват етични норми при комуникация</li>
              <li>Не публикуват неподходящо съдържание</li>
              <li>Не нарушават правата на други потребители</li>
              <li>Не използват платформата за злонамерени цели</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3">5. Прекратяване на достъпа</h3>
            <p className="text-gray-600">
              POKO си запазва правото да прекрати или ограничи достъпа на потребители, 
              които нарушават настоящите условия за ползване или действат по начин, 
              който застрашава сигурността на платформата.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}