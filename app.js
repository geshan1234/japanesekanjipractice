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

// {kanji|reading}  ->  <ruby>kanji<rt>reading</rt></ruby>
function rubyToHtml(html) {
  return html.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, "<ruby>$1<rt>$2</rt></ruby>");
}

// {kanji|reading}  ->  kanji   (readings hidden)
function rubyToPlain(html) {
  return html.replace(/\{([^|{}]+)\|([^|{}]+)\}/g, "$1");
}

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
    if (isDokkai()) renderDokkai(); else renderQuestions();
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
  if (isDokkai()) return submitDokkai();
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
  if (isDokkai()) return resetDokkai();
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
  if (isDokkai()) {
    // Dokkai pages hold passages, not a fixed question count.
    // Optional metadata.totalPages stops "Next" on the last page.
    const total = testData && testData.metadata && testData.metadata.totalPages;
    nextBtn.disabled = !testData || (total ? currentPage >= total : false);
  } else {
    nextBtn.disabled = !testData || testData.questions.length < 20;
  }
}

function isDokkai() {
  return typeSelect.value === "Dokkai";
}

const KANJI_RE = /[\u4e00-\u9fff々]/;

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function wordsStorageKey(passage) {
  return `dokkai-words:${passage.id}`;
}

function loadWords(passage) {
  try {
    const saved = localStorage.getItem(wordsStorageKey(passage));
    if (saved) return JSON.parse(saved);
  } catch (e) { /* storage unavailable: fall back to JSON file */ }
  return (passage.difficultWords || []).map(w => ({ ...w }));
}

function saveWords(passage) {
  try {
    localStorage.setItem(wordsStorageKey(passage), JSON.stringify(passage._words));
  } catch (e) { /* ignore */ }
}

// Furigana is always shown when the word contains kanji.
function wordHtml(w) {
  const word = escapeHtml(w.word);
  return KANJI_RE.test(w.word || "") && w.reading
    ? `<ruby>${word}<rt>${escapeHtml(w.reading)}</rt></ruby>`
    : word;
}

function makeToggleButton(label, panel, build) {
  const btn = el("button", "dokkai-btn", label);
  btn.type = "button";
  btn.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.classList.toggle("active", opening);
    if (opening) build();
  });
  return btn;
}

