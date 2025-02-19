

# Języki

System prompt:

```
Jeżeli zmianiasz język, wypisz kod języka w nawiasach, np. (en) This is English, (pl) To jest język polski.
```

```ssml
<speak>The french word for cat is <lang xml:lang="fr-FR">chat</lang></speak>
```

# Notatki:
 - gdy rozmowa musi być zainicjowana przez asystenta:
   - robi ding i czeka, jeżeli użytkownik to usłyszy, może zapytać o co chodzi
   - jeżeli nie zadziała po pewnym czasie, mówi np. "Dominik, tu Zefira" i nadsłuchuje odpowiedzi (nie zbyt długo, nawet jeżeli jeszcze rejestruje tekst).
     Odpowiedź jest przetworzona przez prompty:
     ```
     Developer: Opdowiadaj tylko jednym zwrotem "tak", "nie" lub "nie wiem".
                Wypowiedzi użytkownika pochodzą z systemu rozpoznawiania mowy i mogą zawierać błędy interpuncyjne.
     User: Asystent zapytał "Dominik, tu twój asystent. Odezwij się.". Czy odpowiedź "****"
           wygląda jak odpowiedź tego właśnie użytkownika na to zapytanie?
     Assistant: Tak
     ------
     Developer: Opdowiadaj tylko jednym słowem lub "nie wiem".
                Wypowiedzi użytkownika pochodzą z systemu rozpoznawiania mowy i mogą zawierać błędy interpuncyjne.
     User: Asystent zapytał użytkownika "Cześć, tu twój asystent. Odezwij się.".
           Użytkownik odpowiedział "tu Dominik słucham cię". Jakie jest imię użytkownika?
     Assistant: Dominik.
     ```
   - Jeżeli użytkownik nie potwierdził imienia, to asystent powinien zapytać o nie przed kontynuowaniem.
   - jeżeli dalej nie działa, wyślij powiadomienie na telefon. Asystent wróci do tej sprawy, kiedy użytkownik rozpocznie nową rozmowę.
 - Jeżeli imie użytkownika po "tu" nie jest znane, pyta czy to jest gość, jeżeli tak, to pyta czy utworzyć konto gościa i czy ma być tymczasowe.
 - Search Google in JSON: https://developers.google.com/custom-search/v1/overview