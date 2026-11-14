import type { SlideOffset } from "../slide-offsets.ts";

// Pull rate (1/s) of the flight, scaled by the screen progress
export const STAR_RUBBER_STIFFNESS = 0.5;
// Distance (in slides) from a slide within which the screen counts as resting on it
export const SLIDE_REST_ZONE = 0.05;
// Slide-units tolerance for treating stars as exactly on a slide
export const SLIDE_SNAP_EPSILON = 0.001;

// Shader slot 0 is the virtual slide -1; real slide k is slot k + 1
export const VIRTUAL_SLOT = 0;
export const slotOf = (realIndex: number) => realIndex + 1;
export const HERO_SLOT = slotOf(0);

export interface FlightState {
	// Fractional slot the stars are at: 1.5 is halfway from slot 1 to slot 2
	starsSlidePosition: number;
	// Screen slot position at the previous step, -1 before the first step
	lastScrollPos: number;
	// 1 while scrolling down, -1 while scrolling up
	scrollDir: number;
}

export const createFlightState = (): FlightState => ({ starsSlidePosition: 0, lastScrollPos: -1, scrollDir: 1 });

// Fractional slide position of the screen: 1.01 means just past slide 1
export const getScrollPosition = (offsets: SlideOffset[], scrollY: number) => {
	let i = 0;
	while (i + 1 < offsets.length && scrollY >= offsets[i + 1].top) i++;
	if (i + 1 >= offsets.length) return i;
	const span = offsets[i + 1].top - offsets[i].top;
	return i + (scrollY - offsets[i].top) / span;
};

// The slide pair follows the screen at once; the stars chase the current slide.
// `y` is the screen position in slots, `slideCount` the number of shader slots.
export const stepFlight = (state: FlightState, y: number, slideCount: number, dt: number) => {
	if (state.lastScrollPos < 0) {
		state.lastScrollPos = y;
		// Load at the top: stars start on the virtual slide and fly to the hero
		state.starsSlidePosition = Math.round(y) === HERO_SLOT ? VIRTUAL_SLOT : Math.round(y);
	}
	const dy = y - state.lastScrollPos;
	state.lastScrollPos = y;
	if (Math.abs(dy) > 1e-4) state.scrollDir = Math.sign(dy);

	const nearSlide = Math.round(y);
	let prevSlideIndex: number;
	let currentSlideIndex: number;
	if (Math.abs(y - nearSlide) < SLIDE_REST_ZONE) {
		if (state.scrollDir > 0) {
			currentSlideIndex = Math.min(Math.max(nearSlide, HERO_SLOT), slideCount - 1);
			prevSlideIndex = currentSlideIndex - 1;
		} else {
			// Resting on a slide, stars stay on it; on the last slide the previous slot is past the end, which is only used as a number
			currentSlideIndex = nearSlide;
			prevSlideIndex = currentSlideIndex + 1;
		}
	} else if (state.scrollDir > 0) {
		prevSlideIndex = Math.min(Math.floor(y), slideCount - 2);
		currentSlideIndex = prevSlideIndex + 1;
	} else {
		currentSlideIndex = Math.min(Math.floor(y), slideCount - 2);
		prevSlideIndex = currentSlideIndex + 1;
	}
	const distance = Math.sign(currentSlideIndex - prevSlideIndex);
	const scrollProgress = Math.min(Math.max((y - prevSlideIndex) * distance, 0), 1);
	const starsProgress = (state.starsSlidePosition - prevSlideIndex) * distance;
	// P = S * sp * (1 - p), zero in the dead zone where resting stars wait for the screen
	const rubberPower = STAR_RUBBER_STIFFNESS * Math.pow((1 - starsProgress) - (starsProgress - scrollProgress), 2);
	const nextStarsProgress = starsProgress + rubberPower * dt;
	state.starsSlidePosition = prevSlideIndex + distance * nextStarsProgress;
	if (Math.abs(1 - nextStarsProgress) < SLIDE_SNAP_EPSILON) state.starsSlidePosition = currentSlideIndex;
	if (!Number.isFinite(state.starsSlidePosition)) state.starsSlidePosition = currentSlideIndex;
};

// Long frames are split into 60 Hz steps; one big explicit step can diverge to NaN
export const stepFlightFrame = (state: FlightState, y: number, slideCount: number, frameDt: number) => {
	const steps = Math.max(1, Math.ceil(frameDt * 60));
	for (let s = 0; s < steps; s++) stepFlight(state, y, slideCount, frameDt / steps);
};
