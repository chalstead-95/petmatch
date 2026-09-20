(() => {
  "use strict";

  const state = {
    answers: {},
    stepIndex: 0,
    dataset: [],
    matches: [],
    location: "",
    pendingAdoptablePanel: null, // panel awaiting a location before searching
  };

  const screens = {
    landing: document.getElementById("screen-landing"),
    quiz: document.getElementById("screen-quiz"),
    results: document.getElementById("screen-results"),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.hidden = key !== name;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Data loading ----------
  async function loadDataset() {
    const res = await fetch("data/pets.json");
    if (!res.ok) throw new Error("Could not load pet dataset");
    return res.json();
  }

  // ---------- Quiz ----------
  const stepContainer = document.getElementById("quiz-step-container");
  const progressBar = document.getElementById("progress-bar");
  const progressWrap = document.getElementById("progress");
  const stepCounter = document.getElementById("step-counter");
  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");

  function renderStep() {
    const step = QUIZ_QUESTIONS[state.stepIndex];
    stepContainer.innerHTML = "";

    const heading = document.createElement("h2");
    heading.className = "step-title";
    heading.textContent = step.title;
    stepContainer.appendChild(heading);

    if (step.subtitle) {
      const sub = document.createElement("p");
      sub.className = "step-subtitle";
      sub.textContent = step.subtitle;
      stepContainer.appendChild(sub);
    }

    step.render(stepContainer, state.answers);

    const pct = Math.round((state.stepIndex / (QUIZ_QUESTIONS.length - 1)) * 100);
    progressBar.style.width = `${pct}%`;
    progressWrap.setAttribute("aria-valuenow", String(pct));
    stepCounter.textContent = `Question ${state.stepIndex + 1} of ${QUIZ_QUESTIONS.length}`;

    btnBack.disabled = state.stepIndex === 0;
    btnNext.textContent = state.stepIndex === QUIZ_QUESTIONS.length - 1 ? "See my matches" : "Next";
  }

  function currentStep() {
    return QUIZ_QUESTIONS[state.stepIndex];
  }

  function goNext() {
    const step = currentStep();
    step.read(stepContainer, state.answers);
    if (step.isValid && !step.isValid(state.answers)) {
      announce("Please answer this question before continuing.");
      return;
    }
    if (state.stepIndex < QUIZ_QUESTIONS.length - 1) {
      state.stepIndex += 1;
      renderStep();
    } else {
      finishQuiz();
    }
  }

  function goBack() {
    if (state.stepIndex === 0) return;
    currentStep().read(stepContainer, state.answers);
    state.stepIndex -= 1;
    renderStep();
  }

  let liveRegion;
  function announce(message) {
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.setAttribute("role", "status");
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.className = "sr-only";
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = message;
  }

  function startQuiz() {
    state.stepIndex = 0;
    showScreen("quiz");
    renderStep();
  }

  function finishQuiz() {
    if (state.answers.location) state.location = state.answers.location;
    state.matches = getMatches(state.answers, state.dataset, { limit: 8 });
    renderResults();
    showScreen("results");
  }

  // ---------- Results ----------
  const resultsList = document.getElementById("results-list");
  const resultsSubtitle = document.getElementById("results-subtitle");
  const cardTemplate = document.getElementById("template-result-card");

  function renderResults() {
    let subtitle = `Based on your answers, here are your top ${state.matches.length} matches, ranked by fit.`;
    if (state.answers.allergies === "significant") {
      subtitle += " Non-hypoallergenic cats and dogs are excluded entirely given your allergy answer.";
    }
    resultsSubtitle.textContent = subtitle;
    resultsList.innerHTML = "";

    state.matches.forEach((match, i) => {
      const node = cardTemplate.content.cloneNode(true);
      const article = node.querySelector(".result-card");
      const summaryBtn = node.querySelector(".result-summary");
      const pet = match.pet;

      node.querySelector(".result-icon").innerHTML = speciesIconMarkup(pet.species);
      node.querySelector(".result-rank").textContent = `#${i + 1}`;
      node.querySelector(".result-name").textContent = pet.name;
      node.querySelector(".result-meta").textContent = `${capitalize(pet.species)} · ${capitalize(pet.size)}`;
      node.querySelector(".result-score").textContent = `${match.score}% match`;
      node.querySelector(".result-why").textContent = match.explanation;
      node.querySelector(".result-personality").textContent = pet.personalitySummary;
      node.querySelector(".result-likes").textContent = pet.likesToDo.join(", ");
      node.querySelector(".result-requirements").textContent = pet.requirementsSummary;
      node.querySelector(".result-health").textContent = pet.commonHealthIssues.join(", ");

      summaryBtn.addEventListener("click", () => {
        const detail = article.querySelector(".result-detail");
        const expanded = summaryBtn.getAttribute("aria-expanded") === "true";
        summaryBtn.setAttribute("aria-expanded", String(!expanded));
        detail.hidden = expanded;
      });

      const seeAdoptableBtn = node.querySelector(".btn-see-adoptable");
      const adoptablePanel = node.querySelector(".adoptable-panel");
      seeAdoptableBtn.addEventListener("click", () => {
        handleSeeAdoptable(pet, adoptablePanel);
      });

      resultsList.appendChild(node);
    });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Shelter search ----------
  const locationModal = document.getElementById("location-modal");
  const locationInput = document.getElementById("location-input");
  const btnLocationSave = document.getElementById("btn-location-save");
  const btnLocationCancel = document.getElementById("btn-location-cancel");

  function openLocationModal() {
    locationInput.value = state.location || "";
    locationModal.hidden = false;
    locationModal.setAttribute("aria-hidden", "false");
    locationInput.focus();
  }

  function closeLocationModal() {
    locationModal.hidden = true;
    locationModal.setAttribute("aria-hidden", "true");
    state.pendingAdoptablePanel = null;
  }

  btnLocationCancel.addEventListener("click", closeLocationModal);
  btnLocationSave.addEventListener("click", () => {
    const value = locationInput.value.trim();
    if (!value) {
      announce("Please enter a ZIP code or city and state.");
      return;
    }
    state.location = value;
    const pending = state.pendingAdoptablePanel;
    closeLocationModal();
    if (pending) runAdoptableSearch(pending.pet, pending.panel);
  });

  function handleSeeAdoptable(pet, panel) {
    if (!state.location) {
      state.pendingAdoptablePanel = { pet, panel };
      openLocationModal();
      return;
    }
    runAdoptableSearch(pet, panel);
  }

  function runAdoptableSearch(pet, panel) {
    // No backend call here on purpose — see js/shelterSearch.js for why
    // (Petfinder's public API shut down Dec 2025). These are plain outbound
    // links to real, live search results on Petfinder's and Adopt-a-Pet's
    // own sites, pre-filled with the location where possible.
    panel.hidden = false;
    const links = ShelterSearch.buildLinks({
      species: pet.species,
      breedName: pet.name,
      location: state.location,
    });

    panel.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "adoptable-links";
    links.forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "adoptable-link";
      a.textContent = link.label;
      wrap.appendChild(a);
    });
    panel.appendChild(wrap);
  }

  // ---------- Wire up ----------
  document.getElementById("btn-start-quiz").addEventListener("click", startQuiz);
  btnNext.addEventListener("click", goNext);
  btnBack.addEventListener("click", goBack);
  document.getElementById("btn-retake").addEventListener("click", () => {
    state.stepIndex = 0;
    showScreen("quiz");
    renderStep();
  });

  // Allow Enter key to advance through radio/text steps without submitting.
  document.getElementById("quiz-form").addEventListener("submit", (e) => e.preventDefault());

  loadDataset()
    .then((dataset) => {
      state.dataset = dataset;
    })
    .catch((err) => {
      console.error(err);
      alert("Could not load the pet dataset (data/pets.json). Check the console for details.");
    });
})();
