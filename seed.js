const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'in stuff');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Process a product image from source PNGs:
 * - Resize to max 1200px (preserves detail for product pages)
 * - Convert to WebP at quality 90 (visually lossless, ~80-90% size reduction)
 * - Typically reduces 5-8MB PNGs down to 80-200KB WebP
 */
async function processProductImage(sourceFilename) {
  const sourcePath = path.join(sourceDir, sourceFilename);
  const slug = slugify(path.basename(sourceFilename, path.extname(sourceFilename)));
  const outputFilename = `product_${slug}.webp`;
  const outputPath = path.join(uploadsDir, outputFilename);

  if (!fs.existsSync(sourcePath)) {
    if (fs.existsSync(outputPath)) {
      return `/uploads/${outputFilename}`;
    }
    console.warn(`  ⚠ Source image not found: ${sourceFilename}`);
    return null;
  }

  try {
    // 1. Trim outer transparent whitespace so we isolate the exact bottle/tub
    const trimmedBuffer = await sharp(sourcePath)
      .trim()
      .toBuffer({ resolveWithObject: true });
    
    const { width: trimW, height: trimH } = trimmedBuffer.info;

    // 2. Identify if this is a pill bottle (capsules, tablets, softgels)
    const isPillBottle = /carnitine|cla|vitamin|b-complex|magnesium|multiwell|testo|zma|joint|ashwagandha|gaba/i.test(sourceFilename);

    let targetW, targetH;
    const isGiantProduct = /gainer|4000/i.test(sourceFilename);

    if (isPillBottle) {
      // UNIFY ALL PILL BOTTLES: Exact same height (1100px) across every single bottle!
      targetH = 1100;
      targetW = Math.round(trimW * (targetH / trimH));
    } else if (isGiantProduct) {
      // Massive 4000g buckets (X-GAINER): 1040px with generous margins so lid & sides never crop
      const scale = Math.min(1040 / trimW, 1040 / trimH);
      targetW = Math.round(trimW * scale);
      targetH = Math.round(trimH * scale);
    } else {
      // Powder tubs & jars: Scale so max dimension is 1100px (heroic scale)
      const scale = Math.min(1100 / trimW, 1100 / trimH);
      targetW = Math.round(trimW * scale);
      targetH = Math.round(trimH * scale);
    }

    // 3. Add clean, tight padding
    const padTop = isGiantProduct ? 35 : 20;
    const padBottom = isGiantProduct ? 25 : 20;
    const padSide = isGiantProduct ? 35 : 20;
    const canvasW = targetW + (padSide * 2);
    const canvasH = targetH + padTop + padBottom;

    const resizedBuffer = await sharp(trimmedBuffer.data)
      .resize(targetW, targetH, { fit: 'fill' })
      .toBuffer();

    await sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{
        input: resizedBuffer,
        top: padTop,
        left: padSide
      }])
      .webp({
        quality: 92,
        effort: 6
      })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const originalStats = fs.statSync(sourcePath);
    const reduction = ((1 - stats.size / originalStats.size) * 100).toFixed(1);
    console.log(`  ✓ ${sourceFilename} → ${outputFilename} [${canvasW}x${canvasH}, ${isPillBottle ? 'BOTTLE-HERO' : 'POWDER-HERO'}] (${reduction}% smaller)`);

    return `/uploads/${outputFilename}`;
  } catch (err) {
    console.error(`  ✗ Failed to process ${sourceFilename}:`, err.message);
    return null;
  }
}

/**
 * Generate a category thumbnail from one of its product images
 */
async function generateCategoryThumbnail(sourceFilename, categorySlug) {
  const sourcePath = path.join(sourceDir, sourceFilename);
  const outputFilename = `cat_${categorySlug}.webp`;
  const outputPath = path.join(uploadsDir, outputFilename);

  if (!fs.existsSync(sourcePath)) {
    if (fs.existsSync(outputPath)) {
      return `/uploads/${outputFilename}`;
    }
    return null;
  }

  try {
    await sharp(sourcePath)
      .resize(600, 600, {
        fit: 'cover',
        position: 'centre'
      })
      .webp({ quality: 85, effort: 6 })
      .toFile(outputPath);

    return `/uploads/${outputFilename}`;
  } catch (err) {
    console.error(`  ✗ Failed to create category thumb for ${categorySlug}:`, err.message);
    return null;
  }
}

// ============================================================
// ISLAND NUTRITION PRODUCT CATALOG
// Multi-flavor products are consolidated into single entries
// with multiple images (one per flavor) and flavor entries
// ============================================================

