import { STAR_CONFIG } from "../../data/star-config.ts";
import { prefersReducedMotion } from "../motion.ts";
import { getSlideOffsets } from "../slide-offsets.ts";
import { packAmbientStars, packConstellationStars, type PackedStars } from "./buffers.ts";
import { HERO_SLOT, STAR_RUBBER_STIFFNESS, VIRTUAL_SLOT, createFlightState, getScrollPosition, slotOf, stepFlightFrame } from "./flight.ts";
import { MAX_SIZE_DEVIATION, fitImageInBox, sizeScale } from "./geometry.ts";
import { createStarLayout } from "./layout.ts";
import { buildTargetsFromLogo, getLayoutDocPos, sampleShapePoints } from "./sampling.ts";
import { SUNRISE_CONFIG, calculateDawnAlpha, dawnOverlayOpacity, pageScrollProgress, starSkyFade } from "./sunrise.ts";
import type { ConstellationConfig, SlidePoint } from "./types.ts";
import { bindStarBuffer, createStarProgram } from "./webgl-program.ts";

const MAX_DEVICE_PIXEL_RATIO = 2;
const FRAME_RATE = 60;
// Shader time advance per 60 Hz frame, so 120 Hz screens do not animate twice as fast
const TIME_PER_FRAME = 0.022;
// Longest frame the animation accounts for, in seconds
const MAX_FRAME_DT = 0.1;

