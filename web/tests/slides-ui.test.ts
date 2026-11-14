import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	SLIDE_TRANSITION_CONFIG,
	easeFunctions,
	findActiveSlideId,
	findWheelTargetTop,
} from "../src/scripts/slide-navigation.ts";
import { buildSlideOffsets } from "../src/scripts/slide-offsets.ts";
import { ribbonDashOffset, slideIndexAtScroll, wrapSlideIndex } from "../src/scripts/ui.ts";

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("buildSlideOffsets", () => {
	const sections = [
		{ id: "hero", offsetTop: 0 },
		{ id: "a", offsetTop: 900 },
		{ id: "b", offsetTop: 1800 },
		{ id: "join", offsetTop: 2700 },
	];

	it("keeps section tops in order", () => {
		const offsets = buildSlideOffsets(sections, 2700);
		console.log("offsets:", offsets);
		assert.deepEqual(offsets.map((o) => o.top), [0, 900, 1800, 2700]);
		assert.deepEqual(offsets.map((o) => o.id), ["hero", "a", "b", "join"]);
	});

	it("clamps tops to the scrollable range", () => {
		const offsets = buildSlideOffsets(sections, 2000);
		assert.deepEqual(offsets.map((o) => o.top), [0, 900, 1800, 2000]);
	});

	it("drops a clamped slide that lands within 15 px of the previous one", () => {
		const offsets = buildSlideOffsets(sections, 1805);
		assert.deepEqual(offsets.map((o) => o.id), ["hero", "a", "b"]);
	});

	it("adds the footer as a slide when there is more than 20 px to scroll below the last section", () => {
		const offsets = buildSlideOffsets(sections, 3300);
		console.log("offsets with footer:", offsets);
		assert.deepEqual(offsets[offsets.length - 1], { id: "footer", top: 3300 });
	});

	it("does not add the footer for a scroll range within 20 px of the last section", () => {
		const offsets = buildSlideOffsets(sections, 2715);
		assert.ok(!offsets.some((o) => o.id === "footer"));
		assert.equal(offsets.length, 4);
	});

	it("drops a slide closer than 15 px to the previous one", () => {
		const offsets = buildSlideOffsets([{ id: "a", offsetTop: 0 }, { id: "b", offsetTop: 10 }, { id: "c", offsetTop: 500 }], 1000);
		assert.deepEqual(offsets.map((o) => o.id), ["a", "c", "footer"]);
	});

	it("is empty without sections", () => {
		assert.deepEqual(buildSlideOffsets([], 1000), []);
	});
});

describe("easeFunctions", () => {
	for (const name of Object.keys(easeFunctions) as (keyof typeof easeFunctions)[]) {
		it(`${name} goes from 0 to 1 and never decreases`, () => {
			const ease = easeFunctions[name];
			assert.equal(ease(0), 0);
			assert.ok(near(ease(1), 1));
			let previous = -1;
			for (let t = 0; t <= 1.0001; t += 0.05) {
				const value = ease(t);
				assert.ok(value >= previous - 1e-12, `${name}(${t}) = ${value} after ${previous}`);
				previous = value;
			}
		});
	}

	it("easeInOutQuad is 0.5 at the midpoint, linear is the identity", () => {
		assert.equal(easeFunctions.easeInOutQuad(0.5), 0.5);
		assert.equal(easeFunctions.linear(0.37), 0.37);
	});

	it("the configured easing exists", () => {
		assert.ok(SLIDE_TRANSITION_CONFIG.easing in easeFunctions);
		assert.ok(SLIDE_TRANSITION_CONFIG.durationMs > 0);
	});
});

