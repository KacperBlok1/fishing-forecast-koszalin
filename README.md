# Czy warto iść na ryby? — planer wypadu

Aplikacja wędkarska dla **Koszalina i okolic**, postawiona na własnym serwerze.
Odpowiada na trzy pytania: **czy warto dziś iść na ryby, kiedy dokładnie
i dlaczego akurat tyle punktów**.

Dla wybranego łowiska i gatunku liczy ocenę **0–100** z etykietą
*słabo / średnio / dobrze / bardzo dobrze*, rozkłada wynik na konkretne czynniki
pogodowe, pokazuje najlepsze okna czasowe w ciągu doby i prognozę na 7 dni.
Dla łowisk morskich dokłada tryb z falą i oceną bezpieczeństwa.

Łowiska i ustawienia są **zapisane przy koncie na serwerze**: miejsce dodane
na telefonie jest od razu dostępne na komputerze i odwrotnie.

> Ocena jest wskazówką, a nie gwarancją brań. Przed wyjazdem sprawdź ostrzeżenia
> pogodowe, bezpieczeństwo nad wodą oraz regulamin i okresy ochronne w swoim okręgu.

**Wdrożenie krok po kroku: [docs/WDROZENIE.md](docs/WDROZENIE.md)**

---

## Architektura

```
przeglądarka  ──►  :8090  fishing-forecast  ──►  fishing-db      (konta, łowiska, cache)
(telefon,                    (Fastify:            └─►  Open-Meteo     (pogoda, 1 zapytanie / 15 min)
 komputer)                    API + frontend)
```

Dwa kontenery w jednym `docker-compose.yml`:

| Kontener | Obraz | Rola | Port |
| --- | --- | --- | --- |
| `fishing-db` | `postgres:17-alpine` | Konta, łowiska, ustawienia, cache pogody | brak (tylko sieć Dockera) |
| `fishing-forecast` | budowany z repo | Fastify: `/api` + zbudowany frontend | `8090` |

Istotna zmiana względem wersji 2: **do Open-Meteo odpytuje serwer, nie przeglądarka**.
Dzięki temu telefon i komputer dzielą jeden cache (jedno zapytanie na łowisko na
kwadrans niezależnie od liczby urządzeń), a aplikacja działa też wtedy, gdy
urządzenie ma dostęp wyłącznie do serwera w LAN-ie.

---

## Funkcje

### Konta i synchronizacja

- rejestracja i logowanie (e-mail + hasło, bcrypt, sesja w ciasteczku `httpOnly` na 90 dni);
- łowiska, wybrany gatunek i aktywna zakładka zapisane przy koncie w Postgresie;
- powrót do karty odświeża listę — łowisko dodane na telefonie pojawia się na komputerze;
- rejestrację można wyłączyć jedną zmienną (`ALLOW_REGISTRATION=false`);
- każde nowe konto dostaje czternaście przykładowych łowisk z okolic Koszalina.

### Łowiska

- podział na **jezioro / rzekę / morze**, dodawanie własnych miejsc;
- wyszukiwanie **po nazwie miejscowości** albo podanie **współrzędnych**
  (`54.1943, 16.2207`, `54,1943 16,2207`, `54.19 N 16.22 E`);
- usuwanie z potwierdzeniem w dwóch kliknięciach.

### Widoki

| Zakładka | Co pokazuje |
| --- | --- |
| **Teraz** | Ocena bieżąca, rozbicie na czynniki, korekta gatunkowa, trend z 3 dni, tryb morski |
| **Dziś** | Najlepsze okno dnia, lista okien czasowych, godzinowy wykres i tabela |
| **7 dni** | Ocena każdego dnia (najlepsze okno + średnia) z rozwijanymi szczegółami |
| **Dlaczego?** | Pełny, jawny opis algorytmu, progów, reguł gatunkowych, źródeł i ograniczeń |

### Wyjaśnienie wyniku

Każdy czynnik ma widoczną wagę, ocenę cząstkową 0–100, konkretną wartość i opis:

