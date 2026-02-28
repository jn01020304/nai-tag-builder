// content.js (최종 정리 버전, 오류 메시지 UI 개선 및 제목 설정 로직 수정 + NAI 순서 수정)
const EXTENSION_VERSION_CONTENT = chrome.runtime.getManifest().version;
console.log(`[ContentScript] 프롬프트 뷰어 v${EXTENSION_VERSION_CONTENT} 로드됨.`);

const uiStrings = {
    en: {
        modalTitle: "Image Prompt Info", promptLabel: "Prompt", negativePromptLabel: "Negative Prompt", quickViewLabel: "Quick View", otherSettingsLabel: "Other Settings",
        comfyUISettingsLabel: "ComfyUI Parameters", naiSettingsLabel: "NovelAI Settings", comfyWorkflowLabel: "ComfyUI Workflow (JSON)", rawDataLabel: "Raw Data (Original Parameters / Text Chunks)",
        toggleShowMore: "▼ Show More Details", toggleShowLess: "▲ Hide Details", copyButton: "Copy", copiedButton: "Copied!", copyFailButton: "Fail",
        type_webui_sd: "SD WebUI", type_novelai: "NAI", type_comfyui: "ComfyUI", type_unknown_png_text: "Other PNG Text", type_unknown_with_exif: "Unknown (with EXIF)", type_unknown: "Unknown",
        error_processing: "Error processing image:", error_no_response: "Error: No response from background.", error_last_error: "Error communicating with background:",
        alert_no_metadata: "Info: No extractable metadata found in this image.", alert_not_png: "Info: Not a PNG file or unsupported image format.", alert_unknown_response: "Received an unknown response from background."
    },
    ko: {
        modalTitle: "이미지 프롬프트 정보", promptLabel: "프롬프트", negativePromptLabel: "네거티브 프롬프트", quickViewLabel: "간단 보기", otherSettingsLabel: "기타 설정",
        comfyUISettingsLabel: "ComfyUI 파라미터", naiSettingsLabel: "NovelAI 설정", comfyWorkflowLabel: "ComfyUI 워크플로우 (JSON)", rawDataLabel: "원본 데이터 (파라미터 / 텍스트 청크)",
        toggleShowMore: "▼ 상세 정보 더 보기", toggleShowLess: "▲ 상세 정보 숨기기", copyButton: "복사", copiedButton: "복사됨!", copyFailButton: "실패",
        type_webui_sd: "SD WebUI", type_novelai: "NAI", type_comfyui: "ComfyUI", type_unknown_png_text: "기타 PNG 텍스트", type_unknown_with_exif: "알 수 없음 (EXIF 포함)", type_unknown: "알 수 없음",
        error_processing: "이미지 처리 오류:", error_no_response: "백그라운드 응답 없음 오류.", error_last_error: "백그라운드 통신 오류:",
        alert_no_metadata: "정보: 이 이미지에서 추출 가능한 메타데이터를 찾을 수 없습니다.", alert_not_png: "정보: PNG 파일이 아니거나 지원되지 않는 이미지 형식입니다.", alert_unknown_response: "백그라운드로부터 알 수 없는 응답을 받았습니다."
    }
};
let currentLang = 'en';
let pvModalClickOutsideHandler = null; 

function updateTextsForLanguage(lang, modalInstance) {
    currentLang = lang; document.body.classList.toggle('lang-ko', lang === 'ko');
    let detailInfoVisible = modalInstance?.querySelector('#promptViewerDetailedInfo_pvExt')?.style.display === 'block';
    if (window.lastPayload_pvExt) {
        const existingModal = document.getElementById("promptViewerModal_pvExt");
        if (existingModal) {
            if (pvModalClickOutsideHandler) { document.removeEventListener('click', pvModalClickOutsideHandler, { capture: true }); pvModalClickOutsideHandler = null; }
            existingModal.remove();
        }
        renderModal(window.lastPayload_pvExt, detailInfoVisible);
    }
    chrome.storage.sync.set({ preferredLang_pvExt: currentLang });
}

function injectStyles() {
    const modalCssUrl = chrome.runtime.getURL('modal.css');
    if (document.querySelector(`link[href="${modalCssUrl}"]`)) return;
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet'; linkElement.type = 'text/css'; linkElement.href = modalCssUrl;
    document.head.appendChild(linkElement);
}
injectStyles();

