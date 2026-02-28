// background.js (NAI 버전 추출 로직 최종 개선 - 재수정 v8 + NAI Settings 순서/키표기/중복 완벽 수정)
import './lib/pako.min.js'; 
import './lib/UPNG.js';
import './lib/exifr.js'; 

const exifrInstance = typeof exifr !== 'undefined' ? exifr : (typeof self.exifr !== 'undefined' ? self.exifr : null);

const EXTENSION_VERSION = chrome.runtime.getManifest().version;
console.log(`[BackgroundScript] 프롬프트 뷰어 v${EXTENSION_VERSION} 로드됨. 디버깅 모드 활성화.`);

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

function isPng(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < PNG_SIGNATURE.length) return false;
  const uint8Array = new Uint8Array(arrayBuffer, 0, PNG_SIGNATURE.length);
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (uint8Array[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

async function decodeStealthMetaDataFromLSB(arrayBuffer) {
    // ... (이전과 동일, 로그 간소화 유지)
    console.log("[LSB Decode] LSB 디코딩 시도.");
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') { 
        console.warn("[LSB Decode] OffscreenCanvas 또는 createImageBitmap API 사용 불가."); 
        return null; 
    }
    let pakoInstance = self.pako;
    if (!pakoInstance || !pakoInstance.inflateRaw || !pakoInstance.ungzip) { 
        console.warn("[LSB Decode] Pako 또는 pako.inflateRaw/ungzip 함수 없음."); return null; 
    }
    let imageBitmap = null;
    try {
        const imageBlob = new Blob([arrayBuffer], { type: 'image/png' });
        imageBitmap = await createImageBitmap(imageBlob);
        if (!imageBitmap) { console.error("[LSB Decode] createImageBitmap 실패"); return null; }
        const { width, height } = imageBitmap;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { console.error("[LSB Decode] Canvas Context 실패"); if (imageBitmap && !imageBitmap.closed) imageBitmap.close(); return null; }
        ctx.drawImage(imageBitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height).data;
        const signature = 'stealth_pngcomp';
        const signatureByteLength = signature.length;
        const signatureBitLength = signatureByteLength * 8;
        const lengthByteLength = 4; 
        const lengthBitLength = lengthByteLength * 8;
        let bitCollector = ''; 
        let readingState = 'signature'; 
        let dataLengthInBytes = 0; 
        let bitsReadForCurrentState = 0; 
        let dataBytes = null;
        outerLoop:
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const alphaIndex = (y * width + x) * 4 + 3;
                const alpha = imageData[alphaIndex];
                const alphaLSB = String(alpha & 1);
                if (readingState === 'signature') {
                    bitCollector += alphaLSB;
                    if (bitCollector.length >= signatureBitLength) { 
                        const currentSigBitsToTest = bitCollector.substring(bitCollector.length - signatureBitLength);
                        let sigStr = "";
                        try {
                            for (let i = 0; i < signatureByteLength; i++) {
                                sigStr += String.fromCharCode(parseInt(currentSigBitsToTest.substring(i * 8, (i + 1) * 8), 2));
                            }
                        } catch(e) { sigStr = ""; }
                        if (sigStr === signature) {
                            readingState = 'length'; bitCollector = ''; bitsReadForCurrentState = 0;
                        } else {
                            if (bitCollector.length > signatureBitLength) bitCollector = bitCollector.substring(1);
                        }
                    }
                } else if (readingState === 'length') {
                    bitCollector += alphaLSB; bitsReadForCurrentState++;
                    if (bitsReadForCurrentState === lengthBitLength) {
                        let lengthInBytesVal = 0;
                        try { lengthInBytesVal = parseInt(bitCollector, 2); } catch(e) { console.error("[LSB Decode] 길이 parseInt 오류", e); return null;}
                        if (lengthInBytesVal === 0 || lengthInBytesVal * 8 > (width * height) || lengthInBytesVal > arrayBuffer.byteLength ) {
                             console.error(`[LSB Decode] 유효하지 않은 데이터 길이: ${lengthInBytesVal} bytes.`); return null;
                        }
                        readingState = 'data'; bitCollector = ''; bitsReadForCurrentState = 0; dataLengthInBytes = lengthInBytesVal; 
                    }
                } else if (readingState === 'data') {
                    bitCollector += alphaLSB; bitsReadForCurrentState++;
                    if (bitsReadForCurrentState === dataLengthInBytes * 8) { 
                        const extractedBytes = new Uint8Array(dataLengthInBytes);
                        try {
                            for (let i = 0; i < dataLengthInBytes; i++) { 
                                extractedBytes[i] = parseInt(bitCollector.substring(i * 8, (i + 1) * 8), 2);
                            }
                        } catch (e) { console.error(`[LSB Decode] 데이터 Uint8Array 변환 오류:`, e); return null; }
                        dataBytes = extractedBytes; break outerLoop; 
                    }
                }
            } 
        } 
        if (!dataBytes) { console.warn(`[LSB Decode] 데이터 추출 실패. 최종 상태: ${readingState}`); return null; }
        let decompressedData;
        if (dataBytes.length > 18 && typeof pakoInstance.inflateRaw === 'function') { 
            try {
                const pureDeflateData = dataBytes.slice(10, dataBytes.length - 8);
                if (pureDeflateData.length > 0) {
                    decompressedData = pakoInstance.inflateRaw(pureDeflateData);
                } else { throw new Error("헤더/푸터 제외 후 데이터 없음."); }
            } catch (e) {
                console.warn("[LSB Decode] Gzip 헤더/푸터 제외 후 pako.inflateRaw 실패:", e.message, ". 원본 dataBytes로 ungzip 재시도...");
                try { 
                    decompressedData = pakoInstance.ungzip(dataBytes); 
                } 
                catch (e2) { console.error("[LSB Decode] pako.ungzip도 실패:", e2.message); return null; }
            }
        } else { 
             try { 
                decompressedData = pakoInstance.ungzip(dataBytes);
            } 
             catch(e) { console.error("[LSB Decode] (짧은 데이터 또는 fallback) pako.ungzip 실패:", e.message); return null; }
        }
        if (!decompressedData) { console.error("[LSB Decode] 압축 해제 최종 실패."); return null; }
        const decodedText = new TextDecoder('utf-8', {fatal: true}).decode(decompressedData);
        return JSON.parse(decodedText);
    } catch (error) { 
        console.error("[LSB Decode] 전체 프로세스 중 오류:", error); return null;
    } finally {
        if (imageBitmap && !imageBitmap.closed) {
            imageBitmap.close();
        }
    }
}