describe("findWheelTargetTop", () => {
	const offsets = [
		{ id: "hero", top: 0 },
		{ id: "a", top: 900 },
		{ id: "b", top: 1800 },
	];

	it("scrolling down targets the next slide below", () => {
		assert.equal(findWheelTargetTop(offsets, 0, 120), 900);
		assert.equal(findWheelTargetTop(offsets, 900, 120), 1800);
		assert.equal(findWheelTargetTop(offsets, 400, 120), 900);
	});

	it("scrolling up targets the previous slide above", () => {
		assert.equal(findWheelTargetTop(offsets, 1800, -120), 900);
		assert.equal(findWheelTargetTop(offsets, 900, -120), 0);
		assert.equal(findWheelTargetTop(offsets, 1300, -120), 900);
	});

	it("ignores a slide within 15 px of the scroll position", () => {
		assert.equal(findWheelTargetTop(offsets, 890, 120), 1800);
		assert.equal(findWheelTargetTop(offsets, 910, -120), 0);
	});

	it("has no target past the first or last slide", () => {
		assert.equal(findWheelTargetTop(offsets, 1800, 120), null);
		assert.equal(findWheelTargetTop(offsets, 0, -120), null);
	});

	it("has no target for a zero delta", () => {
		assert.equal(findWheelTargetTop(offsets, 900, 0), null);
	});

	it("takes the same number of slides up as down", () => {
		let y = 0;
		let down = 0;
		for (let target = findWheelTargetTop(offsets, y, 1); target !== null; target = findWheelTargetTop(offsets, y, 1)) {
			y = target;
			down++;
		}
		let up = 0;
		for (let target = findWheelTargetTop(offsets, y, -1); target !== null; target = findWheelTargetTop(offsets, y, -1)) {
			y = target;
			up++;
		}
		console.log(`slides down: ${down}, slides up: ${up}`);
		assert.equal(down, up);
	});
});

describe("findActiveSlideId", () => {
	const ids = ["hero", "a", "b", "join"];
	const offsets = [
		{ id: "hero", top: 0 },
		{ id: "a", top: 900 },
		{ id: "b", top: 1800 },
		{ id: "join", top: 2700 },
		{ id: "footer", top: 3000 },
	];
	const winH = 800;
	const docH = 3800;

	it("is the slide nearest the focus line 45% down the window", () => {
		const cases: [number, string][] = [
			[0, "hero"],
			[600, "a"],
			[1400, "b"],
			[2300, "join"],
		];
		for (const [scrollY, expected] of cases) {
			const actual = findActiveSlideId(ids, offsets, scrollY, winH, docH);
			console.log(`scrollY=${scrollY} -> ${actual} (expected ${expected})`);
			assert.equal(actual, expected);
		}
	});

	it("is the last indicator slide at the bottom of the page", () => {
		assert.equal(findActiveSlideId(ids, offsets, docH - winH, winH, docH), "join");
		assert.equal(findActiveSlideId(ids, offsets, docH - winH - 20, winH, docH), "join");
	});

	it("ignores slides that have no indicator dot", () => {
		assert.notEqual(findActiveSlideId(ids, offsets, 2900, winH, 9999), "footer");
	});

	it("falls back to the first slide when no offsets match", () => {
		assert.equal(findActiveSlideId(ids, [], 500, winH, docH), "hero");
	});

	it("is undefined without indicator slides", () => {
		assert.equal(findActiveSlideId([], offsets, 500, winH, docH), undefined);
	});
});

describe("ribbonDashOffset", () => {
	const length = 5000;

	it("leaves the ribbon undrawn at the top", () => {
		assert.equal(ribbonDashOffset(length, 0, 3000), length);
	});

	it("draws the ribbon slightly ahead of the scroll position", () => {
		const offset = ribbonDashOffset(length, 1500, 3000);
		console.log(`half scrolled -> drawn ${length - offset} of ${length}`);
		assert.ok(near(length - offset, length * 0.5 * 1.08));
	});

	it("draws the whole ribbon before the page bottom", () => {
		assert.equal(ribbonDashOffset(length, 3000, 3000), 0);
		assert.equal(ribbonDashOffset(length, 2900, 3000), 0);
	});

	it("clamps over-scroll", () => {
		assert.equal(ribbonDashOffset(length, 9000, 3000), 0);
		assert.equal(ribbonDashOffset(length, -50, 3000), length);
	});
});

describe("wrapSlideIndex", () => {
	it("keeps indexes inside the carousel", () => {
		assert.equal(wrapSlideIndex(0, 3), 0);
		assert.equal(wrapSlideIndex(2, 3), 2);
	});

	it("wraps past either end", () => {
		assert.equal(wrapSlideIndex(-1, 3), 2);
		assert.equal(wrapSlideIndex(3, 3), 0);
	});
});

describe("slideIndexAtScroll", () => {
	it("is the slide the horizontal scroll rests nearest to", () => {
		assert.equal(slideIndexAtScroll(0, 300), 0);
		assert.equal(slideIndexAtScroll(140, 300), 0);
		assert.equal(slideIndexAtScroll(160, 300), 1);
		assert.equal(slideIndexAtScroll(600, 300), 2);
	});
});
