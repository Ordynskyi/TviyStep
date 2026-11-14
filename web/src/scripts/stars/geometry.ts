// Largest star size change a slide may have relative to the hero figure
export const MAX_SIZE_DEVIATION = 0.4;

// Contain-fit of an image of iw×ih in a w×h box, aligned horizontally by pivot and centered vertically
export const fitImageInBox = (iw: number, ih: number, w: number, h: number, pivot: string) => {
	const imageWidth = iw || w;
	const imageHeight = ih || h;
	const scale = Math.min(w / imageWidth, h / imageHeight);
	const dw = imageWidth * scale;
	const dh = imageHeight * scale;
	const dx = pivot === "left" ? 0 : pivot === "right" ? w - dw : (w - dw) / 2;
	return { dx, dy: (h - dh) / 2, dw, dh };
};

// Star size factor of a figure area relative to the reference area, kept within 1 ± maxDeviation
export const sizeScale = (area: number, referenceArea: number, maxDeviation: number) => {
	if (area <= 0 || referenceArea <= 0) return 1;
	return Math.min(1 + maxDeviation, Math.max(1 - maxDeviation, Math.sqrt(area / referenceArea)));
};
