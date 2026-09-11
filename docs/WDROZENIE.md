# Wdrożenie krok po kroku

Instrukcja dla kontenera LXC na Proxmoksie (Debian + Docker), ale działa tak samo
na zwykłym Debianie, Ubuntu czy maszynie wirtualnej.

Po wdrożeniu aplikacja będzie pod `http://ADRES_IP_SERWERA:8090`.

---

## Co właściwie stawiamy

Dwa kontenery Dockera w jednym `docker-compose.yml`:

| Kontener | Obraz | Rola | Port na zewnątrz |
| --- | --- | --- | --- |
| `fishing-db` | `postgres:17-alpine` | Baza: konta, łowiska, ustawienia, cache pogody | **brak** — widoczna tylko dla aplikacji |
| `fishing-forecast` | budowany z tego repo | Serwer Fastify: API + zbudowany frontend | `8090` |

Dane bazy leżą w wolumenie Dockera `db-data` i **przeżywają** `docker compose down`
oraz przebudowę obrazu. Kasuje je dopiero `docker compose down -v`.

Ruch wygląda tak:

```
przeglądarka  ──►  :8090  fishing-forecast  ──►  fishing-db      (konta, łowiska)
(telefon,                    (Fastify)       └─►  api.open-meteo.com  (pogoda, cache 15 min)
 komputer)
```

Do internetu wychodzi **tylko serwer**. Telefon i komputer potrzebują dostępu
wyłącznie do `192.168.1.38:8090`.

---

## 0. Wymagania

Na kontenerze CT 102 (albo innej maszynie):

- Debian 12 lub nowszy,
- Docker Engine + wtyczka Compose,
- ok. 1 GB RAM i 3 GB miejsca na dysku,
- wolny port TCP 8090.

> **Uwaga dla LXC na Proxmoksie:** Docker w nieuprzywilejowanym kontenerze wymaga
> włączonych opcji `keyctl=1` i `nesting=1`. W GUI Proxmoksa: **CT 102 → Options →
> Features**. Bez tego Docker albo nie wstanie, albo Postgres będzie się wysypywał
> przy starcie.

### Instalacja Dockera (jeśli go nie masz)

```bash
apt update
apt install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Sprawdzenie:

```bash
docker --version
docker compose version
```

---

## 1. Pobierz kod

```bash
cd /opt
git clone <URL_TWOJEGO_REPOZYTORIUM> fishing-forecast
cd fishing-forecast
```

Jeśli aktualizujesz istniejące wdrożenie z wersji 2:

```bash
cd /opt/fishing-forecast   # albo tam, gdzie masz repo
git pull
```

---

## 2. Wygeneruj lockfile serwera (jednorazowo)

Katalog `server/` ma własne zależności. Jeżeli nie ma w nim jeszcze
`package-lock.json`, wygeneruj go **raz** i zacommituj — dzięki temu każda
kolejna przebudowa obrazu instaluje dokładnie te same wersje paczek:

```bash
cd server
npm install
cd ..
git add server/package-lock.json
git commit -m "chore: lockfile serwera"
```

Potrzebujesz do tego Node.js 20+ na maszynie. Jeśli nie masz go lokalnie,
możesz ten krok pominąć — `Dockerfile` wykryje brak lockfile'a i użyje
`npm install`. Build zadziała, tylko wersje paczek nie będą przypięte.

---

## 3. Utwórz plik `.env`

```bash
cp .env.example .env
```

Wygeneruj oba sekrety i wklej je do `.env`:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "SESSION_SECRET=$(openssl rand -base64 48)"
```

Minimalny poprawny `.env` wygląda tak:

```dotenv
POSTGRES_PASSWORD=gT7k2pQ...
SESSION_SECRET=9xBv4mZq...
APP_PORT=8090
ALLOW_REGISTRATION=true
COOKIE_SECURE=false
```

> **`COOKIE_SECURE` zostaw na `false`**, dopóki wchodzisz po `http://`.
> Ustawione na `true` każe przeglądarce wysyłać ciasteczko sesji wyłącznie
> po HTTPS — po zwykłym http nie zalogujesz się i nie zobaczysz żadnego błędu
> poza „nieprawidłowy e-mail lub hasło".

Zabezpiecz plik:

```bash
chmod 600 .env
```

---

## 4. Zbuduj i uruchom

```bash
docker compose up -d --build
```

