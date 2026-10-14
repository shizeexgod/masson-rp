<script>
    // Вход и выбор персонажа Masson RP.
    // Start (вход/регистрация/восстановление) и Chars (слоты и создание персонажа) — дизайн Masson RP.
    import { translateText } from 'lang'
    import { executeClient } from 'api/rage'
    import './fonts/auth/auth.css';
    import './main.sass';

    import Stage from '@/masson/Stage.svelte'
    import Start from './start/index.svelte';
    import Chars from './chars/index.svelte';

    const Views = {
        Start,
        Chars
    }

    let SelectViews = "Start";

    const OnSelectViews = (view) => {
        if (SelectViews === view)
            return;

        SelectViews = view;
    }

    import { onMount, onDestroy } from 'svelte'
    import { addListernEvent } from "api/functions";

    onMount(() => {
        window.events.addEvent("cef.authentication.setView", OnSelectViews);
        setTimeout(() => {
            executeClient ("client:AuthInit");
        }, 150)
    });

    onDestroy(() => {
        window.events.removeEvent("cef.authentication.setView", OnSelectViews);
    });

    let queueText = false;
    addListernEvent ("queueText", (text) => {
        queueText = text;
    })
</script>

{#if queueText}
    <Stage scene={true}>
        <div class="scr">
            <div class="scr__bg"></div>
            <div class="scr__vignette"></div>
            <div class="scrim">
                <div class="modal panel" role="status">
                    <h2 class="h2">Вы находитесь в очереди</h2>
                    <p class="p" style="margin-top:8px">{queueText}</p>
                </div>
            </div>
        </div>
    </Stage>
{:else if SelectViews === "Start"}
    <Stage scene={true}>
        <Start />
    </Stage>
{:else}
    <Stage>
        <svelte:component this={Views[SelectViews]} />
    </Stage>
{/if}
