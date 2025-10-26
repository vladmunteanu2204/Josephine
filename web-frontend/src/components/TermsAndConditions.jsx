import React from 'react';
import { useTranslation } from 'react-i18next';
import './TermsAndConditions.css';

function TermsAndConditions({ onBack }) {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="back-button" onClick={onBack}>
          ← {t('common.back')}
        </button>

        <h1 className="legal-title">{t('legal.termsTitle')}</h1>
        <p className="legal-updated">{t('legal.lastUpdated')}: October 26, 2025</p>

        <div className="legal-content">
          <section className="legal-section">
            <h2>1. {t('legal.acceptance')}</h2>
            <p>
              By accessing and using Alpenvia, you accept and agree to be bound by these Terms and Conditions. 
              If you do not agree to these terms, please do not use this application.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. {t('legal.informationalPurpose')}</h2>
            <p>
              Alpenvia provides hiking trail information for <strong>informational purposes only</strong>. 
              The application does not guarantee the accuracy, completeness, safety, or accessibility of any trail information.
            </p>
            <p>
              Trail conditions, weather, closures, and hazards can change rapidly. Users must verify current 
              conditions with local authorities, park services, and official sources before hiking.
            </p>
          </section>

          <section className="legal-section warning-section">
            <h2>3. {t('legal.assumptionOfRisk')}</h2>
            <p>
              <strong>Hiking and outdoor activities involve inherent risks including but not limited to:</strong>
            </p>
            <ul>
              <li>Injury, illness, or death</li>
              <li>Adverse weather conditions (storms, lightning, avalanches, rockfall)</li>
              <li>Wildlife encounters</li>
              <li>Getting lost or disoriented</li>
              <li>Equipment failure</li>
              <li>Medical emergencies in remote areas</li>
              <li>Trail closures or restricted access</li>
            </ul>
            <p>
              <strong>You acknowledge and accept all risks</strong> associated with hiking and outdoor activities. 
              You agree that you are solely responsible for your own safety and well-being.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. {t('legal.noLiability')}</h2>
            <p>
              <strong>Alpenvia and its creators, operators, and affiliates are NOT responsible or liable for:</strong>
            </p>
            <ul>
              <li>Any injuries, accidents, incidents, or deaths occurring during hiking activities</li>
              <li>Inaccurate, outdated, or incomplete trail information</li>
              <li>GPS tracking errors or inaccuracies</li>
              <li>Technical failures, app crashes, or service interruptions</li>
              <li>Lost or damaged property</li>
              <li>Medical emergencies or inability to access emergency services</li>
              <li>Trail closures, access restrictions, or regulatory changes</li>
            </ul>
            <p>
              You use this application entirely at your own risk.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. {t('legal.gpsTracking')}</h2>
            <p>
              GPS tracking features are provided as a <strong>supplementary tool only</strong> and should 
              never replace proper navigation equipment, physical maps, or hiking preparation.
            </p>
            <p>
              <strong>GPS Limitations:</strong>
            </p>
            <ul>
              <li>GPS accuracy can vary (5-50m or more in mountainous terrain)</li>
              <li>Signal may be lost in dense forests, canyons, or adverse weather</li>
              <li>Battery drain can occur during extended tracking</li>
              <li>Off-trail alerts may have false positives or miss actual deviations</li>
              <li>Emergency share location requires internet connectivity</li>
            </ul>
            <p>
              Always carry physical maps, compass, and backup navigation tools.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. {t('legal.userResponsibilities')}</h2>
            <p>
              <strong>Users must:</strong>
            </p>
            <ul>
              <li>Verify current trail conditions with local authorities before hiking</li>
              <li>Check weather forecasts and prepare accordingly</li>
              <li>Inform someone of hiking plans and expected return time</li>
              <li>Carry appropriate equipment, water, food, and emergency supplies</li>
              <li>Know their physical limitations and choose appropriate trails</li>
              <li>Follow all local regulations, park rules, and trail signage</li>
              <li>Respect private property and closed areas</li>
              <li>Practice Leave No Trace principles</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>7. {t('legal.emergencyServices')}</h2>
            <p>
              In case of emergency, <strong>call local emergency services immediately:</strong>
            </p>
            <ul>
              <li><strong>Europe: 112</strong></li>
              <li><strong>Italy: 118</strong> (medical) / <strong>1515</strong> (forest rangers)</li>
              <li><strong>Mountain Rescue (South Tyrol): +39 0471 797 397</strong></li>
            </ul>
            <p>
              Alpenvia's emergency share location feature is a <strong>supplementary tool</strong> and 
              does not replace calling emergency services.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. {t('legal.dataAccuracy')}</h2>
            <p>
              While we strive to provide accurate trail information, we make no warranties regarding:
            </p>
            <ul>
              <li>Trail distances, elevation gains, or duration estimates</li>
              <li>Trail difficulty ratings</li>
              <li>Weather forecasts or conditions</li>
              <li>Points of interest locations</li>
              <li>User reviews or ratings</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>9. {t('legal.thirdPartyServices')}</h2>
            <p>
              Alpenvia uses third-party services (maps, weather, authentication) that have their own 
              terms of service. We are not responsible for the availability, accuracy, or reliability 
              of these services.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. {t('legal.subscriptionPayments')}</h2>
            <p>
              Premium subscriptions are billed according to selected plan (monthly/annual). 
              Payments are non-refundable except as required by law. You may cancel anytime, 
              and access continues until the end of the current billing period.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. {t('legal.modifications')}</h2>
            <p>
              We reserve the right to modify these Terms and Conditions at any time. 
              Continued use of the application constitutes acceptance of updated terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. {t('legal.governingLaw')}</h2>
            <p>
              These terms are governed by the laws of Italy. Any disputes shall be resolved 
              in the courts of South Tyrol, Italy.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. {t('legal.contact')}</h2>
            <p>
              For questions regarding these Terms and Conditions, please contact us through 
              the support chat in the application.
            </p>
          </section>
        </div>

        <div className="legal-footer">
          <p><strong>{t('legal.acknowledgment')}</strong></p>
          <p>
            By using Alpenvia, you acknowledge that you have read, understood, and agree to 
            be bound by these Terms and Conditions.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TermsAndConditions;
