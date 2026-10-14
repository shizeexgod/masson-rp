<script>
    // Ввод Masson RP. Логика RedAge прежняя: Enter или кнопка → executeClient('input', значение).
    import { onMount } from 'svelte'
    import { executeClient } from 'api/rage'
    import Stage from '@/masson/Stage.svelte'
    export let popupData;

    let title = popupData.title,
        plholder = popupData.plholder,
        input = "",
        len = popupData.length;
    let field;

    onMount(() => { if (field) field.focus(); });

    const onSend = () => {
        executeClient('input', input);
        input = "";
    }

    const HandleKeyDown = (event) => {
        if (event.keyCode == 13) onSend();
    }
</script>

<svelte:window on:keyup={HandleKeyDown} />
<Stage>
    <div class="scrim">
        <div class="modal panel" role="dialog" aria-modal="true" style="width:460px">
            <h2 class="h2">{title}</h2>
            <label class="field" style="margin-top:18px">
                <span class="field__label">{plholder || 'Значение'}{#if len} <em>{input.length}/{len}</em>{/if}</span>
                <span class="input"><input bind:this={field} placeholder={plholder} maxlength={len} bind:value={input} autocomplete="off" spellcheck="false"></span>
            </label>
            <div class="modal__actions">
                <button class="btn btn--primary" on:click={onSend}>Подтвердить <span class="keycap keycap--mute" style="background:rgba(255,255,255,.2);border-color:transparent">Enter</span></button>
            </div>
        </div>
    </div>
</Stage>
