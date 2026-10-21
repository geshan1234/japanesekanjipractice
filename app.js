const levelSelect = document.getElementById("levelSelect");
const typeSelect = document.getElementById("typeSelect");
const questionContainer = document.getElementById("questionContainer");
const testTitle = document.getElementById("testTitle");
// const pageLabel = document.getElementById("pageLabel");
const paginationLabel = document.getElementById("paginationLabel");
const score = document.getElementById("score");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let currentPage = 1;
let testData = null;
let submitted = false;

document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});
document.addEventListener('copy', function(e) {
  e.preventDefault();
});
document.addEventListener('keydown', function(e) {
  if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
    e.preventDefault();
  }
});

function filePath() {
  return `data/${levelSelect.value}/${typeSelect.value}/page-${currentPage}.json`;
}

/* ============================================================
   Furigana feature (added) — everything in this block is new.
   Nothing outside it was changed.

   The word being tested is wrapped in 「...」 inside questionHtml
   (e.g. 「住みます」). That part is left as plain kanji so the
   reading isn't given away; everything else gets furigana.
   ============================================================ */

let kuroshiroInstancePromise = null;

// Lazily creates (once) and returns a ready Kuroshiro instance.
function getKuroshiro() {
  if (!kuroshiroInstancePromise) {
    kuroshiroInstancePromise = (async () => {
      if (typeof Kuroshiro === "undefined" || typeof KuromojiAnalyzer === "undefined") {
        throw new Error("Furigana library failed to load (check the script tags / your connection).");
      }
      const KuroshiroCtor = typeof Kuroshiro === "function" ? Kuroshiro : Kuroshiro.default;
      const kuroshiro = new KuroshiroCtor();
      await kuroshiro.init(
        new KuromojiAnalyzer({ dictPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/" })
      );
      return kuroshiro;
    })();
  }
  return kuroshiroInstancePromise;
}

// Injects the small amount of CSS the furigana button/line need,
// so nothing has to be added to styles.css by hand.
function injectFuriganaStyles() {
  if (document.getElementById("furigana-inline-styles")) return;
  const style = document.createElement("style");
  style.id = "furigana-inline-styles";
  style.textContent = `
    .furigana-btn {
      display: inline-block;
      margin: 6px 0 4px;
      padding: 4px 10px;
      font-size: 0.85rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #f3f4f6;
      cursor: pointer;
    }
    .furigana-btn:hover { background: #e5e7eb; }
    .furigana-btn:disabled { opacity: 0.6; cursor: default; }
    .furigana-line {
      margin: 4px 0 10px;
      padding: 8px 10px;
      background: #f9fafb;
      border-left: 3px solid #93c5fd;
      border-radius: 4px;
      line-height: 2.1;
      font-size: 1rem;
    }
    .furigana-line[hidden] { display: none; }
    .furigana-line ruby rt { font-size: 0.6em; color: #374151; }
    .furigana-target { border-bottom: 1px dashed #9ca3af; }
    .furigana-error { color: #991b1b; font-size: 0.85rem; }
  `;
  document.head.appendChild(style);
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function escapeHtml(text) {
  const tmp = document.createElement("div");
  tmp.textContent = text;
  return tmp.innerHTML;
}

// Converts plain text to furigana HTML, leaving any 「...」-quoted
// segment untouched (that's the word being tested).
async function convertToFuriganaPreservingTarget(kuroshiro, plainText) {
  const parts = plainText.split(/(「[^」]*」)/g);
  let result = "";
  for (const part of parts) {
    if (!part) continue;
    if (/^「[^」]*」$/.test(part)) {
      result += `<span class="furigana-target">${escapeHtml(part)}</span>`;
    } else {
      result += await kuroshiro.convert(part, { to: "hiragana", mode: "furigana" });
    }
  }
  return result;
}

// Shows/hides the furigana line under a question, converting
// (and caching) the reading the first time it's requested.
async function toggleFurigana(question, button, furiganaLine) {
  const isCurrentlyHidden = furiganaLine.hidden;

  if (!isCurrentlyHidden) {
    furiganaLine.hidden = true;
    button.textContent = "Show reading";
    return;
  }

  if (question._furiganaHtml) {
    furiganaLine.innerHTML = question._furiganaHtml;
    furiganaLine.hidden = false;
    button.textContent = "Hide reading";
    return;
  }

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Converting...";

  try {
    const kuroshiro = await getKuroshiro();
    const plainText = stripHtml(question.questionHtml);
    const furiganaHtml = await convertToFuriganaPreservingTarget(kuroshiro, plainText);
    question._furiganaHtml = furiganaHtml;
    furiganaLine.innerHTML = furiganaHtml;
    furiganaLine.hidden = false;
    button.textContent = "Hide reading";
  } catch (error) {
    furiganaLine.innerHTML = `<span class="furigana-error">Could not load furigana: ${error.message}</span>`;
    furiganaLine.hidden = false;
    button.textContent = originalLabel;
  } finally {
    button.disabled = false;
  }
}

injectFuriganaStyles();

/* ============================================================
   End furigana feature
   ============================================================ */

async function loadPage() {
  submitted = false;
  score.textContent = "";
  questionContainer.innerHTML = "<p>Loading questions...</p>";
  
  try {
    const response = await fetch(filePath());
    if (!response.ok) throw new Error("File not found");
    testData = await response.json();
    renderQuestions();
  } catch (error) {
    testData = null;
    questionContainer.innerHTML = `<p>There is no JSON file for this page yet: <code>${filePath()}</code></p>
      <p>Create that file by copying another page JSON file and updating its metadata.</p>`;
    updatePagination();
  }
}

function renderQuestions() {
  const meta = testData.metadata;
  testTitle.textContent = `${meta.level} - ${meta.questionType}`;
  // pageLabel.textContent = `Page ${meta.page}`;
  questionContainer.innerHTML = "";

  testData.questions.forEach((question, index) => {
    const card = document.createElement("section");
    card.className = "question-card";
    card.dataset.questionId = question.id;

    const number = document.createElement("div");
    number.className = "question-number";
    number.textContent = `${index + 1}.`;
    card.appendChild(number);

    const prompt = document.createElement("div");
    prompt.innerHTML = question.questionHtml;
    card.appendChild(prompt);

    /* ----- Furigana button + line (added) ----- */
    const furiganaBtn = document.createElement("button");
    furiganaBtn.type = "button";
    furiganaBtn.style.backgroundColor = "green"; // Changes the button's background color
    furiganaBtn.style.color = "white"; 
    furiganaBtn.className = "furigana-btn";
    furiganaBtn.textContent = "Show reading";
    card.appendChild(furiganaBtn);

    const furiganaLine = document.createElement("div");
    furiganaLine.className = "furigana-line";
    furiganaLine.hidden = true;
    card.appendChild(furiganaLine);

    furiganaBtn.addEventListener("click", () => {
      toggleFurigana(question, furiganaBtn, furiganaLine);
    });
    /* ----- End addition ----- */

    question.options.forEach(option => {
      const label = document.createElement("label");
      label.className = "option";
      label.innerHTML = `<input type="radio" name="${question.id}" value="${option.id}"> ${option.html}`;
      card.appendChild(label);
    });

    const feedback = document.createElement("div");
    feedback.className = "feedback";
    feedback.hidden = true;
    card.appendChild(feedback);

    const explanation = document.createElement("div");
    explanation.className = "explanation";
    explanation.hidden = true;
    explanation.innerHTML = question.explanationHtml || "";
    card.appendChild(explanation);

    question._card = card;
    question._feedback = feedback;
    question._explanation = explanation;
    questionContainer.appendChild(card);
  });

  updatePagination();
}

function submitTest() {
  if (!testData || submitted) return;
  submitted = true;
  let correct = 0;

  testData.questions.forEach(question => {
    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
    const labels = question._card.querySelectorAll(".option");
    labels.forEach(label => label.classList.remove("correct", "wrong"));

    labels.forEach(label => {
      const input = label.querySelector("input");
      if (input.value === question.correctAnswer) label.classList.add("correct");
      if (selected && input.checked && input.value !== question.correctAnswer) label.classList.add("wrong");
    });

    question._feedback.hidden = false;
    question._explanation.hidden = false;

    if (selected && selected.value === question.correctAnswer) {
      correct++;
      question._feedback.textContent = "Correct!";
      question._feedback.style.color = "#166534";
    } else {
      const correctOption = question.options.find(o => o.id === question.correctAnswer);
      question._feedback.textContent = `Wrong. Correct answer: ${correctOption ? correctOption.html : question.correctAnswer}`;
      question._feedback.style.color = "#991b1b";
    }
  });

  score.textContent = `Score: ${correct} / ${testData.questions.length}`;
}

function resetTest() {
  if (!testData) return;
  submitted = false;
  score.textContent = "";
  testData.questions.forEach(question => {
    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
    if (selected) selected.checked = false;
    question._card.querySelectorAll(".option").forEach(label => label.classList.remove("correct", "wrong"));
    question._feedback.hidden = true;
    question._explanation.hidden = true;
  });
}

function updatePagination() {
  paginationLabel.textContent = `Page ${currentPage}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = !testData || testData.questions.length < 20;
}

levelSelect.addEventListener("change", () => { currentPage = 1; loadPage(); });
typeSelect.addEventListener("change", () => { currentPage = 1; loadPage(); });
submitBtn.addEventListener("click", submitTest);
resetBtn.addEventListener("click", resetTest);
prevBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; loadPage(); } });
nextBtn.addEventListener("click", () => { currentPage++; loadPage(); });

loadPage();