import { prefersReducedMotion } from "./motion.ts";

// Share of the page height the ribbon is drawn ahead of the viewport, for dramatic anticipation
const RIBBON_LEAD = 1.08;
const SLIDER_AUTO_ROTATE_MS = 4200;

// Stroke offset that leaves the ribbon drawn up to the scroll position
export const ribbonDashOffset = (length: number, scrollY: number, maxScroll: number) => {
	const progress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
	const drawLength = length * Math.min(progress * RIBBON_LEAD, 1);
	return length - drawLength;
};

// Slide index wrapped around the ends of a carousel of `count` slides
export const wrapSlideIndex = (idx: number, count: number) => {
	if (idx < 0) return count - 1;
	if (idx >= count) return 0;
	return idx;
};

// Index of the carousel slide a horizontal scroll position rests on
export const slideIndexAtScroll = (scrollLeft: number, clientWidth: number) => Math.round(scrollLeft / clientWidth);

export const initMobileMenu = () => {
	const navToggle = document.getElementById("navToggle");
	const mobileDrawer = document.getElementById("mobileDrawer");
	if (navToggle && mobileDrawer) {
		navToggle.addEventListener("click", () => {
			mobileDrawer.classList.toggle("open");
		});
		mobileDrawer.querySelectorAll("a").forEach((l) => {
			l.addEventListener("click", () => mobileDrawer.classList.remove("open"));
		});
	}
};

export const initScrollRibbon = () => {
	const ribbon = document.getElementById("spineRibbon") as SVGGeometryElement | null;
	if (ribbon && !prefersReducedMotion()) {
		try {
			const length = ribbon.getTotalLength();
			ribbon.style.strokeDasharray = `${length} ${length}`;
			ribbon.style.strokeDashoffset = `${length}`;

			let cachedMaxScroll = 0;
			const measureMaxScroll = () => {
				cachedMaxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
			};
			measureMaxScroll();
			window.addEventListener("resize", measureMaxScroll, { passive: true });

			let ticking = false;
			const updateRibbon = () => {
				const scrollY = window.scrollY;
				ribbon.style.strokeDashoffset = `${ribbonDashOffset(length, scrollY, cachedMaxScroll)}`;
				ticking = false;
			};

			window.addEventListener("scroll", () => {
				if (!ticking) {
					window.requestAnimationFrame(updateRibbon);
					ticking = true;
				}
			}, { passive: true });

			updateRibbon();
		} catch (e) {
			console.debug("Ribbon calculation init", e);
		}
	}
};

export const initSliders = () => {
	const sliders = document.querySelectorAll<HTMLElement>("[data-slider]");
	sliders.forEach((slider) => {
		const track = slider.querySelector<HTMLElement>("[data-track]");
		const dots = Array.from(slider.querySelectorAll<HTMLButtonElement>(".slider-dot"));
		const prevBtn = slider.querySelector<HTMLButtonElement>('[data-action="prev"]');
		const nextBtn = slider.querySelector<HTMLButtonElement>('[data-action="next"]');
		if (!track) return;

		let currentIndex = 0;
		const slidesCount = track.children.length;
		let timer: ReturnType<typeof setInterval> | null = null;

		const updateDots = (idx: number) => {
			dots.forEach((dot, dIdx) => {
				dot.classList.toggle("active", dIdx === idx);
			});
		};

		const goToSlide = (idx: number) => {
			idx = wrapSlideIndex(idx, slidesCount);
			currentIndex = idx;
			track.scrollTo({
				left: track.clientWidth * idx,
				behavior: "smooth"
			});
			updateDots(idx);
		};

		// Prev / Next actions
		if (prevBtn) {
			prevBtn.addEventListener("click", () => {
				stopAuto();
				goToSlide(currentIndex - 1);
				startAuto();
			});
		}
		if (nextBtn) {
			nextBtn.addEventListener("click", () => {
				stopAuto();
				goToSlide(currentIndex + 1);
				startAuto();
			});
		}

		// Dot click
		dots.forEach((dot) => {
			dot.addEventListener("click", () => {
				stopAuto();
				const targetIndex = Number(dot.dataset.slideIndex || 0);
				goToSlide(targetIndex);
				startAuto();
			});
		});

		// Auto rotation
		const startAuto = () => {
			if (prefersReducedMotion()) return;
			if (slidesCount <= 1) return;
			if (timer) clearInterval(timer);
			timer = setInterval(() => {
				goToSlide(currentIndex + 1);
			}, SLIDER_AUTO_ROTATE_MS);
		};

		const stopAuto = () => {
			if (timer) clearInterval(timer);
			timer = null;
		};

		slider.addEventListener("mouseenter", stopAuto);
		slider.addEventListener("mouseleave", startAuto);
		startAuto();

		// Sync dot on native touch swipe
		track.addEventListener("scroll", () => {
			const activeSlide = slideIndexAtScroll(track.scrollLeft, track.clientWidth);
			if (activeSlide !== currentIndex && activeSlide >= 0 && activeSlide < slidesCount) {
				currentIndex = activeSlide;
				updateDots(currentIndex);
			}
		}, { passive: true });
	});
};

export const initRevealOnScroll = () => {
	const reveals = document.querySelectorAll(".reveal, .spawn");
	if (
		!prefersReducedMotion() &&
		"IntersectionObserver" in window
	) {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add("in-view");
					} else if (entry.target.classList.contains("spawn")) {
						entry.target.classList.remove("in-view");
					}
				});
			},
			{ threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
		);

		reveals.forEach((el) => observer.observe(el));
	} else {
		reveals.forEach((el) => el.classList.add("in-view"));
	}
};
