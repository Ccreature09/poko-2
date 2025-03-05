// Компонент за долната част на страницата (footer) - съдържа навигация, правна информация и контакти
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-100 mt-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:justify-between">
          {/* Логото и кратко описание на приложението */}
          <div className="mb-6 md:mb-0">
            <Link href="/" className="text-2xl font-bold text-primary">
              POKO
            </Link>
            <p className="mt-2 text-sm text-gray-600">
              Подобряване на образованието чрез технологии
            </p>
          </div>
          {/* Секции с връзки за навигация към различни страници */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {/* Секция за ресурси */}
            <div>
              <h3 className="mb-6 text-sm font-semibold text-gray-900 uppercase">
                Ресурси
              </h3>
              <ul className="text-gray-600">
                <li className="mb-4">
                  <Link href="/about" className="hover:underline">
                    За нас
                  </Link>
                </li>
                <li className="mb-4">
                  <Link href="/faq" className="hover:underline">
                    Често задавани въпроси
                  </Link>
                </li>
              </ul>
            </div>
            {/* Секция за правна информация */}
            <div>
              <h3 className="mb-6 text-sm font-semibold text-gray-900 uppercase">
                Правни
              </h3>
              <ul className="text-gray-600">
                <li className="mb-4">
                  <Link href="/privacy" className="hover:underline">
                    Политика за поверителност
                  </Link>
                </li>
                <li className="mb-4">
                  <Link href="/terms" className="hover:underline">
                    Условия за ползване
                  </Link>
                </li>
              </ul>
            </div>
            {/* Секция за контакти */}
            <div>
              <h3 className="mb-6 text-sm font-semibold text-gray-900 uppercase">
                Контакт
              </h3>
              <ul className="text-gray-600">
                <li className="mb-4">
                  <Link href="/contact" className="hover:underline">
                    Свържете се с нас
                  </Link>
                </li>
                <li className="mb-4">
                  <Link href="/support" className="hover:underline">
                    Поддръжка
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        {/* Линия за разделяне */}
        <hr className="my-6 border-gray-200 sm:mx-auto" />
        {/* Информация за авторско право и социални медии */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <span className="text-sm text-gray-500 sm:text-center">
            © {new Date().getFullYear()} POKO School Administration. Всички права запазени.
          </span>
         
        </div>
      </div>
    </footer>
  );
}
