# SEO: being found for weddings and elopements in Vienna, the Dolomites and abroad

Goal: rank as high as possible, and be the photographer that Google's AI answers, ChatGPT and
Perplexity recommend, for searches like:

| English | German |
|---|---|
| Dolomites elopement photographer · elopement in the Dolomites · South Tyrol elopement photographer | Elopement Fotograf Dolomiten · Hochzeitsfotograf Südtirol |
| Vienna wedding photographer · Austria wedding photographer | Hochzeitsfotograf Wien · Hochzeitsfotografin Wien |
| destination wedding photographer Europe | Destination Wedding Fotograf |
| proposal photographer Dolomites · Lago di Braies elopement · Alpe di Siusi proposal | Heiratsantrag Dolomiten · Pragser Wildsee Hochzeit |
| maternity photographer Vienna | Babybauch Fotoshooting Wien |
| 35mm film wedding photographer · Super 8 wedding film | Analoge Hochzeitsfotografie · Super 8 Hochzeitsfilm |

The first half of this document explains what the website does. The second half is the
**checklist of everything only you can do**: most of the ranking work happens outside the code.

---

## What the website does

| Measure | Where | Why it matters |
|---|---|---|
| **Keyword addresses** | Category folders: `/dolomites-elopement-photographer/`, `/vienna-wedding-photographer/` …; German: `/de/hochzeitsfotograf-wien/` … | Words in the address are a small ranking signal and show in results. |
| **English + German** | Every page under `/de/`, linked with `hreflang` tags. **Switched off for now** (`german: false` in `src/content/settings.yaml`, or manager → Settings): only English is built. The German texts are ready in their files; switching it on builds them again | Vienna couples search in German; each language ranks on its own. |
| **Landing pages** | Category pages with intro, "how it works" and FAQ | Google ranks pages that answer the whole question, not only show photos. |
| **Journal (guides)** | `src/content/journal/`: how to elope, locations, best season, Vienna, destination weddings | Planning searches ("best time to elope in the Dolomites") lead to you; AI answers quote guides. |
| **Photo descriptions** | `photos.yaml` in every gallery folder (682 photos, both languages) | Google Images understands what is in each photo. |
| **One H1 per page** with the search phrase | Views in `src/views/` | Tells Google the main topic of each page. |
| **Titles ≤ 60 and descriptions ≤ 155 characters** | Content files; checked automatically | What people see in Google. |
| **Structured data** | `src/lib/seo.ts` | The business, you as a person, services, areas served, breadcrumbs, FAQs, galleries with photo captions, articles with author. |
| **Sitemap** | `integrations/sitemap.mjs` → `/sitemap-index.xml` | Every page in both languages, with language pairs and all photos. |
| **robots.txt** | `public/robots.txt` | Google, Bing and the AI search crawlers are explicitly welcome. |
| **301 redirects** | `legacyUrls` → `.htaccess` | Old Pixieset addresses keep their ranking. |
| **Speed** | Inline CSS, preloaded fonts, AVIF/WebP, lazy loading | Lighthouse (mobile): performance 97–99, SEO 100. |
| **No prices** | Nowhere on the site, in text or data | As you asked. The contact form still asks couples for their budget (a question, not a price); remove the field if you prefer. |

No `llms.txt`: Google confirmed in 2026 that it is not used, and AI crawlers hardly ever request it.

---

## Your checklist

Ordered by impact. ⏱ = time needed once.

### A. Before the launch (the site should not go live without these)

1. **Imprint and privacy policy: filled in** (German, details from be-bella.at and your answers; edit
   them in the manager → Settings). Before the launch, please check:
   - that your photography trade licence ("Berufsfotograf") is registered at the Bezirksamt for the
     3rd district, and the exact name of your Landesinnung at the WKO Wien;
   - that your new Hostinger plan also uses servers in Germany (hPanel → server location);
   - optionally the free imprint check of the WKO. ⏱ 15 min
2. **Data processing agreement:** accept Hostinger's data processing agreement (DPA) in hPanel if
   you have not done so for be-bella, so the sentence about it in the privacy policy is true. ⏱ 5 min
3. **Languages you speak:** Manager → Settings (or `src/content/settings.yaml` → `person.languages`; now only "English").
   Couples and AI assistants look for this. ⏱ 1 min
4. **Proofread all German text before switching German on.** I wrote it as "Hochzeitsfotograf" and address couples as
   "ihr". Files: `galleries/*/_category.de.md`, `galleries/*/*/gallery.de.md`,
   `src/content/packages/*/index.de.md`, `src/content/journal/*/index.de.md`, the `de:` parts
   of `src/content/pages/*.yaml`, the German parts of `src/views/*.astro` and `src/i18n/index.ts`.
   The new film and maternity galleries have English texts only so far. ⏱ 2–3 h
5. **Fact-check the guides** (`src/content/journal/`). Please confirm or correct:
   - Access rules: daytime reservation for the road to Lago di Braies in high summer; the Alpe
     di Siusi road closed to most cars during the day; toll road to the Tre Cime. (Your own
     notes on fees, parking, taxis and e-bikes are in the locations guide; check the prices
     once a year.)
   - Lift and hut seasons, larch colours, sunrise times (≈ 5:20 late June, 6:40 early September,
     7:20 mid-October).
   - Vienna: civil ceremony length, civil weddings at special locations, photo permits in some
     gardens. ⏱ 1 h
6. **Add your own facts to the about page** (`src/views/AboutView.astro`): years of experience,
   number of weddings, awards, publications, anything real. Concrete facts are what makes
   Google and AI trust a photographer. ⏱ 30 min