- temperatura oraz **jej zmiana względem średniej z 3 poprzednich dni**;
- wiatr — prędkość, kierunek i porywy, z progami zależnymi od akwenu;
- opady i kod pogody (burza przycina ocenę niezależnie od sumy mm);
- ciśnienie oraz **zmiana ciśnienia w ciągu 24 h**;
- zachmurzenie;
- pora dnia liczona względem **realnego wschodu i zachodu słońca** danego dnia;
- **faza księżyca** (liczona lokalnie, Open-Meteo jej nie udostępnia);
- **stabilność pogody** — rozrzut ciśnienia i wiatru w oknie ±12 h.

### Gatunki

Szczupak, okoń, sandacz, karp, leszcz, pstrąg, dorsz. Wybór gatunku zmienia opis
i wynik przez zestaw sześciu jawnych reguł ograniczonych do ±12 punktów. Gatunki
nietypowe dla wybranego akwenu są oznaczone na liście.

### Tryb morski

Komponent fali z Marine API, panel z wysokością, okresem i kierunkiem fali,
temperaturą wody i etykietą bezpieczeństwa (*bezpiecznie / ostrożnie /
trudne warunki / niebezpiecznie*). **Gdy API nie zwróci danych, aplikacja pisze to
wprost** — nie podstawia wymyślonych liczb i nie dolicza komponentu do wyniku.

### Niezawodność

- cache pogody w Postgresie: świeży przez 15 minut, awaryjny przez 24 godziny;
- gdy Open-Meteo nie odpowiada, serwer oddaje ostatnią poprawną odpowiedź, a klient
  pokazuje jej wiek i komunikat;
- lokalna kopia w `localStorage` pozwala otworzyć aplikację bez kontaktu z serwerem
  w trybie tylko do odczytu;
- PWA: manifest, ikony, instalacja na telefonie, offline'owy cache interfejsu
  (żądania `/api` nigdy nie trafiają do cache service workera);
- responsywny układ od 360 px (jedna kolumna, szuflada z łowiskami) do 1920 px
  (stały panel boczny, dwie kolumny treści).

---

## Jak liczona jest ocena

Algorytm jest w pełni **deterministyczny i jawny** — te same dane wejściowe zawsze dają
ten sam wynik. Nie ma tu modelu uczonego ani żadnej losowości.

### 1. Oceny cząstkowe

Dla każdej godziny liczonych jest osiem ocen w skali 0–100 (`src/utils/scoring.ts`):

| Czynnik | Waga | Zasada |
| --- | ---: | --- |
| Wiatr | 18 | Lekki, roboczy wiatr > cisza > wichura; kara za porywistość (porywy > 1,7× średniej) |
| Ciśnienie | 18 | 60 % poziom + 40 % zmiana 24 h; łagodny spadek premiowany, skok > 8 hPa karany |
| Temperatura | 16 | 60 % poziom (optimum 12–22 °C) + 40 % odchylenie od średniej z 3 dni |
| Pora dnia | 16 | Względem wschodu/zachodu słońca: świt i zmierzch 95, poranek/popołudnie 66, środek dnia 40, noc 24 |
| Opady | 12 | Mżawka > sucho > deszcz > ulewa; kody 95–99 (burza) przycinają do 12 |
| Zachmurzenie | 10 | Optimum 30–75 % |
| Faza księżyca | 6 | Nów i pełnia premiowane, kwadry neutralne |
| Stabilność | 4 | Rozrzut ciśnienia i wiatru w oknie ±12 h |
| **Fala** *(tylko morze)* | 15 | Doliczana wyłącznie, gdy Marine API zwróciło wysokość fali |

Progi wiatru (km/h) zależą od akwenu:

| Akwen | Cisza | Optimum | Silny | Bardzo silny |
| --- | ---: | ---: | ---: | ---: |
| jezioro | ≤ 3 | 6–14 | 30 | 50 |
| rzeka | ≤ 3 | 6–18 | 35 | 55 |
| morze | ≤ 4 | 8–20 | 40 | 60 |

### 2. Średnia ważona

`wynik bazowy = Σ(ocena × waga) / Σ(waga)`

