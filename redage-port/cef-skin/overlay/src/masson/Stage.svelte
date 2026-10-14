<script>
    // Корень интерфейса Masson RP: сцена 1920×1080, масштабируется под окно CEF.
    // Все стили дизайна живут внутри .mp (см. tools/scope-css.js), со старыми стилями RedAge не пересекаются.
    import './masson.css'
    import { onMount, onDestroy } from 'svelte'

    export let scene = false;       // .has-scene: непрозрачный фон сцены (для экранов входа)
    export let pointer = true;      // pointer-events у корня (HUD — false, чтобы не перехватывать мышь у игры)

    let stage;
    let scale = 1, left = 0, top = 0;

    const fit = () => {
        const w = window.innerWidth || 1920, h = window.innerHeight || 1080;
        scale = Math.min(w / 1920, h / 1080);
        left = (w - 1920 * scale) / 2;
        top = (h - 1080 * scale) / 2;
    }

    onMount(() => { fit(); window.addEventListener('resize', fit); });
    onDestroy(() => { window.removeEventListener('resize', fit); });
</script>

<div class="mp mp-root" class:mp-nopointer={!pointer}>
    <!-- Градиент для штриха иконок (stroke: url(#masson-grad)) -->
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        <linearGradient id="masson-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color:var(--accent-from)"/>
            <stop offset=".52" style="stop-color:var(--accent-mid)"/>
            <stop offset="1" style="stop-color:var(--accent-to)"/>
        </linearGradient>
        <linearGradient id="masson-grad-arc" gradientUnits="userSpaceOnUse" x1="248" y1="132" x2="132" y2="16">
            <stop offset="0" style="stop-color:var(--accent-from)"/>
            <stop offset=".52" style="stop-color:var(--accent-mid)"/>
            <stop offset="1" style="stop-color:var(--accent-to)"/>
        </linearGradient>
    </defs></svg>
    <div class="stage" class:has-scene={scene} bind:this={stage}
         style="transform: scale({scale}); left: {left}px; top: {top}px;">
        <slot />
    </div>
</div>

<style>
    :global(.mp-root) { position: fixed; inset: 0; z-index: 5; overflow: hidden; }
    :global(.mp-root.mp-nopointer) { pointer-events: none; }
    :global(.mp-root.mp-nopointer .stage) { pointer-events: none; }
</style>
