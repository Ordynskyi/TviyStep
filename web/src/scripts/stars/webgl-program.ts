import type { StarLayout } from "./layout.ts";
import { buildFragmentShader, buildVertexShader } from "./shader.ts";
import type { StarConfig } from "./types.ts";

export interface StarProgram {
	program: WebGLProgram;
	uniforms: {
		resolution: WebGLUniformLocation | null;
		time: WebGLUniformLocation | null;
		slideProgress: WebGLUniformLocation | null;
		skyFade: WebGLUniformLocation | null;
		pixelRatio: WebGLUniformLocation | null;
		scrollY: WebGLUniformLocation | null;
		slideTops: (WebGLUniformLocation | null)[];
		rubberStiffness: WebGLUniformLocation | null;
		scrollDir: WebGLUniformLocation | null;
		heroWidth: WebGLUniformLocation | null;
	};
	// Location of each packed vec4 attribute of a star record
	attribs: number[];
}

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("Shader compile error:", gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
};

// Compiled and linked star program with its uniform and attribute locations, or null after logging the reason
export const createStarProgram = (gl: WebGLRenderingContext, layout: StarLayout, settings: StarConfig): StarProgram | null => {
	if (layout.vec4Count > gl.getParameter(gl.MAX_VERTEX_ATTRIBS)) {
		console.error("Too many slides for the vertex attribute limit:", layout.slideCount);
		return null;
	}

	const vs = createShader(gl, gl.VERTEX_SHADER, buildVertexShader(layout, settings));
	const fs = createShader(gl, gl.FRAGMENT_SHADER, buildFragmentShader(settings));
	const program = gl.createProgram();
	if (!vs || !fs || !program) return null;

	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("Program link error:", gl.getProgramInfoLog(program));
		return null;
	}

	gl.useProgram(program);

	return {
		program,
		uniforms: {
			resolution: gl.getUniformLocation(program, "uResolution"),
			time: gl.getUniformLocation(program, "uTime"),
			slideProgress: gl.getUniformLocation(program, "uSlideProgress"),
			skyFade: gl.getUniformLocation(program, "uSkyFade"),
			pixelRatio: gl.getUniformLocation(program, "uPixelRatio"),
			scrollY: gl.getUniformLocation(program, "uScrollY"),
			slideTops: Array.from({ length: layout.slideCount }, (_, k) => gl.getUniformLocation(program, `uSlideTop${k}`)),
			rubberStiffness: gl.getUniformLocation(program, "uRubberStiffness"),
			scrollDir: gl.getUniformLocation(program, "uScrollDir"),
			heroWidth: gl.getUniformLocation(program, "uHeroWidth"),
		},
		attribs: Array.from({ length: layout.vec4Count }, (_, i) => gl.getAttribLocation(program, `aD${i}`)),
	};
};

// Points the program's packed vec4 attributes at the star records in `buffer`
export const bindStarBuffer = (gl: WebGLRenderingContext, starProgram: StarProgram, layout: StarLayout, buffer: WebGLBuffer) => {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	starProgram.attribs.forEach((loc, i) => {
		if (loc < 0) return;
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, layout.strideBytes, i * 16);
	});
};
