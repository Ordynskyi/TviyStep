import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	HERO_SLOT,
	SLIDE_SNAP_EPSILON,
	VIRTUAL_SLOT,
	createFlightState,
	getScrollPosition,
	slotOf,
	stepFlight,
	stepFlightFrame,
	type FlightState,
} from "../src/scripts/stars/flight.ts";

const FRAME_DT = 1 / 60;
// Hero, three chapters, the virtual slot: 5 shader slots
const SLIDE_COUNT = 5;

// Portrait page: sections are unequal in height, so one slot spans a different number of pixels each
const PORTRAIT_OFFSETS = [
	{ id: "hero", top: 0 },
	{ id: "a", top: 844 },
	{ id: "b", top: 844 + 1900 },
	{ id: "c", top: 844 + 1900 + 1200 },
];

// Stars start resting on slot `startSlot`, then the screen moves linearly from slot `from` to slot `to` over `seconds`
const flyBetween = (startSlot: number, from: number, to: number, seconds: number, tail = 0) => {
	const state: FlightState = createFlightState();
	state.lastScrollPos = from;
	state.starsSlidePosition = startSlot;
	const trace: { t: number; screen: number; stars: number }[] = [];
	const steps = Math.round(seconds / FRAME_DT);
	const tailSteps = Math.round(tail / FRAME_DT);
	for (let i = 0; i <= steps + tailSteps; i++) {
		const progress = Math.min(i / steps, 1);
		const screen = from + (to - from) * progress;
		stepFlight(state, screen, SLIDE_COUNT, FRAME_DT);
		trace.push({ t: i * FRAME_DT, screen, stars: state.starsSlidePosition });
	}
	return trace;
};

describe("slotOf / slot constants", () => {
	it("puts real slide k in slot k + 1 and the hero right after the virtual slot", () => {
		console.log("slotOf(0..3) =", [0, 1, 2, 3].map(slotOf), "VIRTUAL_SLOT =", VIRTUAL_SLOT, "HERO_SLOT =", HERO_SLOT);
		assert.deepEqual([0, 1, 2, 3].map(slotOf), [1, 2, 3, 4]);
		assert.equal(VIRTUAL_SLOT, 0);
		assert.equal(HERO_SLOT, 1);
	});
});

describe("createFlightState", () => {
	it("starts before the first step, scrolling down", () => {
		const state = createFlightState();
		console.log("initial state:", state);
		assert.deepEqual(state, { starsSlidePosition: 0, lastScrollPos: -1, scrollDir: 1 });
	});
});

describe("getScrollPosition", () => {
	it("is the slide index at a slide top and the fraction between tops", () => {
		const cases: [number, number][] = [
			[0, 0],
			[422, 0.5],
			[844, 1],
			[844 + 950, 1.5],
			[844 + 1900, 2],
		];
		for (const [scrollY, expected] of cases) {
			const actual = getScrollPosition(PORTRAIT_OFFSETS, scrollY);
			console.log(`scrollY=${scrollY} -> slide position ${actual} (expected ${expected})`);
			assert.ok(Math.abs(actual - expected) < 1e-9);
		}
	});

	it("stays on the last slide index at and below the last top", () => {
		const last = PORTRAIT_OFFSETS.length - 1;
		assert.equal(getScrollPosition(PORTRAIT_OFFSETS, PORTRAIT_OFFSETS[last].top), last);
		assert.equal(getScrollPosition(PORTRAIT_OFFSETS, PORTRAIT_OFFSETS[last].top + 500), last);
	});

	it("measures progress in the section's own height, so the same pixels move less in a taller section", () => {
		const inShortSection = getScrollPosition(PORTRAIT_OFFSETS, 422);
		const inTallSection = getScrollPosition(PORTRAIT_OFFSETS, 844 + 422) - 1;
		console.log(`422 px into a 844 px section: ${inShortSection}; into a 1900 px section: ${inTallSection}`);
		assert.ok(inShortSection > inTallSection);
	});
});

