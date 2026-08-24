import { useEffect, useState } from 'react';

interface LoadingIntroProps {
  onComplete: () => void;
}

export default function LoadingIntro({ onComplete }: LoadingIntroProps) {
  const [exiting, setExiting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onComplete, 800);
    }, 1400);
    return () => clearTimeout(timer);
  }, [ready, onComplete]);

  return (
    <div
      className={`loading-intro ${exiting ? 'intro-exit' : ''} ${ready ? 'loading-intro-ready' : ''}`}
    >
      <div className="loading-intro-content">
        <div className="loading-intro-logo">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="loading-intro-icon"
          >
            <path d="M2 18c1-1 2.5-3 4.5-4s4-1 6 1 3 4 4 5" />
            <path d="M14 8c1.5-1 3-1 5 0" />
            <circle cx="17" cy="5" r="1.5" />
            <path d="M5 17c1.5-1 3-2 5-1.5s3 2 4 3" />
            <line x1="12" y1="3" x2="12" y2="7" />
            <path d="M10 5l2-2 2 2" />
          </svg>
        </div>
        <h1 className="loading-intro-title">Czy warto iść na ryby?</h1>
        <div className="loading-line" />
      </div>
    </div>
  );
}