chrome.storage.sync.get('preferredLang_pvExt', data => {
    if (data.preferredLang_pvExt) {
        currentLang = data.preferredLang_pvExt;
        document.body.classList.toggle('lang-ko', currentLang === 'ko');
    }
});

function showSpinner_pvExt() {
    hideSpinner_pvExt(); 
    const spinnerContainer = document.createElement('div');
    spinnerContainer.id = 'promptViewerSpinnerHost_pvExt'; 
    const spinnerDotsWrapper = document.createElement('div');
    spinnerDotsWrapper.className = 'pv-spinner-dots-wrapper'; 
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div'); 
        dot.className = 'pv-spinner-dot';
        if (i === 0) dot.classList.add('dot1');
        if (i === 1) dot.classList.add('dot2');
        if (i === 2) dot.classList.add('dot3');
        spinnerDotsWrapper.appendChild(dot);
    }
    spinnerContainer.appendChild(spinnerDotsWrapper);
    document.body.appendChild(spinnerContainer);
}

function hideSpinner_pvExt() {
    document.getElementById('promptViewerSpinnerHost_pvExt')?.remove();
}

function renderModal(payload, detailedInfoInitialVisible = false) {
    window.lastPayload_pvExt = payload;
    const existingModal = document.getElementById("promptViewerModal_pvExt");
    if (existingModal) {
        if (pvModalClickOutsideHandler) { document.removeEventListener('click', pvModalClickOutsideHandler, { capture: true }); pvModalClickOutsideHandler = null; }
        existingModal.remove();
    }
    const modal = document.createElement("div"); modal.id = "promptViewerModal_pvExt";
    const headerDiv = document.createElement("div"); headerDiv.className = "pv-modal-header";
    const title = document.createElement("h2"); title.className = "pv-modal-title"; headerDiv.appendChild(title);
    const langToggleSwitch = document.createElement("div"); langToggleSwitch.className = "pv-lang-toggle-switch-pill"; langToggleSwitch.setAttribute("role", "radiogroup"); 
    ['en', 'ko'].forEach(lang => {
        const label = document.createElement("label"); const input = document.createElement("input");
        input.type = "radio"; input.name = "pv_lang_toggle"; input.value = lang; input.checked = currentLang === lang;
        input.onchange = () => updateTextsForLanguage(lang, modal);
        const span = document.createElement("span"); span.textContent = lang.toUpperCase();
        label.appendChild(input); label.appendChild(span); langToggleSwitch.appendChild(label);
    });
    headerDiv.appendChild(langToggleSwitch);
    const closeButton = document.createElement("button"); closeButton.innerHTML = "✕"; closeButton.className = "pv-modal-close-button"; closeButton.setAttribute("aria-label", "Close modal");
    closeButton.onclick = function() {
        if (pvModalClickOutsideHandler) { document.removeEventListener('click', pvModalClickOutsideHandler, { capture: true }); pvModalClickOutsideHandler = null; }
        modal.remove(); delete window.lastPayload_pvExt;
    };
    headerDiv.appendChild(closeButton); modal.appendChild(headerDiv);
    setTimeout(() => {
        pvModalClickOutsideHandler = event => {
            const modalElement = document.getElementById("promptViewerModal_pvExt");
            if (modalElement && !modalElement.contains(event.target)) closeButton.click();
        };
        document.addEventListener('click', pvModalClickOutsideHandler, { capture: true, once: false });
    }, 100);
    const promptsContainer = document.createElement("div"); promptsContainer.className = "pv-prompts-container"; modal.appendChild(promptsContainer);
    const contentScrollableDiv = document.createElement("div"); contentScrollableDiv.className = "pv-content-scrollable";
    let footerDiv = null; 

    let titleContentForDisplay = uiStrings[currentLang].modalTitle; 

    if (payload.status === "metadata_extracted" && payload.metadata) {
        const metadata = payload.metadata; 
        const mainData = metadata.data || {};
        let typeIdentifier = ""; 

        if (metadata.type === "webui_sd") typeIdentifier = uiStrings[currentLang].type_webui_sd;
        else if (metadata.type === "novelai") {
            typeIdentifier = uiStrings[currentLang].type_novelai;
            // Version Info는 settings 객체에서 가져오도록 수정
            if (mainData.settings && mainData.settings["Version Info"]) {
                typeIdentifier += ` ${mainData.settings["Version Info"]}`;
            } else if (mainData.versionInfo) { // 예비용
                typeIdentifier += ` ${mainData.versionInfo}`;
            }
        }
        else if (metadata.type === "comfyui") typeIdentifier = uiStrings[currentLang].type_comfyui;
        else if (metadata.type === "unknown_png_text") typeIdentifier = uiStrings[currentLang].type_unknown_png_text;
        else if (metadata.type === "unknown_with_exif") typeIdentifier = uiStrings[currentLang].type_unknown_with_exif;
        else typeIdentifier = uiStrings[currentLang].type_unknown;
        
        if (typeIdentifier && typeIdentifier.trim() !== "" && typeIdentifier !== uiStrings[currentLang].type_unknown ) {
            titleContentForDisplay = `${uiStrings[currentLang].modalTitle} / <span class="pv-type-identifier">${typeIdentifier}</span>`;
        }
        
        let promptSection, negativePromptSection; const isNai = metadata.type === "novelai";
        if (mainData.prompt) promptsContainer.appendChild(createMetadataSection(uiStrings[currentLang].promptLabel, mainData.prompt, true, false, 'pv-prompt-column', isNai));
        if (mainData.negativePrompt) promptsContainer.appendChild(createMetadataSection(uiStrings[currentLang].negativePromptLabel, mainData.negativePrompt, true, false, 'pv-prompt-column', isNai));
        if (promptsContainer.children.length === 1) promptsContainer.children[0].style.flexBasis = '100%';

        if (metadata.type === "webui_sd" && mainData.settings && Object.keys(mainData.settings).length > 0) {
            // ... (WebUI 설정 부분은 변경 없음)
            const settingsContainer = document.createElement("div"); 
            const quickViewKeys = ["Model", "Model Hash", "Size", "Steps", "Sampler", "Schedule Type", "Seed", "CFG Scale"];
            const quickViewData = {}; const quickViewOrigKeys = [];
            quickViewKeys.forEach(fmtKey => {
                for (const origKey in mainData.settings) if (formatSettingKey(origKey) === fmtKey && !quickViewOrigKeys.includes(origKey)) { quickViewData[origKey] = mainData.settings[origKey]; quickViewOrigKeys.push(origKey); break; }
            });
            if (quickViewOrigKeys.length > 0) settingsContainer.appendChild(createSettingsBlock(uiStrings[currentLang].quickViewLabel, quickViewData, quickViewOrigKeys));
            const detailedInfoDiv = document.createElement("div"); detailedInfoDiv.style.display = detailedInfoInitialVisible ? "block" : "none"; detailedInfoDiv.id = "promptViewerDetailedInfo_pvExt";
            const otherKeysFmt = ["Hires Steps", "Hires Upscale", "Hires Upscaler", "Hires Prompt", "Denoising Strength", "Clip Skip", "Skip Early CFG", "Fp8 Weight", "Cache Fp16 Weight For Lora", "VAE", "VAE Hash", "Emphasis", "Dynamic Thresholding Enabled", "Mimic CFG Scale", "Threshold Percentile", "Interpolate Phi", "Mimic Scale Scheduler", "CFG Scale Scheduler", "Mimic Scale Minimum", "CFG Scale Minimum", "Noise Schedule", "Separate Feature Channels", "Scaling Startpoint", "Variability Measure", "Version"];
            const otherOrigKeys = []; const tempOtherData = {};
            for (const origKey in mainData.settings) if (!quickViewOrigKeys.includes(origKey)) tempOtherData[origKey] = mainData.settings[origKey];
            otherKeysFmt.forEach(fmtKey => { for (const origKey in tempOtherData) if (formatSettingKey(origKey) === fmtKey && !otherOrigKeys.includes(origKey)) otherOrigKeys.push(origKey); });
            Object.keys(tempOtherData).filter(k => !otherOrigKeys.includes(k)).sort().forEach(k => otherOrigKeys.push(k));
            if (otherOrigKeys.length > 0) {
                const otherSettingsData = {}; otherOrigKeys.forEach(key => { if (mainData.settings[key] !== undefined) otherSettingsData[key] = mainData.settings[key]; });
                const otherSettingsBlock = createSettingsBlock(uiStrings[currentLang].otherSettingsLabel, otherSettingsData, otherOrigKeys);
                if (otherSettingsBlock.querySelector('.pv-settings-table tbody').rows.length > 0) detailedInfoDiv.appendChild(otherSettingsBlock);
            }
            if (metadata.originalParameters) detailedInfoDiv.appendChild(createMetadataSection(uiStrings[currentLang].rawDataLabel, metadata.originalParameters, true, true));
            else if (metadata.originalTextChunks && Object.keys(metadata.originalTextChunks).length > 0) detailedInfoDiv.appendChild(createMetadataSection(uiStrings[currentLang].rawDataLabel, JSON.stringify(metadata.originalTextChunks, null, 2), true, true));
            if (detailedInfoDiv.childNodes.length > 0) settingsContainer.appendChild(detailedInfoDiv);
            contentScrollableDiv.appendChild(settingsContainer); 
            if (detailedInfoDiv.childNodes.length > 0) {
                footerDiv = document.createElement("div"); footerDiv.className = "pv-modal-footer";
                const toggleText = detailedInfoInitialVisible ? uiStrings[currentLang].toggleShowLess : uiStrings[currentLang].toggleShowMore;
                footerDiv.appendChild(createToggleButton(detailedInfoDiv, toggleText, uiStrings[currentLang].toggleShowLess, uiStrings[currentLang].toggleShowMore));
            }
        } else if (metadata.type === "novelai" && mainData) {
            if (mainData.settings && Object.keys(mainData.settings).length > 0) {
                // *** NAI 설정 표시 순서 수정 ***
                const naiOrder = [
                    'Software', 
                    'Size', 
                    'Steps', 
                    'Sampler', 
                    'Prompt Guidance (Scale)', 
                    'Guidance Rescale', 
                    'Undesired Content Strength', 
                    'SMEA', 
                    'SMEA DYN', 
                    'Seed', 
                    'Dynamic Thresholding', 
                    'N Samples', // 스크린샷에 있었음
                    'Noise Schedule', // 스크린샷에 있었음
                    'Version Info',
                    'Source (Model Info)'
                ];
                // naiOrder에 있는 키들을 우선적으로 사용하고, 나머지는 그 뒤에 추가
                let orderedKeys = [];
                naiOrder.forEach(keyName => {
                    if (Object.prototype.hasOwnProperty.call(mainData.settings, keyName)) {
                        orderedKeys.push(keyName);
                    }
                });
                // settings 객체의 나머지 키들을 orderedKeys에 추가 (중복 제외)
                Object.keys(mainData.settings).forEach(key => {
                    if (!orderedKeys.includes(key)) {
                        orderedKeys.push(key);
                    }
                });

                const naiSettingsBlock = createSettingsBlock(uiStrings[currentLang].naiSettingsLabel, mainData.settings, orderedKeys);
                if (naiSettingsBlock.querySelector('.pv-settings-table tbody').rows.length > 0) contentScrollableDiv.appendChild(naiSettingsBlock);
            }
            // all_nai_comment_data 또는 raw_comment 표시 (기존 로직 유지)
            if (mainData.all_nai_comment_data) contentScrollableDiv.appendChild(createMetadataSection("NovelAI Full Comment (JSON)", JSON.stringify(mainData.all_nai_comment_data, null, 2), true, true));
            else if (mainData.raw_comment) contentScrollableDiv.appendChild(createMetadataSection("NovelAI Raw Comment", mainData.raw_comment, true, true));
        
        } else if (metadata.type === "comfyui" && mainData) {
            // ... (ComfyUI 설정 부분은 변경 없음)
            const comfyContainer = document.createElement("div");
            if (mainData.settings && Object.keys(mainData.settings).length > 0) {
                const comfyOrder = ['Model', 'VAE', 'LoRA 1', 'LoRA 2', 'LoRA 3', 'LoRA 4', 'LoRA 5', 'ControlNet 1', 'ControlNet 2', 'Size', 'Seed', 'Steps', 'CFG Scale', 'Sampler', 'Scheduler', 'Denoising Strength', 'Batch size'];
                let comfyKeys = []; const settingKeysMap = Object.keys(mainData.settings).map(k => ({ original: k, formatted: formatSettingKey(k) }));
                comfyOrder.forEach(fmtKey => { const entry = settingKeysMap.find(e => e.formatted === fmtKey || e.original === fmtKey); if (entry && !comfyKeys.includes(entry.original)) comfyKeys.push(entry.original); });
                settingKeysMap.forEach(e => { if (!comfyKeys.includes(e.original)) comfyKeys.push(e.original); });
                const comfySettingsBlock = createSettingsBlock(uiStrings[currentLang].comfyUISettingsLabel, mainData.settings, comfyKeys);
                if (comfySettingsBlock.querySelector('.pv-settings-table tbody').rows.length > 0) comfyContainer.appendChild(comfySettingsBlock);
            }
            if (mainData.comfy_workflow_json) comfyContainer.appendChild(createMetadataSection(uiStrings[currentLang].comfyWorkflowLabel, mainData.comfy_workflow_json, true, true));
            if (comfyContainer.childNodes.length > 0) contentScrollableDiv.appendChild(comfyContainer);
        } else { 
            // ... (Unknown 타입 처리 부분은 변경 없음)
            let unknownContent = null; 
            let unknownTitle = uiStrings[currentLang].type_unknown; 
            
            if (metadata.type === "unknown_png_text") unknownTitle = uiStrings[currentLang].type_unknown_png_text;
            else if (metadata.type === "unknown_with_exif") unknownTitle = uiStrings[currentLang].type_unknown_with_exif;

            if (metadata.originalTextChunks && Object.keys(metadata.originalTextChunks).length > 0) { 
                unknownContent = JSON.stringify(metadata.originalTextChunks, null, 2); 
                if (unknownTitle === uiStrings[currentLang].type_unknown) unknownTitle = uiStrings[currentLang].rawDataLabel;
            }
            else if (typeof mainData === 'object' && mainData !== null && Object.keys(mainData).length > 0) { 
                unknownContent = JSON.stringify(mainData, null, 2); 
                if (unknownTitle === uiStrings[currentLang].type_unknown) unknownTitle = currentLang === 'ko' ? "추출된 데이터" : "Extracted Data";
            }
            else if (typeof payload.metadata === 'string') {
                unknownContent = payload.metadata;
            }
            
            if (metadata.type && metadata.type.startsWith("unknown")) {
                 const specificUnknownType = metadata.type === "unknown_png_text" ? uiStrings[currentLang].type_unknown_png_text :
                                           metadata.type === "unknown_with_exif" ? uiStrings[currentLang].type_unknown_with_exif :
                                           uiStrings[currentLang].type_unknown;
                 titleContentForDisplay = `${uiStrings[currentLang].modalTitle} / <span class="pv-type-identifier">${specificUnknownType}</span>`;
            }

            if (unknownContent) contentScrollableDiv.appendChild(createMetadataSection(unknownTitle, unknownContent, true, true));
            else contentScrollableDiv.appendChild(createMetadataSection(unknownTitle, "No specific data fields found.", false));
        }
    } else { 
        // ... (오류 처리 부분은 변경 없음)
        let alertMessageKey = "";
        const originalMessage = payload.message || "Failed to retrieve information.";

        if (payload.status === "no_metadata_found") alertMessageKey = 'alert_no_metadata';
        else if (payload.status === "not_png") alertMessageKey = 'alert_not_png';
        else if (payload.status === "processing_error") alertMessageKey = 'error_processing';
        
        let alertMessageText = "";
        if (alertMessageKey && uiStrings[currentLang][alertMessageKey]) {
            const fullMsg = uiStrings[currentLang][alertMessageKey];
            const colonIndex = fullMsg.indexOf(':');
            alertMessageText = colonIndex !== -1 ? fullMsg.substring(colonIndex + 1).trim() : fullMsg;
        } else {
            alertMessageText = originalMessage; 
        }

        if (payload.status === "processing_error" && payload.message && !alertMessageText.includes(payload.message)) { 
             alertMessageText = alertMessageText ? `${alertMessageText} ${payload.message}` : payload.message;
        }
        
        const messageP = document.createElement("p"); 
        messageP.className = "pv-error-message";
        messageP.textContent = alertMessageText; 
        contentScrollableDiv.appendChild(messageP);
    }

    title.innerHTML = titleContentForDisplay; 
    modal.appendChild(contentScrollableDiv);
    if (footerDiv) modal.appendChild(footerDiv);
    document.body.appendChild(modal);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SHOW_SPINNER_PVEXT") { showSpinner_pvExt(); sendResponse({status: "spinner_shown"}); return false; }
    if (request.type === "HIDE_SPINNER_PVEXT") { hideSpinner_pvExt(); sendResponse({status: "spinner_hidden"}); return false; }
    if (request.type === "SHOW_METADATA_MODAL" && request.payload) {
        hideSpinner_pvExt();
        chrome.storage.sync.get('preferredLang_pvExt', data => {
            if (data.preferredLang_pvExt) currentLang = data.preferredLang_pvExt;
            document.body.classList.toggle('lang-ko', currentLang === 'ko');
            renderModal(request.payload);
            sendResponse({ status: "modal_shown_final_v2_title_logic_updated_nai_order_fix" }); 
        });
        return true; 
    }
    return false;
});

