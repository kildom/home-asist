

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

Functions to do:
* [x] Conversation management
  * [x] `end_conversation`
  * [ ] `manage_conversation`
    * [ ] `save_conversation` - save conversation with user provided name or ia provided (if user didn't specified)
    * [ ] `restore_conversation` - restore last or any from the list
    * [ ] `delete_conversation` - delete saved conversation (todo: onChatEnd event for module to ask if used want to delete this previously saved conversation)
    * [ ] message: list of all saved conversations
  * [ ] `add_user` - allows 3-site conversation (or more)
* [x] web
  * [x] `search_google`
  * [ ] `search_wikipedia`
  * [x] `fetch_page` (includes wikipedia)
* [x] home
  * [x] `list_lights_and_sensors`
    * [x] `func toggle_light`
  * [ ] message: lights and sensors state
* [ ] phone
  * [ ] `send_message` - high priority messages will ring
* [ ] tasks
  * [ ] `cancel_task`
  * [ ] `get_scheduled_tasks`
  * [ ] `schedule_tasks`
* [ ] urgent issues
  * [ ] `confirm_urgent_issue` (only if issues active)
  * [ ] `get_urgent_issues` (only if issues active)
  * [ ] message: awating urgent issues
  * [ ] onChatEnd: inform about urgent issue if appeared in the middle of conversation