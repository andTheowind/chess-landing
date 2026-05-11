document.querySelectorAll(".ticker").forEach((ticker) => {
  const viewport = ticker.querySelector(".ticker__viewport");
  const firstContent = viewport?.querySelector(".ticker__content");
  if (!viewport || !firstContent) return;
  if (viewport.querySelector(".ticker__track")) return;

  const track = document.createElement("div");
  track.className = "ticker__track";

  const clone = firstContent.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");

  viewport.insertBefore(track, firstContent);
  track.appendChild(firstContent);
  track.appendChild(clone);

  const syncStripMinWidth = () => {
    const w = Math.ceil(viewport.getBoundingClientRect().width);
    track.querySelectorAll(".ticker__content").forEach((el) => {
      el.style.minWidth = `${w}px`;
    });
  };

  syncStripMinWidth();
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncStripMinWidth).observe(viewport);
  } else {
    window.addEventListener("resize", syncStripMinWidth);
  }
});
