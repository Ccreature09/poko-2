"use client";

// Контекст за управление на потребителската аутентикация и данни
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getDocs, query, collection, where, collectionGroup } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Admin, Student, Teacher, UserBase } from "@/lib/interfaces";

// Дефиниция на типа данни за потребителския контекст
type UserContextType = {
  user: (UserBase & { schoolId: string }) | null; // Информация за потребителя и към кое училище принадлежи
  loading: boolean; // Флаг за индикиране на зареждане
  error: string | null; // Съобщение за грешка, ако има такава
};

// Създаване на контекста с начални стойности
const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  error: null
});

// Hook за лесен достъп до потребителския контекст от компонентите
export const useUser = () => useContext(UserContext);

// Провайдър компонент, който обвива приложението и предоставя потребителските данни
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  // Състояние за съхранение на информацията за потребителя
  const [user, setUser] = useState<(UserBase & { schoolId: string }) | null>(null);
  // Състояние показващо дали данните се зареждат в момента
  const [loading, setLoading] = useState(true);
  // Състояние за съхранение на грешки при автентикация или зареждане на данни
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Абонамент за промени в състоянието на аутентикацията в Firebase
    // Това се изпълнява при всяка промяна в статуса на аутентикацията (вход/изход)
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Използване на collectionGroup за заявка във всички подколекции "users" наведнъж
          // Това позволява търсене на потребител във всички училища едновременно
          const usersQuery = query(
            collectionGroup(db, "users"),
            where("userId", "==", firebaseUser.uid)
          );
          
          // Изпълняване на заявката към базата данни
          const userSnapshot = await getDocs(usersQuery);
          
          if (!userSnapshot.empty) {
            // Вземане на първия съвпадащ потребителски документ
            const userDoc = userSnapshot.docs[0];
            // Извличане на данните от документа и типизирането им според интерфейса
            const userData = userDoc.data() as Admin | Teacher | Student;
            
            // Извличане на schoolId от пътя на документа
            // Форматът е: schools/{schoolId}/users/{userId}
            const schoolId = userDoc.ref.path.split('/')[1];
            
            // Обновяване на потребителското състояние с данните и schoolId
            setUser({
              ...userData,
              schoolId,
            } as UserBase & { schoolId: string });
            setError(null);
          } else {
            // Ако няма намерен документ за потребителя, задаваме грешка
            setError("User document not found");
            setUser(null);
          }
        } catch (error) {
          // Обработка на грешки при извличане на потребителски данни
          const errorMessage = error instanceof Error ? error.message : "Error fetching user data";
          console.error("Error fetching user data:", error);
          setError(errorMessage);
          setUser(null);
        }
      } else {
        // Потребителят не е автентикиран, изчистваме данните
        setUser(null);
        setError(null);
      }
      // Приключваме зареждането, независимо от резултата
      setLoading(false);
    });

    // Почистване при размонтиране на компонента
    // Прекратяваме слушането за промени в аутентикацията
    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error }}>
      {children}
    </UserContext.Provider>
  );
};
