<script>
    // Трекер задания Masson RP. Логика RedAge сохранена (store/quest, события client.quest.selectQuest.*).
    import { getQuest } from 'json/quests/quests.js';
    import { storeQuests, selectQuest } from 'store/quest'
    import keys from 'store/keys'
    import keysName from 'json/keys.js'
    import { executeClient } from 'api/rage'
    import { isHelp } from 'store/hud'
    import Icon from '../Icon.svelte'

    let QuestsList = [];
    let OldQuest = [];
    let quest = false;

    const onSelectQuest = (actorName) => {
        const listIndex = QuestsList.findIndex(q => q.ActorName == actorName);
        if (QuestsList[listIndex]) { quest = QuestsList[listIndex]; return; }
        quest = false;
    };

    storeQuests.subscribe((value) => {
        if (value && value.length && OldQuest != value) {
            executeClient("client.quest.selectQuest.Clear");

            OldQuest = value;
            QuestsList = [];

            value.forEach(questData => {
                const questInfo = getQuest(questData.ActorName, questData.Line);
                if (questInfo && questInfo.Title && questInfo.Tasks && questInfo.Tasks[questData.Stage]) {
                    executeClient("client.quest.selectQuest.Add", questData.ActorName, (questInfo.Tasks.length - 1) === questData.Stage);
                    QuestsList.push({ ActorName: questData.ActorName, Title: questInfo.Title, Text: questInfo.Tasks[questData.Stage] });
                }
            });
            QuestsList = QuestsList;

            if (!quest && QuestsList.length && typeof QuestsList[0] === "object" && typeof $selectQuest !== "string") {
                quest = QuestsList[0];
                selectQuest.set(quest.ActorName);
                return;
            }
            onSelectQuest($selectQuest);
        }
    });

    selectQuest.subscribe((value) => onSelectQuest(value));
</script>

{#if quest && quest.Title && $isHelp}
    <div class="tracker">
        <div class="tracker__head"><Icon name="quest" /><span class="tracker__title">{@html quest.Title}</span></div>
        <div class="goal"><span class="goal__box"></span><span class="goal__text">{@html quest.Text}</span></div>
        <div class="tracker__more"><span class="key">{keysName[$keys[12]]}</span> Информация</div>
    </div>
{/if}

<style>
    :global(.mp .hud .tracker__more) { display: flex; align-items: center; gap: 8px; font-size: var(--fs-xs); color: var(--text-muted); font-weight: var(--fw-semibold); }
</style>
