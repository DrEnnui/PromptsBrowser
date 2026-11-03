import ActivePrompts from "client/managers/ActivePrompts/index";
import { PromptStringEntity } from 'client/utils/parseGroups';
import { PromptEntity, PromptGroup } from "clientTypes/prompt";
import createPromptObjects from "./createPromptObjects";


export default function processGroup({entityArray, comments, activePrompts, normalize = false, nestingLevel = 0, groupId = false}:{
    entityArray: PromptStringEntity[];
    comments?: Map<string, string>;
    activePrompts: PromptEntity[];
    normalize: boolean;
    nestingLevel?: number;
    groupId?: number | false;
}) {
    for(const entity of entityArray) {
        if(typeof entity === "string") {
            createPromptObjects({
                value: entity,
                comments,
                normalize,
                activePrompts,
                nestingLevel,
                groupId,
            });

        } else if("id" in entity) {
            const {id, weight, body} = entity;

            const newGroup: PromptGroup = {
                groupId: id,
                parentGroup: groupId,
                weight: weight,
                prompts: [],
            }

            activePrompts.push(newGroup);
            processGroup({
                entityArray: body,
                comments,
                activePrompts: newGroup.prompts,
                normalize,
                nestingLevel: nestingLevel + 1,
                groupId: id,
            });

            if(ActivePrompts.foldedGroups.length) {
                const keyForGroup = ActivePrompts.makeGroupKey(newGroup);
                if(keyForGroup && ActivePrompts.foldedGroups.includes(keyForGroup)) {
                    newGroup.folded = true;
                }
            }
        }
    }
}
