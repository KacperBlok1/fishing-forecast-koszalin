import { useState } from 'react';
import { Wind, Gauge, CloudRain, Thermometer, CloudSun, Clock, Waves, ChevronDown, ChevronUp } from 'lucide-react';

const methodologyData = [
  {
    icon: <Wind size={18} />,
    weight: '25%',
    title: 'Wiatr',
    description: 'Lekki i umiarkowany wiatr sprzyja wędkarstwu. Silny wiatr i gwałtowne podmuchy obniżają ocenę. Progi zależą od typu łowiska.',
  },
  {
    icon: <Gauge size={18} />,
    weight: '15%',
    title: 'Ciśnienie',
    description: 'Ciśnienie bliskie 1013 hPa jest optymalne. Stabilne lub łagodnie zmieniające się ciśnienie jest korzystniejsze niż gwałtowne zmiany.',
  },
  {
    icon: <CloudRain size={18} />,
    weight: '15%',
    title: 'Opady',
    description: 'Umiarkowane opady są neutralne, intensywne opady obniżają ocenę. Analizowane są opady bieżące oraz trend z ostatnich 3 dni.',
  },
  {
    icon: <Thermometer size={18} />,
    weight: '10%',
    title: 'Temperatura',
    description: 'Temperatura 10-20°C jest optymalna. Uwzględniana jest temperatura bieżąca, odczuwalna oraz trend temperaturowy z 3 dni.',
  },
  {
    icon: <CloudSun size={18} />,
    weight: '10%',
    title: 'Zachmurzenie',
    description: 'Częściowe zachmurzenie (30-70%) jest często korzystniejsze. Pełne zachmurzenie lub bezchmurne niebo mają nieco niższą ocenę.',
  },
  {
    icon: <Clock size={18} />,
    weight: '10%',
    title: 'Pora dnia',
    description: 'Świt (5-7) i zmierzch (18-21) to szczyt aktywności ryb. Godziny dzienne mają umiarkowaną ocenę, noc — najniższą.',
  },
  {
    icon: <Waves size={18} />,
    weight: '15%',
    title: 'Dane morskie',
    description: 'Tylko w trybie morze. Wysokość fali, kierunek i temperatura wody wpływają na bezpieczeństwo i komfort wędkowania.',
  },
];

export default function MethodologyAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="card card-methodology reveal">
      <div className="card-header">
        <h2>Jak liczymy ocenę?</h2>
        <p className="methodology-intro">
          Wynik 0-100 to deterministyczny wskaźnik oparty na rzeczywistych danych pogodowych z Open-Meteo.
        </p>
      </div>

      <div className="verdict-ranges">
        <div className="verdict-range verdict-good">
          <strong>75-100</strong>
          <span>Idź na ryby</span>
        </div>
        <div className="verdict-range verdict-mid">
          <strong>45-74</strong>
          <span>Warunkowo</span>
        </div>
        <div className="verdict-range verdict-bad">
          <strong>0-44</strong>
          <span>Lepiej odpuść</span>
        </div>
      </div>

      <div className="accordion">
        {methodologyData.map((item, i) => (
          <div key={i} className={`accordion-item ${openIndex === i ? 'open' : ''}`}>
            <button
              className="accordion-trigger"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              aria-expanded={openIndex === i}
            >
              <span className="accordion-icon">{item.icon}</span>
              <span className="accordion-title">
                {item.title}
                <span className="accordion-weight">({item.weight})</span>
              </span>
              {openIndex === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div className="accordion-content">
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="methodology-disclaimer">
        Uwaga: Ocena nie gwarantuje brań ryb. Sprawdź bezpieczeństwo i lokalne przepisy.
      </p>
    </div>
  );
}