describe("stepFlight", () => {
	it("starts the first step from the virtual slot when the page loads at the hero", () => {
		const state = createFlightState();
		stepFlight(state, HERO_SLOT, SLIDE_COUNT, FRAME_DT);
		console.log("after first step at the hero:", state);
		assert.ok(state.starsSlidePosition >= VIRTUAL_SLOT && state.starsSlidePosition < HERO_SLOT);
	});

	it("starts the first step on the slide the page loads on, away from the hero", () => {
		const state = createFlightState();
		stepFlight(state, 3, SLIDE_COUNT, FRAME_DT);
		console.log("after first step at slot 3:", state);
		assert.equal(state.starsSlidePosition, 3);
	});

	it("follows the scroll direction", () => {
		const state = createFlightState();
		state.lastScrollPos = 2;
		state.starsSlidePosition = 2;
		stepFlight(state, 2.3, SLIDE_COUNT, FRAME_DT);
		assert.equal(state.scrollDir, 1);
		stepFlight(state, 2.2, SLIDE_COUNT, FRAME_DT);
		assert.equal(state.scrollDir, -1);
	});

	it("keeps the direction while the screen does not move", () => {
		const state = createFlightState();
		state.lastScrollPos = 3;
		state.starsSlidePosition = 3;
		stepFlight(state, 2.7, SLIDE_COUNT, FRAME_DT);
		stepFlight(state, 2.7, SLIDE_COUNT, FRAME_DT);
		assert.equal(state.scrollDir, -1);
	});

	it("keeps resting stars still while the screen rests on their slide", () => {
		const state = createFlightState();
		state.lastScrollPos = 3;
		state.starsSlidePosition = 3;
		for (let i = 0; i < 120; i++) stepFlight(state, 3, SLIDE_COUNT, FRAME_DT);
		assert.equal(state.starsSlidePosition, 3);
	});

	it("moves the stars toward the next slide, never past the screen's slide", () => {
		const trace = flyBetween(2, 2, 3, 1.5, 3);
		const maxStars = Math.max(...trace.map((p) => p.stars));
		console.log(`stars end at ${trace[trace.length - 1].stars.toFixed(4)}, max ${maxStars.toFixed(4)}`);
		assert.ok(trace[trace.length - 1].stars > 2.5);
		assert.ok(maxStars <= 3 + 1e-9);
	});

	it("moves the stars toward the previous slide when scrolling up", () => {
		const trace = flyBetween(3, 3, 2, 1.5, 3);
		const minStars = Math.min(...trace.map((p) => p.stars));
		console.log(`stars end at ${trace[trace.length - 1].stars.toFixed(4)}, min ${minStars.toFixed(4)}`);
		assert.ok(trace[trace.length - 1].stars < 2.5);
		assert.ok(minStars >= 2 - 1e-9);
	});

	it("snaps onto the slide once within the snap tolerance", () => {
		const state = createFlightState();
		state.lastScrollPos = 3;
		state.starsSlidePosition = 2 + (1 - SLIDE_SNAP_EPSILON / 2);
		stepFlight(state, 3, SLIDE_COUNT, FRAME_DT);
		console.log("stars after the snap step:", state.starsSlidePosition);
		assert.equal(state.starsSlidePosition, 3);
	});

	it("never produces a non-finite position", () => {
		const state = createFlightState();
		state.lastScrollPos = 2;
		state.starsSlidePosition = Number.NaN;
		stepFlight(state, 2.4, SLIDE_COUNT, FRAME_DT);
		assert.ok(Number.isFinite(state.starsSlidePosition));
	});
});