function createSettingsBlock(titleText, settingsObject, keysToShow) {
    const settingsDiv = document.createElement("div"); settingsDiv.className = "pv-section";
    const title = document.createElement("h3"); title.className = "pv-section-title"; title.textContent = titleText; settingsDiv.appendChild(title);
    const tableContainer = document.createElement("div"); tableContainer.className = "pv-settings-table-container";
    tableContainer.appendChild(createSettingsTable(settingsObject, keysToShow)); settingsDiv.appendChild(tableContainer);
    return settingsDiv;
}

function createToggleButton(targetDiv, initialText, showLessText, showMoreText) {
    const button = document.createElement("button"); button.className = "pv-toggle-button"; button.textContent = initialText;
    button.onclick = () => {
        const isHidden = targetDiv.style.display === "none";
        targetDiv.style.display = isHidden ? "block" : "none";
        button.textContent = isHidden ? showLessText : showMoreText;
    };
    return button;
}

function createSettingsTable(settingsObject, keysToShow) {
    const table = document.createElement("table"); table.className = "pv-settings-table";
    const tbody = table.createTBody();
    keysToShow.forEach(originalKey => {
        // settingsObject에 originalKey가 있고, 그 값이 유효한 경우에만 행을 추가
        if (Object.prototype.hasOwnProperty.call(settingsObject, originalKey) && 
            settingsObject[originalKey] !== undefined && 
            settingsObject[originalKey] !== null && 
            String(settingsObject[originalKey]).trim() !== "") {
            const tr = tbody.insertRow();
            const tdKey = tr.insertCell(); 
            const tdValue = tr.insertCell();
            tdKey.outerHTML = `<th>${formatSettingKey(originalKey)}</th>`; 
            tdValue.textContent = String(settingsObject[originalKey]);
        }
    });
    return table;
}

