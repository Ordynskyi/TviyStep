import { SLIDE_FLOATS, type StarLayout } from "./layout.ts";
import type { StarConfig } from "./types.ts";

// Packed float e lives in attribute aD[e / 4], component e % 4
export const floatRef = (e: number) => `aD${e >> 2}.${"xyzw"[e & 3]}`;

// Emits an if/else chain over the segments between consecutive slides
export const segmentChain = (slideCount: number, assign: (s: number) => string) => {
	const last = slideCount - 2;
	const branches: string[] = [];
	for (let s = 0; s < last; s++) {
		branches.push(`if (slideIdx < ${s + 0.5}) { ${assign(s)} }`);
	}
	branches.push(`{ ${assign(last)} }`);
	return branches.join(" else ");
};

export const buildVertexShader = (layout: StarLayout, settings: StarConfig) => {
	const attributeDecls = Array.from({ length: layout.vec4Count }, (_, i) => `attribute vec4 aD${i};`).join("\n");
	const uniformDecls = Array.from({ length: layout.slideCount }, (_, k) => `uniform float uSlideTop${k};`).join("\n");
	const slideReads = Array.from({ length: layout.slideCount }, (_, k) => {
		const b = k * SLIDE_FLOATS;
		return `vec2 pos${k} = vec2(${floatRef(b)}, ${floatRef(b + 1)});
		float size${k} = ${floatRef(b + 2)};
		float ray${k} = ${floatRef(b + 3)};
		float bright${k} = ${floatRef(b + 4)};`;
	}).join("\n");

	return `
	${attributeDecls}

	uniform vec2 uResolution;
	uniform float uTime;
	uniform float uSlideProgress;
	uniform float uSkyFade;
	uniform float uPixelRatio;
	uniform float uScrollY;
	uniform float uHeroWidth;
	${uniformDecls}
	uniform float uRubberStiffness;
	uniform float uScrollDir;

	varying float vBrightness;
	varying vec3 vColor;
	varying float vOpacity;
	varying float vRayStrength;
	varying float vParticleDiameter;

	void main() {
		float sp = clamp(uSlideProgress, 0.0, ${layout.slideCount - 1}.0);
		// Last slide must resolve to the final segment with t = 1, not t = 0 of a new segment
		float slideIdx = min(floor(sp), ${layout.slideCount - 2}.0);
		float t = sp - slideIdx;

		${slideReads}
		vec2 spread = vec2(${floatRef(layout.spreadIdx)}, ${floatRef(layout.spreadIdx + 1)});
		float isLogo = ${floatRef(layout.isLogoIdx)};
		vec3 starColor = vec3(${floatRef(layout.colorIdx)}, ${floatRef(layout.colorIdx + 1)}, ${floatRef(layout.colorIdx + 2)});
		float twinklePhase = ${floatRef(layout.twinkleIdx)};

		// Per-star order: stars leave and arrive in a staggered wave, so the group reads as a stream
		float rank = fract(twinklePhase * 0.15915494);
		// Flight progress from the departure slide (0) to the destination slide (1), the same for both scroll directions
		float flightProgress = uScrollDir > 0.0 ? t : 1.0 - t;
		// The further a star is along its flight, the faster it flies
		float flightFlow = clamp((flightProgress - rank * ${settings.motion.staggerSpan}) * (1.0 + uRubberStiffness * isLogo * flightProgress) / ${1 - settings.motion.staggerSpan}, 0.0, 1.0);
		// Segment flow runs from slide s to s+1, so an upward flight is the mirrored downward one
		float flow = uScrollDir > 0.0 ? flightFlow : 1.0 - flightFlow;
		float morphT = smoothstep(0.0, 1.0, flow);

		// Stream envelope: zero at both slides, peaks mid-flight
		float dispersion = sin(flow * 3.14159265);

		vec2 targetPos;
		float targetSize;
		float targetRay;
		float targetBright;
		float targetTop;
		${segmentChain(layout.slideCount, (s) => `targetPos = mix(pos${s}, pos${s + 1}, morphT); targetSize = mix(size${s}, size${s + 1}, morphT); targetRay = mix(ray${s}, ray${s + 1}, morphT); targetBright = mix(bright${s}, bright${s + 1}, morphT); targetTop = mix(uSlideTop${s}, uSlideTop${s + 1}, morphT);`)}

		float drift = uHeroWidth * ${settings.driftFraction};
		float driftX = sin(uTime * ${settings.motion.driftSpeedX} + twinklePhase) * drift;
		float driftY = cos(uTime * ${settings.motion.driftSpeedY} + twinklePhase) * drift;

		vec2 travel;
		${segmentChain(layout.slideCount, (s) => `travel = pos${s + 1} - pos${s};`)}
		float travelLen = length(travel);
		vec2 streamNormal = travelLen > 0.001 ? vec2(-travel.y, travel.x) / travelLen : vec2(0.0);

		// Sideways sway: neighbours share a phase, so the stream bends as one body
		float sway = sin(flow * ${2 * Math.PI * settings.motion.swayCycles} + (pos0.x + pos0.y) * ${settings.motion.swayPhasePerWidth} / max(uHeroWidth, 1.0) + rank * ${settings.motion.swayRankPhase} + uTime * ${settings.motion.swaySpeed});
		float streamWidth = uHeroWidth * ${settings.motion.streamWidthFraction};
		vec2 streamOffset = streamNormal * sway * dispersion * streamWidth * isLogo;

		float docOffsetY = isLogo * (targetTop - uScrollY);
		vec2 pos = targetPos + vec2(0.0, docOffsetY) + streamOffset + spread * (dispersion * isLogo * ${settings.motion.spreadScale}) + vec2(driftX, driftY);

		vec2 zeroToOne = pos / uResolution;
		vec2 clipSpace = (zeroToOne * 2.0 - 1.0) * vec2(1.0, -1.0);
		gl_Position = vec4(clipSpace, 0.0, 1.0);

		float twinkle = ${settings.motion.twinkleBase} + ${settings.motion.twinkleAmplitude} * sin(uTime * ${settings.motion.twinkleSpeed} + twinklePhase);
		vOpacity = twinkle * uSkyFade;
		vBrightness = targetBright * (${settings.motion.brightnessBase} + ${settings.motion.twinkleBrightnessSwing} * twinkle);
		vColor = starColor;
		vRayStrength = targetRay;

		float diam = targetSize * uPixelRatio * (1.0 + dispersion * ${settings.motion.flightSizeSwell} * isLogo);
		gl_PointSize = targetSize > 0.0 ? max(diam, 1.5) : 0.0;
		vParticleDiameter = gl_PointSize;
	}
`;
};