Pierwszy build trwa kilka minut (pobranie obrazów Node i Postgresa, `npm ci`,
build Vite i TypeScriptu). Kolejne są znacznie szybsze.

Sprawdź, czy oba kontenery wstały:

```bash
docker compose ps
```

Oczekiwany wynik — obie usługi `running`, a `fishing-db` dodatkowo `healthy`:

```
NAME                IMAGE                     STATUS
fishing-db          postgres:17-alpine        Up 2 minutes (healthy)
fishing-forecast    fishing-forecast-app      Up 1 minute (healthy)
```

---

## 5. Smoke-test — pięć komend

Uruchom je po kolei na serwerze. Jeśli wszystkie przejdą, wdrożenie jest sprawne.

**1. Serwer żyje:**

```bash
curl -s http://localhost:8090/api/health
```
→ `{"status":"ok","time":"2026-..."}`

**2. Migracje przeszły (są cztery tabele + tabela migracji):**

```bash
docker compose exec db psql -U fishing -d fishing -c '\dt'
```
→ lista: `schema_migrations`, `sessions`, `spots`, `user_prefs`, `users`, `weather_cache`

**3. Frontend się serwuje:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8090/
```
→ `200`

**4. API wymaga zalogowania:**

```bash
curl -s http://localhost:8090/api/spots
```
→ `{"error":{"code":"unauthorized","message":"Zaloguj się, żeby korzystać z aplikacji."}}`

**5. Rejestracja i odczyt łowisk działają (pełna ścieżka przez bazę):**

```bash
curl -s -c /tmp/ck.txt -X POST http://localhost:8090/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"test@local","password":"haslo-testowe-123","displayName":"Test"}'

curl -s -b /tmp/ck.txt http://localhost:8090/api/spots | head -c 200
```
→ pierwsze polecenie zwraca `{"user":{...}}`, drugie listę czternastu łowisk
z okolic Koszalina, które konto dostaje na start.

Konto testowe usuniesz tak:

```bash
docker compose exec db psql -U fishing -d fishing -c "DELETE FROM users WHERE email = 'test@local';"
```

---

## 6. Załóż swoje konto

1. Wejdź z telefonu albo komputera na `http://192.168.1.38:8090`.
2. Kliknij **Nowe konto**, podaj e-mail (dowolny, nie jest weryfikowany),
   nazwę i hasło (min. 10 znaków).
3. Konto dostaje na start czternaście przykładowych łowisk z okolic Koszalina.
   Możesz je usuwać i dodawać własne.

Gdy masz już wszystkie potrzebne konta, **zamknij rejestrację**:

```bash
sed -i 's/^ALLOW_REGISTRATION=.*/ALLOW_REGISTRATION=false/' .env
docker compose up -d
```

Od tej chwili zakładka „Nowe konto" znika, a próba rejestracji przez API
kończy się odmową.

### Sprawdzenie synchronizacji telefon ↔ komputer

1. Zaloguj się na obu urządzeniach.
2. Na telefonie dodaj łowisko.
3. Na komputerze przełącz się na inną kartę i wróć — lista odświeża się przy
   powrocie do karty i nowe miejsce jest już na liście. To samo dzieje się przy
   każdym otwarciu aplikacji.

---

## 7. Kopia zapasowa

Cała Twoja zawartość — konta, łowiska, ustawienia — to jedna baza.

**Zrzut bazy:**

```bash
docker compose exec -T db pg_dump -U fishing fishing | gzip > ~/fishing-$(date +%F).sql.gz
```

**Odtworzenie:**

```bash
gunzip -c ~/fishing-2026-09-11.sql.gz | docker compose exec -T db psql -U fishing -d fishing
```

**Automat co noc** (`crontab -e`):

```cron
15 3 * * * cd /opt/fishing-forecast && docker compose exec -T db pg_dump -U fishing fishing | gzip > /root/backup/fishing-$(date +\%F).sql.gz
```

Pamiętaj też o kopii pliku `.env` — bez `SESSION_SECRET` odtworzona baza działa,
ale wszyscy zostaną wylogowani (dane zostają).

---

## 8. Aktualizacja

```bash
cd /opt/fishing-forecast
git pull
docker compose up -d --build
docker image prune -f
```

Migracje bazy uruchamiają się same przy starcie aplikacji — nie ma osobnego kroku.
Po aktualizacji odśwież stronę na telefonie **dwa razy** albo zamknij i otwórz
zainstalowaną aplikację: pierwsze wejście pobiera nowego service workera,
drugie przechodzi na nową powłokę.

