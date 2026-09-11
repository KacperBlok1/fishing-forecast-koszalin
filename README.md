# Czy warto iść na ryby? — planer wypadu

Mobilna aplikacja wędkarska dla **Koszalina i okolic**. Odpowiada na trzy pytania:
**czy warto dziś iść na ryby, kiedy dokładnie i dlaczego akurat tyle punktów**.

Dla wybranego łowiska i gatunku liczy ocenę **0–100** z etykietą
*słabo / średnio / dobrze / bardzo dobrze*, rozkłada wynik na konkretne czynniki pogodowe,
pokazuje najlepsze okna czasowe w ciągu doby i prognozę na 7 dni. Dla łowisk morskich
dokłada osobny tryb z falą i oceną bezpieczeństwa.

> Ocena jest wskazówką, a nie gwarancją brań. Przed wyjazdem sprawdź ostrzeżenia pogodowe,
> bezpieczeństwo nad wodą oraz regulamin i okresy ochronne w swoim okręgu.

Aplikacja jest **statycznym frontendem**: bez backendu, bez bazy danych, bez logowania
i bez kluczy API. Wszystkie obliczenia dzieją się w przeglądarce, a ustawienia zapisują się
wyłącznie w `localStorage` urządzenia.

---

## Funkcje

### Łowiska

- lista zapisanych łowisk z podziałem na **jezioro / rzekę / morze**;
- kilkanaście przykładowych miejsc z okolic Koszalina (Jamno, Bukowo, Rosnowskie, Kwiecko,
  Radew, Wieprza, Grabowa, Parsęta, Dzierżęcinka, Mielno, Unieście, Sarbinowo, Darłówko,
  Ustronie Morskie);
- dodawanie własnego łowiska **po nazwie miejscowości** (Open-Meteo Geocoding) albo
  **po współrzędnych** (`54.1943, 16.2207`, `54,1943 16,2207`, `54.19 N 16.22 E`);
- własne łowiska można usuwać; wbudowane zostają na stałe.

### Widoki

| Zakładka | Co pokazuje |
| --- | --- |
| **Teraz** | Ocena bieżąca, rozbicie na czynniki, korekta gatunkowa, trend z 3 dni, tryb morski |
| **Dziś** | Najlepsze okno dnia, lista okien czasowych, godzinowy wykres i tabela |
| **7 dni** | Ocena każdego dnia (najlepsze okno + średnia) z rozwijanymi szczegółami i oknami |
| **Dlaczego?** | Pełny, jawny opis algorytmu, progów, reguł gatunkowych, źródeł danych i ograniczeń |

### Wyjaśnienie wyniku

Każdy czynnik ma widoczną wagę, ocenę cząstkową 0–100, konkretną wartość i zdanie opisu:

- temperatura oraz **jej zmiana względem średniej z 3 poprzednich dni**;
- wiatr — prędkość, kierunek i porywy, z progami zależnymi od akwenu;
- opady i kod pogody (burza przycina ocenę niezależnie od sumy mm);
- ciśnienie oraz **zmiana ciśnienia w ciągu 24 h**;
- zachmurzenie;
- pora dnia liczona względem **realnego wschodu i zachodu słońca** danego dnia;
- **faza księżyca** (liczona lokalnie, Open-Meteo jej nie udostępnia);
- **stabilność pogody** — rozrzut ciśnienia i wiatru w oknie ±12 h.

### Gatunki

Szczupak, okoń, sandacz, karp, leszcz, pstrąg, dorsz. Wybór gatunku zmienia zarówno opis,
jak i wynik — przez zestaw sześciu jawnych reguł ograniczonych do ±12 punktów.

### Tryb morski

Dla łowisk typu „morze” dokładany jest komponent fali (Open-Meteo Marine API) oraz osobny
panel z wysokością, okresem i kierunkiem fali, temperaturą wody i etykietą bezpieczeństwa
(*bezpiecznie / ostrożnie / trudne warunki / niebezpiecznie*).
**Gdy API nie zwróci danych, aplikacja pisze to wprost** — nie podstawia wymyślonych liczb
i nie dolicza komponentu morskiego do wyniku.

### Niezawodność i PWA

- stan ładowania (szkielety), czytelne komunikaty błędów i przycisk ponowienia;
- cache ostatniej poprawnej odpowiedzi w `localStorage` (świeża przez 15 minut,
  używana awaryjnie przez 24 h) z widocznym wiekiem danych;
- wykrywanie braku internetu i osobny komunikat offline;
- instalacja na telefonie (manifest + ikony) i offline'owy cache **interfejsu**
  przez service workera — dane pogodowe celowo nie są cache'owane przez SW.

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