export const buildFragmentShader = (settings: StarConfig) => `
	precision mediump float;

	varying float vBrightness;
	varying vec3 vColor;
	varying float vOpacity;
	varying float vRayStrength;
	varying float vParticleDiameter;

	float astraCubicCoverage(float coordinate) {
		float x = abs(coordinate);
		if (x < 1.0) return (4.0 - 6.0 * x * x + 3.0 * x * x * x) / 6.0;
		float tail = max(2.0 - x, 0.0);
		return tail * tail * tail / 6.0;
	}

	float astraFilteredCore(vec2 pixel, float area) {
		return astraCubicCoverage(pixel.x) * astraCubicCoverage(pixel.y)
			* area * vParticleDiameter * vParticleDiameter;
	}

	void main() {
		vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
		vec2 point = pixel * 2.0 / max(vParticleDiameter, 0.0001);
		float distanceToCenter = length(point);
		float disc = 1.0 - smoothstep(${settings.sprite.discStart}, 1.0, distanceToCenter);
		float core = pow(disc, ${settings.sprite.coreSharpness});

		// Exact OpenAI Astra 4-pointed cross needle diffraction rays:
		float horizontalRay = exp(-abs(point.y) * ${settings.sprite.rayFalloff.toFixed(1)}) * (1.0 - smoothstep(${settings.sprite.rayInnerEdge}, 1.0, abs(point.x)));
		float verticalRay = exp(-abs(point.x) * ${settings.sprite.rayFalloff.toFixed(1)}) * (1.0 - smoothstep(${settings.sprite.rayInnerEdge}, 1.0, abs(point.y)));
		float rays = max(horizontalRay, verticalRay) * ${settings.sprite.rayGain} * vRayStrength;

		float resolved = smoothstep(2.0, 4.0, vParticleDiameter);
		float alpha = mix(astraFilteredCore(pixel, ${settings.sprite.coreArea}), max(core, rays), resolved) * vOpacity;

		if (alpha <= ${settings.sprite.alphaCutoff}) {
			discard;
		}

		float whiteCore = mix(${settings.sprite.whiteCoreBase}, core, resolved) * smoothstep(${settings.sprite.whiteBrightMin}, ${settings.sprite.whiteBrightMax}, vBrightness) * ${settings.sprite.whiteCoreGain};
		float colorEnergy = 1.0 - min(vColor.r, min(vColor.g, vColor.b));
		vec3 emission = mix(vColor, vec3(1.0), whiteCore) * vBrightness * (1.0 + colorEnergy * ${settings.sprite.colorEnergyGain});

		gl_FragColor = vec4(emission * alpha, alpha);
	}
`;
