<script>
    // Заправка Masson RP. События RedAge прежние: petrol(литры), petrol.full, petrol.gov, closePetrol.
    import { executeClient } from 'api/rage'
    import Win from '@/masson/ui/Win.svelte'

    let input = "";
    window.petrol = { reset: () => { input = ""; } };

    const gov = () => executeClient('petrol.gov');
    const full = () => executeClient('petrol.full');
    const yes = () => { const n = parseInt(input); if (n > 0) executeClient('petrol', n); };
    const no = () => executeClient('closePetrol');
    const onKey = (e) => { if (e.keyCode === 13) yes(); };
</script>

<svelte:window on:keyup={onKey} />
<Win icon="fuel" title="Заправка" sub="Сколько литров залить?" size="sm" onClose={no}>
    <label class="field">
        <span class="field__label">Литры</span>
        <span class="input"><input maxlength="3" inputmode="numeric" placeholder="0" bind:value={input} autocomplete="off"></span>
    </label>
    <div class="stack stack--s">
        <button class="btn btn--primary btn--lg btn--block" on:click={yes}>Заправить</button>
        <button class="btn btn--lg btn--block" on:click={full}>Полный бак</button>
        <button class="btn btn--lg btn--block" on:click={gov}>За счёт организации</button>
    </div>
</Win>
