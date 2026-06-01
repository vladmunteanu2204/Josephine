import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { detectSeason, getSeasonConfig } from '../hooks/useSeason';

// Apply tokens synchronously before first render to avoid flash of unstyled content
const _forced = new URLSearchParams(window.location.search).get('season');
const _initSeason = _forced || detectSeason();
const _initConfig = getSeasonConfig(_initSeason);
const _root = document.documentElement;
Object.entries(_initConfig.tokens).forEach(([k, v]) => _root.style.setProperty(k, v));
_root.setAttribute('data-season', _initSeason);

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
  const season = useMemo(() => _initSeason, []);
  const config = useMemo(() => _initConfig, []);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(config.tokens).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute('data-season', season);
  }, [config, season]);

  return (
    <SeasonContext.Provider value={{ season, config }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);
