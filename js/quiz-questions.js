/**
 * Quiz question definitions (spec section 4). Each step renders itself via
 * a `render(container, answers)` function and reads its own answer(s) back
 * out via `read(container, answers)` when Next is pressed. Keeping the quiz
 * data-driven like this means adding/reordering/rewording a question is a
 * one-place change instead of touching the step-navigation logic too.
 */

function radioGroup(container, name, options, selected) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "options";
  options.forEach((opt) => {
    const id = `${name}-${opt.value}`;
    const label = document.createElement("label");
    label.className = "option";
    label.setAttribute("for", id);
    label.innerHTML = `
      <input type="radio" name="${name}" id="${id}" value="${opt.value}" ${opt.value === selected ? "checked" : ""} />
      <span class="option-label">${opt.label}</span>
      ${opt.hint ? `<span class="option-hint">${opt.hint}</span>` : ""}
    `;
    fieldset.appendChild(label);
  });
  container.appendChild(fieldset);
}

function checkboxGroup(container, name, options, selectedValues = []) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "options";
  options.forEach((opt) => {
    const id = `${name}-${opt.value}`;
    const label = document.createElement("label");
    label.className = "option";
    label.setAttribute("for", id);
    label.innerHTML = `
      <input type="checkbox" name="${name}" id="${id}" value="${opt.value}" ${selectedValues.includes(opt.value) ? "checked" : ""} />
      <span class="option-label">${opt.label}</span>
    `;
    fieldset.appendChild(label);
  });
  container.appendChild(fieldset);
}

function readRadio(container, name) {
  const el = container.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : undefined;
}

