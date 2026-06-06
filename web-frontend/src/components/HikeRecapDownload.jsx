import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Check, Loader2 } from 'lucide-react';
import { PERK_PDF_ITINERARY } from '../featureFlags';
import {
  buildTrackMapUrl,
  trackElevationSeries,
  recapStatsFromTrack,
  elevationToSvg,
  toDataUrl,
  slugify,
} from '../utils/itineraryPdf';
import HikeRecapSheet, { RCP_WIDTH, RCP_HEIGHT } from './HikeRecapSheet';
import './ItineraryDownload.css';

/**
 * HikeRecapDownload — one-tap post-hike "Trip Recap" PDF. Renders as a ghost
 * action button (designed to live on the HikeComplete screen). All figures come
 * from the recorded hike; nothing is invented.
 */
function HikeRecapDownload({ hikeData, trail, className = 'hc-btn hc-btn--ghost' }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [exportProps, setExportProps] = useState(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!exportProps || !sheetRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* no-op */ } }
        await new Promise((r) => setTimeout(r, 120));
        if (cancelled) return;

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
          width: RCP_WIDTH,
          height: RCP_HEIGHT,
          windowWidth: RCP_WIDTH,
          windowHeight: RCP_HEIGHT,
        });
        if (cancelled) return;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
        pdf.save(`${slugify(hikeData?.trail_name || trail?.name)}-recap.pdf`);

        if (!cancelled) { setDone(true); setTimeout(() => setDone(false), 3500); }
      } catch (e) {
        console.error('Recap PDF export failed:', e);
      } finally {
        if (!cancelled) { setExportProps(null); setBusy(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [exportProps, hikeData, trail]);

  if (!PERK_PDF_ITINERARY) return null;
  if (!hikeData?.stats) return null;

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const track = hikeData.gps_track || [];
      const gallery = Array.isArray(trail?.gallery) ? trail.gallery.slice(0, 4) : [];
      const [mapImg, ...photos] = await Promise.all([
        toDataUrl(buildTrackMapUrl(track)),
        ...gallery.map((g) => toDataUrl(g)),
      ]);
      const elev = elevationToSvg(trackElevationSeries(track));
      const recap = recapStatsFromTrack(track);
      setExportProps({
        hikeData, trail, mapImg, elev, recap,
        photos: photos.filter(Boolean),
      });
    } catch (e) {
      console.error('Recap PDF prep failed:', e);
      setBusy(false);
    }
  };

  return (
    <>
      <button className={className} onClick={handleExport} disabled={busy}>
        {busy
          ? <><Loader2 size={15} strokeWidth={2.5} className="itin__spin" /> {t('recap.building', 'Preparing recap…')}</>
          : done
            ? <><Check size={15} strokeWidth={2.5} /> {t('trail.downloaded', 'Downloaded')}</>
            : <><FileText size={15} strokeWidth={2} /> {t('recap.download', 'Download recap (PDF)')}</>}
      </button>

      {exportProps && (
        <div className="itin__offscreen" aria-hidden="true">
          <div ref={sheetRef}>
            <HikeRecapSheet {...exportProps} />
          </div>
        </div>
      )}
    </>
  );
}

export default HikeRecapDownload;
