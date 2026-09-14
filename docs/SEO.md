# SEO: being found in the Dolomites and Vienna

Goal: rank for searches like **"Dolomites elopement photographer"**, **"Lago di Braies
elopement"**, **"Vienna wedding photographer"** and **"couple photoshoot Dolomites"**.

This document explains what the website already does, and what only you can do outside of it.

---

## What the code does

| Measure | Where | Why it matters |
|---|---|---|
| **Keyword URLs** | Folder names, e.g. `/the-alps/lago-di-braies-elopement-s-and-j/` | Words in the address are a (small) ranking signal and show in search results. |
| **301 redirects** from Pixieset URLs | `legacyUrls` in Markdown → `.htaccess` | Keeps existing rankings and backlinks when the addresses change. |
| **One H1 per page** with the search phrase | `h1:` in `_category.md` and packages files, gallery titles | Tells Google the main topic of each page. |
| **Title + description** per page | `seoTitle`, `seoDescription` | What people see in Google. A good description gets more clicks. |
| **Structured data** (JSON-LD) | `src/lib/seo.ts` | Business type, areas served (Vienna, Dolomites …), breadcrumbs, FAQ, image galleries. |
| **Gallery stories** | Body text of `gallery.md` | Unique text per gallery lets it rank for venue and place names. |
| **FAQ sections** | `faq:` in packages and category files | Answers exactly what couples search for ("best time to elope in the Dolomites"). |
| **Descriptive image names + alt texts** | `new-gallery` script, `describeGallery()` | Google Images is a real traffic source for photographers. |
| **Internal links** | Category → packages, gallery → category + packages, footer | Helps Google find and weigh the important pages. |
| **Fast pages** | Static HTML, WebP, lazy loading, no tracking scripts | Page speed (Core Web Vitals) is a ranking factor, especially on phones. |
| **Sitemap + robots.txt** | `@astrojs/sitemap`, `public/robots.txt` | Lets search engines discover every page. |
| **Canonical URLs, one domain** | `Base.astro`, `.htaccess` (www → non-www, HTTPS) | Avoids duplicate content. |

Note: Google shows FAQ rich results only for a few authority sites today. The FAQ data still
helps Google and AI answers understand the content, but don't expect expandable FAQs in results.

---

## Writing for search

**Gallery stories (the biggest lever you control).** For every gallery, write 80–200 words:
- name the **exact place** (Lago di Braies / Pragser Wildsee, Palais Daun-Kinsky, Val di Funes)
- name the **type** (elopement, civil wedding, proposal, couple session)
- describe the season, weather, light and what happened
- mention the region once ("in the Dolomites", "in Vienna")

**Titles.** Put the place and type first: "Seceda Elopement at Sunrise · Dolomites".

**Don't** repeat keywords unnaturally. Write for couples first.

**More galleries = more entry points.** Every published gallery is a page that can rank for
its venue. Publishing the draft galleries (La Val, Cadini di Misurina, Val di Funes, Passo
Gardena, Schloss Hernstein …) with a short story each is the quickest SEO win available.

---

## Launch checklist (outside the code)

1. **Google Search Console** (search.google.com/search-console): add `gemycampei.com`, verify
   via DNS in hPanel, submit `https://gemycampei.com/sitemap-index.xml`. Check "Pages" after a
   few days for errors and use "URL inspection" to request indexing of the main pages.
2. **Google Business Profile** (business.google.com): create a profile for Gemy Campei as a
   service-area business, set the service areas **Vienna** and **South Tyrol / Trentino /
   Dolomites**, add photos and the website link. This is the strongest signal for local
   "photographer near me" and "Vienna wedding photographer" searches.
3. **Ask couples for Google reviews** (link from your Business Profile) after delivering galleries.
4. **Bing Webmaster Tools**: import the site from Search Console (2 minutes).
5. **Pinterest**: pin gallery photos with links to the gallery page and keyword descriptions
   ("Lago di Braies elopement, Dolomites"). Pinterest is a search engine for weddings.
6. **Backlinks**: ask venues, planners, florists and hair & makeup artists you worked with to
   link to the gallery of that day. Submit real weddings to wedding blogs and magazines.
7. **Consistent name and contact details** everywhere: website, Google, Instagram, directories.
8. **Instagram / TikTok bio**: link to the website, mention "Vienna & Dolomites".

## Monitoring

- Search Console › Performance: which searches bring visitors, and which pages rank.
- Check every few months that old Pixieset links still redirect (Search Console › Pages ›
  "Page with redirect" is expected and fine).
- Rankings for new sites take **3–6 months** to settle. Keep adding galleries with stories.
