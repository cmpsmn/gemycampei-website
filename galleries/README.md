# Galleries

Every photo on the gallery pages lives in this folder.

German addresses only exist while the German version is switched on (manager → Settings, or
`german:` in `src/content/settings.yaml`).

```
galleries/                          English address                          German address
  vienna-wedding-photographer/      /vienna-wedding-photographer/            /de/hochzeitsfotograf-wien/
  dolomites-elopement-photographer/ /dolomites-elopement-photographer/       /de/elopement-fotograf-dolomiten/
  vienna-maternity-photographer/    /vienna-maternity-photographer/          /de/babybauch-fotoshooting-wien/
  35mm-film-super-8-wedding/        /35mm-film-super-8-wedding/              /de/analoge-hochzeitsfotografie-super-8/

  <category>/
    _category.md              settings + intro text of the category (required)
    _category.de.md           German texts of the category (its `slug` is the German address)
    hero.jpg                  big image at the top of the category page
    <gallery>/                one folder per gallery, the name becomes the URL
      gallery.md              optional settings + story text (+ Vimeo videos)
      gallery.de.md           optional German texts + story (+ German video titles)
      photos.yaml             optional description of every photo (alt texts, English + German)
      posters/                optional preview images of the videos (not counted as photos)
      photo-001.jpg ...       the photos
```

The folder names contain the search terms couples use ("Vienna wedding photographer",
"Dolomites elopement photographer"): words in the address help Google a little. If you
rename a category folder that is already live, add its old address to `legacyUrls` in
`_category.md` so it is redirected.

## The easy way: the gallery manager

```bash
npm run manage
```

