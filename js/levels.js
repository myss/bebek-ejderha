// The levels, each a row of segments laid out one after another toward -z. Lengths are in
// meters; obstacles (fence, wall) and the ends (finish, mountain) size themselves, and for a
// river or lake the number is how wide the water is.
//
// biome picks the ground, trees, water and wild animal; path shapes how the trail winds;
// critters are the harmless animals living there; eagles, crocodiles and bears add those chasers.
// theme and biome name an entry of THEMES and BIOMES; a surprise level brings its own objects.

const LEVELS = [
  {
    name: 'Sirkten Kaçış',
    theme: 'sunset',
    biome: 'meadow',
    path: { amp: 8, freq: 0.018, phase: 0 },
    critters: ['rabbit', 'bird'],
    bears: true,
    segments: [['circus', 100], ['meadow', 90], ['fence'], ['forest', 150], ['finish']],
  },
  {
    name: 'Büyük Göl',
    theme: 'day',
    biome: 'forest',
    path: { amp: 14, freq: 0.012, phase: 1 },
    critters: ['deer', 'bird', 'fish'],
    bears: true,
    segments: [['forest', 110], ['lake', 60], ['forest', 120], ['fence'], ['meadow', 80], ['finish']],
  },
  {
    name: 'Karlı Tepeler',
    theme: 'snow',
    biome: 'snow',
    path: { amp: 18, freq: 0.022, phase: 2 },
    critters: ['penguin', 'fish', 'bird'],
    eagles: true,
    segments: [['meadow', 80], ['river', 30], ['rocks', 100], ['wall'], ['forest', 110], ['finish']],
  },
  {
    name: 'Kumlu Çöl',
    theme: 'desert',
    biome: 'desert',
    path: { amp: 22, freq: 0.01, phase: 3 },
    critters: ['bird', 'fish'],
    segments: [['rocks', 90], ['meadow', 70], ['lake', 45], ['rocks', 90], ['wall'], ['meadow', 60], ['finish']],
  },
  {
    name: 'Bataklık',
    theme: 'swamp',
    biome: 'swamp',
    path: { amp: 10, freq: 0.03, phase: 4 },
    critters: ['frog', 'fish', 'bird'],
    crocodiles: true,
    segments: [['forest', 90], ['river', 35], ['meadow', 70], ['fence'], ['lake', 40], ['camp', 100], ['finish']],
  },
  {
    name: 'Ejderha Dağı',
    theme: 'volcano',
    biome: 'volcano',
    path: { amp: 12, freq: 0.02, phase: 5 },
    critters: ['bird'],
    eagles: true,
    segments: [['rocks', 100], ['wall'], ['rocks', 90], ['camp', 130], ['mountain']],
  },
];

const THEMES = {
  sunset: { top: 0x4f9be0, horizon: 0xffd2a1, fog: 0xf3d6b4, sun: 0xffe2b8 },
  day: { top: 0x3d8de0, horizon: 0xc4e6ff, fog: 0xd2eafa, sun: 0xffffff },
  snow: { top: 0x6fa8dc, horizon: 0xeef4fa, fog: 0xe8f0f6, sun: 0xffffff },
  desert: { top: 0x3f8fe0, horizon: 0xffe9b8, fog: 0xf2dfb5, sun: 0xfff0c8 },
  swamp: { top: 0x3e5a6a, horizon: 0xc2cfa4, fog: 0xa8b796, sun: 0xeee6b8 },
  volcano: { top: 0x4a2a3a, horizon: 0xff9a6a, fog: 0xc08068, sun: 0xffb890 },
};

// beast is the wild animal the guards bring along; trees are the kinds that grow there.
const BIOMES = {
  meadow: { ground: [0x6dbb4a, 0x4f9a3a], path: 0xc9a46b, shore: 0xd9c38a, stone: 0x8a8278, water: 0x3a8fd6, trees: ['pine', 'round'], beast: 'dog', hay: true },
  forest: { ground: [0x5aa83e, 0x3f8a30], path: 0xb8935a, shore: 0xd9c38a, stone: 0x8a8278, water: 0x2f7fc4, trees: ['pine', 'round', 'pine'], beast: 'dog', hay: true },
  snow: { ground: [0xf2f6fa, 0xdce6ee], path: 0xc4d2de, shore: 0xd0dde8, stone: 0x9aa4ad, water: 0x4f9bd0, trees: ['snowPine'], beast: 'wolf', snowmen: true },
  desert: { ground: [0xecd394, 0xdcbc74], path: 0xc99a5b, shore: 0xf0dfa8, stone: 0xc08a5a, water: 0x2bb5c4, trees: ['cactus'], shoreTree: 'palm', beast: 'scorpion' },
  swamp: { ground: [0x5a7a3a, 0x445f2b], path: 0x6b5a3a, shore: 0x6a6a3a, stone: 0x5f5f50, water: 0x4d7048, trees: ['dead', 'mushroom', 'round'], beast: 'dog', hay: true, lilies: true },
  volcano: { ground: [0x4d3c38, 0x3a2e2c], path: 0x6b4a3a, shore: 0x5a4a40, stone: 0x2e2626, water: 0x3a6fa0, trees: ['dead'], beast: 'wolf', lava: true },
};

