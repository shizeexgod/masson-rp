<script>
    // Лифт Masson RP. События RedAge прежние: lift('start', этаж) и lift('stop').
    import { executeClient } from 'api/rage'
    import Win from '@/masson/ui/Win.svelte'
    import Icon from '@/masson/Icon.svelte'
    export let viewData;

    let floors = viewData,
        floor = 0;

    const start = () => executeClient('lift', 'start', floor);
    const stop = () => executeClient('lift', 'stop');
    const up = () => { floor = Math.min(floors.length - 1, floor + 1); };
    const down = () => { floor = Math.max(0, floor - 1); };

    const onKey = (e) => {
        if (e.keyCode === 38) up();
        else if (e.keyCode === 40) down();
        else if (e.keyCode === 13) start();
    };
</script>

<svelte:window on:keyup={onKey} />
<Win icon="building" title="Лифт" sub="Выберите этаж" size="sm">
    <div class="stack stack--s" style="max-height:360px;overflow:auto">
        {#each floors as f, i}
            <div class="li" class:is-active={i === floor} role="button" tabindex="0" on:click={() => floor = i}><Icon name="pin" /><b style="color:var(--text)">{f}</b></div>
        {/each}
    </div>
    <div class="modal__actions" style="margin-top:0">
        <button class="btn" on:click={stop}>Стоп</button>
        <button class="btn btn--primary" on:click={start}>Ехать <span class="keycap keycap--mute" style="background:rgba(255,255,255,.2);border-color:transparent">Enter</span></button>
    </div>
</Win>
