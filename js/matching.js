/**
 * PetMatch matching engine.
 *
 * Spec section 5 asks for "a simple weighted-scoring model" but leaves the
 * actual weights undefined. Those weights are the single biggest lever on
 * result quality, so instead of burying an arbitrary split inside the
 * scoring function, it's spelled out here as a named, documented constant
 * that's easy for someone reviewing this to see and argue with.
 *
 * Every factor contributes 0..weight points. Points are summed, then the
 * total (out of MAX_POSSIBLE) is scaled to a 0-100 match score. A "hard
 * mismatch" (e.g. significant allergies vs. a non-hypoallergenic animal)
 * zeroes out ONLY that factor's points rather than the whole score, so the
 * result stays a ranked list rather than a strict filter, per spec 5.
 */

const WEIGHTS = {
  energyMatch: 15, // activity level vs energyLevel / exerciseNeedsMinutesPerDay
  aloneTime: 12, // hours alone vs toleratesAloneTimeHours
  experience: 12, // owner experience vs experienceLevelNeeded / trainability
  allergies: 12, // allergy sensitivity vs hypoallergenic (mild penalty; "significant" is a hard filter, see isAllergyEligible)
  livingSpace: 10, // apartment/house/yard + enclosure space + rental restrictions vs goodForApartment / size
  noise: 10, // noise tolerance vs noiseLevel
  grooming: 8, // grooming tolerance vs groomingNeeds
  budget: 8, // budget comfort vs typicalCostTier
  household: 8, // kids / other pets vs goodWithKids / goodWithOtherPets
  goals: 5, // "what do you want most" multi-select vs likesToDo/personality
};

const MAX_POSSIBLE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0); // 100

const COST_RANK = { low: 1, medium: 2, high: 3 };
const EXPERIENCE_RANK = { beginner: 1, intermediate: 2, experienced: 3 };

// Dog names in the dataset that commonly appear on rental/insurance
// breed-restriction lists. This is a name-matched heuristic, not a real
// breed-restriction database — the dataset doesn't have a field for it,
// and restriction lists vary by landlord/insurer. It's a documented
// first-pass judgment call, same spirit as the WEIGHTS above.
const COMMONLY_RESTRICTED_DOG_NAMES = [
  "german shepherd",
  "siberian husky",
  "great dane",
  "boxer",
  "doberman",
  "rottweiler",
  "pit bull",
  "mastiff",
  "chow chow",
  "akita",
  "alaskan malamute",
  "cane corso",
  "presa canario",
];

function isCommonlyRestrictedDog(pet) {
  if (pet.species !== "dog") return false;
  const name = pet.name.toLowerCase();
  return COMMONLY_RESTRICTED_DOG_NAMES.some((n) => name.includes(n));
}

/**
 * "Significant" pet allergies are excluded from the ranked list entirely
 * for cats and dogs (not just scored down) — a Balcony Group reviewer
 * pointed out that cats were still showing up as a top match for someone
 * who is significantly allergic to cats, which made the results feel
 * untrustworthy no matter how the scoring explained itself.
 *
 * This only applies to cats/dogs: "significant pet allergies" in common
 * usage is almost always about cat/dog dander (Fel d 1 / Can f 1), which is
 * also literally the bug that was reported. Rabbits, rodents, and birds
 * have different allergen profiles that this dataset doesn't model, so
 * hard-filtering them out too would hide 3 of 5 species for anyone who
 * picks "significant" — that's a worse, emptier result, not a more
 * accurate one. "Mild" sensitivity stays a scoring penalty rather than a
 * filter, unchanged from before.
 */
