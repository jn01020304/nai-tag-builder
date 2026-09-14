import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import vm from "node:vm";

const source = readFileSync(new URL("../../mockup/shell-v18.5-nightly.novelai.js", import.meta.url), "utf8");
const context = vm.createContext({ Blob, Response, DecompressionStream, TextDecoder, Uint8Array, DataView });
vm.runInContext(source + ";globalThis.novelaiApi = novelaiApi;", context);
const api = context.novelaiApi;
const plain = value => JSON.parse(JSON.stringify(value));

const payload = {
  model: "V4.5 Full", prompt: "1girl, very aesthetic", undesiredContent: "lowres, bad hands",
  resolution: { width: 832, height: 1216 }, guidance: 5, steps: 28, seed: 42, rescale: 0, sampler: "DPM++ 2M",
  noiseSchedule: "karras", variety: false, transparentBackground: false,
  characters: [
    { enabled: true, modelAllowed: true, prompt: "girl, red hair", undesired: "", position: { mode: "auto", x: null, y: null } },
    { enabled: false, modelAllowed: true, prompt: "off", undesired: "", position: { mode: "auto" } },
    { enabled: true, modelAllowed: true, prompt: "  ", undesired: "", position: { mode: "auto" } }
  ],
  baseImage: { active: false }, vibeTransfer: [], preciseReferences: []
};
const request = plain(api.buildRequest(payload));
assert.equal(request.model, "nai-diffusion-4-5-full");
assert.equal(request.action, "generate");
assert.equal(request.input, "1girl, very aesthetic");
assert.equal(request.parameters.sampler, "k_dpmpp_2m");
assert.equal(request.parameters.scale, 5);
assert.equal(request.parameters.qualityToggle, false);
assert.equal(request.parameters.skip_cfg_above_sigma, null);
assert.equal(request.parameters.v4_prompt.use_coords, false);
assert.deepEqual(request.parameters.v4_prompt.caption.char_captions, [{ char_caption: "girl, red hair", centers: [{ x: .5, y: .5 }] }]);
assert.equal(request.parameters.v4_negative_prompt.caption.base_caption, "lowres, bad hands");
assert.equal(request.parameters.tag_hint_transparent_background, undefined);

const manual = plain(api.buildRequest({ ...payload, variety: true, transparentBackground: true, characters: [{ ...payload.characters[0], position: { mode: "manual", x: .3, y: .7 } }] }));
assert.equal(manual.parameters.v4_prompt.use_coords, true);
assert.deepEqual(manual.parameters.v4_prompt.caption.char_captions[0].centers, [{ x: .3, y: .7 }]);
assert.equal(manual.parameters.skip_cfg_above_sigma, 58);
assert.equal(manual.parameters.tag_hint_transparent_background, undefined);
assert.equal(manual.input, "1girl, very aesthetic");
assert.equal(request.parameters.params_version, 3);

// V5: params_version 4, karras 고정, 투명 배경 태그 1회만 추가, 자유 좌표
const v5 = plain(api.buildRequest({ ...payload, model: "V5 Curated", noiseSchedule: "exponential", transparentBackground: true, characters: [{ ...payload.characters[0], position: { mode: "manual", x: .12, y: .87 } }] }));
assert.equal(v5.model, "nai-diffusion-5-curated");
assert.equal(v5.parameters.params_version, 4);
assert.equal(v5.parameters.noise_schedule, "karras");
assert.equal(v5.input, "1girl, very aesthetic, transparent background");
assert.equal(v5.parameters.v4_prompt.caption.base_caption, v5.input);
assert.equal(v5.parameters.straight_alpha, true);
assert.equal(v5.parameters.tag_hint_transparent_background, true);
assert.deepEqual(v5.parameters.v4_prompt.caption.char_captions[0].centers, [{ x: .12, y: .87 }]);
assert.equal(plain(api.buildRequest({ ...payload, model: "V5 Full", prompt: "1girl, Has Alpha", transparentBackground: true })).input, "1girl, Has Alpha");
assert.equal(plain(api.buildRequest({ ...payload, model: "V5 Full", prompt: "", transparentBackground: true })).input, "transparent background");
const v5Plain = plain(api.buildRequest({ ...payload, model: "V5 Full" }));
assert.equal(v5Plain.model, "nai-diffusion-5-full");
assert.equal(v5Plain.parameters.straight_alpha, undefined);
assert.equal(v5Plain.input, payload.prompt);
assert.throws(() => api.buildRequest({ ...payload, model: "V9" }), /API 모델 ID/);
assert.equal(plain(api.buildRequest({ ...payload, model: "V5 Full", sampler: "DPM++ 2M SDE" })).parameters.sampler, "k_dpmpp_2m_sde");
assert.throws(() => api.buildRequest({ ...payload, sampler: "DPM++ 2M SDE" }), /V5 전용/);
assert.throws(() => api.buildRequest({ ...payload, sampler: "Mystery" }), /지원하지 않는 Sampler/);
assert.throws(() => api.buildRequest({ ...payload, steps: 29 }), /무료 범위/);
assert.throws(() => api.buildRequest({ ...payload, resolution: { width: 1536, height: 1024 } }), /무료 넓이/);
assert.equal(plain(api.buildRequest({ ...payload, resolution: { width: 1024, height: 1024 } })).parameters.width, 1024);
assert.equal(plain(api.buildRequest({ ...payload, steps: 28 })).parameters.steps, 28);
assert.throws(() => api.buildRequest({ ...payload, vibeTransfer: [{ active: true }] }), /Vibe Transfer/);

