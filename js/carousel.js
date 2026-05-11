// carousel.js

class Carousel {
  constructor(wrapper) {
    this.isAnimating = false;
    this.destroyed = false;
    this._onResize = null;
    this._touchStartOpts = { passive: true };
    this._scrollSyncTimeout = null;

    this.wrapper = wrapper;
    this.navigation = this.wrapper.querySelector(".navigation");
    this.carousel = this.wrapper.querySelector(".carousel__items");

    if (!this.navigation || !this.carousel) return;

    this.carouselItems = [...this.carousel.children];
    if (this.carouselItems.length === 0) return;

    const delayAttr = this.wrapper.dataset.autoscrollDelay;
    const parsed =
      delayAttr !== undefined ? Number.parseInt(delayAttr, 10) : NaN;
    this.autoScrollDelay =
      Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;

    this.totalCount = this.carouselItems.length;
    this.isAutoScroll = this.wrapper.classList.contains("carousel--autoscroll");

    this.navigationType = this.wrapper.classList.contains(
      "carousel--navigation-dots",
    )
      ? "dots"
      : this.wrapper.classList.contains("carousel--navigation-digitals")
        ? "digitals"
        : "dots";

    this.currentIndex = 0;

    this._pause = () => clearTimeout(this.autoScrollTimeout);
    this._resume = () => {
      if (!this.destroyed && this.isAutoScroll) this.autoScroll();
    };

    this._onScroll = () => {
      if (this.destroyed || this.isAnimating) return;
      clearTimeout(this._scrollSyncTimeout);
      this._scrollSyncTimeout = window.setTimeout(() => {
        if (this.destroyed || this.isAnimating) return;
        this.syncIndexFromScroll();
      }, 80);
    };

    this.init();
  }

  /**
   * Левый край слайда в координатах прокручиваемого контента.
   * Нужен offsetParent === this.carousel (см. .carousel__items { position: relative }).
   */
  getScrollLeftForIndex(index) {
    const item = this.carouselItems[index];
    return item ? item.offsetLeft : 0;
  }

  /**
   * Индекс «левого» слайда по scrollLeft: при нескольких видимых колонках
   * берём наибольший i, у которого offsetLeft уже не правее окна прокрутки.
   */
  /** Сколько карточек помещается по ширине трека (шаг = колонка + gap). */
  getSlidesPerView() {
    if (this.carouselItems.length < 2) return 1;
    const step =
      this.carouselItems[1].offsetLeft - this.carouselItems[0].offsetLeft;
    if (step <= 0) return 1;
    const n = Math.ceil(this.carousel.clientWidth / step - 1e-6);
    return Math.min(this.carouselItems.length, Math.max(1, n));
  }

  /** Максимальный индекс левой карточки (при 3 из 6 — это 3, не 5). */
  getMaxStartIndex() {
    return Math.max(0, this.totalCount - this.getSlidesPerView());
  }

  getIndexFromScrollLeft() {
    const maxSl = Math.max(
      0,
      this.carousel.scrollWidth - this.carousel.clientWidth,
    );
    const sl = Math.min(this.carousel.scrollLeft, maxSl);
    const eps = 8;
    let best = 0;
    for (let i = 0; i < this.carouselItems.length; i++) {
      const start = this.getScrollLeftForIndex(i);
      if (start <= sl + eps) best = i;
    }
    return Math.min(best, this.getMaxStartIndex());
  }

  /** Синхронизация счётчика/точек с фактической прокруткой (свайп, snap). */
  syncIndexFromScroll() {
    const best = this.getIndexFromScrollLeft();
    if (this.currentIndex !== best) {
      this.currentIndex = best;
      this.updateNavigation();
    }
  }

  init() {
    this.setupNavigation();
    this.setupEventListeners();
    this.setupResizeListener();
    this.goToSlide(0);
    if (this.isAutoScroll) this.autoScroll();
  }

