import type { STAR_CONFIG } from "../../data/star-config.ts";

export type StarConfig = typeof STAR_CONFIG;
export type DefaultConstellation = StarConfig["defaultConstellation"];
export type AmbientConfig = StarConfig["ambient"];

export interface ConstellationSettings {
	alphaThreshold?: number;
	featuredRatio?: number;
	brightnessMin?: number;
	brightnessMax?: number;
	featuredBrightnessMin?: number;
	featuredBrightnessMax?: number;
	rayStrengthMin?: number;
	rayStrengthMax?: number;
	featuredRayMin?: number;
	featuredRayMax?: number;
	sizeMin?: number;
	sizeMax?: number;
	featuredSizeMin?: number;
	featuredSizeMax?: number;
	color?: { r: number; g: number; b: number };
	pivot?: "left" | "center" | "right";
	gap?: number;
	goldStarFraction?: number;
	regions?: ConstellationRegion[];
}

// Bounds are fractions of the hero slot; other settings override the constellation settings inside the box
export interface ConstellationRegion extends Omit<ConstellationSettings, "regions"> {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface ConstellationConfig {
	svg: string;
	settings?: ConstellationSettings;
}

export type SlidePoint = { x: number; y: number; isGold?: boolean; isFeatured?: boolean; settings?: ConstellationSettings };

export interface StarStyle {
	size: number;
	ray: number;
	bright: number;
}
