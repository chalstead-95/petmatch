/**
 * Local dev server — now just a plain static file server.
 *
 * There used to be a Petfinder proxy here (api/animals.js + lib/petfinder.js)
 * per spec section 6. Petfinder shut down its public developer API on
 * Dec 2, 2025, so that backend has nothing left to call and was removed —
 * see js/shelterSearch.js for what replaced it (outbound links to
 * Petfinder's and Adopt-a-Pet's own live search, no server involved).
 *
 * This file survives only because serving data/pets.json over plain
 * file:// URLs trips CORS in most browsers — running a tiny static server
 * is the easiest way around that for local testing.
 *
 * Usage: npm install && npm run dev   (then open http://localhost:3000)
 */
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname, { extensions: ["html"] }));

app.listen(PORT, () => {
  console.log(`PetMatch running at http://localhost:${PORT}`);
});
