# gemycampei.com

The website of **Gemy Campei**, wedding and elopement photographer in Vienna and the Dolomites.

This README is a guided tour through the project: what each tool does, how the pieces fit
together, where to find things, and how to add content. Every code file also has a comment
block at the top explaining what it does.

- Deployment to Hostinger: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Search engine optimisation: [docs/SEO.md](docs/SEO.md)
- Adding photos: [galleries/README.md](galleries/README.md)
- Managing galleries and testimonials with a click-and-drag app: `npm run manage` ([section 7](#7-the-gallery-manager))

---

## Contents

1. [Quick start](#1-quick-start)
2. [The big picture](#2-the-big-picture)
3. [Tech stack](#3-tech-stack)
4. [Project structure](#4-project-structure)
5. [How a page is made](#5-how-a-page-is-made)
6. [Adding and editing content](#6-adding-and-editing-content)
7. [The gallery manager](#7-the-gallery-manager)
8. [React in this project](#8-react-in-this-project)
9. [Fast image loading](#9-fast-image-loading)
10. [Styling](#10-styling)
11. [The contact form](#11-the-contact-form)
12. [Common tasks and problems](#12-common-tasks-and-problems)
13. [Glossary](#13-glossary)

---

## 1. Quick start

You need [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install          # once: downloads all libraries into node_modules/
npm run manage       # opens the gallery manager in your browser (see section 7)
npm run dev          # starts a local preview at http://localhost:4321
npm run build        # creates the finished website in dist/
npm run preview      # shows the finished dist/ website locally
npm run check        # checks all TypeScript and Astro files for errors
```

`npm run dev` updates the browser automatically whenever you save a file. Drafts (galleries
with `draft: true`) are only visible there, never on the live site.

The first `npm run build` optimises every photo and takes a minute or two. Later builds reuse
the results and take seconds.

---

## 2. The big picture

The site is a **static website**: every page is a finished HTML file, created once on your
computer (or on GitHub) and then simply served by Hostinger. There is **no database** and no
server program generating pages while visitors browse. That makes the site fast, cheap,
secure and easy to back up (it is just files).

```mermaid
flowchart LR
  subgraph You["On your computer"]
    A["galleries/<br/>photos + text files"] --> B["npm run build<br/>(Astro)"]
    C["src/<br/>pages, components, styles"] --> B
    B --> D["dist/<br/>HTML, CSS, JS, WebP images"]
  end
  D -->|git push → GitHub Actions → rsync| E["Hostinger<br/>public_html/"]
  E --> F["Visitor's browser"]
  F -->|contact form| G["contact.php<br/>sends email"]
```

**Build time** (before upload): Astro reads the photo folders and text files, resizes photos,
turns components into HTML and writes everything into `dist/`.

**Browser time** (when someone visits): the browser receives ready HTML. Only a few small
interactive parts run JavaScript: the photo grid, slider and carousel with their fullscreen
viewer, the gallery filter and the contact form.

---

## 3. Tech stack

| Tool | What it is | Why it is used here |
|---|---|---|
| **[Astro](https://docs.astro.build)** | A website builder ("static site generator") | Turns pages and components into plain HTML files. Ships no JavaScript unless a component needs it, so pages load fast. Has built-in image optimisation. |
| **[React](https://react.dev)** | A library for interactive user interfaces | Used for the parts that react to clicks: lightbox, filter, contact form. Astro loads React only on pages that need it ("islands"). |
| **TypeScript** | JavaScript with types | The editor warns you about mistakes (wrong property names, missing values) before the site breaks. Files end in `.ts` / `.tsx`. |
| **[Vite](https://vite.dev)** | The engine under Astro | Runs the dev server and bundles files. Its `import.meta.glob` feature finds all photos in the gallery folders. The gallery manager uses it directly to serve its React app. |
| **[sharp](https://sharp.pixelplumbing.com)** | Image processing library | Used by Astro to resize photos and convert them to WebP. Also used by `scripts/new-gallery.mjs` and the gallery manager (optimising uploads, thumbnails). |
| **[yaml](https://eemeli.org/yaml/)** | YAML reader/writer | The gallery manager edits the settings blocks of Markdown files with it and keeps your comments intact. |
| **[Zod](https://zod.dev)** | Data validation | Checks every Markdown settings block against `src/content.config.ts`. A typo stops the build with a clear message. |
| **Markdown** (`.md`) | Simple text format | All editable texts: categories, galleries, packages, testimonials. The part between `---` lines holds settings, the rest is text. |
| **[PhotoSwipe](https://photoswipe.com)** | Lightbox library | Fullscreen photo viewer with swipe and keyboard support. |
| **[Fontsource](https://fontsource.org)** | Fonts as npm packages | Playfair Display and Poppins are served from our own server instead of Google Fonts (GDPR). |
| **PHP + [PHPMailer](https://github.com/PHPMailer/PHPMailer)** | Server-side script + mail library | The only code that runs on the server: sends contact form emails. |
| **`.htaccess`** | Web server configuration | HTTPS, redirects from old Pixieset URLs, caching, security headers. |
| **[GitHub Actions](https://docs.github.com/actions)** | Automation on GitHub | Builds the site and uploads it to Hostinger on every `git push`. |
| **Hostinger** | Web hosting | Serves the files in `public_html/` and runs `contact.php`. |

---

## 4. Project structure

```
website-gemycampei/
│
├── galleries/                         ← ALL GALLERY PHOTOS (see galleries/README.md)
│   ├── weddings/                        a category folder = one section of the site (/weddings/)
│   │   ├── _category.md                   settings, intro text + order of the galleries
│   │   ├── hero.jpg                       big image at the top of the category page
│   │   └── palais-daun-kinsky-wedding-vienna/   a gallery folder = one gallery page
│   │       ├── gallery.md                   optional settings + story text
│   │       └── *.jpg                        the photos, sorted by file name
│   ├── the-alps/  maternity/  35mm-super-8-film/
│
├── src/                               ← THE WEBSITE CODE
│   ├── pages/                           every file here becomes a URL (see section 5)
│   │   ├── index.astro                    /
│   │   ├── about.astro                    /about/
│   │   ├── contact.astro                  /contact/
│   │   ├── testimonials.astro             /testimonials/
│   │   ├── wedding-photography-packages.astro   /wedding-photography-packages/
│   │   ├── dolomites-elopement-packages.astro   /dolomites-elopement-packages/
│   │   ├── galleries/index.astro          /galleries/  (overview with filter)
│   │   ├── [category]/index.astro         /weddings/, /the-alps/ ...  (one per category folder)
│   │   ├── [category]/[gallery].astro     /weddings/palais-daun-kinsky-wedding-vienna/ ...
│   │   ├── redirects.json.ts              list of old Pixieset URLs → new URLs
│   │   ├── imprint.astro, privacy.astro   legal pages
│   │   └── 404.astro, thank-you.astro, message-error.astro
│   │
│   ├── components/                      reusable building blocks
│   │   ├── Header.astro, Footer.astro     menu and footer on every page
│   │   ├── PageHero.astro                 big photo with title
│   │   ├── PackagesPage.astro             layout of both packages pages
│   │   ├── Faq.astro                      questions & answers
│   │   ├── SchemaOrg.astro                structured data for Google
│   │   ├── GalleryCard.tsx (+ .css)       React: one gallery preview card
│   │   ├── GalleryFilter.tsx (+ .css)     React: filter buttons on /galleries/
│   │   ├── PhotoGallery.tsx (+ .css)      React: photo grid on gallery pages
│   │   ├── PhotoSlider.tsx (+ .css)       React: one-at-a-time slider with thumbnails (optional display)
│   │   ├── PhotoCarousel.tsx (+ .css)     React: full-width moving row of photos (maternity, 35mm & Super 8)
│   │   ├── useLightbox.ts                 React hook: fullscreen viewer shared by the three above
│   │   ├── carousel.ts                    scroll helpers for slider and carousel
│   │   └── ContactForm.tsx (+ .css)       React: the inquiry form
│   │
│   ├── layouts/Base.astro               HTML frame: <head>, SEO tags, header, footer
│   │
│   ├── lib/                             helper functions (no HTML)
│   │   ├── galleries.ts                   reads the galleries/ folders, prepares images
│   │   ├── testimonials.ts                reviews + their links to galleries
│   │   ├── seo.ts                         page titles and structured data
│   │   └── markdown.ts                    **bold** / *italic* for short texts
│   │
│   ├── content/                         texts that are not galleries
│   │   ├── packages/<page>/index.md       packages + FAQ of each packages page
│   │   └── testimonials/*.md              one file per review
│   │
│   ├── assets/                          images used by pages
│   │   ├── home/grid-1/, home/grid-2/     the two photo grids on the home page
│   │   └── about/                         portrait on the about page
│   │
│   ├── styles/global.css                colours, fonts and shared styles
│   ├── content.config.ts                which fields each Markdown file may have
│   └── site.config.ts                   business name, email, social links, legal details
│
├── public/                            ← copied unchanged into the website root
│   ├── .htaccess                        server settings + redirects
│   ├── contact.php                      sends contact form emails
│   ├── _mail/PHPMailer/                 mail library for contact.php
│   ├── favicon.svg, robots.txt
│
├── tools/gallery-manager/             ← the local app behind `npm run manage` (section 7)
│   ├── server.mjs                       starts the local web server + opens the browser
│   ├── api/                             Node code that changes files (galleries, photos, trash …)
│   └── app/                             React user interface (components/, styles.css)
│
├── scripts/new-gallery.mjs            ← helper: create a gallery from a photo export
├── scripts/lib/photos.mjs             ← photo optimising shared by the script and the manager
├── .trash/                            ← items deleted in the manager (not in Git, restorable)
├── server/contact-config.example.php  ← template for the mail password file on the server
├── docs/                              ← DEPLOYMENT.md, SEO.md
├── .github/workflows/deploy.yml       ← automatic deployment
├── astro.config.mjs                   ← Astro settings (+ redirect writer)
├── package.json                       ← list of libraries and npm scripts
└── tsconfig.json                      ← TypeScript settings
```

Folders you never edit: `node_modules/` (downloaded libraries), `dist/` (build output),
`.astro/` (generated types). They are ignored by Git.

---

## 5. How a page is made

### Routing: file name = URL

Astro looks at `src/pages/`. Each file becomes a page:

| File | URL |
|---|---|
| `src/pages/about.astro` | `/about/` |
| `src/pages/galleries/index.astro` | `/galleries/` |
| `src/pages/[category]/index.astro` | `/weddings/`, `/the-alps/`, … |

Square brackets mark a **dynamic route**: one file that produces many pages. It exports a
function `getStaticPaths()` that returns a list of pages to build. For categories, that list
comes from the folders in `galleries/`.

### Anatomy of an `.astro` file

```astro
---
// 1. FRONTMATTER: runs at build time (like a script). Import things, load data.
import Base from '../layouts/Base.astro';
const galleries = await getGalleries('weddings');
---

<!-- 2. TEMPLATE: HTML with {expressions} -->
<Base title="Weddings">
  <h1>Weddings</h1>
  {galleries.map((g) => <a href={g.href}>{g.title}</a>)}
</Base>

<style>
  /* 3. STYLES: only affect this file */
  h1 { color: var(--accent); }
</style>
```

### From folder to finished gallery page

```mermaid
flowchart TD
  F["galleries/weddings/palais-daun-kinsky-wedding-vienna/<br/>*.jpg + gallery.md"]
  F -->|"import.meta.glob finds photos"| L["src/lib/galleries.ts<br/>getGalleries()"]
  F -->|"content collection reads gallery.md"| L
  L -->|"list of galleries"| P["src/pages/[category]/[gallery].astro<br/>getStaticPaths()"]
  P -->|"toPhotoData(): resize to WebP"| C["PhotoGallery.tsx"]
  P --> B["Base.astro: title, description, structured data"]
  C --> H["dist/weddings/palais-daun-kinsky-wedding-vienna/index.html"]
  B --> H
```

---

## 6. Adding and editing content

| I want to … | Do this |
|---|---|
| **Add a gallery** | Easiest: `npm run manage` → **+ New gallery**, then drop the photos in. By hand: create a folder in a category folder and copy photos into it. Details: [galleries/README.md](galleries/README.md). Or `npm run new-gallery` (optimises photos). |
| **Change a gallery's title image** | Manager: click the ★ on a photo and the focus point on the cover. By hand: `cover: file-name.jpg` (and optionally `coverFocus: "50% 30%"`) in its `gallery.md`, or name a photo `cover.jpg`. |
| **Hide a gallery** | Manager: tick "Draft". By hand: `draft: true` in its `gallery.md`. |
| **Move a gallery to another category** | Manager: choose another main category and save (folder, photo names, links and redirect are handled). By hand: move the folder and add its previous URL to `legacyUrls`. |
| **Show a gallery in several categories** | Manager: tick the categories. By hand: `alsoIn: [35mm-super-8-film]` in its `gallery.md`. It keeps one address (its folder) and appears as a card in the other categories too. |
| **Change the order of galleries** | Manager: tab **Order on pages**. By hand: the `galleryOrder` list in each `_category.md`. Every category has its own order. |
| **Set the kind of shoot** | `type: "Couple Session"` in `gallery.md` (default: `singular` of the category). Used in headings and for Google. |
| **Add a category** | Create `galleries/<name>/` with `_category.md` (copy one) and `hero.jpg`. Choose `display: cards`, `slider` or `carousel`. It appears in the menu once it has a visible gallery. |
| **Edit packages or FAQs** | `src/content/packages/<page>/index.md` |
| **Add a testimonial** | Manager: tab **Testimonials**. By hand: copy `src/content/testimonials/annie-and-huong.md`. Link it to a gallery with `gallery:` + `galleryPhoto:` to show it on that gallery page too. |
| **Change home page photos** | Add, remove or rename files in `src/assets/home/grid-1/` and `grid-2/`. |
| **Edit About, Contact, home texts** | Directly in `src/pages/about.astro`, `contact.astro`, `index.astro`. |
| **Change email or social links** | `src/site.config.ts` |
| **Change colours or fonts** | `src/styles/global.css` (top section) |

Every field allowed in the Markdown settings is listed and explained in
[src/content.config.ts](src/content.config.ts).

### Publishing a change

```bash
npm run dev                          # check it locally (or the Preview button in the manager)
git add .
git commit -m "Add gallery Lago di Braies"
git push                             # GitHub builds and uploads in about 2–3 minutes
```

`git push` needs a GitHub repository connected once (`git remote add origin …`), see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The local repository and a first commit already exist.

---

## 7. The gallery manager

```bash
npm run manage
```

This opens a small app in your browser (`http://127.0.0.1:4400`). It is a comfortable way to
change the files in `galleries/` and `src/content/testimonials/`. It **only changes files on
your computer**: nothing goes online until you commit and push. Stop it with Ctrl+C in the
terminal.

### The tabs

| Tab | What you can do |
|---|---|
| **Galleries** | Sidebar with every gallery (filter: all / published / drafts). **+ New gallery** asks for main category, title, type, couple and place and suggests the address. The editor has all fields: title, couple, type, location, date, draft, story, SEO title and description (with length counters), address and old addresses. |
| | **Categories**: tick every category the gallery fits, choose the *main* one (it decides the address). A card linking to the gallery then appears on every ticked category page. |
| | **Photos**: drop files onto the grid (or "Add photos"). Each upload is rotated, resized to 2400 px, stripped of camera/GPS data and named `<slug>-001.jpg`; exact duplicates are skipped and small photos get a warning. Drag photos to reorder. Click to select, Shift+click for a range, then move or delete several at once. ★ makes a photo the cover. |
| | **Cover focus**: click the important spot on the cover. The preview shows how the square card crop will look. |
| | **Checks**: hints such as "fewer than 10 photos", "story is empty", "SEO title too long". |
| **Order on pages** | Pick a category and drag its galleries into place. Saved immediately. |
| **Testimonials** | Add, edit, delete and drag reviews into order. Link a review to a gallery: the testimonials page then shows "View their gallery" and the gallery page shows the review. The photo can be picked from that gallery or uploaded. |
| **Trash** | Everything deleted in the manager. Restore or delete for good. |
| **Changes** | Files changed since the last Git commit, grouped per gallery/review, plus the commands to publish them. |

### What is saved when

- **Text and settings** (fields, categories, cover, focus, testimonials): with **Save** or
  Ctrl+S. The manager warns you before you leave a gallery with unsaved changes.
- **Photos and order** (upload, reorder, move, delete, category order): immediately.
- **Deleting** moves things into `.trash/` in the project folder. The message that appears
  has an **Undo** button; older deletions are in the Trash tab. `.trash/` is not uploaded.

### Things it takes care of

- **Renaming or moving a gallery** (new slug or main category) moves the folder, renames the
  photos, adds the old address to `legacyUrls` (so a 301 redirect is created) and updates the
  category orders and testimonial links.
- **Reordering photos** renames the files (`-001`, `-002` …) because the website sorts photos by
  file name. Cover and review photos follow along.
- A photo used by a review can't be deleted until the review uses another photo.
- Deleting a gallery that a review links to copies the review photo into the review, so the
  testimonials page keeps working. Restoring the gallery links it again.

### Preview

**Preview** starts `astro dev` in the background (first time about 15 seconds) and opens the
gallery page as it will look on the website, including drafts. The dev server keeps running
after you close the manager; stop it with `npx astro dev stop`.

### How it is built

`tools/gallery-manager/server.mjs` starts a Node web server that only listens on your own
computer. It serves the React app from `app/` through Vite and answers requests under `/api/`
with the code in `api/` (one file per topic: `galleries.mjs`, `photos.mjs`, `testimonials.mjs`,
`trash.mjs` …). Every request needs a secret token that is created at start and written into the
page, so other websites open in your browser can't change your files. It's a good project for
learning React: the components in `app/components/` use state, effects, custom hooks
(`app/hooks.ts`) and drag & drop.

---

## 8. React in this project

Astro renders React components to HTML at build time. A **client directive** decides
whether the component also runs in the browser:

| Usage | Effect |
|---|---|
| `<GalleryCard gallery={…} />` | HTML only, zero JavaScript (category pages) |
| `<GalleryFilter client:load … />` | JavaScript loads immediately (buttons must work right away) |
| `<PhotoGallery client:visible … />` | JavaScript loads when the grid scrolls into view |
| `<PhotoCarousel client:visible … />` (or `<PhotoSlider …>`) | same, on maternity and 35mm & Super 8 |
| `<ContactForm client:load />` | JavaScript loads immediately |

React concepts you'll find in the components, each explained in the file's comments:

- **Props**: data passed into a component, like function arguments (`GalleryCard.tsx`).
- **useState**: remembered values; changing them re-renders the component (`GalleryFilter.tsx`, `ContactForm.tsx`).
- **useEffect**: code that runs after the component appears in the browser, with cleanup (`PhotoGallery.tsx`).
- **useRef**: a value kept between renders without re-rendering (`PhotoGallery.tsx`).
- **Controlled inputs**: form fields whose values live in state (`ContactForm.tsx`).

Props must be plain data (text, numbers, arrays, objects). That's why `src/lib/galleries.ts`
converts images into URLs and sizes (`toCardData`, `toPhotoData`) before passing them in.

---

## 9. Fast image loading

Photos are the heaviest part of the site. These measures keep pages light:

- **Several sizes per photo.** Astro creates each photo in widths from 160 to 1600 px (and up
  to 2400 px for the fullscreen viewer). The `srcset` attribute lists them.
- **Exact `sizes`.** Each component tells the browser how wide a photo really appears, e.g.
  "row height × aspect ratio" in the justified grid. The browser then downloads the smallest
  file that is still sharp. See `sizesForRatio()` in `PhotoGallery.tsx`.
- **Phones capped at about 2× density.** Phones with 3× screens would otherwise download huge
  files. `67vw` in the `sizes` of phone layouts gives files that look just as sharp but are
  less than half the size.
- **WebP at quality 72–80, AVIF for hero images.** Visually identical on screen, much smaller.
  AVIF is used only for the big hero images because it is slow to generate.
- **Lazy loading.** Only photos near the screen load. The first visible photo gets
  `fetchpriority="high"`.
- **Lightbox with `srcset`.** Phones get the 1200 px version fullscreen, large screens 2400 px.
- **Long browser caching** of all images (see `public/.htaccess`).

To change quality or sizes, see the constants at the bottom of `src/lib/galleries.ts`.

---

## 10. Styling

- **Global styles and colours**: `src/styles/global.css`. Colours are CSS variables such as
  `var(--accent)`, defined once at the top.
- **Component styles**: a `<style>` block in `.astro` files (scoped to that file) or a `.css`
  file next to a `.tsx` component.
- **Palette "Warm White, Espresso & Black"**: warm white background `#FAF8F4`, off-white
  panels `#F1ECE5`, soft black text `#1C1917`, warm grey-brown secondary text `#6A5F57`,
  dark espresso buttons, About page boxes and photo frames `#2E1F18`.
- **Fonts**: Playfair Display (headings) and Poppins (text), bundled locally.

---

## 11. The contact form

```mermaid
sequenceDiagram
  participant V as Visitor
  participant F as ContactForm.tsx (browser)
  participant P as contact.php (Hostinger)
  participant M as Mailbox info@gemycampei.com
  V->>F: fills in and clicks "Send message"
  F->>P: POST form data (fetch)
  P->>P: spam checks + validation
  P->>M: email via SMTP (PHPMailer)
  P-->>F: { "ok": true }
  F-->>V: "Thank you!"
```

- The field lists (`shootTypes`, `referralSources`) exist in **both** `ContactForm.tsx` and
  `contact.php`. Change them in both places.
- The mailbox password lives on the server in `contact-config.php`, outside `public_html` and
  outside Git. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- `npm run dev` can't run PHP, so test the form on the live site.

---

## 12. Common tasks and problems

**The build stops with an error about a gallery.**
Read the message: it names the file. Typical causes: a `cover:` file name that doesn't exist,
a category folder without `_category.md`, or a typo in a setting name.

**A new gallery doesn't appear on the live site.**
Check `draft:` in `gallery.md`, and that the folder is directly inside a category folder
(`galleries/<category>/<gallery>/`), not nested deeper.

**Two words are glued together on a page ("andquiet").**
In `.astro` templates a line break right before a tag like `<strong>` drops the space.
End the previous line with `{' '}`.

**Photos look rotated or huge.**
Use `npm run new-gallery`: it fixes rotation and resizes to 2400 px.

**Something looks wrong after a change.**
Stop `npm run dev` (Ctrl+C), delete the `.astro/` folder and start it again.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Build** | Turning source files into the finished website (`dist/`). |
| **Component** | A reusable piece of a page (header, card, form). |
| **Content collection** | A group of Markdown files Astro reads as typed data (`src/content.config.ts`). |
| **Frontmatter** | The settings block between `---` lines at the top of a Markdown or Astro file. |
| **Hydration** | React taking over server-rendered HTML in the browser to make it interactive. |
| **Island** | An interactive component on an otherwise static page. |
| **JSON-LD / structured data** | Machine-readable page description for search engines. |
| **Props** | Data passed into a component. |
| **Redirect (301)** | "This page moved permanently", sends visitors and Google to the new URL. |
| **Slug** | The URL-friendly name of something, e.g. `palais-daun-kinsky-wedding-vienna`. |
| **Static site** | A website made of finished files, no server-side program per request. |
| **WebP** | Modern image format, much smaller than JPEG at the same quality. |