  destroy() {
    this.destroyed = true;
    this.isAutoScroll = false;
    clearTimeout(this.autoScrollTimeout);
    clearTimeout(this._scrollSyncTimeout);
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
    }
    if (this.carousel) {
      this.carousel.removeEventListener("scroll", this._onScroll);
      this.carousel.removeEventListener("mouseover", this._pause);
      this.carousel.removeEventListener("mouseout", this._resume);
      this.carousel.removeEventListener(
        "touchstart",
        this._pause,
        this._touchStartOpts,
      );
      this.carousel.removeEventListener("touchend", this._resume);
    }
  }

  setupResizeListener() {
    this._onResize = () => {
      if (this.destroyed) return;
      this.currentIndex = Math.min(this.currentIndex, this.getMaxStartIndex());
      this.carousel.scrollLeft = this.getScrollLeftForIndex(this.currentIndex);
      this.updateNavigation();
    };
    window.addEventListener("resize", this._onResize, { passive: true });
  }

  setupNavigation() {
    this.navigation.innerHTML = "";

    this.prevBtn = this.createButton("prev", true);
    this.navigation.appendChild(this.prevBtn);

    if (this.navigationType === "digitals") {
      this.setupDigitals();
    } else {
      this.setupDots();
    }

    this.nextBtn = this.createButton("next", false);
    this.navigation.appendChild(this.nextBtn);

    this.addButtonListeners();
  }

  setupDots() {
    const container = document.createElement("div");
    container.classList.add("navigation__dots", "no-touch");
    for (let i = 0; i < this.totalCount; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.classList.add("button", "navigation__dot");
      if (i === 0) dot.classList.add("navigation__dot--current");
      dot.setAttribute("aria-label", `Слайд ${i + 1} из ${this.totalCount}`);
      dot.addEventListener("click", () => this.onDotClick(i));
      container.appendChild(dot);
    }
    this.navigation.appendChild(container);
  }

  onDotClick(index) {
    if (this.destroyed || this.isAnimating) return;
    this.isAnimating = true;
    clearTimeout(this.autoScrollTimeout);
    const spv = this.getSlidesPerView();
    const maxStart = this.getMaxStartIndex();
    const left = Math.min(
      Math.max(0, index - spv + 1),
      maxStart,
    );
    this.currentIndex = left;
    this.carousel.scrollLeft = this.getScrollLeftForIndex(this.currentIndex);
    this.finishInteraction();
  }

  setupDigitals() {
    const container = document.createElement("div");
    container.classList.add("navigation__dots", "no-touch");

    const current = document.createElement("span");
    current.classList.add(
      "text",
      "text--size-small",
      "navigation__count",
      "navigation__count--current",
    );
    current.textContent = "1";

    const separator = document.createElement("span");
    separator.classList.add("text", "text--size-small", "text--opacity-sixty");
    separator.textContent = "/";

    const total = document.createElement("span");
    total.classList.add(
      "text",
      "text--size-small",
      "navigation__count",
      "navigation__count--total",
    );
    total.textContent = String(this.totalCount);

    container.append(current, separator, total);
    this.navigation.appendChild(container);
  }

  finishInteraction() {
    window.setTimeout(() => {
      if (this.destroyed) return;
      this.syncIndexFromScroll();
      this.updateNavigation();
      if (this.isAutoScroll) this.autoScroll();
      this.isAnimating = false;
    }, 280);
  }

  addButtonListeners() {
    this.navigation.querySelectorAll("button[data-carousel-dir]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.destroyed || this.isAnimating) return;
        this.isAnimating = true;
        clearTimeout(this.autoScrollTimeout);

        const dir = btn.dataset.carouselDir;
        const maxStart = this.getMaxStartIndex();
        if (dir === "prev" && this.currentIndex > 0) {
          this.currentIndex--;
        } else if (dir === "next" && this.currentIndex < maxStart) {
          this.currentIndex++;
        }

        this.carousel.scrollLeft = this.getScrollLeftForIndex(this.currentIndex);
        this.finishInteraction();
      });
    });
  }

  updateNavigation() {
    if (this.destroyed) return;

    if (this.prevBtn) {
      this.prevBtn.classList.toggle("button--disabled", this.currentIndex === 0);
    }
    if (this.nextBtn) {
      this.nextBtn.classList.toggle(
        "button--disabled",
        this.currentIndex >= this.getMaxStartIndex(),
      );
    }

    if (this.navigationType === "dots") {
      const spv = this.getSlidesPerView();
      const lastVis = Math.min(
        this.totalCount - 1,
        this.currentIndex + spv - 1,
      );
      this.navigation.querySelectorAll(".navigation__dot").forEach((dot, i) => {
        dot.classList.toggle("navigation__dot--current", i === lastVis);
      });
    } else {
      const currentEl = this.navigation.querySelector(
        ".navigation__count--current",
      );
      if (currentEl) {
        currentEl.textContent = String(
          Math.min(
            this.totalCount,
            this.currentIndex + this.getSlidesPerView(),
          ),
        );
      }
    }
  }

  goToSlide(index) {
    if (this.destroyed) return;
    const maxStart = this.getMaxStartIndex();
    this.currentIndex = Math.max(0, Math.min(index, maxStart));
    this.carousel.scrollLeft = this.getScrollLeftForIndex(this.currentIndex);
    this.updateNavigation();
  }

  createButton(direction, disabled) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.carouselDir = direction;
    btn.classList.add("button", "button--shape-circle");
    if (direction === "prev") btn.classList.add("button--direction-prev");
    else btn.classList.add("button--direction-next");
    if (disabled) btn.classList.add("button--disabled");
    btn.setAttribute(
      "aria-label",
      direction === "prev" ? "Предыдущий слайд" : "Следующий слайд",
    );
    return btn;
  }

  setupEventListeners() {
    this.carousel.addEventListener("scroll", this._onScroll, { passive: true });
    this.carousel.addEventListener("mouseover", this._pause);
    this.carousel.addEventListener("mouseout", this._resume);
    this.carousel.addEventListener(
      "touchstart",
      this._pause,
      this._touchStartOpts,
    );
    this.carousel.addEventListener("touchend", this._resume);
  }

  /** Автопрокрутка без зацикливания: останавливается на последнем слайде. */
  autoScroll() {
    if (!this.isAutoScroll || this.destroyed) return;
    clearTimeout(this.autoScrollTimeout);

    if (this.currentIndex >= this.getMaxStartIndex()) return;

    this.autoScrollTimeout = window.setTimeout(() => {
      if (this.destroyed) return;
      if (this.currentIndex >= this.getMaxStartIndex()) return;
      this.currentIndex++;
      this.carousel.scrollLeft = this.getScrollLeftForIndex(this.currentIndex);
      this.updateNavigation();
      this.autoScroll();
    }, this.autoScrollDelay);
  }
}

