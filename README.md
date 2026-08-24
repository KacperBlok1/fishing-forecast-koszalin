# Czy warto iść na ryby?

Aplikacja webowa dla wędkarzy, która na podstawie aktualnej pogody i krótkiego trendu pogodowego odpowiada na proste pytanie: **czy dziś warto wybrać się nad wodę?**

Dla wybranej lokalizacji oblicza wynik w skali 0-100, pokazuje najlepsze godziny oraz rozkłada rekomendację na konkretne czynniki: wiatr, ciśnienie, opady, temperaturę, zachmurzenie i porę dnia. Tryb morski uwzględnia również dane o falach i temperaturze wody.

> Wynik jest wskazówką, a nie gwarancją brań. Przed wyjściem sprawdź ostrzeżenia pogodowe, bezpieczeństwo na łowisku i lokalne przepisy.

## Funkcje

- ocena warunków wędkarskich w skali 0-100;
- rekomendacja: **Idź na ryby**, **Warunkowo** albo **Lepiej odpuść**;
- wyszukiwanie polskich miast i wybór typu łowiska: jezioro, rzeka lub morze;
- bieżąca pogoda: temperatura, odczuwalna temperatura, wilgotność, opady, zachmurzenie, ciśnienie i wiatr;
- trend z poprzednich trzech dni;
- najlepsze okna czasowe na dziś i jutro;
- wykres prognozy godzinowej;
- szczegóły wyniku i opis metodologii;
- cache wyników w `localStorage` na 5 minut;
- responsywny interfejs dla telefonu i desktopu;
- obsługa stanów ładowania, błędów i ręcznego odświeżania.

## Jak działa wynik?

Wynik jest deterministycznym wskaźnikiem 0-100. Nie korzysta z AI, backendu ani płatnych usług.

| Czynnik | Wpływ |
| --- | --- |
| Wiatr | Lekki i umiarkowany wiatr zwykle pomaga, silny wiatr i porywy obniżają wynik |
| Ciśnienie | Lepsza jest wartość bliska optymalnej i stabilny trend |
| Opady | Umiarkowane opady są neutralne, intensywne obniżają ocenę |
| Temperatura | Uwzględniana jest wartość bieżąca oraz zmiana z ostatnich dni |
| Zachmurzenie | Częściowe zachmurzenie otrzymuje korzystniejszą ocenę |
| Pora dnia | Świt i zmierzch mogą zwiększać ocenę aktywności |
| Fale | W trybie morskim większe fale i silny wiatr obniżają wynik |

Pełne wagi i opisy progów są dostępne w aplikacji w panelu **Jak liczymy ocenę?**.

## Technologie

- React 19
- TypeScript
- Vite
- CSS
- Docker i Docker Compose
- Nginx
- Open-Meteo API

To aplikacja typu static frontend. Nie wymaga serwera API, bazy danych, logowania ani kluczy API.

## Źródła danych

Dane są pobierane z publicznych usług [Open-Meteo](https://open-meteo.com/): Forecast API, Historical Weather API, Marine API i Geocoding API.

Zapytania są wykonywane bezpośrednio z przeglądarki użytkownika. Urządzenie użytkownika musi mieć dostęp do internetu. Dane Open-Meteo są udostępniane na warunkach [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Uruchomienie lokalne

### Wymagania

- Node.js 20 lub nowszy;
- npm.

### Instalacja i development

```bash
git clone <URL_TWOJEGO_REPOZYTORIUM>
cd fishing-forecast-koszalin
npm ci
npm run dev
```

Vite wyświetli adres lokalnego serwera, zwykle `http://localhost:5173`.

### Build produkcyjny

```bash
npm run build
npm run preview
```

Pliki wynikowe zostaną zapisane w katalogu `dist/`.

## Wdrożenie na serwerze z Dockerem

### Wymagania

- Docker Engine;
- Docker Compose Plugin (`docker compose`);
- wolny port TCP, domyślnie `8090`.

### Szybkie wdrożenie

```bash
git clone <URL_TWOJEGO_REPOZYTORIUM> fishing-forecast-koszalin
cd fishing-forecast-koszalin
docker compose up -d --build
```

Sprawdź kontener i healthcheck:

```bash
docker compose ps
curl http://localhost:8090
```

Aplikacja będzie dostępna pod `http://ADRES_IP_SERWERA:8090`.

### Zmiana portu

Port hosta można zmienić bez edycji plików:

```bash
APP_PORT=8080 docker compose up -d --build
```

Na Windows PowerShell:

```powershell
$env:APP_PORT="8080"; docker compose up -d --build
```

### Aktualizacja i zatrzymanie

```bash
git pull
docker compose up -d --build
docker image prune -f
```

```bash
docker compose logs -f fishing-forecast
docker compose down
```

## Reverse proxy z domeną

W przypadku domeny użyj istniejącego Nginx, Caddy lub Traefika jako reverse proxy. Przykład dla Nginx na hoście:

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

Dla publicznej domeny skonfiguruj HTTPS, na przykład przez Certbota lub Caddy. Kontener nie przechowuje danych użytkowników ani certyfikatów.

## Struktura projektu

```text
.
├── public/images/       # obrazy i informacje o źródłach grafik
├── src/
│   ├── components/      # komponenty interfejsu
│   ├── services/        # Open-Meteo, geocoding i cache
│   ├── styles/          # style globalne i komponentowe
│   ├── types/           # typy TypeScript
│   ├── utils/           # scoring i formatowanie
│   ├── App.tsx
│   └── main.tsx
├── Dockerfile           # build Vite + produkcyjny Nginx
├── docker-compose.yml   # kontener i healthcheck
├── nginx.conf           # SPA fallback, cache i nagłówki HTTP
├── package.json
└── README.md
```

## Troubleshooting

### Kontener nie startuje

```bash
docker compose config
docker compose ps
docker compose logs fishing-forecast
```

Jeśli port jest zajęty, ustaw inny przez `APP_PORT`.

### Strona się otwiera, ale nie ma danych

Sprawdź internet na urządzeniu, z którego otwierasz aplikację. Dane pogodowe są pobierane przez przeglądarkę, więc dostęp internetowy samego kontenera nie wystarczy. Przy chwilowym błędzie Open-Meteo użyj przycisku odświeżania.

### Aplikacja działa na serwerze, ale nie z innego urządzenia

- użyj adresu IP serwera zamiast `localhost`;
- sprawdź firewall i otwarty port;
- upewnij się, że urządzenie jest w tej samej sieci, jeśli wdrażasz aplikację tylko w LAN.

Przykład UFW:

```bash
sudo ufw allow 8090/tcp
```

### Healthcheck ma status `unhealthy`

```bash
docker inspect --format='{{json .State.Health}}' fishing-forecast
```

Kontener powinien odpowiadać na `http://localhost:8090` wewnątrz kontenera. Po zmianie konfiguracji wykonaj ponownie `docker compose up -d --build`.

## Ograniczenia

- lokalna pogoda może różnić się od danych dla najbliższego punktu geograficznego;
- algorytm nie uwzględnia gatunku ryby, przynęty, przejrzystości i poziomu wody ani presji wędkarskiej;
- prognoza i dane historyczne mogą być czasowo niedostępne;
- aplikacja nie zastępuje oceny bezpieczeństwa ani znajomości lokalnych przepisów.

## Licencja

Projekt prywatny. Dane pogodowe pochodzą z [Open-Meteo](https://open-meteo.com/) i są objęte [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Informacje o wykorzystanych obrazach znajdują się w [public/images/CREDITS.md](public/images/CREDITS.md).