describe("flight symmetry: up and down take the same relative path", () => {
	// Relative progress of the stars along their flight: 0 = from, 1 = to
	const downProgress = (trace: ReturnType<typeof flyBetween>, from: number) => trace.map((p) => p.stars - from);
	const upProgress = (trace: ReturnType<typeof flyBetween>, from: number) => trace.map((p) => from - p.stars);

	for (const slide of [1, 2, 3]) {
		it(`slot ${slide} -> ${slide + 1} down and back up trace the same progress`, () => {
			const down = downProgress(flyBetween(slide, slide, slide + 1, 1.5, 2), slide);
			const up = upProgress(flyBetween(slide + 1, slide + 1, slide, 1.5, 2), slide + 1);
			let worst = 0;
			for (let i = 0; i < down.length; i++) {
				worst = Math.max(worst, Math.abs(down[i] - up[i]));
			}
			console.log(`slot ${slide}<->${slide + 1}: worst progress difference over ${down.length} frames = ${worst.toExponential(3)}`);
			console.log("  down @0.25/0.5/1/2s:", [15, 30, 60, 120].map((i) => down[i].toFixed(4)).join(" "));
			console.log("  up   @0.25/0.5/1/2s:", [15, 30, 60, 120].map((i) => up[i].toFixed(4)).join(" "));
			assert.ok(worst < 0.02, `difference ${worst}`);
		});
	}

	it("does not depend on how tall the sections are in pixels", () => {
		const scrollAtSlot = (offsets: typeof PORTRAIT_OFFSETS, slot: number) => {
			const index = slot - HERO_SLOT;
			return offsets[index].top;
		};
		const run = (offsets: typeof PORTRAIT_OFFSETS) => {
			const state = createFlightState();
			const startY = scrollAtSlot(offsets, 2);
			const endY = scrollAtSlot(offsets, 3);
			state.lastScrollPos = getScrollPosition(offsets, startY) + HERO_SLOT;
			state.starsSlidePosition = 2;
			const seconds = 1.5;
			const steps = Math.round(seconds / FRAME_DT);
			for (let i = 0; i <= steps; i++) {
				const y = startY + (endY - startY) * (i / steps);
				stepFlight(state, getScrollPosition(offsets, y) + HERO_SLOT, SLIDE_COUNT, FRAME_DT);
			}
			return state.starsSlidePosition;
		};
		const tall = run(PORTRAIT_OFFSETS);
		const landscape = run([
			{ id: "hero", top: 0 },
			{ id: "a", top: 900 },
			{ id: "b", top: 1800 },
			{ id: "c", top: 2700 },
		]);
		console.log(`stars after the same 1.5 s flight: tall sections ${tall.toFixed(5)}, equal sections ${landscape.toFixed(5)}`);
		assert.ok(Math.abs(tall - landscape) < 1e-9);
	});
});

describe("stepFlightFrame", () => {
	it("splits a long frame into 60 Hz steps and gives the same result as stepping by hand", () => {
		const stateFrame = createFlightState();
		stateFrame.lastScrollPos = 2;
		stateFrame.starsSlidePosition = 2;
		const stateSteps = createFlightState();
		stateSteps.lastScrollPos = 2;
		stateSteps.starsSlidePosition = 2;

		stepFlightFrame(stateFrame, 2.6, SLIDE_COUNT, 0.1);
		for (let i = 0; i < 6; i++) stepFlight(stateSteps, 2.6, SLIDE_COUNT, 0.1 / 6);

		console.log(`one 100 ms frame: ${stateFrame.starsSlidePosition}; six 16.7 ms steps: ${stateSteps.starsSlidePosition}`);
		assert.ok(Math.abs(stateFrame.starsSlidePosition - stateSteps.starsSlidePosition) < 1e-12);
	});

	it("runs one step for a short frame", () => {
		const stateFrame = createFlightState();
		stateFrame.lastScrollPos = 2;
		stateFrame.starsSlidePosition = 2;
		const stateStep = createFlightState();
		stateStep.lastScrollPos = 2;
		stateStep.starsSlidePosition = 2;
		stepFlightFrame(stateFrame, 2.6, SLIDE_COUNT, 0.008);
		stepFlight(stateStep, 2.6, SLIDE_COUNT, 0.008);
		assert.equal(stateFrame.starsSlidePosition, stateStep.starsSlidePosition);
	});

	it("stays finite on the longest frame the animation accepts", () => {
		const state = createFlightState();
		state.lastScrollPos = 2;
		state.starsSlidePosition = 2;
		stepFlightFrame(state, 3, SLIDE_COUNT, 0.1);
		assert.ok(Number.isFinite(state.starsSlidePosition));
		assert.ok(state.starsSlidePosition >= 2 && state.starsSlidePosition <= 3);
	});
});
