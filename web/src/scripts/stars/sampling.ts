import { STAR_CONFIG } from "../../data/star-config.ts";
import { fitImageInBox } from "./geometry.ts";
import type { ConstellationSettings } from "./types.ts";

const DEFAULT_CONSTELLATION = STAR_CONFIG.defaultConstellation;

// Document-space layout position of `el`. Unlike getBoundingClientRect(), ignores CSS transforms
// (reveal/spawn animations that are still offset when the page first measures)
export const getLayoutDocPos = (el: HTMLElement) => {
	let top = 0;
	let left = 0;
	let cur: HTMLElement | null = el;
	while (cur) {
		top += cur.offsetTop;
		left += cur.offsetLeft;
		cur = cur.offsetParent as HTMLElement | null;
	}
	return { top, left };
};

// Layout position of `el` relative to `ancestor`
export const getLayoutOffset = (el: HTMLElement, ancestor: HTMLElement) => {
	const a = getLayoutDocPos(el);
	const b = getLayoutDocPos(ancestor);
	return { top: a.top - b.top, left: a.left - b.left };
};


export const buildTargetsFromLogo = (
	img: HTMLImageElement | null,
	settings?: ConstellationSettings
): { x: number; y: number; isGold: boolean; isFeatured: boolean; settings: ConstellationSettings }[] => {
	const off = document.createElement("canvas");
	const octx = off.getContext("2d", { willReadFrequently: true });
	if (!octx) return [];

	const slot = document.getElementById("heroLogoSlot");
	if (!slot || !img || !img.naturalWidth || !slot.offsetWidth || !slot.offsetHeight) return [];
	const pivot = settings?.pivot ?? "left";
	// Grid is the logo's fitted size in CSS pixels; `gap` is a fraction of its width
	const fit = fitImageInBox(img.naturalWidth, img.naturalHeight, slot.offsetWidth, slot.offsetHeight, pivot);
	const offWidth = Math.max(1, Math.round(fit.dw));
	const offHeight = Math.max(1, Math.round(fit.dh));
	const figWidth = offWidth;
	const figHeight = offHeight;

	const textCol = slot.closest(".chapter-text-col") || slot.parentElement || slot;
	const colRect = textCol.getBoundingClientRect();
	const slotRect = slot.getBoundingClientRect();
	const slide = slot.closest("section");
	const slotLayout = slide ? getLayoutOffset(slot, slide) : { top: 0, left: 0 };
	let startX: number;
	if (pivot === "center") {
		startX = Math.round(colRect.left + (colRect.width - figWidth) / 2);
		slot.style.marginLeft = "auto";
		slot.style.marginRight = "auto";
	} else if (pivot === "right") {
		startX = Math.round(colRect.left + colRect.width - figWidth);
		slot.style.marginLeft = "auto";
		slot.style.marginRight = "0";
	} else {
		startX = Math.round(colRect.left);
		slot.style.marginLeft = "0";
		slot.style.marginRight = "auto";
	}
	// Y-axis always centered in the slot
	const startY = Math.round(slotLayout.top + (slotRect.height - figHeight) / 2);

	off.width = offWidth;
	off.height = offHeight;

	const regions = settings?.regions ?? [];
	// Index of the first region containing grid point (px, py), or -1 for the constellation defaults
	const regionIndexAt = (px: number, py: number) =>
		regions.findIndex(
			(r) =>
				px >= Math.floor(r.minX * offWidth) && px < Math.floor(r.maxX * offWidth) &&
				py >= Math.floor(r.minY * offHeight) && py < Math.floor(r.maxY * offHeight)
		);
	// Stable per grid point, so gold stars do not reshuffle on resize
	const hashUnit = (px: number, py: number) => {
		const v = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
		return v - Math.floor(v);
	};

	const sampleCoords = (imgData: Uint8ClampedArray) => {
		const coords: { x: number; y: number; isGold: boolean; isFeatured: boolean; settings: ConstellationSettings }[] = [];
		// Regions in order, then the constellation defaults for everything they do not claim
		const layers = [...regions.map((_, i) => i), -1];
		for (const layer of layers) {
			const s = { ...DEFAULT_CONSTELLATION, ...settings, ...regions[layer] };
			const step = Math.max(1, s.gap * offWidth);
			for (let fy = 0; fy < offHeight; fy += step) {
				for (let fx = 0; fx < offWidth; fx += step) {
					const px = Math.min(offWidth - 1, Math.round(fx));
					const py = Math.min(offHeight - 1, Math.round(fy));
					if (regionIndexAt(px, py) !== layer) continue;
					if (imgData[(py * offWidth + px) * 4 + 3] <= s.alphaThreshold) continue;
					coords.push({
						x: startX + px,
						y: startY + py,
						isGold: hashUnit(px, py) < s.goldStarFraction,
						isFeatured: Math.random() < s.featuredRatio,
						settings: s,
					});
				}
			}
		}
		return coords;
	};

	octx.drawImage(img, 0, 0, offWidth, offHeight);
	return sampleCoords(octx.getImageData(0, 0, offWidth, offHeight).data);
};

