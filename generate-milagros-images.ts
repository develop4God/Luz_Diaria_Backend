// Script to generate all Milagros de Jesús card images via DALL-E 3
// Run with: bun run generate-milagros-images.ts
// Results are saved to generated-image-urls.json

import { writeFileSync } from 'fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const GLOBAL_STYLE = `Pixar Disney movie style, dramatic cinematic lighting, epic biblical composition, high detail, golden divine rays, volumetric light, rich textures, semi-cartoon realistic characters, film-quality atmosphere, vertical trading card portrait format, sacred and majestic mood`;

const CARDS: Array<{ id: string; prompt: string }> = [
  // COMUNES
  { id: 'agua_en_vino', prompt: `Jesus turning water into wine at the wedding of Cana. Glowing stone jars filled with red wine, amazed guests watching, servants pouring water. ${GLOBAL_STYLE}` },
  { id: 'pesca_milagrosa', prompt: `Fishermen pulling an overflowing fishing net from the sea, nets bursting with fish, Jesus watching calmly from the shore at sunrise, boats rocking in golden morning light. ${GLOBAL_STYLE}` },
  { id: 'sanidad_leproso', prompt: `Jesus gently touching and healing a leper, warm golden divine light spreading through the man's cleansing body, crowd watching in awe and wonder, emotional moment of compassion. ${GLOBAL_STYLE}` },
  { id: 'sanidad_paralitico', prompt: `Jesus healing a paralyzed man who was lowered through a rooftop by four friends, the man rising from his mat, divine golden light surrounding the moment, crowd packed below. ${GLOBAL_STYLE}` },
  { id: 'sanidad_centurion', prompt: `Roman centurion in armor kneeling before Jesus on a dusty road, humble and faithful, distant view of a servant being healed, dramatic warm lighting, Roman city in background. ${GLOBAL_STYLE}` },
  { id: 'sanidad_suegra_pedro', prompt: `Jesus lifting a feverish woman from her bed, holding her hand gently, golden healing light flowing through the room, Peter watching with gratitude, simple home setting. ${GLOBAL_STYLE}` },
  { id: 'mano_seca', prompt: `Man stretching out his fully healed hand in a synagogue, divine golden glow around his arm, Pharisees watching in shock, Jesus standing calm and authoritative. ${GLOBAL_STYLE}` },
  { id: 'diez_leprosos', prompt: `Ten healed men walking away along a road, radiant golden light surrounding their cleansed bodies, one man turning back to give thanks to Jesus in the distance. ${GLOBAL_STYLE}` },
  { id: 'sordomudo', prompt: `Jesus touching the ears and tongue of a man who suddenly hears and speaks for the first time, face filled with wonder and joy, heavenly light descending, crowd amazed. ${GLOBAL_STYLE}` },
  { id: 'ciego_betsaida', prompt: `Jesus placing his hands over a blind man's eyes outside the village, divine light illuminating the man's face as sight returns, peaceful countryside setting, emotional revelation. ${GLOBAL_STYLE}` },
  { id: 'multiplicacion_panes', prompt: `Jesus blessing five loaves of bread and two fish as baskets multiply endlessly in the crowd, five thousand people on a hillside receiving food, golden evening light. ${GLOBAL_STYLE}` },
  { id: 'moneda_pez', prompt: `Peter pulling a large fish from the sea beside Jesus, the fish's mouth open revealing a gleaming silver coin, sunrise over the water, miraculous and joyful. ${GLOBAL_STYLE}` },
  { id: 'calma_tormenta', prompt: `Jesus standing in a boat raising his hand, violent ocean waves suddenly falling still in an instant, disciples clinging to the mast in awe, dramatic stormy sky clearing above. ${GLOBAL_STYLE}` },
  { id: 'higuera_maldita', prompt: `A fig tree rapidly withering and drying from the roots up while disciples watch in shock, dusty road to Jerusalem in the background, Jesus walking ahead. ${GLOBAL_STYLE}` },
  { id: 'red_peces', prompt: `Boats nearly sinking under the miraculous weight of 153 fish, disciples straining to pull overflowing nets, early morning mist on a calm sea, the risen Jesus on the shore. ${GLOBAL_STYLE}` },
  { id: 'alimenta_4000', prompt: `Crowd of four thousand people receiving multiplied bread and fish under a golden sunset, seven baskets of leftovers, hillside setting, Jesus blessing the food. ${GLOBAL_STYLE}` },
  { id: 'liberacion_demonio', prompt: `Man freed from spiritual oppression in a synagogue, divine white light breaking through darkness surrounding him, Jesus commanding with authority, crowd stepping back in awe. ${GLOBAL_STYLE}` },
  { id: 'nina_resucitada', prompt: `Young girl rising from her bed as Jesus holds her hand gently, parents weeping tears of joy, warm golden light filling the room, tender and miraculous moment. ${GLOBAL_STYLE}` },
  // RARAS
  { id: 'caminar_agua', prompt: `Jesus walking calmly across stormy dark ocean waves at night, Peter sinking into the water reaching out, disciples watching in awe from a boat, divine light surrounding Jesus. ${GLOBAL_STYLE}` },
  { id: 'ciego_nacimiento', prompt: `A blind man opening his eyes to light for the very first time, Jesus nearby, Pool of Siloam in the background, overwhelming joy and wonder, radiant divine light. ${GLOBAL_STYLE}` },
  { id: 'hijo_viuda_nain', prompt: `Young man rising alive from a funeral stretcher as Jesus touches it, widow weeping with joy, crowd in the road stunned, city of Nain behind, warm miraculous light. ${GLOBAL_STYLE}` },
  { id: 'endemoniado_gadareno', prompt: `Man freed from Legion demons beside a stormy cliffside shoreline, broken chains at his feet, a herd of pigs rushing into the sea below, Jesus standing in divine authority. ${GLOBAL_STYLE}` },
  { id: 'mujer_flujo', prompt: `Woman reaching through a crowd to touch the hem of Jesus' robe, divine energy flowing from it healing her instantly, Jesus turning to look at her with compassion. ${GLOBAL_STYLE}` },
  { id: 'jesus_desaparece', prompt: `Jesus passing unseen through an angry crowd at the edge of a cliff in Nazareth, crowd confused and parting, ethereal divine mist around Jesus, calm and supernatural. ${GLOBAL_STYLE}` },
  { id: 'tempestad_calmada', prompt: `Dramatic stormy sea instantly becoming a perfect mirror-calm lake as Jesus speaks, disciples in a boat frozen in awe and terror turned to wonder, night sky clearing. ${GLOBAL_STYLE}` },
  // ÉPICAS
  { id: 'resurreccion_lazaro', prompt: `Lazarus emerging from a stone tomb wrapped in burial cloths, radiant divine light pouring from the entrance, Mary and Martha weeping with joy, Jesus standing with hand raised, crowd witnessing. ${GLOBAL_STYLE}` },
  { id: 'transfiguracion', prompt: `Jesus transfigured on a mountain, his face shining like the sun, garments glowing brilliant white, Moses and Elijah appearing beside him, Peter James and John shielding their eyes below. ${GLOBAL_STYLE}` },
  { id: 'jesus_aparece_resucitado', prompt: `The risen Jesus appearing through locked doors to the disciples, showing his hands and side, radiant soft divine glow, disciples frozen in awe, expression of peace and victory. ${GLOBAL_STYLE}` },
  // LEGENDARIA
  { id: 'jesus_glorificado', prompt: `Jesus Christ in his full heavenly glory seated on a cosmic throne, radiant golden light emanating from him, crown of eternal majesty, stars and galaxies surrounding him, Alpha and Omega, supreme and majestic. ${GLOBAL_STYLE}` },
  // SECRETA
  { id: 'reino_de_dios', prompt: `The Kingdom of God represented as golden gates opening to eternal light, dove descending in radiant glory, crown floating in divine rays, paradise vision, sacred and transcendent. ${GLOBAL_STYLE}` },
];