// Level numbers: HOME_LEVEL is the home meadow with a door to every level, 0 to LEVELS.length - 1
// are the levels above, and every number after them is a surprise level made up on the spot.
const HOME_LEVEL = -1;
const FIRST_SURPRISE_LEVEL = LEVELS.length;

const HOME = {
  name: 'Ana Sayfa',
  theme: 'day',
  biome: 'meadow',
  path: { amp: 0, freq: 0, phase: 0 },
  critters: ['rabbit', 'bird'],
  segments: [['home', 90]],
};

const PLACE_NAMES = { meadow: 'Çayır', forest: 'Orman', snow: 'Tepeler', desert: 'Çöl', swamp: 'Bataklık', volcano: 'Volkan' };
const BIOME_CRITTERS = {
  meadow: ['rabbit', 'bird'], forest: ['deer', 'bird', 'fish'], snow: ['penguin', 'fish', 'bird'],
  desert: ['bird', 'fish'], swamp: ['frog', 'fish', 'bird'], volcano: ['bird'],
};
const HUE_NAMES = ['Kırmızı', 'Turuncu', 'Sarı', 'Yeşil', 'Turkuaz', 'Mavi', 'Mor', 'Pembe'];
const HUE_NAME_STARTS = [0, 0.05, 0.11, 0.2, 0.44, 0.53, 0.72, 0.86];

function hsl(h, s, l) {
  return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l).getHex();
}

function levelTitle(level) {
  if (level === HOME_LEVEL) return '🏠';
  return level < FIRST_SURPRISE_LEVEL ? `Bölüm ${level + 1}` : `Sürpriz ${level - FIRST_SURPRISE_LEVEL + 1}`;
}

function levelDef(level) {
  if (level === HOME_LEVEL) return HOME;
  return level < FIRST_SURPRISE_LEVEL ? LEVELS[level] : surpriseLevel(level);
}

// Every surprise level invents its own colours, ground and route from its number, so the same
// number always makes the same level. Each one is a little longer and has more chasers.
function surpriseLevel(level) {
  const n = level - FIRST_SURPRISE_LEVEL + 1;
  const rand = makeRandom(20261107 + n * 7919);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const biomeKey = pick(Object.keys(BIOMES));
  const hue = rand();
  const hueName = HUE_NAMES[HUE_NAME_STARTS.findLastIndex((start) => hue >= start)];

  const lands = biomeKey === 'volcano' ? ['rocks', 'meadow'] : ['meadow', 'forest', 'rocks'];
  const obstacles = ['fence', 'river', 'lake', 'wall'];
  const segments = [];
  const parts = Math.min(3 + Math.floor(n / 2), 7);
  for (let i = 0; i < parts; i++) {
    segments.push([pick(lands), 60 + Math.round(rand() * 50)]);
    if (i < parts - 1) {
      const obstacle = pick(obstacles);
      segments.push(obstacle === 'river' ? ['river', 30 + Math.round(rand() * 10)] : obstacle === 'lake' ? ['lake', 40 + Math.round(rand() * 20)] : [obstacle]);
    }
  }
  if (n >= 2) segments.push(['camp', 90]);
  segments.push(['finish']);

  const biome = Object.assign({}, BIOMES[biomeKey], {
    ground: [hsl(hue, 0.5, 0.6), hsl(hue, 0.45, 0.47)],
    shore: hsl(hue + 0.08, 0.4, 0.75),
    water: hsl(hue + 0.33 + rand() * 0.34, 0.7, 0.5),
    leafHue: hue + 0.15 + rand() * 0.7,
  });
  return {
    name: `${hueName} ${PLACE_NAMES[biomeKey]}`,
    surprise: n,
    theme: { top: hsl(hue + 0.55, 0.55, 0.55), horizon: hsl(hue + 0.5, 0.6, 0.85), fog: hsl(hue + 0.5, 0.4, 0.85), sun: 0xffffff },
    biomeKey,
    biome,
    path: { amp: 6 + rand() * 16, freq: 0.01 + rand() * 0.02, phase: rand() * 6 },
    critters: BIOME_CRITTERS[biomeKey],
    eagles: biomeKey === 'snow' || biomeKey === 'volcano' || rand() < 0.4,
    crocodiles: biomeKey === 'swamp' || rand() < 0.3,
    bears: rand() < 0.4,
    segments,
  };
}
