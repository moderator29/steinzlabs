import sharp from "sharp";
import path from "path";
import fs from "fs";

async function removeBlackBackground(inputPath: string) {
  if (!fs.existsSync(inputPath)) {
    console.log(`SKIP (not found): ${inputPath}`);
    return;
  }

  console.log(`Processing: ${inputPath}`);

  const image = sharp(inputPath);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixels = Buffer.from(data);

  let transparentCount = 0;
  const totalPixels = pixels.length / channels;

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Threshold: any pixel darker than rgb(50,50,70) is the black card → transparent
    if (r < 50 && g < 50 && b < 70) {
      pixels[i + 3] = 0;
      transparentCount++;
    }
    // Edge anti-aliasing: pixels between 50-80 get partial transparency for smooth edges
    else if (r < 80 && g < 80 && b < 100) {
      const avg = (r + g + b) / 3;
      const alpha = Math.round((avg / 80) * 255);
      pixels[i + 3] = Math.min(pixels[i + 3], alpha);
    }
  }

  console.log(
    `  Made ${transparentCount}/${totalPixels} pixels transparent (${((transparentCount / totalPixels) * 100).toFixed(1)}%)`,
  );

  const tmpPath = inputPath + ".tmp.png";
  await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png({ compressionLevel: 9 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, inputPath);
  console.log(`  Saved: ${inputPath}`);
}

async function main() {
  const cwd = process.cwd();

  const targets = [
    "public/logo.png",
    "public/branding/logo-square-final.png",
    "public/branding/logo-square-original.jpg",
    "public/icons/icon-16.png",
    "public/icons/icon-32.png",
    "public/icons/icon-48.png",
    "public/icons/icon-64.png",
    "public/icons/icon-96.png",
    "public/icons/icon-128.png",
    "public/icons/icon-192.png",
    "public/icons/icon-256.png",
    "public/icons/icon-384.png",
    "public/icons/icon-512.png",
    "public/icons/icon-1024.png",
    "public/apple-touch-icon.png",
    "public/android-chrome-192x192.png",
    "public/android-chrome-512x512.png",
  ];

  for (const rel of targets) {
    try {
      await removeBlackBackground(path.join(cwd, rel));
    } catch (err) {
      console.error(`  FAILED: ${rel}`, err);
    }
  }

  console.log("\nAll logo backgrounds processed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