---

## 9. Podgląd i diagnostyka

```bash
docker compose logs -f app          # logi serwera
docker compose logs -f db           # logi bazy
docker compose restart app          # restart samej aplikacji
docker compose down                 # zatrzymanie (dane zostają)
docker compose down -v              # zatrzymanie + SKASOWANIE BAZY
```

Wejście do bazy:

```bash
docker compose exec db psql -U fishing -d fishing
```

Przydatne zapytania:

```sql
SELECT email, display_name, created_at FROM users;
SELECT u.email, count(s.id) AS lowiska FROM users u LEFT JOIN spots s ON s.user_id = u.id GROUP BY u.email;
SELECT cache_key, fetched_at FROM weather_cache ORDER BY fetched_at DESC LIMIT 10;
```

---

## 10. Typowe problemy

### `SESSION_SECRET is required` / kontener aplikacji restartuje się w kółko

Brakuje `.env` albo jest pusty. Sprawdź `docker compose config` — pokaże, jakie
wartości faktycznie trafiają do kontenera.

### `Nie udało się połączyć z bazą po 30 próbach`

Baza nie wstała. Zajrzyj w `docker compose logs db`. Na LXC najczęstsza przyczyna
to wyłączone `keyctl` i `nesting` w opcjach kontenera (patrz punkt 0).

### Logowanie nie działa, choć hasło jest dobre

Sprawdź `COOKIE_SECURE` w `.env`. Przy dostępie po `http://` musi być `false`.

### Strona się otwiera, ale prognoza nie przychodzi

Teraz to **serwer** odpytuje Open-Meteo, więc problem jest po jego stronie:

```bash
docker compose exec app wget -qO- https://api.open-meteo.com/v1/forecast?latitude=54.28\&longitude=16.17\&current=temperature_2m
```

Jeśli to nie działa, kontener nie ma wyjścia do internetu albo DNS-u.

### „Brak danych o fali dla tego punktu"

Marine API nie pokrywa wód śródlądowych ani punktów tuż przy brzegu. Dodaj łowisko
morskie wskazane nieco dalej w stronę otwartej wody. Aplikacja świadomie nie
podstawia w takiej sytuacji żadnych wartości.

### Nie mogę zainstalować aplikacji na telefonie (brak „Dodaj do ekranu głównego")

Część przeglądarek instaluje PWA tylko po HTTPS. W LAN-ie po `http://` opcja może
być niedostępna — patrz następny punkt.

---

## 11. Opcjonalnie: HTTPS w sieci lokalnej

Potrzebne, jeśli chcesz instalować aplikację jako PWA na telefonie. Najprościej
przez Caddy na tym samym hoście:

```caddyfile
ryby.dom {
    reverse_proxy 127.0.0.1:8090
}
```

Po postawieniu HTTPS ustaw w `.env`:

```dotenv
COOKIE_SECURE=true
```

i przeładuj: `docker compose up -d`.

Wariant z nginx na hoście:

```nginx
server {
    listen 80;
    server_name ryby.dom;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Serwer ma włączone `trustProxy`, więc poprawnie odczyta adres klienta zza proxy —
ma to znaczenie dla limitu prób logowania.

---

## 12. Bezpieczeństwo — co jest zrobione, a co nie

**Zrobione:**

- hasła haszowane bcryptem (koszt 12), nigdy nie trafiają do logów,
- tokeny sesji trzymane w bazie jako HMAC z `SESSION_SECRET` — sam wyciek bazy
  nie pozwala przejąć sesji,
- ciasteczko `httpOnly` + `SameSite=Lax`,
- limit pięciu nieudanych logowań na adres IP w ciągu 15 minut,
- każde zapytanie o łowiska filtrowane po `user_id` — nie da się podejrzeć
  cudzych miejsc znając identyfikator,
- port bazy niewystawiony poza sieć Dockera,
- nagłówki `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.

**Czego nie ma, bo aplikacja jest pomyślana dla LAN-u:**

- resetu hasła przez e-mail (hasło zmienia się z poziomu API, mając stare),
- weryfikacji adresu e-mail,
- dwuskładnikowego logowania,
- szyfrowania połączenia — dodaje je dopiero reverse proxy z punktu 11.

Jeśli kiedyś wystawisz to na świat, zacznij od HTTPS, `COOKIE_SECURE=true`
i `ALLOW_REGISTRATION=false`.