// Cosmic star particles form the logo and disperse on scroll, over a sunrise sky.
// Uses the WebGL shader math and diffraction spikes from OpenAI Astra.
export const initCosmicField = () => {
	const canvas = document.getElementById("starCanvas") as HTMLCanvasElement | null;
	const dawnOverlay = document.getElementById("dawnOverlay");

	if (!canvas || prefersReducedMotion()) return;

	const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
	if (!gl) return;

	// Slides are the hero logo slot plus one slot per chapter, all read from the DOM
	const slideIds = ["heroLogoSlot"];
	for (let k = 1; document.getElementById(`constellationSlot-${k}`); k++) {
		slideIds.push(`constellationSlot-${k}`);
	}
	const REAL_SLIDE_COUNT = slideIds.length;
	// Shader slot 0 is the virtual slide -1, so there is one more slot than real slides
	const layout = createStarLayout(REAL_SLIDE_COUNT + 1);

	const starProgram = createStarProgram(gl, layout, STAR_CONFIG);
	if (!starProgram) return;
	const { uniforms } = starProgram;

	let width = window.innerWidth;
	let height = window.innerHeight;
	let dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

	let constellationDrawCount = 0;
	let ambientDrawCount = 0;
	const createBuffer = () => {
		const buffer = gl.createBuffer();
		if (!buffer) throw new Error("WebGL buffer creation failed");
		return buffer;
	};
	const vbo = createBuffer();
	const ambientVbo = createBuffer();

	const uploadStars = (buffer: WebGLBuffer, packed: PackedStars) => {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, packed.data, gl.STATIC_DRAW);
	};

	// Ambient stars get their own buffer so they draw before the constellation is ready
	const buildAmbientStars = () => {
		const packed = packAmbientStars({ canvasWidth: width, canvasHeight: height, ambient: STAR_CONFIG.ambient, layout });
		ambientDrawCount = packed.count;
		uploadStars(ambientVbo, packed);
	};

	// Loaded SVG images for each slide constellation
	let loadedImages: (HTMLImageElement | null)[] = [];
	let buildReady = false;

	const getConstellationConfigs = (): (ConstellationConfig | null)[] => {
		const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section[id]"));
		return sections.map((sec): ConstellationConfig | null => {
			if (sec.dataset.constellation) {
				try {
					return JSON.parse(sec.dataset.constellation) as ConstellationConfig;
				} catch (e) {
					console.error("Failed to parse constellation data", e);
				}
			}
			return sec.dataset.constellationSvg ? { svg: sec.dataset.constellationSvg } : null;
		});
	};

	const setSlideTops = () => {
		gl.useProgram(starProgram.program);
		const tops = slideIds.map((id) => {
			const section = document.getElementById(id)?.closest("section");
			return section ? getLayoutDocPos(section).top : 0;
		});
		// Virtual slide -1 sits one viewport above the hero
		gl.uniform1f(uniforms.slideTops[VIRTUAL_SLOT], tops[0] - height);
		tops.forEach((top, k) => gl.uniform1f(uniforms.slideTops[slotOf(k)], top));
	};

	// Fitted figure area of a slot, 0 while its image is not loaded
	const figureArea = (img: HTMLImageElement | null, el: HTMLElement | null) => {
		if (!img || !img.naturalWidth || !el) return 0;
		const fit = fitImageInBox(img.naturalWidth, img.naturalHeight, el.offsetWidth, el.offsetHeight, "center");
		return fit.dw * fit.dh;
	};

	const refreshBuffers = () => {
		if (!buildReady) return;
		setSlideTops();
		const configs = getConstellationConfigs();
		const heroTargets = buildTargetsFromLogo(loadedImages[0] || null, configs[0]?.settings);
		const count = heroTargets.length;

		// Slides without a constellation config yield null and their stars shrink in place
		const sampleSlide = (k: number) => {
			const cfg = configs[k];
			if (!cfg) return null;
			return sampleShapePoints(
				loadedImages[k] || null,
				document.getElementById(`constellationSlot-${k}`),
				count,
				cfg.settings
			);
		};

		// Virtual slot and hero slot both use the hero targets and config
		const heroSlot = document.getElementById("heroLogoSlot");
		const heroImg = loadedImages[0] || null;
		const referenceArea = figureArea(heroImg, heroSlot);
		const heroFigureWidth = heroImg && heroSlot
			? fitImageInBox(heroImg.naturalWidth, heroImg.naturalHeight, heroSlot.offsetWidth, heroSlot.offsetHeight, "left").dw
			: 0;
		gl.uniform1f(uniforms.heroWidth, heroFigureWidth);
		const slotTargets: (SlidePoint[] | null)[] = [heroTargets, heroTargets];
		const slotScales = [1, 1];
		for (let k = 1; k < REAL_SLIDE_COUNT; k++) {
			slotTargets.push(sampleSlide(k));
			const area = figureArea(loadedImages[k] || null, document.getElementById(`constellationSlot-${k}`));
			slotScales.push(sizeScale(area, referenceArea, MAX_SIZE_DEVIATION));
		}

		const packed = packConstellationStars({
			slotTargets,
			configs: [configs[0] ?? null, ...configs],
			slotScales,
			heroWidth: heroFigureWidth,
			canvasWidth: width,
			canvasHeight: height,
			layout,
			defaults: STAR_CONFIG.defaultConstellation,
		});
		constellationDrawCount = packed.count;
		uploadStars(vbo, packed);
	};

	const loadAllShapes = () => {
		const configs = getConstellationConfigs();
		const urls = configs.map((c) => c?.svg ?? null);
		const pendingCount = urls.filter((url) => url !== null).length;
		let loadedTotal = 0;
		return new Promise<void>((resolve) => {
			const imgs = urls.map((url) => {
				if (url === null) return null;
				const im = new Image();
				im.src = url;
				const onDone = () => {
					loadedTotal++;
					if (loadedTotal === pendingCount) {
						loadedImages = imgs;
						refreshBuffers();
						resolve();
					}
				};
				im.onload = onDone;
				im.onerror = onDone;
				return im;
			});
			if (pendingCount === 0) resolve();
		});
	};

	// Sizes of the slots the star targets were sampled for; a change means resampling is needed
	let lastSlotSizeKey = "";
	const slotSizeKey = () =>
		slideIds
			.map((id) => {
				const el = document.getElementById(id);
				return el ? `${el.offsetWidth}x${el.offsetHeight}` : "";
			})
			.join("|");

	let lastCanvasKey = "";
	const resize = () => {
		// Canvas box follows the visible viewport, so mobile toolbar changes do not stretch it
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
		// Mobile scroll fires resize on every toolbar move; resetting the canvas then flickers the stars
		const canvasKey = `${width}x${height}@${dpr}`;
		if (canvasKey === lastCanvasKey) return;
		lastCanvasKey = canvasKey;
		buildAmbientStars();

		canvas.width = width * dpr;
		canvas.height = height * dpr;
		gl.viewport(0, 0, canvas.width, canvas.height);

		gl.useProgram(starProgram.program);
		gl.uniform2f(uniforms.resolution, width, height);
		gl.uniform1f(uniforms.pixelRatio, dpr);

		// Toolbar-only height changes keep the layout; resampling would reshuffle the random stars
		const sizeKey = slotSizeKey();
		if (sizeKey !== lastSlotSizeKey) {
			lastSlotSizeKey = sizeKey;
			refreshBuffers();
		} else {
			setSlideTops();
		}
	};

	resize();
	const loadEvent = document.readyState === "complete" ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }));

	Promise.all([loadAllShapes(), loadEvent, document.fonts?.ready]).then(() => {
		buildReady = true;
		refreshBuffers();
	});

	window.addEventListener("resize", resize, { passive: true });

	// Lazy images grow chapter slots after load; resample once per frame when a slot size changes
	let slotSyncQueued = false;
	const syncSlotSizes = () => {
		if (slotSyncQueued) return;
		slotSyncQueued = true;
		requestAnimationFrame(() => {
			slotSyncQueued = false;
			const sizeKey = slotSizeKey();
			if (sizeKey === lastSlotSizeKey) return;
			lastSlotSizeKey = sizeKey;
			refreshBuffers();
		});
	};
	if ("ResizeObserver" in window) {
		const slotObserver = new ResizeObserver(syncSlotSizes);
		slideIds.forEach((id) => {
			const el = document.getElementById(id);
			if (el) slotObserver.observe(el);
		});
	}

	// Scroll states: sunrise progression spans full page
	let dawnAlpha = 0;
	let cachedSkyMaxScroll = 1;

	const updateSkyMaxScroll = () => {
		cachedSkyMaxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
	};
	updateSkyMaxScroll();
	window.addEventListener("resize", updateSkyMaxScroll, { passive: true });

	const updateSkyOnScroll = () => {
		// Sunrise progression: spans the entire page using SUNRISE_CONFIG (1 = linear, n = exponential)
		const pageProgress = pageScrollProgress(window.scrollY, cachedSkyMaxScroll);
		dawnAlpha = calculateDawnAlpha(pageProgress, SUNRISE_CONFIG.exponent, SUNRISE_CONFIG.curve);

		if (dawnOverlay) {
			dawnOverlay.style.opacity = `${dawnOverlayOpacity(dawnAlpha)}`;
		}
	};

	updateSkyOnScroll();

	// WebGL Blend Mode for additive starlight
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

	const flight = createFlightState();
	let lastFrameTime = performance.now();
	let time = 0;
	const render = () => {
		updateSkyOnScroll();

		const now = performance.now();
		const frameDt = Math.min((now - lastFrameTime) / 1000, MAX_FRAME_DT);
		lastFrameTime = now;
		time += frameDt * FRAME_RATE * TIME_PER_FRAME;
		// Flight waits for the constellation buffer, so the intro plays from the start
		if (buildReady) {
			const screenSlot = getScrollPosition(getSlideOffsets(), window.scrollY) + HERO_SLOT;
			stepFlightFrame(flight, screenSlot, layout.slideCount, frameDt);
		}

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(starProgram.program);
		gl.uniform1f(uniforms.time, time);
		gl.uniform1f(uniforms.slideProgress, flight.starsSlidePosition);
		gl.uniform1f(uniforms.scrollY, window.scrollY);
		gl.uniform1f(uniforms.rubberStiffness, STAR_RUBBER_STIFFNESS);
		gl.uniform1f(uniforms.scrollDir, flight.scrollDir);
		gl.uniform1f(uniforms.skyFade, starSkyFade(dawnAlpha));

		bindStarBuffer(gl, starProgram, layout, ambientVbo);
		gl.drawArrays(gl.POINTS, 0, ambientDrawCount);
		if (buildReady) {
			bindStarBuffer(gl, starProgram, layout, vbo);
			gl.drawArrays(gl.POINTS, 0, constellationDrawCount);
		}

		requestAnimationFrame(render);
	};

	render();
};
