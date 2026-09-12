/**
 * Petfinder shut down its public developer API on Dec 2, 2025 (they now only
 * offer a WordPress widget, which isn't usable from a custom app like this).
 * That kills the OAuth-proxy design in spec section 6 at the root — there's
 * no API left to proxy. Rather than build against a different pet-adoption
 * API (RescueGroups.org is a free option if this ever needs revisiting),
 * this build drops the backend entirely and links out to real, live search
 * results on Petfinder's and Adopt-a-Pet's own (still fully functional)
 * consumer websites instead of trying to embed them.
 *
 * Net effect: no backend, no API key, no server-side secret, nothing that
 * can crash on deploy — "adoptable near me" becomes two plain links.
 */
const ShelterSearch = (() => {
  function buildLinks({ species, breedName, location }) {
    const links = [];

    if (location) {
      links.push({
        label: `Search Petfinder for adoptable ${breedName}s near ${location}`,
        url: `https://www.petfinder.com/search/pets-for-adoption/?location=${encodeURIComponent(location)}`,
      });
    } else {
      links.push({
        label: `Search Petfinder for adoptable ${breedName}s`,
        url: `https://www.petfinder.com/search/pets-for-adoption/`,
      });
    }

    links.push({
      label: "Browse Adopt-a-Pet.com",
      url: "https://www.adoptapet.com/",
    });

    return links;
  }

  return { buildLinks };
})();
