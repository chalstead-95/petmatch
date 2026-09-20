/**
 * Small species icons shown on each result card (added in response to
 * Balcony Group feedback asking for something more visual than text alone).
 *
 * These are generic, hand-drawn-style line icons representing each SPECIES
 * ("a dog", "a bird"), not photos of the specific breed/type in the
 * dataset — there's no license-clean photo source for 50 specific breeds
 * to pull from without a backend, so a clear, recognizable stand-in icon
 * per species is the honest version of "add a picture" that a static site
 * with no image backend can actually deliver.
 */

const SPECIES_ICONS = {
  dog: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 17 C8 14 7 21 11 26" />
    <path d="M35 17 C40 14 41 21 37 26" />
    <circle cx="24" cy="27" r="11.5" />
    <circle cx="19.5" cy="25" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="28.5" cy="25" r="1.7" fill="currentColor" stroke="none" />
    <ellipse cx="24" cy="31.5" rx="2.6" ry="1.9" fill="var(--color-gold)" stroke="none" />
    <path d="M24 33.5 v2.5" />
  </svg>`,
  cat: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 19 L11 9 L19 15 Z" />
    <path d="M33 19 L37 9 L29 15 Z" />
    <circle cx="24" cy="27" r="11" />
    <circle cx="19.5" cy="25" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="28.5" cy="25" r="1.7" fill="currentColor" stroke="none" />
    <path d="M22.3 30.5 L25.7 30.5 L24 32.5 Z" fill="var(--color-gold)" stroke="none" />
    <path d="M17 31 L12 30 M17 32.5 L12 33.5" />
    <path d="M31 31 L36 30 M31 32.5 L36 33.5" />
  </svg>`,
  rabbit: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 20 C14 10 15 4 18 4 C21 4 21 12 20.5 20" />
    <path d="M31 20 C34 10 33 4 30 4 C27 4 27 12 27.5 20" />
    <circle cx="24" cy="29" r="10.5" />
    <circle cx="20" cy="27.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="28" cy="27.5" r="1.6" fill="currentColor" stroke="none" />
    <ellipse cx="24" cy="32" rx="2.2" ry="1.6" fill="var(--color-gold)" stroke="none" />
  </svg>`,
  rodent: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="14" cy="17" r="4.5" />
    <circle cx="34" cy="17" r="4.5" />
    <circle cx="24" cy="27" r="11" />
    <circle cx="19.5" cy="25.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="28.5" cy="25.5" r="1.6" fill="currentColor" stroke="none" />
    <path d="M20 34 v3 M22 34.5 v3" stroke-width="2" />
    <path d="M26 34.5 v3 M28 34 v3" stroke-width="2" />
  </svg>`,
  bird: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="23" cy="30" rx="12" ry="9" />
    <circle cx="30" cy="18" r="7" />
    <path d="M36 17 L42 19 L36 21 Z" fill="var(--color-gold)" stroke="none" />
    <circle cx="32" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
    <path d="M14 32 C10 30 8 26 9 22" />
  </svg>`,
};

function speciesIconMarkup(species) {
  return SPECIES_ICONS[species] || SPECIES_ICONS.dog;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SPECIES_ICONS, speciesIconMarkup };
}
