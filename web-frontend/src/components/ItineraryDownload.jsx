import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Check, Loader2 } from 'lucide-react';
import { PERK_PDF_ITINERARY } from '../featureFlags';
import {
  buildStaticRouteMapUrl,
  sampleRouteElevation,
  elevationToSvg,
  deriveSchedule,
} from '../utils/itineraryPdf';
import ItineraryExportSheet, { SHEET_WIDTH, SHEET_HEIGHT } from './ItineraryExportSheet';
import './ItineraryDownload.css';

// Fetch a remote image and inline it as a data-URL so html2canvas never taints
// the canvas (Mapbox Static + Unsplash both send CORS headers, but inlining is
// the bullet-proof path). Resolves null on any failure so export still proceeds.
async function toDataUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function slugify(s) {
  return (s || 'trail')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trail';
}

/**
 * ItineraryDownload — "Itinerary postcard" perk.
 * One tap builds a designed one-page Day Hike Guide PDF entirely client-side.
 */
function ItineraryDownload({ trail }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [exportProps, setExportProps] = useState(null);
  const sheetRef = useRef(null);

  // When the off-screen sheet is mounted with data, rasterise → PDF → download.
  useEffect(() => {
    if (!exportProps || !sheetRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        // Let fonts + the inlined images settle before capture.
        if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* no-op */ } }
        await new Promise((r) => setTimeout(r, 120));
        if (cancelled) return;

        // Heavy libs (jspdf ~150kB, html2canvas) loaded on demand so they never
        // weigh down the TrailDetail route for users who don't export.
        const [{ jsPDF }, html2canvasMod] = await Promise.all([
          import('jspdf'),
          import('html2canvas'),
        ]);
        const html2canvas = html2canvasMod.default;
        if (cancelled) return;

        const canvas = await html2canvas(sheetRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#f4ecdc',
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
          windowWidth: SHEET_WIDTH,
          windowHeight: SHEET_HEIGHT,
        });
        if (cancelled) return;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
        pdf.save(`${slugify(trail.name)}-itinerary.pdf`);

        if (!cancelled) {
          setDone(true);
          setTimeout(() => setDone(false), 3500);
        }
      } catch (e) {
        console.error('Itinerary PDF export failed:', e);
      } finally {
        if (!cancelled) {
          setExportProps(null);
          setBusy(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [exportProps, trail.name]);

  if (!PERK_PDF_ITINERARY) return null;
  if (!Array.isArray(trail?.coordinates) || trail.coordinates.length < 2) return null;

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [heroImg, mapImg, elevSeries] = await Promise.all([
        toDataUrl(trail.image_url || trail.thumbnail),
        toDataUrl(buildStaticRouteMapUrl(trail)),
        sampleRouteElevation(trail),
      ]);
      const elev = elevationToSvg(elevSeries);
      const schedule = deriveSchedule(trail);
      // Mounting this triggers the capture effect.
      setExportProps({ trail, heroImg, mapImg, elev, schedule });
    } catch (e) {
      console.error('Itinerary PDF prep failed:', e);
      setBusy(false);
    }
  };

  return (
    <div className="itin">
      <div className="itin__head">
        <FileText size={18} strokeWidth={2} className="itin__head-icon" />
        <h3 className="itin__title">{t('trail.itineraryTitle', 'Itinerary postcard')}</h3>
      </div>

      <p className="itin__note">
        {t(
          'trail.itineraryNote',
          'Download a beautifully designed one-page guide for this hike — route map, elevation, highlights and Josephine’s notes. Perfect to print or share.',
        )}
      </p>

      <button className={`itin__btn${done ? ' itin__btn--done' : ''}`} onClick={handleExport} disabled={busy}>
        {busy
          ? <><Loader2 size={16} strokeWidth={2.5} className="itin__spin" /> {t('trail.itineraryBuilding', 'Preparing your guide…')}</>
          : done
            ? <><Check size={16} strokeWidth={2.5} /> {t('trail.downloaded', 'Downloaded')}</>
            : <><FileText size={16} strokeWidth={2} /> {t('trail.itineraryDownload', 'Download itinerary (PDF)')}</>}
      </button>

      {/* Off-screen render target for html2canvas */}
      {exportProps && (
        <div className="itin__offscreen" aria-hidden="true">
          <div ref={sheetRef}>
            <ItineraryExportSheet {...exportProps} />
          </div>
        </div>
      )}
    </div>
  );
}

export default ItineraryDownload;
