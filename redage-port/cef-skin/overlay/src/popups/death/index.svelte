<script>
    // Смерть Masson RP. Те же три варианта, что у RedAge: client:OnHospitalDialogCallback 1 / 2 / 3.
    import { executeClient } from 'api/rage'
    import Stage from '@/masson/Stage.svelte'
    export let popupData;

    let text = popupData.text;
    const pick = (n) => executeClient('client:OnHospitalDialogCallback', n);
</script>

<Stage>
    <div class="death">
        <div class="ctl" style="gap:18px">
            <span class="hx__eyebrow" style="color:#ff8fa3">Вы без сознания</span>
            {#if text && text.length > 0}<div class="hx__s" style="max-width:480px;text-align:center">{@html text}</div>{/if}
            <div class="row">
                <button class="btn btn--lg" on:click={() => pick(1)}>Подождать · 5 мин</button>
                <button class="btn btn--lg btn--primary" on:click={() => pick(2)}>Вызвать EMS · 10 мин</button>
                <button class="btn btn--lg" on:click={() => pick(3)}>В больницу · 1 мин</button>
            </div>
        </div>
    </div>
</Stage>
