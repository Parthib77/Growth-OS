'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { hasPendingRequests, subscribeToRequestActivity } from './api-client';

const bars = Array.from({ length: 15 }, (_, index) => index);
const beads = Array.from({ length: 5 }, (_, index) => index);

export function LoadingWave() {
  const pending = useSyncExternalStore(subscribeToRequestActivity, hasPendingRequests, () => false);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const shownAt = useRef(0);

  useEffect(() => {
    const updateVisibility = () => setTabVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const delay = pending ? (visible ? 0 : 180) : Math.max(0, 360 - (Date.now() - shownAt.current));
    const timer = window.setTimeout(() => {
      if (pending) shownAt.current = Date.now();
      setVisible(pending);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pending, visible]);

  if (!visible || !tabVisible) return null;

  return (
    <div className="loading-wave" role="status" aria-label="Loading">
      <svg className="loading-wave-disc" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <clipPath id="loading-wave-disc-clip">
            <circle cx="32" cy="32" r="32" />
          </clipPath>
        </defs>
        <g clipPath="url(#loading-wave-disc-clip)">
          {bars.map((index) => {
            const x = 4 + index * 4;
            return (
              <line
                key={index}
                className="loading-wave-bar"
                x1={x}
                y1="0"
                x2={x}
                y2="64"
                style={{ animationDelay: `calc(${index} * var(--dur) * var(--rate) / -9)` }}
              />
            );
          })}
          {beads.map((index) => (
            <circle
              key={index}
              className="loading-wave-bead"
              cx={14.08 + index * 8.96}
              cy="32"
              r="2.5"
              style={{
                animationDelay: `calc(${index} * var(--dur) * var(--rate) / -7)`,
                transform: `translateY(${(index - 2) * 7}px)`,
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