A browser tab opens where you create galleries, drop in photos, drag them into order, pick the
cover and its focus point, tick categories and edit every text. It writes exactly the files
described below, so you can switch between the manager and editing by hand at any time.
See section 7 of the [main README](../README.md#7-the-gallery-manager).

## Add a gallery by hand in 3 steps

1. **Create a folder** inside the right category, named with the place and type, e.g.
   `galleries/dolomites-elopement-photographer/seceda-elopement-dolomites-a-and-b/`.
   Use lowercase letters, numbers and dashes only. The name becomes the address:
   `gemycampei.com/dolomites-elopement-photographer/seceda-elopement-dolomites-a-and-b/`.
2. **Copy the photos** into the folder. They appear sorted by file name, so number them
   (`001.jpg`, `002.jpg` …). Export them at about 2400 px on the long side.
3. **Build** (`npm run dev` to preview, `git push` to publish). Done.

That's enough for a working gallery. For a better page, add a `gallery.md`:

```yaml
---
title: "Seceda"                        # big title (default: made from the folder name)
type: "Elopement"                      # kind of shoot (default: from _category.md)
couple: "A & B"                        # small line above the title
location: "Seceda, Dolomites, Italy"   # used in the page title and for Google
cover: seceda-004.jpg                  # title image (default: cover.jpg or the first photo)
coverFocus: "50% 30%"                  # the spot to keep when the cover is cropped (x% y%)
alsoIn: [35mm-film-super-8-wedding]            # also show this gallery in other categories
draft: false                           # true = only visible with npm run dev
---

Write the story here: the place, the light, the mood of the day.
Mentioning the location helps couples find the gallery on Google.
```

All fields are explained in `src/content.config.ts`.

## German texts and photo descriptions

**German.** While the German version is switched on, every page exists in English (the main
language) and German, under `/de/`. The
German texts of a gallery are in `gallery.de.md` next to `gallery.md` (title, type, place,
Google title and description, and the story below the settings block). Photos and settings
always come from `gallery.md`. In the gallery manager these are the fields of the
**Deutsch** card. A gallery without `gallery.de.md` still gets a German page, with the
English story; that page is hidden from Google until the German text exists.

**Photo descriptions.** `photos.yaml` describes what is in each photo, in both languages:

```yaml
lago-di-braies-elopement-s-and-j-016.jpg:
  en: "Couple exchanging vows on the jetty at Lago di Braies in the mist"
  de: "Paar gibt sich auf dem Steg am Pragser Wildsee im Nebel das Ja-Wort"
```

They are the alt texts that Google Images and screen readers read. Keep them short and
natural: what you see, then the place. In the manager, select one photo to edit its
description; photos without one show a small "no text" mark. The manager keeps the file in
step when photos are reordered, moved, deleted or restored.

## A gallery in several categories

A gallery lives in **one** folder. That folder is its main category and decides its
address. To show it in more categories, list them in `gallery.md`:

```yaml
alsoIn: [35mm-film-super-8-wedding]
```

The gallery then also appears as a card on the 35mm & Super 8 page and under that
filter button on `/galleries/`. It keeps a single address, which is what Google wants.

## Order of galleries

Each `_category.md` has its own list, so a gallery can be first on one page and last on another:

```yaml
galleryOrder:
  - vienna-wedding-photographer/palais-daun-kinsky-wedding-vienna
  - dolomites-elopement-photographer/seceda-elopement-dolomites-a-and-b   # shown here through alsoIn
```

Entries are `<main category>/<gallery folder>`. Galleries missing from the list follow at the
end, newest `date` first. The manager's **Order on pages** tab edits these lists by dragging.

## Testimonials linked to a gallery

A review in `src/content/testimonials/` can point to a gallery:

```yaml
gallery: dolomites-elopement-photographer/seceda-elopement-dolomites-a-and-b
galleryPhoto: seceda-elopement-dolomites-a-and-b-004.jpg   # instead of its own image
```

The testimonials page then links to the gallery, and the gallery page shows the review.
If you rename or move a gallery by hand, update these lines too (the manager does it for you).

## Faster: the helper script

```bash
npm run new-gallery -- --category dolomites-elopement-photographer --type Elopement --title "Seceda" --couple "A & B" --place "Dolomites" --photos "C:\Users\campe\Pictures\Export\Seceda"
```

It creates the folder and `gallery.md`, resizes the photos to 2400 px, fixes their rotation,
removes camera and GPS data, and gives them descriptive file names (good for Google Images).
Add `--also-in "35mm-film-super-8-wedding"` to list the gallery in more categories.

## Importing photos from the old Pixieset site

```bash
npm run import-pixieset -- --dry-run            # only show which galleries would be filled
npm run import-pixieset                         # all Weddings + The Alps galleries
npm run import-pixieset -- --only LagoDiBraies  # a single gallery (its old Pixieset address)
```

The script reads the Weddings and The Alps pages on www.gemycampei.com, finds each gallery's
local folder through `legacyUrls`, downloads the largest version of every photo in the Pixieset
order and optimises it. The old photos of the folder go to `.trash/` (restore them in the
manager). Your cover and review photos are recognised among the new photos. A cover that isn't
part of the Pixieset gallery stays as the first photo. Galleries without a local folder are
created as drafts. Running it again skips galleries that haven't changed.

## How the category pages show galleries

Set with `display:` in each `_category.md`:

| display | Looks like | Used by |
|---|---|---|
| `cards` | a card per gallery, each gallery has its own page | weddings, the Alps, maternity |
| `carousel` | hero image, then all photos in a full-width row that moves on by itself, then the videos of its galleries | 35mm & Super 8 |
| `slider` | hero image, then all photos one at a time with counter and thumbnails | (available, not used) |

For `slider` and `carousel`, just add photos to the gallery folders inside the category.
Galleries listed there only through `alsoIn` appear as cards below the slider or carousel.

`galleryPages: true` (used for 35mm & Super 8) additionally gives each gallery of a slider or
carousel category its own page and a card (with a filter button) on `/galleries/`, while the
category page itself keeps the photo row and the films.

Category pages show no reviews: reviews appear on the testimonials page and on the couple's gallery page.

## Videos (Super 8)

A gallery can show Vimeo videos, two per row, before its story. On a carousel category page
(35mm & Super 8) the videos of its galleries are shown after the photo row. A gallery of videos only (like
`35mm-film-super-8-wedding/super-8-films/`) needs no photos: its card uses the first preview
image.

```yaml
videos:
  - vimeoId: "1226323019"          # the number in the Vimeo address
    title: "Leonie & Yassine · Super 8 wedding film"
    poster: super-8-leonie-and-yassine.jpg   # file in the gallery's posters/ folder
```

German titles go into `gallery.de.md` as `videoTitles:`, in the same order. In the manager this
is the **Videos** card of the gallery. Vimeo only plays a video on the website if you allow it:
Vimeo → the video → Privacy → "Where can this be embedded?" → add gemycampei.com.

The hero image (`hero.jpg`) is shown at the top. Don't put the same photo into the gallery
folder as well, or it appears twice.

## Galleries that are still drafts

Some galleries from the old site only have their cover photo so far. They have `draft: true`
and are hidden on the live site. Copy the photos into the folder, write the story, and delete
the `draft: true` line.
