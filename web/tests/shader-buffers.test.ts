import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAR_CONFIG } from "../src/data/star-config.ts";
import {
	getStarStyle,
	packAmbientStars,
	packConstellationStars,
} from "../src/scripts/stars/buffers.ts";
import { createStarLayout, SLIDE_FLOATS } from "../src/scripts/stars/layout.ts";
import { buildFragmentShader, buildVertexShader, floatRef, segmentChain } from "../src/scripts/stars/shader.ts";
import type { ConstellationConfig, SlidePoint } from "../src/scripts/stars/types.ts";

const DEFAULTS = STAR_CONFIG.defaultConstellation;
const AMBIENT = STAR_CONFIG.ambient;
// Virtual slot, hero, and three chapter slots
const SLIDE_COUNT = 5;
const LAYOUT = createStarLayout(SLIDE_COUNT);

describe("floatRef", () => {
	it("addresses packed float e as attribute e / 4, component e % 4", () => {
		const refs = [0, 1, 2, 3, 4, 5, 11].map(floatRef);
		console.log("floatRef(0,1,2,3,4,5,11) =", refs);
		assert.deepEqual(refs, ["aD0.x", "aD0.y", "aD0.z", "aD0.w", "aD1.x", "aD1.y", "aD2.w"]);
	});
});

describe("segmentChain", () => {
	it("emits one branch per segment between consecutive slots, the last one as the final else", () => {
		const chain = segmentChain(5, (s) => `seg(${s});`);
		console.log("segmentChain(5):", chain);
		assert.equal(chain, "if (slideIdx < 0.5) { seg(0); } else if (slideIdx < 1.5) { seg(1); } else if (slideIdx < 2.5) { seg(2); } else { seg(3); }");
	});

	it("is a single block for two slots", () => {
		assert.equal(segmentChain(2, (s) => `seg(${s});`), "{ seg(0); }");
	});
});

describe("buildVertexShader", () => {
	const source = buildVertexShader(LAYOUT, STAR_CONFIG);

	it("declares one vec4 attribute per packed vec4 and one top uniform per slot", () => {
		for (let i = 0; i < LAYOUT.vec4Count; i++) assert.ok(source.includes(`attribute vec4 aD${i};`), `aD${i}`);
		assert.ok(!source.includes(`attribute vec4 aD${LAYOUT.vec4Count};`));
		for (let k = 0; k < SLIDE_COUNT; k++) assert.ok(source.includes(`uniform float uSlideTop${k};`), `uSlideTop${k}`);
		assert.ok(!source.includes(`uniform float uSlideTop${SLIDE_COUNT};`));
	});

	it("reads every slot's position, size, ray and brightness", () => {
		for (let k = 0; k < SLIDE_COUNT; k++) {
			const b = k * SLIDE_FLOATS;
			assert.ok(source.includes(`vec2 pos${k} = vec2(${floatRef(b)}, ${floatRef(b + 1)});`), `pos${k}`);
			assert.ok(source.includes(`float bright${k} = ${floatRef(b + 4)};`), `bright${k}`);
		}
	});

	it("clamps the slide progress to the last slot", () => {
		assert.ok(source.includes(`clamp(uSlideProgress, 0.0, ${SLIDE_COUNT - 1}.0)`));
		assert.ok(source.includes(`min(floor(sp), ${SLIDE_COUNT - 2}.0)`));
	});

	it("computes the flight in from-to units and mirrors it for an upward flight", () => {
		console.log("flight lines:\n" + source.split("\n").filter((l) => /flightProgress|flightFlow|float flow/.test(l)).join("\n"));
		assert.ok(source.includes("float flightProgress = uScrollDir > 0.0 ? t : 1.0 - t;"));
		assert.ok(source.includes("float flow = uScrollDir > 0.0 ? flightFlow : 1.0 - flightFlow;"));
		assert.ok(source.includes("uRubberStiffness * isLogo * flightProgress"));
	});

	it("does not depend on the viewport size for the flight speed", () => {
		const flightLines = source.split("\n").filter((l) => /flightFlow|flightProgress|float flow/.test(l));
		assert.ok(flightLines.length >= 3);
		for (const line of flightLines) assert.ok(!line.includes("uResolution") && !line.includes("uScrollY"), line);
	});

	it("has no unresolved template values", () => {
		assert.ok(!source.includes("undefined"));
		assert.ok(!source.includes("NaN"));
		assert.ok(!source.includes("${"));
	});

	it("embeds the configured motion numbers", () => {
		assert.ok(source.includes(`uHeroWidth * ${STAR_CONFIG.driftFraction}`));
		assert.ok(source.includes(`${STAR_CONFIG.motion.streamWidthFraction}`));
	});
});

