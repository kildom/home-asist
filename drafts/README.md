

# Języki

System prompt:

```
Jeżeli zmianiasz język, wypisz kod języka w nawiasach, np. (en) This is English, (pl) To jest język polski.
```

```ssml
<speak>The french word for cat is <lang xml:lang="fr-FR">chat</lang></speak>
```

# Notatki:
 - Można sugerować się tym:
   - https://forum.arturhome.pl/t/smart-glosnik-dla-kazdego-esp32/10851
   - https://forum.arturhome.pl/t/m5stack-atom-echo/10889
   - https://botland.com.pl/seria-atom/17964-m5atom-echo-programowalny-glosnik-esp32-6972934172099.html
   - Jeżeli mam coś sam lutować: https://www.infineon.com/cms/en/product/sensor/mems-microphones/mems-microphones-for-consumer/im73d122/
     - https://dsp.stackexchange.com/questions/86862/what-are-the-step-by-step-actions-taken-in-order-to-convert-pdm-data-to-pcm-data
     - https://fiiir.com/
     - http://t-filter.engineerjs.com/
   - oraz: https://kamami.pl/xiao/1184486-xiao-esp32s3-plytka-z-modulem-wifi-i-ble-esp32-s3-5906623414963.html
   - oraz: moduł MAX98357A
 - Może spróbować ten projekt: https://github.com/agno-agi/agno
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
 - Wymuś odpowiedzi w formacie SSML. Trzeba też sparsować SSML przed wysłaniem do Google, żeby, np. zmienić z `<lang>` na `<voice>`,
   usunąć nie obsługiwane znaczniki (chociaż możnaby wysłać jak jest, a jak google zwróci błąd to dopiero poprawiać).
   ```
    Wszystkie odpowiedzi podawaj w formacie SSML. Jeżeli zmieniasz język na inny niż polski, dodaj odpowiednie znaczniki SSML. jeżeli użytkownik poprosi, żebyś mówiła wolniej lub szybciej, dadaj odpowiednie znaczniki SSML.

    Twoje odpowiedzi będą wysłuchiwane, a nie odczytywane. Odpowiadaj tak, aby łatwo dało się słuchać twoich wypowiedzi. Nie generuj zbyt długich wypowiedzi.
    {
      "name": "ssml_response",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "ssml": {
            "type": "string",
            "description": "The assistant's response formatted in SSML."
          }
        },
        "required": [
          "ssml"
        ],
        "additionalProperties": false
      }
    }
   ```

Functions to do:
* [x] Conversation management
  * [x] `end_conversation`
  * [ ] `manage_conversation`
    * [ ] `save_conversation` - save conversation with user provided name or ia provided (if user didn't specified)
    * [ ] `restore_conversation` - restore last or any from the list
    * [ ] `delete_conversation` - delete saved conversation (todo: onChatEnd event for module to ask if used want to delete this previously saved conversation)
    * [ ] message: list of all saved conversations
  * [ ] `set_model` - switch between ia models
  * [ ] `add_user` - allows 3-site conversation (or more)
  * [ ] `sustain_conversation` - użytkownik ma więcej czasu na odpowiedź, np. gdy powie "daj mi chwilę na zastanowienie".
* [x] web
  * [x] `search_google`
  * [ ] `search_wikipedia`
  * [x] `fetch_page` (includes wikipedia)
* [x] home
  * [x] `list_lights_and_sensors`
    * [x] `func toggle_light`
  * [x] message: lights and sensors state
* [x] phone
  * [x] `send_message` - TODO: high priority messages will ring
* [ ] tasks
  * [ ] `cancel_task`
  * [ ] `get_scheduled_tasks`
  * [ ] `schedule_tasks`
* [ ] urgent issues (one example at, but maybe not the best): [event_notes.json](examples/event_notes.json)
  * [ ] `confirm_urgent_issue` (only if issues active)
  * [ ] `get_urgent_issues` (only if issues active)
  * [ ] message: awating urgent issues
  * [ ] onChatEnd: inform about urgent issue if appeared in the middle of conversation
* [ ] e-mail
  * message: number of unread e-mails
  * [ ] `get_unread_emails` - just sender and subject
  * [ ] `send_email` - just create draft and return string informing that user need to send it
* [ ] notes - notes shared with user over PC and phone, example at: [event_notes.json](examples/event_notes.json)

# Wake Up Word Detection

* Interesting library: https://github.com/dscripka/OpenWakeWord
  * Shold work on Rapsberry PI 3 with ~10% CPU
  * [Training new models](https://github.com/dscripka/OpenWakeWord?tab=readme-ov-file#training-new-models)
  * Synthetic data generation:
    * https://github.com/dscripka/synthetic_speech_dataset_generation
      * This notebook has some examples: https://github.com/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb
      * also Augmentation: room impulse responses, noise and background audio
    * https://github.com/rhasspy/piper-sample-generator
      * Augmentation is interesting
    * (looks like both are based on older python and python modules, so downgrade may be needed)
* This is even smaller library, but may not be so good: https://github.com/kahrendt/microWakeWord
