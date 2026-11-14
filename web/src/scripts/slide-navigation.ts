import { getSlideOffsets, getCachedDocHeight, type SlideOffset } from "./slide-offsets.ts";
import { prefersReducedMotion } from "./motion.ts";

// Desktop layout starts above this window width
const DESKTOP_MIN_WIDTH = 960;
// Wheel deltas below this only block native scroll, they do not start a slide jump
const WHEEL_MIN_DELTA = 25;
// A slide must be further than this from the scroll position to count as a wheel target
const SLIDE_TARGET_MARGIN = 15;
// Scrolled-to-bottom tolerance in px
const BOTTOM_TOLERANCE = 30;
// Share of the window height below the scroll position that picks the active slide
const ACTIVE_SLIDE_FOCUS = 0.45;
const WHEEL_COOLDOWN_MS = 200;

type EasingName = "easeInOutCubic" | "easeOutExpo" | "easeInOutQuad" | "linear";

// =========================================================================
// TUNING PARAMETERS FOR SLIDE TRANSITIONS & WHEEL SNAPPING SPEED
// =========================================================================
export const SLIDE_TRANSITION_CONFIG = {
	// Duration of animated transition between slides in milliseconds
	// 400ms = snappy / quick
	// 750ms = balanced cinematic
	// 1000ms - 2500ms = slow, calm & immersive
	durationMs: 1000,

	// Easing function for smooth slide transition:
	// 'easeInOutCubic', 'easeOutExpo', 'easeInOutQuad', or 'linear'
	easing: "easeInOutQuad" as EasingName,

	// Enable smooth wheel hijacking between full-height slides
	// When true, scrolling the mouse wheel triggers an animated slide jump with durationMs
	enableWheelSnap: true,
};

// Easing calculators
export const easeFunctions: Record<EasingName, (t: number) => number> = {
	easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
	easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
	easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
	linear: (t) => t,
};

// Top of the next slide below (delta > 0) or above (delta < 0) the scroll position, or null when there is none
export const findWheelTargetTop = (offsets: SlideOffset[], currentScroll: number, delta: number): number | null => {
	if (delta > 0) {
		for (let i = 0; i < offsets.length; i++) {
			if (offsets[i].top > currentScroll + SLIDE_TARGET_MARGIN) return offsets[i].top;
		}
	} else if (delta < 0) {
		for (let i = offsets.length - 1; i >= 0; i--) {
			if (offsets[i].top < currentScroll - SLIDE_TARGET_MARGIN) return offsets[i].top;
		}
	}
	return null;
};

// Id of the indicator slide the screen is on: the last one at the page bottom, else the one closest to the focus line
export const findActiveSlideId = (targetIds: string[], offsets: SlideOffset[], scrollY: number, winH: number, docH: number) => {
	if (scrollY + winH >= docH - BOTTOM_TOLERANCE && targetIds.length > 0) {
		return targetIds[targetIds.length - 1];
	}
	const ids = new Set(targetIds);
	const candidates = offsets.filter((o) => ids.has(o.id));
	const focusLine = scrollY + winH * ACTIVE_SLIDE_FOCUS;
	let activeId = targetIds[0];
	let closestDist = Infinity;
	for (const candidate of candidates) {
		const dist = Math.abs(candidate.top - focusLine);
		if (dist < closestDist) {
			closestDist = dist;
			activeId = candidate.id;
		}
	}
	return activeId;
};

let isSlideTransitioning = false;
let slideAnimationId: number | null = null;
let wheelCooldownTimer: ReturnType<typeof setTimeout> | null = null;
let wheelBlocked = false;

const smoothScrollToTarget = (targetY: number, onComplete?: () => void) => {
	if (slideAnimationId !== null) {
		cancelAnimationFrame(slideAnimationId);
		slideAnimationId = null;
	}
	if (wheelCooldownTimer) {
		clearTimeout(wheelCooldownTimer);
		wheelCooldownTimer = null;
	}

	// Ensure native browser CSS scroll-behavior and scroll-snap do not interfere with frame-by-frame updates
	document.documentElement.style.scrollBehavior = "auto";
	document.documentElement.style.scrollSnapType = "none";

	const maxScrollY = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
	const clampedTargetY = Math.min(Math.max(0, Math.round(targetY)), maxScrollY);

	const startY = window.scrollY;
	const distance = clampedTargetY - startY;
	if (Math.abs(distance) < 2) {
		document.documentElement.style.scrollSnapType = "";
		isSlideTransitioning = false;
		wheelBlocked = false;
		if (onComplete) onComplete();
		return;
	}

	isSlideTransitioning = true;
	wheelBlocked = true;
	const startTime = performance.now();
	const duration = SLIDE_TRANSITION_CONFIG.durationMs;
	const ease = easeFunctions[SLIDE_TRANSITION_CONFIG.easing];

	const step = (now: number) => {
		const elapsed = now - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const eased = ease(progress);

		window.scrollTo(0, startY + distance * eased);

		if (progress < 1) {
			slideAnimationId = requestAnimationFrame(step);
		} else {
			window.scrollTo(0, clampedTargetY);
			document.documentElement.style.scrollSnapType = "";
			isSlideTransitioning = false;
			slideAnimationId = null;

			if (wheelCooldownTimer) clearTimeout(wheelCooldownTimer);
			wheelCooldownTimer = setTimeout(() => {
				wheelBlocked = false;
			}, WHEEL_COOLDOWN_MS);

			if (onComplete) onComplete();
		}
	};

	slideAnimationId = requestAnimationFrame(step);
};