document.querySelectorAll(".carousel").forEach((c) => {
  new Carousel(c);
});

const mw1222 = window.matchMedia("(max-width: 1222px)");
let detailsCarousel = null;

const initMobileCarousels = (e) => {
  const detailsContent = document.querySelector(".details__content");
  const detailsItems = document.querySelector(".details__items");
  const detailsNav = document.querySelector(".details__navigation");

  if (!detailsContent || !detailsItems || !detailsNav) return;

  if (e.matches) {
    detailsCarousel?.destroy();
    detailsCarousel = null;
    detailsContent.classList.add("carousel");
    detailsItems.classList.add("carousel__items");
    detailsNav.replaceChildren();
    detailsCarousel = new Carousel(detailsContent);
  } else {
    detailsCarousel?.destroy();
    detailsCarousel = null;
    detailsContent.classList.remove("carousel");
    detailsItems.classList.remove("carousel__items");
    detailsNav.replaceChildren();
    detailsItems.scrollLeft = 0;
  }
};

mw1222.addEventListener("change", initMobileCarousels);
initMobileCarousels(mw1222);

/** Плавный скролл к секциям по кнопкам в шапке (надёжнее, чем только CSS). */
document.querySelectorAll('a[href="#support"], a[href="#details"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return;
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", href);
  });
});
