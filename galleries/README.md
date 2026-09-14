# Galleries

Every photo on the gallery pages lives in this folder.

```
galleries/
  weddings/                   /weddings/
  the-alps/                   /the-alps/            elopements, couple sessions, proposals
  maternity/                  /maternity/           photos shown in a moving carousel
  35mm-super-8-film/          /35mm-super-8-film/   photos shown in a moving carousel

  <category>/
    _category.md              settings + intro text of the category (required)
    hero.jpg                  big image at the top of the category page
    <gallery>/                one folder per gallery, the name becomes the URL
      gallery.md              optional settings + story text
      photo-001.jpg ...       the photos
```

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
   `galleries/the-alps/seceda-elopement-dolomites-a-and-b/`.
   Use lowercase letters, numbers and dashes only. The name becomes the address:
   `gemycampei.com/the-alps/seceda-elopement-dolomites-a-and-b/`.
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
alsoIn: [35mm-super-8-film]            # also show this gallery in other categories
draft: false                           # true = only visible with npm run dev
---

Write the story here: the place, the light, the mood of the day.
Mentioning the location helps couples find the gallery on Google.
```

All fields are explained in `src/content.config.ts`.

## A gallery in several categories

A gallery lives in **one** folder. That folder is its main category and decides its
address. To show it in more categories, list them in `gallery.md`:

```yaml
alsoIn: [35mm-super-8-film]
```

The gallery then also appears as a card on the 35mm & Super 8 page and under that
filter button on `/galleries/`. It keeps a single address, which is what Google wants.

## Order of galleries

Each `_category.md` has its own list, so a gallery can be first on one page and last on another:

```yaml
galleryOrder:
  - weddings/palais-daun-kinsky-wedding-vienna
  - the-alps/seceda-elopement-dolomites-a-and-b   # shown here through alsoIn
```

Entries are `<main category>/<gallery folder>`. Galleries missing from the list follow at the
end, newest `date` first. The manager's **Order on pages** tab edits these lists by dragging.

## Testimonials linked to a gallery

A review in `src/content/testimonials/` can point to a gallery:

```yaml
gallery: the-alps/seceda-elopement-dolomites-a-and-b
galleryPhoto: seceda-elopement-dolomites-a-and-b-004.jpg   # instead of its own image
```

The testimonials page then links to the gallery, and the gallery page shows the review.
If you rename or move a gallery by hand, update these lines too (the manager does it for you).

## Faster: the helper script

```bash
npm run new-gallery -- --category the-alps --type Elopement --title "Seceda" --couple "A & B" --place "Dolomites" --photos "C:\Users\campe\Pictures\Export\Seceda"
```

It creates the folder and `gallery.md`, resizes the photos to 2400 px, fixes their rotation,
removes camera and GPS data, and gives them descriptive file names (good for Google Images).
Add `--also-in "35mm-super-8-film"` to list the gallery in more categories.

## How the category pages show galleries

Set with `display:` in each `_category.md`:

| display | Looks like | Used by |
|---|---|---|
| `cards` | a card per gallery, each gallery has its own page | weddings, the-alps |
| `carousel` | hero image, then all photos in a full-width row that moves on by itself | maternity, 35mm-super-8-film |
| `slider` | hero image, then all photos one at a time with counter and thumbnails | (available, not used) |

For `slider` and `carousel`, just add photos to the gallery folder inside the category
(e.g. `maternity/the-beauty-of-becoming/`). Galleries listed there only through `alsoIn`
appear as cards below the slider or carousel.

The hero image (`hero.jpg`) is shown at the top. Don't put the same photo into the gallery
folder as well, or it appears twice.

## Galleries that are still drafts

Some galleries from the old site only have their cover photo so far. They have `draft: true`
and are hidden on the live site. Copy the photos into the folder, write the story, and delete
the `draft: true` line.
