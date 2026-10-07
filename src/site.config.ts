/**
 * ============================================================================
 * SITE SETTINGS  (src/site.config.ts)
 * ============================================================================
 *
 * One central place for business details that appear on many pages:
 * name, email, social media links, and the legal details for the imprint.
 *
 * The values you edit live in src/content/settings.yaml (also editable in the
 * gallery manager → Settings). This file reads that file and gives the rest of
 * the code typed access to it, so a change there updates everywhere (header,
 * footer, contact page, imprint, privacy policy and the data sent to Google).
 * ============================================================================
 */
import { parse } from 'yaml';
// `?raw` = the file's text; Vite bundles it at build time
import settingsText from './content/settings.yaml?raw';

interface Settings {
  german: boolean;
  tagline: string;
  email: string;
  social: { instagram: string; tiktok: string; pinterest: string };
  seo: Record<'en' | 'de', { title: string; description: string }>;
  areaServed: string[];
  person: { name: string; jobTitle: string; languages: string[] };
  services: string[];
  legal: {
    ownerName: string;
    businessForm: string;
    businessDescription: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    vatId: string;
    tradeLicence: string;
    tradeAuthority: string;
    chamberMembership: string;
    hosting: string;
    hostingLocation: string;
    lastUpdated: string;
  };
}

const settings = parse(settingsText) as Settings;

export const site = {
  /** Business name, shown as the logo and in every page title */
  name: 'Gemy Campei',

  /** Main address of the website, without trailing slash */
  url: 'https://gemycampei.com',

  /** true = the German version (/de/…) is built and linked */
  german: settings.german === true,

  tagline: settings.tagline,
  seo: settings.seo,
  email: settings.email,
  social: settings.social,
  areaServed: settings.areaServed,
  person: settings.person,
  services: settings.services,
};

/**
 * Legal details for the imprint (Impressum) and privacy policy.
 * Required by § 5 ECG, § 25 MedienG and the GDPR. Edit them in settings.yaml.
 */
export const legal = settings.legal;
