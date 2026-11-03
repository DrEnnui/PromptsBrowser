import Database from "client/Database/index";
import { DEFAULT_PROMPT_WEIGHT } from "client/const";
import { normalizePrompt, promptStringToObject} from "client/utils/index";
import Prompt, { PromptEntity } from "clientTypes/prompt";
import ConfigManager from 'client/managers/Config'
import tokenizePrompt, {PromptToken} from './tokenizePrompt';


function appendSeparator(activePrompts: PromptEntity[], separator: string, pendingSeparator: {value: string}) {
    if(!separator) return;

    const previous = activePrompts[activePrompts.length - 1];
    if(previous) previous.separatorAfter = (previous.separatorAfter || "") + separator;
    else pendingSeparator.value += separator;
}

export default function createPromptObjects({value, comments, activePrompts, groupId, nestingLevel = 0, normalize = false}: {
    value: string;
    comments?: Map<string, string>;
    activePrompts: PromptEntity[];
    normalize?: boolean;
    groupId: number | false;
    nestingLevel: number;
}) {
    const {data} = Database;
    const {supportExtendedSyntax = true} = ConfigManager.getConfig();
    const pendingSeparator = {value: ""};
    const tokens: PromptToken[] = tokenizePrompt(value, supportExtendedSyntax);

    for(const token of tokens) {
        if(token.type === "separator") {
            appendSeparator(activePrompts, token.value, pendingSeparator);
            continue;
        }

        // Restore a full comment line as an invisible, inert node. Keep its
        // separators and array position so card operations do not delete it.
        const commentText = comments?.get(token.value.trim());
        if(commentText !== undefined) {
            const hiddenComment: Prompt = {
                id: commentText,
                parentGroup: groupId,
                isComment: true,
                isSyntax: true,
            };
            if(pendingSeparator.value) {
                hiddenComment.separatorBefore = pendingSeparator.value;
                pendingSeparator.value = "";
            }
            activePrompts.push(hiddenComment);
            continue;
        }

        let promptItem = token.value;
        const {id, weight, isExternalNetwork, isSyntax = false} = promptStringToObject({prompt: promptItem, nestedWeight: 0});
        if(!id) continue;

        promptItem = id;

        const isBreak = token.type === "syntax" && token.value.trim() === "BREAK";
        const isExtendedSyntax = token.type === "syntax" && !isBreak;
        const syntax = isSyntax || token.type === "syntax";

        if(normalize && !isExternalNetwork && !syntax) promptItem = normalizePrompt({prompt: promptItem, data});

        const targetItem: Prompt = {
            id: promptItem,
            parentGroup: groupId,
            weight: weight !== undefined ? weight : DEFAULT_PROMPT_WEIGHT
        }

        if(pendingSeparator.value) {
            targetItem.separatorBefore = pendingSeparator.value;
            pendingSeparator.value = "";
        }

        if(isExternalNetwork) targetItem.isExternalNetwork = true;

        if(syntax) {
            targetItem.isSyntax = true;

            // Braces and alternation bars are structural syntax and should stay
            // joined to their neighbours. BREAK is a standalone visual entry;
            // its original surrounding whitespace/newlines are preserved by
            // separatorBefore/separatorAfter.
            if(isExtendedSyntax) targetItem.delimiter = "none";
        }

        activePrompts.push(targetItem);
    }

    // Preserve a separator-only tail such as the final period in "bird.".
    if(pendingSeparator.value) appendSeparator(activePrompts, pendingSeparator.value, {value: ""});
}
