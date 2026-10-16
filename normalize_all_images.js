/**
 * ISLAND NUTRITION - PROFESSIONAL IMAGE NORMALIZER
 * ==================================================
 * Standardizes ALL product images onto a uniform 1200×1200 transparent square canvas.
 * - Every product bottle/tub is scaled to an exact 1040px height (86.7% of canvas).
 * - Perfectly centered horizontally and vertically.
 * - Eliminates flavor-to-flavor height differences (e.g. X-Gainer DRC vs SR).
 * - Gives Whey X3, Creatine, and Pill Bottles the exact same professional height as gainers.
 * - Produces pristine, uniform 1200x1200 WebP images ready for gallery and cards.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

sharp.cache(false);

const uploadsDir = path.join(__dirname, 'uploads');
const CANVAS_SIZE = 1200;
const TARGET_HEIGHT = 1040; // 86.7% of 1200 - standard professional nutrition size
const MAX_WIDTH = 1100;     // maximum allowed width to guarantee margins

async function processImage(filename) {
  const filePath = path.join(uploadsDir, filename);
  try {
    const inputBuf = fs.readFileSync(filePath);
    
    // 1. Trim whitespace to get precise product bounding box
    const trimmed = await sharp(inputBuf)
      .trim()
      .toBuffer({ resolveWithObject: true });
    
    const { width: trimW, height: trimH } = trimmed.info;
    
    // 2. Scale product to uniform target height (1040px), clamped by max width (1100px)
    let scale = TARGET_HEIGHT / trimH;
    if (trimW * scale > MAX_WIDTH) {
      scale = MAX_WIDTH / trimW;
    }
    
    const targetW = Math.round(trimW * scale);
    const targetH = Math.round(trimH * scale);
    
    // 3. Resize trimmed product
    const resizedBuf = await sharp(trimmed.data)
      .resize(targetW, targetH, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .toBuffer();
    
    // 4. Center on 1200x1200 transparent canvas
    const offsetX = Math.round((CANVAS_SIZE - targetW) / 2);
    const offsetY = Math.round((CANVAS_SIZE - targetH) / 2);
    
    const outputBuf = await sharp({
      create: {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{
        input: resizedBuf,
        top: offsetY,
        left: offsetX
      }])
      .webp({
        quality: 92,
        effort: 6
      })
      .toBuffer();
    
    // 5. Write in-memory buffer back to disk
    fs.writeFileSync(filePath, outputBuf);
    
    console.log(`  ✓ ${filename.padEnd(48)} ${trimW}x${trimH} -> ${targetW}x${targetH} on ${CANVAS_SIZE}x${CANVAS_SIZE}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${filename}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('');
  console.log('🏝️  Island Nutrition - Normalizing All Product Images');
  console.log('━'.repeat(70));
  console.log(`  Canvas: ${CANVAS_SIZE}×${CANVAS_SIZE}px  |  Target Product Height: ${TARGET_HEIGHT}px`);
  console.log('━'.repeat(70));
  console.log('');
  
  // Find all product images (product_*.webp and CLA uploads)
  const files = fs.readdirSync(uploadsDir)
    .filter(f => (f.startsWith('product_') || f.startsWith('17921468')) && f.endsWith('.webp'))
    .sort();
  
  let successCount = 0;
  for (const f of files) {
    const ok = await processImage(f);
    if (ok) successCount++;
  }
  
  console.log('');
  console.log('━'.repeat(70));
  console.log(`✅ Normalized ${successCount}/${files.length} images to ${CANVAS_SIZE}×${CANVAS_SIZE}px`);
  console.log('━'.repeat(70));
  
  // Verification pass
  console.log('\n🔍 Verification:');
  for (const f of files) {
    const meta = await sharp(fs.readFileSync(path.join(uploadsDir, f))).metadata();
    if (meta.width === CANVAS_SIZE && meta.height === CANVAS_SIZE) {
      console.log(`  ✓ ${f.padEnd(48)}: ${meta.width}x${meta.height} [OK]`);
    } else {
      console.error(`  ✗ MISMATCH ${f}: ${meta.width}x${meta.height}`);
    }
  }
}

main();