Wszystkie dane pochodzą z publicznych, bezkluczowych usług
[Open-Meteo](https://open-meteo.com/), odpytywanych bezpośrednio z przeglądarki użytkownika:

| API | Do czego |
| --- | --- |
| [Forecast API](https://open-meteo.com/en/docs) | Pogoda bieżąca, godzinowa i dzienna: 3 dni wstecz + 7 dni prognozy, `timezone=auto` |
| [Marine API](https://open-meteo.com/en/docs/marine-weather-api) | Wysokość, kierunek i okres fali, temperatura powierzchni morza — **tylko dla łowisk morskich** |
| [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Wyszukiwanie miejscowości przy dodawaniu własnego łowiska |

Faza księżyca liczona jest lokalnie z długości miesiąca synodycznego (`src/utils/moon.ts`) —
Open-Meteo jej nie udostępnia, a jest w pełni deterministyczna.

Dane Open-Meteo są udostępniane na licencji
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); oznaczenie źródła znajduje się
w stopce aplikacji i w zakładce „Dlaczego?”.

---

## Struktura projektu

```text
.
├── public/
│   ├── images/           # zdjęcia tła + CREDITS.md
│   ├── manifest.json     # manifest PWA
│   ├── sw.js             # service worker — cache powłoki interfejsu
│   └── icon-*.png        # ikony aplikacji
├── src/
│   ├── data/
│   │   ├── spots.ts      # przykładowe łowiska okolic Koszalina
│   │   └── species.ts    # profile 7 gatunków i ich reguły
│   ├── services/
│   │   ├── openMeteo.ts  # Forecast + Marine API, timeouty, ponowienia, tryb offline
│   │   ├── geocoding.ts  # wyszukiwanie miejscowości i parsowanie współrzędnych
│   │   ├── cache.ts      # cache ostatniej poprawnej odpowiedzi (localStorage)
│   │   ├── storage.ts    # łowiska, wybór gatunku, zakładka, ostatni wynik
│   │   └── serviceWorker.ts
│   ├── utils/
│   │   ├── scoring.ts    # oceny cząstkowe, wagi, korekta gatunkowa
│   │   ├── planner.ts    # oceny godzinowe, okna, prognoza 7-dniowa, trend
│   │   ├── moon.ts       # faza księżyca
│   │   ├── time.ts       # czas lokalny łowiska bez udziału strefy przeglądarki
│   │   └── formatting.ts
│   ├── components/       # interfejs (zakładki, wykres, modal łowisk, panel morski…)
│   ├── styles/           # globals.css + components.css
│   ├── types/index.ts
│   ├── App.tsx
│   └── main.tsx
├── Dockerfile            # build Vite + produkcyjny Nginx
├── docker-compose.yml    # kontener i healthcheck, port 8090
├── nginx.conf            # SPA fallback, cache statyków, wyjątki dla sw.js i manifestu
└── README.md
```

### Uwaga o czasie

Open-Meteo zwraca czasy jako **lokalne ISO bez strefy** dla strefy łowiska
(`timezone=auto`). Aplikacja celowo operuje na tych tekstach, zamiast parsować je zegarem
przeglądarki — dzięki temu „świt” wypada o właściwej godzinie nawet wtedy, gdy telefon
ma ustawioną inną strefę czasową.

---

## Technologie

React 19 · TypeScript · Vite 6 · czyste CSS · Vitest · Docker + Nginx · Open-Meteo API.

Zero zależności runtime poza React — wykres, ikony i cała logika są napisane w projekcie.

---

## Uruchomienie lokalne

### Wymagania

- Node.js 20 lub nowszy;
- npm.

### Instalacja i development

```bash
git clone <URL_REPOZYTORIUM>
cd fishing-forecast-koszalin
npm ci
npm run dev
```

Vite wyświetli adres lokalnego serwera, zwykle `http://localhost:5173`.

> Service worker rejestruje się wyłącznie w buildzie produkcyjnym, żeby nie przeszkadzać
> w hot reloadzie.

### Jakość kodu i testy

```bash
npm run typecheck   # sprawdzenie typów TypeScript
npm run lint        # ESLint
npm run format      # Prettier — formatuje pliki
npm run format:check
npm test            # testy jednostkowe (Vitest): scoring, planner, czas, księżyc, współrzędne
```

Każdy push i pull request na branchu `main` uruchamia te same kroki w GitHub Actions —
zobacz `.github/workflows/ci.yml`.

### Build produkcyjny

```bash
npm run build
npm run preview
```

Pliki wynikowe trafiają do katalogu `dist/`.

---

## Wdrożenie na serwerze z Dockerem

Sposób wdrożenia **nie zmienił się** względem poprzedniej wersji.

### Wymagania

- Docker Engine;
- Docker Compose Plugin (`docker compose`);
- wolny port TCP, domyślnie `8090`.

### Szybkie wdrożenie

```bash
git clone <URL_REPOZYTORIUM> fishing-forecast-koszalin
cd fishing-forecast-koszalin
docker compose up -d --build
```

Sprawdzenie kontenera i healthchecku:

```bash
docker compose ps
curl http://localhost:8090
```

Aplikacja będzie dostępna pod `http://ADRES_IP_SERWERA:8090`.

### Aktualizacja z v1 do v2

```bash
git pull
docker compose up -d --build
docker image prune -f
```

Po aktualizacji odśwież stronę na telefonie **dwukrotnie** albo zamknij i otwórz
zainstalowaną aplikację — pierwsze wejście pobiera nowego service workera, drugie
przechodzi już na nową powłokę. `nginx.conf` wysyła dla `/sw.js` nagłówek `no-cache`,
więc nie trzeba czyścić cache ręcznie.

### Zmiana portu

```bash
APP_PORT=8080 docker compose up -d --build
```

Na Windows PowerShell:

```powershell
$env:APP_PORT="8080"; docker compose up -d --build
```

### Zatrzymanie i logi

```bash
docker compose logs -f fishing-forecast
docker compose down
```

---

## Instalacja na telefonie (PWA)

1. Otwórz `http://ADRES_IP_SERWERA:8090` w przeglądarce na telefonie.
2. Android / Chrome: menu → **Dodaj do ekranu głównego**.
3. iOS / Safari: przycisk udostępniania → **Dodaj do ekranu początkowego**.

Po instalacji interfejs działa również bez internetu — aplikacja pokaże ostatnie
zapisane dane wraz z ich wiekiem i wyraźnym komunikatem, że jesteś offline.
Świeża prognoza wymaga połączenia.

> Uwaga: część przeglądarek instaluje PWA tylko przez HTTPS albo przez `localhost`.
> W sieci lokalnej po `http://` instalacja może być niedostępna — wtedy postaw przed
> aplikacją reverse proxy z certyfikatem (np. Caddy) i wejdź po `https://`.

---

## Reverse proxy z domeną

```nginx
server {
    listen 80;
    server_name ryby.example.pl;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Dla publicznej domeny skonfiguruj HTTPS (Certbot, Caddy). Kontener nie przechowuje
danych użytkowników ani certyfikatów.

---

## Troubleshooting

### Strona się otwiera, ale nie ma danych

Dane pobiera **przeglądarka**, nie kontener — sprawdź internet na urządzeniu, z którego
otwierasz aplikację. Przy chwilowym błędzie Open-Meteo aplikacja pokaże ostatnią poprawną
odpowiedź i komunikat; użyj przycisku odświeżania w prawym górnym rogu.

### Po aktualizacji widzę starą wersję

To service worker. Odśwież stronę dwa razy albo w DevTools → Application → Service Workers
kliknij **Unregister** i przeładuj.

### „Brak danych o fali dla tego punktu”

Marine API nie pokrywa wód śródlądowych ani punktów zbyt blisko brzegu. Dodaj łowisko
morskie wskazane nieco dalej w stronę otwartej wody. Aplikacja świadomie nie podstawia
w takiej sytuacji żadnych wartości.

### Kontener nie startuje

```bash
docker compose config
docker compose ps
docker compose logs fishing-forecast
```

Jeśli port jest zajęty, ustaw inny przez `APP_PORT`.

### Healthcheck ma status `unhealthy`

```bash
docker inspect --format='{{json .State.Health}}' fishing-forecast
```

Po zmianie konfiguracji wykonaj ponownie `docker compose up -d --build`.

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

---

## Prywatność

Brak konta, brak backendu, brak bazy danych, brak analityki. Wybrane łowisko, gatunek,
aktywna zakładka, własne łowiska i cache ostatniej odpowiedzi zapisują się wyłącznie
w `localStorage` przeglądarki. Jedyny ruch wychodzący to zapytania do Open-Meteo.

---

## Licencja

Projekt prywatny. Dane pogodowe pochodzą z [Open-Meteo](https://open-meteo.com/)
i są objęte [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Informacje o wykorzystanych obrazach: [public/images/CREDITS.md](public/images/CREDITS.md).
