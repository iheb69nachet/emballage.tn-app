/**
 * GPS → full postal address.
 *
 * expo-location is a native module: it is loaded lazily so an OTA update shipped
 * to a binary built before it was added does not crash at import time.
 */
function loadLocation() {
  try { return require('expo-location'); } catch (_) { return null; }
}

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const uniq = (parts) => {
  const seen = new Set();
  return parts.filter((p) => {
    const k = p.toLowerCase();
    if (!p || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Build the address pieces from an expo-location placemark.
 * Returns { street, city, region, postalCode, country, full }
 *   street : "12 Avenue Habib Bourguiba, Lafayette, 1002"   (what goes in the "Adresse" field)
 *   full   : street + city + region + country               (one-line, human readable)
 */
export function formatPlace(place) {
  if (!place) return null;
  const streetLine = uniq([
    [clean(place.streetNumber), clean(place.street)].filter(Boolean).join(' '),
    clean(place.name) && clean(place.name) !== clean(place.street) && !/^\d+$/.test(clean(place.name)) ? clean(place.name) : '',
  ]);
  const district = clean(place.district);
  const postalCode = clean(place.postalCode);
  const city = clean(place.city) || clean(place.subregion) || clean(place.region);
  const region = clean(place.region) && clean(place.region) !== city ? clean(place.region) : '';
  const country = clean(place.country);

  const street = uniq([...streetLine, district, postalCode]).join(', ');
  const full = uniq([...streetLine, district, [postalCode, city].filter(Boolean).join(' '), region, country]).join(', ');

  return {
    street: street || (clean(place.formattedAddress) || ''),
    city,
    region,
    postalCode,
    country,
    full: full || clean(place.formattedAddress) || '',
  };
}

export class GeoError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

/**
 * Ask for permission, read the current position and reverse geocode it.
 * Resolves { coords: { latitude, longitude, accuracy }, address: formatPlace() | null }.
 * Rejects with a GeoError whose message is ready to display.
 */
export async function locateWithAddress() {
  const Location = loadLocation();
  if (!Location?.requestForegroundPermissionsAsync) {
    throw new GeoError("La géolocalisation nécessite la dernière version de l'application. Mettez-la à jour puis réessayez.", 'unavailable');
  }
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    throw new GeoError("Autorisez l'accès à la position dans les réglages pour utiliser le GPS.", 'denied');
  }
  let pos;
  try {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch (e) {
    throw new GeoError(e?.message || 'Impossible de récupérer la position.', 'position');
  }
  const { latitude, longitude, accuracy } = pos.coords;
  let address = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    address = formatPlace(place);
  } catch (_) { /* best effort — coordinates are still useful */ }
  return { coords: { latitude, longitude, accuracy }, address };
}

/** Google Maps link for a lat/lng pair (used for "Ouvrir dans Maps"). */
export const mapsUrl = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
