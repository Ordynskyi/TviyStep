export interface SlideOffset {
	id: string;
	top: number;
}

export interface SectionPosition {
	id: string;
	offsetTop: number;
}

// Slide tops clamped to the scrollable range, with the footer as an extra slide when it has room to scroll to
// and slides closer than 15 px to the previous one dropped
export const buildSlideOffsets = (sections: SectionPosition[], maxScrollY: number): SlideOffset[] => {
	const raw = sections.map((section) => ({ id: section.id, top: Math.min(Math.max(0, section.offsetTop), maxScrollY) }));

	if (raw.length > 0 && maxScrollY > raw[raw.length - 1].top + 20) {
		raw.push({ id: "footer", top: maxScrollY });
	}

	const clean: SlideOffset[] = [];
	for (let i = 0; i < raw.length; i++) {
		if (i === 0 || raw[i].top > clean[clean.length - 1].top + 15) {
			clean.push(raw[i]);
		}
	}
	return clean;
};

let cachedSlideOffsets: SlideOffset[] = [];
let cachedDocHeight = 0;

const getSections = () => Array.from(document.querySelectorAll<HTMLElement>("main > section[id]"));

// Slide tops in document space, cached until the layout changes
export const getSlideOffsets = () => {
	if (cachedSlideOffsets.length > 0) return cachedSlideOffsets;
	cachedDocHeight = document.documentElement.scrollHeight;
	const maxScrollY = Math.max(cachedDocHeight - window.innerHeight, 0);
	// offsetTop ignores the reveal transform that getBoundingClientRect would include
	const sections = getSections().map((el) => ({ id: el.id, offsetTop: el.offsetTop }));
	cachedSlideOffsets = buildSlideOffsets(sections, maxScrollY);
	return cachedSlideOffsets;
};

// Document height measured with the cached slide offsets
export const getCachedDocHeight = () => cachedDocHeight || document.documentElement.scrollHeight;

const refreshSlideOffsets = () => {
	cachedSlideOffsets = [];
	getSlideOffsets();
};

export const initSlideOffsets = () => {
	window.addEventListener("resize", refreshSlideOffsets, { passive: true });
	// Offsets cached before late layout changes (fonts, images, section growth) would leave the starlight off-target
	window.addEventListener("load", refreshSlideOffsets, { passive: true });
	document.fonts?.ready.then(refreshSlideOffsets);
	if ("ResizeObserver" in window) {
		const sectionObserver = new ResizeObserver(refreshSlideOffsets);
		getSections().forEach((el) => sectionObserver.observe(el));
	}
};