function formatSettingKey(key) {
    let fmtKey = String(key); 
    const lowerKey = fmtKey.toLowerCase();

    // NAI 특정 키 대문자 처리 (SMEA, SMEA DYN)
    if (lowerKey === "smea") return "SMEA";
    if (lowerKey === "smea dyn") return "SMEA DYN"; // background.js에서 "SMEA DYN"으로 보내므로 lowerKey는 "smea dyn"

    // WebUI 등의 기타 특정 키 처리
    if (lowerKey === "skip early cfg") return "Skip Early CFG"; 
    if (lowerKey === "mimic scale") return "Mimic CFG Scale";
    if (lowerKey === "mimic mode") return "Mimic Scale Scheduler"; 
    if (lowerKey === "cfg mode") return "CFG Scale Scheduler";
    if (lowerKey === "vae") return "VAE"; 
    if (lowerKey === "vaehash" || lowerKey === "vae hash") return "VAE Hash";
    if (lowerKey.startsWith("cfg")) {
        let rest = fmtKey.substring(3).trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (lowerKey.includes("scale") && lowerKey.includes("minimum")) return "CFG Scale Minimum";
        if (lowerKey.includes("scale")) return "CFG Scale"; 
        return `CFG ${rest}`.trim();
    }
    // NAI의 다른 키들은 이미 background.js에서 "Prompt Guidance (Scale)" 등으로 변환되어 오므로, 아래는 WebUI 등에 더 많이 해당됨
    if (lowerKey === "model hash" || lowerKey === "modelhash") return "Model Hash"; 
    if (lowerKey === "denoising strength" || lowerKey === "denoisingstrength") return "Denoising Strength";
    if (lowerKey === "hires upscale" || lowerKey === "hiresupscale") return "Hires Upscale"; 
    if (lowerKey === "hires upscaler" || lowerKey === "hiresupscaler") return "Hires Upscaler";
    if (lowerKey === "schedule type" || lowerKey === "scheduletype") return "Schedule Type"; 
    
    // NAI 키 중 이미 적절히 포맷된 것들 (background.js에서 변환)
    if (key === "Prompt Guidance (Scale)") return key;
    if (key === "Undesired Content Strength") return key;
    if (key === "Guidance Rescale") return key;
    if (key === "Source (Model Info)") return key;
    if (key === "Version Info") return key;


    if (fmtKey.startsWith("LoRA ") && fmtKey.includes(" ")) return fmtKey; // LoRA 이름은 그대로

    // 일반적인 Title Case 변환 (기본 로직)
    return fmtKey.replace(/_/g, ' ').split(' ').map(w => (w.toUpperCase() === "CFG" ? "CFG" : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ').trim();
}

function createMetadataSection(titleText, contentText, addCopyButton = false, isRaw = false, customClass = '', isNaiPrompt = false) {
    const sectionDiv = document.createElement("div"); sectionDiv.className = "pv-section"; if (customClass) sectionDiv.classList.add(customClass);
    const titleLabel = document.createElement("h3"); titleLabel.className = "pv-section-title"; titleLabel.textContent = titleText; sectionDiv.appendChild(titleLabel);
    if (isNaiPrompt && customClass === 'pv-prompt-column') {
        const formattedDiv = document.createElement("div"); formattedDiv.className = "pv-nai-prompt-formatted";
        formattedDiv.innerHTML = String(contentText)
            .replace(/(\n\n--- Character \d+ ---\n?)/g, (match) => `<br><br><strong>${match.replace(/\n/g, '').trim()}</strong><br>`)
            .replace(/(\n\n--- Character \d+ \(Negative\) ---\n?)/g, (match) => `<br><br><strong>${match.replace(/\n/g, '').trim()}</strong><br>`)
            .replace(/\n/g, '<br>');
        sectionDiv.appendChild(formattedDiv);
    } else {
        const valueTextarea = document.createElement("textarea"); valueTextarea.value = String(contentText); valueTextarea.readOnly = true;
        valueTextarea.classList.add("pv-textarea"); if (isRaw) valueTextarea.classList.add("pv-textarea-raw");
        if (customClass === 'pv-prompt-column' && !isNaiPrompt) valueTextarea.classList.add("pv-prompt-textarea");
        sectionDiv.appendChild(valueTextarea);
    }
    if (addCopyButton) {
        const btnContainer = document.createElement("div"); btnContainer.className = "pv-copy-button-container";
        const copyBtn = document.createElement("button"); copyBtn.className = "pv-copy-button";
        const origBtnText = uiStrings[currentLang].copyButton; copyBtn.textContent = origBtnText;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(String(contentText)).then(() => { 
                copyBtn.textContent = uiStrings[currentLang].copiedButton; copyBtn.classList.add("copied"); copyBtn.classList.remove("failed");
                setTimeout(() => { copyBtn.textContent = origBtnText; copyBtn.classList.remove("copied"); }, 2000);
            }).catch(err => {
                console.error("클립보드 복사 실패:", err);
                copyBtn.textContent = uiStrings[currentLang].copyFailButton; copyBtn.classList.add("failed"); copyBtn.classList.remove("copied");
                setTimeout(() => { copyBtn.textContent = origBtnText; copyBtn.classList.remove("failed"); }, 2000);
            });
        };
        btnContainer.appendChild(copyBtn); sectionDiv.appendChild(btnContainer);
    }
    return sectionDiv;
}