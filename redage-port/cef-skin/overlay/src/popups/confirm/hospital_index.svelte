<script>
    // Больница Masson RP: три варианта (RedAge: client:OnHospitalDialogCallback 1 — подождать, 2 — вызвать EMS, 3 — в больницу).
    import { executeClient } from 'api/rage'
    import Stage from '@/masson/Stage.svelte'
    import Icon from '@/masson/Icon.svelte'
    export let popupData;

    let title = popupData.title,
        text = popupData.text;

    const pick = (n) => executeClient('client:OnHospitalDialogCallback', n);
</script>

<Stage>
    <div class="scrim">
        <div class="modal panel" role="alertdialog" aria-modal="true" style="width:520px">
            <div class="modal__ico modal__ico--acc"><Icon name="firstaid" /></div>
            <h2 class="h2">{title.length > 0 ? title : 'Вы без сознания'}</h2>
            {#if text.length > 0}<p class="p" style="margin-top:8px">{@html text}</p>{/if}
            <div class="stack stack--s" style="margin-top:16px">
                <button class="btn btn--block" on:click={() => pick(1)}>Подождать <span class="p">5 мин</span></button>
                <button class="btn btn--primary btn--block" on:click={() => pick(2)}>Вызвать EMS <span class="p">10 мин</span></button>
                <button class="btn btn--block" on:click={() => pick(3)}>В больницу <span class="p">1 мин</span></button>
            </div>
        </div>
    </div>
</Stage>