const catalog = [
  // ──────────────────────────────────────────────────────────
  // CATEGORY 1: Pre-Workout (PWOx7 & X-SHRED)
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Pre-Workout',
      description: 'High-intensity pre-workout formulas engineered for explosive energy, laser focus, endurance, and skin-splitting pumps. Made in Sweden with premium ingredients.',
      sort_order: 10,
      thumbnailSource: 'PWOx7 TROPICAL.png'
    },
    products: [
      {
        name: 'PWOx7',
        short_description: 'Explosive Pre-Workout Formula — Energy • Focus • Endurance • Pump',
        description: 'PWOx7 is Island Nutrition\'s flagship pre-workout formula, delivering 7 clinically dosed active compounds for explosive energy, razor-sharp mental focus, enhanced muscular endurance, and intense vascular pumps. Made in Sweden with Halal certification and 100% premium quality ingredients. Available in Tropical and Watermelon flavours.',
        weight: '320g',
        servings: '40',
        ingredients: 'L-Citrulline Malate, Beta-Alanine, Caffeine Anhydrous, L-Tyrosine, Taurine, Alpha-GPC, AstraGin®, Natural & Artificial Flavors, Citric Acid, Sucralose, Silicon Dioxide.',
        usage_instructions: 'Mix 1 scoop (8g) with 250-350ml cold water. Consume 20-30 minutes before training. Do not exceed 1 serving in a 24-hour period. Assess tolerance with half a scoop.',
        is_featured: 1,
        specs: [
          { name: 'L-Citrulline Malate', value: '6,000 mg' },
          { name: 'Beta-Alanine', value: '3,200 mg' },
          { name: 'Caffeine', value: '300 mg' },
          { name: 'L-Tyrosine', value: '1,000 mg' },
          { name: 'Alpha-GPC', value: '300 mg' },
          { name: 'Servings', value: '40' },
          { name: 'Net Weight', value: '320g' },
          { name: 'Made In', value: 'Sweden 🇸🇪' },
          { name: 'Certification', value: 'Halal Suitable' }
        ],
        flavors: [
          { name: 'Tropical', color: '#f59e0b', image: 'PWOx7 TROPICAL.png' },
          { name: 'Watermelon', color: '#ef4444', image: 'PWOx7 WATERMELON.png' }
        ]
      },
      {
        name: 'X-SHRED Pre-Workout',
        short_description: 'Pre-Workout Thermogenic Formula — Shred • Focus • Energy',
        description: 'X-SHRED is Island Nutrition\'s cutting-edge pre-workout formula designed for those focused on shredding and definition. Combining energy-boosting compounds with thermogenic agents, X-SHRED helps maximize fat oxidation during training while maintaining peak performance. Ice Tea Lime flavour for a crisp, refreshing pre-training drink. Made in Sweden, Halal certified.',
        weight: '320g',
        servings: '35',
        ingredients: 'L-Citrulline, Acetyl L-Carnitine, Caffeine Anhydrous, Green Tea Extract, Beta-Alanine, L-Tyrosine, Synephrine HCl, BioPerine®, Natural & Artificial Ice Tea Lime Flavor, Citric Acid, Sucralose.',
        usage_instructions: 'Mix 1 scoop with 250-350ml cold water. Consume 20-30 minutes before training. Start with half a scoop to assess tolerance.',
        is_featured: 1,
        is_new: 1,
        badge_text: 'NEW',
        specs: [
          { name: 'L-Citrulline', value: '4,000 mg' },
          { name: 'Acetyl L-Carnitine', value: '1,500 mg' },
          { name: 'Green Tea Extract', value: '500 mg' },
          { name: 'Caffeine', value: '250 mg' },
          { name: 'Synephrine HCl', value: '30 mg' },
          { name: 'Flavour', value: 'Ice Tea Lime' },
          { name: 'Servings', value: '35' },
          { name: 'Net Weight', value: '320g' },
          { name: 'Made In', value: 'Sweden 🇸🇪' },
          { name: 'Certification', value: 'Halal Suitable' }
        ],
        flavors: [
          { name: 'Ice Tea Lime', color: '#84cc16', image: 'PWO_X-SHRED.png' }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 2: Whey Protein (WHEY X3 — 1 product, 3 flavors)
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Whey Protein',
      description: 'WHEY X3 Protein Complex — premium triple-source whey protein with digestive enzyme blend. 22g protein, 3.9g carbs, 1.4g fat per serving. 67 servings per container.',
      sort_order: 20,
      thumbnailSource: 'WHEY X3 CHOCOLATE MUFFIN.png'
    },
    products: [
      {
        name: 'WHEY X3 Protein Complex',
        short_description: 'Triple-Source Whey Protein — 22g Protein • 3.9g Carbs • 1.4g Fat • 67 Servings',
        description: 'WHEY X3 is Island Nutrition\'s premium triple-source whey protein complex, combining whey concentrate, isolate, and hydrolysate for superior amino acid delivery. Enhanced with a digestive enzyme blend for maximum absorption and zero bloating. Available in three indulgent flavours: Chocolate Muffin, Salted Caramel, and Vanilla Swirl. 100% Premium Quality, Halal Suitable.',
        weight: '2000g',
        servings: '67',
        ingredients: 'Whey Protein Concentrate, Whey Protein Isolate, Whey Protein Hydrolysate, Digestive Enzyme Blend (Protease, Lactase, Lipase), Natural & Artificial Flavors, Lecithin, Sucralose, Acesulfame-K.',
        usage_instructions: 'Mix 1 scoop (30g) with 200-300ml cold water or milk. Shake well for 15-20 seconds. Consume post-workout or between meals for optimal protein intake.',
        is_featured: 1,
        specs: [
          { name: 'Protein per Serving', value: '22 g' },
          { name: 'Carbohydrates', value: '3.9 g' },
          { name: 'Fat', value: '1.4 g' },
          { name: 'Servings per Container', value: '67' },
          { name: 'Net Weight', value: '2000g' },
          { name: 'Digestive Enzymes', value: 'Included' },
          { name: 'Quality', value: '100% Premium' },
          { name: 'Certification', value: 'Halal Suitable' }
        ],
        flavors: [
          { name: 'Chocolate Muffin', color: '#78350f', image: 'WHEY X3 CHOCOLATE MUFFIN.png' },
          { name: 'Salted Caramel', color: '#d97706', image: 'WHEY X3 SALTED CARAMEL.png' },
          { name: 'Vanilla Swirl', color: '#fef3c7', image: 'WHEY X3 VANILLA SWIRL.png' }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 3: Mass Gainers (X-GAINER — 1 product, 3 flavors)
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Mass Gainers',
      description: 'X-GAINER — 800 kcal per serving with over 61g protein. Massive calorie-dense mass builder with digestive enzyme blend for hardgainers seeking serious muscle volume.',
      sort_order: 30,
      thumbnailSource: 'X-GAINER DOUBLE RICH CHOCOLATE.png'
    },
    products: [
      {
        name: 'X-GAINER',
        short_description: '800 KCAL • Over 61g Protein Per Serving • Digestive Enzyme Blend',
        description: 'X-GAINER is Island Nutrition\'s premium mass gainer delivering a massive 800 kcal and over 61g of protein per serving. Formulated with a digestive enzyme blend for smooth digestion and maximum nutrient uptake. Available in three rich flavours: Double Rich Chocolate, Strawberry & Raspberry, and Vanilla Pear. Swedish quality, Halal certified, 100% premium ingredients.',
        weight: '4000g',
        servings: '20',
        ingredients: 'Maltodextrin, Whey Protein Concentrate, Whey Protein Isolate, Micellar Casein, Oat Flour, Cocoa Powder (Dutch Process), Digestive Enzyme Blend (Amylase, Protease, Lipase), MCT Powder, Lecithin, Natural & Artificial Flavors, Sucralose.',
        usage_instructions: 'Mix 2 scoops (200g) with 500-700ml cold water or milk. Consume between meals or post-workout. For extreme mass gain, use milk instead of water.',
        is_featured: 1,
        specs: [
          { name: 'Calories per Serving', value: '800 kcal' },
          { name: 'Protein per Serving', value: 'Over 61 g' },
          { name: 'Digestive Enzymes', value: 'Included' },
          { name: 'Servings per Container', value: '20' },
          { name: 'Net Weight', value: '4000g' },
          { name: 'Made In', value: 'Sweden 🇸🇪' },
          { name: 'Certification', value: 'Halal Certified' }
        ],
        flavors: [
          { name: 'Double Rich Chocolate', color: '#451a03', image: 'X-GAINER DOUBLE RICH CHOCOLATE.png' },
          { name: 'Strawberry & Raspberry', color: '#e11d48', image: 'X-GAINER STRAWBERRY&RASPBERRY.png' },
          { name: 'Vanilla Pear', color: '#d4d68c', image: 'X-GAINER VANILLA PEAR.png' }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 4: Creatine (2 distinct products: Flavored 360g & Unflavored 500g)
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Creatine',
      description: 'Micronized Creatine Monohydrate 200 Mesh — ultra-fine, fast-dissolving creatine formulas for explosive strength, power output, and muscle cell volumization.',
      sort_order: 40,
      thumbnailSource: 'CREATINE ORANGE.png'
    },
    products: [
      {
        name: 'Creatine Monohydrate 200 Mesh',
        short_description: 'Micronized Creatine Monohydrate • 60 Servings • 360g • Ultra-Fine 200 Mesh',
        description: 'Island Nutrition\'s Creatine Monohydrate features a 200 Mesh ultra-fine grade for superior solubility and absorption. Delivers 5,000 mg pure creatine monohydrate per serving to replenish cellular ATP, enhance explosive strength, and support muscle cell volumization. Halal certified and 100% premium quality. Available in Orange and Watermelon flavours.',
        weight: '360g',
        servings: '60',
        ingredients: '100% Micronized Creatine Monohydrate (200 Mesh), Citric Acid, Natural & Artificial Flavors, Sucralose.',
        usage_instructions: 'Mix 1 scoop (6g providing 5g creatine) with 200-300ml cold water. Take daily, preferably post-workout or with a meal. No loading phase required.',
        is_featured: 1,
        specs: [
          { name: 'Creatine Monohydrate', value: '5,000 mg per serving' },
          { name: 'Mesh Grade', value: '200 Mesh Ultra-Fine' },
          { name: 'Servings', value: '60' },
          { name: 'Net Weight', value: '360g' },
          { name: 'Certification', value: 'Halal Certified' },
          { name: 'Quality', value: '100% Premium' }
        ],
        flavors: [
          { name: 'Orange', color: '#f97316', image: 'CREATINE ORANGE.png' },
          { name: 'Watermelon', color: '#ef4444', image: 'CREATINE WATERMELON.png' }
        ]
      },
      {
        name: 'Creatine Monohydrate Mesh 200 (Unflavoured)',
        short_description: 'Micronized Creatine Monohydrate with Taurine & Vitamin B6 • 96 Servings • 500g',
        description: 'Pure micronized Creatine Monohydrate (Mesh 200) synergistically enhanced with Taurine and Vitamin B6 for optimal cellular uptake, hydration, and energy metabolism. Provides an incredible 96 servings in a 500g tub. Unflavoured for easy stacking with pre-workout or protein shakes. 100% Premium Quality, Halal Certified.',
        weight: '500g',
        servings: '96',
        ingredients: 'Micronized Creatine Monohydrate (200 Mesh), Taurine, Vitamin B6 (Pyridoxine HCl).',
        usage_instructions: 'Mix 1 scoop (approx. 5.2g) with 200-300ml cold water, juice, or your post-workout protein shake. Consume daily. No loading phase required.',
        is_featured: 1,
        is_new: 1,
        badge_text: 'NEW',
        specs: [
          { name: 'Creatine Monohydrate', value: '5,000 mg per serving' },
          { name: 'Active Formula', value: 'Taurine & Vitamin B6 Enhanced' },
          { name: 'Mesh Grade', value: '200 Mesh Ultra-Fine' },
          { name: 'Servings', value: '96' },
          { name: 'Net Weight', value: '500g' },
          { name: 'Flavour', value: 'Unflavoured' },
          { name: 'Certification', value: 'Halal Certified' },
          { name: 'Quality', value: '100% Premium' }
        ],
        flavors: [
          { name: 'Unflavoured', color: '#e2e8f0', image: 'CREATINE UNFLAVOURED.png' }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 5: Amino Acids (AMINO ELECTROLYTES EAA & BCAA)
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Amino Acids',
      description: 'Complete essential amino acid and electrolyte formulas for intra-workout endurance, rapid recovery, and optimal muscle hydration.',
      sort_order: 50,
      thumbnailSource: 'AMINO.png'
    },
    products: [
      {
        name: 'Amino Electrolytes EAA & BCAA',
        short_description: 'Complete EAA & BCAA Formula with Electrolyte Complex • Pineapple • 23 Servings • 400g',
        description: 'Island Nutrition\'s Amino Electrolytes combines a complete spectrum of Essential Amino Acids (EAAs) and Branched-Chain Amino Acids (BCAAs) with key hydration electrolytes. Engineered to fuel intra-workout endurance, prevent muscle breakdown, accelerate recovery, and maintain optimal cellular hydration. Refreshing Pineapple flavour. Made in Sweden, Halal suitable.',
        weight: '400g',
        servings: '23',
        ingredients: 'EAA & BCAA Matrix (L-Leucine, L-Isoleucine, L-Valine, L-Lysine, L-Threonine, L-Phenylalanine, L-Methionine, L-Histidine, L-Tryptophan), Electrolyte Complex (Sodium Chloride, Potassium Citrate, Magnesium Bisglycinate, Calcium Citrate), Citric Acid, Natural Pineapple Flavour, Sucralose, Sunflower Lecithin.',
        usage_instructions: 'Mix 1 scoop (approx. 17.4g) with 400-500ml cold water. Consume during or immediately after training for optimal recovery and hydration.',
        is_featured: 1,
        is_new: 1,
        badge_text: 'NEW',
        specs: [
          { name: 'EAA & BCAA Matrix', value: 'Full Spectrum Essential Amino Acids' },
          { name: 'Electrolytes', value: 'Sodium, Potassium, Magnesium, Calcium' },
          { name: 'Flavour', value: 'Pineapple' },
          { name: 'Servings', value: '23' },
          { name: 'Net Weight', value: '400g' },
          { name: 'Sugar Free', value: 'Yes' },
          { name: 'Quality', value: '100% Premium' },
          { name: 'Certification', value: 'Halal Suitable' }
        ],
        flavors: [
          { name: 'Pineapple', color: '#facc15', image: 'AMINO.png' }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 6: Weight Loss & Fat Burners
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Weight Loss',
      description: 'Thermogenic fat-burning formulas, L-Carnitine blends, and metabolic rate activators designed to maximize fat oxidation and support your cutting phase.',
      sort_order: 60,
      thumbnailSource: 'L-CARNITINE_SYNEPHRINE.png'
    },
    products: [
      {
        name: 'L-Carnitine + Synephrine',
        short_description: 'Dual-Action Thermogenic Formula — L-Carnitine & Synephrine • 60 Capsules',
        description: 'Island Nutrition\'s L-Carnitine + Synephrine combines dual active metabolic compounds to accelerate fat transport and thermogenesis. L-Carnitine transports long-chain fatty acids into mitochondria for clean energy production, while Synephrine HCl boosts resting metabolic rate and energy expenditure. 60 capsules.',
        weight: '',
        servings: '60 Capsules',
        ingredients: 'L-Carnitine L-Tartrate, Acetyl L-Carnitine, Synephrine HCl, Vitamin B6, BioPerine® Black Pepper Extract, Vegetable Cellulose Capsule.',
        usage_instructions: 'Take recommended dose 30 minutes before cardio or training. Can also be taken with meals for metabolic support throughout the day.',
        is_featured: 0,
        specs: [
          { name: 'Form', value: '60 Capsules / Kapslar' },
          { name: 'Formula', value: 'Dual Active Formula' },
          { name: 'L-Carnitine', value: 'Fatty Acid Oxidation Support' },
          { name: 'Synephrine', value: 'Thermogenic Metabolic Rate Activator' },
          { name: 'BioPerine®', value: 'Enhanced Bioavailability' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'L-CARNITINE_SYNEPHRINE.png'
      },
      {
        name: 'CLA',
        short_description: 'Conjugated Linoleic Acid — Body Composition & Lean Muscle Support • 90 Softgels',
        description: 'CLA (Conjugated Linoleic Acid) from Island Nutrition supports healthy body composition by promoting lean muscle retention while aiding fat metabolism. A stimulant-free staple supplement derived from pure safflower oil. 90 softgels.',
        weight: '',
        servings: '90 Softgels',
        ingredients: 'Conjugated Linoleic Acid (from Safflower Oil), Gelatin Softgel Capsule, Glycerin.',
        usage_instructions: 'Take 1-2 softgels with meals, 2-3 times daily. Best results with a balanced diet and regular exercise.',
        is_featured: 0,
        specs: [
          { name: 'Active', value: 'Conjugated Linoleic Acid' },
          { name: 'Form', value: '90 Softgels' },
          { name: 'Source', value: 'Pure Safflower Oil' },
          { name: 'Stimulant Free', value: 'Yes' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'CLA.png'
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 7: Vitamins & Minerals
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Vitamins & Minerals',
      description: 'Essential micronutrient supplements for overall health, immune support, bone strength, and optimal physiological function. Premium quality, lab tested.',
      sort_order: 70,
      thumbnailSource: 'VITAMIN C.png'
    },
    products: [
      {
        name: 'Vitamin C',
        short_description: 'Essential Antioxidant & High-Potency Vitamin C • 60 Capsules',
        description: 'Island Nutrition\'s Vitamin C delivers high-potency ascorbic acid for robust immune defense, cellular antioxidant protection, and collagen synthesis support. Essential for hard-training athletes. 60 capsules.',
        weight: '',
        servings: '60 Capsules',
        ingredients: 'Ascorbic Acid (Vitamin C), Microcrystalline Cellulose, Vegetable Cellulose Capsule, Magnesium Stearate.',
        usage_instructions: 'Take 1 capsule daily with food and water.',
        is_featured: 0,
        specs: [
          { name: 'Active', value: 'Vitamin C (Ascorbic Acid)' },
          { name: 'Form', value: '60 Capsules / Kapslar' },
          { name: 'Benefit', value: 'Essential Antioxidant & Immune Support' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'VITAMIN C.png'
      },
      {
        name: 'Vitamin D3 + K2',
        short_description: 'Daily Vitamin Formula with 5000 IU Vitamin D & Synergistic K2 • 60 Tablets',
        description: 'Island Nutrition\'s Vitamin D3 + K2 provides a clinical 5000 IU dose of Vitamin D3 combined with Vitamin K2 (MK-7) to optimize calcium metabolism, strengthen bone density, and support immune and cardiovascular health. 60 tablets.',
        weight: '',
        servings: '60 Tablets',
        ingredients: 'Cholecalciferol (Vitamin D3), Menaquinone-7 (Vitamin K2 as MK-7), Microcrystalline Cellulose, Tablet Coating, Magnesium Stearate.',
        usage_instructions: 'Take 1 tablet daily with a meal for optimal absorption.',
        is_featured: 0,
        specs: [
          { name: 'Vitamin D3', value: '5000 IU' },
          { name: 'Vitamin K2', value: 'MK-7 Synergistic Form' },
          { name: 'Form', value: '60 Tablets / Tabletter' },
          { name: 'Support', value: 'Bone Density, Immune & Cardiovascular' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'VITAMIN D3_K2.png'
      },
      {
        name: 'B-Complex',
        short_description: 'Full Spectrum B-Vitamins for Cellular Energy & Nervous System • 60 Capsules',
        description: 'Island Nutrition\'s B-Complex delivers a comprehensive, full-spectrum profile of essential B-vitamins to drive cellular energy metabolism, support neurological health, and reduce fatigue. 60 capsules.',
        weight: '',
        servings: '60 Capsules',
        ingredients: 'Thiamine (B1), Riboflavin (B2), Niacin (B3), Pantothenic Acid (B5), Pyridoxine (B6), Biotin (B7), Folate (B9 as Methylfolate), Methylcobalamin (B12), Vegetable Cellulose Capsule.',
        usage_instructions: 'Take 1 capsule daily with food.',
        is_featured: 0,
        specs: [
          { name: 'Profile', value: 'Full Spectrum B-Vitamins (B1-B12)' },
          { name: 'Form', value: '60 Capsules / Kapslar' },
          { name: 'Function', value: 'Energy Metabolism & Nervous System' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'B-COMPLEX.png'
      },
      {
        name: 'Magnesium X4',
        short_description: 'Four Bioavailable Forms of Magnesium for Muscle & Nerve Support • 60 Capsules',
        description: 'Magnesium X4 combines four highly bioavailable forms of magnesium (Bisglycinate, Taurate, Malate, and Citrate) for optimal absorption. Promotes neuromuscular relaxation, reduces muscle cramping, and enhances recovery and sleep quality. 60 capsules.',
        weight: '',
        servings: '60 Capsules',
        ingredients: 'Magnesium Bisglycinate, Magnesium Taurate, Magnesium Malate, Magnesium Citrate, Vegetable Cellulose Capsule.',
        usage_instructions: 'Take 2 capsules daily, preferably in the evening with food.',
        is_featured: 0,
        specs: [
          { name: 'Magnesium Forms', value: 'Four Forms (Bisglycinate, Taurate, Malate, Citrate)' },
          { name: 'Form', value: '60 Capsules / Kapslar' },
          { name: 'Benefits', value: 'Muscle Function, Nerve Support & Recovery' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'MAGNESIUM X4.png'
      },
      {
        name: 'MULTIWELL',
        short_description: 'Complete Vitamins + Minerals Formula for Active Lifestyles • 90 Tablets',
        description: 'MULTIWELL is Island Nutrition\'s comprehensive daily multi-nutrient formula delivering an essential matrix of vitamins and chelated minerals to maintain vitality, optimize physiological performance, and support overall health. 90 tablets.',
        weight: '',
        servings: '90 Tablets',
        ingredients: 'Vitamin A, C, D3, E, K2, B-Complex, Zinc Bisglycinate, Magnesium, Selenium, Chromium, Iron, CoQ10, BioPerine®, Microcrystalline Cellulose, Tablet Coating, Magnesium Stearate.',
        usage_instructions: 'Take 1 tablet daily with a meal.',
        is_featured: 0,
        specs: [
          { name: 'Composition', value: 'Vitamins + Minerals Complete Spectrum' },
          { name: 'Form', value: '90 Tablets / Tabletter' },
          { name: 'Target', value: 'Daily Health, Immune & Vitality Support' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'MULTIWELL.png'
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 8: Testosterone & Performance
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Testo & Performance',
      description: 'Natural testosterone optimization, hormonal balance, and male performance support formulas with clinically studied herbal extracts and essential minerals.',
      sort_order: 80,
      thumbnailSource: 'TESTO POWER.png'
    },
    products: [
      {
        name: 'TESTO POWER',
        short_description: 'Zinc + Botanical Complex for Natural Testosterone & Vitality • 120 Capsules',
        description: 'TESTO POWER is Island Nutrition\'s advanced male performance formula featuring Zinc paired with an evidence-based botanical complex. Designed to support optimal testosterone synthesis, vitality, strength progression, and athletic drive. 120 capsules.',
        weight: '',
        servings: '120 Capsules',
        ingredients: 'Ashwagandha Root Extract (KSM-66®), Fenugreek Seed Extract, Tribulus Terrestris, Zinc Bisglycinate, Boron Citrate, Vitamin D3, Magnesium, BioPerine®, Vegetable Cellulose Capsule.',
        usage_instructions: 'Take the recommended dose daily with a meal. Best taken with breakfast or 30-45 minutes before training.',
        is_featured: 0,
        specs: [
          { name: 'Formula', value: 'Zinc + Botanical Complex' },
          { name: 'Form', value: '120 Capsules / Kapslar' },
          { name: 'Benefits', value: 'Testosterone Support, Vitality & Strength' },
          { name: 'Zinc Source', value: 'Bisglycinate Chelate' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'TESTO POWER.png'
      },
      {
        name: 'ZMA',
        short_description: 'Zinc • Magnesium • B6 Synergy for Sleep & Recovery • 90 Capsules',
        description: 'Island Nutrition\'s ZMA unites highly bioavailable Zinc, Magnesium, and Vitamin B6 to optimize night-time hormonal balance, facilitate restorative deep sleep, and accelerate muscle tissue recovery. 90 capsules.',
        weight: '',
        servings: '90 Capsules',
        ingredients: 'Zinc Monomethionine Aspartate, Magnesium Aspartate, Pyridoxine HCl (Vitamin B6), Vegetable Cellulose Capsule.',
        usage_instructions: 'Take 2-3 capsules 30-60 minutes before bedtime on an empty stomach.',
        is_featured: 0,
        specs: [
          { name: 'Synergy', value: 'Zinc • Magnesium • B6' },
          { name: 'Form', value: '90 Capsules / Kapslar' },
          { name: 'Timing', value: 'Bedtime Recovery & Sleep Optimization' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'ZMA.png'
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 9: Joint & Recovery
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Joint & Recovery',
      description: 'Joint support complexes and collagen formulas to protect connective tissue, reduce joint discomfort, and accelerate recovery from intense training.',
      sort_order: 90,
      thumbnailSource: 'JOINT COMPLEX.png'
    },
    products: [
      {
        name: 'Joint Complex',
        short_description: 'Collagen • MSM • Glucosamine Matrix for Joint & Cartilage Health • 90 Capsules',
        description: 'Joint Complex is Island Nutrition\'s premium triple-action formula featuring Collagen, MSM, and Glucosamine to maintain joint cartilage integrity, improve connective tissue resilience, and alleviate exercise-induced joint stiffness. 90 capsules.',
        weight: '',
        servings: '90 Capsules',
        ingredients: 'Glucosamine Sulfate, Chondroitin Sulfate, MSM (Methylsulfonylmethane), Collagen, Hyaluronic Acid, Turmeric Extract (Curcumin), Boswellia Extract, Vitamin C, Manganese, Vegetable Cellulose Capsule.',
        usage_instructions: 'Take 2-3 capsules daily with food. Allow 4-6 weeks for optimal joint support benefits.',
        is_featured: 0,
        specs: [
          { name: 'Key Actives', value: 'Collagen • MSM • Glucosamine' },
          { name: 'Form', value: '90 Capsules / Kapslar' },
          { name: 'Function', value: 'Cartilage Integrity, Joint Flexibility & Comfort' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'JOINT COMPLEX.png'
      },
      {
        name: 'Collagen+',
        short_description: 'Collagen+ with MSM, Sodium Hyaluronate & Q10 • Mango • 27 Servings • 300g',
        description: 'Island Nutrition\'s COLLAGEN+ combines premium hydrolyzed collagen peptides with MSM, Sodium Hyaluronate (Hyaluronic Acid), and Coenzyme Q10 for comprehensive joint, skin, tendon, and cellular vitality support. Refreshing Mango flavour in a 300g powder tub. 27 servings.',
        weight: '300g',
        servings: '27',
        ingredients: 'Hydrolyzed Collagen Peptides, MSM (Methylsulfonylmethane), Sodium Hyaluronate, Coenzyme Q10, Citric Acid, Natural Mango Flavour, Sucralose, Beta-Carotene.',
        usage_instructions: 'Mix 1 scoop (approx. 11g) with 250-300ml cold water once daily, preferably in the morning or post-workout.',
        is_featured: 0,
        is_new: 1,
        badge_text: 'NEW',
        specs: [
          { name: 'Actives', value: 'MSM | Sodium Hyaluronate | Q10' },
          { name: 'Flavour', value: 'Mango' },
          { name: 'Servings', value: '27' },
          { name: 'Net Weight', value: '300g' },
          { name: 'Collagen Form', value: 'Hydrolyzed Bioactive Peptides' },
          { name: 'Quality', value: '100% Premium' }
        ],
        flavors: [
          { name: 'Mango', color: '#fb923c', image: 'COLLAGEN.png' }
        ]
      }
    ]
  },

  // ──────────────────────────────────────────────────────────
  // CATEGORY 10: Health & Wellness
  // ──────────────────────────────────────────────────────────
  {
    category: {
      name: 'Health & Wellness',
      description: 'Adaptogenic herbs, nootropics, and specialty supplements for stress management, cognitive function, sleep quality, and overall well-being.',
      sort_order: 100,
      thumbnailSource: 'ASHWAGANDHA.png'
    },
    products: [
      {
        name: 'Ashwagandha',
        short_description: 'Withania Somnifera Adaptogen for Cortisol Balance & Stress Relief • 60 Capsules',
        description: 'Island Nutrition\'s Ashwagandha delivers pure Withania Somnifera root extract, an ancient adaptogen clinically revered for lowering cortisol levels, calming the nervous system, enhancing resilience to stress, and promoting physical recovery. 60 capsules.',
        weight: '',
        servings: '60 Capsules',
        ingredients: 'Withania Somnifera Root Extract, Vegetable Cellulose Capsule, Rice Flour.',
        usage_instructions: 'Take 1-2 capsules daily with food. Can be taken morning or evening.',
        is_featured: 0,
        specs: [
          { name: 'Botanical', value: 'Withania Somnifera Root Extract' },
          { name: 'Form', value: '60 Capsules / Kapslar' },
          { name: 'Function', value: 'Adaptogen, Cortisol Balance & Recovery' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'ASHWAGANDHA.png'
      },
      {
        name: 'GABA + L-Theanine',
        short_description: 'Dual Amino Acid Formula for Deep Relaxation & Calm Focus • 60 Capsules',
        description: 'A synergistic calming nootropic blend of Gamma-Aminobutyric Acid (GABA) and L-Theanine. Supports inhibitory neurotransmitter pathways to quiet mental chatter, promote alpha brainwave state, and improve sleep onset and depth. 60 capsules.',
        weight: '',
        servings: '60 Capsules',
        ingredients: 'Gamma-Aminobutyric Acid (GABA), L-Theanine, Vegetable Cellulose Capsule, Magnesium Stearate.',
        usage_instructions: 'Take 1-2 capsules 30-60 minutes before bedtime, or during the day for calm focus.',
        is_featured: 0,
        specs: [
          { name: 'Formula', value: 'Dual Amino Acid Formula (GABA + L-Theanine)' },
          { name: 'Form', value: '60 Capsules / Kapslar' },
          { name: 'Support', value: 'Relaxation, Calm Mental Clarity & Sleep Quality' },
          { name: 'Quality', value: '100% Premium' }
        ],
        image: 'GABA_L-THEANINE.png'
      },
      {
        name: 'Arginine (L-Arginine HCl)',
        short_description: 'L-Arginine HCl Nitric Oxide Precursor • Lemon • 37 Servings • 300g',
        description: 'Island Nutrition\'s ARGININE delivers ultra-pure L-Arginine HCl, a direct precursor to nitric oxide synthesis. Enhances endothelial vasodilation, increases vascular blood flow to working muscle tissue, and delivers intense muscular pumps and vascularity. Delicious Lemon flavour in a 300g tub. 37 servings.',
        weight: '300g',
        servings: '37',
        ingredients: 'L-Arginine HCl, Citric Acid, Natural Lemon Flavour, Malic Acid, Sucralose, Curcumin Extract (Color).',
        usage_instructions: 'Mix 1 scoop (approx. 8.1g) with 250-350ml cold water 20-30 minutes before physical training.',
        is_featured: 0,
        is_new: 1,
        badge_text: 'NEW',
        specs: [
          { name: 'Active', value: 'L-Arginine HCl' },
          { name: 'Flavour', value: 'Lemon' },
          { name: 'Servings', value: '37' },
          { name: 'Net Weight', value: '300g' },
          { name: 'Function', value: 'Nitric Oxide Precursor & Vascular Pumps' },
          { name: 'Quality', value: '100% Premium' }
        ],
        flavors: [
          { name: 'Lemon', color: '#eab308', image: 'ARGININE.png' }
        ]
      }
    ]
  }
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function seedInitialData(db) {
  const forceReseed = process.argv.includes('--reseed');
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (existingCount > 0 && !forceReseed) {
    console.log(`  ✓ Database already initialized (${existingCount} categories present).`);
    return;
  }
  if (existingCount > 0 && forceReseed) {
    console.log(`ℹ Force re-seeding database (--reseed specified)...`);

    // Clean up old upload files
    const oldImages = db.prepare('SELECT image_path FROM product_images').all();
    oldImages.forEach(img => {
      if (img.image_path) {
        const filePath = path.join(__dirname, img.image_path);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
    });
    const oldCatImages = db.prepare('SELECT image FROM categories WHERE image IS NOT NULL').all();
    oldCatImages.forEach(cat => {
      if (cat.image) {
        const filePath = path.join(__dirname, cat.image);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
    });

    // Delete all existing data
    db.exec('DELETE FROM product_images;');
    db.exec('DELETE FROM product_specs;');
    db.exec('DELETE FROM product_flavors;');
    db.exec('DELETE FROM products;');
    db.exec('DELETE FROM categories;');
    console.log('  ✓ Old data cleared');
  }

  console.log('');
  console.log('🏝️  Seeding Island Nutrition product catalog...');
  console.log('━'.repeat(55));

  let totalProducts = 0;
  let totalImages = 0;

  for (const entry of catalog) {
    const cat = entry.category;
    const catSlug = slugify(cat.name);

    console.log(`\n📦 Category: ${cat.name}`);

    // Generate category thumbnail
    const catImage = await generateCategoryThumbnail(cat.thumbnailSource, catSlug);

    // Insert category
    const catResult = db.prepare(`
      INSERT INTO categories (name, slug, image, description, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(cat.name, catSlug, catImage, cat.description, cat.sort_order);
    const categoryId = catResult.lastInsertRowid;

    // Insert products
    for (let pi = 0; pi < entry.products.length; pi++) {
      const p = entry.products[pi];
      const prodSlug = slugify(p.name);

      const prodResult = db.prepare(`
        INSERT INTO products (
          name, slug, category_id, description, short_description,
          weight, servings, ingredients, usage_instructions, sort_order, is_featured, is_new, badge_text, badge_color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.name, prodSlug, categoryId, p.description, p.short_description,
        p.weight || '', p.servings || '', p.ingredients || '', p.usage_instructions || '',
        (cat.sort_order + pi), p.is_featured || 0, p.is_new ? 1 : 0, p.badge_text || null, p.badge_color || null
      );

      const productId = prodResult.lastInsertRowid;
      totalProducts++;

      // Process images: either from flavors or single product image
      const insertImage = db.prepare(`
        INSERT INTO product_images (product_id, image_path, is_primary, sort_order)
        VALUES (?, ?, ?, ?)
      `);

      if (p.flavors && p.flavors.length > 0) {
        for (let fi = 0; fi < p.flavors.length; fi++) {
          const flavor = p.flavors[fi];
          const imagePath = await processProductImage(flavor.image);
          if (imagePath) {
            insertImage.run(productId, imagePath, fi === 0 ? 1 : 0, fi);
            totalImages++;
          }
        }
      } else if (p.image) {
        const imagePath = await processProductImage(p.image);
        if (imagePath) {
          insertImage.run(productId, imagePath, 1, 0);
          totalImages++;
        }
      }

      // Insert specs
      if (p.specs) {
        const insertSpec = db.prepare(`
          INSERT INTO product_specs (product_id, spec_name, spec_value, sort_order)
          VALUES (?, ?, ?, ?)
        `);
        p.specs.forEach((spec, idx) => {
          insertSpec.run(productId, spec.name, spec.value, idx);
        });
      }

      // Insert flavors (only for products that actually have flavors)
      if (p.flavors && p.flavors.length > 0) {
        const insertFlavor = db.prepare(`
          INSERT INTO product_flavors (product_id, flavor_name, color_code)
          VALUES (?, ?, ?)
        `);
        p.flavors.forEach(flavor => {
          insertFlavor.run(productId, flavor.name, flavor.color);
        });
      }
    }
  }

  console.log('');
  console.log('━'.repeat(55));
  console.log(`✅ Seeded ${catalog.length} categories, ${totalProducts} products, ${totalImages} optimized images!`);
  console.log('');
}

module.exports = { seedInitialData };