// Sample coordinate points for sport silhouette figures
export const sampleShapePoints = (
	img: HTMLImageElement | null,
	slotEl: HTMLElement | null,
	count: number,
	settings?: ConstellationSettings
): { x: number; y: number; isFeatured: boolean }[] => {
	if (!img || !img.naturalWidth || !slotEl) return [];
	const threshold = settings?.alphaThreshold ?? DEFAULT_CONSTELLATION.alphaThreshold;
	const featRatio = settings?.featuredRatio ?? DEFAULT_CONSTELLATION.featuredRatio;

	const pivot = settings?.pivot ?? "center";
	const textCol = slotEl.closest(".chapter-text-col, .cta-box") || slotEl.parentElement || slotEl;
	const colRect = textCol.getBoundingClientRect();
	const slotRect = slotEl.getBoundingClientRect();
	const slide = slotEl.closest("section");
	const slotLayout = slide ? getLayoutOffset(slotEl, slide) : { top: 0, left: 0 };
	const offW = Math.max(Math.floor(slotRect.width), 100);
	const offH = Math.max(Math.floor(slotRect.height), 100);

	let startX: number;
	if (pivot === "left") {
		startX = Math.round(colRect.left);
		slotEl.style.marginLeft = "0";
		slotEl.style.marginRight = "auto";
	} else if (pivot === "right") {
		startX = Math.round(colRect.left + colRect.width - offW);
		slotEl.style.marginLeft = "auto";
		slotEl.style.marginRight = "0";
	} else { // "center"
		startX = Math.round(colRect.left + (colRect.width - offW) / 2);
		slotEl.style.marginLeft = "auto";
		slotEl.style.marginRight = "auto";
	}

	// Y-axis always centered in the slot
	const startY = Math.round(slotLayout.top + (slotRect.height - offH) / 2);

	const off = document.createElement("canvas");
	off.width = offW;
	off.height = offH;
	const ctx = off.getContext("2d", { willReadFrequently: true });
	if (!ctx) return [];

	const fit = fitImageInBox(img.naturalWidth, img.naturalHeight, offW, offH, pivot);
	ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);

	const data = ctx.getImageData(0, 0, offW, offH).data;
	const collectCandidates = (step: number) => {
		const found: { x: number; y: number }[] = [];
		for (let py = 0; py < offH; py += step) {
			for (let px = 0; px < offW; px += step) {
				if (data[(py * offW + px) * 4 + 3] > threshold) {
					found.push({ x: startX + px, y: startY + py });
				}
			}
		}
		return found;
	};
	// Coarsest grid that still leaves `density` candidates per star
	const neededCandidates = count * DEFAULT_CONSTELLATION.density;
	let candidates: { x: number; y: number }[] = [];
	for (let step = 8; step >= 1; step--) {
		candidates = collectCandidates(step);
		if (candidates.length >= neededCandidates) break;
	}

	if (candidates.length === 0) return [];

	// Evenly spaced picks across all candidates; a fixed stride aliases with the row order
	const result: { x: number; y: number; isFeatured: boolean }[] = [];
	const numCandidates = candidates.length;
	for (let i = 0; i < count; i++) {
		const p = candidates[Math.floor(((i + 0.5) * numCandidates) / count)];
		const jx = (Math.random() - 0.5) * 1.5;
		const jy = (Math.random() - 0.5) * 1.5;
		result.push({
			x: p.x + jx,
			y: p.y + jy,
			isFeatured: Math.random() < featRatio,
		});
	}
	return result;
};
