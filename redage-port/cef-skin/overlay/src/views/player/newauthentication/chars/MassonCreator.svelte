<script>
    // Мастер создания персонажа Masson RP: 6 шагов (пол, родители, лицо, внешность, одежда, имя).
    // Данные и события — прежние (store/customization, client.characters.customization.*).
    import { createEventDispatcher, onDestroy } from 'svelte'
    import { executeClient } from 'api/rage'
    import { gender, FirstName, LastName } from 'store/customization'
    import CreateNewCustomization from 'store/random/index.js'
    import { validate } from 'api/validation'
    import { selectIndex } from './store.js'
    import Icon from '@/masson/Icon.svelte'
    import StepGender from './steps/StepGender.svelte'
    import StepParents from './steps/StepParents.svelte'
    import StepFace from './steps/StepFace.svelte'
    import StepLook from './steps/StepLook.svelte'
    import StepOutfit from './steps/StepOutfit.svelte'
    import StepName from './steps/StepName.svelte'

    export let isSendCreator = false;
    const dispatch = createEventDispatcher();

    const STEPS = [
        { id: 'gender',  title: 'Пол',          icon: 'user',     cmp: StepGender },
        { id: 'parents', title: 'Родители',     icon: 'users',    cmp: StepParents },
        { id: 'face',    title: 'Лицо',         icon: 'face',     cmp: StepFace },
        { id: 'look',    title: 'Внешность',    icon: 'scissors', cmp: StepLook },
        { id: 'outfit',  title: 'Одежда',       icon: 'shirt',    cmp: StepOutfit },
        { id: 'name',    title: 'Имя',          icon: 'doc',      cmp: StepName },
    ];
    let step = 0;
    let isCreate = false;
    let randomOpen = false;
    let nameStep;
    let scroller;

    // камера игры: «Лицо / Торс / Ноги / Обувь»
    const CAMS = [['hat', 'Лицо'], ['top', 'Торс'], ['legs', 'Ноги'], ['shoes', 'Обувь']];
    let cam = 'hat';
    const setCam = (c) => { cam = c; executeClient("client.characters.customization.updateCam", c); };

    const MouseUse = (toggled) => executeClient("client.camera.toggled", toggled);

    const go = (i) => { step = i; if (scroller) scroller.scrollTop = 0; if (STEPS[i].id === 'outfit') setCam('top'); else if (STEPS[i].id !== 'outfit' && cam !== 'hat') setCam('hat'); };

    const next = () => { if (step < STEPS.length - 1) go(step + 1); else create(); };
    const back = () => { if (step > 0) go(step - 1); else dispatch('back'); };

    const create = () => {
        if (isCreate) return;
        if (!isSendCreator) {
            let check = validate("name", $FirstName);
            if (!check.valid) { window.notificationAdd(4, 9, check.text, 3000); if (nameStep) nameStep.check(); go(5); return; }
            check = validate("surname", $LastName);
            if (!check.valid) { window.notificationAdd(4, 9, check.text, 3000); if (nameStep) nameStep.check(); go(5); return; }
        }
        isCreate = true;
        executeClient('client.characters.customization.create', $selectIndex, $FirstName, $LastName, $gender);
    };

    const onError = (text) => {
        isCreate = false;
        window.notificationAdd(4, 9, text, 3000);
    };
    window.events.addEvent("cef.customization.error", onError);
    onDestroy(() => window.events.removeEvent("cef.customization.error", onError));

    const onKeyUp = (event) => {
        if (randomOpen) { if (event.keyCode === 27) randomOpen = false; return; }
        if (event.keyCode === 13 && step === STEPS.length - 1) create();
    };

    const doRandom = () => { CreateNewCustomization($gender); randomOpen = false; };
</script>

<svelte:window on:keyup={onKeyUp} />

<section class="cr__panel panel" aria-label="Создание персонажа"
         on:mouseenter={() => MouseUse(false)} on:mouseleave={() => MouseUse(true)}>
    <div class="tabs tabs--icons" role="tablist" style="padding:0 12px">
        {#each STEPS as s, i}
            <button class="tab" class:is-active={i === step} role="tab" title={s.title} aria-selected={i === step}
                    on:click={() => go(i)}><Icon name={s.icon} /></button>
        {/each}
    </div>
    <div class="cr__scroll stack stack--l" bind:this={scroller}>
        {#key step}
            {#if STEPS[step].id === 'name'}
                <StepName bind:this={nameStep} />
            {:else}
                <svelte:component this={STEPS[step].cmp} />
            {/if}
        {/key}
    </div>
    <div class="cr__foot">
        <span>Шаг {step + 1} из {STEPS.length} · {STEPS[step].title}</span>
        <div class="prog grow" style="height:4px"><i style="--v:{(step + 1) / STEPS.length * 100}"></i></div>
        <button class="btn btn--ghost btn--sm" on:click={() => randomOpen = true}><Icon name="rotate" />Случайно</button>
    </div>
</section>

<div class="cr__stage" aria-hidden="true"><div class="cr__spot"></div><div class="cr__ring"></div></div>

<div class="cr__cam panel panel--flat" aria-label="Камера"
     on:mouseenter={() => MouseUse(false)} on:mouseleave={() => MouseUse(true)}>
    <span class="eyebrow">Камера</span>
    {#each CAMS as [id, title]}
        <button class="btn btn--sm" class:btn--primary={cam === id} on:click={() => setCam(id)}>{title}</button>
    {/each}
    <span class="rule" style="margin-left:6px">Колесо мыши — приближение, мышь вне панелей — поворот</span>
</div>

<div class="cr__act" on:mouseenter={() => MouseUse(false)} on:mouseleave={() => MouseUse(true)}>
    <button class="btn btn--lg" on:click={back}><Icon name="back" />Назад</button>
    <button class="btn btn--primary btn--lg" class:is-loading={isCreate} on:click={next}>
        {step === STEPS.length - 1 ? 'Создать персонажа' : 'Далее'}
    </button>
</div>

{#if randomOpen}
    <div class="scrim">
        <div class="modal panel" role="alertdialog" aria-modal="true">
            <div class="modal__ico"><Icon name="rotate" /></div>
            <h2 class="h2">Случайная внешность?</h2>
            <p class="p" style="margin-top:8px">Текущие настройки внешности будут заменены случайными.</p>
            <div class="modal__actions">
                <button class="btn" on:click={() => randomOpen = false}>Отмена</button>
                <button class="btn btn--primary" on:click={doRandom}>Сгенерировать</button>
            </div>
        </div>
    </div>
{/if}
