const toggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".nav");
function closeMenu() {
  navigation?.classList.remove("menu-open");
  toggle?.setAttribute("aria-expanded", "false");
  if (toggle) toggle.textContent = "Menu +";
  document.querySelector("main")?.removeAttribute("inert");
  document.querySelector("footer")?.removeAttribute("inert");
}
toggle?.addEventListener("click", () => {
  const opened = navigation.classList.toggle("menu-open");
  toggle.setAttribute("aria-expanded", String(opened));
  toggle.textContent = opened ? "Close −" : "Menu +";
  document.querySelector("main")?.toggleAttribute("inert", opened);
  document.querySelector("footer")?.toggleAttribute("inert", opened);
});
navigation
  ?.querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navigation?.classList.contains("menu-open")) {
    closeMenu();
    toggle.focus();
  }
});
window.matchMedia("(min-width: 601px)").addEventListener("change", closeMenu);

const examples = {
  derivative: {
    equation: "dq / dt",
    narration: "the derivative of q with respect to t",
    reason:
      "Treat the derivative as one mathematical operator, so the listener hears the operation rather than a sequence of letters.",
  },
  fraction: {
    equation: "(a + b) / (c + d)",
    narration: "the quantity a plus b, divided by the quantity c plus d",
    reason:
      "Make the numerator and denominator explicit. Spoken grouping carries the structure that a fraction bar normally provides.",
  },
  chain: {
    equation: "A = B = C",
    narration: "A equals B. B equals C.",
    reason:
      "Break a chain into shorter clauses. This illustration shows how pause boundaries can make each relationship easier to follow.",
  },
};
document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    const example = examples[button.dataset.example];
    document
      .querySelectorAll("[data-example]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    document.querySelector(".demo-equation").textContent = example.equation;
    document.querySelector(".demo-output").textContent = example.narration;
    document.querySelector(".demo-reason").textContent = example.reason;
  });
});

const media = document.querySelectorAll("audio");
media.forEach((audio) =>
  audio.addEventListener("play", () =>
    media.forEach((other) => {
      if (other !== audio) other.pause();
    }),
  ),
);

// Real captures remain ordinary image links when JavaScript is unavailable.
const captures = [...document.querySelectorAll("a[data-gallery]")];
if (captures.length && typeof HTMLDialogElement !== "undefined") {
  const viewer = document.createElement("dialog");
  viewer.className = "capture-viewer";
  viewer.setAttribute("aria-labelledby", "viewer-title");
  viewer.innerHTML = `<div class="viewer-header"><h2 id="viewer-title">A closer look</h2><div class="viewer-tools"><button type="button" class="viewer-zoom" aria-pressed="false">Full size</button><button type="button" class="viewer-close" autofocus>Close ×</button></div></div><div class="viewer-image-area" tabindex="0" role="region" aria-label="App capture; scroll to explore when full size is enabled"><img alt=""/></div><div class="viewer-bottom"><p class="viewer-caption"></p><div class="viewer-pagination"><button type="button" class="viewer-prev" aria-label="Previous capture">← Previous</button><span class="viewer-count" aria-live="polite" aria-atomic="true"></span><button type="button" class="viewer-next" aria-label="Next capture">Next →</button></div></div>`;
  document.body.append(viewer);
  const area = viewer.querySelector(".viewer-image-area");
  const preview = area.querySelector("img");
  const zoom = viewer.querySelector(".viewer-zoom");
  const prev = viewer.querySelector(".viewer-prev");
  const next = viewer.querySelector(".viewer-next");
  let group = [],
    position = 0,
    opener;
  function displayCapture() {
    const capture = group[position];
    preview.src = capture.href;
    preview.alt = capture.querySelector("img").alt;
    viewer.querySelector(".viewer-caption").textContent =
      capture.dataset.caption;
    viewer.querySelector(".viewer-count").textContent =
      `${position + 1} / ${group.length}`;
    prev.disabled = position === 0;
    next.disabled = position === group.length - 1;
    if (document.activeElement === prev && prev.disabled) next.focus();
    if (document.activeElement === next && next.disabled) prev.focus();
    area.classList.remove("is-zoomed");
    area.scrollTo(0, 0);
    zoom.setAttribute("aria-pressed", "false");
    zoom.textContent = "Full size";
  }
  captures.forEach((capture) =>
    capture.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      opener = capture;
      group = captures.filter(
        (item) => item.dataset.gallery === capture.dataset.gallery,
      );
      position = group.indexOf(capture);
      displayCapture();
      viewer.showModal();
    }),
  );
  prev.addEventListener("click", () => {
    if (position > 0) {
      position--;
      displayCapture();
    }
  });
  next.addEventListener("click", () => {
    if (position < group.length - 1) {
      position++;
      displayCapture();
    }
  });
  zoom.addEventListener("click", () => {
    const expanded = area.classList.toggle("is-zoomed");
    zoom.setAttribute("aria-pressed", String(expanded));
    zoom.textContent = expanded ? "Fit to screen" : "Full size";
    area.scrollTo(0, 0);
  });
  viewer
    .querySelector(".viewer-close")
    .addEventListener("click", () => viewer.close());
  viewer.addEventListener("close", () =>
    opener?.focus({ preventScroll: true }),
  );
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const stops = [
        ...viewer.querySelectorAll('button:not(:disabled), [tabindex="0"]'),
      ];
      const first = stops[0],
        last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    // In full-size view, arrow keys remain available for panning the image.
    if (area.classList.contains("is-zoomed")) return;
    if (event.key === "ArrowLeft" && position > 0) {
      event.preventDefault();
      position--;
      displayCapture();
    }
    if (event.key === "ArrowRight" && position < group.length - 1) {
      event.preventDefault();
      position++;
      displayCapture();
    }
  });
  viewer.addEventListener("click", (event) => {
    if (event.target !== viewer) return;
    const bounds = viewer.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      viewer.close();
  });
}