function readCheckboxes(container, name) {
  return Array.from(container.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
}

const QUIZ_QUESTIONS = [
  {
    id: "living-situation",
    title: "What's your living situation?",
    render(container, answers) {
      radioGroup(container, "livingSituation", [
        { value: "apartment", label: "Apartment / condo" },
        { value: "house-no-yard", label: "House without a yard" },
        { value: "house-small-yard", label: "House with a small yard" },
        { value: "house-large-yard", label: "House with a large yard" },
      ], answers.livingSituation);
    },
    read(container, answers) {
      answers.livingSituation = readRadio(container, "livingSituation");
    },
    isValid: (answers) => !!answers.livingSituation,
  },
  {
    id: "renter",
    title: "Do you rent your home?",
    subtitle: "If you rent, we'll also ask about any pet restrictions in your lease — that now factors into your matches, not just an FYI.",
    render(container, answers) {
      radioGroup(container, "renter", [
        { value: "yes", label: "Yes, I rent" },
        { value: "no", label: "No, I own" },
      ], answers.renter);

      const wrap = document.createElement("div");
      wrap.className = "field-group";
      wrap.id = "rentalRestrictionsRow";
      wrap.hidden = answers.renter !== "yes";
      wrap.innerHTML = `<p class="step-subtitle" style="margin-top:16px">Does your lease have pet restrictions?</p>`;
      container.appendChild(wrap);
      radioGroup(wrap, "rentalRestrictions", [
        { value: "none", label: "No restrictions I know of" },
        { value: "size", label: "Size limit — no large dogs" },
        { value: "breed", label: "Specific breed restrictions" },
        { value: "unsure", label: "Not sure yet" },
      ], answers.rentalRestrictions);

      container.querySelectorAll('input[name="renter"]').forEach((input) => {
        input.addEventListener("change", () => {
          wrap.hidden = readRadio(container, "renter") !== "yes";
        });
      });
    },
    read(container, answers) {
      answers.renter = readRadio(container, "renter");
      answers.rentalRestrictions = answers.renter === "yes" ? readRadio(container, "rentalRestrictions") : undefined;
    },
    isValid: (answers) => !!answers.renter,
  },
  {
    id: "household",
    title: "Who's in your household?",
    render(container, answers) {
      const wrap = document.createElement("div");
      wrap.className = "field-group";
      wrap.innerHTML = `
        <label class="checkbox-row">
          <input type="checkbox" id="hasKids" ${answers.hasKids ? "checked" : ""} />
          There are kids in the home
        </label>
        <label class="text-row" id="kidsAgesRow" ${answers.hasKids ? "" : "hidden"}>
          Ages of kids (roughly)
          <input type="text" id="kidsAges" value="${answers.kidsAges || ""}" placeholder="e.g. 4 and 8" />
        </label>
        <label class="checkbox-row">
          <input type="checkbox" id="hasOtherPets" ${answers.hasOtherPets ? "checked" : ""} />
          There are other pets currently in the home
        </label>
        <label class="text-row" id="otherPetsRow" ${answers.hasOtherPets ? "" : "hidden"}>
          Species and temperament
          <input type="text" id="otherPetsDetails" value="${answers.otherPetsDetails || ""}" placeholder="e.g. one easygoing older dog" />
        </label>
      `;
      container.appendChild(wrap);
      const hasKids = wrap.querySelector("#hasKids");
      const hasOtherPets = wrap.querySelector("#hasOtherPets");
      hasKids.addEventListener("change", () => {
        wrap.querySelector("#kidsAgesRow").hidden = !hasKids.checked;
      });
      hasOtherPets.addEventListener("change", () => {
        wrap.querySelector("#otherPetsRow").hidden = !hasOtherPets.checked;
      });
    },
    read(container, answers) {
      answers.hasKids = container.querySelector("#hasKids").checked;
      answers.kidsAges = container.querySelector("#kidsAges").value.trim();
      answers.hasOtherPets = container.querySelector("#hasOtherPets").checked;
      answers.otherPetsDetails = container.querySelector("#otherPetsDetails").value.trim();
    },
    isValid: () => true,
  },
  {
    id: "hours-alone",
    title: "How many hours a day would the pet typically be alone?",
    render(container, answers) {
      const wrap = document.createElement("div");
      wrap.className = "field-group";
      const val = answers.hoursAlone ?? 4;
      wrap.innerHTML = `
        <input type="range" id="hoursAlone" min="0" max="12" step="1" value="${val}" />
        <output id="hoursAloneOutput" for="hoursAlone">${val} hours</output>
      `;
      container.appendChild(wrap);
      const range = wrap.querySelector("#hoursAlone");
      const output = wrap.querySelector("#hoursAloneOutput");
      range.addEventListener("input", () => {
        output.textContent = `${range.value} hours${Number(range.value) >= 12 ? "+" : ""}`;
      });
    },
    read(container, answers) {
      answers.hoursAlone = Number(container.querySelector("#hoursAlone").value);
    },
    isValid: () => true,
  },
  {
    id: "activity-level",
    title: "How active do you want to be with a pet?",
    render(container, answers) {
      radioGroup(container, "activityLevel", [
        { value: "1", label: "Not very — minimal physical activity" },
        { value: "2", label: "A little — occasional short walks" },
        { value: "3", label: "Moderate — regular walks and play" },
        { value: "4", label: "Active — daily runs, hikes, or vigorous play" },
        { value: "5", label: "Very active — hours of exercise most days" },
      ], answers.activityLevel != null ? String(answers.activityLevel) : undefined);
    },
    read(container, answers) {
      const v = readRadio(container, "activityLevel");
      answers.activityLevel = v ? Number(v) : undefined;
    },
    isValid: (answers) => !!answers.activityLevel,
  },
  {
    id: "experience-level",
    title: "How much experience do you have with pets?",
    render(container, answers) {
      radioGroup(container, "experienceLevel", [
        { value: "beginner", label: "First-time owner" },
        { value: "intermediate", label: "Some experience" },
        { value: "experienced", label: "Very experienced" },
      ], answers.experienceLevel);
    },
    read(container, answers) {
      answers.experienceLevel = readRadio(container, "experienceLevel");
    },
    isValid: (answers) => !!answers.experienceLevel,
  },
  {
    id: "allergies",
    title: "Do you or anyone in your home have pet allergies?",
    render(container, answers) {
      radioGroup(container, "allergies", [
        { value: "none", label: "No allergies" },
        { value: "mild", label: "Mild pet-dander sensitivity" },
        { value: "significant", label: "Significant allergies", hint: "We'll steer toward hypoallergenic options" },
      ], answers.allergies);
    },
    read(container, answers) {
      answers.allergies = readRadio(container, "allergies");
    },
    isValid: (answers) => !!answers.allergies,
  },
  {
    id: "grooming-tolerance",
    title: "How much grooming are you up for?",
    render(container, answers) {
      radioGroup(container, "groomingTolerance", [
        { value: "low", label: "Low maintenance only" },
        { value: "medium", label: "Okay with regular brushing" },
        { value: "high", label: "Fine with frequent professional grooming" },
      ], answers.groomingTolerance);
    },
    read(container, answers) {
      answers.groomingTolerance = readRadio(container, "groomingTolerance");
    },
    isValid: (answers) => !!answers.groomingTolerance,
  },
  {
    id: "noise-tolerance",
    title: "What's your noise tolerance (barking, vocal birds, etc.)?",
    render(container, answers) {
      radioGroup(container, "noiseTolerance", [
        { value: "low", label: "Low — I need a quiet home" },
        { value: "medium", label: "Medium — some noise is fine" },
        { value: "high", label: "High — noise doesn't bother me" },
      ], answers.noiseTolerance);
    },
    read(container, answers) {
      answers.noiseTolerance = readRadio(container, "noiseTolerance");
    },
    isValid: (answers) => !!answers.noiseTolerance,
  },
  {
    id: "budget",
    title: "What's your budget comfort level for ongoing pet costs?",
    subtitle: "Food, routine vet care, and grooming combined.",
    render(container, answers) {
      radioGroup(container, "budget", [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ], answers.budget);
    },
    read(container, answers) {
      answers.budget = readRadio(container, "budget");
    },
    isValid: (answers) => !!answers.budget,
  },
  {
    id: "climate-location",
    title: "What's your climate/region?",
    subtitle: "We'll also reuse this location later for finding adoptable animals near you.",
    render(container, answers) {
      radioGroup(container, "climate", [
        { value: "any", label: "No strong preference / mixed climate" },
        { value: "warm", label: "Warm" },
        { value: "cold", label: "Cold" },
        { value: "temperate", label: "Temperate" },
      ], answers.climate);
      const wrap = document.createElement("div");
      wrap.className = "field-group";
      wrap.innerHTML = `
        <label for="location">ZIP code or city, state (optional for now)</label>
        <input type="text" id="location" value="${answers.location || ""}" placeholder="e.g. 10001 or Austin, TX" />
      `;
      container.appendChild(wrap);
    },
    read(container, answers) {
      answers.climate = readRadio(container, "climate");
      answers.location = container.querySelector("#location").value.trim();
    },
    isValid: (answers) => !!answers.climate,
  },
  {
    id: "enclosure-space",
    title: "How much space can you give an enclosure or cage?",
    subtitle: "Mainly relevant for rabbits, small rodents, and birds.",
    render(container, answers) {
      radioGroup(container, "enclosureSpace", [
        { value: "minimal", label: "Minimal — small space available" },
        { value: "moderate", label: "Moderate — room for a standard cage/hutch" },
        { value: "spacious", label: "Spacious — room for a large enclosure or dedicated area" },
      ], answers.enclosureSpace);
    },
    read(container, answers) {
      answers.enclosureSpace = readRadio(container, "enclosureSpace");
    },
    isValid: (answers) => !!answers.enclosureSpace,
  },
  {
    id: "goals",
    title: "What do you want most out of having this pet?",
    subtitle: "Select all that apply.",
    render(container, answers) {
      checkboxGroup(container, "goals", [
        { value: "companionship", label: "Companionship / cuddling" },
        { value: "exercise", label: "Exercise buddy" },
        { value: "lowMaintenance", label: "Low-maintenance companion" },
        { value: "entertainment", label: "Entertainment / personality" },
        { value: "protection", label: "Protection" },
        { value: "kidsHelping", label: "Something for kids to help care for" },
      ], answers.goals || []);
    },
    read(container, answers) {
      answers.goals = readCheckboxes(container, "goals");
    },
    isValid: () => true,
  },
];