describe("buildFragmentShader", () => {
	const source = buildFragmentShader(STAR_CONFIG);

	it("embeds the sprite settings, with the ray falloff as a GLSL float", () => {
		assert.ok(source.includes(`exp(-abs(point.y) * ${STAR_CONFIG.sprite.rayFalloff.toFixed(1)})`));
		assert.ok(source.includes(`${STAR_CONFIG.sprite.alphaCutoff}`));
		assert.ok(source.includes("gl_FragColor"));
	});

	it("has no unresolved template values", () => {
		assert.ok(!source.includes("undefined"));
		assert.ok(!source.includes("${"));
	});
});

describe("getStarStyle", () => {
	const sample = (isFeatured: boolean, settings: Parameters<typeof getStarStyle>[1], scale: number) =>
		Array.from({ length: 300 }, () => getStarStyle(isFeatured, settings, DEFAULTS, scale));

	it("draws a normal star inside the default ranges", () => {
		const styles = sample(false, undefined, 1);
		for (const s of styles) {
			assert.ok(s.size >= DEFAULTS.sizeMin && s.size <= DEFAULTS.sizeMax, `size ${s.size}`);
			assert.ok(s.ray >= DEFAULTS.rayStrengthMin && s.ray <= DEFAULTS.rayStrengthMax, `ray ${s.ray}`);
			assert.ok(s.bright >= DEFAULTS.brightnessMin && s.bright <= DEFAULTS.brightnessMax, `bright ${s.bright}`);
		}
		console.log("first normal style:", styles[0]);
	});

	it("draws a featured star inside the featured ranges", () => {
		for (const s of sample(true, undefined, 1)) {
			assert.ok(s.size >= DEFAULTS.featuredSizeMin && s.size <= DEFAULTS.featuredSizeMax, `size ${s.size}`);
			assert.ok(s.ray >= DEFAULTS.featuredRayMin && s.ray <= DEFAULTS.featuredRayMax, `ray ${s.ray}`);
			assert.ok(s.bright >= DEFAULTS.featuredBrightnessMin && s.bright <= DEFAULTS.featuredBrightnessMax, `bright ${s.bright}`);
		}
	});

	it("uses the slide settings over the defaults", () => {
		for (const s of sample(false, { brightnessMin: 2.5, brightnessMax: 4 }, 1)) {
			assert.ok(s.bright >= 2.5 && s.bright <= 4, `bright ${s.bright}`);
			assert.ok(s.size >= DEFAULTS.sizeMin && s.size <= DEFAULTS.sizeMax);
		}
	});

	it("accepts bounds given in either order", () => {
		for (const s of sample(false, { sizeMin: 0.02, sizeMax: 0.01 }, 1)) {
			assert.ok(s.size >= 0.01 && s.size <= 0.02, `size ${s.size}`);
		}
	});

	it("scales only the size", () => {
		for (const s of sample(false, { sizeMin: 1, sizeMax: 1 }, 345)) {
			assert.equal(s.size, 345);
		}
	});
});

const makePoints = (count: number, offset: number, extra: Partial<SlidePoint> = {}): SlidePoint[] =>
	Array.from({ length: count }, (_, i) => ({ x: offset + i, y: offset * 2 + i, ...extra }));

