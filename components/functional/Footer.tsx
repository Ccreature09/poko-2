import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-100 mt-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:justify-between">
          <div className="mb-6 md:mb-0">
            <Link href="/" className="text-2xl font-bold text-primary">
              POKO
            </Link>
            <p className="mt-2 text-sm text-gray-600">
              Подобряване на образованието чрез технологии
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
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
        <hr className="my-6 border-gray-200 sm:mx-auto" />
        <div className="sm:flex sm:items-center sm:justify-between">
          <span className="text-sm text-gray-500 sm:text-center">
            © {new Date().getFullYear()} POKO School Administration. Всички права запазени.
          </span>
          <div className="flex mt-4 space-x-6 sm:justify-center sm:mt-0">
            {/* Add social media icons here if needed */}
          </div>
        </div>
      </div>
    </footer>
  );
}