// Clean transform reset on containers
const resetContainersTransform = () => {
	document.querySelectorAll<HTMLElement>("main > section[id] > .container").forEach((container) => {
		container.style.transform = "";
	});
};

// Desktop floating slide indicator, anchor-link scrolling and wheel snapping between slides
export const initSlideNavigation = () => {
	resetContainersTransform();
	window.addEventListener("resize", resetContainersTransform, { passive: true });

	const slideIndicator = document.getElementById("slideIndicator");
	if (slideIndicator) {
		// Automatically discover all slide sections on the page with an ID
		const slideSections = Array.from(
			document.querySelectorAll<HTMLElement>("main > section[id]")
		);

		// Dynamically populate indicator dots
		slideIndicator.innerHTML = "";
		const slideTargets: { dot: HTMLButtonElement; id: string; el: HTMLElement }[] = [];

		slideSections.forEach((sec, idx) => {
			const id = sec.id;
			const title = sec.dataset.slideTitle || sec.querySelector("h1, h2, .chapter-index")?.textContent?.trim() || `Слайд ${idx + 1}`;
			const dot = document.createElement("button");
			dot.type = "button";
			dot.className = `slide-dot ${idx === 0 ? "active" : ""}`;
			dot.dataset.slideTarget = id;
			dot.setAttribute("aria-label", `${title}`);

			const tooltip = document.createElement("span");
			tooltip.className = "slide-dot-tooltip";
			tooltip.textContent = title;
			dot.appendChild(tooltip);

			slideIndicator.appendChild(dot);
			slideTargets.push({ dot, id, el: sec });
		});

		const slideDots = slideTargets.map((item) => item.dot);

		slideTargets.forEach(({ dot }, idx) => {
			dot.addEventListener("click", () => {
				const offsets = getSlideOffsets();
				const targetY = offsets[idx]?.top ?? 0;
				smoothScrollToTarget(targetY);
			});
		});

		// Smooth transitions for in-page anchor links (e.g. hero CTA, navbar links)
		document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
			link.addEventListener("click", (e) => {
				const href = link.getAttribute("href");
				if (!href || href === "#") return;
				const targetId = href.slice(1);
				const targetEl = targetId === "top" ? document.body : document.getElementById(targetId);
				if (targetEl) {
					e.preventDefault();
					const targetY = targetEl.getBoundingClientRect().top + window.scrollY;
					smoothScrollToTarget(targetY);
				}
			});
		});

		// Intercept wheel on desktop for configurable transition speed between slides
		if (
			SLIDE_TRANSITION_CONFIG.enableWheelSnap &&
			window.innerWidth > DESKTOP_MIN_WIDTH &&
			!prefersReducedMotion()
		) {
			window.addEventListener(
				"wheel",
				(e) => {
					// Don't intercept if modifier keys pressed
					if (e.ctrlKey || e.metaKey || e.altKey) return;

					// Block wheel while transition is active or during trackpad momentum cooldown
					if (isSlideTransitioning || wheelBlocked) {
						e.preventDefault();
						return;
					}

					// Native scroll is never allowed here; small deltas only skip the slide jump
					e.preventDefault();
					const delta = e.deltaY;
					if (Math.abs(delta) < WHEEL_MIN_DELTA) return;

					const offsets = getSlideOffsets();
					const currentScroll = Math.round(window.scrollY);

					const targetTop = findWheelTargetTop(offsets, currentScroll, delta);
					if (targetTop !== null) {
						smoothScrollToTarget(targetTop);
					}
				},
				{ passive: false }
			);
		}

		let activeSlideTicking = false;
		const updateActiveSlide = () => {
			const scrollY = window.scrollY;
			const winH = window.innerHeight;
			const docH = getCachedDocHeight();
			const currentTargetId = findActiveSlideId(slideTargets.map((item) => item.id), getSlideOffsets(), scrollY, winH, docH);

			slideDots.forEach((dot) => {
				dot.classList.toggle("active", dot.dataset.slideTarget === currentTargetId);
			});
			activeSlideTicking = false;
		};

		window.addEventListener("scroll", () => {
			if (!activeSlideTicking) {
				window.requestAnimationFrame(updateActiveSlide);
				activeSlideTicking = true;
			}
		}, { passive: true });
		updateActiveSlide();
	}
};
