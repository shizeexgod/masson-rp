<script>
    // Имя и фамилия: правила проверки — api/validation (как в RedAge), значения — stores FirstName/LastName.
    import { FirstName, LastName, updateFirstName, updateLastName } from 'store/customization'
    import { validate } from 'api/validation'
    import Icon from '@/masson/Icon.svelte'
    import { isInput } from '@/views/player/newauthentication/store.js'

    let first = '', last = '';
    let touchedFirst = false, touchedLast = false;

    FirstName.subscribe(v => { if (v !== first) first = v || ''; });
    LastName.subscribe(v => { if (v !== last) last = v || ''; });

    $: if (touchedFirst || first) updateFirstName(first);
    $: if (touchedLast || last) updateLastName(last);

    $: eFirst = touchedFirst ? check1(first) : '';
    $: eLast = touchedLast ? check2(last) : '';

    const check1 = (v) => { const r = validate('name', v); return r.valid ? '' : r.text; };
    const check2 = (v) => { const r = validate('surname', v); return r.valid ? '' : r.text; };

    // вызывается мастером перед созданием, чтобы показать ошибки у полей
    export const check = () => { touchedFirst = true; touchedLast = true; };

    $: okFirst = touchedFirst && !eFirst && first.length > 0;
    $: okLast = touchedLast && !eLast && last.length > 0;
    $: ruleLen = first.length >= 3 && last.length >= 3;
    $: ruleLat = /^[a-zA-Z]*$/.test(first) && /^[a-zA-Z]*$/.test(last) && first.length > 0 && last.length > 0;
</script>

<div><div class="h2">Личные данные</div><p class="p" style="margin-top:6px">Имя должно звучать как настоящее. Оно необратимо.</p></div>

<div class="grid g2">
    <label class="field" class:is-ok={okFirst} class:is-error={!!eFirst}>
        <span class="field__label">Имя</span>
        <span class="input"><input placeholder="Имя" bind:value={first} maxlength="25" autocomplete="off" spellcheck="false"
               on:input={() => touchedFirst = true} on:focus={() => isInput.set(true)} on:blur={() => isInput.set(false)}></span>
        {#if eFirst}<span class="field__msg field__msg--error"><Icon name="err" />{eFirst}</span>{/if}
    </label>
    <label class="field" class:is-ok={okLast} class:is-error={!!eLast}>
        <span class="field__label">Фамилия</span>
        <span class="input"><input placeholder="Фамилия" bind:value={last} maxlength="25" autocomplete="off" spellcheck="false"
               on:input={() => touchedLast = true} on:focus={() => isInput.set(true)} on:blur={() => isInput.set(false)}></span>
        {#if eLast}<span class="field__msg field__msg--error"><Icon name="err" />{eLast}</span>{/if}
    </label>
</div>
<div class="stack stack--s">
    <div class="rule" class:is-ok={ruleLen} class:is-bad={!ruleLen && (touchedFirst || touchedLast)}><Icon name={ruleLen ? 'check' : 'x'} />От 3 букв в имени и фамилии</div>
    <div class="rule" class:is-ok={ruleLat} class:is-bad={!ruleLat && (touchedFirst || touchedLast)}><Icon name={ruleLat ? 'check' : 'x'} />Только латинские буквы, без цифр и символов</div>
</div>