Suma wag wynosi 100 dla akwenów śródlądowych i 115 dla morza z dostępnymi danymi falowymi
— dzielenie przez faktycznie użytą sumę wag sprawia, że maksimum zawsze wynosi 100.

### 3. Korekta gatunkowa

Sześć reguł, każda z jawną liczbą punktów i zdaniem wyjaśnienia (`src/data/species.ts`):

1. **akwen** — gatunek nietypowy dla tego typu wody: −12;
2. **temperatura** — w zakresie gatunku: +4, tuż obok: 0, poza: −8;
3. **światło** — dopasowanie pory dnia do preferencji (przyćmione / jasne / nocne): od −6 do +6;
4. **wiatr** — gatunki lubiące falę: +3 w optimum, −3 przy ciszy; gatunki spokojnej wody odwrotnie;
5. **ciśnienie** — gatunki wrażliwe (karp, leszcz) przy skoku > 5 hPa/24 h: −5;
6. **zachmurzenie** — gatunki lubiące rozproszone światło przy 40–90 %: +2.

Suma korekt jest przycinana do **±12 punktów** — o wyniku decyduje przede wszystkim pogoda,
gatunek tylko go koryguje.

| Gatunek | Akweny | Temperatura | Światło | Wiatr |
| --- | --- | --- | --- | --- |
| Szczupak | jezioro, rzeka | 4–20 °C | przyćmione | lubi |
| Okoń | jezioro, rzeka | 6–22 °C | jasne | lubi |
| Sandacz | jezioro, rzeka | 8–24 °C | nocne | lubi |
| Karp | jezioro, rzeka | 16–28 °C | obojętne | nie lubi |
| Leszcz | jezioro, rzeka | 12–26 °C | przyćmione | nie lubi |
| Pstrąg | rzeka, jezioro | 4–16 °C | przyćmione | nie lubi |
| Dorsz | morze | 2–14 °C | obojętne | obojętny |

### 4. Etykieta

| Punkty | Etykieta |
| --- | --- |
| 0–34 | słabo |
| 35–54 | średnio |
| 55–74 | dobrze |
| 75–100 | bardzo dobrze |

### 5. Okna czasowe

**Okno połowowe** to co najmniej dwie następujące po sobie godziny z wynikiem ≥ 55,
dzielone na fragmenty po maksymalnie **4 godziny** (długa seria jest cięta na najlepszy
fragment i resztę — „od 18:00 do północy” nie jest praktyczną wskazówką).
Gdy żadna godzina nie przekracza progu, pokazywane jest najlepsze dostępne okno
dwugodzinne. Ocena dnia w zakładce „7 dni” to **65 % wyniku najlepszego okna + 35 % średniej z godzin
dziennych**. Sam najlepszy wynik godzinowy byłby mylący — prawie każdy dzień ma jedną dobrą
godzinę o świcie, więc wszystkie dni wyglądałyby identycznie. Dla dzisiejszego dnia planowane
są tylko godziny, które jeszcze nie minęły.

---

## Źródła danych