function buildWordList(panel, passage) {
  panel.innerHTML = "";
  if (!passage._words.length) {
    panel.appendChild(el("p", "dokkai-empty", "No difficult words yet. Use Edit words to add some."));
    return;
  }
  const list = el("ul", "word-list");
  passage._words.forEach(w => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="word-term">${wordHtml(w)}</span><span class="word-meaning">${escapeHtml(w.meaning)}</span>`;
    list.appendChild(li);
  });
  panel.appendChild(list);
}

function buildWordEditor(panel, passage, onChange) {
  panel.innerHTML = "";
  const list = el("div", "word-edit-list");

  passage._words.forEach((w, i) => {
    const row = el("div", "word-edit-row");

    [["word", "Word"], ["reading", "Reading"], ["meaning", "Meaning"]].forEach(([field, placeholder]) => {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = placeholder;
      input.value = w[field] || "";
      input.addEventListener("input", () => {
        w[field] = input.value;
        saveWords(passage);
        onChange();
      });
      row.appendChild(input);
    });

    const del = el("button", "dokkai-btn small", "Delete");
    del.type = "button";
    del.addEventListener("click", () => {
      passage._words.splice(i, 1);
      saveWords(passage);
      buildWordEditor(panel, passage, onChange);
      onChange();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
  panel.appendChild(list);

  const actions = el("div", "word-edit-actions");
  const add = el("button", "dokkai-btn small", "Add word");
  add.type = "button";
  add.addEventListener("click", () => {
    passage._words.push({ word: "", reading: "", meaning: "" });
    saveWords(passage);
    buildWordEditor(panel, passage, onChange);
    const inputs = panel.querySelectorAll(".word-edit-row:last-child input");
    if (inputs[0]) inputs[0].focus();
  });
  const exportBtn = el("button", "dokkai-btn small", "Export JSON");
  exportBtn.type = "button";
  exportBtn.addEventListener("click", exportDokkaiPage);
  actions.append(add, exportBtn);
  panel.appendChild(actions);
}

// Downloads the current page JSON with edited words merged in.
function exportDokkaiPage() {
  if (!testData) return;
  const out = JSON.parse(JSON.stringify(testData, (key, value) =>
    key.startsWith("_") ? undefined : value));
  out.passages.forEach((p, i) => {
    p.difficultWords = testData.passages[i]._words
      .filter(w => (w.word || "").trim())
      .map(w => ({ word: w.word, reading: w.reading, meaning: w.meaning }));
  });
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `page-${currentPage}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderDokkai() {
  const meta = testData.metadata;
  testTitle.textContent = `${meta.level} - ${meta.questionType}`;
  questionContainer.innerHTML = "";

  testData.passages.forEach((passage, pIndex) => {
    passage._words = loadWords(passage);

    const card = el("section", "question-card passage-card");
    card.dataset.passageId = passage.id;

    card.appendChild(el("div", "question-number", passage.title || `Passage ${pIndex + 1}`));

    // Rich text preview: stored HTML is rendered exactly as saved.
    const text = el("div", "passage-text");
    text.innerHTML = rubyToPlain(passage.passageHtml);
    card.appendChild(text);

    const wordsPanel = el("div", "dokkai-panel");
    const editPanel = el("div", "dokkai-panel");
    [wordsPanel, editPanel].forEach(p => { p.hidden = true; });

    const refreshWords = () => { if (!wordsPanel.hidden) buildWordList(wordsPanel, passage); };

    const toolbar = el("div", "dokkai-toolbar");
    // Furigana toggles readings directly on the passage preview above.
    const furiganaBtn = el("button", "dokkai-btn", "Furigana");
    furiganaBtn.type = "button";
    let showingFurigana = false;
    furiganaBtn.addEventListener("click", () => {
      showingFurigana = !showingFurigana;
      text.innerHTML = showingFurigana
        ? rubyToHtml(passage.passageHtml)
        : rubyToPlain(passage.passageHtml);
      furiganaBtn.classList.toggle("active", showingFurigana);
    });

    toolbar.append(
      furiganaBtn,
      makeToggleButton("Difficult words", wordsPanel, () => buildWordList(wordsPanel, passage)),
      // makeToggleButton("Edit words", editPanel, () => buildWordEditor(editPanel, passage, refreshWords))
    );
    card.append(toolbar, wordsPanel, editPanel);

    passage.questions.forEach((question, qIndex) => {
      const qBox = el("div", "dokkai-question");

      qBox.appendChild(el("div", "question-number", `Q${qIndex + 1}.`));

      const prompt = el("div", "question-text");
      prompt.innerHTML = rubyToPlain(question.questionHtml);
      qBox.appendChild(prompt);

      question.options.forEach(option => {
        const label = el("label", "option");
        label.innerHTML = `<input type="radio" name="${question.id}" value="${option.id}"> ${rubyToPlain(option.html)}`;
        qBox.appendChild(label);
      });

      const feedback = el("div", "feedback");
      feedback.hidden = true;
      qBox.appendChild(feedback);

      const explanation = el("div", "explanation");
      explanation.hidden = true;
      explanation.innerHTML = question.explanationHtml || "";
      qBox.appendChild(explanation);

      question._card = qBox;
      question._feedback = feedback;
      question._explanation = explanation;
      card.appendChild(qBox);
    });

    questionContainer.appendChild(card);
  });

  updatePagination();
}

function allDokkaiQuestions() {
  return testData.passages.flatMap(p => p.questions);
}

function submitDokkai() {
  if (!testData || submitted) return;
  submitted = true;
  let correct = 0;
  const questions = allDokkaiQuestions();

  questions.forEach(question => {
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
      question._feedback.textContent = `Wrong. Correct answer: ${correctOption ? rubyToPlain(correctOption.html) : question.correctAnswer}`;
      question._feedback.style.color = "#991b1b";
    }
  });

  score.textContent = `Score: ${correct} / ${questions.length}`;
}

function resetDokkai() {
  if (!testData) return;
  submitted = false;
  score.textContent = "";
  allDokkaiQuestions().forEach(question => {
    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
    if (selected) selected.checked = false;
    question._card.querySelectorAll(".option").forEach(label => label.classList.remove("correct", "wrong"));
    question._feedback.hidden = true;
    question._explanation.hidden = true;
  });
}

levelSelect.addEventListener("change", () => { currentPage = 1; loadPage(); });
typeSelect.addEventListener("change", () => { currentPage = 1; loadPage(); });
submitBtn.addEventListener("click", submitTest);
resetBtn.addEventListener("click", resetTest);
prevBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; loadPage(); } });
nextBtn.addEventListener("click", () => { currentPage++; loadPage(); });

loadPage();