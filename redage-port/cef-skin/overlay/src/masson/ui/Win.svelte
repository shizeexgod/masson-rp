<script>
    // Окно Masson RP (дизайн .win): заголовок с иконкой и крестиком, содержимое в слоте. Esc и × вызывают onClose.
    import Stage from '../Stage.svelte'
    import Icon from '../Icon.svelte'
    export let icon = 'id';
    export let title = '';
    export let sub = '';
    export let size = 'sm';          // sm 760 · md 1000 · '' 1280 · lg 1500
    export let onClose = null;
    export let closeOnEsc = true;

    const onKey = (e) => { if (closeOnEsc && e.keyCode === 27 && onClose) onClose(); };
</script>

<svelte:window on:keyup={onKey} />
<Stage>
    <div class="win panel" class:win--sm={size === 'sm'} class:win--md={size === 'md'} class:win--lg={size === 'lg'} style="height:auto;margin-top:0;transform:translateY(-50%);top:50%">
        <div class="win__h">
            <Icon name={icon} />
            <div class="grow"><div class="win__t">{title}</div>{#if sub}<div class="win__s">{sub}</div>{/if}</div>
            <slot name="right" />
            {#if onClose}<button class="btn btn--icon btn--ghost btn--sm" aria-label="Закрыть" on:click={onClose}><Icon name="x" /></button>{/if}
        </div>
        <div class="win__b"><slot /></div>
    </div>
</Stage>
