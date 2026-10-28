// Size of the Empire world and of the view onto it, in native scene pixels. The world (town-base.png and every
// layer over it) is wider than the view; the camera (in Hero.tsx) slides it to keep the hero in sight.

/** The whole world: the original town (0-320) plus the east strip with the Workshop (320-480). */
export const WORLD_W = 480;
export const WORLD_H = 180;
/** The narrowest view (16:9). Wider screens show more, up to the whole world; Hero.tsx measures the real width. */
export const VIEW_W = 320;
