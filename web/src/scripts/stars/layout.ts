// Per-slide floats of a star record: pos.xy, size, ray, bright
export const SLIDE_FLOATS = 5;
// Per-star floats after the slide data: spread.xy
const SPREAD_FLOATS = 2;
const LOGO_FLAG_FLOATS = 1;
const COLOR_FLOATS = 3;
const TWINKLE_FLOATS = 1;
const FLOATS_PER_VEC4 = 4;
const BYTES_PER_FLOAT = 4;

export interface StarLayout {
	slideCount: number;
	spreadIdx: number;
	isLogoIdx: number;
	colorIdx: number;
	twinkleIdx: number;
	floatsPerStar: number;
	vec4Count: number;
	floatsPerVertex: number;
	strideBytes: number;
}

// Where each float of one packed star record sits, for `slideCount` shader slots
export const createStarLayout = (slideCount: number): StarLayout => {
	const spreadIdx = slideCount * SLIDE_FLOATS;
	const isLogoIdx = spreadIdx + SPREAD_FLOATS;
	const colorIdx = isLogoIdx + LOGO_FLAG_FLOATS;
	const twinkleIdx = colorIdx + COLOR_FLOATS;
	const floatsPerStar = twinkleIdx + TWINKLE_FLOATS;
	const vec4Count = Math.ceil(floatsPerStar / FLOATS_PER_VEC4);
	return {
		slideCount,
		spreadIdx,
		isLogoIdx,
		colorIdx,
		twinkleIdx,
		floatsPerStar,
		vec4Count,
		floatsPerVertex: vec4Count * FLOATS_PER_VEC4,
		strideBytes: vec4Count * FLOATS_PER_VEC4 * BYTES_PER_FLOAT,
	};
};
