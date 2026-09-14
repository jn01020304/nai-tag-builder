const novelaiApi = (() => {
const ENDPOINT = "https://image.novelai.net/ai/generate-image";
const TOKEN_KEY = "nai-tag-lab.novelaiToken";
const MODEL_IDS = Object.freeze({
  "V5 Full": "nai-diffusion-5-full", "V5 Curated": "nai-diffusion-5-curated",
  "V4.5 Full": "nai-diffusion-4-5-full", "V4.5 Curated": "nai-diffusion-4-5-curated",
  "V4 Full": "nai-diffusion-4-full", "V4 Curated": "nai-diffusion-4-curated-preview"
});
const SAMPLER_IDS = Object.freeze({
  "Euler Ancestral": "k_euler_ancestral", "Euler": "k_euler", "DPM++ 2S Ancestral": "k_dpmpp_2s_ancestral",
  "DPM++ 2M": "k_dpmpp_2m", "DDIM": "ddim_v3"
});
function readToken(storage = globalThis.localStorage) {
  try { return String(storage?.getItem(TOKEN_KEY) || "").trim(); }
  catch { return ""; }
}
function writeToken(token, storage = globalThis.localStorage) {
  const value = String(token || "").trim();
  try { value ? storage.setItem(TOKEN_KEY, value) : storage.removeItem(TOKEN_KEY); }
  catch {}
  return value;
}
function unsupportedInputs(payload) {
  const names = [];
  if (payload.baseImage?.active) names.push("Base Image");
  if (payload.vibeTransfer?.some(item => item.active)) names.push("Vibe Transfer");
  if (payload.preciseReferences?.some(item => item.active)) names.push("Precise Reference");
  return names;
}
function characterCenter(character) {
  const manual = character.position?.mode === "manual" && Number.isFinite(Number(character.position.x)) && Number.isFinite(Number(character.position.y));
  return { manual, center: manual ? { x: Number(character.position.x), y: Number(character.position.y) } : { x: .5, y: .5 } };
}
const TRANSPARENT_TAG = "transparent background";
function withTransparentTag(prompt) {
  const tags = String(prompt || "").split(",").map(tag => tag.trim().toLowerCase());
  if (tags.some(tag => tag === TRANSPARENT_TAG || tag === "has alpha" || tag === "alpha transparency")) return prompt;
  return prompt && prompt.trim() ? `${prompt}, ${TRANSPARENT_TAG}` : TRANSPARENT_TAG;
}
function buildRequest(payload) {
  const model = MODEL_IDS[payload.model];
  if (!model) throw new Error(`API 모델 ID가 없는 Model입니다: ${payload.model}`);
  const unsupported = unsupportedInputs(payload);
  if (unsupported.length) throw new Error(`${unsupported.join(", ")}는 아직 실제 생성에서 지원하지 않습니다.`);
  // UI를 거치지 않은 payload도 유료 요청으로 새지 않게 막는다
  if (!(Number(payload.steps) >= 1 && Number(payload.steps) <= 28)) throw new Error(`Steps ${payload.steps}는 무료 범위(1~28)를 벗어납니다.`);
  const v5 = model.startsWith("nai-diffusion-5");
  // V5는 프롬프트 태그로 알파 채널을 켠다 (NovelAI V5 공지 기준)
  const transparent = v5 && !!payload.transparentBackground;
  const prompt = transparent ? withTransparentTag(payload.prompt) : payload.prompt;
  const width = Number(payload.resolution?.width), height = Number(payload.resolution?.height);
  if (!(width > 0 && height > 0 && width * height <= 1024 * 1024)) throw new Error(`해상도 ${width}×${height}는 무료 넓이(1024×1024)를 넘습니다.`);
  // 빈 캐릭터 칸은 빈 char_caption으로 보내지 않는다
  const characters = (payload.characters || []).filter(character => character.enabled && character.modelAllowed && String(character.prompt || "").trim()).map(character => ({ ...character, ...characterCenter(character) }));
  const useCoords = characters.some(character => character.manual);
  const parameters = {
    // V5 params_version 4는 NAIWeaver 기준. 서버가 받아주지만 PNG metadata에는 기록되지 않는다
    params_version: v5 ? 4 : 3,
    width, height,
    scale: Number(payload.guidance),
    sampler: SAMPLER_IDS[payload.sampler] || "k_euler_ancestral",
    steps: Number(payload.steps),
    n_samples: 1,
    seed: Number(payload.seed),
    // 품질 태그와 UC 프리셋은 buildNovelAIPayload에서 이미 문자열에 합쳐져 있다
    qualityToggle: false,
    cfg_rescale: Number(payload.rescale),
    noise_schedule: v5 ? "karras" : payload.noiseSchedule,
    // Variety+: 832×1216 기준 58 (V5 실제 생성 metadata로 확인)
    skip_cfg_above_sigma: payload.variety ? 58 * Math.sqrt(width * height / (832 * 1216)) : null,
    dynamic_thresholding: false,
    controlnet_strength: 1,
    legacy: false,
    legacy_v3_extend: false,
    add_original_image: true,
    prefer_brownian: true,
    deliberate_euler_ancestral_bug: false,
    image_format: "png",
    negative_prompt: payload.undesiredContent,
    v4_prompt: {
      caption: { base_caption: prompt, char_captions: characters.map(character => ({ char_caption: character.prompt, centers: [character.center] })) },
      use_coords: useCoords,
      use_order: true
    },
    v4_negative_prompt: {
      caption: { base_caption: payload.undesiredContent, char_captions: characters.map(character => ({ char_caption: character.undesired, centers: [character.center] })) },
      legacy_uc: false
    }
  };
  if (transparent) Object.assign(parameters, { tag_hint_transparent_background: true, straight_alpha: true });
  return { input: prompt, model, action: "generate", parameters };
}
async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("이 브라우저는 zip 압축 해제를 지원하지 않습니다.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// zip 중앙 디렉터리에서 첫 PNG 항목만 꺼낸다
async function extractFirstPng(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("응답이 zip 형식이 아닙니다.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true), extraLength = view.getUint16(at + 30, true), commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (!/\.png$/i.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + size);
    if (method === 0) return { name, bytes: data.slice() };
    if (method === 8) return { name, bytes: await inflateRaw(data) };
    throw new Error(`지원하지 않는 zip 압축 방식입니다: ${method}`);
  }
  throw new Error("응답 zip에 PNG가 없습니다.");
}
async function errorMessage(response) {
  let detail = "";
  try { detail = (await response.json())?.message || ""; } catch {}
  if (response.status === 401) return "NovelAI 토큰이 올바르지 않습니다.";
  if (response.status === 402) return "Anlas가 부족하거나 구독이 필요합니다.";
  if (response.status === 429) return "요청이 너무 많습니다. 잠시 후 다시 시도하세요.";
  return `NovelAI 오류 ${response.status}${detail ? `: ${detail}` : ""}`;
}
async function generateImage(payload, { token = readToken(), signal, fetchImpl = globalThis.fetch } = {}) {
  if (!token) throw new Error("사용자 설정에서 NovelAI 토큰을 먼저 입력하세요.");
  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(buildRequest(payload)),
    signal
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const png = await extractFirstPng(await response.arrayBuffer());
  const blob = new Blob([png.bytes], { type: "image/png" });
  return { blob, fileName: `nai-${payload.seed}.png` };
}
// Anlas는 API에서 trainingSteps(고정+구매) 이름으로 온다. usage는 V5 사용 한도
async function fetchAccountStatus({ token = readToken(), signal, fetchImpl = globalThis.fetch } = {}) {
  if (!token) throw new Error("사용자 설정에서 NovelAI 토큰을 먼저 입력하세요.");
  const response = await fetchImpl("https://image.novelai.net/user/subscription", { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error(await errorMessage(response));
  const data = await response.json();
  const steps = data?.trainingStepsLeft || {};
  const anlas = Number(steps.fixedTrainingStepsLeft) + Number(steps.purchasedTrainingSteps);
  const usage = data?.usage;
  return {
    tier: Number(data?.tier),
    active: !!data?.active,
    anlas: Number.isFinite(anlas) ? anlas : null,
    // TODO: percent가 남은 양인지 쓴 양인지 실제 계정 값으로 확인 필요 (NAIWeaver는 남은 양으로 표시)
    allowance: usage && Number.isFinite(Number(usage.percent))
      ? { percent: Number(usage.percent), available: !usage.isNegative, secondsToNextPercent: Number(usage.timeUntilNextPercent) || 0 }
      : null
  };
}
return Object.freeze({ MODEL_IDS, readToken, writeToken, buildRequest, extractFirstPng, generateImage, fetchAccountStatus });
})();
