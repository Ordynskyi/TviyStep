export type DawnCurve = "power" | "exponential";

export const SUNRISE_CONFIG = {
	// Exponent factor for sunrise curve:
	// 1.0       = strictly linear progression from top (0%) to bottom (100%)
	// 2.0       = quadratic curve (gentle sunrise acceleration)
	// 3.0 - 3.5 = natural dawn (dark night on slide 2, soft morning glow mid-page, full dawn at bottom)
	// 4.0 - 6.0 = steep exponential (stays night until the final climax/footer)
	exponent: 3,

	// Curve algorithm:
	// 'power'       -> p^exponent (standard power law: strictly linear when exponent = 1.0)
	// 'exponential' -> (e^(exponent * p) - 1) / (e^exponent - 1)
	curve: "power" as DawnCurve,

	// Maximum opacity of the warm Kyiv sunrise sky gradient reached at page bottom (0.0 - 1.0)
	maxOverlayOpacity: 0.98,

	// Starlight dimming as sunrise brightens:
	// skyFade = max(1.0 - dawnAlpha * starDimmingFactor, minStarOpacity)
	starDimmingFactor: 0.74,
	minStarOpacity: 0.16,
};

// Dawn progress for page progress p (0-1), from linear (exp = 1) to exponential
export const calculateDawnAlpha = (p: number, exp: number, curveType: DawnCurve = "power"): number => {
	const clamped = Math.min(Math.max(p, 0), 1);
	if (exp <= 1) return clamped;
	if (curveType === "exponential") {
		return (Math.exp(exp * clamped) - 1) / (Math.exp(exp) - 1);
	}
	return Math.pow(clamped, exp);
};

// Share of the page scrolled, 0 at the top and 1 at the bottom
export const pageScrollProgress = (scrollY: number, maxScroll: number) => Math.min(Math.max(scrollY / maxScroll, 0), 1);

// Opacity of the sunrise overlay for a dawn alpha
export const dawnOverlayOpacity = (dawnAlpha: number) => dawnAlpha * SUNRISE_CONFIG.maxOverlayOpacity;

// Starlight softly dims as the golden sunrise reaches its peak at the bottom
export const starSkyFade = (dawnAlpha: number) =>
	Math.max(1.0 - dawnAlpha * SUNRISE_CONFIG.starDimmingFactor, SUNRISE_CONFIG.minStarOpacity);
