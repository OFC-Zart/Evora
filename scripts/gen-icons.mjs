// Gera os ícones do app e as camadas da animação de abertura a partir do logo
// (data/brand/evora-logo-v2.png, 1254×1254, quadrado arredondado com borda
// vermelha e cantos pretos). Uso: npm run icons
//   - icon-192/512.png      cantos transparentes (Chrome, instalação, favicon)
//   - maskable-512.png      fundo cheio com respiro (Android recorta)
//   - app/apple-icon.png    fundo cheio, sem transparência (o iOS arredonda)
//   - badge-96.png          silhueta branca das montanhas (barra de notificação)
//   - public/brand/*.png    montanha, trilha e marca recortadas (abertura)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const P = (p) => new URL(`../${p}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = P("data/brand/evora-logo-v2.png");
const BG = { r: 0, g: 0, b: 0, alpha: 1 };
const RAIO = 0.235; // mesmo raio do quadrado do logo (a borda vermelha fica inteira)

mkdirSync(P("public/icons"), { recursive: true });
mkdirSync(P("public/brand"), { recursive: true });

const meta = await sharp(SRC).metadata();
const lado = Math.min(meta.width, meta.height);
const quadrado = await sharp(SRC).extract({ left: 0, top: 0, width: lado, height: lado }).png().toBuffer();

const mascara = (s, r) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${Math.round(s * r)}" ry="${Math.round(s * r)}" fill="#fff"/></svg>`);

const arredondado = await sharp(quadrado).ensureAlpha().composite([{ input: mascara(lado, RAIO), blend: "dest-in" }]).png().toBuffer();
const cheio = await sharp(quadrado).flatten({ background: BG }).png().toBuffer();

const salvar = async (buf, size, path, opts = {}) => {
  let img = sharp(buf).resize(size, size, { kernel: "lanczos3" });
  if (opts.flatten) img = img.flatten({ background: BG });
  await img.png({ compressionLevel: 9 }).toFile(P(path));
  console.log("✓", path);
};

await salvar(arredondado, 512, "public/icons/icon-512.png");
await salvar(arredondado, 192, "public/icons/icon-192.png");
await salvar(arredondado, 64, "app/icon.png");
// iOS arredonda sozinho: recorta um pouco por dentro para a borda vermelha não sumir no canto
const inset = Math.round(lado * 0.035);
const apple = await sharp(quadrado).extract({ left: inset, top: inset, width: lado - inset * 2, height: lado - inset * 2 }).png().toBuffer();
await salvar(apple, 180, "app/apple-icon.png", { flatten: true });

// maskable: logo em 84% do quadro, sobre preto
const lm = 430;
const interno = await sharp(arredondado).resize(lm, lm, { kernel: "lanczos3" }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: interno, left: (512 - lm) / 2, top: (512 - lm) / 2 }])
  .flatten({ background: BG })
  .png({ compressionLevel: 9 })
  .toFile(P("public/icons/maskable-512.png"));
console.log("✓ public/icons/maskable-512.png");

// ---- camadas recortadas (alfa calculado pela cor) ----
const { data, info } = await sharp(quadrado).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
// branco: os três canais altos; vermelho: R bem acima de G e B; linhas cinza do fundo somem
const alfaBranco = (r, g, b) => clamp((Math.min(r, g, b) - 110) * 2.2);
const alfaVermelho = (r, g, b) => clamp((r - Math.max(g, b) - 50) * 2);

async function camada(regiao, fn, cor, path) {
  const { left, top, width, height } = regiao;
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = ((top + y) * W + (left + x)) * 3;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const a = fn(r, g, b);
      const o = (y * width + x) * 4;
      if (cor === "original") {
        out[o] = r; out[o + 1] = g; out[o + 2] = b;
      } else {
        out[o] = cor[0]; out[o + 1] = cor[1]; out[o + 2] = cor[2];
      }
      out[o + 3] = a;
    }
  }
  await sharp(out, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(P(path));
  console.log("✓", path);
  return out;
}

// mesma caixa para montanha e trilha, para encaixarem uma sobre a outra
const caixaMontanha = { left: 180, top: 360, width: 920, height: 345 };
const caixaMarca = { left: 90, top: 715, width: 1085, height: 160 };
await camada(caixaMontanha, alfaBranco, [255, 255, 255], "public/brand/montanha.png");
await camada(caixaMontanha, alfaVermelho, "original", "public/brand/trilha.png");
await camada(caixaMarca, (r, g, b) => Math.max(alfaBranco(r, g, b), alfaVermelho(r, g, b)), "original", "public/brand/marca.png");

// badge: silhueta branca das montanhas
const montanha = await sharp(P("public/brand/montanha.png")).trim().png().toBuffer();
await sharp(montanha)
  .resize(84, 84, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 6, bottom: 6, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(P("public/icons/badge-96.png"));
console.log("✓ public/icons/badge-96.png");