function parseWebUIParameters(parametersString) {
    // ... (변경 없음)
    const result = { prompt: '', negativePrompt: '', settings: {} };
    if (!parametersString || typeof parametersString !== 'string') return result;
    const lines = parametersString.split('\n');
    let promptLines = []; let negativePromptLines = []; let settingLinesRaw = []; 
    let currentSection = 'prompt';
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("Negative prompt:")) {
            currentSection = 'negative';
            const negPromptValue = trimmedLine.substring("Negative prompt:".length).trim();
            if (negPromptValue) negativePromptLines.push(negPromptValue);
            continue; 
        }
        const settingKeywords = ["Steps:", "Sampler:", "CFG scale:", "Seed:", "Size:", "Model hash:", "Model:", "VAE hash:", "VAE:", "Denoising strength:", "Clip skip:", "Hires upscale:", "Hires upscaler:", "Version:"];
        if (settingKeywords.some(kw => trimmedLine.startsWith(kw)) && currentSection !== 'settings') {
            currentSection = 'settings';
        }
        if (currentSection === 'prompt') promptLines.push(line); 
        else if (currentSection === 'negative' && !trimmedLine.startsWith("Negative prompt:")) negativePromptLines.push(line); 
        else if (currentSection === 'settings' && trimmedLine.length > 0) settingLinesRaw.push(trimmedLine);
    }
    result.prompt = promptLines.join('\n').trim();
    result.negativePrompt = negativePromptLines.join('\n').trim();
    const kvRegex = /([\w\s\-\(\)\.\/]+):\s*("([^"]*)"|'([^']*)'|([^,]+(?:\([\w\s,()]*\))?|[^,]+))(?:,\s*|$)/g;
    for (const line of settingLinesRaw) {
        let match;
        while ((match = kvRegex.exec(line)) !== null) {
            const key = match[1].trim();
            let value = match[3] !== undefined ? match[3] : (match[4] !== undefined ? match[4] : match[5].trim());
            if (key.toLowerCase() !== "negative prompt" && key && value && !result.settings[key] && key !== "Prompt") {
                result.settings[key] = value;
            }
        }
    }
    return result;
}

function setupContextMenu() {
    // ... (변경 없음)
  chrome.contextMenus.remove("viewPromptData", () => {
    if (chrome.runtime.lastError) { /* Ignored */ }
    chrome.contextMenus.create({
      id: "viewPromptData",
      title: chrome.i18n.getMessage("contextMenuTitle"), 
      contexts: ["image"]
    }, () => {
      if (chrome.runtime.lastError) console.warn("[BackgroundScript] 컨텍스트 메뉴 생성 오류:", chrome.runtime.lastError.message);
    });
  });
}
chrome.runtime.onInstalled.addListener(setupContextMenu);
chrome.runtime.onStartup.addListener(setupContextMenu);

