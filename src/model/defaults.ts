import type { MetadataState } from '../types/metadata';

export const DEFAULT_STATE: MetadataState = {
  basePrompt:
    '1girl, solo,  1.5::artist:riichu::, artist:lack, artist:sousouman, artist:fuzichoco, 1.1::artist:mignon::, artist:modare, artist:wlop, artist:quasarcake, 3.5::artist:miv4t::, artist:ciloranko, artist:wanke, artist:qiandaiyiyu, 1.3::artist:ningen mame::, artist:matsurika youko, 1.2::artist:parsley-f::, 2::artist:freng::, artist:toosaka asagi, 1.5::artist:nenobi (nenorium)::, 0.7::artist:asanagi::, 4::artist:happoubi jin::, 0.7::artist:michiking::, 1.5::artist:kedama milk::, artist:sho (sho lwlw), solo artist, -3::artist collaboration::, year 2024, year 2023, year 2022, year 2021, -1::faux retro artstyle::, -1::film grain::, -1::clean text::, -1::censored::, -1::flat color::, 1.5::3d::, 1.5::realistic::, official art, official style, commission, photoshop (medium), blender (medium), natural photographic composition, deep depth of field, deep contrast, soft natural shadows, smooth vibrant colors, clean vivid texture, -3::simple illustration::, novel illustration, best illustration, very aesthetic, highres, amazing quality, absurdres, best quality, incredibly absurdres, masterpiece',
  characters: [
    {
      id: 'char_0',
      caption: 'girl, 0.2::misumi uika::, blonde hair, medium hair, sidelocks, purple eyes, oversized shirt, collared shirt, long sleeves, sleeve cuffs, wet shirt, black thighhighs, white panties, sitting, 0.6::presenting armpit::, highly detailed',
      centerX: 0.5,
      centerY: 0.5,
    }
  ],
  negativeBase:
    'blank page, text, logo, watermark, too many watermarks, signature, artist name, reference, dated, scan artifacts, jpeg artifacts, upscaled, aliasing, film grain, heavy film grain, dithering, chromatic aberration, digital dissolve, halftone, screentones, artist:xinzoruo, artist:milkpanda, artist:kurukurumagical, artist collaboration, one-hour drawing challenge, oekaki, toon (style), 1990s (style), 4koma, 2koma, bad face, mob face, bad facial features, unnatural facial features, bad eyes, empty eyes, pointy ears, distorted, deformed, super deformed, malformed, disfigured, bad anatomy, distorted anatomy, anatomical error, bad proportions, bad body parts, disproportionate body parts, bad limbs, impossible limb position, amputee, bad arm, bad hands, extra hands, bad hand structure, imperfect fingers, unclear fingertips, extra digits, fewer digits, bad leg, distorted composition, bad perspective, wrong perspective, multiple views, inconsistent art, disorganized colors, flat color, no lineart, messy lines, unnatural body pose, anatomically impossible pose, unfinished, incomplete, displeasing, very displeasing, unsatisfactory, inadequate, deficient, artistic error, amateurish, worst quality, bad quality, blurry, lowres, fewer details, bad portrait, bad illustration, worst portrait, worst illustration',
  negativeCharacters: [
    {
      id: 'char_0',
      caption: '',
      centerX: 0.5,
      centerY: 0.5,
    }
  ],

  steps: 28,
  width: 832,
  height: 1216,
  scale: 8,
  sampler: 'k_euler_ancestral',
  seed: 0,
  noiseSchedule: 'karras',
  nSamples: 1,

  cfgRescale: 0.3,
  uncondScale: 0,
  smea: false,
  smeaDyn: false,
  dynamicThresholding: false,
  skipCfgAboveSigma: null,
  skipCfgBelowSigma: 0,
  preferBrownian: true,
  cfgSchedEligibility: 'enable_for_post_summer_samplers',
  uncondPerVibe: true,
  wonkyVibeCorrelation: true,

  useCoords: true,
  useOrder: true,
};
