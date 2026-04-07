import spriteMeta from '../../../../resources/creatures/creature_sprites.json';

export default spriteMeta;

export function keyFromSprite(sprite) {
  const num = parseInt(sprite, 10);
  if (!num || num <= 0) return null;
  return `monster${String(num).padStart(4, '0')}`;
}

export function spriteUrl(key) {
  return `./creatures/${key}.webp`;
}

// Returns { clipW, clipH, imgStyle } to display a single frame cleanly.
// The caller should render an overflow:hidden box sized clipW×clipH (centered
// in the cell), with imgStyle applied to the <img> inside it.
export function frameDisplay(meta, frameNum, size) {
  const frameW = Math.round(meta.w / meta.frames);
  const scale  = Math.min(size / frameW, size / meta.h);
  const clipW  = frameW * scale;
  const clipH  = meta.h * scale;
  return {
    clipW,
    clipH,
    imgStyle: {
      height: clipH,
      width: 'auto',
      marginLeft: -(frameNum - 1) * clipW,
      imageRendering: 'pixelated',
      display: 'block',
      flexShrink: 0,
    },
  };
}