function getReferencedValue_comfy(ref, workflow, visitedNodes = new Set()) {
    // ... (변경 없음)
    if (!ref) return null;
    if (!Array.isArray(ref)) return ref;
    if (typeof ref[0] !== 'string' || typeof ref[1] !== 'number' || !workflow[ref[0]]) return ref; 
    const refNodeId = ref[0];
    if (visitedNodes.has(refNodeId)) return `[Cycle: ${refNodeId}]`;
    visitedNodes.add(refNodeId);
    const refNode = workflow[refNodeId];
    if (!refNode || !refNode.inputs) return `[Ref: ${refNodeId} not found/no inputs]`;
    let valueToResolve = null;
    const classType = refNode.class_type;
    if (classType.includes("CLIPTextEncode") || classType.includes("BRIA_RMBG_Prompt_Preprocessor_String")) valueToResolve = refNode.inputs.text;
    else if (classType.includes("Primitive String") || classType.includes("String Primitive")) valueToResolve = refNode.inputs.string !== undefined ? refNode.inputs.string : refNode.inputs.value;
    else if (classType.includes("Simple Text") || classType.includes("CR Text")) valueToResolve = refNode.inputs.text;
    else if (classType.includes("Get Booru Tag")) valueToResolve = refNode.inputs.text_b;
    else if (classType.includes("ShowText")) valueToResolve = refNode.inputs.text_0;
    else if (classType.includes("Wildcard Encode") || classType.includes("SDXL Prompt Styler")) {
        valueToResolve = refNode.inputs.text_positive !== undefined ? refNode.inputs.text_positive : refNode.inputs.text;
        if (valueToResolve === undefined && refNode.inputs.text_g !== undefined) valueToResolve = refNode.inputs.text_g;
    } else if (classType === "PrimitiveNode") valueToResolve = refNode.inputs.value;
    else valueToResolve = refNode.inputs.text; 
    if (valueToResolve !== null && valueToResolve !== undefined) {
        return getReferencedValue_comfy(valueToResolve, workflow, new Set(visitedNodes));
    }
    return `[Ref: ${refNodeId} (${classType}) -> ?]`;
}

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "viewPromptData" && info.srcUrl && tab && tab.id) {
    console.log("[BackgroundScript] 컨텍스트 메뉴 클릭됨. 이미지 URL:", info.srcUrl);
    chrome.tabs.sendMessage(tab.id, { type: "SHOW_SPINNER_PVEXT" }, 
        response => { if (chrome.runtime.lastError) console.warn("스피너 표시 요청 실패:", chrome.runtime.lastError.message); }
    );
    fetch(info.srcUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP 오류! ${response.status} ${response.statusText}`);
        console.log("[BackgroundScript] 이미지 fetch 성공.");
        return response.arrayBuffer();
      })
      .then(async arrayBuffer => {
        console.log("[BackgroundScript] ArrayBuffer 수신. 메타데이터 처리 시작.");
        let finalResponsePayload = { status: "unknown_error", message: "알 수 없는 오류", imageUrl: info.srcUrl };
        let rawMetadataFromPngChunks = {};
        let extractedExifData = null; 
        let naiJsonFromLSB = null; 
        
        let parsedAndTypedMetadata = { type: "unknown", data: {}, originalTextChunks: {} };
        let processed = false;

        if (isPng(arrayBuffer)) {
            console.log("[BackgroundScript] PNG 파일로 확인됨.");
            if (typeof self.UPNG !== 'undefined' && typeof self.UPNG.decode === 'function') {
                try {
                    const imgData = self.UPNG.decode(arrayBuffer);
                    if (imgData && imgData.tabs) {
                        if (imgData.tabs.tEXt?.parameters) rawMetadataFromPngChunks.parameters = imgData.tabs.tEXt.parameters;
                        else if (imgData.tabs.iTXt?.parameters) rawMetadataFromPngChunks.parameters = imgData.tabs.iTXt.parameters;
                        if (imgData.tabs.tEXt?.prompt) rawMetadataFromPngChunks.prompt = imgData.tabs.tEXt.prompt; 
                        else if (imgData.tabs.iTXt?.prompt) rawMetadataFromPngChunks.prompt = imgData.tabs.iTXt.prompt; 
                        if (imgData.tabs.tEXt?.workflow) rawMetadataFromPngChunks.workflow = imgData.tabs.tEXt.workflow;
                        else if (imgData.tabs.iTXt?.workflow) rawMetadataFromPngChunks.workflow = imgData.tabs.iTXt.workflow;
                        // console.log("[BackgroundScript] PNG 청크 (WebUI/ComfyUI용) 정보 수집:", JSON.stringify(rawMetadataFromPngChunks)); // 로그 간소화
                    }
                } catch (upngError) { console.error("[BackgroundScript] UPNG.js Decode Error:", upngError); }
            }
            naiJsonFromLSB = await decodeStealthMetaDataFromLSB(arrayBuffer.slice(0)); 
            if (naiJsonFromLSB) { 
                console.log("[BackgroundScript] LSB에서 JSON 추출 성공. (일부):", JSON.stringify(naiJsonFromLSB).substring(0, 100) + "...");
            } else {
                console.log("[BackgroundScript] LSB에서 JSON 추출 실패 또는 데이터 없음.");
            }
        } else {
            console.log("[BackgroundScript] PNG 파일이 아님. LSB 디코딩 생략.");
        }
        
        if (exifrInstance?.parse) {
            try { 
                extractedExifData = await exifrInstance.parse(arrayBuffer); 
                // if(extractedExifData) console.log("[BackgroundScript] EXIF 파싱 성공. 주요 키:", Object.keys(extractedExifData)); // 로그 간소화
            } catch(e) { 
                console.warn("[BackgroundScript] EXIF 파싱 오류:", e.message);
            } 
        }

        if (rawMetadataFromPngChunks.parameters) { 
            // ... WebUI 처리 (변경 없음)
            console.log("[BackgroundScript] WebUI 파라미터 감지하여 처리.");
            parsedAndTypedMetadata.type = "webui_sd";
            parsedAndTypedMetadata.data = parseWebUIParameters(rawMetadataFromPngChunks.parameters); 
            parsedAndTypedMetadata.originalParameters = rawMetadataFromPngChunks.parameters;
            processed = true;
        } else if (rawMetadataFromPngChunks.prompt || rawMetadataFromPngChunks.workflow) { 
            // ... ComfyUI 처리 (변경 없음)
            console.log("[BackgroundScript] ComfyUI 워크플로우/프롬프트 감지하여 처리.");
            parsedAndTypedMetadata.type = "comfyui";
            const comfyData = { prompt: '', negativePrompt: '', settings: {}, comfy_workflow_json: rawMetadataFromPngChunks.prompt || rawMetadataFromPngChunks.workflow || '' };
            try {
                const workflow = JSON.parse(comfyData.comfy_workflow_json);
                let loraCount = 1; let controlNetCount = 1; let ksamplerProcessedForPrompts = false; 
                for (const nodeId in workflow) {
                    const node = workflow[nodeId];
                    if (!node || !node.inputs || !node.class_type) continue;
                    const inputs = node.inputs; const classType = node.class_type;
                    if (classType.includes("CheckpointLoader") || classType.includes("EfficientLoader")) {
                        if (inputs.ckpt_name && !comfyData.settings.Model) comfyData.settings.Model = String(inputs.ckpt_name).split(/[/\\]/).pop();
                    }
                    if (classType.includes("VAELoader") || classType.includes("EfficientLoader")) {
                        if (inputs.vae_name && !comfyData.settings.VAE) comfyData.settings.VAE = String(inputs.vae_name).split(/[/\\]/).pop();
                    }
                    if (classType.includes("LoraLoader") && inputs.lora_name) {
                        const loraName = String(inputs.lora_name).split(/[/\\]/).pop();
                        if (loraName.toLowerCase() !== "none" && loraName.trim() !== "") {
                            const strengthModel = inputs.strength_model ?? 1.0; const strengthClip = inputs.strength_clip ?? strengthModel;
                            comfyData.settings[`LoRA ${loraCount++}`] = `${loraName} (model: ${strengthModel}, clip: ${strengthClip})`;
                        }
                    }
                    if (classType.includes("LoRA Stacker") && inputs.lora_count > 0) {
                        for (let i = 1; i <= inputs.lora_count; i++) {
                            const loraNameInput = inputs[`lora_name_${i}`];
                            if (loraNameInput && String(loraNameInput).toLowerCase() !== "none" && String(loraNameInput).trim() !== "") {
                                const loraName = String(loraNameInput).split(/[/\\]/).pop(); const loraWt = inputs[`lora_wt_${i}`] ?? 1.0;
                                comfyData.settings[`LoRA ${loraCount++}`] = `${loraName} (weight: ${loraWt})`;
                            }
                        }
                    }
                    if (classType.includes("EfficientLoader") && inputs.lora_stack) {
                        const loraStackNodeId = Array.isArray(inputs.lora_stack) ? inputs.lora_stack[0] : null;
                        if (loraStackNodeId && workflow[loraStackNodeId]?.class_type.includes("LoRA Stacker")) {
                            const stackerInputs = workflow[loraStackNodeId].inputs;
                            if (stackerInputs.lora_count > 0) {
                                for (let i = 1; i <= stackerInputs.lora_count; i++) {
                                    const loraNameInput = stackerInputs[`lora_name_${i}`];
                                    if (loraNameInput && String(loraNameInput).toLowerCase() !== "none" && String(loraNameInput).trim() !== "") {
                                        const loraName = String(loraNameInput).split(/[/\\]/).pop(); const loraWt = stackerInputs[`lora_wt_${i}`] ?? 1.0;
                                        const loraEntry = `${loraName} (weight: ${loraWt})`;
                                        if(!Object.values(comfyData.settings).includes(loraEntry)) comfyData.settings[`LoRA ${loraCount++}`] = loraEntry;
                                    }
                                }
                            }
                        }
                    }
                    if (classType.includes("ControlNetLoader") && inputs.control_net_name) {
                        comfyData.settings[`ControlNet ${controlNetCount++}`] = `${String(inputs.control_net_name).split(/[/\\]/).pop()}`;
                    }
                    if ((classType.includes("ControlNetApply") || classType.includes("ControlNetApplyAdvanced")) && inputs.strength !== undefined && inputs.control_net) {
                         const cnRefNodeId = Array.isArray(inputs.control_net) ? inputs.control_net[0] : null;
                         if(cnRefNodeId && workflow[cnRefNodeId]?.inputs.control_net_name){
                            const cnName = String(workflow[cnRefNodeId].inputs.control_net_name).split(/[/\\]/).pop();
                            let foundKey = null;
                            for(const key in comfyData.settings){
                                if(key.startsWith("ControlNet") && comfyData.settings[key] === cnName) { foundKey = key; break; }
                            }
                            if(foundKey) comfyData.settings[foundKey] += ` (strength: ${inputs.strength})`;
                            else comfyData.settings[`ControlNet ${controlNetCount++}`] = `${cnName} (strength: ${inputs.strength})`;
                         }
                    }
                    const isSamplerNode = classType.includes("KSampler") || classType.includes("EfficientLoader");
                    if (isSamplerNode && !ksamplerProcessedForPrompts) { 
                        if (inputs.seed !== undefined) comfyData.settings.Seed = inputs.seed;
                        if (inputs.steps !== undefined) comfyData.settings.Steps = inputs.steps;
                        if (inputs.cfg !== undefined) comfyData.settings["CFG Scale"] = inputs.cfg;
                        if (inputs.sampler_name !== undefined) comfyData.settings.Sampler = inputs.sampler_name;
                        if (inputs.scheduler !== undefined) comfyData.settings.Scheduler = inputs.scheduler;
                        if (inputs.denoise !== undefined) comfyData.settings["Denoising Strength"] = inputs.denoise;
                        if (inputs.positive) {
                            const promptText = getReferencedValue_comfy(inputs.positive, workflow);
                            if (promptText && typeof promptText === 'string' && !promptText.startsWith('[')) comfyData.prompt = promptText;
                        }
                        if (inputs.negative) {
                            const negPromptText = getReferencedValue_comfy(inputs.negative, workflow);
                            if (negPromptText && typeof negPromptText === 'string' && !negPromptText.startsWith('[')) comfyData.negativePrompt = negPromptText;
                        }
                        if (classType.includes("EfficientLoader")) {
                             if (inputs.image_width !== undefined && inputs.image_height !== undefined && !comfyData.settings.Size) comfyData.settings.Size = `${inputs.image_width}x${inputs.image_height}`;
                            if (inputs.batch_size !== undefined && !comfyData.settings["Batch size"]) comfyData.settings["Batch size"] = inputs.batch_size;
                            if (inputs.ckpt_name && !comfyData.settings.Model) comfyData.settings.Model = String(inputs.ckpt_name).split(/[/\\]/).pop();
                            if (inputs.vae_name && !comfyData.settings.VAE) comfyData.settings.VAE = String(inputs.vae_name).split(/[/\\]/).pop();
                        }
                        if(comfyData.prompt || comfyData.negativePrompt) ksamplerProcessedForPrompts = true;
                    }
                    if (!ksamplerProcessedForPrompts && !comfyData.prompt && (classType.includes("CLIPTextEncode") || classType.includes("Wildcard Encode") || classType.includes("ShowText")) ) {
                        const pInput = inputs.text !== undefined ? inputs.text : inputs.text_0;
                        const pVal = getReferencedValue_comfy(pInput, workflow);
                        if(pVal && typeof pVal === 'string' && !pVal.startsWith('[')) comfyData.prompt = pVal;
                    }
                    if (classType === "EmptyLatentImage" && !comfyData.settings.Size && inputs.width !== undefined && inputs.height !== undefined) {
                        comfyData.settings.Size = `${inputs.width}x${inputs.height}`;
                        if (inputs.batch_size !== undefined && !comfyData.settings["Batch size"]) comfyData.settings["Batch size"] = inputs.batch_size;
                    }
                }
            } catch (e) { console.warn("[BackgroundScript] ComfyUI 파싱 오류(상세):", e.message, e.stack); }
            parsedAndTypedMetadata.data = comfyData; 
            parsedAndTypedMetadata.originalTextChunks['ComfyUI Workflow'] = comfyData.comfy_workflow_json;
            processed = true;
        } else if (naiJsonFromLSB) { 
            console.log("[BackgroundScript] LSB JSON 존재. NAI 데이터 처리 시작.");
            parsedAndTypedMetadata.type = "novelai";
            const naiData = { prompt: '', negativePrompt: '', settings: {}, all_nai_comment_data: naiJsonFromLSB, software: '', raw_comment: '', versionInfo: '', source: '' };
            
            let actualParams = naiJsonFromLSB; 
            if (typeof naiJsonFromLSB.Comment === 'string') {
                try { actualParams = JSON.parse(naiJsonFromLSB.Comment); } catch(e) { console.warn("NAI Comment 문자열 파싱 실패, 루트 객체 사용"); }
            } else if (typeof naiJsonFromLSB.Comment === 'object' && naiJsonFromLSB.Comment !== null) {
                actualParams = naiJsonFromLSB.Comment; 
            }
            // console.log("[NAI Version] 버전/정보 추출에 사용될 실제 파라미터 객체 (actualParams):", JSON.stringify(actualParams).substring(0,100)+"..."); // 로그 간소화

            // --- NAI 버전 정보 추출 (LSB JSON 내부 정보 활용 - 재수정 v8) ---
            if (naiJsonFromLSB.Source && typeof naiJsonFromLSB.Source === 'string') {
                naiData.source = naiJsonFromLSB.Source;
                // console.log(`[NAI Version - LSB Top Level] 'Source': "${naiJsonFromLSB.Source}"`); // 로그 간소화
                const matchExtended = naiJsonFromLSB.Source.match(/V\d+\.\d+/i); 
                if (matchExtended) naiData.versionInfo = matchExtended[0].toUpperCase();
                else { const matchSimple = naiJsonFromLSB.Source.match(/V\d+/i); if (matchSimple) naiData.versionInfo = matchSimple[0].toUpperCase(); }
                // if(naiData.versionInfo) console.log(`  L> Parsed Version from Top Level Source: "${naiData.versionInfo}"`); // 로그 간소화
            }

            if (!naiData.versionInfo && naiJsonFromLSB.Software && typeof naiJsonFromLSB.Software === 'string') {
                naiData.software = naiJsonFromLSB.Software;
                // console.log(`[NAI Version - LSB Top Level] 'Software': "${naiJsonFromLSB.Software}" (using as fallback for version)`); // 로그 간소화
                const matchExtended = naiJsonFromLSB.Software.match(/V\d+\.\d+/i);
                if (matchExtended) naiData.versionInfo = matchExtended[0].toUpperCase();
                else { const matchSimple = naiJsonFromLSB.Software.match(/V\d+/i); if (matchSimple) naiData.versionInfo = matchSimple[0].toUpperCase(); }
                // if(naiData.versionInfo) console.log(`  L> Parsed Version from Top Level Software: "${naiData.versionInfo}"`); // 로그 간소화
            }
            
            if (!naiData.versionInfo && actualParams) {
                let sourceOrSoftwareFromComment = actualParams.source || actualParams.software;
                if (sourceOrSoftwareFromComment && typeof sourceOrSoftwareFromComment === 'string') {
                    if (!naiData.source && actualParams.source) naiData.source = actualParams.source;
                    if (!naiData.software && actualParams.software) naiData.software = actualParams.software;
                    // console.log(`[NAI Version - Comment Level] 'source' or 'software': "${sourceOrSoftwareFromComment}" (using as fallback for version)`); // 로그 간소화
                    const matchExtended = sourceOrSoftwareFromComment.match(/V\d+\.\d+/i);
                    if (matchExtended) naiData.versionInfo = matchExtended[0].toUpperCase();
                    else { const matchSimple = sourceOrSoftwareFromComment.match(/V\d+/i); if (matchSimple) naiData.versionInfo = matchSimple[0].toUpperCase(); }
                    // if(naiData.versionInfo) console.log(`  L> Parsed Version from Comment source/software: "${naiData.versionInfo}"`); // 로그 간소화
                }
            }

            if (!naiData.versionInfo && actualParams?.v4_prompt) {
               naiData.versionInfo = "V4";
               // console.log(`[NAI Version - Comment Level] 'v4_prompt' 존재. 버전을 "V4"로 설정.`); // 로그 간소화
            }

            if (actualParams?.version !== undefined) { // 이 값은 보통 숫자 1 (LSB JSON 최상위가 아닌 Comment 내부 version)
                const versionFromCommentVersionField = `V${actualParams.version}`.toUpperCase();
                // console.log(`[NAI Version - Comment Level] 'version' field: "${actualParams.version}", Parsed: "${versionFromCommentVersionField}"`); // 로그 간소화
                if (!naiData.versionInfo || (versionFromCommentVersionField.match(/^V\d+\.\d+$/) && !naiData.versionInfo.match(/^V\d+\.\d+$/)) ) { 
                    if (!(naiData.versionInfo && naiData.versionInfo.match(/^V\d+\.\d+$/) && versionFromCommentVersionField === "V1")) {
                        naiData.versionInfo = versionFromCommentVersionField;
                        // console.log(`  L> Comment 'version' field 사용 (덮어쓰거나 새로 설정): "${naiData.versionInfo}"`); // 로그 간소화
                    }
                }
            }
            console.log(`[NAI Version] 최종 결정 Version Info: "${naiData.versionInfo}"`);
            // --- NAI 버전 정보 추출 끝 ---

            if (naiJsonFromLSB.Description && typeof naiJsonFromLSB.Description === 'string' && !naiData.prompt) naiData.prompt = naiJsonFromLSB.Description;
            if (actualParams.prompt && typeof actualParams.prompt === 'string' && !naiData.prompt ) naiData.prompt = actualParams.prompt; 
            
            let basePrompt = ''; let baseNegativePrompt = '';
            if (actualParams.v4_prompt?.caption) {
                basePrompt = actualParams.v4_prompt.caption.base_caption || '';
                actualParams.v4_prompt.caption.char_captions?.forEach((charCap, index) => {
                    if (charCap.char_caption?.trim()) basePrompt += `\n\n--- Character ${index + 1} ---\n${charCap.char_caption.trim()}`;
                });
            }
            if (basePrompt.trim()) naiData.prompt = basePrompt.trim(); 
            
            if (actualParams.v4_negative_prompt?.caption) {
                baseNegativePrompt = actualParams.v4_negative_prompt.caption.base_caption || '';
                actualParams.v4_negative_prompt.caption.char_captions?.forEach((charCap, index) => {
                    if (charCap.char_caption?.trim()) baseNegativePrompt += `\n\n--- Character ${index + 1} (Negative) ---\n${charCap.char_caption.trim()}`;
                });
            } else if (actualParams.uc && typeof actualParams.uc === 'string') {
                baseNegativePrompt = actualParams.uc;
            }
            if(baseNegativePrompt.trim()) naiData.negativePrompt = baseNegativePrompt.trim();
            
            // NAI 설정 키 (LSB JSON 내 실제 키) 와 표시될 이름 매핑
            const naiInternalKeyToDisplayKey = {
                "steps": "Steps",
                "scale": "Prompt Guidance (Scale)",
                "uncond_scale": "Undesired Content Strength",
                "cfg_rescale": "Guidance Rescale",
                "seed": "Seed",
                "sampler": "Sampler",
                "dynamic_thresholding": "Dynamic Thresholding",
                "sm": "SMEA", // content.js의 formatSettingKey가 최종적으로 SMEA로 변환
                "sm_dyn": "SMEA DYN", // content.js의 formatSettingKey가 최종적으로 SMEA DYN으로 변환
                "n_samples": "N Samples",
                "noise_schedule": "Noise Schedule"
                // "width", "height"는 Size로 통합하므로 여기서 제외
                // "software", "source", "version"은 아래에서 별도 처리
            };

            // 1. Software (최상위 우선)
            if (naiJsonFromLSB.Software) naiData.settings["Software"] = naiJsonFromLSB.Software;
            else if (actualParams.software) naiData.settings["Software"] = actualParams.software; // fallback

            // 2. Size
            if (actualParams.width !== undefined && actualParams.height !== undefined) {
                naiData.settings["Size"] = `${actualParams.width}x${actualParams.height}`;
            }

            // 3. 나머지 설정값 (매핑된 키 사용)
            for (const internalKey in actualParams) {
                if (Object.prototype.hasOwnProperty.call(actualParams, internalKey)) {
                    const displayKey = naiInternalKeyToDisplayKey[internalKey];
                    if (displayKey) { // 매핑된 키만 처리
                        if (internalKey === "sm" || internalKey === "sm_dyn" || internalKey === "dynamic_thresholding") {
                            naiData.settings[displayKey] = actualParams[internalKey] ? "True" : "False";
                        } else {
                            naiData.settings[displayKey] = actualParams[internalKey];
                        }
                    }
                }
            }
            
            // 4. Source (Model Info) (최상위 우선)
            if (naiJsonFromLSB.Source) naiData.settings["Source (Model Info)"] = naiJsonFromLSB.Source;
            else if (actualParams.source && !naiData.settings["Source (Model Info)"]) naiData.settings["Source (Model Info)"] = actualParams.source; // fallback
            
            // 5. Version Info (위에서 최종 결정된 값)
            if (naiData.versionInfo) naiData.settings["Version Info"] = naiData.versionInfo;
            
            console.log("[BackgroundScript] 최종 NAI settings 객체:", JSON.parse(JSON.stringify(naiData.settings)));

            parsedAndTypedMetadata.data = naiData;
            parsedAndTypedMetadata.originalTextChunks['LSB:NovelAI_JSON_Full'] = naiJsonFromLSB;
            processed = true;
        } else if (extractedExifData?.UserComment && extractedExifData.Software?.toLowerCase().includes('novelai')) { 
            console.log("[BackgroundScript] LSB NAI JSON 없음. EXIF UserComment + Software가 NAI일 가능성 확인.");
            // ...
        }
        
        // ... (이하 동일)
        console.log(`[BackgroundScript] 메타데이터 처리 완료. processed: ${processed}, type: ${parsedAndTypedMetadata.type}`);
        if (processed) { 
            finalResponsePayload = { status: "metadata_extracted", metadata: parsedAndTypedMetadata };
        } else if (Object.keys(rawMetadataFromPngChunks).length > 0 || extractedExifData) { 
            console.log("[BackgroundScript] 처리된 특정 타입은 없으나, PNG 청크(WebUI/Comfy용) 또는 EXIF 존재. unknown 타입으로 설정.");
            parsedAndTypedMetadata.type = extractedExifData ? "unknown_with_exif" : "unknown_png_text";
            
            let combinedDataForUnknown = { ...rawMetadataFromPngChunks }; 
            if (extractedExifData) { 
                for(const key in extractedExifData) { 
                    if(Object.prototype.hasOwnProperty.call(extractedExifData, key) && !combinedDataForUnknown[`EXIF:${key}`] && !combinedDataForUnknown[key]) { 
                         combinedDataForUnknown[`EXIF_fallback:${key}`] = extractedExifData[key];
                    }
                }
            }
            if (naiJsonFromLSB && !parsedAndTypedMetadata.originalTextChunks['LSB:NovelAI_JSON_Full']) {
                combinedDataForUnknown['LSB_JSON_Data (Not Processed as NAI)'] = naiJsonFromLSB;
            }

            parsedAndTypedMetadata.data = combinedDataForUnknown;
            if (Object.keys(parsedAndTypedMetadata.originalTextChunks).length === 0) {
                 parsedAndTypedMetadata.originalTextChunks = { ...combinedDataForUnknown };
            }
            finalResponsePayload = { status: "metadata_extracted", metadata: parsedAndTypedMetadata };
        } else { 
            console.log("[BackgroundScript] 추출 가능한 메타데이터 없음.");
            finalResponsePayload = { status: "no_metadata_found", message: "관련 메타데이터를 찾을 수 없음" };
        }
        
        if (parsedAndTypedMetadata.type !== 'novelai' && naiJsonFromLSB && !parsedAndTypedMetadata.originalTextChunks['LSB:NovelAI_JSON_Full'] && !parsedAndTypedMetadata.originalTextChunks['LSB_JSON_Data (Not Processed as NAI)']) {
             parsedAndTypedMetadata.originalTextChunks['LSB_Content_If_Not_NAI'] = naiJsonFromLSB;
        }
        if (parsedAndTypedMetadata.type !== 'webui_sd' && rawMetadataFromPngChunks.parameters) {
             parsedAndTypedMetadata.originalTextChunks['WebUI_Parameters_If_Not_Processed'] = rawMetadataFromPngChunks.parameters;
        }

        // console.log("[BackgroundScript] 최종 originalTextChunks:", JSON.parse(JSON.stringify(parsedAndTypedMetadata.originalTextChunks))); // 로그 간소화

        finalResponsePayload.imageUrl = info.srcUrl;
        console.log("[BackgroundScript] content.js로 payload 전송 (일부):", {status: finalResponsePayload.status, type: finalResponsePayload.metadata?.type, dataKeys: Object.keys(finalResponsePayload.metadata?.data || {})});
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_METADATA_MODAL", payload: finalResponsePayload }, 
            response => { 
                if (chrome.runtime.lastError) console.warn("content.js 응답 실패:", chrome.runtime.lastError.message); 
                // else console.log("content.js로부터 응답 받음:", response); // 로그 간소화
            }
        );
      })
      .catch(error => {
        console.error("[BackgroundScript] Fetch 또는 최상위 오류:", error);
        chrome.tabs.sendMessage(tab.id, { type: "HIDE_SPINNER_PVEXT" }, 
            response => { if (chrome.runtime.lastError) console.warn("오류 시 스피너 숨김 요청 실패:", chrome.runtime.lastError.message); }
        );
        const errorResponse = { status: "processing_error", message: `이미지 로드/처리 오류: ${error.message}`, imageUrl: info.srcUrl };
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_METADATA_MODAL", payload: errorResponse }, 
            response => { if (chrome.runtime.lastError) console.warn("오류 메시지 전송 실패 (catch):", chrome.runtime.lastError.message); }
        );
      });
    return true; 
  }
});