Dane pochodzą z publicznych, bezkluczowych usług
[Open-Meteo](https://open-meteo.com/), odpytywanych **przez serwer aplikacji**:

| API | Do czego | Cache |
| --- | --- | --- |
| [Forecast API](https://open-meteo.com/en/docs) | Pogoda bieżąca, godzinowa i dzienna: 3 dni wstecz + 7 dni prognozy, `timezone=auto` | 15 min |
| [Marine API](https://open-meteo.com/en/docs/marine-weather-api) | Fala i temperatura wody — tylko dla łowisk morskich | 15 min |
| [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Wyszukiwanie miejscowości przy dodawaniu łowiska | 7 dni |

Faza księżyca liczona jest lokalnie z długości miesiąca synodycznego
(`src/utils/moon.ts`) — Open-Meteo jej nie udostępnia, a jest w pełni deterministyczna.

Dane Open-Meteo są udostępniane na licencji
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); oznaczenie źródła
znajduje się w stopce aplikacji i w zakładce „Dlaczego?".

---

## API

Wszystkie odpowiedzi są w JSON. Poza `/api/health` i `/api/auth/*` każdy endpoint
wymaga ciasteczka sesji.

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| `GET` | `/api/health` | Sprawdzenie, czy serwer żyje |
| `GET` | `/api/auth/config` | Czy rejestracja jest otwarta |
| `POST` | `/api/auth/register` | Założenie konta (+ zasianie przykładowych łowisk) |
| `POST` | `/api/auth/login` | Logowanie |
| `POST` | `/api/auth/logout` | Wylogowanie z tego urządzenia |
| `POST` | `/api/auth/logout-all` | Wylogowanie ze wszystkich urządzeń |
| `POST` | `/api/auth/change-password` | Zmiana hasła (unieważnia wszystkie sesje) |
| `GET` | `/api/auth/me` | Dane zalogowanego użytkownika |
| `GET` | `/api/spots` | Lista łowisk konta |
| `POST` | `/api/spots` | Dodanie łowiska |
| `PATCH` | `/api/spots/:id` | Edycja łowiska |
| `DELETE` | `/api/spots/:id` | Usunięcie łowiska |
| `GET` | `/api/prefs` | Ustawienia widoku |
| `PUT` | `/api/prefs` | Zapis ustawień |
| `GET` | `/api/weather/forecast?spotId=` | Prognoza (z cache) |
| `GET` | `/api/weather/marine?spotId=` | Dane morskie (z cache) |
| `GET` | `/api/weather/geocode?q=` | Wyszukiwanie miejscowości |

---

## Struktura projektu

```text
.
├── docker-compose.yml       # dwa kontenery: db + app
├── Dockerfile               # build klienta i serwera → jeden obraz
├── .env.example             # wzór konfiguracji
├── docs/
│   └── WDROZENIE.md         # instrukcja wdrożenia krok po kroku
├── server/                  # backend (Fastify + Postgres)
│   ├── package.json
│   └── src/
│       ├── index.ts         # bootstrap, statyki, obsługa błędów
│       ├── config.ts        # konfiguracja ze zmiennych środowiskowych
│       ├── db/              # pula połączeń i migracje SQL
│       ├── lib/             # sesje, hasła, walidacja, limity, błędy
│       ├── data/            # łowiska zasiewane nowemu kontu
│       ├── routes/          # auth, spots, prefs, weather
│       └── services/        # Open-Meteo i cache w Postgresie
├── src/                     # frontend (React + TypeScript)
│   ├── api/                 # warstwa HTTP i typy odpowiedzi
│   ├── hooks/               # stan sesji
│   ├── services/            # normalizacja pogody, lustro w localStorage
│   ├── utils/               # scoring, planner, księżyc, czas, współrzędne
│   ├── components/          # interfejs
│   ├── styles/              # system designu (globals + components)
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
└── public/                  # manifest PWA, service worker, ikony, zdjęcia
```

### Uwaga o czasie

Open-Meteo zwraca czasy jako **lokalne ISO bez strefy** dla strefy łowiska
(`timezone=auto`). Aplikacja celowo operuje na tych tekstach, zamiast parsować je zegarem
przeglądarki — dzięki temu „świt” wypada o właściwej godzinie nawet wtedy, gdy telefon
ma ustawioną inną strefę czasową.

---

## Technologie

**Frontend:** React 19 · TypeScript · Vite 6 · czyste CSS (własny system designu) · Vitest
**Backend:** Node 20 · Fastify 5 · PostgreSQL 17 · bcryptjs
**Infrastruktura:** Docker + Docker Compose

Zero zależności runtime po stronie klienta poza Reactem — wykres, ikony i cała
logika punktacji są napisane w projekcie. Po stronie serwera pięć zależności:
`fastify`, `@fastify/cookie`, `@fastify/static`, `pg`, `bcryptjs`.

---

## Uruchomienie lokalne (development)

Potrzebujesz Node.js 20+ i działającego Postgresa. Najprościej podnieść samą bazę
z compose'a, a serwer i frontend uruchomić lokalnie:

```bash
# 1. zależności
npm ci
npm run server:install

# 2. baza (sam kontener db)
cp .env.example .env   # uzupełnij POSTGRES_PASSWORD i SESSION_SECRET
docker compose up -d db

# 3. backend na :8090
DATABASE_URL=postgres://fishing:TWOJE_HASLO@localhost:5432/fishing \
SESSION_SECRET=cokolwiek-dlugiego \
npm run server:dev

# 4. frontend na :5173 (proxy /api → :8090)
npm run dev
```

Żeby baza była dostępna z hosta na czas developmentu, dodaj jej tymczasowo
`ports: ['5432:5432']` w `docker-compose.yml` (w produkcji tego nie rób).

### Jakość kodu i testy

```bash
npm run typecheck        # typy frontendu
npm run lint             # ESLint
npm test                 # testy jednostkowe (Vitest)
npm run build            # build produkcyjny frontendu
npm run server:typecheck # typy backendu
npm run server:build     # build backendu
```

Testy pokrywają silnik punktacji, planer okien i prognozy dziennej, obsługę czasu
lokalnego łowiska, fazę księżyca i parsowanie współrzędnych.

---

## Wdrożenie

Pełna instrukcja: **[docs/WDROZENIE.md](docs/WDROZENIE.md)** — wymagania dla LXC na
Proxmoksie, instalacja Dockera, konfiguracja `.env`, smoke-testy, kopie zapasowe,
aktualizacja, HTTPS i lista typowych problemów.

Skrót dla niecierpliwych:

```bash
git clone <URL_REPOZYTORIUM> fishing-forecast
cd fishing-forecast
cp .env.example .env
# uzupełnij POSTGRES_PASSWORD i SESSION_SECRET
docker compose up -d --build
curl http://localhost:8090/api/health
```

---

## Instalacja na telefonie (PWA)

1. Otwórz `http://ADRES_IP_SERWERA:8090` w przeglądarce na telefonie.
2. Zaloguj się — sesja trzyma się 90 dni.
3. Android / Chrome: menu → **Dodaj do ekranu głównego**.
   iOS / Safari: udostępnianie → **Dodaj do ekranu początkowego**.

Część przeglądarek instaluje PWA tylko po HTTPS. W LAN-ie po `http://` opcja może
być niedostępna — punkt 11 instrukcji wdrożenia opisuje, jak dodać HTTPS przez Caddy.

---

## Ograniczenia

- To prognoza pogody przełożona na punkty, a **nie przewidywanie brań**.
- Model interpoluje dane do siatki o boku kilku kilometrów — nad małym, osłoniętym stawem
  wiatr może być zupełnie inny niż w prognozie.
- Algorytm nie zna przejrzystości i poziomu wody, temperatury wody w jeziorze, presji
  wędkarskiej ani zarybień.
- Im dalszy dzień prognozy, tym większy błąd — siódmy dzień traktuj orientacyjnie.
- Reguły gatunkowe to uproszczone heurystyki oparte na wędkarskiej praktyce, a nie na
  badaniach ichtiologicznych.
- Dane morskie to prognoza modelu falowego, nie pomiar z boi.
- Aplikacja nie zna okresów ochronnych ani wymiarów obowiązujących w Twoim okręgu.

Pełna lista ograniczeń jest też w aplikacji, w zakładce **„Dlaczego?”**.

Pełna lista ograniczeń jest też w aplikacji, w zakładce **„Dlaczego?"**.

---

## Prywatność

Brak analityki, brak zewnętrznych skryptów, brak wysyłki danych gdziekolwiek poza
Open-Meteo (i to wyłącznie współrzędnych łowiska, z serwera). Konta, łowiska
i ustawienia leżą w Postgresie na Twoim serwerze. Hasła są haszowane bcryptem,
tokeny sesji trzymane jako HMAC — sam wyciek bazy nie pozwala przejąć sesji.

Aplikacja jest pomyślana dla sieci lokalnej lub VPN-u. Przed wystawieniem jej
do internetu przeczytaj punkt 12 instrukcji wdrożenia.

---

## Licencja

Projekt prywatny. Dane pogodowe pochodzą z [Open-Meteo](https://open-meteo.com/)
i są objęte [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Informacje o wykorzystanych obrazach: [public/images/CREDITS.md](public/images/CREDITS.md).
