import type { StarLayout } from "./layout.ts";
import type { AmbientConfig, ConstellationConfig, ConstellationSettings, DefaultConstellation, SlidePoint, StarStyle } from "./types.ts";

export interface PackedStars {
	data: Float32Array;
	count: number;
}

export interface Rgb {
	r: number;
	g: number;
	b: number;
}

// Ambient star colors
const AMBIENT_COLOR_IVORY: Rgb = { r: 0.95, g: 0.94, b: 0.92 };
const AMBIENT_COLOR_GOLD: Rgb = { r: 0.86, g: 0.77, b: 0.55 };
// Share of ambient stars that are ivory; the rest are gold
const AMBIENT_IVORY_SHARE = 0.6;
// Constellation spread: stars scatter at least this far (px) and up to this share of the larger canvas side further
const SPREAD_MIN_DISTANCE = 180;
const SPREAD_CANVAS_SHARE = 0.75;
// Spread is lifted by up to this many px, so scattered stars fly above the logo
const SPREAD_LIFT = 150;

const hiddenStyle: StarStyle = { size: 0, ray: 0, bright: 0 };

// Random value between two bounds given in either order
const randomBetween = (a: number, b: number) => {
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	return Math.random() * (hi - lo) + lo;
};

// Sequential writer of fixed-size star records into one Float32Array
const createRecordWriter = (count: number, layout: StarLayout) => {
	const data = new Float32Array(count * layout.floatsPerVertex);
	let offset = 0;
	return {
		data,
		put: (value: number) => {
			data[offset++] = value;
		},
		// Padding floats after the record stay zero
		endRecord: () => {
			offset += layout.floatsPerVertex - layout.floatsPerStar;
		},
	};
};

// Random size, ray strength and brightness of one star; the slide's settings override the defaults
export const getStarStyle = (
	isFeatured: boolean,
	settings: ConstellationSettings | undefined,
	defaults: DefaultConstellation,
	sizeScale: number
): StarStyle => {
	const size = isFeatured
		? randomBetween(settings?.featuredSizeMin ?? defaults.featuredSizeMin, settings?.featuredSizeMax ?? defaults.featuredSizeMax)
		: randomBetween(settings?.sizeMin ?? defaults.sizeMin, settings?.sizeMax ?? defaults.sizeMax);
	const ray = isFeatured
		? randomBetween(settings?.featuredRayMin ?? defaults.featuredRayMin, settings?.featuredRayMax ?? defaults.featuredRayMax)
		: randomBetween(settings?.rayStrengthMin ?? defaults.rayStrengthMin, settings?.rayStrengthMax ?? defaults.rayStrengthMax);
	const bright = isFeatured
		? randomBetween(settings?.featuredBrightnessMin ?? defaults.featuredBrightnessMin, settings?.featuredBrightnessMax ?? defaults.featuredBrightnessMax)
		: randomBetween(settings?.brightnessMin ?? defaults.brightnessMin, settings?.brightnessMax ?? defaults.brightnessMax);
	return { size: size * sizeScale, ray, bright };
};

export interface ConstellationBufferInput {
	// Star targets per shader slot; null or missing entries hide the star on that slot
	slotTargets: (SlidePoint[] | null)[];
	// Constellation config per shader slot
	configs: (ConstellationConfig | null)[];
	// Star size factor per shader slot
	slotScales: number[];
	heroWidth: number;
	canvasWidth: number;
	canvasHeight: number;
	layout: StarLayout;
	defaults: DefaultConstellation;
}

// One packed record per star: slide data in slot order, then spread, logo flag, color and twinkle phase
export const packConstellationStars = (input: ConstellationBufferInput): PackedStars => {
	const { slotTargets, configs, slotScales, heroWidth, canvasWidth, canvasHeight, layout, defaults } = input;
	const heroTargets = slotTargets[0] ?? [];
	const count = heroTargets.length;
	const { data, put, endRecord } = createRecordWriter(count, layout);

	for (let i = 0; i < count; i++) {
		const points: (SlidePoint | undefined)[] = [];
		for (let k = 0; k < layout.slideCount; k++) {
			points.push(slotTargets[k]?.[i]);
		}
		const styles = points.map((point, k) =>
			point ? getStarStyle(!!point.isFeatured, point.settings ?? configs[k]?.settings, defaults, slotScales[k] * heroWidth) : hiddenStyle
		);

		const angle = Math.random() * Math.PI * 2;
		const dist = Math.random() * Math.max(canvasWidth, canvasHeight) * SPREAD_CANVAS_SHARE + SPREAD_MIN_DISTANCE;
		const spreadX = Math.cos(angle) * dist;
		const spreadY = Math.sin(angle) * dist - Math.random() * SPREAD_LIFT;

		const customColor = configs[0]?.settings?.color;
		const color = customColor ?? (heroTargets[i].isGold ? defaults.colorGold : defaults.colorIvory);
		const twinklePhase = Math.random() * Math.PI * 2;

		points.forEach((point, k) => {
			put(point?.x ?? 0);
			put(point?.y ?? 0);
			put(styles[k].size);
			put(styles[k].ray);
			put(styles[k].bright);
		});
		put(spreadX);
		put(spreadY);
		put(1.0);
		put(color.r);
		put(color.g);
		put(color.b);
		put(twinklePhase);
		endRecord();
	}

	return { data, count };
};

export interface AmbientBufferInput {
	canvasWidth: number;
	canvasHeight: number;
	ambient: AmbientConfig;
	layout: StarLayout;
}

// Background stars scattered over the canvas, the same on every slide
export const packAmbientStars = (input: AmbientBufferInput): PackedStars => {
	const { canvasWidth, canvasHeight, ambient, layout } = input;
	const count = Math.floor((canvasWidth * canvasHeight) / ambient.densityDivider);
	const { data, put, endRecord } = createRecordWriter(count, layout);

	for (let i = 0; i < count; i++) {
		const x = Math.random() * canvasWidth;
		const y = Math.random() * canvasHeight;
		const isGold = Math.random() > AMBIENT_IVORY_SHARE;
		const isFeatured = Math.random() < ambient.featuredRatio;

		const size = isFeatured
			? randomBetween(ambient.featuredSizeMin, ambient.featuredSizeMax)
			: randomBetween(ambient.sizeMin, ambient.sizeMax);
		const rayStrength = isFeatured
			? randomBetween(ambient.featuredRayMin, ambient.featuredRayMax)
			: randomBetween(ambient.rayStrengthMin, ambient.rayStrengthMax);
		const brightness = randomBetween(ambient.brightnessMin, ambient.brightnessMax);

		const color = isGold ? AMBIENT_COLOR_GOLD : AMBIENT_COLOR_IVORY;
		const twinklePhase = Math.random() * Math.PI * 2;

		for (let k = 0; k < layout.slideCount; k++) {
			put(x);
			put(y);
			put(size);
			put(rayStrength);
			put(brightness);
		}
		put(0.0); // spread x
		put(0.0); // spread y
		put(0.0); // isLogo
		put(color.r);
		put(color.g);
		put(color.b);
		put(twinklePhase);
		endRecord();
	}

	return { data, count };
};
