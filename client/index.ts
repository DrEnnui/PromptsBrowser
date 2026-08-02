import supportedContainers from 'client/supportedContainers'
import gradioApp from 'client/utils/gradioApp'
import {loadUIConfig} from 'client/store'
import DOMCache from './DOMCache'
import Database from './Database'

import mountContainer from './main/mountContainer'
import mountGlobal from './main/mountGlobal'
import onChangeTab from './main/events/onChangeTab'
import onDocumentKey from './main/events/onDocumentKey'
import { iterateModel } from 'client/store'


let timeoutPBUpdatePrompt: ReturnType<typeof setTimeout> | undefined;
let promptsBrowserMounted = false;
let promptsBrowserInitialized = false;

function scheduleHookRetry() {
    if(timeoutPBUpdatePrompt !== undefined) clearTimeout(timeoutPBUpdatePrompt);
    timeoutPBUpdatePrompt = setTimeout(tryToHook, 1000);
}

function tryToHook() {
    if(promptsBrowserMounted) return;

    const mainContainer = gradioApp() as HTMLElement;
    const checkContainer = mainContainer.querySelector("#txt2img_prompt_container");
    const tabsContainer = mainContainer.querySelector("#tabs > div:first-child") as HTMLElement;

    // Forge can take longer than 100 seconds to finish building the UI.
    // Keep waiting until all required containers exist instead of giving up.
    if(!checkContainer || !tabsContainer) {
        scheduleHookRetry();
        return;
    }

    if(timeoutPBUpdatePrompt !== undefined) clearTimeout(timeoutPBUpdatePrompt);
    timeoutPBUpdatePrompt = undefined;
    DOMCache.mainContainer = mainContainer;

    //Automatic1111
    let modelCheckpoint = mainContainer.querySelector("#setting_sd_model_checkpoint");
    
    //Forge
    if(!modelCheckpoint) {
        const forgeModelCheckpoint = mainContainer.querySelector("#quicksettings .model_selection");
        if(forgeModelCheckpoint) modelCheckpoint = forgeModelCheckpoint;
    }
    
    DOMCache.modelCheckpoint = modelCheckpoint as HTMLElement;

    if(DOMCache.modelCheckpoint) {
        const inputElement = DOMCache.modelCheckpoint.querySelector("input");
        inputElement?.addEventListener("blur", iterateModel)
    }

    tabsContainer.removeEventListener("click", onChangeTab);
    tabsContainer.addEventListener("click", onChangeTab);

    document.removeEventListener('keyup', onDocumentKey);
    document.addEventListener('keyup', onDocumentKey);

    for(const containerId in supportedContainers) mountContainer({containerId, mainContainer});

    mountGlobal({mainContainer});
    promptsBrowserMounted = true;
}

function initializePromptsBrowser() {
    if(promptsBrowserInitialized) return;
    promptsBrowserInitialized = true;

    loadUIConfig();
    Database.load();
    tryToHook();
}

if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePromptsBrowser, {once: true});
} else {
    initializePromptsBrowser();
}
