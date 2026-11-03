import ActivePrompts from "client/managers/ActivePrompts/index";
import { updateCurrentIteration } from "client/store";
import { parseGroups } from 'client/utils/parseGroups';
import { PromptEntity } from "clientTypes/prompt";
import DOMCache from 'client/DOMCache'
import appStore from 'client/store'
import processGroup from "./processGroup";


/** Hide whole # comment lines from the card parser without losing their original text.
 * Leading horizontal whitespace is allowed, but an inline # is not a comment.
 * Each collision-free placeholder is restored as a hidden, non-editable prompt item.
 */
export function maskCommentLines(value: string): {value: string; comments: Map<string, string>} {
    const comments = new Map<string, string>();
    const parts = value.split(/(\r\n|\n|\r)/);

    for(let index = 0; index < parts.length; index += 2) {
        const line = parts[index];
        if(!/^[ \t]*#/.test(line)) continue;

        let marker = `PBECOMMENTLINETOKEN${index}`;
        while(value.includes(marker)) marker += 'X';
        comments.set(marker, line);
        parts[index] = marker;
    }

    return {value: parts.join(''), comments};
}

/**
 * Synchronises text content of the textarea with the array of active prompts used by the extension.
 * TODO: remove noTextAreaUpdate as it is relict from previous implementation.
 */
export default function syncCurrentPrompts(noTextAreaUpdate: boolean = true, normalize: boolean = false) {
    const {currentContainer} = appStore.getState();
    const textArea = DOMCache.containers[currentContainer].textArea;
    if(!textArea) return;
    // Mask comments BEFORE other prompt rewrites, so their contents remain exact.
    const masked = maskCommentLines(textArea.value);
    let value = masked.value;

    //trying to fix LORAs/Hypernetworks added without a preceding comma
    value = value.replace(/([^,])\ </g, "$1,\ <");

    const newActivePrompts: PromptEntity[] = [];
    processGroup({
        entityArray: parseGroups(value),
        comments: masked.comments,
        activePrompts: newActivePrompts,
        normalize,
    });

    ActivePrompts.setCurrentPrompts(newActivePrompts);

    updateCurrentIteration();
}
