import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_SIZE_DEVIATION, fitImageInBox, sizeScale } from "../src/scripts/stars/geometry.ts";
import { SLIDE_FLOATS, createStarLayout } from "../src/scripts/stars/layout.ts";
import {
	SUNRISE_CONFIG,
	calculateDawnAlpha,
	dawnOverlayOpacity,
	pageScrollProgress,
	starSkyFade,
} from "../src/scripts/stars/sunrise.ts";

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("calculateDawnAlpha", () => {
	it("is linear when the exponent is 1 or less", () => {
		for (const p of [0, 0.25, 0.5, 1]) {
			console.log(`linear p=${p} -> ${calculateDawnAlpha(p, 1)}`);
			assert.equal(calculateDawnAlpha(p, 1), p);
		}
		assert.equal(calculateDawnAlpha(0.4, 0.5), 0.4);
	});

	it("follows p^exponent for the power curve", () => {
		assert.ok(near(calculateDawnAlpha(0.5, 3), 0.125));
		assert.ok(near(calculateDawnAlpha(0.5, 2, "power"), 0.25));
	});

	it("follows the exponential curve, from 0 to 1", () => {
		const exp = 3;
		const expected = (Math.exp(exp * 0.5) - 1) / (Math.exp(exp) - 1);
		console.log(`exponential p=0.5 -> ${calculateDawnAlpha(0.5, exp, "exponential")} (expected ${expected})`);
		assert.ok(near(calculateDawnAlpha(0.5, exp, "exponential"), expected));
		assert.equal(calculateDawnAlpha(0, exp, "exponential"), 0);
		assert.ok(near(calculateDawnAlpha(1, exp, "exponential"), 1));
	});

	it("clamps the page progress to 0..1", () => {
		assert.equal(calculateDawnAlpha(-5, 3), 0);
		assert.equal(calculateDawnAlpha(7, 3), 1);
	});

	it("rises with the page progress on the configured curve", () => {
		let previous = -1;
		for (let p = 0; p <= 1.0001; p += 0.1) {
			const alpha = calculateDawnAlpha(p, SUNRISE_CONFIG.exponent, SUNRISE_CONFIG.curve);
			assert.ok(alpha >= previous);
			previous = alpha;
		}
	});
});

describe("pageScrollProgress", () => {
	it("is the scrolled share of the page, clamped", () => {
		assert.equal(pageScrollProgress(0, 1000), 0);
		assert.equal(pageScrollProgress(250, 1000), 0.25);
		assert.equal(pageScrollProgress(1000, 1000), 1);
		assert.equal(pageScrollProgress(1500, 1000), 1);
		assert.equal(pageScrollProgress(-20, 1000), 0);
	});
});

describe("dawnOverlayOpacity", () => {
	it("reaches the configured maximum at full dawn", () => {
		assert.equal(dawnOverlayOpacity(0), 0);
		assert.equal(dawnOverlayOpacity(1), SUNRISE_CONFIG.maxOverlayOpacity);
		assert.ok(near(dawnOverlayOpacity(0.5), SUNRISE_CONFIG.maxOverlayOpacity / 2));
	});
});

describe("starSkyFade", () => {
	it("keeps full starlight at night", () => {
		assert.equal(starSkyFade(0), 1);
	});

	it("dims the stars as dawn rises and never below the minimum opacity", () => {
		const dimmed = starSkyFade(0.5);
		console.log(`fade at dawn 0.5 = ${dimmed}, at dawn 1 = ${starSkyFade(1)}`);
		assert.ok(near(dimmed, 1 - 0.5 * SUNRISE_CONFIG.starDimmingFactor));
		assert.ok(starSkyFade(1) >= SUNRISE_CONFIG.minStarOpacity);
		assert.equal(starSkyFade(10), SUNRISE_CONFIG.minStarOpacity);
	});
});

describe("fitImageInBox", () => {
	it("fits a wide image to the box width and centers it vertically", () => {
		const fit = fitImageInBox(200, 100, 100, 100, "center");
		console.log("200x100 in 100x100:", fit);
		assert.deepEqual(fit, { dx: 0, dy: 25, dw: 100, dh: 50 });
	});

	it("fits a tall image to the box height", () => {
		const fit = fitImageInBox(100, 200, 100, 100, "left");
		console.log("100x200 in 100x100, left:", fit);
		assert.deepEqual(fit, { dx: 0, dy: 0, dw: 50, dh: 100 });
	});

	it("aligns horizontally by pivot", () => {
		assert.equal(fitImageInBox(100, 200, 100, 100, "left").dx, 0);
		assert.equal(fitImageInBox(100, 200, 100, 100, "center").dx, 25);
		assert.equal(fitImageInBox(100, 200, 100, 100, "right").dx, 50);
	});

	it("scales a small image up to the box", () => {
		const fit = fitImageInBox(10, 10, 100, 50, "center");
		assert.deepEqual(fit, { dx: 25, dy: 0, dw: 50, dh: 50 });
	});

	it("fills the box when the image has no natural size yet", () => {
		const fit = fitImageInBox(0, 0, 120, 80, "center");
		assert.deepEqual(fit, { dx: 0, dy: 0, dw: 120, dh: 80 });
	});
});

describe("sizeScale", () => {
	it("is 1 when an area is missing", () => {
		assert.equal(sizeScale(0, 100, MAX_SIZE_DEVIATION), 1);
		assert.equal(sizeScale(100, 0, MAX_SIZE_DEVIATION), 1);
	});

	it("is the square root of the area ratio inside the allowed deviation", () => {
		assert.ok(near(sizeScale(121, 100, MAX_SIZE_DEVIATION), 1.1));
		assert.ok(near(sizeScale(81, 100, MAX_SIZE_DEVIATION), 0.9));
	});

	it("is clamped to 1 plus or minus the maximum deviation", () => {
		assert.equal(sizeScale(10000, 100, MAX_SIZE_DEVIATION), 1 + MAX_SIZE_DEVIATION);
		assert.equal(sizeScale(1, 100, MAX_SIZE_DEVIATION), 1 - MAX_SIZE_DEVIATION);
	});
});

describe("createStarLayout", () => {
	it("places the per-star floats after the slide data", () => {
		const layout = createStarLayout(7);
		console.log("layout for 7 slots:", layout);
		assert.equal(layout.slideCount, 7);
		assert.equal(layout.spreadIdx, 7 * SLIDE_FLOATS);
		assert.equal(layout.isLogoIdx, layout.spreadIdx + 2);
		assert.equal(layout.colorIdx, layout.spreadIdx + 3);
		assert.equal(layout.twinkleIdx, layout.spreadIdx + 6);
		assert.equal(layout.floatsPerStar, layout.spreadIdx + 7);
	});

	it("packs the record into whole vec4 attributes", () => {
		const layout = createStarLayout(7);
		assert.equal(layout.vec4Count, Math.ceil(layout.floatsPerStar / 4));
		assert.equal(layout.floatsPerVertex, layout.vec4Count * 4);
		assert.equal(layout.strideBytes, layout.floatsPerVertex * 4);
		assert.ok(layout.floatsPerVertex >= layout.floatsPerStar);
	});

	it("grows with the number of slots", () => {
		assert.ok(createStarLayout(9).floatsPerStar > createStarLayout(6).floatsPerStar);
	});
});
