import { useEffect, useState } from 'react'
import { BRAND } from '../lib/brand.js'
import { appInfo } from '../api/ipc.js'

// Shared building blocks for the long-form content pages.
function Prose({ children }) {
  return <div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
}
function H2({ children }) {
  return <h2 className="mt-6 text-base font-semibold text-slate-800 dark:text-slate-100">{children}</h2>
}
function Bullets({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}
function ExtLink({ href, children }) {
  return (
    <button className="text-brand-600 hover:underline dark:text-brand-400" onClick={() => appInfo.openExternal(href)}>
      {children}
    </button>
  )
}

export function AboutPage() {
  const [version, setVersion] = useState('…')
  useEffect(() => {
    appInfo.version().then((v) => setVersion(v.version)).catch(() => setVersion('unknown'))
  }, [])

  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white">M</div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{BRAND.appName}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Version {version} · by {BRAND.company}</p>
        </div>
      </div>
      <Prose>
        <p>{BRAND.tagline}</p>
        <H2>About the app</H2>
        <p>{BRAND.description}</p>
        <H2>Purpose</H2>
        <p>{BRAND.purpose}</p>
        <H2>Developer & contact</H2>
        <Bullets
          items={[
            <>Company: {BRAND.company}</>,
            <>Website: <ExtLink href={BRAND.website}>{BRAND.website}</ExtLink></>,
            <>Email: <ExtLink href={`mailto:${BRAND.email}`}>{BRAND.email}</ExtLink></>,
            <>Source / downloads: <ExtLink href={BRAND.repo}>{BRAND.repo}</ExtLink></>,
          ]}
        />
        <H2>Legal</H2>
        <p className="text-xs text-slate-400">
          © {BRAND.copyrightYear} {BRAND.company}. All rights reserved. See the Privacy Policy and Terms &amp;
          Conditions pages in Settings. Dolibarr is a trademark of its respective owners; this app is an
          independent client and is not affiliated with the Dolibarr project.
        </p>
      </Prose>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-400">Last updated: {BRAND.copyrightYear}</p>
      <Prose>
        <p>
          {BRAND.appName} is a desktop application that connects to a Dolibarr instance that you control. This policy
          explains what data the app handles and how.
        </p>

        <H2>Data the app stores</H2>
        <Bullets
          items={[
            'Dolibarr connection details for each profile: account name, API URL, and API key/token.',
            'Local application settings and preferences (theme, density, zoom, update and notification options, and an optional PIN — stored only as a salted hash).',
            'A temporary in-memory cache of fetched records to keep the UI responsive.',
          ]}
        />

        <H2>How your data is used</H2>
        <p>
          The app uses your connection details solely to communicate with <strong>your own Dolibarr system</strong>.
          It does not transmit your data to {BRAND.company} or any third party. There is no analytics, tracking, or
          telemetry.
        </p>

        <H2>Where your data is stored</H2>
        <Bullets
          items={[
            'All data is stored locally on your device. Nothing is synced to a cloud service operated by us.',
            'API keys/tokens are encrypted at rest using your operating system’s secure storage (Windows DPAPI, macOS Keychain, or Linux libsecret).',
            'Record data fetched from Dolibarr lives only in memory during your session and is not written to disk (except files you explicitly export).',
          ]}
        />

        <H2>Data security</H2>
        <p>
          We take reasonable measures to protect sensitive data: API keys are never exposed to the app’s web layer and
          are stored encrypted. However, no method of storage is completely secure.
        </p>

        <H2>Your responsibility</H2>
        <p>
          You are responsible for keeping your API credentials safe, for securing the device the app runs on, and for
          the data within your Dolibarr system. Treat your API key like a password.
        </p>

        <H2>Contact</H2>
        <p>
          Privacy questions: <ExtLink href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</ExtLink>.
        </p>
      </Prose>
    </div>
  )
}

export function TermsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Terms &amp; Conditions</h1>
      <p className="mt-1 text-xs text-slate-400">Last updated: {BRAND.copyrightYear}</p>
      <Prose>
        <H2>1. Acceptance of terms</H2>
        <p>By installing or using {BRAND.appName}, you agree to these Terms &amp; Conditions. If you do not agree, do not use the app.</p>

        <H2>2. General usage</H2>
        <p>The app is provided as a client for the Dolibarr REST API. You may use it to connect to Dolibarr instances you are authorised to access.</p>

        <H2>3. Your responsibility</H2>
        <Bullets
          items={[
            'You are responsible for entering correct Dolibarr API URLs and credentials.',
            'You are responsible for any actions taken through your account and for compliance with your organisation’s policies.',
            'You must keep your API credentials and device secure.',
          ]}
        />

        <H2>4. Third-party availability</H2>
        <p>
          The app depends on your Dolibarr server and its REST API. We do not guarantee the availability, accuracy, or
          performance of any third-party Dolibarr instance, and are not responsible for downtime or data issues on your
          server.
        </p>

        <H2>5. Limitation of liability</H2>
        <p>
          The app is provided “as is”, without warranty of any kind. To the maximum extent permitted by law,
          {' '}{BRAND.company} is not liable for any direct, indirect, incidental, or consequential damages, including
          data loss, arising from use of the app.
        </p>

        <H2>6. Software updates</H2>
        <p>
          The app may check for and install updates to improve functionality and security. You can control update
          behaviour in Settings → Updates. Continued use after an update constitutes acceptance of these terms as they
          may be revised.
        </p>

        <H2>7. License &amp; restrictions</H2>
        <p>
          You are granted a non-exclusive, non-transferable license to use the app for its intended purpose. You may not
          resell, reverse-engineer for malicious purposes, or misrepresent the app as your own product.
        </p>

        <H2>8. Support &amp; maintenance</H2>
        <p>
          Support is provided on a best-effort basis. We may release maintenance updates but are under no obligation to
          provide continued support for any particular version.
        </p>

        <p className="text-xs text-slate-400">Questions about these terms: <ExtLink href={`mailto:${BRAND.email}`}>{BRAND.email}</ExtLink>.</p>
      </Prose>
    </div>
  )
}
