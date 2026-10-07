export const BRAND = "#0066cc";

/** iOS launch-image sizes: [pixel width, pixel height, device pixel ratio], portrait. iOS matches them by exact device size. */
export const SPLASH: [number, number, number][] = [
  [1320, 2868, 3], // iPhone 16 Pro Max
  [1206, 2622, 3], // iPhone 16 Pro
  [1290, 2796, 3], // 14/15 Pro Max, 15/16 Plus
  [1179, 2556, 3], // 14/15 Pro, 15, 16
  [1284, 2778, 3], // 12/13 Pro Max, 14 Plus
  [1170, 2532, 3], // 12/13/14
  [1125, 2436, 3], // X, XS, 11 Pro, 12/13 mini
  [1242, 2688, 3], // XS Max, 11 Pro Max
  [828, 1792, 2], // XR, 11
  [1242, 2208, 3], // 6+/7+/8+
  [750, 1334, 2], // SE, 6/7/8
  [2048, 2732, 2], // iPad Pro 12.9"
  [1668, 2388, 2], // iPad Pro 11"
  [1640, 2360, 2], // iPad Air 10.9"
  [1620, 2160, 2], // iPad 10.2"
  [1488, 2266, 2], // iPad mini
];

export const splashMedia = ([w, h, r]: [number, number, number]) =>
  `(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`;

/** Sizes with a hand-made Wayfare launch image in public/splash (light and -dark). Others fall back to the generated /pwa/splash. */
const STATIC_SPLASH = new Set(["1320x2868", "1206x2622", "1290x2796", "1179x2556", "1284x2778", "1170x2532", "1125x2436", "1242x2688", "828x1792", "750x1334"]);

export const startupImages = () =>
  SPLASH.flatMap((s) => {
    const k = `${s[0]}x${s[1]}`;
    return STATIC_SPLASH.has(k)
      ? [
          { url: `/splash/${k}.png`, media: `${splashMedia(s)} and (prefers-color-scheme: light)` },
          { url: `/splash/${k}-dark.png`, media: `${splashMedia(s)} and (prefers-color-scheme: dark)` },
        ]
      : [{ url: `/pwa/splash/${k}`, media: splashMedia(s) }];
  });