describe("packAmbientStars", () => {
	const input = { canvasWidth: 390, canvasHeight: 844, ambient: AMBIENT, layout: LAYOUT };
	const packed = packAmbientStars(input);

	it("makes one star per density-divider of canvas area", () => {
		const expected = Math.floor((390 * 844) / AMBIENT.densityDivider);
		console.log(`ambient stars for 390x844: ${packed.count} (expected ${expected}), floats ${packed.data.length}`);
		assert.equal(packed.count, expected);
		assert.equal(packed.data.length, expected * LAYOUT.floatsPerVertex);
	});

	it("puts each star at one place on every slot, inside the canvas", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			const x = packed.data[base];
			const y = packed.data[base + 1];
			assert.ok(x >= 0 && x <= 390 && y >= 0 && y <= 844, `star ${i} at ${x},${y}`);
			for (let k = 1; k < SLIDE_COUNT; k++) {
				for (let f = 0; f < SLIDE_FLOATS; f++) {
					assert.equal(packed.data[base + k * SLIDE_FLOATS + f], packed.data[base + f], `star ${i} slot ${k} float ${f}`);
				}
			}
		}
	});

	it("marks stars as not part of the logo and has no spread", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			assert.equal(packed.data[base + LAYOUT.spreadIdx], 0);
			assert.equal(packed.data[base + LAYOUT.spreadIdx + 1], 0);
			assert.equal(packed.data[base + LAYOUT.isLogoIdx], 0);
		}
	});

	it("keeps star sizes, rays and brightness in the ambient ranges", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			const size = packed.data[base + 2];
			const ray = packed.data[base + 3];
			const bright = packed.data[base + 4];
			assert.ok(size >= AMBIENT.sizeMin - 1e-6 && size <= AMBIENT.featuredSizeMax + 1e-6, `size ${size}`);
			assert.ok(ray >= AMBIENT.rayStrengthMin - 1e-6 && ray <= AMBIENT.featuredRayMax + 1e-6, `ray ${ray}`);
			assert.ok(bright >= AMBIENT.brightnessMin - 1e-6 && bright <= AMBIENT.brightnessMax + 1e-6, `bright ${bright}`);
		}
	});

	it("colors stars ivory or gold and leaves the record padding zero", () => {
		const colors = new Set<string>();
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			colors.add([0, 1, 2].map((c) => packed.data[base + LAYOUT.colorIdx + c].toFixed(2)).join(","));
			for (let f = LAYOUT.floatsPerStar; f < LAYOUT.floatsPerVertex; f++) assert.equal(packed.data[base + f], 0);
		}
		console.log("ambient colors:", [...colors]);
		assert.deepEqual([...colors].sort(), ["0.86,0.77,0.55", "0.95,0.94,0.92"]);
	});

	it("makes no stars for an empty canvas", () => {
		const none = packAmbientStars({ ...input, canvasWidth: 0, canvasHeight: 0 });
		assert.equal(none.count, 0);
		assert.equal(none.data.length, 0);
	});
});