// 최소 zip 작성기: 저장/deflate 두 방식 모두 확인
function zip(name, data, method) {
  const body = method === 8 ? deflateRawSync(data) : data;
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(method, 8);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(method, 10);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const localPart = Buffer.concat([local, nameBytes, body]);
  const centralPart = Buffer.concat([central, nameBytes]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralPart.length, 12); end.writeUInt32LE(localPart.length, 16);
  const out = Buffer.concat([localPart, centralPart, end]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
for (const method of [0, 8]) {
  const entry = await api.extractFirstPng(zip("image_0.png", png, method));
  assert.equal(entry.name, "image_0.png");
  assert.deepEqual([...entry.bytes], [...png]);
}
await assert.rejects(api.extractFirstPng(new ArrayBuffer(40)), /zip 형식/);
await assert.rejects(api.extractFirstPng(zip("notes.txt", png, 0)), /PNG가 없습니다/);

let sent = null;
const ok = await api.generateImage(payload, { token: "pst-test", fetchImpl: async (url, init) => { sent = { url, init }; return new Response(zip("image_0.png", png, 0), { status: 200 }); } });
assert.equal(sent.url, "https://image.novelai.net/ai/generate-image");
assert.equal(sent.init.headers.Authorization, "Bearer pst-test");
assert.equal(JSON.parse(sent.init.body).parameters.seed, 42);
assert.equal(ok.blob.type, "image/png");
assert.equal(ok.blob.size, png.length);
assert.equal(ok.fileName, "nai-42.png");
await assert.rejects(api.generateImage(payload, { token: "bad", fetchImpl: async () => new Response('{"statusCode":401,"message":"Unauthorized"}', { status: 401 }) }), /토큰이 올바르지/);
await assert.rejects(api.generateImage(payload, { token: "", fetchImpl: async () => assert.fail("토큰 없이 요청하면 안 된다") }), /토큰을 먼저/);

let accountUrl = "";
const account = plain(await api.fetchAccountStatus({ token: "pst-test", fetchImpl: async (url, init) => {
  accountUrl = url;
  assert.equal(init.headers.Authorization, "Bearer pst-test");
  return new Response(JSON.stringify({ tier: 3, active: true, trainingStepsLeft: { fixedTrainingStepsLeft: 9000, purchasedTrainingSteps: 335 }, usage: { isNegative: false, percent: 72, timeUntilNextPercent: 120 } }), { status: 200 });
} }));
assert.equal(accountUrl, "https://image.novelai.net/user/subscription");
assert.deepEqual(account, { tier: 3, active: true, anlas: 9335, allowance: { percent: 72, available: true, secondsToNextPercent: 120 } });
const noUsage = plain(await api.fetchAccountStatus({ token: "t", fetchImpl: async () => new Response(JSON.stringify({ tier: 0, usage: { isNegative: true, percent: 0 } }), { status: 200 }) }));
assert.equal(noUsage.anlas, null);
assert.equal(noUsage.allowance.available, false);
await assert.rejects(api.fetchAccountStatus({ token: "bad", fetchImpl: async () => new Response("{}", { status: 401 }) }), /토큰이 올바르지/);

const store = new Map();
const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
assert.equal(api.writeToken("  pst-abc  ", storage), "pst-abc");
assert.equal(api.readToken(storage), "pst-abc");
api.writeToken("", storage);
assert.equal(api.readToken(storage), "");
console.log("PASS: request mapping, V5 body, transparent tag, character coords, unsupported inputs, zip stored/deflate, fetch success/401/no token, account status, token storage");
