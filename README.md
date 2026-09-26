# Czy warto iść na ryby?

Planer wędkarski dla Koszalina i okolic, postawiony na moim serwerze. Dla wybranego łowiska
i gatunku liczy ocenę od 0 do 100, pokazuje, z czego ona wynika, wskazuje najlepsze godziny
w ciągu dnia i daje prognozę na 7 dni. Dla łowisk morskich dochodzi fala i ocena bezpieczeństwa.

![Zakładka „Teraz”: ocena, rozbicie na czynniki i trend z 3 dni](docs/screenshot.png)

Ocena to wskazówka, a nie gwarancja brań. Przed wyjazdem warto sprawdzić ostrzeżenia pogodowe
i przepisy w swoim okręgu.

## Architektura

```
przeglądarka ──► :8090 fishing-forecast ──► fishing-db (konta, łowiska, cache)
                       (Fastify: API        └─► Open-Meteo (pogoda, 1 zapytanie na 15 min)
                        + frontend)
```

Dwa kontenery w `docker-compose.yml`: PostgreSQL 17 i aplikacja (Fastify serwuje API
i zbudowany frontend). Z Open-Meteo rozmawia tylko serwer, więc telefon i komputer korzystają
z jednego cache'u, a aplikacja działa też na urządzeniu, które widzi tylko serwer w sieci.

## Funkcje

- konta z hasłem (bcrypt) i sesją w ciasteczku `httpOnly`; łowiska i ustawienia zapisane
  przy koncie, więc miejsce dodane na telefonie od razu jest na komputerze
- łowiska: jezioro, rzeka albo morze, wyszukiwanie po miejscowości albo współrzędnych
- zakładki **Teraz** (ocena i czynniki), **Dziś** (okna czasowe i wykres godzinowy),
  **7 dni** i **Dlaczego?** (opis algorytmu i jego ograniczeń)
- tryb morski z falą, okresem fali i temperaturą wody; gdy API nie zwróci danych,
  aplikacja pisze to wprost zamiast zgadywać
- cache pogody w bazie: świeży przez 15 minut, awaryjny przez 24 godziny
- PWA z instalacją na telefonie i podglądem ostatnich danych bez połączenia z serwerem

## Jak liczona jest ocena

Algorytm jest deterministyczny: te same dane zawsze dają ten sam wynik. Kod jest
w `src/utils/scoring.ts` i `src/data/species.ts`.

Dla każdej godziny liczonych jest osiem ocen cząstkowych 0–100, a wynik to ich średnia ważona:

| Czynnik | Waga | W skrócie |
| --- | ---: | --- |
| Wiatr | 18 | lekki wiatr lepszy niż cisza i wichura, kara za porywy |
| Ciśnienie | 18 | poziom i zmiana w ciągu 24 h, duży skok obniża ocenę |
| Temperatura | 16 | optimum 12–22 °C i zmiana względem średniej z 3 dni |
| Pora dnia | 16 | świt i zmierzch najlepsze, liczone od prawdziwego wschodu i zachodu |
| Opady | 12 | mżawka najlepsza, burza mocno obcina wynik |
| Zachmurzenie | 10 | optimum 30–75% |
| Faza księżyca | 6 | nów i pełnia lekko premiowane, liczona lokalnie |
| Stabilność | 4 | rozrzut ciśnienia i wiatru w oknie ±12 h |
| Fala (morze) | 15 | tylko gdy są dane z Marine API |

Progi wiatru zależą od typu akwenu. Gatunek (szczupak, okoń, sandacz, karp, leszcz, pstrąg,
dorsz) koryguje wynik sześcioma prostymi regułami, łącznie najwyżej o ±12 punktów.

**Okno połowowe** to co najmniej dwie kolejne godziny z wynikiem od 55, cięte na odcinki
do 4 godzin. Ocena dnia w zakładce „7 dni” to 65% najlepszego okna i 35% średniej z godzin
dziennych, bo sam najlepszy wynik sprawiał, że każdy dzień wyglądał podobnie (prawie zawsze
jest jedna dobra godzina o świcie).

Open-Meteo zwraca czas lokalny łowiska bez strefy. Aplikacja pracuje na tych napisach,
zamiast przeliczać je zegarem przeglądarki, więc świt wypada o dobrej godzinie nawet wtedy,
gdy telefon ma ustawioną inną strefę.

## API

Poza `/api/health` i `/api/auth/*` wszystko wymaga zalogowania.

| Metoda | Ścieżka | Opis |
| --- | --- | --- |
| `GET` | `/api/health` | czy serwer działa |
| `POST` | `/api/auth/register`, `/login`, `/logout`, `/logout-all` | konto i sesje |
| `POST` | `/api/auth/change-password` | zmiana hasła, unieważnia sesje |
| `GET` | `/api/auth/me` | zalogowany użytkownik |
| `GET` `POST` `PATCH` `DELETE` | `/api/spots` | łowiska |
| `GET` `PUT` | `/api/prefs` | ustawienia widoku |
| `GET` | `/api/weather/forecast?spotId=` | prognoza z cache'u |
| `GET` | `/api/weather/marine?spotId=` | dane morskie |
| `GET` | `/api/weather/geocode?q=` | wyszukiwanie miejscowości |

## Stack

- **Frontend:** React 19, TypeScript, Vite, własne CSS, Vitest
- **Backend:** Node 20, Fastify 5, PostgreSQL 17, bcryptjs
- **Infrastruktura:** Docker Compose, GitHub Actions (lint, typecheck, testy, build obrazu)

Wykres, ikony i cała punktacja są napisane w projekcie, bez dodatkowych bibliotek.

## Uruchomienie

Wdrożenie krok po kroku jest w [docs/WDROZENIE.md](docs/WDROZENIE.md). W skrócie:

```bash
cp .env.example .env
# uzupełnij POSTGRES_PASSWORD i SESSION_SECRET
docker compose up -d --build
curl http://localhost:8090/api/health
```

Development (Node 20+, baza z compose'a z tymczasowo dopisanym `ports: ['5432:5432']`):

```bash
npm ci
npm run server:install
docker compose up -d db
DATABASE_URL=postgres://fishing:HASLO@localhost:5432/fishing SESSION_SECRET=dlugi-sekret npm run server:dev
npm run dev
```

Testy i sprawdzenia:

```bash
npm run lint
npm run typecheck
npm test
npm run server:typecheck
```

## Ograniczenia

- to prognoza pogody przełożona na punkty, a nie przewidywanie brań
- model pogodowy ma siatkę kilku kilometrów, więc nad małym stawem wiatr może być inny
- algorytm nie zna temperatury i poziomu wody, presji wędkarskiej ani zarybień
- reguły gatunkowe to uproszczenia z praktyki, a nie wyniki badań
- im dalszy dzień prognozy, tym większy błąd

Dane pogodowe: [Open-Meteo](https://open-meteo.com/), licencja
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Źródła zdjęć:
[public/images/CREDITS.md](public/images/CREDITS.md).