describe("packConstellationStars", () => {
	const heroPoints = makePoints(40, 10, { isGold: false, isFeatured: false });
	const slotTargets: (SlidePoint[] | null)[] = [heroPoints, heroPoints, makePoints(40, 500), null, makePoints(40, 900, { isFeatured: true })];
	const configs: (ConstellationConfig | null)[] = [{ svg: "hero.svg" }, { svg: "hero.svg" }, { svg: "a.svg" }, null, { svg: "c.svg", settings: { featuredBrightnessMin: 3, featuredBrightnessMax: 3 } }];
	const slotScales = [1, 1, 1, 1, 1];
	const input = { slotTargets, configs, slotScales, heroWidth: 300, canvasWidth: 390, canvasHeight: 844, layout: LAYOUT, defaults: DEFAULTS };
	const packed = packConstellationStars(input);

	it("makes one star per hero target", () => {
		console.log(`constellation stars: ${packed.count}, floats ${packed.data.length}`);
		assert.equal(packed.count, 40);
		assert.equal(packed.data.length, 40 * LAYOUT.floatsPerVertex);
	});

	it("writes each slot's target position, and zero for a slot without targets", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			assert.equal(packed.data[base + 0 * SLIDE_FLOATS], 10 + i, `hero x ${i}`);
			assert.equal(packed.data[base + 2 * SLIDE_FLOATS], 500 + i, `slot 2 x ${i}`);
			assert.equal(packed.data[base + 2 * SLIDE_FLOATS + 1], 1000 + i, `slot 2 y ${i}`);
			assert.equal(packed.data[base + 3 * SLIDE_FLOATS], 0, `slot 3 x ${i}`);
			assert.equal(packed.data[base + 4 * SLIDE_FLOATS], 900 + i, `slot 4 x ${i}`);
		}
	});

	it("hides the star on a slot without a target (size, ray and brightness 0)", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex + 3 * SLIDE_FLOATS;
			assert.deepEqual([packed.data[base + 2], packed.data[base + 3], packed.data[base + 4]], [0, 0, 0]);
		}
	});

	it("scales the star size by the slot scale and the hero width", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			const heroSize = packed.data[base + 2];
			assert.ok(heroSize >= DEFAULTS.sizeMin * 300 - 1e-3 && heroSize <= DEFAULTS.sizeMax * 300 + 1e-3, `hero size ${heroSize}`);
		}
	});

	it("takes a featured star's style from the slot's own config when the point has none", () => {
		for (let i = 0; i < packed.count; i++) {
			const bright = packed.data[i * LAYOUT.floatsPerVertex + 4 * SLIDE_FLOATS + 4];
			assert.ok(Math.abs(bright - 3) < 1e-5, `slot 4 brightness ${bright}`);
		}
	});

	it("flags stars as logo stars and gives each a twinkle phase", () => {
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			assert.equal(packed.data[base + LAYOUT.isLogoIdx], 1);
			const phase = packed.data[base + LAYOUT.twinkleIdx];
			assert.ok(phase >= 0 && phase <= Math.PI * 2 + 1e-6);
		}
	});

	it("colors ivory stars ivory and gold stars gold", () => {
		const mixed = packConstellationStars({ ...input, slotTargets: [[{ x: 0, y: 0, isGold: false }, { x: 1, y: 1, isGold: true }], ...slotTargets.slice(1).map(() => null)] });
		const ivory = [0, 1, 2].map((c) => mixed.data[LAYOUT.colorIdx + c]);
		const gold = [0, 1, 2].map((c) => mixed.data[LAYOUT.floatsPerVertex + LAYOUT.colorIdx + c]);
		console.log("ivory", ivory, "gold", gold);
		assert.deepEqual(ivory.map((v) => +v.toFixed(2)), [DEFAULTS.colorIvory.r, DEFAULTS.colorIvory.g, DEFAULTS.colorIvory.b]);
		assert.deepEqual(gold.map((v) => +v.toFixed(2)), [DEFAULTS.colorGold.r, DEFAULTS.colorGold.g, DEFAULTS.colorGold.b]);
	});

	it("uses the hero config color for every star when it has one", () => {
		const custom = packConstellationStars({ ...input, configs: [{ svg: "hero.svg", settings: { color: { r: 0.1, g: 0.2, b: 0.3 } } }, ...configs.slice(1)] });
		const color = [0, 1, 2].map((c) => +custom.data[LAYOUT.colorIdx + c].toFixed(2));
		assert.deepEqual(color, [0.1, 0.2, 0.3]);
	});

	it("scatters each star within the spread radius, lifted up by at most 150 px", () => {
		// radius = 180 + up to 75% of the larger canvas side
		const maxRadius = 180 + 844 * 0.75;
		for (let i = 0; i < packed.count; i++) {
			const base = i * LAYOUT.floatsPerVertex;
			const sx = packed.data[base + LAYOUT.spreadIdx];
			const sy = packed.data[base + LAYOUT.spreadIdx + 1];
			assert.ok(Math.abs(sx) <= maxRadius + 1e-3, `spread x ${sx}`);
			assert.ok(sy <= maxRadius + 1e-3 && sy >= -(maxRadius + 150) - 1e-3, `spread y ${sy}`);
		}
	});

	it("makes no stars without hero targets", () => {
		const none = packConstellationStars({ ...input, slotTargets: [[], ...slotTargets.slice(1)] });
		assert.equal(none.count, 0);
		assert.equal(none.data.length, 0);
	});
});
