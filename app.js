const CATAAS_ORIGIN = "https://cataas.com";
const PAGE_SIZE = 12;
const CAT_ID = /^[A-Za-z0-9]+$/;

const form = document.querySelector("#finder-form");
const queryInput = document.querySelector("#query");
const findButton = document.querySelector("#find-button");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const moreButton = document.querySelector("#more");
const suggestions = document.querySelector("#tag-suggestions");
const viewer = document.querySelector("#viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerCaption = document.querySelector("#viewer-caption");

let catalog = [];
let matches = [];
let shown = 0;
let requestSerial = 0;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void runSearch();
});

moreButton.addEventListener("click", () => {
  appendPage();
  setStatus(statusText());
});

resultsEl.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (!card) {
    return;
  }
  openViewer(card.dataset.src, card.dataset.caption);
});

viewer.addEventListener("close", () => {
  viewerImage.removeAttribute("src");
  viewerImage.alt = "";
  viewerCaption.textContent = "";
});

async function runSearch() {
  const serial = ++requestSerial;
  setBusy(true);
  setStatus("Looking through the cat GIF catalog…");
  moreButton.hidden = true;
  resultsEl.replaceChildren();

  try {
    if (catalog.length === 0) {
      catalog = await loadCatalog();
      if (serial !== requestSerial) {
        return;
      }
      fillSuggestions(catalog);
    }

    const query = queryInput.value.trim().toLowerCase();
    matches = filterCatalog(catalog, query);
    shown = 0;

    if (matches.length === 0) {
      setStatus(
        query
          ? `No GIFs tagged “${query}”. Try box, kitten, or cute.`
          : "The catalog came back empty."
      );
      return;
    }

    appendPage();
    setStatus(statusText());
  } catch (error) {
    if (serial !== requestSerial) {
      return;
    }
    setStatus("Could not reach the cat API. Check your connection and try again.");
  } finally {
    if (serial === requestSerial) {
      setBusy(false);
    }
  }
}

async function loadCatalog() {
  const first = await fetchGifPage(0);
  const rest = first.length === 100 ? await fetchGifPage(100) : [];
  const byId = new Map();

  for (const cat of first.concat(rest)) {
    if (!cat || typeof cat.id !== "string" || !CAT_ID.test(cat.id)) {
      continue;
    }
    if (cat.mimetype !== "image/gif") {
      continue;
    }
    byId.set(cat.id, {
      id: cat.id,
      tags: Array.isArray(cat.tags) ? cat.tags.map((tag) => String(tag)) : [],
    });
  }

  return Array.from(byId.values());
}

async function fetchGifPage(skip) {
  const params = new URLSearchParams({
    tags: "gif",
    limit: "100",
    skip: String(skip),
  });
  const response = await fetch(`${CATAAS_ORIGIN}/api/cats?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status})`);
  }
  const body = await response.json();
  if (!Array.isArray(body)) {
    throw new Error("Catalog response was not a list");
  }
  return body;
}

function filterCatalog(cats, query) {
  const filtered = query
    ? cats.filter((cat) =>
        cat.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    : cats.slice();

  if (!query) {
    return shuffle(filtered);
  }
  return filtered;
}

function shuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

function fillSuggestions(cats) {
  const tags = new Set();
  for (const cat of cats) {
    for (const tag of cat.tags) {
      const cleaned = tag.trim();
      if (!cleaned || cleaned.toLowerCase() === "gif") {
        continue;
      }
      tags.add(cleaned);
    }
  }

  const options = Array.from(tags)
    .sort((left, right) => left.localeCompare(right))
    .map((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      return option;
    });
  suggestions.replaceChildren(...options);
}

function appendPage() {
  const next = matches.slice(shown, shown + PAGE_SIZE);
  const fragment = document.createDocumentFragment();

  for (const cat of next) {
    const caption = captionFor(cat);
    const src = `${CATAAS_ORIGIN}/cat/${cat.id}`;
    const item = document.createElement("li");
    const button = document.createElement("button");
    const image = document.createElement("img");
    const label = document.createElement("span");

    button.type = "button";
    button.className = "card";
    button.dataset.src = src;
    button.dataset.caption = caption;
    image.src = src;
    image.alt = `Cat GIF tagged ${caption}`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.alt = "This GIF could not be loaded";
    });
    label.textContent = caption;
    button.append(image, label);
    item.append(button);
    fragment.append(item);
  }

  resultsEl.append(fragment);
  shown += next.length;
  moreButton.hidden = shown >= matches.length;
}

function captionFor(cat) {
  const tags = cat.tags
    .map((tag) => tag.trim())
    .filter((tag) => tag && tag.toLowerCase() !== "gif");
  return tags.length > 0 ? tags.join(", ") : "cat";
}

function statusText() {
  const query = queryInput.value.trim();
  const scope = query ? `tagged “${query}”` : "from a random batch";
  return `Showing ${shown} of ${matches.length} GIFs ${scope}.`;
}

function openViewer(src, caption) {
  viewerImage.src = src;
  viewerImage.alt = `Cat GIF tagged ${caption}`;
  viewerCaption.textContent = caption;
  if (typeof viewer.showModal === "function") {
    viewer.showModal();
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setBusy(isBusy) {
  findButton.disabled = isBusy;
  queryInput.disabled = isBusy;
  moreButton.disabled = isBusy;
}

void runSearch();
