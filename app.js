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

function filePath() {
  return `data/${levelSelect.value}/${typeSelect.value}/page-${currentPage}.json`;
}

/* ============================================================
   Furigana (manual notation)

   In questionHtml, write {kanji|reading}, e.g.
     "{私|わたし}は{東京|とうきょう}に「住みます」。"
   Leave the tested word plain (inside 「」) so its reading
   isn't given away.
   ============================================================ */

// {kanji|reading}  ->  <ruby>kanji<rt>reading</rt></ruby>
function rubyToHtml(html) {
  return html.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, "<ruby>$1<rt>$2</rt></ruby>");
}

// {kanji|reading}  ->  kanji   (readings hidden)
function rubyToPlain(html) {
  return html.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, "$1");
}

/* ============================================================
   End furigana
   ============================================================ */

async function loadPage() {
  submitted = false;
  score.textContent = "";
  questionContainer.innerHTML = "<p>Loading questions...</p>";
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
    prompt.className = "question-text";
    prompt.innerHTML = rubyToPlain(question.questionHtml);
    card.appendChild(prompt);

    /* ----- Furigana button ----- */
    const furiganaBtn = document.createElement("button");
    furiganaBtn.type = "button";
    furiganaBtn.style.backgroundColor = "green"; // Changes the button's background color
    furiganaBtn.style.color = "white"; 
    furiganaBtn.className = "furigana-btn";
    furiganaBtn.textContent = "Show reading";
    card.appendChild(furiganaBtn);

    let showingReading = false;
    furiganaBtn.addEventListener("click", () => {
      showingReading = !showingReading;
      prompt.innerHTML = showingReading
        ? rubyToHtml(question.questionHtml)
        : rubyToPlain(question.questionHtml);
      furiganaBtn.textContent = showingReading ? "Hide reading" : "Show reading";
    });
    /* ----- End furigana button ----- */

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