7. **Film photos stored sideways.** These 35mm scans are saved rotated and show sideways on
   the film page: `galleries/35mm-film-super-8-wedding/the-romance-of-analog/`
   `the-romance-of-analog-007, -009, -012, -013, -014, -019, -026, -030, -034, -035, -036, -038.jpg`.
   Rotate them in your photo editor and export again. ⏱ 15 min
8. **One broken file removed:** `maternity-photographer-vienna-039.jpg` was a 10 × 10 px black
   placeholder from the Pixieset import (it showed as a black tile); it is kept in
   `.trash/manually-removed/`. If a real photo belongs
   there, add it again in the manager.
9. **Super 8 videos:** in Vimeo, open each video → Privacy → "Where can this be embedded?" →
   allow `gemycampei.com`. Until then, clicking play shows a Vimeo error. ⏱ 5 min

### B. Right after the launch

10. **Google Search Console** (search.google.com/search-console): add the domain property
    `gemycampei.com`, verify by DNS in Hostinger hPanel, submit
    `https://gemycampei.com/sitemap-index.xml`. Use "URL inspection" → "Request indexing" for the
    home page, both landing pages and the five guides, in both languages. If the old Pixieset
    site ran on the same domain, nothing else is needed: the redirects carry the rankings. ⏱ 30 min
11. **Bing Webmaster Tools** (bing.com/webmasters): "Import from Google Search Console". ChatGPT
    search and Microsoft Copilot use Bing's index, so this matters for AI answers. ⏱ 5 min
12. **Google Business Profile** (business.google.com), the strongest local signal:
    - Primary category **Wedding photographer**; add "Photographer".
    - Service-area business (hide the street address); service areas: Vienna, Lower Austria,
      South Tyrol, Trentino, Belluno.
    - A 750-character description with "wedding and elopement photographer in Vienna and the
      Dolomites", no prices.
    - 20+ of your best photos, then 2–4 new ones every month, and a short post monthly.
    - Link to the website; add the German website too. ⏱ 1 h + 15 min/month
13. **Bing Places** and **Apple Business Connect**: the same details as Google (Apple Maps and
    Siri use it). ⏱ 20 min

### C. Every month: reviews, links and mentions

14. **Google reviews from every couple.** Ask 1–2 days after delivering the gallery, with the
    direct review link from your Business Profile. Ask them to mention the kind of shoot and the
    place ("our elopement at Lago di Braies"). Reply to every review. The number, freshness and
    words of reviews drive local rankings and AI recommendations. Add the best ones to
    `src/content/testimonials/` too.
15. **Wedding directories and listings** (the same name, email and website everywhere):
    - Austria: austriawedding.at, hochzeit.click, hochzeits-fotograf.info, mywed.com,
      hochzeitsguide.at, heiraten.at.
    - Italy / Dolomites: South Tyrol wedding planners' vendor lists, local venues and hotels.
    - International: Junebug Weddings, Fearless Photographers, Brides Without Borders,
      Rock My Wedding, Elopement collectives.
16. **Backlinks from real weddings.** After each wedding or elopement, ask the venue, planner,
    florist and hair & make-up artist to link to the gallery page. Submit your best weddings to
    wedding blogs and magazines (Junebug, Hochzeitswahn, Hochzeitsguide, Brides Without Borders).
    One editorial feature is worth more than many directory links.
17. **Roundups.** Search for "best Dolomites elopement photographers" and "Hochzeitsfotograf
    Wien Empfehlung" and ask the authors of those lists to consider you. AI answers often quote
    such lists.
18. **Pinterest** is a search engine for weddings: pin 5–10 photos of every gallery with a link to
    the gallery page and a description like "Sunrise elopement at Lago di Braies, Dolomites".
    Link the website from Instagram and TikTok, in both bios.
19. **Reddit and forums** (r/weddingplanning, r/Dolomites, Austrian wedding groups): answer
    questions honestly where you know the answer. AI assistants read these discussions.

### D. Keep the content growing

20. **A new gallery with a story for every shoot** (80–200 words: place, season, what happened,
    plus a short "About the place" paragraph). Every gallery page can rank for its venue.
    Fill the **Deutsch** card and the photo descriptions in the manager.
21. **A journal post every month or two.** Ideas: a real wedding story, "Lago di Braies elopement
    guide", "Seceda elopement", "Proposal ideas in the Dolomites", "Winter elopement in the
    Dolomites", "Heiraten im Schloss rund um Wien", "Standesamt Wien: Ablauf und Tipps",
    "What to wear for a mountain elopement". Copy a folder in `src/content/journal/` to start.
22. **Refresh the guides once a year** (access rules and seasons change) and set `updated:` in
    the article. Google and AI prefer current information.

### E. Watch the results

- **Search Console → Performance**: which searches bring visitors, per language and page.
  Rankings for a new site take **3–6 months** to settle.
- **Search Console → Pages**: "Page with redirect" for old Pixieset addresses is expected.
  The German galleries appear as soon as their `gallery.de.md` exists.
- **Core Web Vitals** in Search Console: should stay green.
- Every few months, ask ChatGPT, Perplexity and Google "Who is a good elopement photographer in
  the Dolomites?" and "Hochzeitsfotograf Wien" to see how you are described. If something is
  wrong or missing, add it clearly to the about page and the guides.
- **Hostinger:** check that LiteSpeed Cache/Brotli compression is on (hPanel → Website →
  Performance). The Hostinger connector in claude.ai can also do this if you authorise it.
