<script>
    // Выбор из списка Masson RP. Логика RedAge прежняя: ↑/↓, Enter → popup.list.selected(id), Esc/Отмена → "null".
    import { executeClient } from 'api/rage'
    import Stage from '@/masson/Stage.svelte'
    import Icon from '@/masson/Icon.svelte'
    export let popupData;

    let title = popupData.title,
        elements = [];

    $: if (popupData.elements && typeof popupData.elements === "string")
        elements = JSON.parse(popupData.elements);

    let listId = 0;

    const onSelected = (listItem) => executeClient('popup.list.selected', listItem);

    const HandleKeyDown = (event) => {
        const { keyCode } = event;
        switch (keyCode) {
            case 13:
                if (elements[listId]) onSelected(elements[listId][1]);
                break;
            case 38:
                if (--listId < 0) listId = elements.length - 1;
                break;
            case 40:
                if (++listId >= elements.length) listId = 0;
                break;
            case 27:
                onSelected("null");
                break;
        }
    }
</script>

<svelte:window on:keyup={HandleKeyDown} />
<Stage>
    <div class="scrim">
        <div class="modal panel" role="dialog" aria-modal="true" style="width:480px">
            <h2 class="h2">{title}</h2>
            <div class="stack stack--s" style="margin-top:14px;max-height:420px;overflow:auto">
                {#each elements as item, index}
                    <div class="li" class:is-active={listId === index} role="button" tabindex="0"
                         on:mouseenter={() => listId = index} on:click={() => onSelected(item[1])}>
                        <Icon name="pin" /><b style="color:var(--text)">{item[0]}</b>
                    </div>
                {/each}
            </div>
            <div class="modal__actions">
                <button class="btn" on:click={() => onSelected("null")}>Отмена <span class="keycap keycap--mute">Esc</span></button>
                <button class="btn btn--primary" on:click={() => elements[listId] && onSelected(elements[listId][1])}>Выбрать <span class="keycap keycap--mute" style="background:rgba(255,255,255,.2);border-color:transparent">Enter</span></button>
            </div>
        </div>
    </div>
</Stage>
