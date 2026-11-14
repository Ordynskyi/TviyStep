export const site = {
	brand: 'Твій STEP',
	tagline: 'Твій крок. Твій шлях. Твій степ.',
	social: {
		telegram: 'https://t.me/+S6yg2WuoqAI0ZmVi',
		instagram: 'https://www.instagram.com/tviy.step',
		tiktok: 'https://www.tiktok.com/@tviy.step?_r=1',
	},
};

// Scrolltelling blocks for the homepage
// Each block contains texts and images to be displayed in a storytelling manner on the homepage.
// If there are a few texts in the block - they are just separate paragraphs.
// If there are a few images in the block - the images should be automatically scrollable. There should be a manual way to scroll through them as well.
// constellationEffect: SVG silhouette and per-slide starlight settings (inherits defaults from STAR_CONFIG.defaultConstellation).
export const infoBlocks = [
	{
		num: '01',
		constellationEffect: {
			svg: '/images/home/logo.svg',
			settings: {
				pivot: 'left',
				// Top-left TVIY wordmark: finer sampling
				regions: [
					{ 	
						minX: 0, minY: 0, 
						maxX: 0.27, maxY: 0.165, 
						gap: 0.001, 
						sizeMin: 0.004, // star diameters as fractions of the hero logo width
						sizeMax: 0.008,
						featuredSizeMin: 0.004,
						featuredSizeMax: 0.012,
					},
				],
			},
		},
		texts: [
			'«Твій STEP» — це вільна спортивна спільнота для тих, хто любить бігати, тренуватися, їздити на велосипеді, відкривати нові маршрути і зустрічати своїх людей.'
		],
		images: [
			'/images/home/groupFlag1.webp',
			'/images/home/groupFlag2.webp',
			'/images/home/groupFlag5.webp'
		]
	},
	{
		num: '02',
		constellationEffect: {
			svg: '/images/home/runner.svg',
			settings: {
				pivot: 'center',
			},
		},
		texts: [
			'Ми обʼєднуємо людей навколо бігу, велоспорту та функціональних тренувань на свіжому повітрі (калістеніка, бруси, перекладини). Ми працюємо без привʼязки до спортзалів та абонементів, перетворюючи міський та природний простір на майданчик для розвитку.'
		],
		images: [
			'/images/home/team.webp',
			'/images/home/team2.webp',
		]
	},
	{
		num: '03',
		constellationEffect: {
			svg: '/images/home/cyclist.svg',
			settings: {
				pivot: 'center',
				brightnessMin: 2.5,
				brightnessMax: 4,
			},
		},
		texts: [
			'Назва спільноти має глибинний підтекст:<br>' +
			'«Степ» — це символ української волі і свободи, витривалості та безмежного простору;<br>' +
			'«STEP» — це щоденний крок вперед до кращої версії себе <br>' +
			'«твій» - це про відчуття приналежності до єдиної «зграї», де панує підтримка, рівність і свобода.',
			'«Твій STEP» - це більше ніж спортивний клуб. Це простір свободи, духу та руху, де кожен крок робиться разом.'
		],
		images: [
			'/images/home/groupFlag3.webp',
			'/images/home/groupFlag4.webp',
		]
	},
	{
		num: '04',
		constellationEffect: {
			svg: '/images/home/calisthenics.svg',
			settings: {
				pivot: 'center',
				brightnessMin: 2.5,
				brightnessMax: 4,
			},
		},
		texts: [
			'Неважливо, скільки кілометрів.<br>' +
			'Неважливо, який темп.<br>' +
			'Неважливо, ти біжиш, крутиш педалі чи просто робиш перший крок.<br>' +
			'Важливо, що нам подобається одне й те саме — бути в русі і бути серед своїх.'
		],
		images: [
			'/images/home/friends3.webp',
			'/images/home/friends4.webp',
			'/images/home/friends1.webp',
			'/images/home/friends2.webp',
		],
	},
	{
		num: '05',

		// there should be the join button here (join to Telegram channel)
		texts: [
			'Можна прийти одному.<br>' +
			'Можна з другом.<br>' +
			'Можна навіть просто познайомитися.',
			'Твій Step починається з першого кроку.'
		],
		images: []
	}
];

export const icons = {
	telegram: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
	instagram: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
	tiktok: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
	arrowRight: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
};

export const pageTitle = `${site.brand} — ${site.tagline}`;
export const pageDescription = 'Вільна спортивна спільнота Києва. Біг, вело, вуличні тренування, відкритий простір та люди поруч. Твій темп. Твій шлях. Твій степ.';
