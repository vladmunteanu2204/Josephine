import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './SplashScreen.css';

function SplashScreen({ onComplete }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const minDisplayTime = 2400;
    const startTime = Date.now();

    const checkIfReady = () => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        setPhase('exit');
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 900);
      }, remainingTime);
    };

    if (document.readyState === 'complete') {
      checkIfReady();
    } else {
      window.addEventListener('load', checkIfReady);
      return () => window.removeEventListener('load', checkIfReady);
    }
  }, [onComplete]);

  return (
    <div className={`jph-splash ${phase === 'exit' ? 'jph-splash--exit' : ''}`}>

      {/* ── Cinematic SVG mountain background ── */}
      <svg
        className="jph-splash__bg"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#050c06"/>
            <stop offset="45%"  stopColor="#0e1a10"/>
            <stop offset="68%"  stopColor="#1a2a10"/>
            <stop offset="80%"  stopColor="#6b4a18" stopOpacity="0.9"/>
            <stop offset="88%"  stopColor="#c47a1e" stopOpacity="0.75"/>
            <stop offset="94%"  stopColor="#d4922a" stopOpacity="0.6"/>
            <stop offset="100%" stopColor="#8b5e14" stopOpacity="0.4"/>
          </linearGradient>
          <radialGradient id="sunGlow" cx="55%" cy="73%" r="35%">
            <stop offset="0%"  stopColor="#e8a830" stopOpacity="0.55"/>
            <stop offset="40%" stopColor="#c47820" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#1a2a1c" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="rimLight" cx="50%" cy="70%" r="60%">
            <stop offset="0%"  stopColor="#c9a84c" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#1a2a1c" stopOpacity="0"/>
          </radialGradient>
          <filter id="sfBlur" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="2"/>
          </filter>
          <filter id="sfGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Sky */}
        <rect width="800" height="900" fill="url(#skyGrad)"/>
        <rect width="800" height="900" fill="url(#sunGlow)"/>
        <rect width="800" height="900" fill="url(#rimLight)"/>

        {/* Stars */}
        {[
          [80,60,1.4],[140,35,1.0],[210,50,0.8],[310,25,1.2],[420,40,0.9],
          [530,30,1.1],[650,55,0.7],[720,38,1.3],[760,70,0.9],[50,110,0.8],
          [170,95,1.0],[390,80,0.7],[580,100,1.1],[690,115,0.8]
        ].map(([cx,cy,r],i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#e8dcc8" opacity={0.5 + Math.random()*0.3}/>
        ))}

        {/* Far distant peaks */}
        <path
          d="M 0 680 L 60 595 L 120 620 L 185 560 L 240 585 L 295 545 L 355 570
             L 400 530 L 450 555 L 510 520 L 565 545 L 620 510 L 680 535
             L 730 505 L 800 530 L 800 900 L 0 900 Z"
          fill="#1a2b1c" opacity="0.55" filter="url(#sfBlur)"/>

        {/* Mid mountain layer */}
        <path
          d="M 0 700 L 80 630 L 145 660 L 200 615 L 260 640 L 320 600 L 390 625
             L 440 585 L 510 615 L 570 578 L 640 608 L 700 570 L 800 598
             L 800 900 L 0 900 Z"
          fill="#162414" opacity="0.7"/>

        {/* Closer ridge with golden rim light */}
        <path
          d="M 0 740 L 100 675 L 175 700 L 240 660 L 310 688 L 380 650 L 450 672
             L 520 638 L 590 665 L 660 632 L 730 658 L 800 640 L 800 900 L 0 900 Z"
          fill="#10200f" opacity="0.85"/>
        {/* Rim-light glow on ridge */}
        <path
          d="M 0 740 L 100 675 L 175 700 L 240 660 L 310 688 L 380 650 L 450 672
             L 520 638 L 590 665 L 660 632 L 730 658 L 800 640"
          fill="none" stroke="#c9a84c" strokeWidth="1.2" opacity="0.3"/>

        {/* Foreground dark terrain */}
        <path
          d="M 0 800 L 120 755 L 230 770 L 350 748 L 480 762 L 600 745 L 800 758
             L 800 900 L 0 900 Z"
          fill="#0a1409"/>

        {/* Path / trail winding up from bottom-center */}
        <path
          d="M 360 900 Q 355 850 365 820 Q 375 790 370 760 Q 365 730 380 710
             Q 390 695 400 680"
          fill="none" stroke="#c9a84c" strokeWidth="2" opacity="0.18" strokeLinecap="round"/>

        {/* Female hiker silhouette – small figure, lower center-left, walking uphill */}
        <g transform="translate(340, 748)" opacity="0.92">
          {/* Head */}
          <circle cx="18" cy="-58" r="7" fill="#0a1409"/>
          {/* Hair flowing back */}
          <path d="M 13 -63 Q 4 -67 6 -59 Q 8 -54 13 -56" fill="#0a1409"/>
          {/* Torso (angled forward/uphill) */}
          <path d="M 18 -51 L 16 -30" stroke="#0a1409" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
          {/* Backpack (behind = left side) */}
          <path d="M 14 -47 Q 7 -44 8 -35 Q 8 -28 14 -28"
                fill="none" stroke="#0a1409" strokeWidth="4.5" strokeLinecap="round"/>
          {/* Right arm forward, holding pole */}
          <path d="M 17 -40 L 26 -30" stroke="#0a1409" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          {/* Left arm back */}
          <path d="M 16 -40 L 10 -36" stroke="#0a1409" strokeWidth="3" strokeLinecap="round" fill="none"/>
          {/* Right leg (forward step) */}
          <path d="M 16 -30 L 22 -10" stroke="#0a1409" strokeWidth="5" strokeLinecap="round" fill="none"/>
          {/* Left leg (back step) */}
          <path d="M 16 -30 L 10 -10" stroke="#0a1409" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
          {/* Boot front */}
          <path d="M 22 -10 L 26 -8" stroke="#0a1409" strokeWidth="4" strokeLinecap="round" fill="none"/>
          {/* Boot back */}
          <path d="M 10 -10 L 6 -10" stroke="#0a1409" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          {/* Hiking pole */}
          <path d="M 26 -30 L 34 -2" stroke="#0a1409" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </g>

        {/* Second smaller hiker silhouette further up the trail */}
        <g transform="translate(372, 710)" opacity="0.5">
          <circle cx="10" cy="-32" r="4" fill="#0a1409"/>
          <path d="M 10 -28 L 9 -17" stroke="#0a1409" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
          <path d="M 9 -17 L 12 -5" stroke="#0a1409" strokeWidth="3" strokeLinecap="round" fill="none"/>
          <path d="M 9 -17 L 6 -5" stroke="#0a1409" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          <path d="M 12 -22 L 16 -15" stroke="#0a1409" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M 16 -15 L 20 -2" stroke="#0a1409" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </g>
      </svg>

      {/* ── Vignette overlay ── */}
      <div className="jph-splash__vignette" aria-hidden="true"/>

      {/* ── Logo mark (top center) ── */}
      <div className="jph-splash__mark">
        <img
          src="/josephine-mark.svg"
          alt="Josephine"
          className="jph-splash__mark-img"
          draggable="false"
        />
      </div>

      {/* ── Wordmark + tagline ── */}
      <div className="jph-splash__brand">
        <h1 className="jph-splash__wordmark">Josephine</h1>
        <p className="jph-splash__tagline">YOUR HUMAN ALPINE COMPANION</p>
      </div>

      {/* ── Bottom: origin + progress + loading text ── */}
      <div className="jph-splash__bottom">
        <p className="jph-splash__origin">Crafted in South Tyrol, Italy</p>
        <div className="jph-splash__progress-track" role="progressbar" aria-label="Loading">
          <div className="jph-splash__progress-fill"/>
        </div>
        <p className="jph-splash__loading-text">Preparing your next adventure…</p>
      </div>

    </div>
  );
}

export default SplashScreen;
