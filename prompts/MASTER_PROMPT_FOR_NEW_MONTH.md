# Master Prompt for School Newsletter Data Generation

**Objective:**
Convert a new month's PDF newsletter (e.g., "march-2026.pdf") into a fully populated, production-ready JSON file (e.g., `data/march-2026.json`) in a SINGLE PASS. The output must match the rigorous standards established during the February cycle, including specific schedules, parent engagement content, and accurate weekend revisions.

---

## 1. Preparation Step
Before generating the JSON, perform the following:
1.  **Read the PDF:** Use a tool (like `pypdf` or `ocr`) to extract *every single line* of text from the uploaded PDF. Do not summarize yet; get the raw data.
2.  **Analyze the Structure:** Identify:
    -   **The Daily Schedule Grid:** Note the exact start/end times for every period. (e.g., 9:10-9:30, 9:30-10:00... up to 12:50-1:00).
    -   **Important Dates:** Look for a separate list of events/holidays.
    -   **Content Sections:** Identify "Rhymes", "Story of the Month", "Shloka", and "Dictation Words".

---

## 2. JSON Generation Rules (The Prompt)

**Copy and paste the following prompt to the AI agent alongside the new PDF:**

> **System Role:** You are an expert educational data assistant. Your goal is to convert the attached school newsletter PDF into a structured JSON file for a web application.
>
> **Reference File:** Please look at `data/january-2026.json` (or February) to understand the exact schema.
>
> **Strict Requirements:**
>
> ### A. Daily Schedule (The "Non-Negotiables")
> 1.  **Complete Timeline:** Every single school day (Mon-Fri) MUST have the complete timeline captured in the PDF.
>     -   *Common Trap:* Do not skip short slots like "12:50-1:00 Meditation" or "10:30-11:00 Snack Break".
>     -   *Verification:* Ensure every day has the full ~9 rows of schedule items.
> 2.  **Friday Specifics:** Pay extra attention to Fridays. Check if the "General Assembly" time is extended (e.g., 9:10-10:00) replacing the first period. Mirror the PDF exactly.
> 3.  **Content Accuracy:** Copy the 'Subject' and 'Activity' exactly as written (e.g., "Literacy: Recap of Blends").
>
> ### B. Intelligent Enrichment (The "Parent Features")
> For *every* weekday object, generate an `aiSuggestedRecap` object:
> 1.  **`todayMission`**: A fun, catchy title (e.g., "Time Travelers", "Phonics Detectives").
> 2.  **`activities`**: A list of 3 specific, simple activities parents can do at home based on *that specific day's* schedule.
>     -   *Example:* If the schedule says "Intro to Time", the activity must be "Look at a fluid clock and identify the hour hand."
>     -   *Goal:* Make it actionable and question-based.
>
> ### C. Weekend Revision (Saturdays)
> For *every* Saturday:
> 1.  Set `"isWeekendRevision": true`.
> 2.  **`weekendRevisionContent`**: This must be a **Consolidated Summary** of what was taught Monday-Friday of that specific week.
>     -   *Do not* just put generic text.
>     -   *Logic:* Go through the Mon-Fri schedule for that week. Collect all distinct topics for Literacy, Numeracy, and General Awareness.
>     -   *Format:*
>       ```json
>       "subjects": {
>           "Literacy": ["Topic A", "Topic B", "Dictation Words list..."],
>           "Numeracy": ["Topic C", "Topic D"],
>           "General Awareness": ["Topic E"]
>       }
>       ```
>
> ### D. Content & Dates
> 1.  **Shlokas/Rhymes:** Extract the full text. For Shlokas, include `sanskrit`, `transliteration`, and `meaning` fields if available (or infer standard ones if known).
> 2.  **Important Dates:** Extract all dates.
>     -   **Mobile Fix:** Do not truncate descriptions. Keep them verbose (e.g., "Grandparents Day Celebration" instead of just "Celebration").
>     -   Note holidays vs. events.
> 3.  **Dictation Words:** Place the weekly dictation word lists into the corresponding `week` object (e.g., `dictationWords: ["cat", "bat"]`).
>
> **Output:** Provide the fully valid `data/march-2026.json` code.

---

## 3. Validation Checklist (Post-Generation)
After the AI generates the file, ask it to verify:
1.  **Row Count Check:** "Does every Monday-Friday have exactly 9 schedule entries? List any that have fewer."
2.  **Mobile View Check:** "Are any event descriptions truncate? Ensure full text is present."
3.  **Weekend Check:** "Check Saturday of Week 2. Does the revision list match the specific topics from Week 2 Mon-Fri?"
4.  **Friday Check:** "Verify the 9:10 slot for all Fridays. Does it match the PDF?"