function isAllergyEligible(answers, pet) {
  if (answers.allergies !== "significant") return true;
  if (pet.species !== "dog" && pet.species !== "cat") return true;
  return pet.hypoallergenic;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/** 1 = perfect match, 0 = worst mismatch, linear falloff by rank distance. */
function rankCloseness(a, b, maxDistance) {
  return clamp01(1 - Math.abs(a - b) / maxDistance);
}

function scoreEnergy(answers, pet) {
  // answers.activityLevel: 1 (low) .. 5 (high), matched against pet.energyLevel (1-5)
  return rankCloseness(answers.activityLevel, pet.energyLevel, 4) * WEIGHTS.energyMatch;
}

function scoreAloneTime(answers, pet) {
  // If the pet needs to tolerate MORE alone time than it can, that's a real
  // problem; being able to tolerate more than needed is not a problem.
  const hoursAlone = answers.hoursAlone;
  if (pet.toleratesAloneTimeHours >= hoursAlone) return WEIGHTS.aloneTime;
  const deficit = hoursAlone - pet.toleratesAloneTimeHours;
  return clamp01(1 - deficit / 8) * WEIGHTS.aloneTime;
}

function scoreExperience(answers, pet) {
  const ownerRank = EXPERIENCE_RANK[answers.experienceLevel];
  const neededRank = EXPERIENCE_RANK[pet.experienceLevelNeeded];
  if (ownerRank >= neededRank) return WEIGHTS.experience;
  // Under-experienced for what the animal needs: partial credit scaled by
  // how far short they are, further reduced by low trainability (a hard
  // to train animal is less forgiving of a first-time owner).
  const shortfall = neededRank - ownerRank; // 1 or 2
  const base = shortfall === 1 ? 0.5 : 0.15;
  const trainabilityBonus = pet.trainability / 5;
  return clamp01(base * (0.5 + 0.5 * trainabilityBonus)) * WEIGHTS.experience;
}

function scoreAllergies(answers, pet) {
  switch (answers.allergies) {
    case "significant":
      // Non-hypoallergenic cats/dogs never reach this: they're excluded
      // before scoring by isAllergyEligible. Rabbits/rodents/birds aren't
      // hard-filtered, so they get full credit here rather than being
      // penalized for a hypoallergenic flag that was never modeled for them.
      if (pet.species !== "dog" && pet.species !== "cat") return WEIGHTS.allergies;
      return pet.hypoallergenic ? WEIGHTS.allergies : 0;
    case "mild":
      return pet.hypoallergenic ? WEIGHTS.allergies : WEIGHTS.allergies * 0.5;
    default: // "none"
      return WEIGHTS.allergies;
  }
}

function scoreLivingSpace(answers, pet) {
  let score = 1;
  if (answers.livingSituation === "apartment") {
    score = pet.goodForApartment ? 1 : 0.25;
  } else if (answers.livingSituation === "house-no-yard") {
    score = pet.goodForApartment ? 1 : 0.5;
  } // house with small/large yard: no penalty regardless of goodForApartment

  // Enclosure/space tolerance (quiz Q12) mainly matters for caged species;
  // for dogs/cats it's a no-op since they aren't enclosure animals.
  if (["rabbit", "rodent", "bird"].includes(pet.species) && answers.enclosureSpace) {
    const sizeRank = { small: 1, medium: 2, large: 3 }[pet.size] ?? 2;
    const spaceRank = { minimal: 1, moderate: 2, spacious: 3 }[answers.enclosureSpace] ?? 2;
    const enclosureScore = rankCloseness(sizeRank, spaceRank <= sizeRank ? sizeRank : spaceRank, 2);
    score = spaceRank >= sizeRank ? score : Math.min(score, enclosureScore);
  }

  // Rental restrictions (added after Balcony Group feedback: the quiz asked
  // whether users rent, but nothing downstream ever used the answer). This
  // is folded into livingSpace rather than given its own weight bucket,
  // since it's still fundamentally about housing constraints. Only applies
  // when the user actually reported a restriction — "not sure" is treated
  // as a no-op rather than guessed at.
  if (answers.renter === "yes") {
    if (answers.rentalRestrictions === "size" && pet.species === "dog" && pet.size === "large") {
      score = Math.min(score, 0.3);
    } else if (answers.rentalRestrictions === "breed" && isCommonlyRestrictedDog(pet)) {
      score = Math.min(score, 0.15);
    }
  }

  return clamp01(score) * WEIGHTS.livingSpace;
}

function scoreNoise(answers, pet) {
  const toleranceMax = { low: 2, medium: 3, high: 5 }[answers.noiseTolerance] ?? 3;
  if (pet.noiseLevel <= toleranceMax) return WEIGHTS.noise;
  const over = pet.noiseLevel - toleranceMax;
  return clamp01(1 - over / 4) * WEIGHTS.noise;
}

function scoreGrooming(answers, pet) {
  const toleranceMax = { low: 2, medium: 3, high: 5 }[answers.groomingTolerance] ?? 3;
  if (pet.groomingNeeds <= toleranceMax) return WEIGHTS.grooming;
  const over = pet.groomingNeeds - toleranceMax;
  return clamp01(1 - over / 4) * WEIGHTS.grooming;
}

function scoreBudget(answers, pet) {
  const ownerMax = COST_RANK[answers.budget] ?? 2;
  const petCost = COST_RANK[pet.typicalCostTier] ?? 2;
  if (petCost <= ownerMax) return WEIGHTS.budget;
  return clamp01(1 - (petCost - ownerMax) / 2) * WEIGHTS.budget;
}

function scoreHousehold(answers, pet) {
  let score = 1;
  if (answers.hasKids && !pet.goodWithKids) score -= 0.6;
  if (answers.hasOtherPets && !pet.goodWithOtherPets) score -= 0.6;
  return clamp01(score) * WEIGHTS.household;
}

const GOAL_TO_TRAITS = {
  companionship: (pet) => pet.toleratesAloneTimeHours <= 6,
  exercise: (pet) => pet.energyLevel >= 4,
  lowMaintenance: (pet) => pet.groomingNeeds <= 2 && pet.energyLevel <= 2,
  entertainment: (pet) => /playful|clown|mischiev|curious|entertain/i.test(pet.personalitySummary),
  protection: (pet) => pet.species === "dog" && pet.size !== "small",
  kidsHelping: (pet) => pet.goodWithKids && pet.trainability >= 3,
};

function scoreGoals(answers, pet) {
  const goals = answers.goals || [];
  if (goals.length === 0) return WEIGHTS.goals * 0.75; // neutral if unanswered
  let hits = 0;
  for (const g of goals) {
    const test = GOAL_TO_TRAITS[g];
    if (test && test(pet)) hits += 1;
  }
  return clamp01(hits / goals.length) * WEIGHTS.goals;
}

/**
 * Returns { score: 0-100, breakdown: {factor: points}, topFactors: [...] }
 */
function scorePet(answers, pet) {
  const breakdown = {
    energyMatch: scoreEnergy(answers, pet),
    aloneTime: scoreAloneTime(answers, pet),
    experience: scoreExperience(answers, pet),
    allergies: scoreAllergies(answers, pet),
    livingSpace: scoreLivingSpace(answers, pet),
    noise: scoreNoise(answers, pet),
    grooming: scoreGrooming(answers, pet),
    budget: scoreBudget(answers, pet),
    household: scoreHousehold(answers, pet),
    goals: scoreGoals(answers, pet),
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.round((total / MAX_POSSIBLE) * 100);

  // Strongest contributing factors, expressed as fraction of their own weight,
  // so "aced a low-weight factor" doesn't outrank "did fine on a big one" wrongly.
  const topFactors = Object.entries(breakdown)
    .map(([factor, points]) => ({ factor, points, fraction: points / WEIGHTS[factor] }))
    .sort((a, b) => b.points - a.points || b.fraction - a.fraction)
    .slice(0, 3)
    .map((f) => f.factor);

  return { score, breakdown, topFactors };
}

const FACTOR_EXPLANATIONS = {
  energyMatch: (pet) => `its ${["very low", "low", "moderate", "high", "very high"][pet.energyLevel - 1]} energy level fits how active you said you want to be`,
  aloneTime: (pet) => `it comfortably tolerates the amount of time it'd spend alone`,
  experience: (pet) => `it's a good fit for your experience level with pets`,
  allergies: (pet) => (pet.hypoallergenic ? `it's a lower-shedding, more allergy-friendly option` : `it's a manageable fit given your allergy sensitivity`),
  livingSpace: (pet) => `it suits your living situation and the space you have available`,
  noise: (pet) => `its noise level matches what you're comfortable with`,
  grooming: (pet) => `its grooming needs match what you're willing to keep up with`,
  budget: (pet) => `its typical costs fit your budget comfort level`,
  household: (pet) => `it tends to do well with your household (kids and/or other pets)`,
  goals: (pet) => `it lines up with what you said you want most out of having a pet`,
};

function explainMatch(answers, pet, topFactors) {
  const parts = topFactors.slice(0, 2).map((f) => FACTOR_EXPLANATIONS[f](pet));
  const joined = parts.length === 2 ? `${parts[0]}, and ${parts[1]}` : parts[0] || "it broadly matches your answers";
  return `${pet.name} stood out because ${joined}.`;
}

/**
 * Runs every eligible dataset entry through scorePet, sorts descending, and
 * returns the top N (spec: top 5-10) with a generated explanation attached.
 * "Eligible" excludes non-hypoallergenic cats/dogs when allergies are
 * "significant" — see isAllergyEligible.
 */
function getMatches(answers, dataset, { limit = 8 } = {}) {
  return dataset
    .filter((pet) => isAllergyEligible(answers, pet))
    .map((pet) => {
      const { score, topFactors } = scorePet(answers, pet);
      return { pet, score, explanation: explainMatch(answers, pet, topFactors) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Exposed for both the browser (script tag) and any future test runner.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getMatches, scorePet, isAllergyEligible, isCommonlyRestrictedDog, WEIGHTS, MAX_POSSIBLE };
}
