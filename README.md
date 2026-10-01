# Japanese Practice Test

## Run
Because browsers may block `fetch()` when opening `index.html` directly, run a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## File organization
Each level and question type has its own folder:

`data/N5/Kanji/page-1.json`

Create additional pages by copying `page-1.json` to `page-2.json`, changing the metadata page number, and replacing the 20 questions.

## JSON fields
- `metadata.level`
- `metadata.questionType`
- `metadata.page`
- `metadata.questionsPerPage`
- `questionHtml`: supports HTML such as `<b>`, `<ruby>`, `<span>`, images, etc.
- `options[].html`: supports HTML
- `correctAnswer`: option ID (`a`, `b`, `c`, or `d`)
- `explanationHtml`: supports HTML and is shown after submission

## Important
The included questions are editable sample placeholders. Replace them with real questions and answers.
