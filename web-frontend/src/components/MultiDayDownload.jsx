import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Check, Loader2 } from 'lucide-react';
import { PERK_PDF_ITINERARY } from '../featureFlags';
import {
  buildTrekMapUrl,
  sampleTrekElevation,
  elevationToSvg,
  toDataUrl,
  slugify,
} from '../utils/itineraryPdf';
import MultiDayExportSheet, { MDE_WIDTH, MDE_HEIGHT } from './MultiDayExportSheet';
import './ItineraryDownload.css';

/**
 * MultiDayDownload — "Trek guide" perk for multi-day treks.
 * One tap builds a designed multi-page hut-to-hut PDF entirely client-side.
 */
function MultiDayDownload({ trail }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [exportProps, setExportProps] = useState(null);
  const wrapRef = useRef(null);

  // When the off-screen sheet is mounted with data, rasterise each page → PDF.
  useEffect(() => {
    if (!exportProps || !wrapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* no-op */ } }
        await new Promise((r) => setTimeout(r, 140));
        if (cancelled) return;

        const [{ jsPDF }, html2canvasMod] = await Promise.all([
          import('jspdf'),
          import('html2canvas'),
        ]);
        const html2canvas = html2canvasMod.default;
        if (cancelled) return;

        const pages = Array.from(wrapRef.current.querySelectorAll('.mde-page'));
        if (pages.length === 0) throw new Error('No pages to export');

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        for (let i = 0; i < pages.length; i++) {
          // eslint-disable-next-line no-await-in-loop
          const canvas = await html2canvas(pages[i], {
            scale: 2,
            useCORS: true,
            backgroundColor: '#f4ecdc',
            width: MDE_WIDTH,
            height: MDE_HEIGHT,
            windowWidth: MDE_WIDTH,
            windowHeight: MDE_HEIGHT,
          });
          if (cancelled) return;
          if (i > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
        }

        pdf.save(`${slugify(trail.name)}-trek-guide.pdf`);

        if (!cancelled) {
          setDone(true);
          setTimeout(() => setDone(false), 3500);
        }
      } catch (e) {
        console.error('Trek PDF export failed:', e);
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
  if (!Array.isArray(trail?.stages) || trail.stages.length === 0) return null;

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [heroImg, mapImg, elevSeries] = await Promise.all([
        toDataUrl(trail.hero_image || trail.thumbnail),
        toDataUrl(buildTrekMapUrl(trail)),
        sampleTrekElevation(trail),
      ]);
      const elev = elevationToSvg(elevSeries);
      setExportProps({ trail, heroImg, mapImg, elev });
    } catch (e) {
      console.error('Trek PDF prep failed:', e);
      setBusy(false);
    }
  };

  return (
    <div className="itin">
      <div className="itin__head">
        <FileText size={18} strokeWidth={2} className="itin__head-icon" />
        <h3 className="itin__title">{t('trek.guideTitle', 'Trek guide (PDF)')}</h3>
      </div>

      <p className="itin__note">
        {t(
          'trek.guideNote',
          'Download a designed multi-page guide for this hut-to-hut trek — overview map, elevation, every stage, rifugios, packing list and emergency contacts. Perfect to print or carry offline.',
        )}
      </p>

      <button className={`itin__btn${done ? ' itin__btn--done' : ''}`} onClick={handleExport} disabled={busy}>
        {busy
          ? <><Loader2 size={16} strokeWidth={2.5} className="itin__spin" /> {t('trek.guideBuilding', 'Preparing your trek guide…')}</>
          : done
            ? <><Check size={16} strokeWidth={2.5} /> {t('trail.downloaded', 'Downloaded')}</>
            : <><FileText size={16} strokeWidth={2} /> {t('trek.guideDownload', 'Download trek guide (PDF)')}</>}
      </button>

      {/* Off-screen render target for html2canvas */}
      {exportProps && (
        <div className="itin__offscreen" aria-hidden="true">
          <div ref={wrapRef}>
            <MultiDayExportSheet {...exportProps} />
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiDayDownload;
