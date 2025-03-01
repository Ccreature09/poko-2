import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">За нас</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p className="text-lg mb-6">
            Добре дошли в POKO - модерната платформа за управление на образователния процес, 
            създадена за да служи на нуждите на съвременното българско образование.
          </p>
          
          <h3 className="text-xl font-semibold mt-6">Нашата история</h3>
          <p>
            POKO е основана през 2023 година от екип от учители и софтуерни специалисти, 
            обединени от обща цел - да модернизират образователния процес и да създадат 
            достъпно и интуитивно решение за комуникация между учители, ученици и родители.
          </p>
          
          <h3 className="text-xl font-semibold mt-6">Нашата мисия</h3>
          <p>
            Мисията на POKO е да трансформира образователния процес чрез технологии, които 
            правят комуникацията по-лесна, оценяването по-прозрачно и предоставят богат набор 
            от образователни инструменти на учителите.
          </p>
          
          <h3 className="text-xl font-semibold mt-6">Нашите ценности</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Достъпност - създаваме продукти, достъпни за всяко училище</li>
            <li>Иновация - постоянно развиваме нашите технологии</li>
            <li>Сигурност - данните на потребителите са наш основен приоритет</li>
            <li>Общност - изграждаме мост между всички участници в образователния процес</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}