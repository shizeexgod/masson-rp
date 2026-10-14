<script>
    // Поле ввода Masson RP (дизайн .field/.input). Значение возвращается через bind:value.
    // Пока поле в фокусе, store isInput = true (RedAge блокирует горячие клавиши во время ввода).
    import { onMount } from 'svelte'
    import Icon from '../Icon.svelte'
    import { isInput } from '@/views/player/newauthentication/store.js'

    export let label = '';
    export let type = 'text';
    export let placeholder = '';
    export let icon = '';
    export let value = '';
    export let error = '';
    export let optional = false;
    export let autocomplete = 'off';
    export let maxlength = 64;
    export let autofocus = false;

    let input;
    let shown = false;

    $: if (input) input.type = (type === 'password' && shown) ? 'text' : type;

    onMount(() => { if (autofocus && input) input.focus(); });
    export const focus = () => { if (input) input.focus(); };

    const onInput = (e) => { value = e.target.value; };
</script>

<label class="field" class:is-error={!!error}>
    <span class="field__label">{label}{#if optional} <em>необязательно</em>{/if}</span>
    <span class="input">
        {#if icon}<Icon name={icon} />{/if}
        <input bind:this={input} {placeholder} {maxlength} {autocomplete} value={value}
               spellcheck="false" autocapitalize="off"
               on:input={onInput}
               on:focus={() => isInput.set(true)} on:blur={() => isInput.set(false)} />
        {#if type === 'password'}
            <button type="button" class="input__act" tabindex="-1" aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
                    on:click={() => shown = !shown}><Icon name={shown ? 'eyeoff' : 'eye'} /></button>
        {/if}
    </span>
    {#if error}
        <span class="field__msg field__msg--error"><Icon name="err" />{error}</span>
    {/if}
</label>
