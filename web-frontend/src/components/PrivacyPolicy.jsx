import React from 'react';
import { useTranslation } from 'react-i18next';
import './TermsAndConditions.css';

function PrivacyPolicy({ onBack }) {
  const { t } = useTranslation();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="back-button" onClick={onBack}>
          ← {t('common.back')}
        </button>

        <h1 className="legal-title">{t('legal.privacyTitle')}</h1>
        <p className="legal-updated">{t('legal.lastUpdated')}: October 26, 2025</p>

        <div className="legal-content">
          <section className="legal-section">
            <h2>1. {t('legal.introduction')}</h2>
            <p>
              Alpenvia ("we", "our", "us") respects your privacy and is committed to protecting 
              your personal data. This Privacy Policy explains what data we collect, how we use it, 
              and your rights regarding your data.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. {t('legal.dataWeCollect')}</h2>
            
            <h3>2.1 Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul>
              <li>Email address</li>
              <li>Display name</li>
              <li>Password (encrypted)</li>
              <li>Authentication provider (Google OAuth if used)</li>
            </ul>

            <h3>2.2 GPS Location Data</h3>
            <p>When you use hike tracking features, we collect:</p>
            <ul>
              <li>Real-time GPS coordinates during active hikes</li>
              <li>Completed hike routes and GPS tracks</li>
              <li>Altitude, speed, and movement data</li>
              <li>Timestamps of location points</li>
            </ul>
            <p><strong>Important:</strong> GPS tracking only occurs when you explicitly start a hike. 
            We do not track your location when you're not actively using the hike tracking feature.</p>

            <h3>2.3 Usage Data</h3>
            <ul>
              <li>Trails you view, save, or complete</li>
              <li>Reviews and ratings you submit</li>
              <li>Badges and achievements earned</li>
              <li>Search queries and filters used</li>
              <li>App settings and preferences (language, units)</li>
            </ul>

            <h3>2.4 Device Information</h3>
            <ul>
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>IP address</li>
              <li>Device identifiers</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. {t('legal.howWeUseData')}</h2>
            <p>We use your data to:</p>
            <ul>
              <li><strong>Provide the service:</strong> Account management, hike tracking, trail recommendations</li>
              <li><strong>Improve features:</strong> Analyze usage patterns to enhance the app</li>
              <li><strong>Safety:</strong> Store completed hike routes for emergency reference and statistics</li>
              <li><strong>Gamification:</strong> Track progress, award badges, and display leaderboard rankings</li>
              <li><strong>Communication:</strong> Send personalized hiking tips, challenge notifications, and safety alerts</li>
              <li><strong>Customer support:</strong> Respond to inquiries and provide assistance</li>
              <li><strong>Payments:</strong> Process subscription payments (handled by Stripe)</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. {t('legal.dataStorage')}</h2>
            <p>
              Your data is stored securely on our servers. GPS tracks and hike data are stored 
              in your user account and can be deleted at any time from your profile settings.
            </p>
            <p>
              <strong>Local Storage:</strong> Some data (preferences, saved trails, offline maps) 
              is stored locally on your device for offline functionality.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. {t('legal.dataSharingTitle')}</h2>
            <p>
              <strong>We do NOT sell your personal data to third parties.</strong>
            </p>
            <p>We share data only in these limited circumstances:</p>
            <ul>
              <li><strong>Emergency Sharing:</strong> When you explicitly use "Share Live Location", 
              your real-time GPS position is shared via a temporary link you control</li>
              <li><strong>Service Providers:</strong> Firebase (authentication), Mapbox (maps), 
              Stripe (payments) process data on our behalf under strict privacy agreements</li>
              <li><strong>Legal Requirements:</strong> If required by law or to protect rights and safety</li>
              <li><strong>Leaderboards:</strong> If you opt-in to leaderboards, your display name and 
              statistics are publicly visible</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. {t('legal.thirdPartyServices')}</h2>
            <p>We use the following third-party services:</p>
            <ul>
              <li><strong>Firebase:</strong> Authentication and user management</li>
              <li><strong>Mapbox:</strong> Map display and route visualization</li>
              <li><strong>Open-Meteo:</strong> Weather data</li>
              <li><strong>Stripe:</strong> Payment processing</li>
              <li><strong>OpenAI:</strong> AI chatbot assistance</li>
            </ul>
            <p>Each service has its own privacy policy governing data they collect.</p>
          </section>

          <section className="legal-section">
            <h2>7. {t('legal.yourRights')}</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update incorrect or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and all associated data</li>
              <li><strong>Export:</strong> Download your hike data in GPX format</li>
              <li><strong>Opt-out:</strong> Disable leaderboards, notifications, or personalized tips</li>
              <li><strong>Withdraw Consent:</strong> Stop GPS tracking at any time</li>
            </ul>
            <p>To exercise these rights, contact us through the support chat or settings page.</p>
          </section>

          <section className="legal-section">
            <h2>8. {t('legal.dataSecurity')}</h2>
            <p>We implement security measures to protect your data:</p>
            <ul>
              <li>Encrypted connections (HTTPS)</li>
              <li>Password hashing and secure authentication</li>
              <li>Regular security updates</li>
              <li>Access controls and monitoring</li>
            </ul>
            <p>
              However, no method of transmission over the internet is 100% secure. 
              You acknowledge the inherent security risks.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. {t('legal.dataRetention')}</h2>
            <p>We retain your data:</p>
            <ul>
              <li><strong>Account data:</strong> Until you delete your account</li>
              <li><strong>GPS tracks:</strong> Until you delete individual hikes or your account</li>
              <li><strong>Reviews:</strong> Until you delete them or your account</li>
              <li><strong>Analytics:</strong> Aggregated and anonymized data may be retained indefinitely</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>10. {t('legal.cookies')}</h2>
            <p>
              We use essential cookies and local storage for authentication, preferences, 
              and offline functionality. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. {t('legal.childrenPrivacy')}</h2>
            <p>
              Alpenvia is not intended for users under 13 years of age. We do not knowingly 
              collect data from children under 13. If we discover such data, we will delete it promptly.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. {t('legal.gdprCompliance')}</h2>
            <p>
              For users in the European Union, we comply with GDPR requirements. 
              You have additional rights including data portability and the right to lodge 
              a complaint with a supervisory authority.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. {t('legal.policyChanges')}</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of significant 
              changes via email or in-app notification. Continued use after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>14. {t('legal.contact')}</h2>
            <p>
              For privacy-related questions or to exercise your rights, contact us through 
              the support chat in the application or via the settings page.
            </p>
          </section>
        </div>

        <div className="legal-footer">
          <p><strong>{t('legal.privacyCommitment')}</strong></p>
          <p>
            We are committed to protecting your privacy and handling your data responsibly. 
            Your trust is important to us.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