async function generateImage(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1792', // Portrait ratio for trading cards
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DALL-E error: ${response.status} ${err}`);
  }

  const data = await response.json() as { data: Array<{ url: string }> };
  return data.data[0]!.url;
}

async function main() {
  console.log(`Generating ${CARDS.length} images for Milagros de Jesús...`);
  console.log('Using DALL-E 3 — standard quality, 1024x1792 portrait\n');

  const results: Record<string, string> = {};
  const failed: string[] = [];

  for (let i = 0; i < CARDS.length; i++) {
    const card = CARDS[i]!;
    console.log(`[${i + 1}/${CARDS.length}] Generating: ${card.id}...`);
    try {
      const url = await generateImage(card.prompt);
      results[card.id] = url;
      console.log(`  ✓ ${card.id}: ${url.substring(0, 60)}...`);
    } catch (err) {
      console.error(`  ✗ ${card.id}: ${err}`);
      failed.push(card.id);
    }
    // Small delay to avoid rate limits
    if (i < CARDS.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Generated: ${Object.keys(results).length}/${CARDS.length}`);
  if (failed.length > 0) console.log(`Failed: ${failed.join(', ')}`);

  writeFileSync(
    '/home/user/workspace/backend/generated-image-urls.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved to: backend/generated-image-urls.json');
}

main().catch(console.error);
