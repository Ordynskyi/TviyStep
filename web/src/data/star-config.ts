// Global starlight particle system configuration
// - ambient: Fixed background stars (twinkling cosmic sky)
// - defaultConstellation: Baseline starlight characteristics inherited by all slide silhouettes
export const STAR_CONFIG = {
	driftFraction: 0.006, // drift amplitude as a fraction of the hero logo width
	motion: {
		staggerSpan: 0.35, // share of the flight window spread across star start times
		driftSpeedX: 1.4,
		driftSpeedY: 1.1,
		swaySpeed: 1.2,
		swayRankPhase: 0.8, // sway phase offset per rank
		swayPhasePerWidth: 2.07, // sway phase across one hero logo width (0.006 per px at a 345 px logo)
		streamWidthFraction: 0.07, // stream width as a fraction of the hero logo width
		spreadScale: 0.12, // share of the hero spread applied mid-flight
		twinkleSpeed: 3.2,
		twinkleBrightnessSwing: 0.3,
		twinkleBase: 0.72,
		twinkleAmplitude: 0.28,
		brightnessBase: 0.8,
		flightSizeSwell: 0.25, // point size growth at mid-flight
		swayCycles: 1.5, // sway waves across one flight
	},
	ambient: {
		densityDivider: 2600, // screen area (w*h) / divider gives count
		sizeMin: 1.5,
		sizeMax: 3.3,
		brightnessMin: 0.8,
		brightnessMax: 1.2,
		rayStrengthMin: 0.10,
		rayStrengthMax: 0.30,
		featuredRatio: 0.08,
		featuredSizeMin: 5.0,
		featuredSizeMax: 9.0,
		featuredRayMin: 0.65,
		featuredRayMax: 0.90,
	},
	sprite: {
		discStart: 0.06, // star disc edge start (0-1 of point radius)
		coreSharpness: 2.2,
		rayFalloff: 28, // emitted with toFixed(1) because GLSL needs a float literal
		rayInnerEdge: 0.15,
		rayGain: 0.95,
		coreArea: 0.150904, // filtered core coverage area
		alphaCutoff: 0.01,
		whiteCoreBase: 0.59228,
		whiteBrightMin: 0.7,
		whiteBrightMax: 2.2,
		whiteCoreGain: 0.85,
		colorEnergyGain: 0.42,
	},
	defaultConstellation: {
		alphaThreshold: 35, // 0-255 opacity threshold to sample star positions from SVG
		density: 1, // candidate sample points per star
		gap: 0.008, // spacing as a fraction of the logo's fitted width
		featuredRatio: 0.1, // fraction of stars that become cross-spikes
		goldStarFraction: 0.25, // fraction of hero stars drawn in gold
		sizeMin: 0.005, // star diameters as fractions of the hero logo width
		sizeMax: 0.01,
		brightnessMin: 1.1,
		brightnessMax: 1.6,
		rayStrengthMin: 0.25,
		rayStrengthMax: 0.6,
		featuredSizeMin: 0.01,
		featuredSizeMax: 0.02,
		featuredRayMin: 1,
		featuredRayMax: 5,
		featuredBrightnessMin: 1.8,
		featuredBrightnessMax: 2.5,
		colorIvory: { r: 0.96, g: 0.94, b: 0.92 },
		colorGold: { r: 0.88, g: 0.78, b: 0.56 },
	},
};
