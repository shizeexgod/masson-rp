<script>
    // Подтверждение Masson RP. Логика RedAge прежняя: Esc → client:OnDialogCallback(false), Enter → true.
    import { executeClient } from 'api/rage'
    import Stage from '@/masson/Stage.svelte'
    import Icon from '@/masson/Icon.svelte'
    export let popupData;

    let title = popupData.title,
        text = popupData.text;

    const answer = (ok) => executeClient('client:OnDialogCallback', ok);

    const HandleKeyDown = (event) => {
        const { keyCode } = event;
        if (keyCode == 27) answer(false);
        else if (keyCode == 13) answer(true);
    }
</script>

<svelte:window on:keyup={HandleKeyDown} />
<Stage>
    <div class="scrim">
        <div class="modal modal--w panel" role="alertdialog" aria-modal="true" style="width:460px">
            <div class="modal__ico modal__ico--acc"><Icon name="warn" /></div>
            {#if title.length > 0}<h2 class="h2">{title}</h2>{/if}
            {#if text.length > 0}<p class="p" style="margin-top:8px">{@html text}</p>{/if}
            <div class="modal__actions">
                <button class="btn" on:click={() => answer(false)}>Отмена <span class="keycap keycap--mute">Esc</span></button>
                <button class="btn btn--primary" on:click={() => answer(true)}>Подтвердить <span class="keycap keycap--mute" style="background:rgba(255,255,255,.2);border-color:transparent">Enter</span></button>
            </div>
        </div>
    </div>
</Stage>
